import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [sveltekit()],
  define: {
    // plotly.js source references the Node.js `global` object.
    // Map it to the browser-standard globalThis at build time.
    global: "globalThis",
  },
  build: {
    // plotly-custom.js is dynamically imported, so Plotly never blocks the app shell.
    // manualChunks splits it into 4 parallel HTTP/2 chunks (~d3 121K, traces 74K,
    // components 67K, core 902K). chunkSizeWarningLimit reflects vendor-plotly-core.
    chunkSizeWarningLimit: 960,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/@plotly/d3")) return "vendor-plotly-d3";
          if (
            id.includes("node_modules/plotly.js/src/traces/") ||
            id.includes("node_modules/plotly.js/lib/bar") ||
            id.includes("node_modules/plotly.js/lib/scatter") ||
            id.includes("node_modules/plotly.js/lib/histogram") ||
            id.includes("node_modules/plotly.js/lib/heatmap")
          )
            return "vendor-plotly-traces";
          if (id.includes("node_modules/plotly.js/src/components/"))
            return "vendor-plotly-components";
          if (
            id.includes("node_modules/plotly.js/") ||
            id.includes("node_modules/plotly.js-dist-min/")
          )
            return "vendor-plotly-core";
          if (id.includes("node_modules/@sveltejs/kit/") || id.includes("node_modules/svelte/"))
            return "vendor-svelte";
        },
      },
    },
  },
});
