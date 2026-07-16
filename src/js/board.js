// Grid model for Tango. Pure data + helpers — no DOM, no state/history here
// (that lives in state.js). A cell is SUN, MOON, or EMPTY (null).

export const SUN = 'sun';
export const MOON = 'moon';
export const EMPTY = null;

/** The other symbol. */
export const OPPOSITE = { [SUN]: MOON, [MOON]: SUN };

/** Left-click cycle:  empty → Sun → Moon → empty */
export function cycleForward(sym) {
  if (sym === EMPTY) return SUN;
  if (sym === SUN) return MOON;
  return EMPTY;
}

/** Right-click cycle: empty → Moon → Sun → empty */
export function cycleBackward(sym) {
  if (sym === EMPTY) return MOON;
  if (sym === MOON) return SUN;
  return EMPTY;
}

/** Stable string key for a coordinate, for use in Sets/Maps. */
export const key = (r, c) => `${r},${c}`;

export function emptyGrid(n) {
  return Array.from({ length: n }, () => Array(n).fill(EMPTY));
}

export function cloneGrid(grid) {
  return grid.map((row) => row.slice());
}

/**
 * Normalise a constraint so `a` is always the top-left cell and record its
 * orientation. Constraints only ever join orthogonally-adjacent cells.
 * @param {{a:{r:number,c:number}, b:{r:number,c:number}, type:'='|'x'}} con
 */
export function normaliseConstraint(con) {
  let { a, b } = con;
  // Order so a comes before b (row-major), giving a stable orientation.
  if (a.r > b.r || (a.r === b.r && a.c > b.c)) [a, b] = [b, a];
  const orient = a.r === b.r ? 'h' : 'v';
  return { a, b, type: con.type, orient };
}

/**
 * Build the starting grid and the set of locked (given) cells from a puzzle.
 * @param {{n:number, givens?:Array<{r,c,symbol}>}} puzzle
 */
export function gridFromPuzzle(puzzle) {
  const grid = emptyGrid(puzzle.n);
  const locked = new Set();
  for (const g of puzzle.givens ?? []) {
    grid[g.r][g.c] = g.symbol;
    locked.add(key(g.r, g.c));
  }
  return { grid, locked };
}

/** Count Suns and Moons (and empties) along a row or column. */
export function lineCounts(grid, type, index) {
  const n = grid.length;
  let sun = 0, moon = 0, empty = 0;
  for (let i = 0; i < n; i++) {
    const v = type === 'row' ? grid[index][i] : grid[i][index];
    if (v === SUN) sun++;
    else if (v === MOON) moon++;
    else empty++;
  }
  return { sun, moon, empty };
}
