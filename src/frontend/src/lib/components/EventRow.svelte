<script lang="ts">
  import type { MonitorEvent } from "../../../../../lib/types.ts";

  let { event }: { event: MonitorEvent } = $props();
  let expanded = $state(false);

  const icon = $derived(
    event.type === "tool_call" ? "\u25B6" :
    event.type === "tool_paired" ? "\u2713" :
    event.type === "tool_result" ? "\u2190" :
    event.type === "thinking" ? "\u2026" :
    event.type === "iteration" ? "\u2500" :
    "\u00B7"
  );

  const isPending = $derived(event.type === "tool_call");

  function formatTime(ts: number): string {
    return new Date(ts).toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }
</script>

{#if event.type === "iteration"}
  <div class="iteration-separator">
    <span>Iteration {event.iterationNumber}</span>
  </div>
{:else}
  <button class="event-row" class:pending={isPending} onclick={() => expanded = !expanded}>
    <span class="icon">{icon}</span>
    <span class="summary">{event.summary}</span>
    {#if event.type === "tool_paired" && event.durationMs}
      <span class="duration">{event.durationMs}ms</span>
    {/if}
    <span class="time">{formatTime(event.timestamp)}</span>
  </button>

  {#if expanded}
    <div class="detail">
      <pre>{JSON.stringify(event, null, 2)}</pre>
    </div>
  {/if}
{/if}

<style>
  .event-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 8px;
    font-size: 12px;
    font-family: monospace;
    color: #cbd5e1;
    background: none;
    border: none;
    cursor: pointer;
    text-align: left;
    width: 100%;
    border-radius: 4px;
  }

  .event-row:hover {
    background: #2a2a4a;
  }

  .event-row.pending {
    color: #fbbf24;
  }

  .event-row.pending .icon {
    animation: pulse 1.5s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }

  .icon {
    flex-shrink: 0;
    width: 14px;
    text-align: center;
  }

  .summary {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .duration {
    flex-shrink: 0;
    font-size: 10px;
    color: #64748b;
    padding: 1px 4px;
    background: #2a2a4a;
    border-radius: 3px;
  }

  .time {
    flex-shrink: 0;
    font-size: 10px;
    color: #475569;
  }

  .iteration-separator {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    font-size: 11px;
    color: #64748b;
    font-family: monospace;
  }

  .iteration-separator::before,
  .iteration-separator::after {
    content: "";
    flex: 1;
    border-top: 1px solid #2a2a4a;
  }

  .detail {
    padding: 8px;
    background: #0f0f23;
    border-radius: 4px;
    margin: 2px 0;
  }

  .detail pre {
    margin: 0;
    font-size: 10px;
    color: #94a3b8;
    white-space: pre-wrap;
    word-break: break-all;
  }
</style>
