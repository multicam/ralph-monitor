<script lang="ts">
  import { onMount } from "svelte";
  import type { LoopState, MonitorEvent } from "../../../../../lib/types.ts";
  import { monitor } from "$lib/stores/connection.svelte.ts";
  import EventFeed from "./EventFeed.svelte";

  let { loop, events }: { loop: LoopState; events: MonitorEvent[] } = $props();

  let now = $state(Date.now());
  onMount(() => {
    const id = setInterval(() => { now = Date.now(); }, 30_000);
    return () => clearInterval(id);
  });

  const isRunning = $derived(loop.health === "running");
  let manualOpen = $state<boolean | null>(null);
  const expanded = $derived(manualOpen ?? isRunning);

  const healthColor = $derived(
    loop.health === "running" ? "#4ade80" :
    loop.health === "completed" ? "#818cf8" :
    loop.health === "errored" ? "#f87171" :
    loop.health === "stale" ? "#fbbf24" : "#64748b"
  );

  const healthIcon = $derived(
    loop.health === "running" ? "\u25CF" :
    loop.health === "completed" ? "\u2713" :
    loop.health === "errored" ? "\u2715" :
    loop.health === "stale" ? "\u25CB" : "\u25CB"
  );

  const sessionLabel = $derived.by(() => {
    const parts = loop.sessionFile.split("/").pop() ?? "";
    return parts.replace(".jsonl", "");
  });

  function fmtTime(ts: number): string {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
  }

  function fmtDuration(ms: number): string {
    const mins = Math.floor(ms / 60_000);
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    return `${hrs}h${mins % 60}m`;
  }

  const timeLabel = $derived.by(() => {
    if (!loop.startedAt) return "";
    const start = fmtTime(loop.startedAt);
    if (loop.finishedAt) {
      const dur = fmtDuration(loop.finishedAt - loop.startedAt);
      return `${start} \u2013 ${fmtTime(loop.finishedAt)} (${dur})`;
    }
    const dur = fmtDuration(now - loop.startedAt);
    return `${start} (${dur})`;
  });

  function toggle() {
    const next = !expanded;
    manualOpen = next;
    if (next && !events.length) {
      monitor.fetchEvents(loop.loopId);
    }
  }

  function deleteLoop(e: MouseEvent) {
    e.stopPropagation();
    fetch(`/api/loops/${encodeURIComponent(loop.loopId)}`, { method: "DELETE" });
  }
</script>

<div class="card" class:expanded class:running={loop.health === "running"} class:completed={loop.health === "completed"} class:errored={loop.health === "errored"} class:stale={loop.health === "stale"}>
  <div class="card-header" role="button" tabindex="0" onclick={toggle} onkeydown={(e) => e.key === 'Enter' || e.key === ' ' ? toggle() : null}>
    <span class="health-dot" class:pulsing={isRunning} style="color: {healthColor}">
      {healthIcon}
    </span>
    <h2 class="session-name">{#if loop.project}<span class="project">{loop.project}/</span>{/if}{sessionLabel}</h2>

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

    <span class="time-label">{timeLabel}</span>
    <span class="chevron">{expanded ? "\u25BE" : "\u25B8"}</span>
    <button class="delete-btn" onclick={deleteLoop} title="Delete log">&times;</button>
  </div>

  {#if expanded}
    <div class="card-body">
      {#if events.length > 0}
        <EventFeed {events} />
      {:else if loop.loopId in monitor.events}
        <div class="loading">No events</div>
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
    flex-shrink: 0;
  }

  .card.running {
    border-color: #4ade8033;
  }

  .card.completed {
    border-color: #818cf833;
    opacity: 0.7;
  }

  .card.errored {
    border-color: #f8717133;
  }

  .card.stale {
    border-color: #fbbf2433;
    opacity: 0.5;
  }

  .card.expanded {
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

  .project {
    color: #818cf8;
    font-weight: 400;
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

  .delete-btn {
    flex-shrink: 0;
    background: none;
    border: none;
    color: #475569;
    font-size: 14px;
    cursor: pointer;
    padding: 0 2px;
    line-height: 1;
    border-radius: 3px;
  }

  .delete-btn:hover {
    color: #f87171;
    background: #f8717122;
  }

  .card-body {
    border-top: 1px solid #2a2a4a;
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
