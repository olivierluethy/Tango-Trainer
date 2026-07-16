// Hand-authored, rule-verified puzzle fixtures. These are TEMPORARY development
// data so the board is genuinely playable before the generator lands in Phase 6.
// They are real, valid Tango solutions (not random filler): each `solutionRows`
// grid satisfies all four rules, and givens/constraints are derived FROM that
// solution so they can never contradict it. `npm test` (Phase 3+) will assert
// their validity. The generator replaces this module as the puzzle source.

import { SUN, MOON } from './board.js';

const S = SUN, M = MOON;

/** Parse rows like "SMSMMS" into a symbol grid. */
function parse(rows) {
  return rows.map((row) => [...row].map((ch) => (ch === 'S' ? S : M)));
}

/**
 * Build a puzzle. Givens are coordinates; their symbol is read from the
 * solution, so a typo can only ever drop a clue, never introduce a wrong one.
 */
function makePuzzle({ n, seed, difficulty, solutionRows, givenCoords, constraintSpecs = [] }) {
  const solution = parse(solutionRows);
  const givens = givenCoords.map(([r, c]) => ({ r, c, symbol: solution[r][c] }));
  const constraints = constraintSpecs.map(([ar, ac, br, bc, type]) => ({
    a: { r: ar, c: ac }, b: { r: br, c: bc }, type,
  }));
  return { n, seed, difficulty, solution, givens, constraints };
}

export const FIXTURE_6 = makePuzzle({
  n: 6,
  seed: 'fixture-6a',
  difficulty: 'easy',
  solutionRows: [
    'SMSMMS',
    'MSMSSM',
    'SSMMSM',
    'MMSSMS',
    'SMMSSM',
    'MSSMMS',
  ],
  // Reduced to a minimal clue set that is uniquely solvable by easy techniques
  // (verified by solver.js: countSolutions === 1, classify === 'easy').
  givenCoords: [
    [1, 1], [1, 4], [2, 3], [4, 1], [4, 2], [4, 4],
  ],
  constraintSpecs: [
    [0, 3, 0, 4, '='],  // M = M
    [2, 0, 2, 1, '='],  // S = S
    [0, 2, 0, 3, 'x'],  // S × M
    [4, 4, 4, 5, 'x'],  // S × M
    [3, 0, 4, 0, 'x'],  // M × S (vertical)
    [1, 1, 2, 1, '='],  // S = S (vertical)
  ],
});

export const FIXTURE_4 = makePuzzle({
  n: 4,
  seed: 'fixture-4a',
  difficulty: 'easy',
  solutionRows: [
    'SMSM',
    'MSMS',
    'SMMS',
    'MSSM',
  ],
  givenCoords: [[0, 0], [0, 2], [2, 1]],
  constraintSpecs: [
    [2, 1, 2, 2, '='],  // M = M
    [0, 0, 0, 1, 'x'],  // S × M
    [0, 3, 1, 3, 'x'],  // M × S (vertical)
  ],
});

export const FIXTURES = { 4: FIXTURE_4, 6: FIXTURE_6 };
