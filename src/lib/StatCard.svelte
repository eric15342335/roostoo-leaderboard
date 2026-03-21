<script>
  import { GREEN, RED, BLUE, ORANGE, MUTED, CARD_BG, BORDER, TEXT, PURPLE } from "$lib/theme.js";
  import { summaryStats } from "$lib/transform.js";

  /** @type {{ lbRows: import('$lib/transform.js').LbEntry[], orderRows: import('$lib/transform.js').OrderRow[], meta: any }} */
  let { lbRows, orderRows, meta } = $props();

  let stats = $derived(summaryStats(lbRows, orderRows));
</script>

<div class="card">
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
    <span class="key">Scraped at</span>
    <span class="val">{new Date(meta.scrapedAt).toUTCString()}</span>
  </div>
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
    <span class="val"
      >${stats.totalVolume.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span
    >
  </div>
  <div class="row">
    <span class="key">Total Commission</span>
    <span
      class="val"
      style="color:{ORANGE}"
      >${stats.totalCommission.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span
    >
  </div>
  <div class="row">
    <span class="key">Avg P&L</span>
    <span
      class="val"
      style="color:{stats.avgProfitPct >= 0 ? GREEN : RED}"
    >
      {stats.avgProfitPct >= 0 ? "+" : ""}{stats.avgProfitPct.toFixed(4)}%
    </span>
  </div>
  <div class="row">
    <span class="key">Best Team</span>
    <span
      class="val"
      style="color:{GREEN}"
    >
      {stats.bestTeam.team}
      ({stats.bestTeam.profitPct >= 0 ? "+" : ""}{stats.bestTeam.profitPct.toFixed(4)}%)
    </span>
  </div>
  <div class="row">
    <span class="key">Worst Team</span>
    <span
      class="val"
      style="color:{RED}"
    >
      {stats.worstTeam.team}
      ({stats.worstTeam.profitPct >= 0 ? "+" : ""}{stats.worstTeam.profitPct.toFixed(4)}%)
    </span>
  </div>
  <div class="row">
    <span class="key">HK Teams</span>
    <span
      class="val"
      style="color:{BLUE}">{stats.hkCount}</span
    >
  </div>
  {#if stats.hkBestTeam}
    <div class="row">
      <span class="key">HK Best Team</span>
      <span
        class="val"
        style="color:{BLUE}"
      >
        {stats.hkBestTeam.team}
        ({stats.hkBestTeam.profitPct >= 0 ? "+" : ""}{stats.hkBestTeam.profitPct.toFixed(4)}%)
      </span>
    </div>
    <div class="row">
      <span class="key">HK Avg P&amp;L</span>
      <span
        class="val"
        style="color:{stats.hkAvgProfitPct >= 0 ? BLUE : RED}"
      >
        {stats.hkAvgProfitPct >= 0 ? "+" : ""}{stats.hkAvgProfitPct.toFixed(4)}%
      </span>
    </div>
  {/if}
  <div class="row">
    <span class="key">SG Teams</span>
    <span
      class="val"
      style="color:{GREEN}">{stats.sgCount}</span
    >
  </div>
  {#if stats.sgBestTeam}
    <div class="row">
      <span class="key">SG Best Team</span>
      <span
        class="val"
        style="color:{GREEN}"
      >
        {stats.sgBestTeam.team}
        ({stats.sgBestTeam.profitPct >= 0 ? "+" : ""}{stats.sgBestTeam.profitPct.toFixed(4)}%)
      </span>
    </div>
    <div class="row">
      <span class="key">SG Avg P&amp;L</span>
      <span
        class="val"
        style="color:{stats.sgAvgProfitPct >= 0 ? GREEN : RED}"
      >
        {stats.sgAvgProfitPct >= 0 ? "+" : ""}{stats.sgAvgProfitPct.toFixed(4)}%
      </span>
    </div>
  {/if}
  {#if stats.participantCount - stats.hkCount - stats.sgCount > 0}
    <div class="row">
      <span class="key">Other</span>
      <span
        class="val"
        style="color:{PURPLE}">{stats.participantCount - stats.hkCount - stats.sgCount}</span
      >
    </div>
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
