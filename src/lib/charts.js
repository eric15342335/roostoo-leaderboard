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
import { topPairs, coinPnlAggregate, ordersByHour, heatmapPivot } from "./transform.js";

const cfg = { displayModeBar: true, displaylogo: false, responsive: true };

/** @param {HTMLElement} el @param {any[]} traces @param {any} layout */
async function plot(el, traces, layout) {
  const Plotly = (await import("plotly.js-dist-min")).default;
  Plotly.react(el, traces, { ...LAYOUT_BASE, ...layout }, cfg);
  return Plotly;
}

/** @param {HTMLElement} el @param {import('./transform.js').LbEntry[]} rows */
export async function chartLeaderboard(el, rows) {
  const sorted = [...rows].sort((a, b) => a.profitPct - b.profitPct);
  const vals = sorted.map((r) => r.profitPct);
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
        textposition: "outside",
        textfont: { size: 9, color: TEXT },
        hovertemplate: "<b>%{y}</b><br>P&L: %{x:.4f}%<extra></extra>",
      },
    ],
    {
      title: { text: "Portfolio Return (%) by Team", font: { size: 14, color: TEXT } },
      height: 520,
      margin: { l: 220, r: 90, t: 50, b: 60 },
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

/** @param {HTMLElement} el @param {import('./transform.js').LbEntry[]} rows */
export async function chartVolume(el, rows) {
  const sorted = [...rows].sort((a, b) => a.tradeVolume - b.tradeVolume);
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
        textposition: "outside",
        textfont: { size: 9, color: TEXT },
        hovertemplate: "<b>%{y}</b><br>Volume: $%{x:,.0f}<extra></extra>",
      },
    ],
    {
      title: { text: "Total Trade Volume (USD) by Team", font: { size: 14, color: TEXT } },
      height: 520,
      margin: { l: 220, r: 90, t: 50, b: 60 },
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

/** @param {HTMLElement} el @param {import('./transform.js').LbEntry[]} rows */
export async function chartBuySell(el, rows) {
  const sorted = [...rows].sort((a, b) => a.rank - b.rank);
  return plot(
    el,
    [
      {
        type: "bar",
        name: "BUY",
        x: sorted.map((r) => r.team),
        y: sorted.map((r) => r.buyCount),
        marker: { color: GREEN, line: { color: BORDER, width: 0.3 } },
        hovertemplate: "<b>%{x}</b><br>BUY: %{y}<extra></extra>",
      },
      {
        type: "bar",
        name: "SELL",
        x: sorted.map((r) => r.team),
        y: sorted.map((r) => r.sellCount),
        marker: { color: RED, line: { color: BORDER, width: 0.3 } },
        hovertemplate: "<b>%{x}</b><br>SELL: %{y}<extra></extra>",
      },
    ],
    {
      title: { text: "Buy vs Sell Order Count by Team", font: { size: 14, color: TEXT } },
      height: 460,
      margin: { l: 60, r: 30, t: 50, b: 140 },
      barmode: "group",
      xaxis: xaxis({ title: "", tickangle: -45, tickfont: { size: 9 }, automargin: true }),
      yaxis: yaxis({ title: "Order Count" }),
      legend: { bgcolor: CARD_BG, bordercolor: BORDER, font: { color: TEXT, size: 10 } },
    }
  );
}

/** @param {HTMLElement} el @param {import('./transform.js').OrderRow[]} rows */
export async function chartTopPairs(el, rows) {
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

/** @param {HTMLElement} el @param {import('./transform.js').CoinProfitRow[]} rows */
export async function chartCoinPnl(el, rows) {
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

/** @param {HTMLElement} el @param {import('./transform.js').CoinProfitRow[]} rows */
export async function chartHeatmap(el, rows) {
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
      height: 520,
      xaxis: xaxis({ title: "Coin", tickangle: -45, tickfont: { size: 9 } }),
      yaxis: yaxis({ title: "", tickfont: { size: 9 } }),
    }
  );
}

/** @param {HTMLElement} el @param {import('./transform.js').OrderRow[]} rows */
export async function chartOrderTiming(el, rows) {
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

/** @param {HTMLElement} el @param {import('./transform.js').OrderRow[]} rows */
export async function chartOrderSizeDist(el, rows) {
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

/** @param {HTMLElement} el @param {import('./transform.js').LbEntry[]} rows */
export async function chartCommission(el, rows) {
  const sorted = [...rows].sort((a, b) => a.rank - b.rank);
  return plot(
    el,
    [
      {
        type: "scatter",
        mode: "markers+text",
        x: sorted.map((r) => r.totalCommission),
        y: sorted.map((r) => r.profitPct),
        text: sorted.map((r) => r.team.split("(")[0].trim().slice(0, 12)),
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
        text: "Commission Cost vs Profit % (Blue=HK, Green=SG)",
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

/** @param {HTMLElement} el @param {import('./transform.js').LbEntry[]} rows */
export async function chartActivityVsProfit(el, rows) {
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
