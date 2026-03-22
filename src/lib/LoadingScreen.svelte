<script lang="ts">
  import { cache } from "$lib/cache.svelte.js";
</script>

<div class="screen">
  <div class="box">
    <div class="spinner"></div>
    <div class="title">Loading dashboard</div>
    {#if cache.progressTotal > 0}
      <div class="detail">
        Fetching participant {cache.progress} / {cache.progressTotal}
      </div>
      <div class="bar-wrap">
        <div
          class="bar"
          style="width:{(cache.progress / cache.progressTotal) * 100}%"
        ></div>
      </div>
    {:else}
      <div class="detail">Connecting to Roostoo API...</div>
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
  .bar-wrap {
    width: 200px;
    height: 4px;
    background: var(--border);
    border-radius: 2px;
    overflow: hidden;
  }
  .bar {
    height: 100%;
    background: var(--blue);
    transition: width 0.2s;
    border-radius: 2px;
  }
</style>
