// The explanation engine — the heart of Tango Trainer.
//
// Given the current board it computes violations (rules.js) and, for the
// selected one, produces the FULL treatment together:
//   1. Board layer    — ring + pulse the offending cells, dim the rest.
//   2. Geometry layer — an SVG shape drawn onto the board (bracket / outline /
//                        connector) plus a Balance counter chip.
//   3. Panel layer    — a rule card: rule name, rule text with the relevant
//                        clause emphasised, and an animated mini-diagram that
//                        loops wrong → fixed with ✗ / ✓ labels.
//   4. Text layer     — WHAT (headline) / WHY / HOW (fix), plain English.
//   5. Hover linking  — mini-diagram cells ↔ real board cells, both directions.
//
// There is no code path where a detected violation is shown without all of this.

import { validate } from './rules.js';
import { SUN, MOON, EMPTY, OPPOSITE, key } from './board.js';
import { animate, prefersReducedMotion } from './animate.js';
import { renderIcons } from './icons.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

export const RULE_META = {
  NO_THREE_IN_A_ROW: { n: 1, name: 'No three in a row' },
  BALANCE: { n: 2, name: 'Balance' },
  EQUALS: { n: 3, name: 'Equals ( = )' },
  CROSS: { n: 4, name: 'Cross ( × )' },
};

// Canonical rule text with the clause that this rule hinges on emphasised.
const RULE_TEXT = {
  NO_THREE_IN_A_ROW: 'No three identical symbols may sit next to each other in a line. <span class="clause-emph">Two in a row is fine — a third is not.</span>',
  BALANCE: 'Every row and every column must hold <span class="clause-emph">an equal number of Suns and Moons</span> — exactly half each.',
  EQUALS: 'Two cells joined by an “=” must hold <span class="clause-emph">the same</span> symbol.',
  CROSS: 'Two cells joined by a “×” must hold <span class="clause-emph">opposite</span> symbols.',
};

function symMarkup(sym, cls = '') {
  if (sym === SUN) return `<span class="sym sym-sun ${cls}"><i data-lucide="sun"></i></span>`;
  if (sym === MOON) return `<span class="sym sym-moon ${cls}"><i data-lucide="moon"></i></span>`;
  return '';
}

/**
 * @param {Object} opts
 * @param {HTMLElement} opts.panelEl  the #explain-mount element
 * @param {any} opts.view             the board view (render.js)
 * @param {import('./state.js').GameState} opts.state
 */
