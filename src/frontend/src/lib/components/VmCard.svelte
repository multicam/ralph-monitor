<script lang="ts">
  import type { LoopState, MonitorEvent } from "../../../../../lib/types.ts";
  import EventFeed from "./EventFeed.svelte";

  let { state, events }: { state: LoopState; events: MonitorEvent[] } = $props();

  const statusColor = $derived(
    state.status === "connected" ? "#4ade80" :
    state.status === "inactive" ? "#fbbf24" :
    state.status === "disconnected" ? "#f87171" : "#9ca3af"
  );

  const isInactive = $derived(state.status === "inactive");

  const sessionLabel = $derived(() => {
    const parts = state.sessionFile.split("/").pop() ?? "";
    return parts.replace(".jsonl", "");
  });

  const uptime = $derived(() => {
    if (!state.startedAt) return "";
    const ms = Date.now() - state.startedAt;
    const mins = Math.floor(ms / 60_000);
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    return `${hrs}h ${mins % 60}m`;
  });
</script>

<div class="vm-card" class:inactive={isInactive}>
  <div class="vm-header">
    <div class="vm-title">
      <span class="status-dot" style="background: {statusColor}"></span>
      <h2>{sessionLabel()}</h2>
    </div>
    <div class="vm-meta">
      {#if state.mode}
        <span class="badge">{state.mode}</span>
      {/if}
      {#if state.currentIteration > 0}
        <span class="badge">#{state.currentIteration}</span>
      {/if}
      {#if state.model}
        <span class="badge">{state.model}</span>
      {/if}
    </div>
  </div>

  {#if state.branch}
    <div class="vm-branch">{state.branch}</div>
  {/if}

  {#if state.status === "idle"}
    <div class="vm-idle">No active loop</div>
  {:else if state.status === "disconnected"}
    <div class="vm-disconnected">Disconnected</div>
  {:else}
    <EventFeed events={events} />
  {/if}

  {#if state.startedAt}
    <div class="vm-footer">{uptime()}</div>
  {/if}
</div>

<style>
  .vm-card {
    background: #1a1a2e;
    border: 1px solid #2a2a4a;
    border-radius: 8px;
    padding: 16px;
    display: flex;
    flex-direction: column;
    min-height: 300px;
    max-height: 600px;
  }

  .vm-card.inactive {
    opacity: 0.5;
  }

  .vm-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }

  .vm-title {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .vm-title h2 {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    color: #e2e8f0;
  }

  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .vm-meta {
    display: flex;
    gap: 4px;
  }

  .badge {
    font-size: 11px;
    padding: 2px 6px;
    border-radius: 4px;
    background: #2a2a4a;
    color: #94a3b8;
    font-family: monospace;
  }

  .vm-branch {
    font-size: 12px;
    color: #64748b;
    font-family: monospace;
    margin-bottom: 8px;
  }

  .vm-idle, .vm-disconnected {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #64748b;
    font-size: 13px;
  }

  .vm-footer {
    font-size: 11px;
    color: #64748b;
    text-align: right;
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid #2a2a4a;
  }
</style>
