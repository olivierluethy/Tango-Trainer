// Single source of truth for a play session: the current puzzle, the grid, the
// locked cells, unlimited undo/redo, and a move counter. Emits change events to
// subscribers (render.js repaints; later phases hook validation in here).
//
// History is snapshot-based: every committed mutation pushes a full grid clone.
// Boards top out at 10×10 = 100 cells, so snapshots are cheap and undo/redo is
// trivially correct.

import {
  gridFromPuzzle, cloneGrid, cycleForward, cycleBackward, EMPTY, key,
} from './board.js';

export class GameState {
  #subs = new Set();

  constructor() {
    this.puzzle = null;
    this.n = 0;
    this.grid = [];
    this.locked = new Set();
    /** @type {string[][][]} snapshots */
    this.history = [];
    this.hi = -1;      // index into history of the current grid
    this.moves = 0;
    // When non-null, only these "r,c" cells accept input (used by the tutorial
    // to enable one relevant interaction at a time). null = normal play.
    this.activeCells = null;
  }

  /** Load a puzzle spec, resetting grid + history. */
  load(puzzle) {
    this.puzzle = puzzle;
    this.n = puzzle.n;
    const { grid, locked } = gridFromPuzzle(puzzle);
    this.grid = grid;
    this.locked = locked;
    this.history = [cloneGrid(grid)];
    this.hi = 0;
    this.moves = 0;
    this.activeCells = null;
    this.#emit({ type: 'load' });
  }

  #blocked(r, c) {
    if (this.activeCells && !this.activeCells.has(key(r, c))) {
      this.#emit({ type: 'rejected', r, c, reason: 'inactive' });
      return true;
    }
    if (this.isLocked(r, c)) {
      this.#emit({ type: 'rejected', r, c, reason: 'locked' });
      return true;
    }
    return false;
  }

  isLocked(r, c) { return this.locked.has(key(r, c)); }
  cell(r, c) { return this.grid[r][c]; }

  /** Push the current grid as a new history entry (truncating any redo tail). */
  #commit(meta) {
    this.history = this.history.slice(0, this.hi + 1);
    this.history.push(cloneGrid(this.grid));
    this.hi = this.history.length - 1;
    this.#emit(meta);
  }

  /**
   * Cycle a cell. dir > 0 = forward (Sun→Moon), dir < 0 = backward.
   * Locked cells reject the change and emit a 'rejected' event instead.
   */
  cycle(r, c, dir = 1) {
    if (this.#blocked(r, c)) return false;
    const prev = this.grid[r][c];
    const next = dir > 0 ? cycleForward(prev) : cycleBackward(prev);
    this.grid[r][c] = next;
    this.moves++;
    this.#commit({ type: 'cell', r, c, prev, symbol: next });
    return true;
  }

  /** Clear a single cell (no-op if already empty or locked). */
  clearCell(r, c) {
    if (this.#blocked(r, c)) return false;
    if (this.grid[r][c] === EMPTY) return false;
    const prev = this.grid[r][c];
    this.grid[r][c] = EMPTY;
    this.moves++;
    this.#commit({ type: 'cell', r, c, prev, symbol: EMPTY });
    return true;
  }

  /**
   * Reveal (cheat) the given cells to their solution value. Non-locked only.
   * Commits once so it is a single undo step.
   */
  revealCells(cellList, solution) {
    let changed = false;
    for (const { r, c } of cellList) {
      if (this.isLocked(r, c)) continue;
      const s = solution[r][c];
      if (s && this.grid[r][c] !== s) { this.grid[r][c] = s; changed = true; }
    }
    if (changed) { this.moves++; this.#commit({ type: 'reveal' }); }
    return changed;
  }

  /** Clear every unlocked cell. Returns true if anything changed. */
  clearBoard() {
    let changed = false;
    for (let r = 0; r < this.n; r++) {
      for (let c = 0; c < this.n; c++) {
        if (!this.isLocked(r, c) && this.grid[r][c] !== EMPTY) {
          this.grid[r][c] = EMPTY;
          changed = true;
        }
      }
    }
    if (changed) this.#commit({ type: 'clearBoard' });
    return changed;
  }

  get canUndo() { return this.hi > 0; }
  get canRedo() { return this.hi < this.history.length - 1; }

  undo() {
    if (!this.canUndo) return false;
    this.hi--;
    this.grid = cloneGrid(this.history[this.hi]);
    this.#emit({ type: 'undo' });
    return true;
  }

  redo() {
    if (!this.canRedo) return false;
    this.hi++;
    this.grid = cloneGrid(this.history[this.hi]);
    this.#emit({ type: 'redo' });
    return true;
  }

  /** Every cell filled? (Correctness is validated in Phase 3.) */
  isFilled() {
    return this.grid.every((row) => row.every((v) => v !== EMPTY));
  }

  subscribe(fn) {
    this.#subs.add(fn);
    return () => this.#subs.delete(fn);
  }

  #emit(meta) {
    for (const fn of this.#subs) fn(meta, this);
  }
}
