// Validation → structured Violation objects (never strings). Every violation
// carries the exact offending cells and enough context for the explanation
// engine (Phase 4) to highlight, animate, and explain WHAT / WHY / HOW.
//
// A Violation:
//   { id, rule, severity, cells:[{r,c}], edge, line, counts,
//     headline, why, fix, fixPreview:[{r,c,symbol}] }

import { SUN, MOON, EMPTY, OPPOSITE, key, normaliseConstraint } from './board.js';

const NAME = { [SUN]: 'Sun', [MOON]: 'Moon' };
const PLURAL = { [SUN]: 'Suns', [MOON]: 'Moons' };
const COUNT_WORD = { 3: 'Three', 4: 'Four', 5: 'Five', 6: 'Six', 7: 'Seven', 8: 'Eight', 9: 'Nine', 10: 'Ten' };

function lockedSet(puzzle) {
  const s = new Set();
  for (const g of puzzle?.givens ?? []) s.add(key(g.r, g.c));
  return s;
}

/**
 * Validate a grid against all four rules.
 * @param {(string|null)[][]} grid
 * @param {{n?:number, constraints?:Array, givens?:Array}} [puzzle]
 * @returns {Array} violations
 */
export function validate(grid, puzzle = {}) {
  const n = grid.length;
  const locked = lockedSet(puzzle);
  const out = [];
  let seq = 0;
  const nextId = () => `v_${++seq}`;

  const isLocked = (r, c) => locked.has(key(r, c));
  /** Choose a changeable cell from `candidates` (prefer non-locked), return its fix. */
  const pickFix = (candidates, symbol) => {
    const free = candidates.find((c) => !isLocked(c.r, c.c)) ?? candidates[0];
    return [{ r: free.r, c: free.c, symbol }];
  };

  // --- Rule 1: no three in a row (maximal runs ≥ 3, in rows and columns) ---
  const scanRuns = (type) => {
    for (let a = 0; a < n; a++) {
      let start = 0;
      for (let b = 1; b <= n; b++) {
        const cur = b < n ? (type === 'row' ? grid[a][b] : grid[b][a]) : null;
        const prev = type === 'row' ? grid[a][b - 1] : grid[b - 1][a];
        const same = b < n && cur !== EMPTY && cur === prev;
        if (same) continue;
        const runLen = b - start;
        const sym = type === 'row' ? grid[a][start] : grid[start][a];
        if (sym !== EMPTY && runLen >= 3) {
          const cells = [];
          for (let i = start; i < b; i++) {
            cells.push(type === 'row' ? { r: a, c: i } : { r: i, c: a });
          }
          const lineLabel = type === 'row' ? `Row ${a + 1}` : `Column ${a + 1}`;
          const other = OPPOSITE[sym];
          // Prefer flipping an interior cell (breaks the run), but fall back to
          // the endpoints so a locked interior never blocks the suggested fix.
          const interior = cells.slice(1, -1);
          const ordered = [...interior, ...cells.filter((c) => !interior.includes(c))];
          const fix = pickFix(ordered, other);
          out.push({
            id: nextId(),
            rule: 'NO_THREE_IN_A_ROW',
            severity: 'error',
            cells,
            edge: null,
            line: { type, index: a },
            counts: null,
            headline: `${COUNT_WORD[runLen] ?? runLen} ${PLURAL[sym]} in a ${type === 'row' ? 'row' : 'column'}`,
            why: `Rule 1 says at most two identical symbols may touch in a line. ${lineLabel} has ${runLen} ${PLURAL[sym]} in a row.`,
            fix: `Change one of the highlighted cells to a ${NAME[other]}.`,
            fixPreview: fix,
          });
        }
        start = b;
      }
    }
  };
  scanRuns('row');
  scanRuns('col');

  // --- Rule 2: balance (a line with more than n/2 of one symbol) -----------
  const half = n / 2;
  const scanBalance = (type) => {
    for (let a = 0; a < n; a++) {
      let sun = 0, moon = 0;
      const sunCells = [], moonCells = [];
      for (let i = 0; i < n; i++) {
        const v = type === 'row' ? grid[a][i] : grid[i][a];
        const cell = type === 'row' ? { r: a, c: i } : { r: i, c: a };
        if (v === SUN) { sun++; sunCells.push(cell); }
        else if (v === MOON) { moon++; moonCells.push(cell); }
      }
      const over = sun > half ? SUN : moon > half ? MOON : null;
      if (!over) continue;
      const overCells = over === SUN ? sunCells : moonCells;
      const overCount = over === SUN ? sun : moon;
      const other = OPPOSITE[over];
      const lineLabel = type === 'row' ? `Row ${a + 1}` : `Column ${a + 1}`;
      out.push({
        id: nextId(),
        rule: 'BALANCE',
        severity: 'error',
        cells: overCells,
        edge: null,
        line: { type, index: a },
        counts: { sun, moon, max: half },
        headline: `Too many ${PLURAL[over]} in ${type === 'row' ? 'this row' : 'this column'}`,
        why: `Rule 2 says every ${type} needs exactly ${half} ${PLURAL[SUN]} and ${half} ${PLURAL[MOON]}. ${lineLabel} already has ${overCount} ${PLURAL[over]}.`,
        fix: `Change one ${NAME[over]} in ${lineLabel} to a ${NAME[other]}.`,
        fixPreview: pickFix(overCells, other),
      });
    }
  };
  scanBalance('row');
  scanBalance('col');

  // --- Rules 3 & 4: edge constraints ( = and × ) --------------------------
  for (const raw of puzzle?.constraints ?? []) {
    const con = normaliseConstraint(raw);
    const va = grid[con.a.r][con.a.c];
    const vb = grid[con.b.r][con.b.c];
    if (va === EMPTY || vb === EMPTY) continue; // not yet decidable

    if (con.type === '=' && va !== vb) {
      out.push(edgeViolation('EQUALS', con, va, vb, isLocked, nextId,
        'These two cells must match',
        'Rule 3: an “=” sign means both joined cells hold the same symbol. Right now they differ.',
        'Make both cells the same symbol.',
        // fix: set b to match a (prefer the non-locked side)
        matchFix(con, va, vb, isLocked)));
    } else if (con.type === 'x' && va === vb) {
      out.push(edgeViolation('CROSS', con, va, vb, isLocked, nextId,
        'These two cells must differ',
        'Rule 4: a “×” sign means the joined cells hold opposite symbols. Right now they’re the same.',
        'Change one of them to the opposite symbol.',
        opposeFix(con, va, vb, isLocked)));
    }
  }

  return out;
}