export function createExplainer({ panelEl, view, state }) {
  let current = [];       // current violation list
  let selected = 0;
  let suspended = false;  // paused while the step-by-step solve owns the panel
  let strict = true;      // strict mode: auto-validate on every move
  const disposers = [];   // hover listeners + animation loops to tear down

  function disposeAll() {
    while (disposers.length) {
      try { disposers.pop()(); } catch { /* ignore */ }
    }
  }

  function clearAll() {
    disposeAll();
    view.effects.clear();
  }

  /* ------------------------------- Entry point ---------------------------- */
  function update(meta = {}) {
    if (suspended) return; // the replay controller is driving the board + panel
    if (meta.type === 'load') { current = []; selected = 0; clearAll(); renderIdle(); return; }

    // In non-strict mode we don't surface mistakes automatically — only the
    // solved state and the idle prompt. Use "Explain this" to check on demand.
    if (!strict) {
      clearAll();
      if (state.isFilled() && validate(state.grid, state.puzzle).length === 0) renderSolved();
      else renderIdle();
      return;
    }

    const vs = validate(state.grid, state.puzzle);
    current = vs;
    if (vs.length) {
      selected = Math.min(selected, vs.length - 1);
      showSelected();
      return;
    }

    // No violations.
    clearAll();
    if (state.isFilled()) { renderSolved(); return; }
    if (meta.type === 'cell' && meta.symbol && meta.symbol !== EMPTY) {
      renderConfirm(meta);
    } else {
      renderIdle();
    }
  }

  /** Force a full re-analysis (used by the Help button). Returns violations. */
  function analyse() {
    const vs = validate(state.grid, state.puzzle);
    current = vs;
    selected = 0;
    if (vs.length) showSelected();
    else if (state.isFilled()) renderSolved();
    else renderIdle();
    return vs;
  }

  function selectViolation(i) {
    selected = i;
    showSelected();
  }

  function showSelected() {
    const v = current[selected];
    clearAll();
    drawOnBoard(v);
    renderCard(v);
  }

  /* ----------------------------- Board + geometry ------------------------- */
  function drawOnBoard(v) {
    const overlay = view.effects.overlay();
    const { cell } = view.effects.geom();
    const center = view.effects.cellCenter;

    if (v.rule === 'BALANCE') {
      // Keep the whole line visible; ring only the over-quota cells.
      const lineCells = lineCellList(v.line, state.n);
      view.effects.focusConflict(v.cells, lineCells);
      drawLineOutline(overlay, v.line, view.effects.geom());
    } else if (v.rule === 'EQUALS' || v.rule === 'CROSS') {
      view.effects.focusConflict(v.cells);
      view.effects.emphasiseEdge(v.edge);
      const a = center(v.edge.a.r, v.edge.a.c);
      const b = center(v.edge.b.r, v.edge.b.c);
      drawConnector(overlay, a, b);
    } else { // NO_THREE_IN_A_ROW
      view.effects.focusConflict(v.cells);
      drawBracket(overlay, v, cell, center);
    }
    setupBoardHoverLinks(v);
  }

  function drawBracket(overlay, v, cell, center) {
    const cells = v.cells;
    const first = cells[0], last = cells[cells.length - 1];
    let d;
    const pad = Math.max(6, cell * 0.16);
    if (v.line.type === 'row') {
      const y = center(first.r, first.c).y + cell / 2 + pad;
      const x0 = center(first.r, first.c).x - cell / 2;
      const x1 = center(last.r, last.c).x + cell / 2;
      d = `M ${x0} ${y - pad} L ${x0} ${y} L ${x1} ${y} L ${x1} ${y - pad}`;
    } else {
      const x = center(first.r, first.c).x + cell / 2 + pad;
      const y0 = center(first.r, first.c).y - cell / 2;
      const y1 = center(last.r, last.c).y + cell / 2;
      d = `M ${x - pad} ${y0} L ${x} ${y0} L ${x} ${y1} L ${x - pad} ${y1}`;
    }
    const path = svg('path', { d, 'data-geom': 'bracket' });
    overlay.appendChild(path);
    drawStroke(path);
  }

  function drawLineOutline(overlay, line, geom) {
    const { cell, gap, n } = geom;
    const stride = cell + gap;
    const boardPx = cell * n + gap * (n - 1);
    const m = 4;
    let attrs;
    if (line.type === 'row') {
      attrs = { x: -m, y: line.index * stride - m, width: boardPx + 2 * m, height: cell + 2 * m };
    } else {
      attrs = { x: line.index * stride - m, y: -m, width: cell + 2 * m, height: boardPx + 2 * m };
    }
    const rect = svg('rect', { ...attrs, rx: 12, 'data-geom': 'outline' });
    overlay.appendChild(rect);
    drawStroke(rect);
  }

  function drawConnector(overlay, a, b) {
    const line = svg('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, 'data-geom': 'connector' });
    overlay.appendChild(line);
    drawStroke(line);
  }

  // Animate a stroke being drawn on (dash-draw), or show it instantly if
  // reduced motion is preferred.
  function drawStroke(el) {
    const len = el.getTotalLength ? el.getTotalLength() : 0;
    if (!len || prefersReducedMotion()) return;
    el.style.strokeDasharray = String(len);
    el.style.strokeDashoffset = String(len);
    animate(el, { strokeDashoffset: [len, 0] }, { duration: 0.5, ease: 'easeInOut' });
  }

  // The Balance counter chip lives in the rule card (there's no clear room for
  // it beside the board). It animates the current counts toward the target N/2.
  function animateCounter(chip, counts) {
    chip.className = 'tango-counter';
    chip.style.transform = 'none';
    chip.innerHTML = counterHtml(counts, counts);
    renderIcons();
    if (prefersReducedMotion()) {
      chip.innerHTML = counterHtml(counts, { sun: counts.max, moon: counts.max });
      renderIcons();
      return;
    }
    const target = { sun: counts.max, moon: counts.max };
    const from = { ...counts };
    let step = 0;
    const timer = setInterval(() => {
      step++;
      const shown = {
        sun: from.sun > target.sun ? Math.max(target.sun, from.sun - step) : from.sun,
        moon: from.moon > target.moon ? Math.max(target.moon, from.moon - step) : from.moon,
      };
      chip.innerHTML = counterHtml(counts, shown);
      renderIcons();
      if (shown.sun <= target.sun && shown.moon <= target.moon) clearInterval(timer);
    }, 700);
    disposers.push(() => clearInterval(timer));
  }

  function counterHtml(counts, shown) {
    const over = counts.sun > counts.max ? SUN : MOON;
    const cls = (sym) => (shown[sym] > counts.max ? 'text-violation' : shown[sym] === counts.max ? 'text-confirm' : '');
    return `
      <span class="${cls(SUN)}">${shown.sun}</span>${symMarkup(SUN)}
      <span class="text-ink-faint">/</span>
      <span class="${cls(MOON)}">${shown.moon}</span>${symMarkup(MOON)}
      <span class="text-ink-faint ml-1">→ ${counts.max}/${counts.max}</span>`;
  }

  /* ------------------------------- Panel card ----------------------------- */
  function renderCard(v) {
    const meta = RULE_META[v.rule];
    const nav = current.length > 1 ? violationNav() : '';
    panelEl.innerHTML = `
      <div class="flex items-center justify-between gap-3 mb-4">
        <div class="eyebrow">Explanation · ${current.length} issue${current.length > 1 ? 's' : ''}</div>
      </div>
      ${nav}
      <article class="rule-card flex flex-col gap-5">
        <header class="flex items-center gap-3">
          <span class="flex h-9 w-9 items-center justify-center rounded-lg border border-violation/60 bg-violation/10 text-violation font-mono">${meta.n}</span>
          <div>
            <h2 class="font-display text-xl text-ink leading-tight">${meta.name}</h2>
            <p class="text-xs font-mono uppercase tracking-widest text-violation/80">Rule broken</p>
          </div>
        </header>

        <p class="text-sm text-ink-muted">${RULE_TEXT[v.rule]}</p>

        ${v.rule === 'BALANCE' ? '<div data-counter class="tango-counter" style="position:static;transform:none"></div>' : ''}

        <div data-mini class="flex flex-col items-start gap-2"></div>

        <div class="flex flex-col gap-3 pt-1">
          ${whyHowRow('sun', 'text-sun', 'What', v.headline)}
          ${whyHowRow('book-open', 'text-moon', 'Why', v.why)}
          ${whyHowRow('wand-sparkles', 'text-confirm', 'How', v.fix)}
        </div>
      </article>`;

    // Balance counter chip (in-card, animated).
    const counterEl = panelEl.querySelector('[data-counter]');
    if (counterEl && v.counts) animateCounter(counterEl, v.counts);

    // Mini-diagram
    const miniHost = panelEl.querySelector('[data-mini]');
    const mini = buildMini(v);
    miniHost.appendChild(mini.node);
    disposers.push(mini.dispose);

    renderIcons();

    if (current.length > 1) {
      panelEl.querySelectorAll('[data-vchip]').forEach((chip) => {
        chip.addEventListener('click', () => selectViolation(Number(chip.dataset.vchip)));
      });
    }
  }

  function violationNav() {
    const chips = current.map((v, i) => {
      const m = RULE_META[v.rule];
      return `<button type="button" data-vchip="${i}" class="vchip" aria-selected="${i === selected}">
        <span class="font-mono text-violation">${m.n}</span> ${m.name}
      </button>`;
    }).join('');
    return `<div class="flex flex-wrap gap-2 mb-4">${chips}</div>`;
  }

  function whyHowRow(iconName, tone, label, text) {
    return `
      <div class="whyhow-row">
        <span class="whyhow-badge border border-line ${tone}"><i data-lucide="${iconName}" style="width:13px;height:13px"></i></span>
        <div>
          <div class="text-xs uppercase tracking-widest ${tone} font-mono mb-0.5">${label}</div>
          <div class="text-sm text-ink">${text}</div>
        </div>
      </div>`;
  }

  /* ------------------------------ Mini-diagram ---------------------------- */
  // Builds the small standalone diagram of the affected region and links its
  // cells to the real board. Loops wrong → fixed for motion; shows both states
  // side by side under reduced motion.
  function buildMini(v) {
    const region = regionOf(v);           // [{r,c}], plus orientation + badge
    const wrong = region.cells.map((c) => state.grid[c.r][c.c]);
    const fixMap = new Map(v.fixPreview.map((f) => [key(f.r, f.c), f.symbol]));
    const fixed = region.cells.map((c) => fixMap.get(key(c.r, c.c)) ?? state.grid[c.r][c.c]);

    const wrapper = document.createElement('div');
    const localDisposers = [];

    const makeBoard = (symbols, label, tone) => {
      const board = document.createElement('div');
      board.className = 'mini-board';
      board.style.gridTemplateColumns = region.orient === 'h'
        ? `repeat(${region.slots.length}, auto)` : 'auto';
      region.slots.forEach((slot) => {
        if (slot.badge) {
          const b = document.createElement('div');
          b.className = 'mini-badge';
          b.textContent = slot.badge;
          board.appendChild(b);
          return;
        }
        const i = slot.cellIndex;
        const c = region.cells[i];
        const el = document.createElement('div');
        el.className = 'mini-cell';
        if (fixMap.has(key(c.r, c.c))) el.classList.add('is-target');
        el.dataset.r = String(c.r);
        el.dataset.c = String(c.c);
        el.innerHTML = symMarkup(symbols[i]);
        board.appendChild(el);
        // Hover linking (both directions).
        const on = () => { el.classList.add('is-linked'); view.effects.link(c.r, c.c, true); };
        const off = () => { el.classList.remove('is-linked'); view.effects.link(c.r, c.c, false); };
        el.addEventListener('mouseenter', on);
        el.addEventListener('mouseleave', off);
        const cellReal = view.cellEl(c.r, c.c);
        const onReal = () => el.classList.add('is-linked');
        const offReal = () => el.classList.remove('is-linked');
        cellReal?.addEventListener('mouseenter', onReal);
        cellReal?.addEventListener('mouseleave', offReal);
        localDisposers.push(() => {
          cellReal?.removeEventListener('mouseenter', onReal);
          cellReal?.removeEventListener('mouseleave', offReal);
        });
      });
      const wrap = document.createElement('div');
      wrap.className = 'flex items-center gap-3';
      const lbl = document.createElement('span');
      lbl.className = `inline-flex items-center justify-center h-6 w-6 rounded-full border text-sm font-mono ${tone}`;
      lbl.textContent = label;
      wrap.append(board, lbl);
      return { wrap, board };
    };

    if (prefersReducedMotion()) {
      const a = makeBoard(wrong, '✗', 'border-violation/60 text-violation');
      const b = makeBoard(fixed, '✓', 'border-confirm/60 text-confirm');
      const stack = document.createElement('div');
      stack.className = 'flex flex-col gap-2';
      stack.append(a.wrap, b.wrap);
      wrapper.appendChild(stack);
    } else {
      const { wrap, board } = makeBoard(wrong, '✗', 'border-violation/60 text-violation');
      wrapper.appendChild(wrap);
      const lbl = wrap.querySelector('span');
      const targets = region.cells
        .map((c, i) => ({ i, el: board.querySelector(`.mini-cell[data-r="${c.r}"][data-c="${c.c}"]`) }))
        .filter(({ i }) => fixMap.has(key(region.cells[i].r, region.cells[i].c)));
      let showFixed = false;
      const paint = () => {
        showFixed = !showFixed;
        const syms = showFixed ? fixed : wrong;
        for (const { i, el } of targets) {
          el.innerHTML = symMarkup(syms[i]);
          renderIcons();
          animate(el.querySelector('.sym'), { opacity: [0.2, 1], transform: ['scale(0.6)', 'scale(1)'] }, { duration: 0.3, ease: [0.34, 1.56, 0.64, 1] });
        }
        lbl.textContent = showFixed ? '✓' : '✗';
        lbl.className = `inline-flex items-center justify-center h-6 w-6 rounded-full border text-sm font-mono ${showFixed ? 'border-confirm/60 text-confirm' : 'border-violation/60 text-violation'}`;
      };
      const timer = setInterval(paint, 1600);
      localDisposers.push(() => clearInterval(timer));
    }

    return { node: wrapper, dispose: () => localDisposers.forEach((d) => d()) };
  }

  // Region + slot layout (slots interleave a badge for edge constraints).
  function regionOf(v) {
    if (v.rule === 'BALANCE') {
      const cells = lineCellList(v.line, state.n);
      return { cells, orient: v.line.type === 'row' ? 'h' : 'v', slots: cells.map((_, i) => ({ cellIndex: i })) };
    }
    if (v.rule === 'EQUALS' || v.rule === 'CROSS') {
      const cells = [v.edge.a, v.edge.b];
      const orient = v.edge.a.r === v.edge.b.r ? 'h' : 'v';
      const badge = v.edge.type === '=' ? '=' : '×';
      return { cells, orient, slots: [{ cellIndex: 0 }, { badge }, { cellIndex: 1 }] };
    }
    // NO_THREE_IN_A_ROW
    return { cells: v.cells, orient: v.line.type === 'row' ? 'h' : 'v', slots: v.cells.map((_, i) => ({ cellIndex: i })) };
  }

  /* ------------------------------ Hover: board → mini --------------------- */
  // The mini→board direction is wired in buildMini. Nothing extra needed here,
  // but we keep the hook for symmetry / future geometry hovers.
  function setupBoardHoverLinks() { /* handled per-cell in buildMini */ }

  /* -------------------------------- Idle states --------------------------- */
  function renderIdle() {
    panelEl.innerHTML = `
      <div class="eyebrow mb-3">Explanation</div>
      <div class="flex-1 flex flex-col items-center justify-center text-center gap-4 py-8">
        <span class="inline-flex h-14 w-14 items-center justify-center rounded-full border border-line bg-surface-2 text-moon">
          <i data-lucide="telescope"></i>
        </span>
        <div class="max-w-sm">
          <h2 class="font-display text-lg text-ink mb-1">Nothing to explain yet</h2>
          <p class="text-sm text-ink-muted">
            Make a move and this panel shows <span class="text-ink">what</span> happened,
            <span class="text-ink">why</span>, and <span class="text-ink">how</span> to fix it —
            mapped onto the exact cells on the board.
          </p>
        </div>
      </div>`;
    renderIcons();
  }

  function renderConfirm(meta) {
    view.effects.confirm([{ r: meta.r, c: meta.c }]);
    const t = setTimeout(() => view.effects.clear(), 1300);
    disposers.push(() => clearTimeout(t));
    panelEl.innerHTML = `
      <div class="eyebrow mb-3">Explanation</div>
      <div class="rule-card flex-1 flex flex-col items-center justify-center text-center gap-4 py-8">
        <span class="inline-flex h-14 w-14 items-center justify-center rounded-full border border-confirm/50 bg-confirm/10 text-confirm">
          <i data-lucide="check"></i>
        </span>
        <div class="max-w-sm">
          <h2 class="font-display text-lg text-ink mb-1">No rule broken</h2>
          <p class="text-sm text-ink-muted">That placement is legal so far. Keep going — guided “why it’s forced” hints arrive with the solver.</p>
        </div>
      </div>`;
    renderIcons();
  }

  function renderSolved() {
    panelEl.innerHTML = `
      <div class="eyebrow mb-3">Explanation</div>
      <div class="rule-card flex-1 flex flex-col items-center justify-center text-center gap-4 py-8">
        <span class="inline-flex h-16 w-16 items-center justify-center rounded-full border border-confirm/50 bg-confirm/10 text-confirm">
          <i data-lucide="party-popper"></i>
        </span>
        <div class="max-w-sm">
          <h2 class="font-display text-2xl text-ink mb-1">Solved</h2>
          <p class="text-sm text-ink-muted">Every row and column is balanced, no triples, all constraints satisfied. Nicely reasoned.</p>
        </div>
      </div>`;
    renderIcons();
  }

  /* -------------------------------- Helpers ------------------------------- */
  function lineCellList(line, n) {
    const cells = [];
    for (let i = 0; i < n; i++) {
      cells.push(line.type === 'row' ? { r: line.index, c: i } : { r: i, c: line.index });
    }
    return cells;
  }

  function svg(name, attrs) {
    const el = document.createElementNS(SVG_NS, name);
    for (const [k, val] of Object.entries(attrs)) el.setAttribute(k, String(val));
    return el;
  }

  return {
    update, analyse, selectViolation, clear: clearAll,
    setSuspended(b) { suspended = b; },
    setStrict(b) { strict = b; },
    get violations() { return current; },
  };
}
