/**
 * @typedef {Object} LbEntry
 * @property {number} rank
 * @property {string} team
 * @property {string} country
 * @property {number} profitPct
 * @property {number} currBal
 * @property {number} tradeVolume
 * @property {number} orderCount
 * @property {number} totalCommission
 * @property {number} buyCount
 * @property {number} sellCount
 */

/**
 * @typedef {Object} OrderRow
 * @property {string} team
 * @property {number} rank
 * @property {string} coin
 * @property {string} pair
 * @property {string} side
 * @property {number} notionalUsd
 * @property {number} commissionUsd
 * @property {number} createTsMs
 * @property {number} hourUtc
 */

/**
 * @typedef {Object} CoinProfitRow
 * @property {string} team
 * @property {number} rank
 * @property {string} coin
 * @property {number} totalProfit
 * @property {number} coinLeft
 * @property {number} estimatedPrice
 * @property {number} totalTradeAmount
 * @property {number} positionValueUsd
 */

/** @param {string} name */
function teamLabel(name) {
  return name.length <= 28 ? name : name.slice(0, 25) + "...";
}

/** @param {number} v raw profit from API (0.012 = 1.2%) */
function scaleProfitPct(v) {
  return Math.abs(v) < 10 ? v * 100 : v;
}

/**
 * @param {{ compRaw: any, lbRaw: any, results: any[] }} raw
 * @returns {{ lbRows: LbEntry[], orderRows: OrderRow[], coinRows: CoinProfitRow[], meta: any }}
 */
export function transform({ compRaw, lbRaw, results }) {
  /** @type {LbEntry[]} */
  const lbRows = [];
  /** @type {OrderRow[]} */
  const orderRows = [];
  /** @type {CoinProfitRow[]} */
  const coinRows = [];

  for (const { entry, portfolio, orders } of results) {
    const rank = entry.Rank;
    const team = teamLabel(entry.DisplayName);
    const country = entry.CountryCode;
    const profitPct = scaleProfitPct(entry.Profit);

    const entryOrders = orders?.OrderMatched ?? [];
    let totalCommission = 0;
    let buyCount = 0;
    let sellCount = 0;

    for (const o of entryOrders) {
      const notional = o.FilledQuantity * o.FilledAverPrice;
      const comm = notional * o.CommissionPercent;
      totalCommission += comm;
      if (o.Side === "BUY") buyCount++;
      else sellCount++;

      const hkDate = new Date(o.CreateTimestamp);
      orderRows.push({
        team,
        rank,
        coin: o.Pair.split("/")[0],
        pair: o.Pair,
        side: o.Side,
        notionalUsd: notional,
        commissionUsd: comm,
        createTsMs: o.CreateTimestamp,
        hourUtc: hkDate.getUTCHours(),
      });
    }

    lbRows.push({
      rank,
      team,
      country,
      profitPct,
      currBal: entry.CurrBal,
      tradeVolume: entry.TradeVolume,
      orderCount: entryOrders.length,
      totalCommission,
      buyCount,
      sellCount,
    });

    for (const cp of portfolio?.CoinProfit ?? []) {
      coinRows.push({
        team,
        rank,
        coin: cp.Coin,
        totalProfit: cp.TotalProfit,
        coinLeft: cp.CoinLeft,
        estimatedPrice: cp.EstimatedPrice,
        totalTradeAmount: cp.TotalTradeAmount,
        positionValueUsd: cp.CoinLeft * cp.EstimatedPrice,
      });
    }
  }

  lbRows.sort((a, b) => a.rank - b.rank);

  const meta = {
    scrapedAt: new Date().toISOString(),
    competitionName: compRaw?.CptName ?? "Competition",
    participantCount: lbRows.length,
  };

  return { lbRows, orderRows, coinRows, meta };
}

/** @param {OrderRow[]} rows */
export function topPairs(rows, n = 15) {
  /** @type {Map<string, {volume: number, count: number}>} */
  const m = new Map();
  for (const r of rows) {
    const e = m.get(r.pair) ?? { volume: 0, count: 0 };
    e.volume += r.notionalUsd;
    e.count++;
    m.set(r.pair, e);
  }
  return [...m.entries()]
    .map(([pair, { volume, count }]) => ({ pair, volume, count }))
    .sort((a, b) => b.volume - a.volume)
    .slice(0, n);
}

/** @param {CoinProfitRow[]} rows */
export function coinPnlAggregate(rows) {
  /** @type {Map<string, {netProfit: number, totalTraded: number, teamCount: number}>} */
  const m = new Map();
  for (const r of rows) {
    const e = m.get(r.coin) ?? { netProfit: 0, totalTraded: 0, teamCount: 0 };
    e.netProfit += r.totalProfit;
    e.totalTraded += r.totalTradeAmount;
    e.teamCount++;
    m.set(r.coin, e);
  }
  return [...m.entries()]
    .filter(([, e]) => e.totalTraded > 0)
    .map(([coin, e]) => ({ coin, ...e }))
    .sort((a, b) => b.netProfit - a.netProfit);
}

/** @param {OrderRow[]} rows */
export function ordersByHour(rows) {
  /** @type {number[]} */
  const counts = new Array(24).fill(0);
  for (const r of rows) counts[r.hourUtc]++;
  return counts.map((count, hour) => ({ hour, count })).filter((x) => x.count > 0);
}

/**
 * Build pivot: team × coin → totalProfit, returns top N coins by activity
 * @param {CoinProfitRow[]} rows
 */
export function heatmapPivot(rows, maxCoins = 20) {
  const teams = [...new Set(rows.map((r) => r.team))];
  const allCoins = [...new Set(rows.map((r) => r.coin))];

  const lookup = new Map(rows.map((r) => [`${r.team}|${r.coin}`, r.totalProfit]));

  const coinActivity = allCoins.map((coin) => ({
    coin,
    activity: rows.filter((r) => r.coin === coin).reduce((s, r) => s + Math.abs(r.totalProfit), 0),
  }));
  const topCoins = coinActivity
    .sort((a, b) => b.activity - a.activity)
    .slice(0, maxCoins)
    .map((x) => x.coin);

  const z = teams.map((team) => topCoins.map((coin) => lookup.get(`${team}|${coin}`) ?? 0));

  return { teams, coins: topCoins, z };
}

/** @param {LbEntry[]} rows */
export function summaryStats(rows, orderRows) {
  const sorted = [...rows].sort((a, b) => b.profitPct - a.profitPct);
  return {
    participantCount: rows.length,
    totalOrders: orderRows.length,
    totalVolume: rows.reduce((s, r) => s + r.tradeVolume, 0),
    totalCommission: rows.reduce((s, r) => s + r.totalCommission, 0),
    avgProfitPct: rows.reduce((s, r) => s + r.profitPct, 0) / rows.length,
    bestTeam: sorted[0],
    worstTeam: sorted[sorted.length - 1],
    hkCount: rows.filter((r) => r.country === "HK").length,
    sgCount: rows.filter((r) => r.country === "SG").length,
  };
}
