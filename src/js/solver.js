// Logical solver built from NAMED human techniques, so every deduction can be
// explained in a hint. Brute-force backtracking exists too, but only for
// verifying uniqueness (countSolutions) — never for producing a hint.
//
// A step: { technique, r, c, symbol, because:[{r,c}], line?, edge?, reason }

import { SUN, MOON, EMPTY, OPPOSITE, key, cloneGrid } from './board.js';
import { validate } from './rules.js';

const NAME = { [SUN]: 'Sun', [MOON]: 'Moon' };
const PLURAL = { [SUN]: 'Suns', [MOON]: 'Moons' };

const TIER = {
  CONSTRAINT_EQUALS: 'easy', CONSTRAINT_CROSS: 'easy',
  PAIR_FORCES_NEIGHBOURS: 'easy', BALANCE_COMPLETE: 'easy',
  SANDWICH: 'medium', BALANCE_AVOID_TRIPLE: 'medium', CONSTRAINT_CHAIN: 'medium',
  CONTRADICTION: 'hard',
};

/* --------------------------- constraint index ---------------------------- */
const indexCache = new WeakMap();
function consIndex(puzzle) {
  if (indexCache.has(puzzle)) return indexCache.get(puzzle);
  const map = new Map();
  const add = (r, c, partner, type) => {
    const k = key(r, c);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push({ partner, type });
  };
  for (const con of puzzle?.constraints ?? []) {
    add(con.a.r, con.a.c, { r: con.b.r, c: con.b.c }, con.type);
    add(con.b.r, con.b.c, { r: con.a.r, c: con.a.c }, con.type);
  }
  indexCache.set(puzzle, map);
  return map;
}
const incident = (puzzle, r, c) => consIndex(puzzle).get(key(r, c)) ?? [];

/* ------------------------------- primitives ------------------------------ */

/** Can symbol X be legally placed at (r,c) without an immediate rule break? */
export function canPlace(grid, puzzle, r, c, X) {
  const n = grid.length;
  const half = n / 2;
  const rg = (cc) => (cc >= 0 && cc < n ? grid[r][cc] : undefined);
  const cg = (rr) => (rr >= 0 && rr < n ? grid[rr][c] : undefined);
  // No triple through (r,c), horizontally or vertically.
  if ((rg(c - 1) === X && rg(c - 2) === X) || (rg(c - 1) === X && rg(c + 1) === X) || (rg(c + 1) === X && rg(c + 2) === X)) return false;
  if ((cg(r - 1) === X && cg(r - 2) === X) || (cg(r - 1) === X && cg(r + 1) === X) || (cg(r + 1) === X && cg(r + 2) === X)) return false;
  // Balance: placing X must not exceed N/2 in its row or column.
  let rowX = 0, colX = 0;
  for (let i = 0; i < n; i++) { if (grid[r][i] === X) rowX++; if (grid[i][c] === X) colX++; }
  if (rowX + 1 > half || colX + 1 > half) return false;
  // Constraints against already-filled partners.
  for (const { partner, type } of incident(puzzle, r, c)) {
    const pv = grid[partner.r][partner.c];
    if (pv === EMPTY) continue;
    if (type === '=' && pv !== X) return false;
    if (type === 'x' && pv === X) return false;
  }
  return true;
}

function lineArray(grid, type, index) {
  const n = grid.length;
  const arr = [];
  for (let i = 0; i < n; i++) arr.push(type === 'row' ? grid[index][i] : grid[i][index]);
  return arr;
}

function canPlaceInArray(a, i, X) {
  return !((a[i - 1] === X && a[i - 2] === X) || (a[i - 1] === X && a[i + 1] === X) || (a[i + 1] === X && a[i + 2] === X));
}

/** Can this single line (with holes) be completed to N/2 each with no triple? */
function lineCompletable(a, half) {
  let s = 0, m = 0;
  for (const v of a) { if (v === SUN) s++; else if (v === MOON) m++; }
  const rec = (needS, needM) => {
    if (needS < 0 || needM < 0) return false;
    const idx = a.indexOf(EMPTY);
    if (idx === -1) return needS === 0 && needM === 0;
    for (const X of [SUN, MOON]) {
      if (X === SUN && needS === 0) continue;
      if (X === MOON && needM === 0) continue;
      if (!canPlaceInArray(a, idx, X)) continue;
      a[idx] = X;
      const ok = rec(needS - (X === SUN ? 1 : 0), needM - (X === MOON ? 1 : 0));
      a[idx] = EMPTY;
      if (ok) return true;
    }
    return false;
  };
  return rec(half - s, half - m);
}

