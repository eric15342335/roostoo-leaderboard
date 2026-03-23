<script lang="ts">
  import { cache } from "$lib/cache.svelte.js";
</script>

<div class="screen">
  <div class="box">
    <div class="spinner"></div>
    <div class="title">Loading dashboard</div>
    {#if cache.error}
      <div class="detail error">{cache.error}</div>
    {:else}
      <div class="detail">Fetching data...</div>
    {/if}
  </div>
</div>

<style>
  .screen {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg);
  }
  .box {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
    padding: 40px;
    background: var(--card-bg);
    border: 1px solid var(--border);
    border-radius: 12px;
    min-width: 280px;
  }
  .title {
    font-size: 15px;
    color: var(--text);
    font-weight: 600;
  }
  .detail {
    font-size: 11px;
    color: var(--muted);
  }
  .detail.error {
    color: var(--red, #e55);
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  .spinner {
    width: 36px;
    height: 36px;
    border: 3px solid var(--border);
    border-top-color: var(--blue);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
</style>
