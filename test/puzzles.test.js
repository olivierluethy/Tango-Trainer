// Verifies the hand-authored fixtures are real, valid Tango puzzles: their
// solutions break no rule, and every given/constraint agrees with the solution.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { validate } from '../src/js/rules.js';
import { OPPOSITE } from '../src/js/board.js';
import { FIXTURES } from '../src/js/puzzles.js';

for (const [size, puzzle] of Object.entries(FIXTURES)) {
  test(`fixture ${size}×${size}: solution satisfies all four rules`, () => {
    assert.deepEqual(validate(puzzle.solution, puzzle), []);
  });

  test(`fixture ${size}×${size}: every given matches the solution`, () => {
    for (const g of puzzle.givens) {
      assert.equal(puzzle.solution[g.r][g.c], g.symbol,
        `given at ${g.r},${g.c} disagrees with the solution`);
    }
  });

  test(`fixture ${size}×${size}: constraints agree with the solution`, () => {
    for (const con of puzzle.constraints) {
      const va = puzzle.solution[con.a.r][con.a.c];
      const vb = puzzle.solution[con.b.r][con.b.c];
      if (con.type === '=') assert.equal(va, vb, `= at ${JSON.stringify(con)} should match`);
      else assert.equal(vb, OPPOSITE[va], `× at ${JSON.stringify(con)} should differ`);
    }
  });
}
