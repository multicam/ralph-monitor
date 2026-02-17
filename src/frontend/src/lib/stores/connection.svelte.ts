import type { WsMessage, LoopState, MonitorEvent } from "../../../../lib/types.ts";

class MonitorStore {
  loops = $state<Record<string, LoopState>>({});
  events = $state<Record<string, MonitorEvent[]>>({});
  connected = $state(false);

  private ws: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  /** Group loops by VM name */
  get vmGroups(): Record<string, LoopState[]> {
    const groups: Record<string, LoopState[]> = {};
    for (const state of Object.values(this.loops)) {
      const vm = state.vmName;
      if (!groups[vm]) groups[vm] = [];
      groups[vm].push(state);
    }
    return groups;
  }

  connect() {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${protocol}//${window.location.host}`;

    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      this.connected = true;
    };

    this.ws.onclose = () => {
      this.connected = false;
      this.scheduleReconnect();
    };

    this.ws.onerror = () => {
      this.ws?.close();
    };

    this.ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data) as WsMessage;
      this.handleMessage(msg);
    };
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
  }

  private scheduleReconnect() {
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, 2000);
  }

  private handleMessage(msg: WsMessage) {
    switch (msg.type) {
      case "snapshot":
        this.loops = msg.loops;
        this.events = msg.recentEvents;
        break;

      case "event": {
        const existing = this.events[msg.loopId] ?? [];
        if (msg.event.type === "tool_paired") {
          const idx = existing.findIndex(
            (e) => e.type === "tool_call" && e.id === msg.event.id,
          );
          if (idx !== -1) {
            existing[idx] = msg.event;
            this.events[msg.loopId] = [...existing];
            break;
          }
        }
        this.events[msg.loopId] = [...existing, msg.event];
        break;
      }

      case "loop_status":
        this.loops[msg.loopId] = msg.state;
        this.loops = { ...this.loops };
        break;
    }
  }
}

export const monitor = new MonitorStore();
