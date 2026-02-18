// ── Event Types ──

export type EventType =
  | "tool_call"
  | "tool_result"
  | "tool_paired"
  | "thinking"
  | "iteration"
  | "raw";

interface BaseEvent {
  id: string;
  timestamp: number;
  loopId: string;
  summary: string;
}

export interface ToolCallEvent extends BaseEvent {
  type: "tool_call";
  toolName: string;
  toolUseId: string;
  input: Record<string, unknown>;
  model: string;
  sessionId: string;
}

export interface ToolResultEvent extends BaseEvent {
  type: "tool_result";
  toolUseId: string;
  durationMs?: number;
  content: string;
}

export interface ToolPairedEvent extends BaseEvent {
  type: "tool_paired";
  toolName: string;
  toolUseId: string;
  input: Record<string, unknown>;
  model: string;
  sessionId: string;
  durationMs?: number;
  resultContent: string;
  resultSummary: string;
}

export interface ThinkingEvent extends BaseEvent {
  type: "thinking";
  excerpt: string;
  fullText: string;
}

export interface IterationEvent extends BaseEvent {
  type: "iteration";
  iterationNumber: number;
}

export interface RawEvent extends BaseEvent {
  type: "raw";
  line: string;
}

export type MonitorEvent =
  | ToolCallEvent
  | ToolResultEvent
  | ToolPairedEvent
  | ThinkingEvent
  | IterationEvent
  | RawEvent;

// ── VM & Loop Types ──

export type LoopConnectionStatus = "connected" | "disconnected" | "idle" | "inactive";

export type LoopHealth = "running" | "completed" | "errored" | "stale";

export interface VmConfig {
  name: string;
  host: string;
  user: string;
  key?: string;
  password?: string;
  local?: boolean;
  watchDir?: string;
}

/** Derives a loopId from vm name and session file basename */
export function makeLoopId(vmName: string, sessionFile: string): string {
  const base = sessionFile.split("/").pop() ?? sessionFile;
  return `${vmName}:${base}`;
}

/** Public-safe VM info (no credentials) */
export interface VmConfigPublic {
  name: string;
  host: string;
  user: string;
  local?: boolean;
}

export function sanitizeVmConfig(config: VmConfig): VmConfigPublic {
  return { name: config.name, host: config.host, user: config.user, local: config.local };
}

export interface LoopState {
  loopId: string;
  vmName: string;
  vmConfig: VmConfigPublic;
  sessionFile: string;
  status: LoopConnectionStatus;
  health: LoopHealth;
  currentIteration: number;
  mode: string | null;
  branch: string | null;
  model: string | null;
  startedAt: number | null;
  lastActivity: number | null;
}

// ── WebSocket Messages ──

export interface SnapshotMessage {
  type: "snapshot";
  loops: Record<string, LoopState>;
  recentEvents: Record<string, MonitorEvent[]>;
}

export interface EventMessage {
  type: "event";
  loopId: string;
  event: MonitorEvent;
}

export interface LoopStatusMessage {
  type: "loop_status";
  loopId: string;
  state: LoopState;
}

export interface LoopRemovedMessage {
  type: "loop_removed";
  loopId: string;
}

export type WsMessage = SnapshotMessage | EventMessage | LoopStatusMessage | LoopRemovedMessage;

// ── Config ──

export interface AppConfig {
  server: { port: number };
  vms: VmConfig[];
}

// ── Raw JSONL types (what Claude Code outputs) ──

export interface RawJsonlMessage {
  type: "assistant" | "user" | "system";
  message: {
    id?: string;
    role: string;
    model?: string;
    content: RawContent[];
    stop_reason?: string | null;
    usage?: { input_tokens: number; output_tokens: number };
  };
  session_id?: string;
  uuid?: string;
  parent_tool_use_id?: string | null;
  tool_use_result?: Record<string, unknown>;
}

export type RawContent =
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; tool_use_id: string; content: string }
  | { type: "text"; text: string };
