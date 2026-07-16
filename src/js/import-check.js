// DOM-free validation of a transcribed board (separated from import.js so it is
// unit-testable in Node). Reports whether the board is illegal, unsolvable,
// ambiguous, or a clean single-solution puzzle.

import { gridFromPuzzle } from './board.js';
import { validate } from './rules.js';
import { countSolutions, firstSolution, solve } from './solver.js';

/**
 * @param {{n:number, givens?:Array, constraints?:Array}} board
 * @returns {{status:'illegal'|'none'|'multiple'|'unique', violations?, solution?, logicSolvable?}}
 */
export function analyzeImport({ n, givens = [], constraints = [] }) {
  const puzzle = { n, givens, constraints };
  const { grid } = gridFromPuzzle(puzzle);
  const violations = validate(grid, puzzle);
  if (violations.length) return { status: 'illegal', violations };
  const count = countSolutions(grid, puzzle, 2);
  if (count === 0) return { status: 'none' };
  if (count > 1) return { status: 'multiple' };
  return { status: 'unique', solution: firstSolution(grid, puzzle), logicSolvable: solve(grid, puzzle).solved };
}
