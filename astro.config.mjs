import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";

// Showcase/reference site lives in ./docs so it never mixes with component src/.
// `npm run dev` = the live HMR harness; `npm run docs:build` = the static site.
export default defineConfig({
  srcDir: "./docs",
  integrations: [mdx()],
});