function edgeViolation(rule, con, va, vb, isLocked, nextId, headline, why, fix, fixPreview) {
  return {
    id: nextId(),
    rule,
    severity: 'error',
    cells: [{ ...con.a }, { ...con.b }],
    edge: { a: { ...con.a }, b: { ...con.b }, type: con.type },
    line: null,
    counts: null,
    headline,
    why,
    fix,
    fixPreview,
  };
}

// For '=' with va !== vb: flip one side so they match. Prefer changing a
// non-locked cell; the target symbol is the value of the side we keep.
function matchFix(con, va, vb, isLocked) {
  if (!isLocked(con.b.r, con.b.c)) return [{ r: con.b.r, c: con.b.c, symbol: va }];
  return [{ r: con.a.r, c: con.a.c, symbol: vb }];
}

// For '×' with va === vb: flip one side to the opposite. Prefer non-locked.
function opposeFix(con, va, vb, isLocked) {
  if (!isLocked(con.b.r, con.b.c)) return [{ r: con.b.r, c: con.b.c, symbol: OPPOSITE[va] }];
  return [{ r: con.a.r, c: con.a.c, symbol: OPPOSITE[vb] }];
}

/** True when every cell is filled and no rule is broken. */
export function isSolved(grid, puzzle = {}) {
  const filled = grid.every((row) => row.every((v) => v !== EMPTY));
  return filled && validate(grid, puzzle).length === 0;
}
