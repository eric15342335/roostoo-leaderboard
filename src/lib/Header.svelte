<script lang="ts">
  import { cache, scrapedLabel } from "$lib/cache.svelte.js";
  import RegionFilter from "$lib/RegionFilter.svelte";
  import { summaryStats, type LbEntry, type OrderRow } from "$lib/transform.js";
  import { GREEN, RED, BLUE, ORANGE } from "$lib/theme.js";

  let {
    lbRows = [],
    orderRows = [],
    region = "ALL",
    onRegionChange,
  }: {
    lbRows: LbEntry[];
    orderRows: OrderRow[];
    region: string;
    onRegionChange: (v: string) => void;
  } = $props();

  let label = $state("");
  let stats = $derived(summaryStats(lbRows, orderRows));

  $effect(() => {
    label = scrapedLabel();
    const id = setInterval(() => {
      label = scrapedLabel();
    }, 1000);
    return () => clearInterval(id);
  });

  function fmtPct(v: number) {
    return `${v >= 0 ? "+" : ""}${parseFloat(v.toFixed(4))}%`;
  }
  function fmtVol(v: number) {
    const abs = Math.abs(v);
    if (abs >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
    if (abs >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
    return `$${(v / 1e3).toFixed(0)}K`;
  }
  function fmtCommission(v: number, pct: number) {
    return `${fmtVol(v)} (${pct.toFixed(2)}%)`;
  }

  let regionColor = $derived(getRegionColor(region));
  let accentColor = $derived(region === "ALL" ? "var(--text)" : regionColor);
  let pnlPositiveColor = $derived(region === "ALL" ? GREEN : regionColor);

  function getRegionColor(region: string): string {
    if (region === "HK") return BLUE;
    if (region === "SG") return GREEN;
    return "var(--text)";
  }
  let bestTeamName = $derived(extractTeamName(stats.bestTeam?.team));
  let worstTeamName = $derived(extractTeamName(stats.worstTeam?.team));
  let showWorst = $derived(!!stats.worstTeam && stats.worstTeam !== stats.bestTeam);

  function extractTeamName(fullTeam: string | undefined): string {
    if (!fullTeam) return "";
    return fullTeam.split("(")[0].trim();
  }
</script>

<header>
  <div class="nav-row">
    <div class="left">
      <a
        href="https://luma.com/tqx5xvcy?tk=5OpRgP"
        class="title-link"><h1>Quant Trading Hackathon</h1></a
      >
      <span class="sub">Round 1 HK &amp; SG &mdash; Live Leaderboard</span>
    </div>

    <RegionFilter
      value={region}
      onchange={onRegionChange}
    />

    <div class="right">
      <span class="ttl">{label}</span>
      <a
        href="data.json"
        download
        rel="external"
        class="gh-link dl-link"
        title="Download raw JSON snapshot"
      >
        <svg
          height="16"
          width="16"
          viewBox="0 0 16 16"
          fill="currentColor"
        >
          <path
            d="M7.47 10.78a.75.75 0 0 0 1.06 0l3.75-3.75a.75.75 0 0 0-1.06-1.06L8.75 8.44V1.75a.75.75 0 0 0-1.5 0v6.69L4.78 5.97a.75.75 0 0 0-1.06 1.06l3.75 3.75ZM1.75 13.25a.75.75 0 0 0 0 1.5h12.5a.75.75 0 0 0 0-1.5H1.75Z"
          />
        </svg>
        <span class="link-label">Download Data</span>
      </a>
      <a
        href="https://github.com/eric15342335/roostoo-leaderboard"
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
        <span class="link-label">GitHub</span>
      </a>
    </div>
  </div>
</header>

{#if lbRows.length > 0}
  <div class="stats-row">
    <div class="stat">
      <span class="slabel">Teams</span><span
        class="sval"
        style="color:{accentColor}">{stats.participantCount}</span
      >
    </div>
    <div class="stat">
      <span class="slabel">Volume</span><span
        class="sval"
        style="color:{accentColor}">{fmtVol(stats.totalVolume)}</span
      >
    </div>
    <div class="stat">
      <span class="slabel">Commission</span><span
        class="sval"
        style="color:{ORANGE}">{fmtCommission(stats.totalCommission, stats.commissionPct)}</span
      >
    </div>
    <div class="stat">
      <span class="slabel">Avg P&amp;L</span><span
        class="sval"
        style="color:{stats.avgProfitPct >= 0 ? pnlPositiveColor : RED}"
        >{fmtPct(stats.avgProfitPct)}</span
      >
    </div>
    {#if stats.bestTeam}<div class="stat">
        <span class="slabel">Best</span><span
          class="sval"
          style="color:{GREEN}">{bestTeamName} ({fmtPct(stats.bestTeam.profitPct)})</span
        >
      </div>{/if}
    {#if showWorst}<div class="stat">
        <span class="slabel">Worst</span><span
          class="sval"
          style="color:{RED}">{worstTeamName} ({fmtPct(stats.worstTeam!.profitPct)})</span
        >
      </div>{/if}
  </div>
{/if}

{#if cache.loading}
  <div class="progress-wrap">
    <div class="progress-bar indeterminate"></div>
    <span class="progress-label">Fetching data...</span>
  </div>
{/if}

{#if cache.error}
  <div class="error-bar">Error: {cache.error}</div>
{/if}

<style>
  header {
    display: flex;
    flex-direction: column;
    padding: 8px 20px 0;
    border-bottom: 1px solid var(--border);
    position: sticky;
    top: 0;
    z-index: 100;
    background: rgba(13, 17, 23, 0.75);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
  }
  .nav-row {
    display: flex;
    align-items: center;
    gap: 20px;
    padding-bottom: 10px;
  }
  .left {
    display: flex;
    flex-direction: column;
  }
  .right {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-shrink: 0;
    margin-left: auto;
  }
  .stats-row {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px 16px;
    padding: 10px 20px;
    border-bottom: 1px solid var(--border);
    background: var(--bg);
  }
  .title-link {
    text-decoration: none;
  }
  .title-link:hover h1 {
    text-decoration: underline;
    text-underline-offset: 3px;
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
  .stat {
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
  }
  .slabel {
    font-size: 9px;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    white-space: nowrap;
  }
  .sval {
    font-size: 11px;
    font-weight: 700;
    color: var(--text);
    white-space: nowrap;
  }
  .ttl {
    font-size: 11px;
    color: var(--muted);
    white-space: nowrap;
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
  .dl-link {
    color: var(--text);
    border-color: var(--muted);
  }
  .dl-link:hover {
    color: #fff;
    border-color: #fff;
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

  @media (max-width: 900px) {
    header {
      padding: 6px 14px 0;
    }
    .ttl {
      display: none;
    }
    .stats-row {
      padding: 10px 14px;
    }
  }

  @media (max-width: 600px) {
    header {
      padding: 6px 12px 0;
      position: relative;
    }
    .nav-row {
      flex-direction: column;
      align-items: center;
      gap: 8px;
      padding-bottom: 8px;
    }
    .left {
      align-items: center;
      text-align: center;
    }
    .right {
      margin-left: 0;
      justify-content: center;
      gap: 8px;
    }
    .link-label {
      display: none;
    }
    .gh-link {
      padding: 6px 8px;
      gap: 0;
    }
    .stats-row {
      padding: 8px 12px;
      justify-content: center;
      gap: 8px 12px;
    }
  }
</style>
