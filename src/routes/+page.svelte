<script lang="ts">
  import { onMount } from "svelte";
  import { cache, refresh, loadFromStorage, isStale } from "$lib/cache.svelte.js";
  import Header from "$lib/Header.svelte";
  import StatCard from "$lib/StatCard.svelte";
  import PlotPanel from "$lib/PlotPanel.svelte";
  import LoadingScreen from "$lib/LoadingScreen.svelte";
  import RegionFilter from "$lib/RegionFilter.svelte";
  import {
    chartLeaderboard,
    chartVolume,
    chartBuySell,
    chartCancelled,
    chartTopPairs,
    chartCoinPnl,
    chartHeatmap,
    chartOrderTiming,
    chartOrderSizeDist,
    chartCommission,
    chartActivityVsProfit,
    chartHkVsSgOverview,
    chartOrderTimingByCountry,
    chartCoinPnlByCountry,
  } from "$lib/charts.js";

  let ready = $state(false);
  let region = $state("ALL");

  onMount(async () => {
    const hadStored = await loadFromStorage();
    if (!hadStored || isStale()) {
      refresh(true);
    }
    ready = true;
  });

  let d = $derived(cache.data);

  let filtered = $derived.by(() => {
    if (!d) return null;
    if (region === "ALL") return d;
    return {
      ...d,
      lbRows: d.lbRows.filter((r) => r.country === region),
      orderRows: d.orderRows.filter((r) => r.country === region),
      coinRows: d.coinRows.filter((r) => r.country === region),
    };
  });
</script>

<svelte:head>
  <title>Quant Trading Hackathon - Dashboard</title>
</svelte:head>

{#if !ready || (!d && cache.loading)}
  <LoadingScreen />
{:else if d}
  {#if filtered}
    <Header />

    <main>
      <div class="top-row">
        <div class="stats-col">
          <RegionFilter
            value={region}
            onchange={(v) => (region = v)}
          />
          <StatCard
            lbRows={filtered.lbRows}
            orderRows={filtered.orderRows}
            meta={filtered.meta}
          />
        </div>
        <PlotPanel
          chartFn={chartLeaderboard}
          args={[filtered.lbRows]}
        />
      </div>

      <div class="grid-1">
        <PlotPanel
          chartFn={chartVolume}
          args={[filtered.lbRows]}
        />
      </div>

      <div class="grid-1">
        <PlotPanel
          chartFn={chartBuySell}
          args={[filtered.lbRows]}
        />
      </div>

      <div class="grid-1">
        <PlotPanel
          chartFn={chartCancelled}
          args={[filtered.lbRows]}
        />
      </div>

      <div class="grid-1">
        <PlotPanel
          chartFn={chartTopPairs}
          args={[filtered.orderRows]}
        />
      </div>

      <div class="grid-1">
        <PlotPanel
          chartFn={chartCoinPnl}
          args={[filtered.coinRows]}
        />
      </div>

      <div class="grid-1">
        <PlotPanel
          chartFn={chartHeatmap}
          args={[filtered.coinRows]}
        />
      </div>

      <div class="grid-2">
        <PlotPanel
          chartFn={chartOrderTiming}
          args={[filtered.orderRows]}
        />
        <PlotPanel
          chartFn={chartOrderSizeDist}
          args={[filtered.orderRows]}
        />
      </div>

      <div class="grid-2">
        <PlotPanel
          chartFn={chartCommission}
          args={[filtered.lbRows]}
        />
        <PlotPanel
          chartFn={chartActivityVsProfit}
          args={[filtered.lbRows]}
        />
      </div>

      {#if region === "ALL"}
        <div class="section-divider">
          <span>Hong Kong vs Singapore</span>
        </div>

        <div class="grid-1">
          <PlotPanel
            chartFn={chartHkVsSgOverview}
            args={[filtered.lbRows]}
          />
        </div>

        <div class="grid-2">
          <PlotPanel
            chartFn={chartOrderTimingByCountry}
            args={[filtered.orderRows]}
          />
          <PlotPanel
            chartFn={chartCoinPnlByCountry}
            args={[filtered.coinRows]}
          />
        </div>
      {/if}
    </main>
  {/if}
{:else if cache.error}
  <div class="error-full">
    <div class="error-box">
      <div class="error-title">Failed to load data</div>
      <div class="error-msg">{cache.error}</div>
      <button
        onclick={() => refresh(true)}
        class="retry-btn">Retry</button
      >
    </div>
  </div>
{/if}

<style>
  :global(:root) {
    --bg: #0d1117;
    --card-bg: #161b22;
    --border: #30363d;
    --text: #e6edf3;
    --muted: #8b949e;
    --green: #3fb950;
    --red: #f85149;
    --blue: #58a6ff;
    --orange: #d29922;
    --purple: #bc8cff;
    --cyan: #79c0ff;
  }

  main {
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .top-row {
    display: grid;
    grid-template-columns: 280px 1fr;
    gap: 16px;
    align-items: start;
  }

  .stats-col {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .grid-2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }

  .grid-1 {
    display: grid;
    grid-template-columns: 1fr;
  }

  .section-divider {
    display: flex;
    align-items: center;
    gap: 12px;
    margin: 8px 0 4px;
    color: var(--muted);
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
  .section-divider::before,
  .section-divider::after {
    content: "";
    flex: 1;
    height: 1px;
    background: var(--border);
  }

  @media (max-width: 900px) {
    .top-row,
    .grid-2 {
      grid-template-columns: 1fr;
    }
  }

  .error-full {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .error-box {
    background: var(--card-bg);
    border: 1px solid var(--red);
    border-radius: 10px;
    padding: 32px 40px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }

  .error-title {
    font-size: 15px;
    font-weight: 700;
    color: var(--red);
  }

  .error-msg {
    font-size: 12px;
    color: var(--muted);
    max-width: 340px;
    text-align: center;
  }

  .retry-btn {
    background: #1f2937;
    color: var(--text);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 8px 20px;
    font-family: inherit;
    font-size: 13px;
  }

  .retry-btn:hover {
    background: #2d3748;
  }
</style>
