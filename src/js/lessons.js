// Tutorial lesson data (no DOM) — separated from the runner (tutorial.js) so it
// can be unit-tested in Node. Each lesson teaches one concept on a distinct
// board and, for every rule, has the learner make the mistake before fixing it.
//
// A step: { text, active, focus, target, gate }
//   active: undefined = normal (givens locked); 'none' = nothing editable;
//           [cells] = only these cells accept input
//   gate:   {type:'next'} | {type:'cell',r,c,symbol} | {type:'violation',rule?} | {type:'solved'}

import { generate } from './generator.js';
import { SUN, MOON, EMPTY } from './board.js';

const g = (r, c, symbol) => ({ r, c, symbol });
const con = (ar, ac, br, bc, type) => ({ a: { r: ar, c: ac }, b: { r: br, c: bc }, type });
const cell = (r, c) => ({ r, c });

export const LESSONS = [
  {
    id: 'basics', title: 'Meet the board', n: 4,
    goal: 'Place and change symbols by clicking.',
    make: () => ({ n: 4, givens: [], constraints: [] }),
    steps: [
      { text: 'Welcome! Every cell holds a Sun or a Moon. Nothing is filled in yet.', active: 'none', gate: { type: 'next' } },
      { text: 'Left-click the highlighted cell to place a Sun.', active: [cell(1, 1)], target: cell(1, 1), gate: { type: 'cell', r: 1, c: 1, symbol: SUN } },
      { text: 'Click it again — a Sun becomes a Moon.', active: [cell(1, 1)], target: cell(1, 1), gate: { type: 'cell', r: 1, c: 1, symbol: MOON } },
      { text: 'Click once more to empty it. (Right-click cycles the other way.)', active: [cell(1, 1)], target: cell(1, 1), gate: { type: 'cell', r: 1, c: 1, symbol: EMPTY } },
      { text: 'That is the whole interaction. Now the rules.', active: 'none', gate: { type: 'next' } },
    ],
  },
  {
    id: 'givens', title: 'Given clues', n: 4,
    goal: 'Tell locked clues apart from cells you fill.',
    make: () => ({ n: 4, givens: [g(0, 0, SUN), g(0, 3, MOON), g(3, 0, MOON), g(3, 3, SUN)], constraints: [] }),
    steps: [
      { text: 'Cells with a small lock are given clues — facts you cannot change. Try clicking one.', focus: [cell(0, 0), cell(0, 3), cell(3, 0), cell(3, 3)], gate: { type: 'next' } },
      { text: 'The empty cells are yours to fill. Place a Sun in the highlighted cell.', active: [cell(1, 1)], target: cell(1, 1), gate: { type: 'cell', r: 1, c: 1, symbol: SUN } },
      { text: 'Given clues are your starting facts — every deduction builds on them.', active: 'none', gate: { type: 'next' } },
    ],
  },
  {
    id: 'triple-row', title: 'No three in a row', n: 6,
    goal: 'See why three identical symbols in a line is illegal.',
    make: () => ({ n: 6, givens: [g(2, 0, SUN), g(2, 1, SUN)], constraints: [] }),
    steps: [
      { text: 'Rule 1: never three identical symbols in a line. Here sit two Suns.', focus: [cell(2, 0), cell(2, 1)], gate: { type: 'next' } },
      { text: 'Place a Sun in the highlighted cell — on purpose — and watch the panel.', active: [cell(2, 2)], target: cell(2, 2), gate: { type: 'violation', rule: 'NO_THREE_IN_A_ROW' } },
      { text: 'Three Suns in a row — the panel shows exactly why. Now change it to a Moon.', active: [cell(2, 2)], target: cell(2, 2), gate: { type: 'cell', r: 2, c: 2, symbol: MOON } },
      { text: 'Two in a row is fine. A third is not. That is Rule 1.', active: 'none', gate: { type: 'next' } },
    ],
  },
  {
    id: 'triple-col', title: 'No three in a column', n: 6,
    goal: 'The same rule, running vertically.',
    make: () => ({ n: 6, givens: [g(0, 3, MOON), g(1, 3, MOON)], constraints: [] }),
    steps: [
      { text: 'Rule 1 works down columns too. Two Moons sit stacked here.', focus: [cell(0, 3), cell(1, 3)], gate: { type: 'next' } },
      { text: 'Place a Moon below them — watch it break.', active: [cell(2, 3)], target: cell(2, 3), gate: { type: 'violation', rule: 'NO_THREE_IN_A_ROW' } },
      { text: 'Three Moons stacked. Fix it with a Sun.', active: [cell(2, 3)], target: cell(2, 3), gate: { type: 'cell', r: 2, c: 3, symbol: SUN } },
      { text: 'Rows and columns follow the same rule.', active: 'none', gate: { type: 'next' } },
    ],
  },
  {
    id: 'sandwich', title: 'Rule 1 as a tool', n: 6,
    goal: 'Use "Sun _ Sun" to deduce the middle.',
    make: () => ({ n: 6, givens: [g(3, 1, SUN), g(3, 3, SUN)], constraints: [] }),
    steps: [
      { text: 'Rule 1 is not just a ban — it is a tool. A Sun sits on each side of the gap.', focus: [cell(3, 1), cell(3, 3)], target: cell(3, 2), gate: { type: 'next' } },
      { text: 'Try a Sun in the middle to see why it cannot go there.', active: [cell(3, 2)], target: cell(3, 2), gate: { type: 'violation', rule: 'NO_THREE_IN_A_ROW' } },
      { text: 'A triple! So the middle must be a Moon. Place it.', active: [cell(3, 2)], target: cell(3, 2), gate: { type: 'cell', r: 3, c: 2, symbol: MOON } },
      { text: 'Sun _ Sun forces a Moon between — a deduction, not a guess.', active: 'none', gate: { type: 'next' } },
    ],
  },
  {
    id: 'balance-row', title: 'Balance in a row', n: 6,
    goal: 'Every line needs equal Suns and Moons.',
    make: () => ({ n: 6, givens: [g(1, 0, SUN), g(1, 2, SUN), g(1, 4, SUN)], constraints: [] }),
    steps: [
      { text: 'Rule 2: every row and column needs the same number of Suns and Moons — three each here.', focus: [cell(1, 0), cell(1, 1), cell(1, 2), cell(1, 3), cell(1, 4), cell(1, 5)], gate: { type: 'next' } },
      { text: 'This row already holds three Suns. Add a fourth in the highlighted cell.', active: [cell(1, 5)], target: cell(1, 5), gate: { type: 'violation', rule: 'BALANCE' } },
      { text: 'Too many Suns — the counter climbs past 3/3. Change it to a Moon.', active: [cell(1, 5)], target: cell(1, 5), gate: { type: 'cell', r: 1, c: 5, symbol: MOON } },
      { text: 'Balance keeps every line exactly half and half.', active: 'none', gate: { type: 'next' } },
    ],
  },
  {
    id: 'balance-complete', title: 'A full line forces the rest', n: 6,
    goal: '"All Suns placed, so the rest are Moons."',
    make: () => ({ n: 6, givens: [g(0, 1, SUN), g(2, 1, SUN), g(4, 1, SUN)], constraints: [] }),
    steps: [
      { text: 'Column 2 already has all three of its Suns.', focus: [cell(0, 1), cell(2, 1), cell(4, 1)], gate: { type: 'next' } },
      { text: 'So what fits the highlighted cell? Try a Sun to test it.', active: [cell(5, 1)], target: cell(5, 1), gate: { type: 'violation', rule: 'BALANCE' } },
      { text: 'A fourth Sun overflows. Every remaining cell must be a Moon — place it.', active: [cell(5, 1)], target: cell(5, 1), gate: { type: 'cell', r: 5, c: 1, symbol: MOON } },
      { text: '"The line is full of Suns, so the rest are Moons" — a fast, common shortcut.', active: 'none', gate: { type: 'next' } },
    ],
  },
  {
    id: 'equals', title: 'The = constraint', n: 4,
    goal: 'Cells joined by = hold the same symbol.',
    make: () => ({ n: 4, givens: [g(0, 0, SUN)], constraints: [con(0, 0, 0, 1, '=')] }),
    steps: [
      { text: 'An = between two cells means they hold the SAME symbol. The left one is a Sun.', focus: [cell(0, 0), cell(0, 1)], gate: { type: 'next' } },
      { text: 'Try a Moon on the right to see the = break.', active: [cell(0, 1)], target: cell(0, 1), gate: { type: 'violation', rule: 'EQUALS' } },
      { text: 'They differ — that breaks the =. Make it a Sun to match.', active: [cell(0, 1)], target: cell(0, 1), gate: { type: 'cell', r: 0, c: 1, symbol: SUN } },
      { text: '= always means "same on both sides."', active: 'none', gate: { type: 'next' } },
    ],
  },
  {
    id: 'cross', title: 'The × constraint', n: 4,
    goal: 'Cells joined by × hold opposite symbols.',
    make: () => ({ n: 4, givens: [g(0, 0, SUN)], constraints: [con(0, 0, 0, 1, 'x')] }),
    steps: [
      { text: 'A × between two cells means OPPOSITE symbols. The left one is a Sun.', focus: [cell(0, 0), cell(0, 1)], gate: { type: 'next' } },
      { text: 'Try a Sun on the right — the × should object.', active: [cell(0, 1)], target: cell(0, 1), gate: { type: 'violation', rule: 'CROSS' } },
      { text: 'Same symbol across a × — not allowed. Make it a Moon.', active: [cell(0, 1)], target: cell(0, 1), gate: { type: 'cell', r: 0, c: 1, symbol: MOON } },
      { text: '× always means "opposites."', active: 'none', gate: { type: 'next' } },
    ],
  },
  {
    id: 'chain', title: 'Chaining = and ×', n: 4,
    goal: 'Follow a chain of constraints across a row.',
    make: () => ({ n: 4, givens: [g(0, 0, SUN)], constraints: [con(0, 0, 0, 1, '='), con(0, 1, 0, 2, 'x'), con(0, 2, 0, 3, '=')] }),
    steps: [
      { text: 'Constraints chain together. This row starts with a Sun and links across.', focus: [cell(0, 0), cell(0, 1), cell(0, 2), cell(0, 3)], gate: { type: 'next' } },
      { text: '= copies the Sun. Place a Sun.', active: [cell(0, 1)], target: cell(0, 1), gate: { type: 'cell', r: 0, c: 1, symbol: SUN } },
      { text: '× flips it. Place a Moon.', active: [cell(0, 2)], target: cell(0, 2), gate: { type: 'cell', r: 0, c: 2, symbol: MOON } },
      { text: '= copies again. Place a Moon.', active: [cell(0, 3)], target: cell(0, 3), gate: { type: 'cell', r: 0, c: 3, symbol: MOON } },
      { text: 'Sun = Sun × Moon = Moon. One clue can ripple across a whole line.', active: 'none', gate: { type: 'next' } },
    ],
  },
  {
    id: 'combine-rules', title: 'Rule 1 + Rule 2 together', n: 6,
    goal: 'Combine no-triple and balance on one row.',
    make: () => ({ n: 6, givens: [g(0, 0, SUN), g(0, 1, SUN), g(0, 4, MOON), g(0, 5, MOON)], constraints: [] }),
    steps: [
      { text: 'Two Suns start this row; two Moons end it. Two cells remain.', focus: [cell(0, 2), cell(0, 3)], gate: { type: 'next' } },
      { text: 'Rule 1: right after two Suns, the next must be a Moon. Place it.', active: [cell(0, 2)], target: cell(0, 2), gate: { type: 'cell', r: 0, c: 2, symbol: MOON } },
      { text: 'Rule 2: the row still needs one more Sun — the last empty cell must be it.', active: [cell(0, 3)], target: cell(0, 3), gate: { type: 'cell', r: 0, c: 3, symbol: SUN } },
      { text: 'Together the rules pin down cells neither could alone.', active: 'none', gate: { type: 'next' } },
    ],
  },
  {
    id: 'combine-constraint', title: 'Constraints + balance', n: 4,
    goal: 'Let a constraint and balance finish a row.',
    make: () => ({ n: 4, givens: [g(3, 3, SUN)], constraints: [con(3, 2, 3, 3, '=')] }),
    steps: [
      { text: 'This = forces its partner; balance then handles the rest of the row.', focus: [cell(3, 0), cell(3, 1), cell(3, 2), cell(3, 3)], gate: { type: 'next' } },
      { text: '= copies the Sun. Place a Sun in the highlighted cell.', active: [cell(3, 2)], target: cell(3, 2), gate: { type: 'cell', r: 3, c: 2, symbol: SUN } },
      { text: 'Now the row has two Suns and needs two Moons. Fill the next cell.', active: [cell(3, 1)], target: cell(3, 1), gate: { type: 'cell', r: 3, c: 1, symbol: MOON } },
      { text: 'And the last one.', active: [cell(3, 0)], target: cell(3, 0), gate: { type: 'cell', r: 3, c: 0, symbol: MOON } },
      { text: 'A whole row solved from one constraint plus balance.', active: 'none', gate: { type: 'next' } },
    ],
  },
  {
    id: 'first-4x4', title: 'Your first 4×4', n: 4, hints: true,
    goal: 'Solve a full 4×4 — hints are available.',
    make: () => generate({ n: 4, difficulty: 'easy', seed: 'tutorial-4x4' }),
    steps: [
      { text: 'Your first full board. Fill every cell so all four rules hold. Stuck? Use the Hint button.', gate: { type: 'solved' } },
      { text: 'Beautifully reasoned — that is a complete, legal board.', active: 'none', gate: { type: 'next' } },
    ],
  },
  {
    id: 'first-6x6', title: 'Your first 6×6', n: 6, hints: true, last: true,
    goal: 'Solve a full 6×6 to graduate.',
    make: () => generate({ n: 6, difficulty: 'easy', seed: 'tutorial-6x6' }),
    steps: [
      { text: 'The graduation board: a full 6×6. Take your time — hints are here whenever you want them.', gate: { type: 'solved' } },
      { text: 'You did it! Every difficulty and board size is now unlocked.', active: 'none', gate: { type: 'next' } },
    ],
  },
];
