import { EventEmitter } from "events";
import { SshManager } from "./ssh-manager.ts";
import { LocalWatcher } from "./local-watcher.ts";
import { parseLine, EventPairer } from "../lib/parser.ts";
import type {
  AppConfig,
  MonitorEvent,
  LoopState,
  LoopConnectionStatus,
  LoopHealth,
  RawJsonlMessage,
} from "../lib/types.ts";
import { makeLoopId, sanitizeVmConfig } from "../lib/types.ts";

const BUFFER_SIZE = 500;

/** Extract timestamp from session filename like build-20260218-072927-iter2.jsonl */
function parseSessionTimestamp(sessionFile: string): number {
  const basename = sessionFile.split("/").pop() ?? "";
  const m = basename.match(/(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})/);
  if (!m) return Date.now();
  const [, y, mo, d, h, min, s] = m;
  return new Date(`${y}-${mo}-${d}T${h}:${min}:${s}`).getTime();
}
const STALE_TIMEOUT_MS = 5 * 60_000;
const LOOP_HEADER_MODE = /^Mode:\s+(\w+)/;
const LOOP_HEADER_BRANCH = /^Branch:\s+(.+)/;
const COMPLETED_PATTERN = /^Reached max iterations:/;
const COMPLETED_STOP_REASONS = new Set(["end_turn", "stop_sequence"]);
// Only match structured error fields, not mentions in content text
const ERROR_PATTERNS = [/"error":\s*\{\s*"type":\s*"overloaded"/, /"error":\s*\{\s*"type":\s*"rate_limit"/, /"error":\s*\{\s*"type":\s*"internal_error"/];

export class Pipeline extends EventEmitter {
  private managers: (SshManager | LocalWatcher)[] = [];
  private managersByVm = new Map<string, SshManager | LocalWatcher>();
  private pairers = new Map<string, EventPairer>();
  private buffers = new Map<string, MonitorEvent[]>();
  private loopStates = new Map<string, LoopState>();

  constructor(private config: AppConfig) {
    super();
  }

  start(): void {
    for (const vm of this.config.vms) {
      const manager = vm.local
        ? new LocalWatcher(vm.name, vm.watchDir)
        : new SshManager(vm);
      this.managers.push(manager);
      this.managersByVm.set(vm.name, manager);

      manager.on("line", (vmId: string, sessionFile: string, line: string) => {
        const loopId = makeLoopId(vmId, sessionFile);
        this.ensureLoop(loopId, vmId, sessionFile);
        this.handleLine(loopId, line);
      });

      manager.on("status", (vmId: string, sessionFile: string, status: string) => {
        const loopId = makeLoopId(vmId, sessionFile);
        this.ensureLoop(loopId, vmId, sessionFile);

        const newStatus: LoopConnectionStatus = status === "inactive" ? "inactive" : "connected";
        const state = this.loopStates.get(loopId);
        if (state && state.status !== newStatus) {
          this.updateLoopStatus(loopId, newStatus);
        }
      });

      manager.on("vm_connection", (vmId: string, status: string) => {
        if (status === "disconnected") {
          // Mark all loops for this VM as disconnected
          for (const [loopId, state] of this.loopStates) {
            if (state.vmName === vmId) {
              this.updateLoopStatus(loopId, "disconnected");
            }
          }
        }
      });

      manager.on("error", (vmId: string, err: Error) => {
        console.error(`[${vmId}] SSH error:`, err.message);
      });

      manager.start();
    }

    // Prune stale pending tool calls and check health periodically
    setInterval(() => {
      for (const pairer of this.pairers.values()) {
        pairer.pruneStale();
      }
      this.checkStaleLoops();
    }, 30_000);
  }

  stop(): void {
    for (const manager of this.managers) {
      manager.stop();
    }
  }

  getLoopStates(): Map<string, LoopState> {
    return this.loopStates;
  }

  getRecentEvents(loopId: string, count = 100): MonitorEvent[] {
    const buffer = this.buffers.get(loopId);
    if (!buffer) return [];
    return buffer.slice(-count);
  }

  async removeLoop(loopId: string): Promise<boolean> {
    const state = this.loopStates.get(loopId);
    if (!state) return false;

    // Remove from state immediately so the UI updates instantly
    this.loopStates.delete(loopId);
    this.buffers.delete(loopId);
    this.pairers.delete(loopId);
    this.emit("loop_removed", loopId);

    // Delete remote file in background
    const manager = this.managersByVm.get(state.vmName);
    if (manager) {
      manager.deleteFile(state.sessionFile).catch(() => {});
    }

    return true;
  }

  private ensureLoop(loopId: string, vmName: string, sessionFile: string): void {
    if (this.loopStates.has(loopId)) return;

    const vmConfig = this.config.vms.find((v) => v.name === vmName);
    if (!vmConfig) return;

    const state: LoopState = {
      loopId,
      vmName,
      vmConfig: sanitizeVmConfig(vmConfig),
      sessionFile,
      status: "connected",
      health: "running",
      currentIteration: 0,
      mode: null,
      branch: null,
      model: null,
      project: null,
      startedAt: parseSessionTimestamp(sessionFile),
      finishedAt: null,
      lastActivity: Date.now(),
    };

    this.loopStates.set(loopId, state);
    this.buffers.set(loopId, []);
    this.pairers.set(loopId, new EventPairer());

    this.emit("loop_status", loopId, state);
  }

  private handleLine(loopId: string, line: string): void {
    const state = this.loopStates.get(loopId);
    if (state) {
      state.lastActivity = Date.now();
      // If was stale, revive
      if (state.health === "stale") {
        state.health = "running";
        this.emit("loop_status", loopId, state);
      }
    }

    // Parse JSON once, reuse across all handlers
    let parsed: RawJsonlMessage | null = null;
    try {
      parsed = JSON.parse(line);
    } catch {
      // Not JSON — that's fine, plain text lines are common
    }

    this.extractMetadata(loopId, line, parsed);
    this.detectHealth(loopId, line, parsed);

    const events = parseLine(line, loopId, parsed);
    if (events.length === 0) return;

    const pairer = this.pairers.get(loopId);

    for (const event of events) {
      const processed = pairer ? pairer.process(event) : event;

      // Update state from events
      if (processed.type === "iteration") {
        if (state) {
          state.currentIteration = processed.iterationNumber;
          this.emit("loop_status", loopId, state);
        }
      }

      // If it's a paired event, replace the original tool_call in the buffer
      if (processed.type === "tool_paired") {
        const buffer = this.buffers.get(loopId);
        if (buffer) {
          const idx = buffer.findIndex(
            (e) => e.type === "tool_call" && e.id === processed.id,
          );
          if (idx !== -1) {
            buffer[idx] = processed;
          } else {
            this.pushToBuffer(loopId, processed);
          }
        }
      } else {
        this.pushToBuffer(loopId, processed);
      }

      this.emit("event", loopId, processed);
    }
  }

  private pushToBuffer(loopId: string, event: MonitorEvent): void {
    const buffer = this.buffers.get(loopId);
    if (!buffer) return;
    buffer.push(event);
    if (buffer.length > BUFFER_SIZE) {
      buffer.shift();
    }
  }

  private extractMetadata(loopId: string, line: string, parsed: RawJsonlMessage | null): void {
    const state = this.loopStates.get(loopId);
    if (!state) return;

    const modeMatch = line.match(LOOP_HEADER_MODE);
    if (modeMatch) {
      state.mode = modeMatch[1] ?? null;
      this.emit("loop_status", loopId, state);
    }

    const branchMatch = line.match(LOOP_HEADER_BRANCH);
    if (branchMatch) {
      state.branch = branchMatch[1] ?? null;
      this.emit("loop_status", loopId, state);
    }

    if (parsed?.message?.model && parsed.message.model !== state.model) {
      state.model = parsed.message.model;
      this.emit("loop_status", loopId, state);
    }

    // Extract project from init message: {"type":"system","subtype":"init","cwd":"/path/to/project"}
    if (!state.project && parsed) {
      const raw = parsed as Record<string, unknown>;
      if (raw.type === "system" && raw.subtype === "init" && typeof raw.cwd === "string") {
        state.project = (raw.cwd as string).split("/").pop() ?? null;
        this.emit("loop_status", loopId, state);
      }
    }
  }

  private detectHealth(loopId: string, line: string, parsed: RawJsonlMessage | null): void {
    const state = this.loopStates.get(loopId);
    if (!state) return;

    // Claude Code result summary is authoritative — overrides any prior state
    if (parsed && (parsed as Record<string, unknown>).type === "result") {
      const result = parsed as Record<string, unknown>;
      const health = result.is_error ? "errored" : "completed";
      const durationMs = typeof result.duration_ms === "number" ? result.duration_ms : null;
      state.health = health;
      state.finishedAt = durationMs && state.startedAt
        ? state.startedAt + durationMs
        : Date.now();
      this.emit("loop_status", loopId, state);
      return;
    }

    // Don't override terminal states
    if (state.health === "completed" || state.health === "errored") return;

    // Check for completion signal from loop.sh
    if (COMPLETED_PATTERN.test(line)) {
      this.setTerminalHealth(state, loopId, "completed");
      return;
    }

    // Assistant message with end_turn and no tool_use = session completed
    if (parsed?.message?.stop_reason && COMPLETED_STOP_REASONS.has(parsed.message.stop_reason)) {
      const contents = parsed.message.content ?? [];
      const hasToolUse = contents.some((c: { type: string }) => c.type === "tool_use");
      if (!hasToolUse) {
        this.setTerminalHealth(state, loopId, "completed");
        return;
      }
    }

    if (parsed?.message?.stop_reason === "error") {
      this.setTerminalHealth(state, loopId, "errored");
      return;
    }

    // Check for model/API errors in raw lines
    for (const pattern of ERROR_PATTERNS) {
      if (pattern.test(line)) {
        this.setTerminalHealth(state, loopId, "errored");
        return;
      }
    }
  }

  private setTerminalHealth(state: LoopState, loopId: string, health: LoopHealth): void {
    state.health = health;
    state.finishedAt = state.lastActivity ?? Date.now();
    this.emit("loop_status", loopId, state);
  }

  private checkStaleLoops(): void {
    const now = Date.now();
    for (const [loopId, state] of this.loopStates) {
      if (state.health !== "running") continue;
      if (state.lastActivity && now - state.lastActivity > STALE_TIMEOUT_MS) {
        // Check if the last buffered event suggests completion
        const buf = this.buffers.get(loopId);
        const last = buf?.[buf.length - 1];
        const looksCompleted = last?.type === "assistant" ||
          (last?.type === "tool_paired" && last.resultSummary);
        state.health = looksCompleted ? "completed" : "stale";
        state.finishedAt = state.lastActivity;
        this.emit("loop_status", loopId, state);
      }
    }
  }

  private updateLoopStatus(loopId: string, status: LoopConnectionStatus): void {
    const state = this.loopStates.get(loopId);
    if (!state) return;

    state.status = status;
    if (status === "disconnected") {
      state.startedAt = null;
    }

    this.emit("loop_status", loopId, state);
  }
}
