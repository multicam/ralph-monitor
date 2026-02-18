import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdirSync, writeFileSync, rmSync, appendFileSync, existsSync } from "fs";
import { join } from "path";
import { LocalWatcher } from "./local-watcher.ts";

const TEST_DIR = "/tmp/ralph-test-" + process.pid;

describe("LocalWatcher", () => {
  beforeEach(() => {
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  test("emits vm_connection 'connected' on start", async () => {
    const watcher = new LocalWatcher("test-vm", TEST_DIR);
    const events: string[] = [];

    watcher.on("vm_connection", (_vmId: string, status: string) => {
      events.push(status);
    });

    watcher.start();
    // Give it a tick
    await new Promise((r) => setTimeout(r, 50));
    watcher.stop();

    expect(events).toContain("connected");
  });

  test("emits 'idle' when no JSONL files exist", async () => {
    const watcher = new LocalWatcher("test-vm", TEST_DIR);
    const events: string[] = [];

    watcher.on("vm_connection", (_vmId: string, status: string) => {
      events.push(status);
    });

    watcher.start();
    await new Promise((r) => setTimeout(r, 50));
    watcher.stop();

    expect(events).toContain("idle");
  });

  test("discovers existing JSONL files", async () => {
    const filePath = join(TEST_DIR, "session.jsonl");
    writeFileSync(filePath, "");

    const watcher = new LocalWatcher("test-vm", TEST_DIR);
    const statusEvents: Array<{ vmId: string; file: string; status: string }> = [];

    watcher.on("status", (vmId: string, file: string, status: string) => {
      statusEvents.push({ vmId, file, status });
    });

    watcher.start();
    await new Promise((r) => setTimeout(r, 50));
    watcher.stop();

    expect(statusEvents.length).toBeGreaterThanOrEqual(1);
    expect(statusEvents[0]!.status).toBe("new");
    expect(statusEvents[0]!.file).toBe(filePath);
  });

  test("emits lines when new content is appended", async () => {
    const filePath = join(TEST_DIR, "session.jsonl");
    writeFileSync(filePath, "");

    const watcher = new LocalWatcher("test-vm", TEST_DIR);
    const lines: string[] = [];

    watcher.on("line", (_vmId: string, _file: string, line: string) => {
      lines.push(line);
    });

    watcher.start();
    await new Promise((r) => setTimeout(r, 100));

    // Append new content
    const jsonLine = JSON.stringify({
      type: "assistant",
      message: { role: "assistant", content: [{ type: "text", text: "hello" }] },
    });
    appendFileSync(filePath, jsonLine + "\n");

    // Wait for poll to pick it up (polls every 500ms)
    await new Promise((r) => setTimeout(r, 700));
    watcher.stop();

    expect(lines.length).toBeGreaterThanOrEqual(1);
    expect(lines[0]).toBe(jsonLine);
  });

  test("discovers files in subdirectories", async () => {
    const subDir = join(TEST_DIR, "subdir");
    mkdirSync(subDir, { recursive: true });
    const filePath = join(subDir, "nested.jsonl");
    writeFileSync(filePath, "");

    const watcher = new LocalWatcher("test-vm", TEST_DIR);
    const statusEvents: Array<{ file: string; status: string }> = [];

    watcher.on("status", (_vmId: string, file: string, status: string) => {
      statusEvents.push({ file, status });
    });

    watcher.start();
    await new Promise((r) => setTimeout(r, 50));
    watcher.stop();

    expect(statusEvents.some((e) => e.file === filePath && e.status === "new")).toBe(true);
  });

  test("handles nonexistent watch directory gracefully", async () => {
    const watcher = new LocalWatcher("test-vm", "/tmp/ralph-nonexistent-" + process.pid);
    const events: string[] = [];

    watcher.on("vm_connection", (_vmId: string, status: string) => {
      events.push(status);
    });

    watcher.start();
    await new Promise((r) => setTimeout(r, 50));
    watcher.stop();

    expect(events).toContain("idle");
  });

  test("stop clears all timers and state", () => {
    const watcher = new LocalWatcher("test-vm", TEST_DIR);
    watcher.start();
    watcher.stop();
    // Should not throw on double stop
    expect(() => watcher.stop()).not.toThrow();
  });

  test("deleteFile removes the file and cleans tailedFiles", async () => {
    const filePath = join(TEST_DIR, "to-delete.jsonl");
    writeFileSync(filePath, "some content\n");

    const watcher = new LocalWatcher("test-vm", TEST_DIR);
    watcher.start();
    await new Promise((r) => setTimeout(r, 50));

    await watcher.deleteFile(filePath);

    expect(existsSync(filePath)).toBe(false);
    watcher.stop();
  });

  test("deleteFile handles already-deleted file gracefully", async () => {
    const watcher = new LocalWatcher("test-vm", TEST_DIR);
    await expect(watcher.deleteFile("/tmp/nonexistent-" + process.pid + ".jsonl")).resolves.toBeUndefined();
  });
});
