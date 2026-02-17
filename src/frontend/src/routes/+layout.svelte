<script>
  let { children } = $props();
</script>

{@render children()}

<style>
  :global(body) {
    margin: 0;
    padding: 0;
    background: #0f0f23;
    color: #e2e8f0;
    font-family: "JetBrains Mono", "Fira Code", "SF Mono", monospace;
    -webkit-font-smoothing: antialiased;
  }

  :global(*) {
    box-sizing: border-box;
  }
</style>
