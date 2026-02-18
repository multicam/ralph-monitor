<script lang="ts">
  import type { MonitorEvent } from "../../../../../lib/types.ts";
  import EventRow from "./EventRow.svelte";

  let { events }: { events: MonitorEvent[] } = $props();
</script>

<div class="feed">
  {#each events as event, i (event.id + '_' + i)}
    <EventRow {event} />
  {/each}
</div>

<style>
  .feed {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
</style>
