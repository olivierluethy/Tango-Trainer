// The graded hint ladder. Hints are never "just the answer": each one names its
// technique and can animate its derivation. Built entirely on solver.js, which
// works with named human techniques — so a hint always explains its reasoning.

import { validate } from './rules.js';
import { solveStep } from './solver.js';

// Technique → the rule it draws on + a short human name, for hint levels 2–4.
export const TECHNIQUE_INFO = {
  PAIR_FORCES_NEIGHBOURS: { name: 'Pair forces the neighbour', ruleNo: 1, rule: 'No three in a row' },
  SANDWICH: { name: 'Sandwich', ruleNo: 1, rule: 'No three in a row' },
  BALANCE_COMPLETE: { name: 'Line already complete', ruleNo: 2, rule: 'Balance' },
  BALANCE_AVOID_TRIPLE: { name: 'Avoid a forced triple', ruleNo: 2, rule: 'Balance' },
  CONSTRAINT_EQUALS: { name: 'Equals link', ruleNo: 3, rule: 'Equals ( = )' },
  CONSTRAINT_CROSS: { name: 'Cross link', ruleNo: 4, rule: 'Cross ( × )' },
  CONSTRAINT_CHAIN: { name: 'Chained constraints', ruleNo: null, rule: 'Constraints + balance' },
  CONTRADICTION: { name: 'Proof by contradiction', ruleNo: null, rule: 'Pure logic' },
};

/**
 * Compute the current hint.
 * @returns {{kind:'fix'|'solved'|'stuck'|'step', ...}}
 *   - 'fix'   → a rule is currently broken; fix it before asking for the next move.
 *   - 'solved'→ the board is complete.
 *   - 'stuck' → no logical move (a legal-but-wrong entry has made it unsolvable).
 *   - 'step'  → { step, region, target } graded reveal data.
 */
export function computeHint(state) {
  const vs = validate(state.grid, state.puzzle);
  if (vs.length) return { kind: 'fix', count: vs.length };
  if (state.isFilled()) return { kind: 'solved' };

  const step = solveStep(state.grid, state.puzzle);
  if (!step) return { kind: 'stuck' };

  return {
    kind: 'step',
    step,
    target: { r: step.r, c: step.c },
    region: regionFor(step, state.n),
    where: whereText(step, state.n),
  };
}

// The cells to highlight at hint level 1 (the neighbourhood of the deduction).
function regionFor(step, n) {
  if (step.line) {
    const cells = [];
    for (let i = 0; i < n; i++) {
      cells.push(step.line.type === 'row' ? { r: step.line.index, c: i } : { r: i, c: step.line.index });
    }
    return cells;
  }
  const cells = [{ r: step.r, c: step.c }, ...(step.because ?? [])];
  return cells;
}

function whereText(step, n) {
  if (step.line) {
    return `Look at ${step.line.type === 'row' ? 'row' : 'column'} ${step.line.index + 1}.`;
  }
  const cells = [{ r: step.r, c: step.c }, ...(step.because ?? [])];
  const sameRow = cells.every((c) => c.r === cells[0].r);
  const sameCol = cells.every((c) => c.c === cells[0].c);
  if (sameRow) return `Look at row ${cells[0].r + 1}.`;
  if (sameCol) return `Look at column ${cells[0].c + 1}.`;
  return `Look near row ${step.r + 1}, column ${step.c + 1}.`;
}
