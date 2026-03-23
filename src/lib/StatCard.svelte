<script lang="ts">
  import { GREEN, RED, BLUE, ORANGE } from "$lib/theme.js";
  import { summaryStats, type LbEntry, type OrderRow } from "$lib/transform.js";

  let {
    lbRows,
    orderRows,
    meta,
    region,
  }: { lbRows: LbEntry[]; orderRows: OrderRow[]; meta: any; region: string } = $props();

  let stats = $derived(summaryStats(lbRows, orderRows));

  function fmtPct(v: number) {
    return `${v >= 0 ? "+" : ""}${parseFloat(v.toFixed(4))}%`;
  }
  function fmtVol(v: number) {
    return `$${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  }
  function fmtCommission(v: number, pct: number) {
    return `$${v.toLocaleString(undefined, { maximumFractionDigits: 2 })} (${pct.toFixed(2)}%)`;
  }
</script>

<div class="card">
  {#if region === "ALL"}
    <div class="title">Competition Summary</div>

    <div class="row">
      <span class="key">HK Competition</span>
      <span
        class="val"
        style="color:{BLUE}">{meta.hkCompetitionName ?? meta.competitionName}</span
      >
    </div>
    {#if meta.sgCompetitionName}
      <div class="row">
        <span class="key">SG Competition</span>
        <span
          class="val"
          style="color:{GREEN}">{meta.sgCompetitionName}</span
        >
      </div>
    {/if}
    <div class="row">
      <span class="key">Participants</span>
      <span class="val">{stats.participantCount}</span>
    </div>
    <div class="row">
      <span class="key">Total Orders</span>
      <span class="val">{stats.totalOrders.toLocaleString()}</span>
    </div>
    <div class="row">
      <span class="key">Total Volume</span>
      <span class="val">{fmtVol(stats.totalVolume)}</span>
    </div>
    <div class="row">
      <span class="key">Total Commission</span>
      <span
        class="val"
        style="color:{ORANGE}">{fmtCommission(stats.totalCommission, stats.commissionPct)}</span
      >
    </div>
    <div class="row">
      <span class="key">Avg P&amp;L</span>
      <span
        class="val"
        style="color:{stats.avgProfitPct >= 0 ? GREEN : RED}">{fmtPct(stats.avgProfitPct)}</span
      >
    </div>
    {#if stats.bestTeam}
      <div class="row">
        <span class="key">Best Team</span>
        <span
          class="val"
          style="color:{GREEN}">{stats.bestTeam.team} ({fmtPct(stats.bestTeam.profitPct)})</span
        >
      </div>
    {/if}
    {#if stats.worstTeam}
      <div class="row">
        <span class="key">Worst Team</span>
        <span
          class="val"
          style="color:{RED}">{stats.worstTeam.team} ({fmtPct(stats.worstTeam.profitPct)})</span
        >
      </div>
    {/if}
  {:else if region === "HK"}
    <div
      class="title"
      style="color:{BLUE}"
    >
      HK Summary
    </div>

    <div class="row">
      <span class="key">HK Competition</span>
      <span
        class="val"
        style="color:{BLUE}">{meta.hkCompetitionName ?? meta.competitionName}</span
      >
    </div>
    <div class="row">
      <span class="key">Teams</span>
      <span
        class="val"
        style="color:{BLUE}">{stats.participantCount}</span
      >
    </div>
    <div class="row">
      <span class="key">Total Orders</span>
      <span
        class="val"
        style="color:{BLUE}">{stats.totalOrders.toLocaleString()}</span
      >
    </div>
    <div class="row">
      <span class="key">Total Volume</span>
      <span
        class="val"
        style="color:{BLUE}">{fmtVol(stats.totalVolume)}</span
      >
    </div>
    <div class="row">
      <span class="key">Total Commission</span>
      <span
        class="val"
        style="color:{ORANGE}">{fmtCommission(stats.totalCommission, stats.commissionPct)}</span
      >
    </div>
    <div class="row">
      <span class="key">Avg P&amp;L</span>
      <span
        class="val"
        style="color:{stats.avgProfitPct >= 0 ? BLUE : RED}">{fmtPct(stats.avgProfitPct)}</span
      >
    </div>
    {#if stats.bestTeam}
      <div class="row">
        <span class="key">Best Team</span>
        <span
          class="val"
          style="color:{GREEN}">{stats.bestTeam.team} ({fmtPct(stats.bestTeam.profitPct)})</span
        >
      </div>
    {/if}
    {#if stats.worstTeam && stats.worstTeam !== stats.bestTeam}
      <div class="row">
        <span class="key">Worst Team</span>
        <span
          class="val"
          style="color:{RED}">{stats.worstTeam.team} ({fmtPct(stats.worstTeam.profitPct)})</span
        >
      </div>
    {/if}
  {:else if region === "SG"}
    <div
      class="title"
      style="color:{GREEN}"
    >
      SG Summary
    </div>

    {#if meta.sgCompetitionName}
      <div class="row">
        <span class="key">SG Competition</span>
        <span
          class="val"
          style="color:{GREEN}">{meta.sgCompetitionName}</span
        >
      </div>
    {/if}
    <div class="row">
      <span class="key">Teams</span>
      <span
        class="val"
        style="color:{GREEN}">{stats.participantCount}</span
      >
    </div>
    <div class="row">
      <span class="key">Total Orders</span>
      <span
        class="val"
        style="color:{GREEN}">{stats.totalOrders.toLocaleString()}</span
      >
    </div>
    <div class="row">
      <span class="key">Total Volume</span>
      <span
        class="val"
        style="color:{GREEN}">{fmtVol(stats.totalVolume)}</span
      >
    </div>
    <div class="row">
      <span class="key">Total Commission</span>
      <span
        class="val"
        style="color:{ORANGE}">{fmtCommission(stats.totalCommission, stats.commissionPct)}</span
      >
    </div>
    <div class="row">
      <span class="key">Avg P&amp;L</span>
      <span
        class="val"
        style="color:{stats.avgProfitPct >= 0 ? GREEN : RED}">{fmtPct(stats.avgProfitPct)}</span
      >
    </div>
    {#if stats.bestTeam}
      <div class="row">
        <span class="key">Best Team</span>
        <span
          class="val"
          style="color:{GREEN}">{stats.bestTeam.team} ({fmtPct(stats.bestTeam.profitPct)})</span
        >
      </div>
    {/if}
    {#if stats.worstTeam && stats.worstTeam !== stats.bestTeam}
      <div class="row">
        <span class="key">Worst Team</span>
        <span
          class="val"
          style="color:{RED}">{stats.worstTeam.team} ({fmtPct(stats.worstTeam.profitPct)})</span
        >
      </div>
    {/if}
  {/if}
</div>

<style>
  .card {
    background: var(--card-bg);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 16px;
    font-size: 12px;
    line-height: 1.6;
  }
  .title {
    font-size: 14px;
    font-weight: 700;
    color: var(--blue);
    margin-bottom: 10px;
  }
  .row {
    display: flex;
    flex-direction: column;
    padding: 4px 0;
    border-bottom: 1px solid var(--border);
    gap: 1px;
  }
  .row:last-child {
    border-bottom: none;
  }
  .key {
    color: var(--muted);
    font-size: 10px;
  }
  .val {
    color: var(--text);
    font-weight: 600;
    word-break: break-word;
    font-size: 11px;
  }
</style>
