# Tango Trainer

A **teach-first** trainer for the LinkedIn *Tango* logic puzzle (Sun & Moon). The
LinkedIn game only tells you *"you broke a rule."* This app **shows** it:
it highlights the exact cells, animates the conflict, names the rule, and
explains — graphically and in words — **what** is wrong, **why**, and **how** to fix it.

- **No framework.** Plain HTML + Tailwind CSS + vanilla ES-module JavaScript.
- **Dark mode only.** Everything is a modal — the app never leaves `index.html`.
- **Fully offline.** Every dependency (Motion, Lucide, fonts) is vendored under `/vendor`.

> **Status: complete (Phase 9).** All nine phases are done. This final phase added a
> timer, move & mistake counters, per-size/per-difficulty personal bests (assisted wins
> excluded), a strict-mode toggle, an in-app statistics view, a full How-to-play guide,
> and the self-contained **single-file build** (`dist/tango-trainer.html`, ~750 KB) that
> opens by double-click and runs fully offline — verified with **zero external requests**.

## Requirements

- Node.js 18+ (developed on Node 22)

## Setup

```bash
npm install       # dev dependencies (Tailwind, Motion, Lucide, fonts)
npm run vendor    # copy Motion, Lucide, and fonts into /vendor (offline assets)
npm run build:css # compile Tailwind → dist/app.css
```

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Vendor assets, then run Tailwind watch **and** a static dev server together (http://localhost:5173) |
| `npm run vendor` | Copy runtime deps from `node_modules` into `/vendor` |
| `npm run build:css` | One-off Tailwind build → `dist/app.css` |
| `npm run watch:css` | Tailwind in watch mode |
| `npm run serve` | Zero-dependency static server (set `PORT` to override) |
| `npm run build` | Vendor + Tailwind build |
| `npm run build:single` | Produce `dist/tango-trainer.html`, a self-contained single-file build (bundled with esbuild, fonts inlined as base64) |
| `npm test` | Run the Node test suite (71 tests: rules, solver, generator, lessons, import) |

Then open http://localhost:5173.

## Technology & hard constraints

| Concern | Choice |
|---|---|
| Markup | One `index.html`, HTML5 |
| Styling | Tailwind CSS (v3) built via the Tailwind CLI; tokens as CSS variables in `src/css/input.css` |
| Logic | Vanilla JavaScript, ES modules, **no runtime bundler** (dev serves raw modules; esbuild is used only at build time to produce the single-file offline build) |
| Animation | [Motion](https://motion.dev) — the vanilla/DOM library (`window.Motion`). **Never** `framer-motion`. |
| Icons | [Lucide](https://lucide.dev) UMD build (`window.lucide`). **Never** `lucide-react`. |
| Fonts | Self-hosted (offline): **Fraunces** (display), **IBM Plex Sans** (body), **IBM Plex Mono** (data) |
| Theme | Dark only — `<html class="dark">` is hard-coded; no light styles exist |
| Dialogs | Modals only; the app never navigates away |

## Architecture

```
index.html            # shell: header, board column, explanation panel, roots for modals/toasts
src/css/input.css     # design tokens (CSS vars) + @font-face + base/component styles
src/js/
  main.js             # bootstrap + wiring + keyboard shortcuts
  board.js            # grid model + cell/cycling helpers (pure, no DOM)
  state.js            # single source of truth: grid, locks, unlimited undo/redo, events
  render.js           # interactive board view (input, keyboard nav, animated repaint)
  rules.js            # validation → structured Violation objects (all four rules)
  explain.js          # THE explanation engine: violation → full animated + textual treatment
  solver.js           # logical solver (named techniques) + uniqueness backtracking
  hints.js            # graded hint ladder built on the solver
  generator.js        # seeded unique-solution generation + difficulty targeting
  puzzle-service.js   # async generation: Web Worker (8×8/10×10) + sync fallback
  worker.js           # Web Worker entry that runs the generator off-thread
  puzzles.js          # verified fixtures (used by tests)
  lessons.js          # tutorial lesson data (DOM-free, unit-tested)
  tutorial.js         # tutorial runner: scripted lessons, graduation, replay menu
  import.js           # import editor (transcribe a board) + validation
  import-check.js     # DOM-free import validation (unit-tested)
  autosolve.js        # reveal solution + step-by-step logical replay
  storage.js          # localStorage stats + personal bests
  export.js           # in-app "download the game" (single-file)
  icons.js            # Lucide init wrapper
  animate.js          # every Motion call; honours prefers-reduced-motion
  modal.js            # stacking modal system (focus trap, ESC, backdrop, confirm dialog)
  toast.js            # transient one-line feedback
  rulebook.js         # single source of truth for rule text + mini demos
scripts/
  vendor.mjs          # copies Motion + Lucide + fonts into /vendor
  serve.mjs           # static dev server
vendor/               # committed offline assets (motion.min.js, lucide.min.js, fonts/)
dist/                 # Tailwind output (app.css) + single-file build (Phase 9)
```

### Design system

Colors live as **RGB-channel** CSS variables in `src/css/input.css`
(`--c-sun: 242 169 59;`) and are exposed to Tailwind via
`rgb(var(--c-sun) / <alpha-value>)`, so opacity modifiers like `bg-sun/90` work.
Red (`violation`) is reserved **only** for rule breaks; green (`confirm`) **only**
for confirmations.

## Roadmap (build phases)

1. ✅ Scaffold, theme, modal system, shell
2. ✅ Board model, cell cycling, locks, undo/redo, clear, mirror toggle
3. ✅ `rules.js` — structured violation detection + tests
4. ✅ The explanation engine (board highlight + SVG geometry + rule cards + mini-diagrams)
5. ✅ Solver with named techniques + graded hint ladder
6. ✅ Generator, uniqueness verification, difficulty tiers, Web Worker for 8×8/10×10
7. ✅ Tutorial mode
8. ✅ Import, auto-solve, step-by-step replay, cheat mode
9. ✅ Stats, single-file export, full docs, polish

### Extending later

- **Add a solver technique:** implement it in `solver.js` as a named deduction returning
  the cell(s) it forces and the reason, then register it in the technique list used by
  difficulty tiers and hints.
- **Add a tutorial lesson:** append a scripted lesson (goal, board, enabled interactions,
  coaching steps) to `tutorial.js`; each lesson uses a distinct board.

## License

Private / unpublished.
