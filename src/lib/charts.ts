import {
  LAYOUT_BASE,
  BLUE,
  BORDER,
  CARD_BG,
  DARK_BG,
  CYAN,
  GREEN,
  MUTED,
  ORANGE,
  PURPLE,
  RED,
  TEXT,
  COUNTRY_COLORS,
  xaxis,
  yaxis,
} from "./theme.js";
import {
  topPairs,
  coinPnlAggregate,
  ordersByHour,
  heatmapPivot,
  type LbEntry,
  type OrderRow,
  type CoinProfitRow,
} from "./transform.js";

const cfg = { displayModeBar: true, displaylogo: false, responsive: true };

async function plot(
  el: HTMLElement,
  traces: any[],
  layout: any,
  extraCfg: Record<string, unknown> = {}
) {
  const Plotly = (await import("./plotly-custom.js")).default;
  (Plotly as any).react(el, traces, { ...LAYOUT_BASE, ...layout }, { ...cfg, ...extraCfg });
  return Plotly;
}

export async function chartLeaderboard(el: HTMLElement, rows: LbEntry[]) {
  const sorted = [...rows].sort((a, b) => a.profitPct - b.profitPct);

  const multiRegion = new Set(rows.map((r) => r.country)).size > 1;
  const overallRank = new Map(
    [...rows].sort((a, b) => b.profitPct - a.profitPct).map((r, i) => [r.team, i + 1])
  );

  // Separate 0% teams and collapse them into one bar
  const zeroTeams = sorted.filter((r) => r.profitPct === 0);
  const nonZero = sorted.filter((r) => r.profitPct !== 0);

  type BarRow = { label: string; val: number; color: string; text: string; cd: any; htmpl: string };
  const barRows: BarRow[] = nonZero.map((r) => ({
    label: r.team,
    val: r.profitPct,
    color: r.profitPct >= 0 ? GREEN : RED,
    text: `${r.profitPct >= 0 ? "+" : ""}${parseFloat(r.profitPct.toFixed(4))}%`,
    cd: [overallRank.get(r.team), r.country, r.rank, null],
    htmpl: multiRegion
      ? "<b>%{y}</b><br>P&L: %{x:.4f}%<br>Overall Rank: #%{customdata[0]}<br>%{customdata[1]} Rank: #%{customdata[2]}<extra></extra>"
      : "<b>%{y}</b><br>P&L: %{x:.4f}%<br>%{customdata[1]} Rank: #%{customdata[2]}<extra></extra>",
  }));

  if (zeroTeams.length > 0) {
    const insertAt = barRows.findIndex((r) => r.val > 0);
    const idx = insertAt === -1 ? barRows.length : insertAt;
    const label =
      zeroTeams.length === 1 ? `${zeroTeams[0].team} (0%)` : `${zeroTeams.length} teams (0%)`;
    const teamList = zeroTeams.map((r) => r.team).join("<br>");
    barRows.splice(idx, 0, {
      label,
      val: 0,
      color: MUTED,
      text: "0%",
      cd: [null, null, null, teamList],
      htmpl:
        zeroTeams.length === 1
          ? "<b>%{y}</b><br>P&L: 0%<extra></extra>"
          : `<b>${zeroTeams.length} teams at 0%</b><br>%{customdata[3]}<extra></extra>`,
    });
  }

  const vals = barRows.map((r) => r.val);
  const maxAbs = Math.max(...vals.map(Math.abs), 0.0001);
  const textpositions = vals.map((v) => (Math.abs(v) / maxAbs < 0.15 ? "outside" : "inside"));
  const height = (nonZero.length + (zeroTeams.length > 0 ? 1 : 0)) * 30 + 110;

  return plot(
    el,
    [
      {
        type: "bar",
        orientation: "h",
        x: vals,
        y: barRows.map((r) => r.label),
        marker: {
          color: barRows.map((r) => r.color),
          line: { color: BORDER, width: 0.5 },
        },
        text: barRows.map((r) => r.text),
        textposition: textpositions,
        textfont: { size: 8, color: TEXT },
        customdata: barRows.map((r) => r.cd),
        hovertemplate: barRows.map((r) => r.htmpl),
      },
    ],
    {
      title: { text: "Portfolio Return (%) by Team", font: { size: 14, color: TEXT } },
      height,
      margin: { l: 130, r: 30, t: 50, b: 60 },
      xaxis: xaxis({
        title: "Profit %",
        tickformat: ".3f",
        zeroline: true,
        zerolinewidth: 1.5,
        zerolinecolor: MUTED,
      }),
      yaxis: yaxis({ title: "" }),
      showlegend: false,
    }
  );
}

