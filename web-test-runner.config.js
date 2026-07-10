// Real browser (default: local Chromium via puppeteer, auto-downloaded on first
// run). No jsdom — these components rely on real live regions, focus, and
// (later) ElementInternals that jsdom fakes or omits.
export default {
  files: "src/**/*.test.js",
  nodeResolve: true,
};
