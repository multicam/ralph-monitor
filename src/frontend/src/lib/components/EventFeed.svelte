<script lang="ts">
  import type { MonitorEvent } from "../../../../../lib/types.ts";
  import EventRow from "./EventRow.svelte";

  let { events }: { events: MonitorEvent[] } = $props();

  let container: HTMLElement;
  let userScrolled = $state(false);

  const reversed = $derived([...events].reverse());

  function onScroll() {
    if (!container) return;
    userScrolled = container.scrollTop > 20;
  }

  $effect(() => {
    // Auto-scroll to top when new events arrive (if user hasn't scrolled)
    if (!userScrolled && container && events.length) {
      container.scrollTop = 0;
    }
  });
</script>

<div class="feed" bind:this={container} onscroll={onScroll}>
  {#each reversed as event (event.id)}
    <EventRow {event} />
  {/each}
</div>

<style>
  .feed {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 2px;
    scrollbar-width: thin;
    scrollbar-color: #2a2a4a transparent;
  }
</style>