export async function chartVolume(el: HTMLElement, rows: LbEntry[]) {
  const sorted = [...rows].sort((a, b) => a.tradeVolume - b.tradeVolume).slice(-20);
  const height = sorted.length * 30 + 110;
  return plot(
    el,
    [
      {
        type: "bar",
        orientation: "h",
        x: sorted.map((r) => r.tradeVolume),
        y: sorted.map((r) => r.team),
        marker: {
          color: sorted.map((r) => COUNTRY_COLORS[r.country] ?? PURPLE),
          line: { color: BORDER, width: 0.5 },
        },
        text: sorted.map((r) => `$${(r.tradeVolume / 1e3).toFixed(1)}K`),
        textposition: "auto",
        textfont: { size: 8, color: TEXT },
        hovertemplate: "<b>%{y}</b><br>Volume: $%{x:,.0f}<extra></extra>",
      },
    ],
    {
      title: { text: "Total Trade Volume (USD) by Team", font: { size: 14, color: TEXT } },
      height,
      margin: { l: 130, r: 30, t: 50, b: 60 },
      xaxis: xaxis({ title: "Volume (USD)", tickformat: "$,.0f" }),
      yaxis: yaxis({ title: "" }),
      showlegend: false,
      annotations: [
        {
          x: 0.98,
          y: 0.02,
          xref: "paper",
          yref: "paper",
          text: "Blue=HK  Green=SG",
          showarrow: false,
          font: { size: 9, color: MUTED },
        },
      ],
    }
  );
}

export async function chartBuySell(el: HTMLElement, rows: LbEntry[]) {
  const sorted = [...rows]
    .filter((r) => r.buyCount + r.sellCount > 0)
    .sort((a, b) => a.rank - b.rank);
  return plot(
    el,
    [
      {
        type: "scatter",
        mode: "markers+text",
        x: sorted.map((r) => r.buyCount),
        y: sorted.map((r) => r.sellCount),
        text: sorted.map((r) => r.team.split("(")[0].trim().slice(0, 14)),
        textposition: "top center",
        textfont: { size: 8, color: MUTED },
        marker: {
          size: 12,
          color: sorted.map((r) => COUNTRY_COLORS[r.country] ?? PURPLE),
          line: { color: BORDER, width: 1 },
        },
        hovertemplate: "<b>%{customdata}</b><br>Buy: %{x}<br>Sell: %{y}<extra></extra>",
        customdata: sorted.map((r) => r.team),
      },
    ],
    {
      title: {
        text: "Buy vs Sell Order Count",
        font: { size: 14, color: TEXT },
      },
      height: Math.max(400, Math.min(rows.length, 20) * 22 + 110),
      xaxis: xaxis({ title: "Buy Order Count" }),
      yaxis: yaxis({ title: "Sell Order Count" }),
      showlegend: false,
    }
  );
}

export async function chartCancelled(el: HTMLElement, rows: LbEntry[]) {
  const sorted = [...rows]
    .filter((r) => r.cancelledCount > 0)
    .sort((a, b) => b.cancelledCount - a.cancelledCount)
    .slice(0, 20);
  const height = Math.max(400, sorted.length * 22 + 110);
  return plot(
    el,
    [
      {
        type: "bar",
        orientation: "h",
        x: sorted.map((r) => r.cancelledCount),
        y: sorted.map((r) => r.team),
        marker: { color: ORANGE, line: { color: BORDER, width: 0.3 } },
        text: sorted.map((r) => r.cancelledCount.toLocaleString()),
        textposition: "outside",
        textfont: { size: 9, color: TEXT },
        hovertemplate: "<b>%{y}</b><br>Cancelled: %{x}<extra></extra>",
      },
    ],
    {
      title: {
        text: "Cancelled Orders by Team",
        font: { size: 14, color: TEXT },
      },
      height,
      margin: { l: 130, r: 30, t: 50, b: 60 },
      xaxis: xaxis({ title: "Cancelled Order Count" }),
      yaxis: yaxis({ title: "" }),
    }
  );
}

