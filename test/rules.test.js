// Tests for rules.js — structured violation detection.
// Run with: npm test   (node --test test/)

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { validate, isSolved } from '../src/js/rules.js';
import { SUN, MOON, EMPTY } from '../src/js/board.js';

/** Build a grid from rows of 'S' (sun), 'M' (moon), '.' (empty). */
function grid(rows) {
  return rows.map((row) => [...row].map((ch) => (ch === 'S' ? SUN : ch === 'M' ? MOON : EMPTY)));
}

// A fully valid 6×6 solution (no rule broken).
const SOLVED_6 = grid([
  'SMSMMS',
  'MSMSSM',
  'SSMMSM',
  'MMSSMS',
  'SMMSSM',
  'MSSMMS',
]);

const SOLVED_4 = grid([
  'SMSM',
  'MSMS',
  'SMMS',
  'MSSM',
]);

test('a fully valid solution has no violations', () => {
  assert.deepEqual(validate(SOLVED_6), []);
  assert.deepEqual(validate(SOLVED_4), []);
});

test('isSolved is true for a complete valid grid, false otherwise', () => {
  assert.equal(isSolved(SOLVED_6), true);
  const partial = grid(['SMSMM.', 'MSMSSM', 'SSMMSM', 'MMSSMS', 'SMMSSM', 'MSSMMS']);
  assert.equal(isSolved(partial), false); // not filled
});

test('an empty board has no violations (nothing broken yet)', () => {
  const g = grid(['....', '....', '....', '....']);
  assert.deepEqual(validate(g), []);
});

/* ------------------------- Rule 1: no three in a row --------------------- */

test('three identical suns horizontally is one NO_THREE_IN_A_ROW error', () => {
  const g = grid(['SSSM', 'MMSS', 'SMMS', 'MSSM']); // wait: keep row0 focus
  const vs = validate(g).filter((v) => v.rule === 'NO_THREE_IN_A_ROW' && v.line.type === 'row' && v.line.index === 0);
  assert.equal(vs.length, 1);
  const v = vs[0];
  assert.equal(v.severity, 'error');
  assert.deepEqual(v.cells, [{ r: 0, c: 0 }, { r: 0, c: 1 }, { r: 0, c: 2 }]);
  assert.equal(v.edge, null);
  assert.ok(typeof v.headline === 'string' && v.headline.length > 0);
  assert.ok(/rule 1/i.test(v.why));
  assert.ok(typeof v.fix === 'string' && v.fix.length > 0);
});

test('three in a row fixPreview flips one of the run cells to the opposite symbol', () => {
  const g = grid(['SSSM', 'MMMS', 'SMSM', 'MSMS']);
  const v = validate(g).find((v) => v.rule === 'NO_THREE_IN_A_ROW' && v.line.index === 0);
  assert.equal(v.fixPreview.length, 1);
  const fp = v.fixPreview[0];
  assert.equal(fp.symbol, MOON); // opposite of sun
  assert.ok(v.cells.some((c) => c.r === fp.r && c.c === fp.c)); // targets a run cell
});

test('three identical moons vertically is a NO_THREE_IN_A_ROW column error', () => {
  const g = grid(['MSSM', 'MSMS', 'MSSM', 'SMMS']); // col 0 = M,M,M,S
  const v = validate(g).find((v) => v.rule === 'NO_THREE_IN_A_ROW' && v.line.type === 'col' && v.line.index === 0);
  assert.ok(v);
  assert.deepEqual(v.cells, [{ r: 0, c: 0 }, { r: 1, c: 0 }, { r: 2, c: 0 }]);
});

test('a run of four is reported as a single violation spanning four cells', () => {
  const g = grid(['SSSS', 'M...', 'M...', 'M...']);
  const runs = validate(g).filter((v) => v.rule === 'NO_THREE_IN_A_ROW' && v.line.type === 'row' && v.line.index === 0);
  assert.equal(runs.length, 1);
  assert.equal(runs[0].cells.length, 4);
});

test('two in a row is allowed (no violation)', () => {
  const g = grid(['SSMM', 'MMSS', 'SMSM', 'MSMS']);
  const three = validate(g).filter((v) => v.rule === 'NO_THREE_IN_A_ROW');
  assert.equal(three.length, 0);
});

test('an incomplete triple (one cell empty) is not yet a violation', () => {
  const g = grid(['SS.M', '....', '....', '....']);
  assert.equal(validate(g).filter((v) => v.rule === 'NO_THREE_IN_A_ROW').length, 0);
});

/* ---------------------------- Rule 2: balance ---------------------------- */

