import {
  LAYOUT_BASE,
  BLUE,
  BORDER,
  CARD_BG,
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

async function plot(el: HTMLElement, traces: any[], layout: any) {
  const Plotly = (await import("./plotly-custom.js")).default;
  (Plotly as any).react(el, traces, { ...LAYOUT_BASE, ...layout }, cfg);
  return Plotly;
}

export async function chartLeaderboard(el: HTMLElement, rows: LbEntry[]) {
  const sorted = [...rows].sort((a, b) => a.profitPct - b.profitPct);
  const vals = sorted.map((r) => r.profitPct);
  const height = Math.max(480, rows.length * 22 + 110);
  return plot(
    el,
    [
      {
        type: "bar",
        orientation: "h",
        x: vals,
        y: sorted.map((r) => r.team),
        marker: {
          color: vals.map((v) => (v >= 0 ? GREEN : RED)),
          line: { color: BORDER, width: 0.5 },
        },
        text: vals.map((v) => `${v >= 0 ? "+" : ""}${v.toFixed(4)}%`),
        textposition: "auto",
        textfont: { size: 8, color: TEXT },
        hovertemplate: "<b>%{y}</b><br>P&L: %{x:.4f}%<extra></extra>",
      },
    ],
    {
      title: { text: "Portfolio Return (%) by Team", font: { size: 14, color: TEXT } },
      height,
      margin: { l: 220, r: 80, t: 50, b: 60 },
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
  const sorted = [...rows].sort((a, b) => a.tradeVolume - b.tradeVolume);
  const height = Math.max(480, rows.length * 22 + 110);
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
      margin: { l: 220, r: 80, t: 50, b: 60 },
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
    .sort((a, b) => b.buyCount + b.sellCount - (a.buyCount + a.sellCount))
    .slice(0, 20);
  const height = Math.max(480, sorted.length * 22 + 110);
  return plot(
    el,
    [
      {
        type: "bar",
        name: "BUY",
        orientation: "h",
        x: sorted.map((r) => r.buyCount),
        y: sorted.map((r) => r.team),
        marker: { color: GREEN, line: { color: BORDER, width: 0.3 } },
        hovertemplate: "<b>%{y}</b><br>BUY: %{x}<extra></extra>",
      },
      {
        type: "bar",
        name: "SELL",
        orientation: "h",
        x: sorted.map((r) => r.sellCount),
        y: sorted.map((r) => r.team),
        marker: { color: RED, line: { color: BORDER, width: 0.3 } },
        hovertemplate: "<b>%{y}</b><br>SELL: %{x}<extra></extra>",
      },
    ],
    {
      title: { text: "Filled Orders — Buy vs Sell Count by Team", font: { size: 14, color: TEXT } },
      height,
      margin: { l: 220, r: 80, t: 50, b: 60 },
      barmode: "stack",
      xaxis: xaxis({ title: "Filled Order Count" }),
      yaxis: yaxis({ title: "" }),
      legend: { bgcolor: CARD_BG, bordercolor: BORDER, font: { color: TEXT, size: 10 } },
    }
  );
}

export async function chartCancelled(el: HTMLElement, rows: LbEntry[]) {
  const sorted = [...rows]
    .filter((r) => r.cancelledCount > 0)
    .sort((a, b) => b.cancelledCount - a.cancelledCount)
    .slice(0, 20);
  const height = Math.max(300, sorted.length * 22 + 110);
  return plot(
    el,
    [
      {
        type: "bar",
        orientation: "h",
        x: sorted.map((r) => r.cancelledCount),
        y: sorted.map((r) => r.team),
        marker: { color: ORANGE, line: { color: BORDER, width: 0.3 } },
        hovertemplate: "<b>%{y}</b><br>Cancelled: %{x}<extra></extra>",
      },
    ],
    {
      title: {
        text: "Cancelled Orders by Team",
        font: { size: 14, color: TEXT },
      },
      height,
      margin: { l: 220, r: 80, t: 50, b: 60 },
      xaxis: xaxis({ title: "Cancelled Order Count" }),
      yaxis: yaxis({ title: "" }),
    }
  );
}

export async function chartTopPairs(el: HTMLElement, rows: OrderRow[]) {
  const pairs = topPairs(rows, 15);
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
      title: { text: "Top 15 Trading Pairs by Volume", font: { size: 14, color: TEXT } },
      height: 420,
      margin: { l: 60, r: 30, t: 50, b: 110 },
      xaxis: xaxis({ title: "Trading Pair", tickangle: -35, automargin: true }),
      yaxis: yaxis({ title: "Notional Volume (USD)", tickformat: "$,.0f" }),
      showlegend: false,
    }
  );
}

export async function chartCoinPnl(el: HTMLElement, rows: CoinProfitRow[]) {
  const agg = coinPnlAggregate(rows);
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

export async function chartHeatmap(el: HTMLElement, rows: CoinProfitRow[]) {
  const { teams, coins, z } = heatmapPivot(rows, 20);
  const maxAbs = Math.max(...z.flat().map(Math.abs), 1);
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
          [0.5, CARD_BG],
          [1, GREEN],
        ],
        zmid: 0,
        zmin: -maxAbs,
        zmax: maxAbs,
        text: z.map((row) => row.map((v) => `${v >= 0 ? "+" : ""}${v.toFixed(0)}`)),
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
      title: { text: "Per-Coin P&L Heatmap by Team (Top 20)", font: { size: 14, color: TEXT } },
      height: 700,
      xaxis: xaxis({ title: "Coin", tickangle: -45, tickfont: { size: 9 } }),
      yaxis: yaxis({ title: "", tickfont: { size: 9 } }),
    }
  );
}