export async function chartTopPairs(el: HTMLElement, rows: OrderRow[]) {
  const pairs = topPairs(rows, 20);
  return plot(
    el,
    [
      {
        type: "bar",
        x: pairs.map((p) => p.pair),
        y: pairs.map((p) => p.volume),
        marker: {
          color: pairs.map((p) => p.count),
          colorscale: [
            [0, CARD_BG],
            [0.3, BLUE],
            [1, PURPLE],
          ],
          showscale: true,
          colorbar: {
            title: { text: "Order Count", font: { color: MUTED, size: 10 } },
            tickfont: { color: MUTED, size: 9 },
            bgcolor: CARD_BG,
            bordercolor: BORDER,
          },
          line: { color: BORDER, width: 0.5 },
        },
        text: pairs.map((p) => `$${(p.volume / 1e3).toFixed(0)}K`),
        textposition: "outside",
        textfont: { size: 9, color: TEXT },
        hovertemplate:
          "<b>%{x}</b><br>Volume: $%{y:,.0f}<br>Orders: %{marker.color}<extra></extra>",
      },
    ],
    {
      title: { text: "Top 20 Trading Pairs by Volume", font: { size: 14, color: TEXT } },
      height: 420,
      margin: { l: 90, r: 30, t: 50, b: 30 },
      xaxis: xaxis({ title: "Trading Pair", tickangle: -35, automargin: true }),
      yaxis: yaxis({ title: "Notional Volume (USD)", tickformat: "$,.0f" }),
      showlegend: false,
    }
  );
}

export async function chartCoinPnl(el: HTMLElement, rows: CoinProfitRow[]) {
  const agg = coinPnlAggregate(rows).sort((a, b) => a.coin.localeCompare(b.coin));
  const profits = agg.map((a) => a.netProfit);
  return plot(
    el,
    [
      {
        type: "bar",
        x: agg.map((a) => a.coin),
        y: profits,
        marker: {
          color: profits.map((v) => (v >= 0 ? GREEN : RED)),
          line: { color: BORDER, width: 0.4 },
        },
        text: profits.map((v) => `${v >= 0 ? "+" : ""}${v.toFixed(0)}`),
        textposition: "outside",
        textfont: { size: 8, color: TEXT },
        hovertemplate: "<b>%{x}</b><br>Net P&L: $%{y:+,.2f}<br>Teams: %{customdata}<extra></extra>",
        customdata: agg.map((a) => a.teamCount),
      },
    ],
    {
      title: { text: "Aggregate P&L by Coin (USD)", font: { size: 14, color: TEXT } },
      height: 420,
      xaxis: xaxis({ title: "Coin", tickangle: -45 }),
      yaxis: yaxis({
        title: "Net Profit (USD)",
        tickformat: "$,.0f",
        zeroline: true,
        zerolinewidth: 1.5,
        zerolinecolor: MUTED,
      }),
      showlegend: false,
    }
  );
}

export async function chartHeatmap(el: HTMLElement, rows: CoinProfitRow[], lbRows?: LbEntry[]) {
  const { teams: unsortedTeams, coins: unsortedCoins, z: unsortedZ } = heatmapPivot(rows);

  const roiByTeam = new Map(lbRows?.map((r) => [r.team, r.profitPct]) ?? []);
  const teams = [...unsortedTeams].sort(
    (a, b) => (roiByTeam.get(a) ?? 0) - (roiByTeam.get(b) ?? 0)
  );
  const teamSortedZ = teams.map((t) => unsortedZ[unsortedTeams.indexOf(t)]);

  const sortedIdx = unsortedCoins
    .map((_, i) => i)
    .sort((a, b) => unsortedCoins[a].localeCompare(unsortedCoins[b]));
  const coins = sortedIdx.map((i) => unsortedCoins[i]);
  const z = teamSortedZ.map((row) => sortedIdx.map((i) => row[i]));
  const nonZero = z
    .flat()
    .filter((v) => v !== 0)
    .map(Math.abs)
    .sort((a, b) => a - b);
  const clampAbs = nonZero[Math.floor(nonZero.length * 0.75)] ?? 1;
  return plot(
    el,
    [
      {
        type: "heatmap",
        z,
        x: coins,
        y: teams,
        colorscale: [
          [0, RED],
          [0.5, DARK_BG],
          [1, GREEN],
        ],
        zmid: 0,
        zmin: -clampAbs,
        zmax: clampAbs,
        text: z.map((row) =>
          row.map((v) => (v === 0 ? "" : `${v >= 0 ? "+" : ""}${v.toFixed(0)}`))
        ),
        texttemplate: "%{text}",
        textfont: { size: 8 },
        hovertemplate: "<b>%{y}</b> | %{x}<br>P&L: $%{z:+,.2f}<extra></extra>",
        colorbar: {
          title: { text: "P&L (USD)", font: { color: MUTED, size: 10 } },
          tickfont: { color: MUTED, size: 9 },
          bgcolor: CARD_BG,
          bordercolor: BORDER,
          tickformat: "$,.0f",
        },
      },
    ],
    {
      title: {
        text: "Per-Coin P&L Heatmap",
        font: { size: 14, color: TEXT },
        yref: "container",
        y: 1,
        yanchor: "top",
        pad: { t: 16 },
      },
      height: teams.length * 20,
      margin: { l: 90, r: 30, t: 80, b: 30 },
      xaxis: xaxis({
        title: "Coin",
        tickangle: -45,
        tickfont: { size: 9 },
        side: "top",
      }),
      yaxis: yaxis({ title: "", tickfont: { size: 9 } }),
    }
  );
}

