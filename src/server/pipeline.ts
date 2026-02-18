import { EventEmitter } from "events";
import { SshManager } from "./ssh-manager.ts";
import { LocalWatcher } from "./local-watcher.ts";
import { parseLine, EventPairer } from "../lib/parser.ts";
import type {
  AppConfig,
  MonitorEvent,
  LoopState,
  LoopConnectionStatus,
} from "../lib/types.ts";
import { makeLoopId } from "../lib/types.ts";

const BUFFER_SIZE = 500;
const LOOP_HEADER_MODE = /^Mode:\s+(\w+)/;
const LOOP_HEADER_BRANCH = /^Branch:\s+(.+)/;

export class Pipeline extends EventEmitter {
  private managers: (SshManager | LocalWatcher)[] = [];
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

      manager.on("line", (vmId: string, sessionFile: string, line: string) => {
        const loopId = makeLoopId(vmId, sessionFile);
        this.ensureLoop(loopId, vmId, sessionFile);
        this.handleLine(loopId, line);
      });

      manager.on("status", (vmId: string, sessionFile: string, status: string) => {
        const loopId = makeLoopId(vmId, sessionFile);
        this.ensureLoop(loopId, vmId, sessionFile);

        const loopStatus: LoopConnectionStatus =
          status === "inactive" ? "inactive" :
          status === "new" ? "connected" : "connected";

        this.updateLoopStatus(loopId, loopStatus);
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

    // Prune stale pending tool calls periodically
    setInterval(() => {
      for (const pairer of this.pairers.values()) {
        pairer.pruneStale();
      }
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

  private ensureLoop(loopId: string, vmName: string, sessionFile: string): void {
    if (this.loopStates.has(loopId)) return;

    const vmConfig = this.config.vms.find((v) => v.name === vmName);
    if (!vmConfig) return;

    const state: LoopState = {
      loopId,
      vmName,
      vmConfig,
      sessionFile,
      status: "connected",
      currentIteration: 0,
      mode: null,
      branch: null,
      model: null,
      startedAt: Date.now(),
    };

    this.loopStates.set(loopId, state);
    this.buffers.set(loopId, []);
    this.pairers.set(loopId, new EventPairer());

    this.emit("loop_status", loopId, state);
  }

  private handleLine(loopId: string, line: string): void {
    this.extractMetadata(loopId, line);

    const event = parseLine(line, loopId);
    if (!event) return;

    const pairer = this.pairers.get(loopId);
    const processed = pairer ? pairer.process(event) : event;

    // Update state from events
    if (processed.type === "iteration") {
      const state = this.loopStates.get(loopId);
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

  private pushToBuffer(loopId: string, event: MonitorEvent): void {
    const buffer = this.buffers.get(loopId);
    if (!buffer) return;
    buffer.push(event);
    if (buffer.length > BUFFER_SIZE) {
      buffer.shift();
    }
  }

  private extractMetadata(loopId: string, line: string): void {
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

    try {
      const parsed = JSON.parse(line);
      if (parsed.message?.model && parsed.message.model !== state.model) {
        state.model = parsed.message.model;
        this.emit("loop_status", loopId, state);
      }
    } catch {
      // Not JSON
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
