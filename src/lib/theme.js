export const DARK_BG = "#0d1117";
export const CARD_BG = "#161b22";
export const BORDER = "#30363d";
export const TEXT = "#e6edf3";
export const MUTED = "#8b949e";
export const GREEN = "#3fb950";
export const RED = "#f85149";
export const BLUE = "#58a6ff";
export const ORANGE = "#d29922";
export const PURPLE = "#bc8cff";
export const CYAN = "#39d353";

export const COUNTRY_COLORS = { HK: BLUE, SG: GREEN };

export const AXIS_BASE = {
  gridcolor: BORDER,
  linecolor: BORDER,
  zerolinecolor: BORDER,
  automargin: true,
  tickfont: { size: 10, color: TEXT },
};

export const LAYOUT_BASE = {
  paper_bgcolor: DARK_BG,
  plot_bgcolor: CARD_BG,
  font: {
    family: '"Geist Sans", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    color: TEXT,
    size: 11,
  },
  margin: { l: 60, r: 30, t: 50, b: 60 },
};

/** @param {Record<string,unknown>} overrides */
export const xaxis = (overrides = {}) => ({ ...AXIS_BASE, ...overrides });

/** @param {Record<string,unknown>} overrides */
export const yaxis = (overrides = {}) => ({ ...AXIS_BASE, ...overrides });