export async function chartOrderTiming(el: HTMLElement, rows: OrderRow[]) {
  const utcOffset = -new Date().getTimezoneOffset() / 60;
  const tzLabel =
    new Intl.DateTimeFormat("en", { timeZoneName: "short" })
      .formatToParts(Date.now())
      .find((p) => p.type === "timeZoneName")?.value ?? "Local";

  const rawByHour = ordersByHour(rows);
  const localCounts = new Array(24).fill(0);
  for (const { hour, count } of rawByHour) localCounts[(hour + utcOffset + 24) % 24] += count;
  const byHour = localCounts.map((count, hour) => ({ hour, count })).filter((x) => x.count > 0);

  const counts = byHour.map((h) => h.count);
  return plot(
    el,
    [
      {
        type: "bar",
        x: byHour.map((h) => h.hour),
        y: counts,
        marker: {
          color: counts,
          colorscale: [
            [0, CARD_BG],
            [0.5, BLUE],
            [1, CYAN],
          ],
          line: { color: BORDER, width: 0.4 },
        },
        hovertemplate: `Hour %{x}:00 ${tzLabel}<br>Orders: %{y}<extra></extra>`,
      },
    ],
    {
      title: { text: `Order Activity by Hour (${tzLabel})`, font: { size: 14, color: TEXT } },
      height: 400,
      margin: { l: 60, r: 30, t: 50, b: 40 },
      xaxis: xaxis({ title: `Hour (${tzLabel})`, tickmode: "linear", dtick: 1, automargin: false }),
      yaxis: yaxis({ title: "Order Count" }),
      showlegend: false,
    }
  );
}

export async function chartVolumeVsFills(el: HTMLElement, rows: LbEntry[]) {
  const sorted = [...rows].sort((a, b) => a.rank - b.rank);
  return plot(
    el,
    [
      {
        type: "scatter",
        mode: "markers+text",
        x: sorted.map((r) => r.tradeVolume),
        y: sorted.map((r) => r.buyCount + r.sellCount),
        text: sorted.map((r) => r.team.split("(")[0].trim().slice(0, 14)),
        textposition: "top center",
        textfont: { size: 8, color: MUTED },
        marker: {
          size: 12,
          color: sorted.map((r) => COUNTRY_COLORS[r.country] ?? PURPLE),
          line: { color: BORDER, width: 1 },
        },
        hovertemplate: "<b>%{customdata}</b><br>Volume: $%{x:,.0f}<br>Filled: %{y}<extra></extra>",
        customdata: sorted.map((r) => r.team),
      },
    ],
    {
      title: {
        text: "Trade Volume vs Filled Orders",
        font: { size: 14, color: TEXT },
      },
      height: 400,
      xaxis: xaxis({ title: "Trade Volume (USD)", tickformat: "$,.0f" }),
      yaxis: yaxis({ title: "Total Filled Orders (Buy + Sell)" }),
      showlegend: false,
    }
  );
}