test('too many suns in a row is a BALANCE error with counts', () => {
  const g = grid(['SMSS', 'M...', 'M...', 'S...']); // row0: 3 suns, 1 moon in n=4 (max 2)
  const v = validate(g).find((v) => v.rule === 'BALANCE' && v.line.type === 'row' && v.line.index === 0);
  assert.ok(v);
  assert.equal(v.severity, 'error');
  assert.equal(v.counts.max, 2);
  assert.equal(v.counts.sun, 3);
  assert.ok(/rule 2/i.test(v.why));
  // Offending cells are the over-quota (sun) cells; fixPreview flips one to moon.
  assert.ok(v.cells.length >= 1);
  assert.equal(v.fixPreview[0].symbol, MOON);
});

test('too many moons in a column is a BALANCE error', () => {
  const g = grid(['M...', 'M...', 'M...', 'M...']); // col0 all moons (also a run, but BALANCE fires too)
  const v = validate(g).find((v) => v.rule === 'BALANCE' && v.line.type === 'col' && v.line.index === 0);
  assert.ok(v);
  assert.equal(v.counts.moon, 4);
});

test('exactly half-and-half in a full line is not a balance violation', () => {
  const g = grid(['SMSM', 'MSMS', 'SMMS', 'MSSM']);
  assert.equal(validate(g).filter((v) => v.rule === 'BALANCE').length, 0);
});

/* -------------------------- Rule 3: equals ( = ) ------------------------- */

const eqPuzzle = { n: 4, constraints: [{ a: { r: 0, c: 0 }, b: { r: 0, c: 1 }, type: '=' }], givens: [] };

test('equals constraint with differing filled cells is an EQUALS error', () => {
  const g = grid(['SM..', '....', '....', '....']);
  const v = validate(g, eqPuzzle).find((v) => v.rule === 'EQUALS');
  assert.ok(v);
  assert.equal(v.severity, 'error');
  assert.deepEqual(v.cells, [{ r: 0, c: 0 }, { r: 0, c: 1 }]);
  assert.equal(v.edge.type, '=');
  assert.ok(/rule 3/i.test(v.why));
  assert.equal(v.fixPreview.length, 1);
});

test('equals constraint satisfied produces no violation', () => {
  const g = grid(['SS..', '....', '....', '....']);
  assert.equal(validate(g, eqPuzzle).filter((v) => v.rule === 'EQUALS').length, 0);
});

test('equals constraint with an empty cell is not yet a violation', () => {
  const g = grid(['S...', '....', '....', '....']);
  assert.equal(validate(g, eqPuzzle).filter((v) => v.rule === 'EQUALS').length, 0);
});

/* --------------------------- Rule 4: cross ( × ) ------------------------- */

const xPuzzle = { n: 4, constraints: [{ a: { r: 0, c: 0 }, b: { r: 1, c: 0 }, type: 'x' }], givens: [] };

test('cross constraint with matching filled cells is a CROSS error', () => {
  const g = grid(['S...', 'S...', '....', '....']);
  const v = validate(g, xPuzzle).find((v) => v.rule === 'CROSS');
  assert.ok(v);
  assert.equal(v.edge.type, 'x');
  assert.ok(/rule 4/i.test(v.why));
  assert.equal(v.fixPreview[0].symbol, MOON); // opposite of the other (sun)
});

test('cross constraint satisfied produces no violation', () => {
  const g = grid(['S...', 'M...', '....', '....']);
  assert.equal(validate(g, xPuzzle).filter((v) => v.rule === 'CROSS').length, 0);
});

/* ------------------------- fixPreview respects locks --------------------- */

test('fixPreview never targets a locked given cell', () => {
  // Triple of suns in row 0; middle cell (0,1) is a locked given.
  const g = grid(['SSSM', 'M...', 'M...', 'S...']);
  const puzzle = { n: 4, constraints: [], givens: [{ r: 0, c: 1, symbol: SUN }] };
  const v = validate(g, puzzle).find((x) => x.rule === 'NO_THREE_IN_A_ROW');
  assert.ok(v.fixPreview.length === 1);
  assert.ok(!(v.fixPreview[0].r === 0 && v.fixPreview[0].c === 1)); // not the locked cell
});

/* ------------------------------ Bookkeeping ------------------------------ */

test('violation ids are unique and multiple violations are returned together', () => {
  const g = grid(['SSSS', 'M...', 'M...', 'M...']); // row0 triple+balance, col0 balance
  const vs = validate(g);
  assert.ok(vs.length >= 2);
  const ids = vs.map((v) => v.id);
  assert.equal(new Set(ids).size, ids.length);
});
