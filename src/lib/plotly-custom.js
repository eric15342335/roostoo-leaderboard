// Minimal Plotly build - only the 4 trace types used by this app.
// Lets Rollup see the module graph and split into parallel H2 chunks
// instead of emitting the monolithic plotly.js-dist-min bundle.
import Plotly from "plotly.js/lib/core";
import Bar from "plotly.js/lib/bar";
import Scatter from "plotly.js/lib/scatter";
import Histogram from "plotly.js/lib/histogram";
import Heatmap from "plotly.js/lib/heatmap";

Plotly.register([Bar, Scatter, Histogram, Heatmap]);

export default Plotly;