export async function chartCommission(el: HTMLElement, rows: LbEntry[]) {
  const sorted = [...rows].sort((a, b) => a.rank - b.rank);
  return plot(
    el,
    [
      {
        type: "scatter",
        mode: "markers+text",
        x: sorted.map((r) => r.totalCommission),
        y: sorted.map((r) => r.profitPct),
        text: sorted.map((r) => r.team.split("(")[0].trim().slice(0, 14)),
        textposition: "top center",
        textfont: { size: 8, color: MUTED },
        marker: {
          size: 12,
          color: sorted.map((r) => COUNTRY_COLORS[r.country] ?? PURPLE),
          line: { color: BORDER, width: 1 },
        },
        hovertemplate:
          "<b>%{customdata}</b><br>Commission: $%{x:,.2f}<br>Profit: %{y:.4f}%<extra></extra>",
        customdata: sorted.map((r) => r.team),
      },
    ],
    {
      title: {
        text: "Commission Cost vs Profit %",
        font: { size: 14, color: TEXT },
      },
      height: 400,
      xaxis: xaxis({ title: "Total Commission Paid (USD)", tickformat: "$,.0f" }),
      yaxis: yaxis({
        title: "Profit %",
        tickformat: ".3f",
        zeroline: true,
        zerolinewidth: 1,
        zerolinecolor: MUTED,
      }),
      showlegend: false,
    }
  );
}

export async function chartActivityVsProfit(el: HTMLElement, rows: LbEntry[]) {
  const sorted = [...rows].sort((a, b) => a.rank - b.rank);
  const maxVol = Math.max(...sorted.map((r) => r.tradeVolume));
  return plot(
    el,
    [
      {
        type: "scatter",
        mode: "markers+text",
        x: sorted.map((r) => r.orderCount),
        y: sorted.map((r) => r.profitPct),
        text: sorted.map((r) => `#${r.rank}`),
        textposition: "top center",
        textfont: { size: 9, color: MUTED },
        marker: {
          size: sorted.map((r) => 8 + (r.tradeVolume / maxVol) * 30),
          color: sorted.map((r) => COUNTRY_COLORS[r.country] ?? PURPLE),
          line: { color: BORDER, width: 1 },
        },
        hovertemplate: "<b>%{customdata}</b><br>Orders: %{x}<br>Profit: %{y:.4f}%<extra></extra>",
        customdata: sorted.map((r) => r.team),
      },
    ],
    {
      title: { text: "Order Count vs Profit % (bubble=volume)", font: { size: 14, color: TEXT } },
      height: 400,
      xaxis: xaxis({ title: "Total Orders Placed" }),
      yaxis: yaxis({
        title: "Profit %",
        tickformat: ".3f",
        zeroline: true,
        zerolinewidth: 1,
        zerolinecolor: MUTED,
      }),
      showlegend: false,
    }
  );
}

export async function chartHkVsSgOverview(el: HTMLElement, lbRows: LbEntry[]) {
  const { countryBreakdown } = await import("./transform.js");
  const breakdown = countryBreakdown(lbRows).filter(
    (d) => d.country === "HK" || d.country === "SG"
  );
  if (breakdown.length < 2) return;

  const metrics = [
    { name: "Best Profit %", key: "bestProfitPct" as const },
    { name: "Avg Profit %", key: "avgProfitPct" as const },
    { name: "Median Profit %", key: "medianProfitPct" as const },
  ];

  const traces = breakdown.map((d) => ({
    type: "bar",
    name: d.country,
    x: metrics.map((m) => m.name),
    y: metrics.map((m) => d[m.key]),
    text: metrics.map((m) => {
      const v = d[m.key];
      return `${v >= 0 ? "+" : ""}${v.toFixed(4)}%`;
    }),
    textposition: "outside",
    textfont: { size: 10, color: TEXT },
    marker: {
      color: d.country === "HK" ? BLUE : GREEN,
      line: { color: BORDER, width: 0.5 },
    },
    hovertemplate: `<b>${d.country}</b><br>%{x}: %{text}<extra></extra>`,
  }));

  return plot(el, traces, {
    title: {
      text: "Profit % Comparison (Best / Avg / Median) - HK vs SG",
      font: { size: 14, color: TEXT },
    },
    height: 450,
    barmode: "group",
    margin: { l: 70, r: 20, t: 60, b: 60 },
    xaxis: xaxis({ title: "Region" }),
    yaxis: yaxis({
      title: "Profit %",
      tickformat: ".3f",
      zeroline: true,
      zerolinewidth: 1.5,
      zerolinecolor: MUTED,
    }),
    legend: { bgcolor: CARD_BG, bordercolor: BORDER, font: { color: TEXT, size: 10 } },
  });
}

