// Tests for generator.js — unique-solution puzzle generation by difficulty.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { generate, randomSolvedGrid, makeRng } from '../src/js/generator.js';
import { validate } from '../src/js/rules.js';
import { solve, countSolutions, classify } from '../src/js/solver.js';
import { gridFromPuzzle, SUN, MOON, EMPTY, OPPOSITE } from '../src/js/board.js';

function isValidSolution(grid) {
  const n = grid.length;
  if (validate(grid, { n, constraints: [] }).length) return false;
  // every cell filled, every line balanced
  for (let r = 0; r < n; r++) {
    let s = 0, m = 0;
    for (let c = 0; c < n; c++) {
      if (grid[r][c] === EMPTY) return false;
      if (grid[r][c] === SUN) s++; else m++;
    }
    if (s !== n / 2 || m !== n / 2) return false;
  }
  return true;
}

test('makeRng is deterministic for a given seed', () => {
  const a = makeRng('hello');
  const b = makeRng('hello');
  const seqA = [a(), a(), a()];
  const seqB = [b(), b(), b()];
  assert.deepEqual(seqA, seqB);
  assert.notDeepEqual(seqA, [makeRng('world')(), 0, 0].slice(0, 1));
});

for (const n of [4, 6]) {
  test(`randomSolvedGrid(${n}) produces a valid, balanced, triple-free solution`, () => {
    const grid = randomSolvedGrid(n, makeRng(`seed-${n}`));
    assert.equal(isValidSolution(grid), true);
  });
}

test('generated easy 6×6 puzzle is unique, logic-solvable, and classified easy', () => {
  const p = generate({ n: 6, difficulty: 'easy', seed: 'easy-1' });
  assert.equal(p.n, 6);
  assert.ok(p.givens.length > 0);
  assert.equal(isValidSolution(p.solution), true);

  const { grid: start } = gridFromPuzzle(p);
  assert.equal(countSolutions(start, p, 2), 1, 'must have exactly one solution');
  const res = solve(start, p);
  assert.equal(res.solved, true, 'must be solvable by pure logic');
  assert.deepEqual(res.grid, p.solution);
  assert.equal(classify(p), 'easy');
});

test('givens and constraints agree with the generated solution', () => {
  const p = generate({ n: 6, difficulty: 'easy', seed: 'agree-1' });
  for (const g of p.givens) assert.equal(p.solution[g.r][g.c], g.symbol);
  for (const con of p.constraints) {
    const va = p.solution[con.a.r][con.a.c];
    const vb = p.solution[con.b.r][con.b.c];
    if (con.type === '=') assert.equal(va, vb);
    else assert.equal(vb, OPPOSITE[va]);
  }
});

test('generation is reproducible for the same seed + size + difficulty', () => {
  const a = generate({ n: 6, difficulty: 'easy', seed: 'repro-42' });
  const b = generate({ n: 6, difficulty: 'easy', seed: 'repro-42' });
  assert.deepEqual(a.solution, b.solution);
  assert.deepEqual(a.givens, b.givens);
  assert.deepEqual(a.constraints, b.constraints);
});

for (const difficulty of ['easy', 'medium', 'hard']) {
  test(`generated ${difficulty} 6×6 puzzle matches its requested difficulty`, () => {
    const p = generate({ n: 6, difficulty, seed: `diff-${difficulty}` });
    const { grid: start } = gridFromPuzzle(p);
    assert.equal(countSolutions(start, p, 2), 1);
    assert.equal(solve(start, p).solved, true);
    assert.equal(classify(p), difficulty);
  });
}

test('generates a valid 8×8 puzzle (unique + logic-solvable)', () => {
  const p = generate({ n: 8, difficulty: 'easy', seed: '8x8-1' });
  assert.equal(isValidSolution(p.solution), true);
  const { grid: start } = gridFromPuzzle(p);
  assert.equal(solve(start, p).solved, true);
  assert.equal(countSolutions(start, p, 2), 1);
});
