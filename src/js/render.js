// Interactive board view. Renders the grid from GameState, wires all input
// (left/right click, double-click & long-press to clear, full keyboard nav),
// keeps a roving tabindex for accessibility, and repaints with a spring pop on
// each placement. Reads state; mutates only through state's methods.

import { renderIcons } from './icons.js';
import { SUN, MOON, EMPTY, normaliseConstraint } from './board.js';
import { animate, shake, prefersReducedMotion } from './animate.js';
import { toast } from './toast.js';

const GAP = (n) => (n <= 6 ? 6 : 4);
const MAX_CELL = { 4: 66, 6: 56, 8: 46, 10: 40 };
const SVG_NS = 'http://www.w3.org/2000/svg';

function svgNode(name, attrs = {}) {
  const el = document.createElementNS(SVG_NS, name);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  return el;
}

function symMarkup(sym, ghost = false) {
  const gc = ghost ? ' sym-ghost' : '';
  if (sym === SUN) return `<span class="sym sym-sun${gc}"><i data-lucide="sun"></i></span>`;
  if (sym === MOON) return `<span class="sym sym-moon${gc}"><i data-lucide="moon"></i></span>`;
  return '';
}

/**
 * @param {HTMLElement} mountEl
 * @param {import('./state.js').GameState} state
 */
