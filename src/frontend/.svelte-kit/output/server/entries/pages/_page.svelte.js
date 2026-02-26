import { e as escape_html, Z as attr_class, _ as ensure_array_like, $ as attr_style, a0 as stringify } from "../../chunks/index.js";
import "clsx";
class MonitorStore {
  loops = {};
  events = {};
  connected = false;
  ws = null;
  reconnectTimer = null;
  /** Loops sorted by last activity (most recent first) */
  get sortedLoops() {
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
      const msg = JSON.parse(ev.data);
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
  async fetchEvents(loopId) {
    if (this.events[loopId]?.length) return;
    try {
      const res = await fetch(`/api/loops/${encodeURIComponent(loopId)}/events`);
      const data = await res.json();
      this.events[loopId] = data.events ?? [];
      this.events = { ...this.events };
    } catch {
    }
  }
  scheduleReconnect() {
    this.reconnectTimer = setTimeout(
      () => {
        this.connect();
      },
      2e3
    );
  }
  handleMessage(msg) {
    switch (msg.type) {
      case "snapshot":
        this.loops = { ...msg.loops };
        this.events = { ...this.events, ...msg.recentEvents };
        break;
      case "event": {
        const existing = this.events[msg.loopId] ?? [];
        if (msg.event.type === "tool_paired") {
          const idx = existing.findIndex((e) => e.type === "tool_call" && e.id === msg.event.id);
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
const monitor = new MonitorStore();
function EventRow($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { event } = $$props;
    const icon = event.type === "tool_call" ? "▶" : event.type === "tool_paired" ? "✓" : event.type === "tool_result" ? "←" : event.type === "thinking" ? "…" : event.type === "iteration" ? "─" : "·";
    const isPending = event.type === "tool_call";
    function formatTime(ts) {
      return new Date(ts).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    }
    if (event.type === "iteration") {
      $$renderer2.push("<!--[-->");
      $$renderer2.push(`<div class="iteration-separator svelte-hmzzxk"><span class="svelte-hmzzxk">Iteration ${escape_html(event.iterationNumber)}</span></div>`);
    } else {
      $$renderer2.push("<!--[!-->");
      $$renderer2.push(`<button${attr_class("event-row svelte-hmzzxk", void 0, { "pending": isPending })}><span class="icon svelte-hmzzxk">${escape_html(icon)}</span> <span class="summary svelte-hmzzxk">${escape_html(event.summary)}</span> `);
      if (event.type === "tool_paired" && event.durationMs) {
        $$renderer2.push("<!--[-->");
        $$renderer2.push(`<span class="duration svelte-hmzzxk">${escape_html(event.durationMs)}ms</span>`);
      } else {
        $$renderer2.push("<!--[!-->");
      }
      $$renderer2.push(`<!--]--> <span class="time svelte-hmzzxk">${escape_html(formatTime(event.timestamp))}</span></button> `);
      {
        $$renderer2.push("<!--[!-->");
      }
      $$renderer2.push(`<!--]-->`);
    }
    $$renderer2.push(`<!--]-->`);
  });
}
function EventFeed($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { events } = $$props;
    const reversed = [...events].reverse();
    $$renderer2.push(`<div class="feed svelte-ne64jc"><!--[-->`);
    const each_array = ensure_array_like(
      // Auto-scroll to top when new events arrive (if user hasn't scrolled)
      reversed
    );
    for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
      let event = each_array[$$index];
      EventRow($$renderer2, { event });
    }
    $$renderer2.push(`<!--]--></div>`);
  });
}
function VmCard($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { loop, events } = $$props;
    const isRunning = loop.health === "running";
    const expanded = isRunning;
    const healthColor = loop.health === "running" ? "#4ade80" : loop.health === "errored" ? "#f87171" : loop.health === "stale" ? "#fbbf24" : "#64748b";
    const healthIcon = loop.health === "running" ? "●" : loop.health === "errored" ? "✕" : loop.health === "stale" ? "○" : "○";
    const sessionLabel = () => {
      const parts = loop.sessionFile.split("/").pop() ?? "";
      return parts.replace(".jsonl", "");
    };
    const timeLabel = () => {
      if (loop.health === "running" && loop.startedAt) {
        const ms = Date.now() - loop.startedAt;
        const mins = Math.floor(ms / 6e4);
        if (mins < 60) return `${mins}m`;
        const hrs = Math.floor(mins / 60);
        return `${hrs}h ${mins % 60}m`;
      }
      if (loop.lastActivity) {
        const ms = Date.now() - loop.lastActivity;
        const mins = Math.floor(ms / 6e4);
        if (mins < 1) return "just now";
        if (mins < 60) return `${mins}m ago`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `${hrs}h ago`;
        return `${Math.floor(hrs / 24)}d ago`;
      }
      return "";
    };
    $$renderer2.push(`<div${attr_class("card svelte-rd1na9", void 0, { "expanded": expanded, "errored": loop.health === "errored" })}><div class="card-header svelte-rd1na9" role="button" tabindex="0"><span${attr_class("health-dot svelte-rd1na9", void 0, { "pulsing": isRunning })}${attr_style(`color: ${stringify(healthColor)}`)}>${escape_html(healthIcon)}</span> <h2 class="session-name svelte-rd1na9">${escape_html(sessionLabel())}</h2> <div class="badges svelte-rd1na9">`);
    if (loop.mode) {
      $$renderer2.push("<!--[-->");
      $$renderer2.push(`<span class="badge svelte-rd1na9">${escape_html(loop.mode)}</span>`);
    } else {
      $$renderer2.push("<!--[!-->");
    }
    $$renderer2.push(`<!--]--> `);
    if (loop.currentIteration > 0) {
      $$renderer2.push("<!--[-->");
      $$renderer2.push(`<span class="badge svelte-rd1na9">#${escape_html(loop.currentIteration)}</span>`);
    } else {
      $$renderer2.push("<!--[!-->");
    }
    $$renderer2.push(`<!--]--> `);
    if (loop.model) {
      $$renderer2.push("<!--[-->");
      $$renderer2.push(`<span class="badge svelte-rd1na9">${escape_html(loop.model)}</span>`);
    } else {
      $$renderer2.push("<!--[!-->");
    }
    $$renderer2.push(`<!--]--> `);
    if (loop.branch) {
      $$renderer2.push("<!--[-->");
      $$renderer2.push(`<span class="badge branch svelte-rd1na9">${escape_html(loop.branch)}</span>`);
    } else {
      $$renderer2.push("<!--[!-->");
    }
    $$renderer2.push(`<!--]--></div> <span class="time-label svelte-rd1na9">${escape_html(timeLabel())}</span> <span class="chevron svelte-rd1na9">${escape_html(expanded ? "▾" : "▸")}</span> <button class="delete-btn svelte-rd1na9" title="Delete log">×</button></div> `);
    if (expanded) {
      $$renderer2.push("<!--[-->");
      $$renderer2.push(`<div class="card-body svelte-rd1na9">`);
      if (events.length > 0) {
        $$renderer2.push("<!--[-->");
        EventFeed($$renderer2, { events });
      } else {
        $$renderer2.push("<!--[!-->");
        $$renderer2.push(`<div class="loading svelte-rd1na9">Loading events...</div>`);
      }
      $$renderer2.push(`<!--]--></div>`);
    } else {
      $$renderer2.push("<!--[!-->");
    }
    $$renderer2.push(`<!--]--></div>`);
  });
}
function StatusBar($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { allEvents, connected } = $$props;
    const stats = () => {
      const now = Date.now();
      const oneMinAgo = now - 6e4;
      const oneHourAgo = now - 36e5;
      let toolCallsPerMin = 0;
      let commitsPerHour = 0;
      let errors = 0;
      for (const events of Object.values(allEvents)) {
        for (const event of events) {
          if (event.timestamp > oneMinAgo) {
            if (event.type === "tool_call" || event.type === "tool_paired") {
              toolCallsPerMin++;
            }
          }
          if (event.timestamp > oneHourAgo) {
            if (event.type === "raw" && event.line.includes("Iteration")) {
              commitsPerHour++;
            }
          }
          if (event.type === "raw" && (event.line.includes("Error") || event.line.includes("error"))) {
            errors++;
          }
        }
      }
      return { toolCallsPerMin, commitsPerHour, errors };
    };
    $$renderer2.push(`<div class="status-bar svelte-1piydef"><span${attr_class("connection svelte-1piydef", void 0, { "connected": connected })}>${escape_html(connected ? "Connected" : "Disconnected")}</span> <span class="stat svelte-1piydef">${escape_html(stats().toolCallsPerMin)} tool calls/min</span> <span class="stat svelte-1piydef">${escape_html(stats().commitsPerHour)} commits/hr</span> `);
    if (stats().errors > 0) {
      $$renderer2.push("<!--[-->");
      $$renderer2.push(`<span class="stat error svelte-1piydef">${escape_html(stats().errors)} errors</span>`);
    } else {
      $$renderer2.push("<!--[!-->");
    }
    $$renderer2.push(`<!--]--></div>`);
  });
}
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    const sortedLoops = monitor.sortedLoops;
    const totalLoops = Object.keys(monitor.loops).length;
    $$renderer2.push(`<div class="dashboard svelte-1uha8ag"><header class="svelte-1uha8ag"><h1 class="svelte-1uha8ag">ralph-monitor</h1> <span class="meta svelte-1uha8ag">${escape_html(totalLoops)} loop${escape_html(totalLoops !== 1 ? "s" : "")}</span> <span${attr_class("connection svelte-1uha8ag", void 0, { "connected": monitor.connected })}>${escape_html(monitor.connected ? "Connected" : "Disconnected")}</span></header> <div class="loop-list svelte-1uha8ag"><!--[-->`);
    const each_array = ensure_array_like(sortedLoops);
    for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
      let loop = each_array[$$index];
      VmCard($$renderer2, { loop, events: monitor.events[loop.loopId] ?? [] });
    }
    $$renderer2.push(`<!--]--> `);
    if (sortedLoops.length === 0) {
      $$renderer2.push("<!--[-->");
      $$renderer2.push(`<div class="empty svelte-1uha8ag">Waiting for loops...</div>`);
    } else {
      $$renderer2.push("<!--[!-->");
    }
    $$renderer2.push(`<!--]--></div> `);
    StatusBar($$renderer2, { allEvents: monitor.events, connected: monitor.connected });
    $$renderer2.push(`<!----></div>`);
  });
}
export {
  _page as default
};
