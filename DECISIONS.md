# vel — Design System Decisions

A vanilla, web-components design system built to be used equally well by humans and AI,
with accessibility (government/WCAG-grade) baked in, not bolted on.

Prefix: `vel-` for elements, `--vel-` for tokens.

---

## Stack

- **No framework runtime ships.** Client demands vanilla (his whole site is built on `<template>`).
  Turbo/Hotwire, Astro islands, React, etc. all *consume* the components — they aren't required by them.
- **CSS:** native + custom properties for tokens, `@layer` for cascade control and per-client override. No Sass.
- **JS:** light-DOM custom elements, vanilla `extends HTMLElement`. Lit only if reactive-template boilerplate
  ever hurts (deferred — PE-style components have little templating, so it rarely will).
- **Types:** JSDoc + `tsc --noEmit` (`checkJs`). Ship source, **no transpile** — the browser runs the authored
  `.js`. JSDoc doubles as the manifest source. Real `.ts` is a reversible call if JSDoc gets verbose; output is
  identical vanilla either way.
- **Build:** none for dev (native ES modules + import map + any static server). A distribution build exists
  later only for bundle/minify/`.d.ts`/CEM — **that build is not transpilation.**

## Architecture spine — "HTML web components"

- Custom elements that **enhance server-rendered HTML** (progressive enhancement). The HTML is complete and
  accessible *before* JS runs. Government acceptance criteria fall out of this for free.
- **The custom-element lifecycle IS the wiring** (`connectedCallback`). No custom init/registry/scanner.
  Works with Turbo swaps, Astro hydration, and dynamic insertion automatically.
- **Styled-only things (button, badge, card) are a CSS class, NOT a component.** Something becomes a custom
  element only when it has state / keyboard / ARIA behavior.
- **Light DOM, not shadow DOM** — for cross-root ARIA, form participation, legibility/inspectability, and AI
  authoring. Add shadow DOM only if a specific component proves it needs style isolation.
- **Form controls are form-associated custom elements** (`ElementInternals`, `formAssociated = true`) so they
  submit and validate. Non-optional for form-heavy (government) work.

## API philosophy (humans + AI)

- **Attributes-first, declarative, reflected.** `<vel-combobox multiple clearable>` — not `new Combobox(el, {...})`.
  Mirrors the platform (`<details open>`). AI emits HTML well and forgets JS config shapes; humans read markup.
- Methods for imperative needs (`.open()`, `.value`); events for output (`vel-change`).

## Single source of truth

- **Custom Elements Manifest (CEM)**, generated from JSDoc, feeds three consumers:
  1. docs site, 2. TS types / `.d.ts` + editor autocomplete, 3. MCP server.
- **MCP (deferred, thin wrapper over the CEM):** `get_component`, `list_tokens`, `validate_markup`.
  Keeps AI grounded in the *current versioned* API instead of a stale training snapshot. Build the manifest
  first (wanted for docs+types anyway); MCP falls out as ~a few hundred lines.

## Tokens

- Semantic, flat, guessable names (`--vel-color-surface`, `--vel-space-4`).
- Ship a **complete neutral look**; reskin per client by overriding token values in a `@layer`.
  "Of course it looks like it belongs to you" = the token layer, nothing more.

## Repo layout

- **Every component is a folder** `src/<name>/` — style-only ones included, because the folder is the
  unit a vendoring consumer copies. Interactive → `.css` + `.js`. Style-only (button, badge) → just `.css`.
  Never a loose `component.css` mixed with infra.
- **Loose top-level files are base + aggregates only:** `tokens.css` (base), `vel.css` / `index.js` (all-in aggregates).
- **`utilities/`** holds cross-cutting classes (`.vel-sr-only`, focus-ring). Base — taken alongside tokens.
- A component may depend on the **base** (tokens, utilities) — a normal shared dependency every consumer takes.
  A component must **never** depend on another component. Nothing imports outside `src/`.
- Cascade: `@layer tokens, components, utilities;` (utilities win). `vel.css` declares the order. Style-only
  primitives share the `components` layer for now — add a `primitives` layer only if a real conflict appears.

## Bundling / distribution

- The granular `src/` + `@import`/ESM graph is the **authoring + vendoring source, NOT the prod artifact.**
  `@import` chains waterfall (serial, render-blocking) — they must never reach prod.
- `vel.css` / `index.js` are **dev/all-in aggregates** (one link, unoptimized). Fine for dev/demo; not the prod story.
- **Prod = a concat+minify build** → one `vel.min.css` + one `vel.min.js`, one request each. Default for most
  consumers. A build, but concatenation — not transpilation.
- **"Load only what you need"** = a tailored subset bundle (build picks components → one optimized file) or
  cherry-picked `<link>`s / per-component built files (parallel) — never nested `@import`.
- Build nothing until component count or a real consumer makes it pay. Decide the model now; keep authoring granular.

## Accessibility priorities (from-scratch, 2026)

What's actually worth learning/building — the platform has NOT solved the top two:

1. **Live regions** (toast, status) — announce without moving focus. `role="status"` (polite) / `role="alert"`
   (assertive). SC 4.1.3 Status Messages. The hard edge is a toast with an Undo action.
2. **Roving tabindex + `aria-activedescendant`** (menu, tabs, combobox) — the two "have focus" techniques.
3. **Modality judgment** → reach for `<dialog>` / `popover` / `inert`. Test: *does the background need to go
   inert until this is dealt with?* Yes → modal (dialog family). No → ambient (popover/menu/inline).
4. **Focus-trap mechanics** — the platform owns it (`<dialog showModal>` + `inert`). Near-zero learning value;
   understand `inert` once, never hand-roll the old Tab-wrapping hack.

Notes:
- APG patterns are the interaction spec — implement, don't invent.
- A "focus trap" is only legal because it has an exit (SC 2.1.2). Modal = a loop *with* a guaranteed exit.
- **Modal off-canvas menu = `<dialog showModal>`**, animated with `@starting-style` + `transition-behavior:
  allow-discrete` (removes the old reason to hand-roll drawers). A **persistent** sidebar is just layout, not a dialog.
- Toast must NOT move or trap focus — its whole lesson is restraint.

## Build order

1. **Toast** — live region, no focus movement. Highest learning-per-line for the stated a11y gap.
2. **Menu button** — roving tabindex, move-and-restore, Escape-returns-to-trigger.
3. **Combobox** — `aria-activedescendant`. Later; the hardest.
- Plus a small **focus-loss utility** (delete-in-list / route change → move focus to a sensible neighbor).
  A ~5-line reused utility, not a component.

## Deferred / non-goals

- Not building a framework — design system only.
- Shadow DOM — only on proven need.
- Lit — only when vanilla templating hurts.
- MCP server — after the CEM exists.
- Heavy data-heavy widget — an island / revisit when reached.
