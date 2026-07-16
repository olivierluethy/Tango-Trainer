// Tests for import-check.js — validating a transcribed board.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { analyzeImport } from '../src/js/import-check.js';
import { FIXTURE_6 } from '../src/js/puzzles.js';
import { SUN } from '../src/js/board.js';

test('a valid unique board reports "unique" with the correct solution', () => {
  const res = analyzeImport({ n: 6, givens: FIXTURE_6.givens, constraints: FIXTURE_6.constraints });
  assert.equal(res.status, 'unique');
  assert.deepEqual(res.solution, FIXTURE_6.solution);
  assert.equal(res.logicSolvable, true);
});

test('givens that already break a rule report "illegal"', () => {
  const res = analyzeImport({ n: 4, givens: [
    { r: 0, c: 0, symbol: SUN }, { r: 0, c: 1, symbol: SUN }, { r: 0, c: 2, symbol: SUN },
  ] });
  assert.equal(res.status, 'illegal');
  assert.ok(res.violations.length > 0);
});

test('a contradictory board (no completion) reports "none"', () => {
  // Four = links across row 0 force all four cells equal → cannot balance.
  const res = analyzeImport({ n: 4, constraints: [
    { a: { r: 0, c: 0 }, b: { r: 0, c: 1 }, type: '=' },
    { a: { r: 0, c: 1 }, b: { r: 0, c: 2 }, type: '=' },
    { a: { r: 0, c: 2 }, b: { r: 0, c: 3 }, type: '=' },
  ] });
  assert.equal(res.status, 'none');
});

test('an under-constrained board reports "multiple"', () => {
  const res = analyzeImport({ n: 4, givens: [], constraints: [] });
  assert.equal(res.status, 'multiple');
});
