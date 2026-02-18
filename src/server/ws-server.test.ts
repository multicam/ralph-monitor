import { describe, test, expect, afterEach } from "bun:test";
import { createServer, type Server } from "http";
import { WsRelay } from "./ws-server.ts";
import { Pipeline } from "./pipeline.ts";
import { mkdirSync, writeFileSync, rmSync, appendFileSync } from "fs";
import { join } from "path";
import type { AppConfig, WsMessage } from "../lib/types.ts";

const emptyConfig: AppConfig = { server: { port: 0 }, vms: [] };
const TEST_DIR = "/tmp/ralph-ws-test-" + process.pid;

let servers: Server[] = [];

afterEach(() => {
  for (const s of servers) s.close();
  servers = [];
  rmSync(TEST_DIR, { recursive: true, force: true });
});

function createTestServer(config: AppConfig = emptyConfig) {
  const server = createServer();
  const pipeline = new Pipeline(config);
  const relay = new WsRelay(server, pipeline);
  servers.push(server);
  return { server, pipeline, relay };
}

async function listenOnRandomPort(server: Server): Promise<number> {
  await new Promise<void>((resolve) => server.listen(0, () => resolve()));
  const addr = server.address();
  return typeof addr === "object" && addr ? addr.port : 0;
}

async function connectWs(port: number): Promise<{ ws: WebSocket; messages: WsMessage[] }> {
  const ws = new WebSocket(`ws://localhost:${port}/ws`);
  const messages: WsMessage[] = [];

  await new Promise<void>((resolve, reject) => {
    ws.onopen = () => resolve();
    ws.onerror = () => reject(new Error("WS connection failed"));
    setTimeout(() => reject(new Error("WS timeout")), 2000);
  });

  ws.onmessage = (ev) => {
    messages.push(JSON.parse(String(ev.data)));
  };

  // Wait for snapshot message
  await new Promise((r) => setTimeout(r, 100));
  return { ws, messages };
}

describe("WsRelay", () => {
  test("constructs without errors", () => {
    const { server } = createTestServer();
    expect(server).toBeDefined();
  });

  test("sends snapshot on WebSocket connection", async () => {
    const { server } = createTestServer();
    const port = await listenOnRandomPort(server);
    const { ws, messages } = await connectWs(port);

    expect(messages.length).toBe(1);
    expect(messages[0]!.type).toBe("snapshot");
    if (messages[0]!.type === "snapshot") {
      expect(messages[0]!.loops).toEqual({});
      expect(messages[0]!.recentEvents).toEqual({});
    }

    ws.close();
  });

  test("broadcasts events from pipeline", async () => {
    mkdirSync(TEST_DIR, { recursive: true });
    const filePath = join(TEST_DIR, "session.jsonl");
    writeFileSync(filePath, "");

    const config: AppConfig = {
      server: { port: 0 },
      vms: [{ name: "ws-test", host: "localhost", user: "test", local: true, watchDir: TEST_DIR }],
    };
    const { server, pipeline } = createTestServer(config);
    pipeline.start();
    const port = await listenOnRandomPort(server);
    const { ws, messages } = await connectWs(port);

    // Snapshot should show no loops yet (file is empty, no lines emitted)
    const snapshot = messages.find((m) => m.type === "snapshot");
    expect(snapshot).toBeDefined();

    // Append a line to trigger event broadcast
    const jsonLine = JSON.stringify({
      type: "assistant",
      message: {
        role: "assistant",
        model: "sonnet",
        content: [{ type: "text", text: "hello from test" }],
      },
    });
    appendFileSync(filePath, jsonLine + "\n");

    // Wait for local watcher poll + ws broadcast
    await new Promise((r) => setTimeout(r, 800));

    const eventMsgs = messages.filter((m) => m.type === "event");
    expect(eventMsgs.length).toBeGreaterThanOrEqual(1);

    // Also should have loop_status
    const statusMsgs = messages.filter((m) => m.type === "loop_status");
    expect(statusMsgs.length).toBeGreaterThanOrEqual(1);

    ws.close();
    pipeline.stop();
  });

  test("broadcasts to multiple clients", async () => {
    const { server, pipeline } = createTestServer();
    const port = await listenOnRandomPort(server);

    const client1 = await connectWs(port);
    const client2 = await connectWs(port);

    // Both should have received snapshot
    expect(client1.messages.length).toBeGreaterThanOrEqual(1);
    expect(client2.messages.length).toBeGreaterThanOrEqual(1);

    client1.ws.close();
    client2.ws.close();
  });

  test("broadcasts loop_removed on delete", async () => {
    mkdirSync(TEST_DIR, { recursive: true });
    const filePath = join(TEST_DIR, "deletable.jsonl");
    writeFileSync(filePath, "");

    const config: AppConfig = {
      server: { port: 0 },
      vms: [{ name: "ws-del", host: "localhost", user: "test", local: true, watchDir: TEST_DIR }],
    };
    const { server, pipeline } = createTestServer(config);
    pipeline.start();
    const port = await listenOnRandomPort(server);
    const { ws, messages } = await connectWs(port);

    // Create a loop by appending data
    appendFileSync(filePath, JSON.stringify({
      type: "assistant",
      message: { role: "assistant", content: [{ type: "text", text: "hi" }] },
    }) + "\n");

    await new Promise((r) => setTimeout(r, 800));

    // Now delete it
    const loopId = "ws-del:deletable.jsonl";
    await pipeline.removeLoop(loopId);

    await new Promise((r) => setTimeout(r, 200));

    const removedMsgs = messages.filter((m) => m.type === "loop_removed");
    expect(removedMsgs.length).toBe(1);
    if (removedMsgs[0]?.type === "loop_removed") {
      expect(removedMsgs[0].loopId).toBe(loopId);
    }

    ws.close();
    pipeline.stop();
  });
});