export async function chartOrderTiming(el: HTMLElement, rows: OrderRow[]) {
  const byHour = ordersByHour(rows);
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
        hovertemplate: "Hour %{x}:00 UTC<br>Orders: %{y}<extra></extra>",
      },
    ],
    {
      title: { text: "Order Activity by Hour (UTC)", font: { size: 14, color: TEXT } },
      height: 340,
      xaxis: xaxis({ title: "Hour (UTC)", tickmode: "linear", dtick: 1 }),
      yaxis: yaxis({ title: "Order Count" }),
      showlegend: false,
    }
  );
}

export async function chartOrderSizeDist(el: HTMLElement, rows: OrderRow[]) {
  return plot(
    el,
    [
      {
        type: "histogram",
        x: rows.map((r) => r.notionalUsd),
        nbinsx: 40,
        marker: { color: BLUE, line: { color: BORDER, width: 0.3 }, opacity: 0.85 },
        hovertemplate: "Size: $%{x:,.0f}<br>Count: %{y}<extra></extra>",
      },
    ],
    {
      title: { text: "Order Size Distribution (USD Notional)", font: { size: 14, color: TEXT } },
      height: 340,
      xaxis: xaxis({ title: "Order Size (USD)", tickformat: "$,.0f" }),
      yaxis: yaxis({ title: "Frequency" }),
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
        text: "Commission Cost vs Profit % (HK=Blue, SG=Green)",
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

  const countries = breakdown.map((d) => d.country);
  const colors = countries.map((c) => (c === "HK" ? BLUE : GREEN));

  // Show best, average, and median profit % as grouped bars — same unit, comparable scale
  const series = [
    { name: "Best Profit %", values: breakdown.map((d) => d.bestProfitPct) },
    { name: "Avg Profit %", values: breakdown.map((d) => d.avgProfitPct) },
    { name: "Median Profit %", values: breakdown.map((d) => d.medianProfitPct) },
  ];

  const traces = series.map((s, si) => ({
    type: "bar",
    name: s.name,
    x: countries,
    y: s.values,
    text: s.values.map((v) => `${v >= 0 ? "+" : ""}${v.toFixed(4)}%`),
    textposition: "outside",
    textfont: { size: 10, color: TEXT },
    marker: {
      color: colors,
      opacity: 1 - si * 0.2,
      line: { color: BORDER, width: 0.5 },
    },
    hovertemplate: `<b>%{x}</b><br>${s.name}: %{text}<extra></extra>`,
  }));

  return plot(el, traces, {
    title: {
      text: "HK vs SG - Profit % Comparison (Best / Avg / Median)",
      font: { size: 14, color: TEXT },
    },
    height: 420,
    barmode: "group",
    margin: { l: 60, r: 30, t: 50, b: 80 },
    xaxis: xaxis({ title: "Region" }),
    yaxis: yaxis({
      title: "Profit %",
      tickformat: ".3f",
      zeroline: true,
      zerolinewidth: 1.5,
      zerolinecolor: MUTED,
    }),
    legend: { bgcolor: CARD_BG, bordercolor: BORDER, font: { color: TEXT, size: 10 } },
    annotations: breakdown.map((d) => ({
      x: d.country,
      y: -0.18,
      xref: "x",
      yref: "paper",
      text: `n=${d.count} | vol $${(d.totalVolume / 1e6).toFixed(1)}M | ${d.totalOrders} orders`,
      showarrow: false,
      font: { size: 9, color: MUTED },
    })),
  });
}

export async function chartOrderTimingByCountry(el: HTMLElement, orderRows: OrderRow[]) {
  const { ordersByHourByCountry } = await import("./transform.js");
  const byHour = ordersByHourByCountry(orderRows);
  const countries = ["HK", "SG"].filter((c) => byHour.some((h) => h[c] > 0));
  const colorMap: Record<string, string> = { HK: BLUE, SG: GREEN };

  const traces = countries.map((c) => ({
    type: "bar",
    name: c,
    x: byHour.map((h) => h.hour),
    y: byHour.map((h) => h[c] ?? 0),
    marker: { color: colorMap[c], opacity: 0.85, line: { color: BORDER, width: 0.3 } },
    hovertemplate: `${c} - Hour %{x}:00 UTC<br>Orders: %{y}<extra></extra>`,
  }));

  return plot(el, traces, {
    title: { text: "Order Activity by Hour (UTC) - HK vs SG", font: { size: 14, color: TEXT } },
    height: 450,
    barmode: "group",
    xaxis: xaxis({ title: "Hour (UTC)", tickmode: "linear", dtick: 1 }),
    yaxis: yaxis({ title: "Order Count" }),
    legend: { bgcolor: CARD_BG, bordercolor: BORDER, font: { color: TEXT, size: 10 } },
  });
}

export async function chartCoinPnlByCountry(el: HTMLElement, coinRows: CoinProfitRow[]) {
  const { coinPnlByCountry } = await import("./transform.js");
  const { rows, countries } = coinPnlByCountry(coinRows);
  const topRows = rows.slice(0, 15) as Array<{ coin: string; total: number; [k: string]: any }>;
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
      text: "Coin P&L by Region - HK vs SG (Top 15 Coins)",
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
