// Puzzle generation. Build a random valid solved grid, sprinkle =/× clues
// consistent with it, then remove clues while the puzzle stays solvable by pure
// logic. Because the solver only ever makes forced moves, "fully solvable by
// logic" already implies "unique solution" — so reduction uses solve() (fast),
// and countSolutions (backtracking) is kept for independent verification.
//
// Difficulty is measured by the hardest technique the solver needs (classify).

import { SUN, MOON, EMPTY, cloneGrid } from './board.js';
import { canPlace, solve, classify, TIER } from './solver.js';

const RANK = { easy: 0, medium: 1, hard: 2 };

/* ------------------------------- seeded RNG ------------------------------ */
function xmur3(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}
function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** A seeded PRNG (0..1) from any string. */
export function makeRng(seed) {
  return mulberry32(xmur3(String(seed))());
}

function shuffle(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/* --------------------------- random solved grid -------------------------- */
export function randomSolvedGrid(n, rng) {
  const puzzle = { n, constraints: [] };
  const grid = Array.from({ length: n }, () => Array(n).fill(EMPTY));
  const fill = (pos) => {
    if (pos === n * n) return true;
    const r = (pos / n) | 0, c = pos % n;
    const order = rng() < 0.5 ? [SUN, MOON] : [MOON, SUN];
    for (const X of order) {
      if (canPlace(grid, puzzle, r, c, X)) {
        grid[r][c] = X;
        if (fill(pos + 1)) return true;
        grid[r][c] = EMPTY;
      }
    }
    return false;
  };
  if (!fill(0)) throw new Error(`could not build a ${n}×${n} solution`);
  return grid;
}

/* ---------------------------- candidate clues ---------------------------- */
function candidateConstraints(solution, rng) {
  const n = solution.length;
  const edges = [];
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (c + 1 < n) edges.push({ a: { r, c }, b: { r, c: c + 1 } });
      if (r + 1 < n) edges.push({ a: { r, c }, b: { r: r + 1, c } });
    }
  }
  shuffle(edges, rng);
  const k = Math.min(edges.length, Math.round(n * 1.5));
  return edges.slice(0, k).map((e) => ({
    a: e.a, b: e.b,
    type: solution[e.a.r][e.a.c] === solution[e.b.r][e.b.c] ? '=' : 'x',
  }));
}

/* -------------------------------- reduction ------------------------------ */
function tierOf(techniques) {
  if (techniques.some((t) => TIER[t] === 'hard')) return 'hard';
  if (techniques.some((t) => TIER[t] === 'medium')) return 'medium';
  return 'easy';
}

function startGrid(n, givenSet, solution) {
  const g = Array.from({ length: n }, () => Array(n).fill(EMPTY));
  for (const k of givenSet) { const [r, c] = k.split(',').map(Number); g[r][c] = solution[r][c]; }
  return g;
}

// Greedily remove clues (givens + constraints) in random order while the puzzle
// stays fully logic-solvable and no harder than `cap`.
function reduce({ n, solution, constraints }, cap, rng) {
  const givens = new Set();
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) givens.add(`${r},${c}`);
  const cons = constraints.slice();
  const consActive = cons.map(() => true);

  const buildPuzzle = () => ({
    n, solution,
    constraints: cons.filter((_, i) => consActive[i]),
    givens: [...givens].map((k) => { const [r, c] = k.split(',').map(Number); return { r, c, symbol: solution[r][c] }; }),
  });

  const clues = [
    ...[...givens].map((k) => ({ kind: 'given', k })),
    ...cons.map((_, i) => ({ kind: 'con', i })),
  ];
  shuffle(clues, rng);

  for (const clue of clues) {
    if (clue.kind === 'given') {
      if (!givens.has(clue.k)) continue;
      givens.delete(clue.k);
      if (!accepts(buildPuzzle(), cap)) givens.add(clue.k);
    } else {
      if (!consActive[clue.i]) continue;
      consActive[clue.i] = false;
      if (!accepts(buildPuzzle(), cap)) consActive[clue.i] = true;
    }
  }
  return buildPuzzle();
}

function accepts(puzzle, cap) {
  const start = startGrid(puzzle.n, new Set(puzzle.givens.map((g) => `${g.r},${g.c}`)), puzzle.solution);
  const res = solve(start, puzzle);
  return res.solved && RANK[tierOf(res.techniques)] <= RANK[cap];
}

/* -------------------------------- finalise ------------------------------- */
function normaliseCon(con) {
  let { a, b } = con;
  if (a.r > b.r || (a.r === b.r && a.c > b.c)) [a, b] = [b, a];
  return { a: { ...a }, b: { ...b }, type: con.type };
}

function finalize(puzzle, seed, difficulty) {
  const givens = puzzle.givens.slice().sort((x, y) => x.r - y.r || x.c - y.c);
  const constraints = puzzle.constraints.map(normaliseCon)
    .sort((x, y) => x.a.r - y.a.r || x.a.c - y.a.c || x.b.r - y.b.r || x.b.c - y.b.c);
  return { n: puzzle.n, seed, difficulty, solution: puzzle.solution.map((r) => r.slice()), givens, constraints };
}

/* -------------------------------- generate ------------------------------- */
/**
 * Generate a puzzle.
 * @param {Object} opts
 * @param {number} [opts.n=6]
 * @param {'easy'|'medium'|'hard'} [opts.difficulty='easy']
 * @param {string} [opts.seed]
 * @param {number} [opts.maxAttempts=60]
 * @param {(frac:number)=>void} [opts.onProgress]
 * @returns {Object} puzzle { n, seed, difficulty, solution, givens, constraints }
 */
export function generate({ n = 6, difficulty = 'easy', seed, maxAttempts = 60, onProgress } = {}) {
  seed = seed ?? defaultSeed();
  let fallback = null;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    onProgress?.(attempt / maxAttempts);
    const rng = makeRng(`${seed}#${n}#${difficulty}#${attempt}`);
    const solution = randomSolvedGrid(n, rng);
    const constraints = candidateConstraints(solution, rng);
    const puzzle = reduce({ n, solution, constraints }, difficulty, rng);
    const tier = classify(puzzle);
    if (tier === difficulty) { onProgress?.(1); return finalize(puzzle, seed, difficulty); }
    // Remember the closest attempt in case the target is unreachable.
    if (!fallback || Math.abs(RANK[tier] - RANK[difficulty]) < fallback.dist) {
      fallback = { puzzle, tier, dist: Math.abs(RANK[tier] - RANK[difficulty]) };
    }
  }
  onProgress?.(1);
  return finalize(fallback.puzzle, seed, fallback.tier);
}

function defaultSeed() {
  // Runtime-only randomness; tests always pass an explicit seed.
  return Math.random().toString(36).slice(2, 9);
}
