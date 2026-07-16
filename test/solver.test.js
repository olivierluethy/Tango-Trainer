// Tests for solver.js — logical solving via named human techniques.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  solveStep, solve, countSolutions, classify,
  deduceConstraint, deducePair, deduceSandwich, deduceBalanceComplete,
} from '../src/js/solver.js';
import { SUN, MOON, EMPTY, gridFromPuzzle } from '../src/js/board.js';
import { FIXTURE_4, FIXTURE_6 } from '../src/js/puzzles.js';

function grid(rows) {
  return rows.map((row) => [...row].map((ch) => (ch === 'S' ? SUN : ch === 'M' ? MOON : EMPTY)));
}
const noCons = { n: 6, constraints: [], givens: [] };

/* ---------------------------- Named techniques --------------------------- */

test('CONSTRAINT_EQUALS: a filled cell forces its "=" partner to match', () => {
  const puzzle = { n: 4, constraints: [{ a: { r: 0, c: 0 }, b: { r: 0, c: 1 }, type: '=' }], givens: [] };
  const g = grid(['S...', '....', '....', '....']);
  const step = solveStep(g, puzzle);
  assert.equal(step.technique, 'CONSTRAINT_EQUALS');
  assert.deepEqual([step.r, step.c, step.symbol], [0, 1, SUN]);
  assert.ok(step.because.length > 0 && typeof step.reason === 'string' && step.reason.length);
});

test('CONSTRAINT_CROSS: a filled cell forces its "×" partner to differ', () => {
  const puzzle = { n: 4, constraints: [{ a: { r: 0, c: 0 }, b: { r: 1, c: 0 }, type: 'x' }], givens: [] };
  const g = grid(['S...', '....', '....', '....']);
  const step = solveStep(g, puzzle);
  assert.equal(step.technique, 'CONSTRAINT_CROSS');
  assert.deepEqual([step.r, step.c, step.symbol], [1, 0, MOON]);
});

test('PAIR_FORCES_NEIGHBOURS: two adjacent equals force the outer neighbour opposite', () => {
  const g = grid(['SS....', '......', '......', '......', '......', '......']);
  const step = deducePair(g, noCons);
  assert.equal(step.technique, 'PAIR_FORCES_NEIGHBOURS');
  assert.deepEqual([step.r, step.c, step.symbol], [0, 2, MOON]);
});

test('SANDWICH: A _ A forces the middle to the opposite of A', () => {
  const g = grid(['S.S...', '......', '......', '......', '......', '......']);
  const step = deduceSandwich(g, noCons);
  assert.equal(step.technique, 'SANDWICH');
  assert.deepEqual([step.r, step.c, step.symbol], [0, 1, MOON]);
});

test('BALANCE_COMPLETE: a line with N/2 of a symbol forces the rest to the other', () => {
  const puzzle = { n: 4, constraints: [], givens: [] };
  const g = grid(['SMS.', '....', '....', '....']); // row0 has 2 suns (n/2), one empty
  const step = deduceBalanceComplete(g, puzzle);
  assert.equal(step.technique, 'BALANCE_COMPLETE');
  assert.deepEqual([step.r, step.c, step.symbol], [0, 3, MOON]);
});

test('solveStep prefers an easy technique over a harder one', () => {
  // Row 0 offers a PAIR (easy) at (0,2); row 2 offers only a SANDWICH (medium).
  const g = grid(['SS....', '......', 'M.M...', '......', '......', '......']);
  const step = solveStep(g, noCons);
  assert.equal(step.technique, 'PAIR_FORCES_NEIGHBOURS');
});

/* ------------------------------ Full solving ---------------------------- */

for (const [label, puzzle] of [['4×4', FIXTURE_4], ['6×6', FIXTURE_6]]) {
  test(`solve completes the ${label} fixture and matches its solution`, () => {
    const { grid: start } = gridFromPuzzle(puzzle);
    const res = solve(start, puzzle);
    assert.equal(res.solved, true);
    assert.deepEqual(res.grid, puzzle.solution);
  });

  test(`every solve step for the ${label} fixture is sound (matches the solution)`, () => {
    const { grid: start } = gridFromPuzzle(puzzle);
    const res = solve(start, puzzle);
    for (const s of res.steps) {
      assert.equal(s.symbol, puzzle.solution[s.r][s.c],
        `${s.technique} placed the wrong symbol at ${s.r},${s.c}`);
    }
  });

  test(`solve does not mutate the input grid for the ${label} fixture`, () => {
    const { grid: start } = gridFromPuzzle(puzzle);
    const before = start.map((r) => r.slice());
    solve(start, puzzle);
    assert.deepEqual(start, before);
  });
}

/* ------------------------------ Uniqueness ------------------------------ */

test('countSolutions returns exactly 1 for a uniquely-solvable fixture', () => {
  const { grid: start } = gridFromPuzzle(FIXTURE_6);
  assert.equal(countSolutions(start, FIXTURE_6, 2), 1);
});

test('countSolutions finds more than one solution for an unconstrained board', () => {
  const puzzle = { n: 4, constraints: [], givens: [] };
  const { grid: start } = gridFromPuzzle(puzzle);
  assert.ok(countSolutions(start, puzzle, 2) > 1);
});

/* ----------------------------- Classification --------------------------- */

test('the shipped fixtures classify as easy', () => {
  assert.equal(classify(FIXTURE_4), 'easy');
  assert.equal(classify(FIXTURE_6), 'easy');
});

// A minimal clue set (same 6×6 solution) that requires the advanced techniques.
// Exercises BALANCE_AVOID_TRIPLE and CONTRADICTION and proves they are sound.
const HARD_6 = {
  n: 6,
  constraints: FIXTURE_6.constraints,
  givens: [[0, 0], [1, 4], [2, 3], [4, 1], [4, 2], [4, 4]].map(([r, c]) => ({ r, c, symbol: FIXTURE_6.solution[r][c] })),
  solution: FIXTURE_6.solution,
};

test('a hard clue set is uniquely solvable and drives the advanced techniques', () => {
  const { grid: start } = gridFromPuzzle(HARD_6);
  assert.equal(countSolutions(start, HARD_6, 2), 1);
  const res = solve(start, HARD_6);
  assert.equal(res.solved, true);
  assert.deepEqual(res.grid, HARD_6.solution);
  // Every step is sound…
  for (const s of res.steps) assert.equal(s.symbol, HARD_6.solution[s.r][s.c]);
  // …and the hard technique is genuinely needed here.
  assert.ok(res.techniques.includes('CONTRADICTION'));
  assert.equal(classify(HARD_6), 'hard');
});
