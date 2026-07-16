// Auto-solve and step-by-step solve replay. The replay is the app's best
// learning tool: it walks the solver's own derivation one forced move at a
// time, naming the technique and reason for each — reusing the board's
// animation + hint highlighting.

import { solve, firstSolution } from './solver.js';
import { TECHNIQUE_INFO } from './hints.js';
import { renderIcons } from './icons.js';
import { gridFromPuzzle, SUN } from './board.js';

/** The solution grid for a puzzle (prefers the stored one; else derives it). */
export function solutionOf(puzzle) {
  if (puzzle?.solution) return puzzle.solution;
  const { grid } = gridFromPuzzle(puzzle);
  return firstSolution(grid, puzzle);
}

/** Fill every non-given cell with the solution (a single undo step). */
export function revealSolution(state) {
  const sol = solutionOf(state.puzzle);
  if (!sol) return false;
  const all = [];
  for (let r = 0; r < state.n; r++) for (let c = 0; c < state.n; c++) all.push({ r, c });
  return state.revealCells(all, sol);
}

/**
 * Start a step-by-step replay of the logical solve. Takes over the explanation
 * panel with a controller (Prev / Play / Next / Exit) and drives the board.
 * @returns {{exit:Function}}
 */
export function startReplay({ state, view, explainer, panelEl, onExit }) {
  const puzzle = state.puzzle;
  explainer.setSuspended(true);
  state.load(puzzle); // reset the board to the givens for a clean derivation

  const { grid: start } = gridFromPuzzle(puzzle);
  const result = solve(start, puzzle);
  const steps = result.steps;
  let idx = 0;         // number of steps applied
  let playing = false;
  let timer = null;

  function stopTimer() { if (timer) { clearTimeout(timer); timer = null; } }

  function applyNext() {
    if (idx >= steps.length) return false;
    const s = steps[idx];
    state.cycle(s.r, s.c, s.symbol === SUN ? +1 : -1); // empty→Sun forward, empty→Moon back
    idx++;
    highlight(s);
    return true;
  }
  function undoLast() {
    if (idx <= 0) return;
    idx--;
    state.undo();
    if (idx > 0) highlight(steps[idx - 1]); else view.effects.clear();
  }
  function highlight(s) {
    view.effects.hint([...(s.because ?? []), { r: s.r, c: s.c }], { r: s.r, c: s.c });
  }

  function render() {
    const done = idx >= steps.length;
    const last = idx > 0 ? steps[idx - 1] : null;
    const info = last ? TECHNIQUE_INFO[last.technique] : null;
    panelEl.innerHTML = `
      <div class="flex items-center justify-between mb-3">
        <div class="eyebrow">Step-by-step solve</div>
        <div class="font-mono text-xs text-ink-muted">${idx} / ${steps.length}</div>
      </div>
      <div class="rule-card">
        ${last ? `
          <div class="flex items-center gap-3 mb-2">
            <span class="flex h-8 w-8 items-center justify-center rounded-lg border border-moon/50 bg-moon/10 text-moon font-mono text-sm">${info.ruleNo ?? '★'}</span>
            <h3 class="font-display text-lg text-ink">${info.name}</h3>
          </div>
          <p class="text-sm text-ink-muted">${last.reason}</p>`
          : `<p class="text-sm text-ink-muted">Press <b class="text-ink">Play</b> or <b class="text-ink">Step</b> to watch the puzzle solved one forced move at a time — each move names its technique.</p>`}
        ${done ? `<p class="mt-3 text-sm text-confirm flex items-center gap-2"><i data-lucide="party-popper" style="width:16px;height:16px"></i> Solved in ${steps.length} logical steps${result.solved ? '' : ' (as far as the named techniques reach)'}.</p>` : ''}
      </div>
      <div class="mt-4 flex items-center gap-2">
        <button data-prev class="btn-icon" ${idx === 0 ? 'disabled' : ''} title="Back"><i data-lucide="chevron-left"></i></button>
        <button data-play class="btn-primary btn flex-1" ${done ? 'disabled' : ''}>
          <i data-lucide="${playing ? 'pause' : 'play'}"></i> ${playing ? 'Pause' : 'Play'}</button>
        <button data-next class="btn-icon" ${done ? 'disabled' : ''} title="Step"><i data-lucide="chevron-right"></i></button>
        <button data-exit class="btn" title="Exit replay"><i data-lucide="x"></i> Done</button>
      </div>`;
    renderIcons();
    panelEl.querySelector('[data-prev]')?.addEventListener('click', () => { pause(); undoLast(); render(); });
    panelEl.querySelector('[data-next]')?.addEventListener('click', () => { pause(); applyNext(); render(); });
    panelEl.querySelector('[data-play]')?.addEventListener('click', togglePlay);
    panelEl.querySelector('[data-exit]')?.addEventListener('click', exit);
  }

  function tick() {
    if (!playing) return;
    if (!applyNext()) { pause(); render(); return; }
    render();
    timer = setTimeout(tick, 850);
  }
  function togglePlay() { playing ? pause() : play(); render(); }
  function play() { playing = true; stopTimer(); timer = setTimeout(tick, 250); }
  function pause() { playing = false; stopTimer(); }

  function exit() {
    pause();
    view.effects.clear();
    explainer.setSuspended(false);
    explainer.update({ type: 'resync' });
    onExit?.();
  }

  render();
  return { exit };
}
