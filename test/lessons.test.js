// Validates the tutorial lesson scripts (lessons.js) are correct: givens are
// legal, each "make the mistake" step really triggers its intended rule, each
// correct placement keeps the board legal, and the two solve-it lessons are
// genuinely solvable.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { LESSONS } from '../src/js/lessons.js';
import { validate } from '../src/js/rules.js';
import { solve, countSolutions } from '../src/js/solver.js';
import { gridFromPuzzle, OPPOSITE, EMPTY } from '../src/js/board.js';

test('there are 14 lessons with unique ids', () => {
  assert.equal(LESSONS.length, 14);
  assert.equal(new Set(LESSONS.map((l) => l.id)).size, 14);
});

test('every lesson covers a distinct scenario (no two identical given sets)', () => {
  const sigs = LESSONS.filter((l) => !l.hints).map((l) => {
    const p = l.make();
    return JSON.stringify({ givens: p.givens, constraints: p.constraints });
  });
  assert.equal(new Set(sigs).size, sigs.length);
});

for (const lesson of LESSONS) {
  test(`lesson "${lesson.id}": givens are legal and steps are sound`, () => {
    const puzzle = lesson.make();
    const { grid } = gridFromPuzzle(puzzle);

    // Generated solve-it lessons: just prove they're solvable + unique.
    if (lesson.hints) {
      assert.equal(solve(grid, puzzle).solved, true, 'solve-it lesson must be solvable');
      assert.equal(countSolutions(grid, puzzle, 2), 1, 'solve-it lesson must be unique');
      return;
    }

    // Givens must not already break a rule.
    assert.deepEqual(validate(grid, puzzle), [], 'givens must be legal');

    const steps = lesson.steps;
    const work = grid.map((r) => r.slice());
    steps.forEach((step, i) => {
      const gate = step.gate;
      if (gate.type === 'violation') {
        // The mistake symbol is the opposite of the following fix step's symbol.
        const fix = steps[i + 1];
        assert.equal(fix?.gate?.type, 'cell', 'a violation step must be followed by a fix');
        const mistake = OPPOSITE[fix.gate.symbol];
        work[fix.gate.r][fix.gate.c] = mistake;
        const vs = validate(work, puzzle);
        assert.ok(vs.some((v) => v.rule === gate.rule),
          `mistake in "${lesson.id}" should trigger ${gate.rule}, got [${vs.map((v) => v.rule)}]`);
      } else if (gate.type === 'cell') {
        work[gate.r][gate.c] = gate.symbol;
        if (gate.symbol !== EMPTY) {
          assert.deepEqual(validate(work, puzzle), [],
            `correct placement in "${lesson.id}" at ${gate.r},${gate.c} should stay legal`);
        }
      }
    });
  });
}
