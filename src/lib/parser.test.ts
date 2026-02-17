import { describe, test, expect } from "bun:test";
import { parseLine, summarizeToolCall, summarizeToolResult, EventPairer } from "./parser.ts";

describe("parseLine", () => {
  test("parses assistant tool_use message", () => {
    const line = JSON.stringify({
      type: "assistant",
      message: {
        id: "msg_1",
        role: "assistant",
        model: "glm-5",
        content: [{ type: "tool_use", id: "call_1", name: "Glob", input: { pattern: "src/**/*.ts" } }],
      },
      session_id: "sess_1",
    });

    const event = parseLine(line, "vm-01");
    expect(event).not.toBeNull();
    expect(event!.type).toBe("tool_call");
    if (event!.type === "tool_call") {
      expect(event!.toolName).toBe("Glob");
      expect(event!.toolUseId).toBe("call_1");
      expect(event!.model).toBe("glm-5");
      expect(event!.sessionId).toBe("sess_1");
      expect(event!.summary).toBe("Searching `src/**/*.ts`");
    }
  });

  test("parses user tool_result message", () => {
    const line = JSON.stringify({
      type: "user",
      message: {
        role: "user",
        content: [{ type: "tool_result", tool_use_id: "call_1", content: "file1.ts\nfile2.ts" }],
      },
      tool_use_result: { numFiles: 2, durationMs: 80, truncated: false },
    });

    const event = parseLine(line, "vm-01");
    expect(event).not.toBeNull();
    expect(event!.type).toBe("tool_result");
    if (event!.type === "tool_result") {
      expect(event!.toolUseId).toBe("call_1");
      expect(event!.durationMs).toBe(80);
      expect(event!.summary).toBe("2 files found (80ms)");
    }
  });

  test("parses assistant text message", () => {
    const line = JSON.stringify({
      type: "assistant",
      message: {
        role: "assistant",
        content: [{ type: "text", text: "I need to analyze the authentication middleware..." }],
      },
    });

    const event = parseLine(line, "vm-01");
    expect(event).not.toBeNull();
    expect(event!.type).toBe("thinking");
    if (event!.type === "thinking") {
      expect(event!.fullText).toBe("I need to analyze the authentication middleware...");
    }
  });

  test("parses loop boundary marker", () => {
    const event = parseLine("======================== LOOP 7 ========================", "vm-01");
    expect(event).not.toBeNull();
    expect(event!.type).toBe("iteration");
    if (event!.type === "iteration") {
      expect(event!.iterationNumber).toBe(7);
    }
  });

  test("parses non-JSON line as raw event", () => {
    const event = parseLine("Failed to push. Setting upstream and retrying...", "vm-01");
    expect(event).not.toBeNull();
    expect(event!.type).toBe("raw");
    if (event!.type === "raw") {
      expect(event!.line).toBe("Failed to push. Setting upstream and retrying...");
    }
  });

  test("returns null for empty lines", () => {
    expect(parseLine("", "vm-01")).toBeNull();
    expect(parseLine("   ", "vm-01")).toBeNull();
  });

  test("handles malformed JSON gracefully", () => {
    const event = parseLine("{broken json...", "vm-01");
    expect(event).not.toBeNull();
    expect(event!.type).toBe("raw");
  });
});

describe("summarizeToolCall", () => {
  test("Glob", () => {
    expect(summarizeToolCall("Glob", { pattern: "src/**/*.ts" })).toBe("Searching `src/**/*.ts`");
  });

  test("Read", () => {
    expect(summarizeToolCall("Read", { file_path: "/home/user/src/auth.ts" })).toBe("Reading `auth.ts`");
  });

  test("Edit", () => {
    expect(summarizeToolCall("Edit", { file_path: "/home/user/src/auth.ts" })).toBe("Editing `auth.ts`");
  });

  test("Write", () => {
    expect(summarizeToolCall("Write", { file_path: "/home/user/src/new.ts" })).toBe("Creating `new.ts`");
  });

  test("Grep", () => {
    expect(summarizeToolCall("Grep", { pattern: "TODO" })).toBe("Searching for `TODO`");
  });

  test("Bash", () => {
    expect(summarizeToolCall("Bash", { command: "bun test" })).toBe("Running: `bun test`");
  });

  test("Task (subagent)", () => {
    const result = summarizeToolCall("Task", { model: "sonnet", description: "search for tests" });
    expect(result).toBe("Spawning sonnet subagent: search for tests");
  });

  test("WebFetch", () => {
    expect(summarizeToolCall("WebFetch", { url: "https://example.com/api" })).toBe("Fetching example.com");
  });

  test("unknown tool", () => {
    const result = summarizeToolCall("CustomTool", { foo: "bar" });
    expect(result).toContain("CustomTool");
  });
});

describe("summarizeToolResult", () => {
  test("file count result", () => {
    expect(summarizeToolResult({ numFiles: 13, durationMs: 80 })).toBe("13 files found (80ms)");
  });

  test("exit code result", () => {
    expect(summarizeToolResult({ exitCode: 0, durationMs: 1200 })).toBe("exit 0 (1200ms)");
  });

  test("duration only", () => {
    expect(summarizeToolResult({ durationMs: 500 })).toBe("completed (500ms)");
  });

  test("no metadata", () => {
    expect(summarizeToolResult({})).toBe("completed");
  });
});

describe("EventPairer", () => {
  test("pairs tool_call with tool_result", () => {
    const pairer = new EventPairer();

    const call = parseLine(
      JSON.stringify({
        type: "assistant",
        message: { role: "assistant", model: "sonnet", content: [{ type: "tool_use", id: "call_1", name: "Glob", input: { pattern: "*.ts" } }] },
        session_id: "s1",
      }),
      "vm-01",
    )!;

    const result = parseLine(
      JSON.stringify({
        type: "user",
        message: { role: "user", content: [{ type: "tool_result", tool_use_id: "call_1", content: "a.ts" }] },
        tool_use_result: { numFiles: 1, durationMs: 50 },
      }),
      "vm-01",
    )!;

    const processed1 = pairer.process(call);
    expect(processed1.type).toBe("tool_call");

    const processed2 = pairer.process(result);
    expect(processed2.type).toBe("tool_paired");
    if (processed2.type === "tool_paired") {
      expect(processed2.toolName).toBe("Glob");
      expect(processed2.durationMs).toBe(50);
      expect(processed2.resultSummary).toBe("1 files found (50ms)");
    }
  });

  test("returns unmatched tool_result as-is", () => {
    const pairer = new EventPairer();

    const result = parseLine(
      JSON.stringify({
        type: "user",
        message: { role: "user", content: [{ type: "tool_result", tool_use_id: "orphan", content: "data" }] },
        tool_use_result: {},
      }),
      "vm-01",
    )!;

    const processed = pairer.process(result);
    expect(processed.type).toBe("tool_result");
  });

  test("passes through non-tool events unchanged", () => {
    const pairer = new EventPairer();
    const event = parseLine("======================== LOOP 3 ========================", "vm-01")!;
    const processed = pairer.process(event);
    expect(processed.type).toBe("iteration");
  });
});
