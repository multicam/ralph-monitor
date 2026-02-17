<script lang="ts">
  import { onMount } from "svelte";
  import { monitor } from "$lib/stores/connection.svelte.ts";
  import VmCard from "$lib/components/VmCard.svelte";
  import StatusBar from "$lib/components/StatusBar.svelte";

  onMount(() => {
    monitor.connect();
    return () => monitor.disconnect();
  });

  const vmGroups = $derived(Object.entries(monitor.vmGroups));
  const totalLoops = $derived(Object.keys(monitor.loops).length);
</script>

<div class="dashboard">
  <header>
    <h1>ralph-monitor</h1>
    <span class="meta">{vmGroups.length} VM{vmGroups.length !== 1 ? "s" : ""} / {totalLoops} loop{totalLoops !== 1 ? "s" : ""}</span>
  </header>

  <div class="vm-groups">
    {#each vmGroups as [vmName, loops] (vmName)}
      <section class="vm-group">
        <h2 class="vm-name">{vmName}</h2>
        <div class="loop-grid" style="--cols: {Math.min(loops.length, 3)}">
          {#each loops as state (state.loopId)}
            <VmCard {state} events={monitor.events[state.loopId] ?? []} />
          {/each}
        </div>
      </section>
    {/each}

    {#if vmGroups.length === 0}
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
  }

  .vm-groups {
    flex: 1;
    overflow-y: auto;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .vm-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .vm-name {
    margin: 0;
    font-size: 12px;
    font-weight: 500;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .loop-grid {
    display: grid;
    grid-template-columns: repeat(var(--cols), 1fr);
    gap: 12px;
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