const forEmpties = (grid, fn) => {
  const n = grid.length;
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (grid[r][c] === EMPTY) fn(r, c);
};

/* ----------------------------- named techniques -------------------------- */

export function deduceConstraint(grid, puzzle) {
  for (const con of puzzle?.constraints ?? []) {
    const va = grid[con.a.r][con.a.c];
    const vb = grid[con.b.r][con.b.c];
    const both = [[con.a, va, con.b, vb], [con.b, vb, con.a, va]];
    for (const [filled, fv, empty, ev] of both) {
      if (fv !== EMPTY && ev === EMPTY) {
        const symbol = con.type === '=' ? fv : OPPOSITE[fv];
        const technique = con.type === '=' ? 'CONSTRAINT_EQUALS' : 'CONSTRAINT_CROSS';
        const reason = con.type === '='
          ? `The “=” means this cell must match its ${NAME[fv]} neighbour.`
          : `The “×” means this cell must be the opposite of its ${NAME[fv]} neighbour.`;
        return { technique, r: empty.r, c: empty.c, symbol, because: [{ ...filled }], edge: { a: { ...con.a }, b: { ...con.b }, type: con.type }, reason };
      }
    }
  }
  return null;
}

export function deducePair(grid, puzzle) {
  const n = grid.length;
  const make = (r, c, X, a, b) => ({
    technique: 'PAIR_FORCES_NEIGHBOURS', r, c, symbol: OPPOSITE[X], because: [a, b],
    reason: `Two ${PLURAL[X]} sit together, so the next cell must be a ${NAME[OPPOSITE[X]]} — three in a row isn’t allowed.`,
  });
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    // horizontal pair
    if (c + 1 < n && grid[r][c] !== EMPTY && grid[r][c] === grid[r][c + 1]) {
      const X = grid[r][c];
      if (c - 1 >= 0 && grid[r][c - 1] === EMPTY) return make(r, c - 1, X, { r, c }, { r, c: c + 1 });
      if (c + 2 < n && grid[r][c + 2] === EMPTY) return make(r, c + 2, X, { r, c }, { r, c: c + 1 });
    }
    // vertical pair
    if (r + 1 < n && grid[r][c] !== EMPTY && grid[r][c] === grid[r + 1][c]) {
      const X = grid[r][c];
      if (r - 1 >= 0 && grid[r - 1][c] === EMPTY) return make(r - 1, c, X, { r, c }, { r: r + 1, c });
      if (r + 2 < n && grid[r + 2][c] === EMPTY) return make(r + 2, c, X, { r, c }, { r: r + 1, c });
    }
  }
  return null;
}

export function deduceSandwich(grid, puzzle) {
  const n = grid.length;
  const make = (r, c, X, a, b) => ({
    technique: 'SANDWICH', r, c, symbol: OPPOSITE[X], because: [a, b],
    reason: `A ${NAME[X]} sits on each side, so the middle can’t also be a ${NAME[X]}.`,
  });
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    if (c + 2 < n && grid[r][c] !== EMPTY && grid[r][c] === grid[r][c + 2] && grid[r][c + 1] === EMPTY) {
      return make(r, c + 1, grid[r][c], { r, c }, { r, c: c + 2 });
    }
    if (r + 2 < n && grid[r][c] !== EMPTY && grid[r][c] === grid[r + 2][c] && grid[r + 1][c] === EMPTY) {
      return make(r + 1, c, grid[r][c], { r, c }, { r: r + 2, c });
    }
  }
  return null;
}

export function deduceBalanceComplete(grid, puzzle) {
  const n = grid.length;
  const half = n / 2;
  for (const type of ['row', 'col']) {
    for (let index = 0; index < n; index++) {
      const a = lineArray(grid, type, index);
      let s = 0, m = 0;
      a.forEach((v) => { if (v === SUN) s++; else if (v === MOON) m++; });
      if (s + m === n) continue;
      const done = s === half ? SUN : m === half ? MOON : null;
      if (!done) continue;
      const symbol = OPPOSITE[done];
      const i = a.indexOf(EMPTY);
      const r = type === 'row' ? index : i;
      const c = type === 'row' ? i : index;
      return {
        technique: 'BALANCE_COMPLETE', r, c, symbol,
        because: [], line: { type, index },
        reason: `This ${type} already has all ${half} of its ${PLURAL[done]}, so every remaining cell must be a ${NAME[symbol]}.`,
      };
    }
  }
  return null;
}

