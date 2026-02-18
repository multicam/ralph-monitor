import type { WsMessage, LoopState, MonitorEvent } from "../../../../lib/types.ts";

class MonitorStore {
  loops = $state<Record<string, LoopState>>({});
  events = $state<Record<string, MonitorEvent[]>>({});
  connected = $state(false);

  private ws: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  /** Loops sorted by last activity (most recent first) */
  get sortedLoops(): LoopState[] {
    return Object.values(this.loops).sort((a, b) => {
      return (b.lastActivity ?? 0) - (a.lastActivity ?? 0);
    });
  }

  connect() {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${protocol}//${window.location.host}/ws`;

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

  /** Fetch events on demand for a closed card that was opened */
  async fetchEvents(loopId: string): Promise<void> {
    if (this.events[loopId]?.length) return; // Already loaded
    try {
      const res = await fetch(`/api/loops/${encodeURIComponent(loopId)}/events`);
      const data = await res.json();
      this.events[loopId] = data.events ?? [];
      this.events = { ...this.events };
    } catch {
      // Silently fail — card will show empty
    }
  }

  private scheduleReconnect() {
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, 2000);
  }

  private handleMessage(msg: WsMessage) {
    switch (msg.type) {
      case "snapshot":
        this.loops = { ...msg.loops };
        // Merge events — snapshot only includes running loops now
        this.events = { ...this.events, ...msg.recentEvents };
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

      case "loop_removed": {
        const { [msg.loopId]: _l, ...remainingLoops } = this.loops;
        const { [msg.loopId]: _e, ...remainingEvents } = this.events;
        this.loops = remainingLoops;
        this.events = remainingEvents;
        break;
      }
    }
  }
}

export const monitor = new MonitorStore();