export function createBoardView(mountEl, state) {
  /** @type {HTMLButtonElement[][]} */
  let cells = [];
  /** @type {HTMLElement[]} */
  let badges = [];
  let boardEl = null;
  let overlay = null;             // SVG layer for geometry drawn by the explainer
  let normCons = [];
  let painted = [];               // shadow of last-painted symbols, for diffing
  let focus = { r: 0, c: 0 };
  let pressTimer = null;
  let curCell = 56, curGap = 6;   // current pixel geometry (kept in sync by layout)
  const counters = [];            // transient counter-chip elements
  let ghost = null;               // cheat-mode ghost grid (solution) or null

  function build() {
    const n = state.n;
    normCons = (state.puzzle?.constraints ?? []).map(normaliseConstraint);

    boardEl = document.createElement('div');
    boardEl.className = 'tango-board';
    boardEl.style.gridTemplateColumns = `repeat(${n}, var(--cell))`;
    boardEl.setAttribute('role', 'grid');
    boardEl.setAttribute('aria-label', `${n} by ${n} Tango board`);

    cells = [];
    painted = [];
    for (let r = 0; r < n; r++) {
      cells[r] = [];
      painted[r] = [];
      for (let c = 0; c < n; c++) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'tango-cell';
        btn.dataset.r = String(r);
        btn.dataset.c = String(c);
        btn.tabIndex = -1;
        btn.setAttribute('role', 'gridcell');
        if (state.isLocked(r, c)) btn.dataset.locked = 'true';
        boardEl.appendChild(btn);
        cells[r][c] = btn;
        painted[r][c] = undefined;
      }
    }

    // Constraint badges (positioned in layout()).
    badges = normCons.map((con) => {
      const el = document.createElement('div');
      el.className = 'tango-badge';
      el.textContent = con.type === '=' ? '=' : '×';
      el.setAttribute('aria-hidden', 'true');
      boardEl.appendChild(el);
      return el;
    });

    // SVG overlay for explanation geometry (brackets, outlines, connectors).
    overlay = svgNode('svg', { class: 'tango-overlay' });
    boardEl.appendChild(overlay);

    mountEl.innerHTML = '';
    mountEl.appendChild(boardEl);

    attachInput();
    setFocus(focus.r, focus.c, false);
    layout();
    repaint(true);
  }

  function layout() {
    const n = state.n;
    const gap = GAP(n);
    const maxCell = MAX_CELL[n] ?? 48;
    const avail = Math.min(maxCell * n + gap * (n - 1), window.innerWidth - 56);
    let cell = Math.floor((avail - gap * (n - 1)) / n);
    cell = Math.max(24, Math.min(cell, maxCell));
    boardEl.style.setProperty('--cell', `${cell}px`);
    boardEl.style.setProperty('--gap', `${gap}px`);
    curCell = cell;
    curGap = gap;

    const boardPx = cell * n + gap * (n - 1);
    if (overlay) {
      overlay.setAttribute('width', boardPx);
      overlay.setAttribute('height', boardPx);
      overlay.setAttribute('viewBox', `0 0 ${boardPx} ${boardPx}`);
    }

    const stride = cell + gap;
    const badgeSize = Math.max(16, Math.round(cell * 0.34));
    normCons.forEach((con, i) => {
      const el = badges[i];
      let x, y;
      if (con.orient === 'h') {
        x = con.a.c * stride + cell + gap / 2;
        y = con.a.r * stride + cell / 2;
      } else {
        x = con.a.c * stride + cell / 2;
        y = con.a.r * stride + cell + gap / 2;
      }
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
      el.style.width = `${badgeSize}px`;
      el.style.height = `${badgeSize}px`;
      el.style.fontSize = `${Math.round(badgeSize * 0.62)}px`;
    });
  }

  function repaint(initial = false) {
    const n = state.n;
    const changed = [];
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        const sym = state.grid[r][c];
        if (painted[r][c] !== sym) {
          const btn = cells[r][c];
          // Preserve the lock glyph; only replace the symbol span.
          const lock = state.isLocked(r, c)
            ? `<span class="tango-lock"><i data-lucide="lock"></i></span>` : '';
          const content = sym === EMPTY && ghost?.[r]?.[c]
            ? symMarkup(ghost[r][c], true)
            : symMarkup(sym);
          btn.innerHTML = content + lock;
          btn.setAttribute('aria-label', cellLabel(r, c, sym));
          if (!initial && sym !== EMPTY && painted[r][c] !== sym) changed.push(btn);
          painted[r][c] = sym;
        }
      }
    }
    renderIcons();
    if (!prefersReducedMotion()) {
      for (const btn of changed) {
        const span = btn.querySelector('.sym');
        if (span) {
          animate(span,
            { opacity: [0, 1], transform: ['scale(0.5)', 'scale(1)'] },
            { duration: 0.28, ease: [0.34, 1.56, 0.64, 1] });
        }
      }
    }
  }

  function cellLabel(r, c, sym) {
    const name = sym === SUN ? 'Sun' : sym === MOON ? 'Moon' : 'empty';
    const lock = state.isLocked(r, c) ? ', given clue' : '';
    return `Row ${r + 1}, column ${c + 1}: ${name}${lock}`;
  }

  /* --------------------------------- Input -------------------------------- */
  function attachInput() {
    boardEl.addEventListener('click', (e) => {
      const t = coordFrom(e.target);
      if (!t) return;
      setFocus(t.r, t.c);
      state.cycle(t.r, t.c, +1);
    });

    boardEl.addEventListener('contextmenu', (e) => {
      const t = coordFrom(e.target);
      if (!t) return;
      e.preventDefault();
      setFocus(t.r, t.c);
      state.cycle(t.r, t.c, -1);
    });

    boardEl.addEventListener('dblclick', (e) => {
      const t = coordFrom(e.target);
      if (!t) return;
      e.preventDefault();
      state.clearCell(t.r, t.c);
    });

    // Long-press (touch) clears.
    boardEl.addEventListener('touchstart', (e) => {
      const t = coordFrom(e.target);
      if (!t) return;
      pressTimer = setTimeout(() => {
        pressTimer = null;
        state.clearCell(t.r, t.c);
      }, 500);
    }, { passive: true });
    const cancelPress = () => { if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; } };
    boardEl.addEventListener('touchend', cancelPress);
    boardEl.addEventListener('touchmove', cancelPress);

    boardEl.addEventListener('keydown', onKeydown);
    window.addEventListener('resize', layout);
  }

  function coordFrom(target) {
    const btn = target.closest?.('.tango-cell');
    if (!btn || !boardEl.contains(btn)) return null;
    return { r: Number(btn.dataset.r), c: Number(btn.dataset.c) };
  }

  function onKeydown(e) {
    const n = state.n;
    let { r, c } = focus;
    switch (e.key) {
      case 'ArrowUp': r = (r - 1 + n) % n; break;
      case 'ArrowDown': r = (r + 1) % n; break;
      case 'ArrowLeft': c = (c - 1 + n) % n; break;
      case 'ArrowRight': c = (c + 1) % n; break;
      case ' ':
      case 'Enter': e.preventDefault(); state.cycle(focus.r, focus.c, +1); return;
      case 'Backspace':
      case 'Delete': e.preventDefault(); state.clearCell(focus.r, focus.c); return;
      default: return;
    }
    e.preventDefault();
    setFocus(r, c);
  }

  function setFocus(r, c, doFocus = true) {
    cells[focus.r]?.[focus.c]?.classList.remove('is-focus');
    cells[focus.r]?.[focus.c] && (cells[focus.r][focus.c].tabIndex = -1);
    focus = { r, c };
    const btn = cells[r]?.[c];
    if (btn) {
      btn.classList.add('is-focus');
      btn.tabIndex = 0;
      if (doFocus) btn.focus();
    }
  }

  /* ------------------------------ State events ---------------------------- */
  const unsub = state.subscribe((meta) => {
    if (meta.type === 'load') { build(); return; }
    if (meta.type === 'rejected') {
      const btn = cells[meta.r]?.[meta.c];
      shake(btn);
      const msg = meta.reason === 'inactive'
        ? 'Not this cell yet — follow the highlighted one.'
        : 'This cell is a given clue — it can’t be changed.';
      toast(msg, { kind: 'lock', duration: 1800 });
      return;
    }
    repaint();
  });

  /* ----------------------------- Effects API ------------------------------ */
  // Driven by explain.js. All are pure DOM decoration over the live board.

  const cellKeySet = (cells) => new Set(cells.map((c) => `${c.r},${c.c}`));

  /** Centre of cell (r,c) in board pixel coordinates. */
  function cellCenter(r, c) {
    const stride = curCell + curGap;
    return { x: c * stride + curCell / 2, y: r * stride + curCell / 2 };
  }

  const effects = {
    geom: () => ({ n: state.n, cell: curCell, gap: curGap }),
    cellCenter,
    overlay: () => overlay,

    /**
     * Ring + pulse `ringCells`; dim every cell not in `keepCells`.
     * keepCells defaults to ringCells (so only the offenders stay lit).
     */
    focusConflict(ringCells, keepCells = ringCells) {
      this.clear();
      const ring = cellKeySet(ringCells);
      const keep = cellKeySet(keepCells);
      forEachCell((btn, r, c) => {
        const k = `${r},${c}`;
        if (ring.has(k)) btn.classList.add('is-conflict');
        else if (!keep.has(k)) btn.classList.add('is-dimmed');
      });
    },

    /** Green confirmation ring on cells (no dimming). */
    confirm(cells) {
      for (const { r, c } of cells) cellEl(r, c)?.classList.add('is-confirm');
    },

    /** Emphasise the badge belonging to a constraint edge, if present. */
    emphasiseEdge(edge) {
      normCons.forEach((con, i) => {
        if (con.a.r === edge.a.r && con.a.c === edge.a.c &&
            con.b.r === edge.b.r && con.b.c === edge.b.c) {
          badges[i]?.classList.add('is-emph');
        }
      });
    },

    /** Toggle the moon "linked" ring on a single board cell (hover linking). */
    link(r, c, on) {
      cellEl(r, c)?.classList.toggle('is-linked', on);
    },

    /**
     * Hint highlighting: ring the `region` cells, dim the rest, and (optionally)
     * strongly pulse the `target` cell. Distinct from conflict styling.
     */
    hint(region, target = null) {
      this.clear();
      const keep = cellKeySet(region);
      forEachCell((btn, r, c) => {
        if (keep.has(`${r},${c}`)) btn.classList.add('is-hint');
        else btn.classList.add('is-dimmed');
      });
      if (target) cellEl(target.r, target.c)?.classList.add('is-hint-strong');
    },

    /** Enable/disable the cheat ghost overlay (pass the solution grid or null). */
    setGhost(grid) {
      ghost = grid;
      // Force empty cells to repaint so ghosts appear / disappear.
      for (let r = 0; r < state.n; r++) {
        for (let c = 0; c < state.n; c++) if (state.grid[r][c] === EMPTY) painted[r][c] = '__force__';
      }
      repaint();
    },

    /** Add a counter chip at a board pixel position. Returns the element. */
    addCounter(x, y, html) {
      const chip = document.createElement('div');
      chip.className = 'tango-counter';
      chip.style.left = `${x}px`;
      chip.style.top = `${y}px`;
      chip.innerHTML = html;
      boardEl.appendChild(chip);
      counters.push(chip);
      return chip;
    },

    /** Remove every explanation effect. */
    clear() {
      forEachCell((btn) => btn.classList.remove('is-conflict', 'is-dimmed', 'is-confirm', 'is-linked', 'is-hint', 'is-hint-strong'));
      badges.forEach((b) => b.classList.remove('is-emph'));
      if (overlay) overlay.replaceChildren();
      while (counters.length) counters.pop().remove();
    },
  };

  function cellEl(r, c) { return cells[r]?.[c]; }
  function forEachCell(fn) {
    for (let r = 0; r < state.n; r++) for (let c = 0; c < state.n; c++) fn(cells[r][c], r, c);
  }

  // Initial build (state may already be loaded).
  if (state.n) build();

  return {
    layout,
    focusCell: setFocus,
    getFocus: () => ({ ...focus }),
    cellEl,
    effects,
    destroy() {
      unsub();
      window.removeEventListener('resize', layout);
      mountEl.innerHTML = '';
    },
  };
}
