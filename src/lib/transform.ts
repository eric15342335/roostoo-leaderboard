export interface LbEntry {
  rank: number;
  team: string;
  country: string;
  profitPct: number;
  currBal: number;
  tradeVolume: number;
  orderCount: number;
  totalCommission: number;
  buyCount: number;
  sellCount: number;
  cancelledCount: number;
}

export interface OrderRow {
  team: string;
  rank: number;
  country: string;
  coin: string;
  pair: string;
  side: string;
  notionalUsd: number;
  commissionUsd: number;
  createTsMs: number;
  hourUtc: number;
}

export interface CoinProfitRow {
  team: string;
  rank: number;
  country: string;
  coin: string;
  totalProfit: number;
  coinLeft: number;
  estimatedPrice: number;
  totalTradeAmount: number;
  positionValueUsd: number;
}

function teamLabel(name: string) {
  return name.length <= 28 ? name : name.slice(0, 25) + "...";
}

// raw profit: 0.012 = 1.2%
function scaleProfitPct(v: number) {
  return Math.abs(v) < 10 ? v * 100 : v;
}

/**
 * @param {{ compRaw: any, results: any[] }} raw
 * @returns {{ lbRows: LbEntry[], orderRows: OrderRow[], coinRows: CoinProfitRow[], meta: any }}
 */
