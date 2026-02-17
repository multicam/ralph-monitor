import type {
  MonitorEvent,
  ToolCallEvent,
  ToolResultEvent,
  ThinkingEvent,
  IterationEvent,
  RawEvent,
  RawJsonlMessage,
  RawContent,
} from "./types.ts";

let eventCounter = 0;
function nextId(): string {
  return `evt_${Date.now()}_${eventCounter++}`;
}

const LOOP_MARKER = /=+\s*LOOP\s+(\d+)\s*=+/;

export function parseLine(line: string, loopId: string): MonitorEvent | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  // Try loop boundary marker first
  const loopMatch = trimmed.match(LOOP_MARKER);
  if (loopMatch) {
    return {
      id: nextId(),
      type: "iteration",
      timestamp: Date.now(),
      loopId,
      summary: `Iteration ${loopMatch[1]}`,
      iterationNumber: parseInt(loopMatch[1]!, 10),
    } satisfies IterationEvent;
  }

  // Try JSON parse
  let msg: RawJsonlMessage;
  try {
    msg = JSON.parse(trimmed);
  } catch {
    return {
      id: nextId(),
      type: "raw",
      timestamp: Date.now(),
      loopId,
      summary: trimmed.slice(0, 120),
      line: trimmed,
    } satisfies RawEvent;
  }

  // Must have type and message
  if (!msg.type || !msg.message?.content) return null;

  const content = msg.message.content[0];
  if (!content) return null;

  return parseContent(content, msg, loopId);
}

function parseContent(
  content: RawContent,
  msg: RawJsonlMessage,
  loopId: string,
): MonitorEvent | null {
  const now = Date.now();

  if (content.type === "tool_use") {
    return {
      id: nextId(),
      type: "tool_call",
      timestamp: now,
      loopId,
      toolName: content.name,
      toolUseId: content.id,
      input: content.input,
      model: msg.message.model ?? "unknown",
      sessionId: msg.session_id ?? "",
      summary: summarizeToolCall(content.name, content.input),
    } satisfies ToolCallEvent;
  }

  if (content.type === "tool_result") {
    const result = msg.tool_use_result ?? {};
    return {
      id: nextId(),
      type: "tool_result",
      timestamp: now,
      loopId,
      toolUseId: content.tool_use_id,
      durationMs: typeof result.durationMs === "number" ? result.durationMs : undefined,
      content: typeof content.content === "string" ? content.content : JSON.stringify(content.content),
      summary: summarizeToolResult(result),
    } satisfies ToolResultEvent;
  }

  if (content.type === "text") {
    const text = content.text;
    if (!text.trim()) return null;
    return {
      id: nextId(),
      type: "thinking",
      timestamp: now,
      loopId,
      excerpt: text.slice(0, 120),
      fullText: text,
      summary: text.slice(0, 120),
    } satisfies ThinkingEvent;
  }

  return null;
}

// ── Narrative Summaries ──

function basename(filePath: string): string {
  return filePath.split("/").pop() ?? filePath;
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + "..." : s;
}

function hostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url.slice(0, 40);
  }
}

export function summarizeToolCall(
  toolName: string,
  input: Record<string, unknown>,
): string {
  switch (toolName) {
    case "Glob":
      return `Searching \`${input.pattern}\``;
    case "Read":
      return `Reading \`${basename(String(input.file_path ?? ""))}\``;
    case "Edit":
      return `Editing \`${basename(String(input.file_path ?? ""))}\``;
    case "Write":
      return `Creating \`${basename(String(input.file_path ?? ""))}\``;
    case "Grep":
      return `Searching for \`${input.pattern}\``;
    case "Bash":
      return `Running: \`${truncate(String(input.command ?? ""), 60)}\``;
    case "Task":
      return `Spawning ${input.model ?? "sonnet"} subagent: ${truncate(String(input.description ?? ""), 50)}`;
    case "WebFetch":
      return `Fetching ${hostname(String(input.url ?? ""))}`;
    case "WebSearch":
      return `Searching web: \`${truncate(String(input.query ?? ""), 50)}\``;
    default:
      return `${toolName}(${truncate(JSON.stringify(input), 60)})`;
  }
}

export function summarizeToolResult(
  result: Record<string, unknown>,
): string {
  const duration = typeof result.durationMs === "number" ? `${result.durationMs}ms` : null;

  if (typeof result.numFiles === "number") {
    return `${result.numFiles} files found${duration ? ` (${duration})` : ""}`;
  }
  if (typeof result.exitCode === "number") {
    return `exit ${result.exitCode}${duration ? ` (${duration})` : ""}`;
  }
  if (duration) {
    return `completed (${duration})`;
  }
  return "completed";
}

// ── Tool Call/Result Pairing ──

export class EventPairer {
  private pending = new Map<string, ToolCallEvent>();
  private timeoutMs: number;

  constructor(timeoutMs = 60_000) {
    this.timeoutMs = timeoutMs;
  }

  process(event: MonitorEvent): MonitorEvent {
    if (event.type === "tool_call") {
      this.pending.set(event.toolUseId, event);
      return event;
    }

    if (event.type === "tool_result") {
      const call = this.pending.get(event.toolUseId);
      if (call) {
        this.pending.delete(event.toolUseId);
        return {
          id: call.id,
          type: "tool_paired",
          timestamp: call.timestamp,
          loopId: call.loopId,
          toolName: call.toolName,
          toolUseId: call.toolUseId,
          input: call.input,
          model: call.model,
          sessionId: call.sessionId,
          durationMs: event.durationMs,
          resultContent: event.content,
          resultSummary: event.summary,
          summary: call.summary,
        };
      }
      return event;
    }

    return event;
  }

  getPending(): ToolCallEvent[] {
    const now = Date.now();
    return [...this.pending.values()].filter(
      (e) => now - e.timestamp < this.timeoutMs,
    );
  }

  pruneStale(): void {
    const now = Date.now();
    for (const [id, event] of this.pending) {
      if (now - event.timestamp > this.timeoutMs) {
        this.pending.delete(id);
      }
    }
  }
}
