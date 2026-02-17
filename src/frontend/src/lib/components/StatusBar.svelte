<script lang="ts">
  import type { MonitorEvent } from "../../../../../lib/types.ts";

  let { allEvents, connected }: { allEvents: Record<string, MonitorEvent[]>; connected: boolean } = $props();

  const stats = $derived(() => {
    const now = Date.now();
    const oneMinAgo = now - 60_000;
    const oneHourAgo = now - 3_600_000;

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
  });
</script>

<div class="status-bar">
  <span class="connection" class:connected>
    {connected ? "Connected" : "Disconnected"}
  </span>
  <span class="stat">{stats().toolCallsPerMin} tool calls/min</span>
  <span class="stat">{stats().commitsPerHour} commits/hr</span>
  {#if stats().errors > 0}
    <span class="stat error">{stats().errors} errors</span>
  {/if}
</div>

<style>
  .status-bar {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 8px 16px;
    background: #0f0f23;
    border-top: 1px solid #2a2a4a;
    font-size: 12px;
    font-family: monospace;
    color: #64748b;
  }

  .connection {
    color: #f87171;
  }

  .connection.connected {
    color: #4ade80;
  }

  .stat {
    color: #94a3b8;
  }

  .stat.error {
    color: #f87171;
  }
</style>