export async function chartOrderTimingByCountry(el: HTMLElement, orderRows: OrderRow[]) {
  const utcOffset = -new Date().getTimezoneOffset() / 60;
  const tzLabel =
    new Intl.DateTimeFormat("en", { timeZoneName: "short" })
      .formatToParts(Date.now())
      .find((p) => p.type === "timeZoneName")?.value ?? "Local";

  const { ordersByHourByCountry } = await import("./transform.js");
  const rawByHour = ordersByHourByCountry(orderRows);
  const countries = ["HK", "SG"].filter((c) => rawByHour.some((h) => h[c] > 0));

  // Shift UTC hours to local for each country
  const localMap: Record<string, number[]> = Object.fromEntries(
    countries.map((c) => [c, new Array(24).fill(0)])
  );
  for (const entry of rawByHour) {
    const localHour = (entry.hour + utcOffset + 24) % 24;
    for (const c of countries) localMap[c][localHour] += entry[c] ?? 0;
  }
  const byHour: Array<{ hour: number } & Record<string, number>> = Array.from(
    { length: 24 },
    (_, hour) => ({
      hour,
      ...Object.fromEntries(countries.map((c) => [c, localMap[c][hour]])),
    })
  ).filter((e: { hour: number } & Record<string, number>) => countries.some((c) => e[c] > 0));

  const colorMap: Record<string, string> = { HK: BLUE, SG: GREEN };
  const traces = countries.map((c) => ({
    type: "bar",
    name: c,
    x: byHour.map((h) => h.hour),
    y: byHour.map((h) => h[c] ?? 0),
    marker: { color: colorMap[c], opacity: 0.85, line: { color: BORDER, width: 0.3 } },
    hovertemplate: `${c} - Hour %{x}:00 ${tzLabel}<br>Orders: %{y}<extra></extra>`,
  }));

  return plot(el, traces, {
    title: {
      text: `Order Activity by Hour (${tzLabel}) - HK vs SG`,
      font: { size: 14, color: TEXT },
    },
    height: 450,
    barmode: "group",
    xaxis: xaxis({ title: `Hour (${tzLabel})`, tickmode: "linear", dtick: 1 }),
    yaxis: yaxis({ title: "Order Count" }),
    legend: { bgcolor: CARD_BG, bordercolor: BORDER, font: { color: TEXT, size: 10 } },
  });
}

export async function chartCoinPnlByCountry(el: HTMLElement, coinRows: CoinProfitRow[]) {
  const { coinPnlByCountry } = await import("./transform.js");
  const { rows, countries } = coinPnlByCountry(coinRows);
  const topRows = (rows as Array<{ coin: string; total: number; [k: string]: any }>).sort((a, b) =>
    a.coin.localeCompare(b.coin)
  );
  const colorMap: Record<string, string> = { HK: BLUE, SG: GREEN };

  const traces = ["HK", "SG"]
    .filter((c) => countries.includes(c))
    .map((c) => ({
      type: "bar",
      name: c,
      x: topRows.map((r) => r.coin),
      y: topRows.map((r) => r[c] ?? 0),
      marker: {
        color: topRows.map((r) => ((r[c] ?? 0) >= 0 ? colorMap[c] : RED)),
        opacity: 0.85,
        line: { color: BORDER, width: 0.3 },
      },
      text: topRows.map((r) => {
        const v = r[c] ?? 0;
        return `${v >= 0 ? "+" : ""}${v.toFixed(0)}`;
      }),
      textposition: "outside",
      textfont: { size: 7, color: TEXT },
      hovertemplate: `${c} - <b>%{x}</b><br>P&L: $%{y:+,.2f}<extra></extra>`,
    }));

  return plot(el, traces, {
    title: {
      text: "Coin P&L by Region - HK vs SG",
      font: { size: 14, color: TEXT },
    },
    height: 450,
    barmode: "group",
    xaxis: xaxis({ title: "Coin", tickangle: -35, automargin: true }),
    yaxis: yaxis({
      title: "Net Profit (USD)",
      tickformat: "$,.0f",
      zeroline: true,
      zerolinewidth: 1.5,
      zerolinecolor: MUTED,
    }),
    legend: { bgcolor: CARD_BG, bordercolor: BORDER, font: { color: TEXT, size: 10 } },
  });
}
