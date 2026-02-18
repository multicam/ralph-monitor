import { describe, test, expect } from "bun:test";
import { EventPairer, parseLine } from "./parser.ts";

describe("EventPairer.getPending", () => {
  test("returns pending tool calls within timeout", () => {
    const pairer = new EventPairer(60_000);

    const call = parseLine(
      JSON.stringify({
        type: "assistant",
        message: {
          role: "assistant",
          model: "sonnet",
          content: [{ type: "tool_use", id: "c1", name: "Read", input: { file_path: "/a.ts" } }],
        },
        session_id: "s1",
      }),
      "vm-01",
    )!;

    pairer.process(call);
    const pending = pairer.getPending();
    expect(pending).toHaveLength(1);
    expect(pending[0]!.type).toBe("tool_call");
    expect(pending[0]!.toolUseId).toBe("c1");
  });

  test("returns empty when all calls are paired", () => {
    const pairer = new EventPairer();

    const call = parseLine(
      JSON.stringify({
        type: "assistant",
        message: {
          role: "assistant",
          model: "sonnet",
          content: [{ type: "tool_use", id: "c1", name: "Glob", input: { pattern: "*.ts" } }],
        },
        session_id: "s1",
      }),
      "vm-01",
    )!;

    const result = parseLine(
      JSON.stringify({
        type: "user",
        message: {
          role: "user",
          content: [{ type: "tool_result", tool_use_id: "c1", content: "found" }],
        },
        tool_use_result: { numFiles: 1 },
      }),
      "vm-01",
    )!;

    pairer.process(call);
    pairer.process(result);
    expect(pairer.getPending()).toHaveLength(0);
  });
});

describe("EventPairer.pruneStale", () => {
  test("removes stale pending calls beyond timeout", () => {
    // Use a tiny timeout so calls go stale immediately
    const pairer = new EventPairer(0);

    const call = parseLine(
      JSON.stringify({
        type: "assistant",
        message: {
          role: "assistant",
          model: "sonnet",
          content: [{ type: "tool_use", id: "c1", name: "Bash", input: { command: "ls" } }],
        },
        session_id: "s1",
      }),
      "vm-01",
    )!;

    pairer.process(call);
    // With timeout=0, the call is immediately stale
    pairer.pruneStale();
    expect(pairer.getPending()).toHaveLength(0);
  });

  test("keeps recent pending calls", () => {
    const pairer = new EventPairer(60_000);

    const call = parseLine(
      JSON.stringify({
        type: "assistant",
        message: {
          role: "assistant",
          model: "sonnet",
          content: [{ type: "tool_use", id: "c1", name: "Bash", input: { command: "ls" } }],
        },
        session_id: "s1",
      }),
      "vm-01",
    )!;

    pairer.process(call);
    pairer.pruneStale();
    // Should still be there - not stale yet
    expect(pairer.getPending()).toHaveLength(1);
  });
});

describe("parseLine edge cases", () => {
  test("returns null for JSON with no type field", () => {
    const event = parseLine(JSON.stringify({ foo: "bar" }), "vm-01");
    expect(event).toBeNull();
  });

  test("returns null for JSON with type but no message.content", () => {
    const event = parseLine(
      JSON.stringify({ type: "assistant", message: { role: "assistant" } }),
      "vm-01",
    );
    expect(event).toBeNull();
  });

  test("returns null for JSON with empty content array", () => {
    const event = parseLine(
      JSON.stringify({ type: "assistant", message: { role: "assistant", content: [] } }),
      "vm-01",
    );
    expect(event).toBeNull();
  });

  test("returns null for text events with only whitespace", () => {
    const event = parseLine(
      JSON.stringify({
        type: "assistant",
        message: { role: "assistant", content: [{ type: "text", text: "   " }] },
      }),
      "vm-01",
    );
    expect(event).toBeNull();
  });

  test("WebSearch summary", () => {
    const { summarizeToolCall } = require("./parser.ts");
    expect(summarizeToolCall("WebSearch", { query: "bun test coverage" })).toBe(
      "Searching web: `bun test coverage`",
    );
  });

  test("Bash truncates long commands", () => {
    const { summarizeToolCall } = require("./parser.ts");
    const longCmd = "a".repeat(100);
    const result = summarizeToolCall("Bash", { command: longCmd });
    expect(result.length).toBeLessThan(80);
    expect(result).toContain("...");
  });

  test("Task with no model defaults to 'sonnet'", () => {
    const { summarizeToolCall } = require("./parser.ts");
    const result = summarizeToolCall("Task", { description: "do something" });
    expect(result).toContain("sonnet");
  });
});
