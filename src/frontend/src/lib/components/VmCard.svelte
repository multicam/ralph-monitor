<script lang="ts">
  import type { LoopState, MonitorEvent } from "../../../../../lib/types.ts";
  import { monitor } from "$lib/stores/connection.svelte.ts";
  import EventFeed from "./EventFeed.svelte";

  let { loop, events }: { loop: LoopState; events: MonitorEvent[] } = $props();

  const isRunning = $derived(loop.health === "running");
  let manualOpen = $state<boolean | null>(null);
  const expanded = $derived(manualOpen ?? isRunning);

  const healthColor = $derived(
    loop.health === "running" ? "#4ade80" :
    loop.health === "errored" ? "#f87171" :
    loop.health === "stale" ? "#fbbf24" : "#64748b"
  );

  const healthIcon = $derived(
    loop.health === "running" ? "\u25CF" :
    loop.health === "errored" ? "\u2715" :
    loop.health === "stale" ? "\u25CB" : "\u25CB"
  );

  const sessionLabel = $derived(() => {
    const parts = loop.sessionFile.split("/").pop() ?? "";
    return parts.replace(".jsonl", "");
  });

  const timeLabel = $derived(() => {
    if (loop.health === "running" && loop.startedAt) {
      const ms = Date.now() - loop.startedAt;
      const mins = Math.floor(ms / 60_000);
      if (mins < 60) return `${mins}m`;
      const hrs = Math.floor(mins / 60);
      return `${hrs}h ${mins % 60}m`;
    }
    if (loop.lastActivity) {
      const ms = Date.now() - loop.lastActivity;
      const mins = Math.floor(ms / 60_000);
      if (mins < 1) return "just now";
      if (mins < 60) return `${mins}m ago`;
      const hrs = Math.floor(mins / 60);
      if (hrs < 24) return `${hrs}h ago`;
      return `${Math.floor(hrs / 24)}d ago`;
    }
    return "";
  });

  function toggle() {
    const next = !expanded;
    manualOpen = next;
    if (next && !events.length) {
      monitor.fetchEvents(loop.loopId);
    }
  }
</script>

<div class="card" class:expanded class:errored={loop.health === "errored"}>
  <button class="card-header" onclick={toggle}>
    <span class="health-dot" class:pulsing={isRunning} style="color: {healthColor}">
      {healthIcon}
    </span>
    <h2 class="session-name">{sessionLabel()}</h2>

    <div class="badges">
      {#if loop.mode}
        <span class="badge">{loop.mode}</span>
      {/if}
      {#if loop.currentIteration > 0}
        <span class="badge">#{loop.currentIteration}</span>
      {/if}
      {#if loop.model}
        <span class="badge">{loop.model}</span>
      {/if}
      {#if loop.branch}
        <span class="badge branch">{loop.branch}</span>
      {/if}
    </div>

    <span class="time-label">{timeLabel()}</span>
    <span class="chevron">{expanded ? "\u25BE" : "\u25B8"}</span>
  </button>

  {#if expanded}
    <div class="card-body">
      {#if events.length > 0}
        <EventFeed {events} />
      {:else}
        <div class="loading">Loading events...</div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .card {
    background: #1a1a2e;
    border: 1px solid #2a2a4a;
    border-radius: 8px;
    overflow: hidden;
  }

  .card.errored {
    border-color: #f8717133;
  }

  .card.expanded {
    max-height: 600px;
    display: flex;
    flex-direction: column;
  }

  .card-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    font-size: 12px;
    font-family: monospace;
    color: #cbd5e1;
    background: none;
    border: none;
    cursor: pointer;
    text-align: left;
    width: 100%;
  }

  .card-header:hover {
    background: #1e1e36;
  }

  .health-dot {
    flex-shrink: 0;
    font-size: 10px;
    line-height: 1;
  }

  .health-dot.pulsing {
    animation: pulse 1.5s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }

  .session-name {
    margin: 0;
    font-size: 13px;
    font-weight: 600;
    color: #e2e8f0;
    white-space: nowrap;
  }

  .badges {
    display: flex;
    gap: 4px;
    flex: 1;
    justify-content: flex-end;
  }

  .badge {
    font-size: 10px;
    padding: 1px 5px;
    border-radius: 3px;
    background: #2a2a4a;
    color: #94a3b8;
  }

  .badge.branch {
    color: #818cf8;
  }

  .time-label {
    flex-shrink: 0;
    font-size: 11px;
    color: #64748b;
    min-width: 50px;
    text-align: right;
  }

  .chevron {
    flex-shrink: 0;
    font-size: 10px;
    color: #64748b;
  }

  .card-body {
    flex: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    border-top: 1px solid #2a2a4a;
    min-height: 200px;
  }

  .loading {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #475569;
    font-size: 12px;
  }
</style>
