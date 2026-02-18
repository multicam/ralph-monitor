import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdirSync, writeFileSync, rmSync, appendFileSync, existsSync } from "fs";
import { join } from "path";
import { Pipeline } from "./pipeline.ts";
import type { AppConfig, LoopState, MonitorEvent } from "../lib/types.ts";

const TEST_DIR = "/tmp/ralph-pipeline-test-" + process.pid;

function makeConfig(watchDir: string): AppConfig {
  return {
    server: { port: 3000 },
    vms: [{ name: "test-vm", host: "localhost", user: "test", local: true, watchDir }],
  };
}

describe("Pipeline", () => {
  beforeEach(() => {
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  test("getLoopStates returns empty map initially", () => {
    const pipeline = new Pipeline(makeConfig(TEST_DIR));
    expect(pipeline.getLoopStates().size).toBe(0);
  });

  test("getRecentEvents returns empty for unknown loopId", () => {
    const pipeline = new Pipeline(makeConfig(TEST_DIR));
    expect(pipeline.getRecentEvents("nonexistent")).toEqual([]);
  });

  test("stop does not throw when no managers are running", () => {
    const pipeline = new Pipeline(makeConfig(TEST_DIR));
    expect(() => pipeline.stop()).not.toThrow();
  });

  test("discovers loop from JSONL file and emits loop_status", async () => {
    const filePath = join(TEST_DIR, "session.jsonl");
    writeFileSync(filePath, "");

    const pipeline = new Pipeline(makeConfig(TEST_DIR));
    const loopStatuses: Array<{ loopId: string; state: LoopState }> = [];

    pipeline.on("loop_status", (loopId: string, state: LoopState) => {
      loopStatuses.push({ loopId, state: { ...state } });
    });

    pipeline.start();
    await new Promise((r) => setTimeout(r, 100));

    // Append a JSONL line
    const jsonLine = JSON.stringify({
      type: "assistant",
      message: {
        role: "assistant",
        model: "claude-sonnet",
        content: [{ type: "tool_use", id: "c1", name: "Read", input: { file_path: "/a.ts" } }],
      },
      session_id: "s1",
    });
    appendFileSync(filePath, jsonLine + "\n");

    await new Promise((r) => setTimeout(r, 700));
    pipeline.stop();

    expect(loopStatuses.length).toBeGreaterThanOrEqual(1);
    const firstStatus = loopStatuses[0]!;
    expect(firstStatus.loopId).toBe("test-vm:session.jsonl");
    expect(firstStatus.state.vmName).toBe("test-vm");
    expect(firstStatus.state.health).toBe("running");
  });

  test("emits events for parsed JSONL lines", async () => {
    const filePath = join(TEST_DIR, "events.jsonl");
    writeFileSync(filePath, "");

    const pipeline = new Pipeline(makeConfig(TEST_DIR));
    const events: Array<{ loopId: string; event: MonitorEvent }> = [];

    pipeline.on("event", (loopId: string, event: MonitorEvent) => {
      events.push({ loopId, event });
    });

    pipeline.start();
    await new Promise((r) => setTimeout(r, 100));

    const toolCall = JSON.stringify({
      type: "assistant",
      message: {
        role: "assistant",
        model: "sonnet",
        content: [{ type: "tool_use", id: "c1", name: "Glob", input: { pattern: "*.ts" } }],
      },
      session_id: "s1",
    });
    appendFileSync(filePath, toolCall + "\n");

    await new Promise((r) => setTimeout(r, 700));
    pipeline.stop();

    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[0]!.event.type).toBe("tool_call");
  });

  test("pairs tool calls with results", async () => {
    const filePath = join(TEST_DIR, "paired.jsonl");
    writeFileSync(filePath, "");

    const pipeline = new Pipeline(makeConfig(TEST_DIR));
    const events: MonitorEvent[] = [];

    pipeline.on("event", (_loopId: string, event: MonitorEvent) => {
      events.push(event);
    });

    pipeline.start();
    await new Promise((r) => setTimeout(r, 100));

    const call = JSON.stringify({
      type: "assistant",
      message: {
        role: "assistant",
        model: "sonnet",
        content: [{ type: "tool_use", id: "c1", name: "Read", input: { file_path: "/a.ts" } }],
      },
      session_id: "s1",
    });
    const result = JSON.stringify({
      type: "user",
      message: {
        role: "user",
        content: [{ type: "tool_result", tool_use_id: "c1", content: "file contents" }],
      },
      tool_use_result: { durationMs: 42 },
    });

    appendFileSync(filePath, call + "\n" + result + "\n");

    await new Promise((r) => setTimeout(r, 700));
    pipeline.stop();

    const paired = events.find((e) => e.type === "tool_paired");
    expect(paired).toBeDefined();
    if (paired?.type === "tool_paired") {
      expect(paired.toolName).toBe("Read");
      expect(paired.durationMs).toBe(42);
    }
  });

  test("extracts model metadata from JSONL", async () => {
    const filePath = join(TEST_DIR, "model.jsonl");
    writeFileSync(filePath, "");

    const pipeline = new Pipeline(makeConfig(TEST_DIR));
    const statuses: LoopState[] = [];

    pipeline.on("loop_status", (_loopId: string, state: LoopState) => {
      statuses.push({ ...state });
    });

    pipeline.start();
    await new Promise((r) => setTimeout(r, 100));

    const line = JSON.stringify({
      type: "assistant",
      message: {
        role: "assistant",
        model: "claude-opus-4",
        content: [{ type: "text", text: "thinking..." }],
      },
    });
    appendFileSync(filePath, line + "\n");

    await new Promise((r) => setTimeout(r, 700));
    pipeline.stop();

    const withModel = statuses.find((s) => s.model === "claude-opus-4");
    expect(withModel).toBeDefined();
  });

  test("extracts mode from header line", async () => {
    const filePath = join(TEST_DIR, "mode.jsonl");
    writeFileSync(filePath, "");

    const pipeline = new Pipeline(makeConfig(TEST_DIR));
    const statuses: LoopState[] = [];

    pipeline.on("loop_status", (_loopId: string, state: LoopState) => {
      statuses.push({ ...state });
    });

    pipeline.start();
    await new Promise((r) => setTimeout(r, 100));

    appendFileSync(filePath, "Mode: plan\n");

    await new Promise((r) => setTimeout(r, 700));
    pipeline.stop();

    const withMode = statuses.find((s) => s.mode === "plan");
    expect(withMode).toBeDefined();
  });

  test("extracts branch from header line", async () => {
    const filePath = join(TEST_DIR, "branch.jsonl");
    writeFileSync(filePath, "");

    const pipeline = new Pipeline(makeConfig(TEST_DIR));
    const statuses: LoopState[] = [];

    pipeline.on("loop_status", (_loopId: string, state: LoopState) => {
      statuses.push({ ...state });
    });

    pipeline.start();
    await new Promise((r) => setTimeout(r, 100));

    appendFileSync(filePath, "Branch: feature/auth\n");

    await new Promise((r) => setTimeout(r, 700));
    pipeline.stop();

    const withBranch = statuses.find((s) => s.branch === "feature/auth");
    expect(withBranch).toBeDefined();
  });

  test("detects iteration markers", async () => {
    const filePath = join(TEST_DIR, "iteration.jsonl");
    writeFileSync(filePath, "");

    const pipeline = new Pipeline(makeConfig(TEST_DIR));
    const statuses: LoopState[] = [];

    pipeline.on("loop_status", (_loopId: string, state: LoopState) => {
      statuses.push({ ...state });
    });

    pipeline.start();
    await new Promise((r) => setTimeout(r, 100));

    appendFileSync(filePath, "======================== LOOP 5 ========================\n");

    await new Promise((r) => setTimeout(r, 700));
    pipeline.stop();

    const iter5 = statuses.find((s) => s.currentIteration === 5);
    expect(iter5).toBeDefined();
  });

  test("detects health: completed from 'Reached max iterations'", async () => {
    const filePath = join(TEST_DIR, "completed.jsonl");
    writeFileSync(filePath, "");

    const pipeline = new Pipeline(makeConfig(TEST_DIR));
    const statuses: LoopState[] = [];

    pipeline.on("loop_status", (_loopId: string, state: LoopState) => {
      statuses.push({ ...state });
    });

    pipeline.start();
    await new Promise((r) => setTimeout(r, 100));

    appendFileSync(filePath, "Reached max iterations: stopping\n");

    await new Promise((r) => setTimeout(r, 700));
    pipeline.stop();

    const completed = statuses.find((s) => s.health === "completed");
    expect(completed).toBeDefined();
  });

  test("detects health: errored from API error patterns", async () => {
    const filePath = join(TEST_DIR, "errored.jsonl");
    writeFileSync(filePath, "");

    const pipeline = new Pipeline(makeConfig(TEST_DIR));
    const statuses: LoopState[] = [];

    pipeline.on("loop_status", (_loopId: string, state: LoopState) => {
      statuses.push({ ...state });
    });

    pipeline.start();
    await new Promise((r) => setTimeout(r, 100));

    appendFileSync(filePath, "Error: API rate_limit exceeded\n");

    await new Promise((r) => setTimeout(r, 700));
    pipeline.stop();

    const errored = statuses.find((s) => s.health === "errored");
    expect(errored).toBeDefined();
  });

  test("detects health: errored from stop_reason in JSON", async () => {
    const filePath = join(TEST_DIR, "stop-error.jsonl");
    writeFileSync(filePath, "");

    const pipeline = new Pipeline(makeConfig(TEST_DIR));
    const statuses: LoopState[] = [];

    pipeline.on("loop_status", (_loopId: string, state: LoopState) => {
      statuses.push({ ...state });
    });

    pipeline.start();
    await new Promise((r) => setTimeout(r, 100));

    const line = JSON.stringify({
      type: "assistant",
      message: {
        role: "assistant",
        content: [{ type: "text", text: "error" }],
        stop_reason: "error",
      },
    });
    appendFileSync(filePath, line + "\n");

    await new Promise((r) => setTimeout(r, 700));
    pipeline.stop();

    const errored = statuses.find((s) => s.health === "errored");
    expect(errored).toBeDefined();
  });

  test("buffers events and returns via getRecentEvents", async () => {
    const filePath = join(TEST_DIR, "buffered.jsonl");
    writeFileSync(filePath, "");

    const pipeline = new Pipeline(makeConfig(TEST_DIR));
    pipeline.start();
    await new Promise((r) => setTimeout(r, 100));

    const lines = Array.from({ length: 5 }, (_, i) =>
      JSON.stringify({
        type: "assistant",
        message: {
          role: "assistant",
          content: [{ type: "text", text: `message ${i}` }],
        },
      }),
    );

    appendFileSync(filePath, lines.join("\n") + "\n");
    await new Promise((r) => setTimeout(r, 700));

    const events = pipeline.getRecentEvents("test-vm:buffered.jsonl", 3);
    expect(events.length).toBeLessThanOrEqual(3);

    pipeline.stop();
  });

  test("removeLoop deletes file, cleans state, and emits loop_removed", async () => {
    const filePath = join(TEST_DIR, "to-delete.jsonl");
    writeFileSync(filePath, "");

    const pipeline = new Pipeline(makeConfig(TEST_DIR));
    const removed: string[] = [];

    pipeline.on("loop_removed", (loopId: string) => {
      removed.push(loopId);
    });

    pipeline.start();
    await new Promise((r) => setTimeout(r, 100));

    // Append a line to create the loop
    appendFileSync(filePath, JSON.stringify({
      type: "assistant",
      message: { role: "assistant", content: [{ type: "text", text: "hello" }] },
    }) + "\n");

    await new Promise((r) => setTimeout(r, 700));

    const loopId = "test-vm:to-delete.jsonl";
    expect(pipeline.getLoopStates().has(loopId)).toBe(true);

    // Remove the loop
    const result = await pipeline.removeLoop(loopId);
    expect(result).toBe(true);
    expect(pipeline.getLoopStates().has(loopId)).toBe(false);
    expect(pipeline.getRecentEvents(loopId)).toEqual([]);
    expect(removed).toContain(loopId);
    expect(existsSync(filePath)).toBe(false);

    pipeline.stop();
  });

  test("removeLoop returns false for unknown loopId", async () => {
    const pipeline = new Pipeline(makeConfig(TEST_DIR));
    const result = await pipeline.removeLoop("nonexistent");
    expect(result).toBe(false);
  });
});