// Single-line lookahead: if placing the opposite here would make the line
// impossible to finish (balance + no-triple), the cell is forced.
export function deduceBalanceAvoidTriple(grid, puzzle) {
  const n = grid.length;
  const half = n / 2;
  for (const type of ['row', 'col']) {
    for (let index = 0; index < n; index++) {
      const base = lineArray(grid, type, index);
      for (let i = 0; i < n; i++) {
        if (base[i] !== EMPTY) continue;
        const r = type === 'row' ? index : i;
        const c = type === 'row' ? i : index;
        for (const X of [SUN, MOON]) {
          const opp = OPPOSITE[X];
          if (!canPlace(grid, puzzle, r, c, X) || !canPlace(grid, puzzle, r, c, opp)) continue;
          const withX = base.slice(); withX[i] = X;
          const withOpp = base.slice(); withOpp[i] = opp;
          if (lineCompletable(withX, half) && !lineCompletable(withOpp, half)) {
            return {
              technique: 'BALANCE_AVOID_TRIPLE', r, c, symbol: X,
              because: [], line: { type, index },
              reason: `Putting a ${NAME[opp]} here would leave this ${type} impossible to finish without three in a row, so it must be a ${NAME[X]}.`,
            };
          }
        }
      }
    }
  }
  return null;
}

// A constraint whose two cells are both empty, where only one assignment keeps
// both affected lines completable.
export function deduceConstraintChain(grid, puzzle) {
  const n = grid.length, half = n / 2;
  for (const con of puzzle?.constraints ?? []) {
    const { a, b, type } = con;
    if (grid[a.r][a.c] !== EMPTY || grid[b.r][b.c] !== EMPTY) continue;
    const feasible = [];
    for (const va of [SUN, MOON]) {
      const vb = type === '=' ? va : OPPOSITE[va];
      if (!canPlace(grid, puzzle, a.r, a.c, va)) continue;
      const g2 = cloneGrid(grid); g2[a.r][a.c] = va;
      if (!canPlace(g2, puzzle, b.r, b.c, vb)) continue;
      g2[b.r][b.c] = vb;
      const linesOk =
        lineCompletable(lineArray(g2, 'row', a.r), half) && lineCompletable(lineArray(g2, 'col', a.c), half) &&
        lineCompletable(lineArray(g2, 'row', b.r), half) && lineCompletable(lineArray(g2, 'col', b.c), half);
      if (linesOk) feasible.push({ va, vb });
    }
    if (feasible.length === 1) {
      const { va } = feasible[0];
      return {
        technique: 'CONSTRAINT_CHAIN', r: a.r, c: a.c, symbol: va,
        because: [{ ...b }], edge: { a: { ...a }, b: { ...b }, type },
        reason: `Following this ${type === '=' ? '“=”' : '“×”'} link together with the balance of both lines, only one symbol works here.`,
      };
    }
  }
  return null;
}

/* -------------------------------- solving -------------------------------- */

const EASY_MEDIUM = [deduceConstraint, deducePair, deduceBalanceComplete, deduceSandwich, deduceBalanceAvoidTriple, deduceConstraintChain];

// Apply only easy+medium deductions repeatedly. Returns 'contradiction' if a
// dead cell appears, 'solved' if filled cleanly, else the propagated grid.
function propagate(grid, puzzle) {
  const g = cloneGrid(grid);
  const n = g.length;
  let progressed = true;
  while (progressed) {
    progressed = false;
    // Dead-cell check: an empty cell with no legal symbol is a contradiction.
    let dead = false;
    forEmpties(g, (r, c) => {
      if (!dead && !canPlace(g, puzzle, r, c, SUN) && !canPlace(g, puzzle, r, c, MOON)) dead = true;
    });
    if (dead) return 'contradiction';
    for (const fn of EASY_MEDIUM) {
      const step = fn(g, puzzle);
      if (step) {
        if (!canPlace(g, puzzle, step.r, step.c, step.symbol)) return 'contradiction';
        g[step.r][step.c] = step.symbol;
        progressed = true;
        break;
      }
    }
  }
  let empties = 0;
  forEmpties(g, () => { empties++; });
  return empties === 0 ? 'solved' : g;
}

