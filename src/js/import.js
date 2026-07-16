// Import a board the player is looking at elsewhere: set N, click cells to place
// given symbols, click edges to place = / ×. Validation reports whether the
// transcription is contradictory, ambiguous (many solutions), or a clean puzzle.

import { openModal } from './modal.js';
import { renderIcons } from './icons.js';
import { SUN, MOON, key, gridFromPuzzle } from './board.js';
import { firstSolution, classify } from './solver.js';
import { analyzeImport } from './import-check.js';

export { analyzeImport };

const CELL = 46, GAP = 6;

/**
 * Open the import editor.
 * @param {(puzzle:Object)=>void} onImport called with a ready-to-play puzzle
 */
export function openImport(onImport) {
  let n = 6;
  const givens = new Map();       // "r,c" -> SUN | MOON
  const cons = new Map();         // edgeKey -> '=' | 'x'
  let analysis = null;

  const edgeKey = (a, b) => `${a.r},${a.c}-${b.r},${b.c}`;

  function cycleCell(k) {
    const v = givens.get(k);
    if (v === undefined) givens.set(k, SUN);
    else if (v === SUN) givens.set(k, MOON);
    else givens.delete(k);
  }
  function cycleEdge(k) {
    const v = cons.get(k);
    if (v === undefined) cons.set(k, '=');
    else if (v === '=') cons.set(k, 'x');
    else cons.delete(k);
  }

  function toPuzzle() {
    return {
      n,
      givens: [...givens].map(([k, symbol]) => { const [r, c] = k.split(',').map(Number); return { r, c, symbol }; }),
      constraints: [...cons].map(([k, type]) => {
        const [a, b] = k.split('-').map((p) => { const [r, c] = p.split(',').map(Number); return { r, c }; });
        return { a, b, type };
      }),
    };
  }

  const api = openModal({
    eyebrow: 'Import', title: 'Transcribe a board', size: 'xl',
    body: `
      <div class="flex flex-col lg:flex-row gap-5 items-start">
        <div class="mx-auto lg:mx-0 shrink-0">
          <div class="flex items-center gap-2 mb-3">
            <span class="eyebrow">Size</span>
            <select data-size class="bg-surface-2 border border-line rounded-md text-xs text-ink px-2 py-1 font-mono">
              ${[4, 6, 8, 10].map((s) => `<option value="${s}" ${s === n ? 'selected' : ''}>${s} × ${s}</option>`).join('')}
            </select>
            <button data-clear class="btn text-xs ml-auto"><i data-lucide="eraser" style="width:13px;height:13px"></i> Clear</button>
          </div>
          <div data-editor class="panel p-3 inline-block"></div>
          <p class="mt-2 text-xs text-ink-faint">Click a cell: empty → Sun → Moon. Click an edge dot: none → = → ×.</p>
        </div>
        <div class="flex-1 min-w-0 w-full">
          <div class="rounded-xl border border-line bg-surface-2/40 p-4">
            <div class="eyebrow mb-2">Check</div>
            <div data-report class="text-sm text-ink-muted">Build the board, then validate it.</div>
            <div class="mt-4 flex gap-3">
              <button data-validate class="btn"><i data-lucide="scan-search"></i> Validate</button>
              <button data-import class="btn-primary btn" disabled><i data-lucide="download"></i> Import &amp; play</button>
            </div>
          </div>
        </div>
      </div>`,
    onMount: (bodyEl) => {
      const editor = bodyEl.querySelector('[data-editor]');
      const report = bodyEl.querySelector('[data-report]');
      const importBtn = bodyEl.querySelector('[data-import]');

      function drawEditor() {
        const dim = n * CELL + (n - 1) * GAP;
        const stride = CELL + GAP;
        let cells = '';
        for (let r = 0; r < n; r++) {
          for (let c = 0; c < n; c++) {
            const v = givens.get(key(r, c));
            const inner = v === SUN ? `<i data-lucide="sun" class="text-sun" style="width:22px;height:22px"></i>`
              : v === MOON ? `<i data-lucide="moon" class="text-moon" style="width:20px;height:20px"></i>` : '';
            cells += `<button data-cell="${r},${c}" class="tango-cell" style="width:${CELL}px;height:${CELL}px">${inner}</button>`;
          }
        }
        let edges = '';
        for (let r = 0; r < n; r++) {
          for (let c = 0; c < n; c++) {
            if (c + 1 < n) edges += edgeEl({ r, c }, { r, c: c + 1 }, c * stride + CELL + GAP / 2, r * stride + CELL / 2);
            if (r + 1 < n) edges += edgeEl({ r, c }, { r: r + 1, c }, c * stride + CELL / 2, r * stride + CELL + GAP / 2);
          }
        }
        editor.innerHTML = `<div class="relative" style="width:${dim}px;height:${dim}px">
          <div class="grid" style="grid-template-columns:repeat(${n},${CELL}px);gap:${GAP}px">${cells}</div>${edges}</div>`;
        editor.querySelectorAll('[data-cell]').forEach((b) => b.addEventListener('click', () => { cycleCell(b.dataset.cell); invalidate(); drawEditor(); }));
        editor.querySelectorAll('[data-edge]').forEach((b) => b.addEventListener('click', () => { cycleEdge(b.dataset.edge); invalidate(); drawEditor(); }));
        renderIcons();
      }

      function edgeEl(a, b, x, y) {
        const k = edgeKey(a, b);
        const t = cons.get(k);
        const glyph = t === '=' ? '=' : t === 'x' ? '×' : '·';
        return `<div data-edge="${k}" ${t ? `data-type="${t}"` : ''} class="editor-edge" style="left:${x}px;top:${y}px;width:20px;height:20px;font-size:13px">${glyph}</div>`;
      }

      function invalidate() { analysis = null; importBtn.disabled = true; report.innerHTML = 'Board changed — validate again.'; }

      function runValidate() {
        analysis = analyzeImport(toPuzzle());
        const msg = {
          illegal: ['triangle-alert', 'text-violation', 'The board already breaks a rule. Fix the highlighted clash before importing.'],
          none: ['circle-x', 'text-violation', 'No arrangement satisfies every rule — this board is contradictory. Re-check your transcription.'],
          multiple: ['copy', 'text-sun', 'This board has more than one solution, so it can’t be solved by logic alone. You can still import and explore it.'],
          unique: ['circle-check', 'text-confirm', analysis.logicSolvable ? 'Valid! Exactly one solution, reachable by pure logic.' : 'Valid — exactly one solution (it needs trial-and-error beyond the named techniques).'],
        }[analysis.status];
        report.innerHTML = `<div class="flex items-start gap-2"><i data-lucide="${msg[0]}" class="${msg[1]} mt-0.5 shrink-0" style="width:18px;height:18px"></i><span>${msg[2]}</span></div>`;
        importBtn.disabled = !(analysis.status === 'unique' || analysis.status === 'multiple');
        renderIcons();
      }

      bodyEl.querySelector('[data-size]').addEventListener('change', (e) => { n = Number(e.target.value); givens.clear(); cons.clear(); invalidate(); drawEditor(); });
      bodyEl.querySelector('[data-clear]').addEventListener('click', () => { givens.clear(); cons.clear(); invalidate(); drawEditor(); });
      bodyEl.querySelector('[data-validate]').addEventListener('click', runValidate);
      importBtn.addEventListener('click', () => {
        const base = toPuzzle();
        const solution = analysis?.solution ?? firstSolution(gridFromPuzzle(base).grid, base);
        const difficulty = analysis?.logicSolvable ? classify(base) : 'import';
        api.close();
        onImport({ ...base, solution, difficulty, seed: 'imported' });
      });

      drawEditor();
    },
  });
}
