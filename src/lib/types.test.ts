import { describe, test, expect } from "bun:test";
import { makeLoopId } from "./types.ts";
import type { WsMessage, LoopRemovedMessage } from "./types.ts";

describe("makeLoopId", () => {
  test("combines vmName and session file basename", () => {
    expect(makeLoopId("vm-01", "/tmp/ralph/session-abc.jsonl")).toBe(
      "vm-01:session-abc.jsonl",
    );
  });

  test("handles nested paths", () => {
    expect(makeLoopId("vm-02", "/home/user/.claude/logs/deep/session.jsonl")).toBe(
      "vm-02:session.jsonl",
    );
  });

  test("handles bare filename", () => {
    expect(makeLoopId("vm-01", "output.jsonl")).toBe("vm-01:output.jsonl");
  });
});

describe("LoopRemovedMessage", () => {
  test("is assignable to WsMessage", () => {
    const msg: WsMessage = { type: "loop_removed", loopId: "vm:test.jsonl" };
    expect(msg.type).toBe("loop_removed");
    if (msg.type === "loop_removed") {
      expect(msg.loopId).toBe("vm:test.jsonl");
    }
  });
});