export function transform({ compRaw, results }: { compRaw: any; results: any[] }) {
  const lbRows: LbEntry[] = [];
  const orderRows: OrderRow[] = [];
  const coinRows: CoinProfitRow[] = [];

  for (const { entry, portfolio, orders } of results) {
    const rank = entry.Rank;
    const team = teamLabel(entry.DisplayName);
    const country = entry.CountryCode;
    const profitPct = scaleProfitPct(entry.Profit);

    const entryOrders = orders?.OrderMatched ?? [];
    let totalCommission = 0;
    let buyCount = 0;
    let sellCount = 0;
    let cancelledCount = 0;

    for (const o of entryOrders) {
      if (!o.FilledAverPrice) {
        cancelledCount++;
        continue;
      }
      const notional = o.FilledQuantity * o.FilledAverPrice;
      const comm = notional * o.CommissionPercent;
      totalCommission += comm;
      if (o.Side === "BUY") buyCount++;
      else sellCount++;

      const hkDate = new Date(o.CreateTimestamp);
      orderRows.push({
        team,
        rank,
        country,
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
      orderCount: entryOrders.length - cancelledCount,
      totalCommission,
      buyCount,
      sellCount,
      cancelledCount,
    });

    for (const cp of portfolio?.CoinProfit ?? []) {
      coinRows.push({
        team,
        rank,
        country,
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

  const hkName = compRaw?.hk?.CptName ?? compRaw?.CptName ?? "HK Round 1";
  const sgName = compRaw?.sg?.CptName ?? "SG Round 1";
  const meta = {
    scrapedAt: new Date().toISOString(),
    competitionName: hkName + " + " + sgName,
    hkCompetitionName: hkName,
    sgCompetitionName: sgName,
    participantCount: lbRows.length,
  };

  return { lbRows, orderRows, coinRows, meta };
}

export function topPairs(rows: OrderRow[], n = 15) {
  const m = new Map<string, { volume: number; count: number }>();
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

export function coinPnlAggregate(rows: CoinProfitRow[]) {
  const m = new Map<string, { netProfit: number; totalTraded: number; teamCount: number }>();
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

export function ordersByHour(rows: OrderRow[]) {
  const counts: number[] = new Array(24).fill(0);
  for (const r of rows) counts[r.hourUtc]++;
  return counts.map((count, hour) => ({ hour, count })).filter((x) => x.count > 0);
}

export function heatmapPivot(rows: CoinProfitRow[]) {
  const teams = [...new Set(rows.map((r) => r.team))];
  const allCoins = [...new Set(rows.map((r) => r.coin))];

  const lookup = new Map(rows.map((r) => [`${r.team}|${r.coin}`, r.totalProfit]));

  const activeCoins = allCoins
    .map((coin) => ({
      coin,
      activity: rows
        .filter((r) => r.coin === coin)
        .reduce((s, r) => s + Math.abs(r.totalProfit), 0),
    }))
    .filter((x) => x.activity > 0)
    .sort((a, b) => b.activity - a.activity)
    .map((x) => x.coin);

  const z = teams.map((team) => activeCoins.map((coin) => lookup.get(`${team}|${coin}`) ?? 0));

  return { teams, coins: activeCoins, z };
}

export function summaryStats(rows: LbEntry[], orderRows: OrderRow[]) {
  const sorted = [...rows].sort((a, b) => b.profitPct - a.profitPct);
  const hkRows = rows.filter((r) => r.country === "HK");
  const sgRows = rows.filter((r) => r.country === "SG");
  const hkSorted = [...hkRows].sort((a, b) => b.profitPct - a.profitPct);
  const sgSorted = [...sgRows].sort((a, b) => b.profitPct - a.profitPct);
  const totalVolume = rows.reduce((s, r) => s + r.tradeVolume, 0);
  const totalCommission = rows.reduce((s, r) => s + r.totalCommission, 0);
  return {
    participantCount: rows.length,
    totalOrders: orderRows.length,
    totalVolume,
    totalCommission,
    commissionPct: totalVolume > 0 ? (totalCommission / totalVolume) * 100 : 0,
    avgProfitPct: rows.reduce((s, r) => s + r.profitPct, 0) / rows.length,
    bestTeam: sorted[0],
    worstTeam: sorted[sorted.length - 1],
    hkCount: hkRows.length,
    sgCount: sgRows.length,
    hkAvgProfitPct: hkRows.length ? hkRows.reduce((s, r) => s + r.profitPct, 0) / hkRows.length : 0,
    sgAvgProfitPct: sgRows.length ? sgRows.reduce((s, r) => s + r.profitPct, 0) / sgRows.length : 0,
    hkBestTeam: hkSorted[0] ?? null,
    sgBestTeam: sgSorted[0] ?? null,
    hkTotalVolume: hkRows.reduce((s, r) => s + r.tradeVolume, 0),
    sgTotalVolume: sgRows.reduce((s, r) => s + r.tradeVolume, 0),
    hkTotalOrders: hkRows.reduce((s, r) => s + r.orderCount, 0),
    sgTotalOrders: sgRows.reduce((s, r) => s + r.orderCount, 0),
  };
}

export function countryBreakdown(lbRows: LbEntry[]) {
  const m = new Map<string, { teams: LbEntry[] }>();
  for (const r of lbRows) {
    if (!m.has(r.country)) m.set(r.country, { teams: [] });
    m.get(r.country)!.teams.push(r);
  }
  return [...m.entries()].map(([country, { teams }]) => {
    const sorted = [...teams].sort((a, b) => b.profitPct - a.profitPct);
    return {
      country,
      count: teams.length,
      avgProfitPct: teams.reduce((s, t) => s + t.profitPct, 0) / teams.length,
      medianProfitPct: sorted[Math.floor(sorted.length / 2)]?.profitPct ?? 0,
      bestProfitPct: sorted[0]?.profitPct ?? 0,
      totalVolume: teams.reduce((s, t) => s + t.tradeVolume, 0),
      avgVolume: teams.reduce((s, t) => s + t.tradeVolume, 0) / teams.length,
      totalOrders: teams.reduce((s, t) => s + t.orderCount, 0),
      avgOrders: teams.reduce((s, t) => s + t.orderCount, 0) / teams.length,
      totalCommission: teams.reduce((s, t) => s + t.totalCommission, 0),
      profitPcts: sorted.map((t) => t.profitPct),
    };
  });
}

export function ordersByHourByCountry(
  orderRows: OrderRow[]
): Array<{ hour: number; [k: string]: number }> {
  const countries = [...new Set(orderRows.map((r) => r.country))].filter(Boolean);
  const m = new Map(countries.map((c) => [c, new Array(24).fill(0) as number[]]));
  for (const r of orderRows) {
    const arr = r.country ? m.get(r.country) : undefined;
    if (arr) arr[r.hourUtc]++;
  }
  return Array.from({ length: 24 }, (_, hour) => {
    const entry: { hour: number; [k: string]: number } = { hour };
    for (const [c, counts] of m) entry[c] = counts[hour];
    return entry;
  }).filter((e) => countries.some((c) => e[c] > 0));
}

export function coinPnlByCountry(coinRows: CoinProfitRow[]) {
  const countries = [...new Set(coinRows.map((r) => r.country))].filter(Boolean);
  const coins = [...new Set(coinRows.map((r) => r.coin))];
  const m = new Map(coins.map((coin) => [coin, new Map(countries.map((c) => [c, 0]))]));
  const totalByCountry: Record<string, number> = Object.fromEntries(countries.map((c) => [c, 0]));
  for (const r of coinRows) {
    if (r.country && m.has(r.coin)) {
      const coinMap = m.get(r.coin);
      if (coinMap) coinMap.set(r.country, (coinMap.get(r.country) ?? 0) + r.totalProfit);
    }
    if (r.country)
      totalByCountry[r.country] = (totalByCountry[r.country] ?? 0) + Math.abs(r.totalProfit);
  }
  const sorted = [...m.entries()]
    .map(([coin, byCountry]) => ({
      coin,
      ...Object.fromEntries(byCountry),
      total: [...byCountry.values()].reduce((s, v) => s + Math.abs(v), 0),
    }))
    .filter((e) => e.total > 0)
    .sort((a, b) => b.total - a.total);
  return { rows: sorted, countries };
}

export function topPairsByCountry(orderRows: OrderRow[], n = 15) {
  const countries = [...new Set(orderRows.map((r) => r.country))].filter(Boolean);
  const m = new Map<string, Map<string, number>>();
  for (const r of orderRows) {
    if (!m.has(r.pair)) m.set(r.pair, new Map(countries.map((c) => [c, 0])));
    const byCountry = m.get(r.pair)!;
    byCountry.set(r.country, (byCountry.get(r.country) ?? 0) + r.notionalUsd);
  }
  return [...m.entries()]
    .map(([pair, byCountry]) => {
      const total = [...byCountry.values()].reduce((s, v) => s + v, 0);
      return { pair, total, ...Object.fromEntries(byCountry) };
    })
    .sort((a, b) => b.total - a.total)
    .slice(0, n);
}
