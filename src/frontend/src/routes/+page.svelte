<script lang="ts">
  import { onMount } from "svelte";
  import { monitor } from "$lib/stores/connection.svelte.ts";
  import VmCard from "$lib/components/VmCard.svelte";
  import StatusBar from "$lib/components/StatusBar.svelte";

  onMount(() => {
    monitor.connect();
    return () => monitor.disconnect();
  });

  const sortedLoops = $derived(monitor.sortedLoops);
  const totalLoops = $derived(Object.keys(monitor.loops).length);

  let listEl: HTMLElement;
  let userScrolled = $state(false);

  function onScroll() {
    if (!listEl) return;
    const atBottom = listEl.scrollHeight - listEl.scrollTop - listEl.clientHeight < 40;
    userScrolled = !atBottom;
  }

  $effect(() => {
    // Auto-scroll to bottom when events change (if user hasn't scrolled up)
    if (!userScrolled && listEl && sortedLoops.length) {
      listEl.scrollTop = listEl.scrollHeight;
    }
  });
</script>

<div class="dashboard">
  <header>
    <h1>ralph-monitor</h1>
    <span class="meta">{totalLoops} loop{totalLoops !== 1 ? "s" : ""}</span>
    <span class="connection" class:connected={monitor.connected}>
      {monitor.connected ? "Connected" : "Disconnected"}
    </span>
  </header>

  <div class="loop-list" bind:this={listEl} onscroll={onScroll}>
    {#each sortedLoops as loop (loop.loopId)}
      <VmCard {loop} events={monitor.events[loop.loopId] ?? []} />
    {/each}

    {#if sortedLoops.length === 0}
      <div class="empty">Waiting for loops...</div>
    {/if}
  </div>

  <StatusBar allEvents={monitor.events} connected={monitor.connected} />
</div>

<style>
  .dashboard {
    display: flex;
    flex-direction: column;
    height: 100vh;
    overflow: hidden;
  }

  header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    border-bottom: 1px solid #2a2a4a;
  }

  header h1 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: #e2e8f0;
  }

  .meta {
    font-size: 12px;
    color: #64748b;
    flex: 1;
  }

  .connection {
    font-size: 12px;
    color: #f87171;
    font-family: monospace;
  }

  .connection.connected {
    color: #4ade80;
  }

  .loop-list {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    scrollbar-width: thin;
    scrollbar-color: #2a2a4a transparent;
  }

  .empty {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #475569;
    font-size: 14px;
  }
</style>
