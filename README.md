# vel

vel is a web-components design system. Components enhance server-rendered HTML and run as authored source in the browser. This document covers the toolchain, local development, testing, and vendoring. See `DECISIONS.md` for the reasoning behind the architecture.

## Requirements

- Node.js (current LTS) and npm, for the development toolchain.
- The published components need only a browser. The toolchain below is for development and never ships.

## Toolchain

All tooling installs as dev dependencies and produces development artifacts only.

- **Custom Elements Manifest analyzer** (`@custom-elements-manifest/analyzer`) reads the JSDoc across `src/` and writes `custom-elements.json`. That manifest is the source of truth for the showcase site, editor types, and a future MCP server. `custom-elements.json` is committed and regenerated with `npm run manifest`.
- **TypeScript** (`tsc --noEmit` with `checkJs`) type-checks the JSDoc against usage. It emits no files.
- **@web/test-runner with @open-wc/testing** runs `*.test.js` specs in a real browser. `@open-wc/testing` supplies element fixtures and axe-based accessibility assertions.
- **Astro with @astrojs/mdx** serves the showcase and reference site under `docs/`. The dev server provides hot reloading; the build produces a static site.

## Commands

| Command                  | Action                                               |
| ------------------------ | ---------------------------------------------------- |
| `npm install`            | Install the development toolchain.                   |
| `npm run dev`            | Start the Astro showcase with hot reloading.         |
| `npm run test`           | Run the browser test suite once.                     |
| `npm run test:watch`     | Run the test suite in watch mode.                    |
| `npm run typecheck`      | Type-check the JSDoc with `tsc --noEmit`.            |
| `npm run manifest`       | Generate `custom-elements.json` from the JSDoc.      |
| `npm run manifest:watch` | Regenerate the manifest on change.                   |
| `npm run docs:build`     | Build the static showcase site into `dist/`.         |
| `npm run check`          | Run `manifest`, `typecheck`, and `test` in sequence. |

## Develop

1. Install once: `npm install`.
2. Start the showcase: `npm run dev`, then open the printed URL. Showcase pages live in `docs/pages/`; component source lives in `src/<name>/`.
3. Edit a component. Changes to CSS and to showcase pages update live. Changes to a component's JavaScript trigger a full page reload, because a custom element registers once per page.
4. After changing a public API or its JSDoc, run `npm run manifest` (or keep `npm run manifest:watch` running), then `npm run typecheck`.

### Adding a component

1. Create a folder `src/<name>/` with a `.css` file. Add a `.js` file when the component has state, keyboard, or ARIA behavior.
2. For an interactive component, add its module to `src/index.js` so it registers, and add its `@import` to `src/vel.css`. For a style-only component, add only the `@import` to `src/vel.css`.
3. Document the public API in JSDoc (`@element`, `@attr`, `@fires`, `@param`) so the manifest and types stay complete.

## Test

Specs live beside their component as `src/<name>/<name>.test.js` and run in a real browser. A real browser is required because the components depend on live regions, focus handling, timers, and, for form-associated components, `ElementInternals`.

- `npm run test` runs every spec once. The first run downloads a Chromium build.
- `npm run test:watch` reruns specs on change.

A spec mounts an element with `fixture`, exercises its API, and asserts behavior. `expect(el).to.be.accessible()` runs axe against the mounted element.

## Vendor

Components are distributed as source. Two consumption paths exist.

### All-in aggregates

For development and small sites, link the CSS aggregate and load the JS aggregate:

```html
<link rel="stylesheet" href="vel/src/vel.css" />
<script type="module" src="vel/src/index.js"></script>
```

`vel.css` declares the cascade order `@layer tokens, components, utilities;` and imports the base plus every component. `index.js` imports every component module, each of which registers itself. The aggregates load their `@import` graph serially, which suits development. A concatenated and minified distribution build is planned for production use (see `DECISIONS.md`).

### Individual components

Copy the component folder into the consuming project and take the base alongside it. The base is `src/tokens.css` and `src/utilities/utilities.css`. A component may depend on the base. A component never depends on another component.

Declare the cascade order once in the page, then link the base and the component. A style-only component needs its `.css`. An interactive component needs its `.css` and its `.js`. Adjust the paths below to match where the files are placed.

```html
<style>
	@layer tokens, components, utilities;
</style>
<link rel="stylesheet" href="vel/tokens.css" />
<link rel="stylesheet" href="vel/utilities/utilities.css" />
<link rel="stylesheet" href="vel/toast/vel-toaster.css" />
<script type="module" src="vel/toast/vel-toaster.js"></script>
```

### Reskinning

Override token values in a `@layer tokens` block. Overriding an intent seed such as `--vel-color-accent` recomputes its derived roles (hover, surface, border, strong).

Reach for token overrides first. When a component needs styling that tokens cannot express, overriding the component's own CSS is acceptable and correct. Write rules against the component's selectors and place them in unlayered CSS, or in a layer declared after `utilities`, so they win the cascade.

## Repo layout

```
src/
  tokens.css                 base: design tokens
  utilities/utilities.css    base: cross-cutting classes (.vel-sr-only)
  button/button.css          style-only component
  toast/
    vel-toaster.css
    vel-toaster.js
    vel-toaster.test.js
  vel.css                    aggregate: cascade order, imports base + components
  index.js                   aggregate: imports every self-registering component
docs/pages/                  Astro showcase and reference (MDX)
custom-elements.json         generated from JSDoc, committed
```
