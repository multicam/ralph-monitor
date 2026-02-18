import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";
import type { Pipeline } from "./pipeline.ts";
import type { WsMessage, LoopState, MonitorEvent } from "../lib/types.ts";

export class WsRelay {
  private wss: WebSocketServer;
  private pipeline: Pipeline;

  constructor(server: Server, pipeline: Pipeline) {
    this.pipeline = pipeline;
    this.wss = new WebSocketServer({ server, path: "/ws" });

    this.wss.on("connection", (ws) => {
      this.sendSnapshot(ws);
    });

    pipeline.on("event", (loopId: string, event: MonitorEvent) => {
      this.broadcast({ type: "event", loopId, event });
    });

    pipeline.on("loop_status", (loopId: string, state: LoopState) => {
      this.broadcast({ type: "loop_status", loopId, state });
    });

    pipeline.on("loop_removed", (loopId: string) => {
      this.broadcast({ type: "loop_removed", loopId });
    });
  }

  private sendSnapshot(ws: WebSocket): void {
    const loopStates = this.pipeline.getLoopStates();
    const loops: Record<string, LoopState> = {};
    const recentEvents: Record<string, MonitorEvent[]> = {};

    for (const [loopId, state] of loopStates) {
      loops[loopId] = state;
      // Only send events for running loops; others load on demand
      if (state.health === "running") {
        recentEvents[loopId] = this.pipeline.getRecentEvents(loopId, 100);
      }
    }

    const msg: WsMessage = { type: "snapshot", loops, recentEvents };
    ws.send(JSON.stringify(msg));
  }

  private broadcast(msg: WsMessage): void {
    const data = JSON.stringify(msg);
    for (const client of this.wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    }
  }
}