// Trial-and-refute: if assuming X at a cell propagates to a contradiction, the
// cell must be the opposite. This is deterministic elimination, not guessing.
export function deduceContradiction(grid, puzzle) {
  let found = null;
  forEmpties(grid, (r, c) => {
    if (found) return;
    for (const X of [SUN, MOON]) {
      if (!canPlace(grid, puzzle, r, c, X)) continue;
      const opp = OPPOSITE[X];
      if (!canPlace(grid, puzzle, r, c, opp)) continue; // opp already forced by a simpler rule
      const g = cloneGrid(grid); g[r][c] = X;
      if (propagate(g, puzzle) === 'contradiction') {
        found = {
          technique: 'CONTRADICTION', r, c, symbol: opp, because: [],
          reason: `Assuming a ${NAME[X]} here leads to a dead end (some cell would have no legal symbol), so it must be a ${NAME[opp]}.`,
        };
        return;
      }
    }
  });
  return found;
}

const ALL_STEPS = [...EASY_MEDIUM, deduceContradiction];

/** The next single logical deduction, easiest technique first. */
export function solveStep(grid, puzzle, { allowContradiction = true } = {}) {
  const fns = allowContradiction ? ALL_STEPS : EASY_MEDIUM;
  for (const fn of fns) {
    const step = fn(grid, puzzle);
    if (step) return step;
  }
  return null;
}

/** Solve fully by logic. Returns { solved, grid, steps, techniques }. */
export function solve(grid, puzzle, opts = {}) {
  const g = cloneGrid(grid);
  const steps = [];
  const techniques = new Set();
  let guard = g.length * g.length + 5;
  while (guard-- > 0) {
    const step = solveStep(g, puzzle, opts);
    if (!step) break;
    g[step.r][step.c] = step.symbol;
    steps.push(step);
    techniques.add(step.technique);
  }
  const filled = g.every((row) => row.every((v) => v !== EMPTY));
  const solved = filled && validate(g, puzzle).length === 0;
  return { solved, grid: g, steps, techniques: [...techniques] };
}

/** Difficulty tier = the hardest technique needed to solve from the givens. */
export function classify(puzzle) {
  const start = puzzle.solution
    ? emptyWithGivens(puzzle)
    : emptyWithGivens(puzzle);
  const { solved, techniques } = solve(start, puzzle);
  if (!solved) return 'unsolvable';
  if (techniques.some((t) => TIER[t] === 'hard')) return 'hard';
  if (techniques.some((t) => TIER[t] === 'medium')) return 'medium';
  return 'easy';
}

function emptyWithGivens(puzzle) {
  const n = puzzle.n;
  const g = Array.from({ length: n }, () => Array(n).fill(EMPTY));
  for (const gv of puzzle.givens ?? []) g[gv.r][gv.c] = gv.symbol;
  return g;
}

/* ----------------------- uniqueness (brute force) ------------------------ */
// Backtracking search. Used ONLY to verify a puzzle has a unique solution —
// never to generate a hint shown to the player.
export function countSolutions(grid, puzzle, limit = 2) {
  const g = cloneGrid(grid);
  const n = g.length;
  let count = 0;
  const nextEmpty = () => {
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (g[r][c] === EMPTY) return { r, c };
    return null;
  };
  const rec = () => {
    if (count >= limit) return;
    const cell = nextEmpty();
    if (!cell) { count++; return; }
    for (const X of [SUN, MOON]) {
      if (canPlace(g, puzzle, cell.r, cell.c, X)) {
        g[cell.r][cell.c] = X;
        rec();
        g[cell.r][cell.c] = EMPTY;
        if (count >= limit) return;
      }
    }
  };
  rec();
  return count;
}

/**
 * Return the first complete solution by backtracking, or null if none exists.
 * Used for import validation and cheat reveals when a puzzle is unique but not
 * necessarily reachable by the named techniques.
 */
export function firstSolution(grid, puzzle) {
  const g = cloneGrid(grid);
  const n = g.length;
  const nextEmpty = () => {
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (g[r][c] === EMPTY) return { r, c };
    return null;
  };
  const rec = () => {
    const cell = nextEmpty();
    if (!cell) return true;
    for (const X of [SUN, MOON]) {
      if (canPlace(g, puzzle, cell.r, cell.c, X)) {
        g[cell.r][cell.c] = X;
        if (rec()) return true;
        g[cell.r][cell.c] = EMPTY;
      }
    }
    return false;
  };
  return rec() ? g : null;
}

export { TIER };
