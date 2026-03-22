<script>
  import { cache, refresh, ttlLabel, isStale } from "$lib/cache.svelte.js";
  import { MUTED, ORANGE } from "$lib/theme.js";

  let label = $state("");

  $effect(() => {
    label = ttlLabel();
    const id = setInterval(() => {
      label = ttlLabel();
    }, 1000);
    return () => clearInterval(id);
  });
</script>

<header>
  <div class="left">
    <h1>Quant Trading Hackathon</h1>
    <span class="sub">Round 1 HK &amp; SG &mdash; Live Leaderboard</span>
  </div>
  <div class="right">
    <span
      class="ttl"
      style="color:{isStale() ? ORANGE : MUTED}">{label}</span
    >
    <a
      href="https://github.com/eric15342335/roostoo-leaderboard"
      target="_blank"
      rel="noopener noreferrer"
      class="gh-link"
      title="View source on GitHub"
    >
      <svg
        height="16"
        width="16"
        viewBox="0 0 16 16"
        fill="currentColor"
      >
        <path
          d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38
				0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13
				-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66
				.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15
				-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27
				.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12
				.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48
				0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"
        />
      </svg>
      GitHub
    </a>
    <button
      onclick={() => refresh(true)}
      disabled={cache.loading}
      class="btn"
    >
      {cache.loading ? "Fetching..." : "Refresh"}
    </button>
  </div>
</header>

{#if cache.loading && cache.progressTotal > 0}
  <div class="progress-wrap">
    <div
      class="progress-bar"
      style="width:{(cache.progress / cache.progressTotal) * 100}%"
    ></div>
    <span class="progress-label">
      Fetching participant {cache.progress} / {cache.progressTotal}
    </span>
  </div>
{:else if cache.loading}
  <div class="progress-wrap">
    <div class="progress-bar indeterminate"></div>
    <span class="progress-label">Connecting...</span>
  </div>
{/if}

{#if cache.error}
  <div class="error-bar">Error: {cache.error}</div>
{/if}

<style>
  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px 10px;
    border-bottom: 1px solid var(--border);
    flex-wrap: wrap;
    gap: 10px;
  }
  h1 {
    font-size: 18px;
    color: var(--blue);
    margin-bottom: 2px;
  }
  .sub {
    font-size: 11px;
    color: var(--muted);
  }
  .left {
    display: flex;
    flex-direction: column;
  }
  .right {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .ttl {
    font-size: 11px;
  }
  .gh-link {
    display: flex;
    align-items: center;
    gap: 5px;
    color: var(--muted);
    text-decoration: none;
    font-size: 12px;
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 6px 12px;
    transition:
      color 0.15s,
      border-color 0.15s;
  }
  .gh-link:hover {
    color: var(--text);
    border-color: var(--muted);
  }
  .btn {
    background: #1f2937;
    color: var(--text);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 6px 14px;
    font-family: inherit;
    font-size: 12px;
    transition: background 0.15s;
  }
  .btn:hover:not(:disabled) {
    background: #2d3748;
  }
  .btn:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
  .progress-wrap {
    height: 4px;
    background: var(--card-bg);
    position: relative;
    overflow: hidden;
  }
  .progress-bar {
    height: 100%;
    background: var(--blue);
    transition: width 0.2s;
  }
  .progress-label {
    position: absolute;
    right: 8px;
    top: 6px;
    font-size: 10px;
    color: var(--muted);
  }
  @keyframes slide {
    from {
      transform: translateX(-100%);
    }
    to {
      transform: translateX(400%);
    }
  }
  .indeterminate {
    width: 25%;
    animation: slide 1.2s ease-in-out infinite;
  }
  .error-bar {
    background: #2d1b1b;
    border-bottom: 1px solid var(--red);
    color: var(--red);
    font-size: 11px;
    padding: 6px 20px;
  }
</style>
