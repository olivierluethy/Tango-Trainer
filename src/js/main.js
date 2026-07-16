// Bootstrap + wiring. Phase 1 establishes the shell: icon init, the modal
// system, the rulebook, a settings modal, the mirror-layout toggle, and a
// static preview board so the visual identity is reviewable. Interactive board
// logic, validation, and the explanation engine arrive in later phases.

import { renderIcons } from './icons.js';
import { openModal, confirmModal } from './modal.js';
import { toast } from './toast.js';
import { enter } from './animate.js';
import { rulebookBody } from './rulebook.js';
import { GameState } from './state.js';
import { createBoardView } from './render.js';
import { createExplainer } from './explain.js';
import { RULE_META } from './explain.js';
import { computeHint, TECHNIQUE_INFO } from './hints.js';
import { generatePuzzle } from './puzzle-service.js';
import { openTutorialMenu, openTutorialIntro, isGraduated, tutorialSeen } from './tutorial.js';
import { openImport } from './import.js';
import { revealSolution, startReplay, solutionOf } from './autosolve.js';
import { getStats, recordGameStarted, recordWin, bestKey } from './storage.js';
import { downloadGame } from './export.js';
import { rules as RULEBOOK_RULES } from './rulebook.js';
import { validate } from './rules.js';
import { SUN, MOON } from './board.js';

const SYMBOL_NAME = { [SUN]: 'Sun', [MOON]: 'Moon' };
const DIFFICULTIES = ['easy', 'medium', 'hard'];
const SIZES = [4, 6, 8, 10];
const LS_CHEAT = 'tango.cheatGhost';

const $ = (sel) => document.querySelector(sel);
const LS = {
  mirror: 'tango.mirror',
};

// Single play session driven by the generator.
const state = new GameState();
let view = null;
let explainer = null;
let session = { n: 6, difficulty: 'easy', seed: null, cheated: false };
let replay = null;

const strictOn = () => localStorage.getItem('tango.strict') !== '0';

/* ------------------------------ Timer + stats ---------------------------- */
let timerId = null, startTs = 0, elapsedBase = 0, running = false;
let won = false, mistakes = 0, prevViol = 0;

const elapsed = () => elapsedBase + (running ? Date.now() - startTs : 0);
function fmtTime(ms) {
  const t = Math.floor(ms / 1000);
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
}
function renderTime() { const el = $('#stat-time'); if (el) el.textContent = fmtTime(elapsed()); }
function renderMistakes() { const el = $('#stat-mistakes'); if (el) el.textContent = String(mistakes); }
function stopTimer() {
  if (timerId) { clearInterval(timerId); timerId = null; }
  if (running) { elapsedBase = elapsed(); running = false; }
}
function resetTimer() { stopTimer(); elapsedBase = 0; renderTime(); }
function startTimerIfNeeded() {
  if (running || won) return;
  running = true; startTs = Date.now();
  timerId = setInterval(renderTime, 500);
}

// One handler for time, the mistake counter, and win detection.
function onStateChange(meta) {
  if (meta.type === 'load') { won = false; mistakes = 0; prevViol = 0; resetTimer(); renderMistakes(); return; }
  const vs = validate(state.grid, state.puzzle);
  if (meta.type === 'cell' || meta.type === 'reveal') {
    startTimerIfNeeded();
    if (vs.length > prevViol) { mistakes += vs.length - prevViol; renderMistakes(); }
  }
  prevViol = vs.length;
  if (!won && !replay && state.isFilled() && vs.length === 0) { won = true; onWin(); }
}

function onWin() {
  stopTimer();
  const timeMs = elapsed();
  const cheated = session.cheated;
  const { best } = recordWin({ n: session.n, difficulty: session.difficulty, timeMs, moves: state.moves, cheated });
  openWinModal({ timeMs, moves: state.moves, mistakes, cheated, best });
}

function openWinModal({ timeMs, moves, mistakes, cheated, best }) {
  openModal({
    eyebrow: cheated ? 'Solved (assisted)' : 'Solved', title: best ? 'New personal best!' : 'Puzzle solved',
    size: 'sm',
    body: `
      <div class="text-center py-1">
        <span class="inline-flex h-14 w-14 items-center justify-center rounded-full border ${best ? 'border-sun/50 bg-sun/10 text-sun' : 'border-confirm/50 bg-confirm/10 text-confirm'} mb-3">
          <i data-lucide="${best ? 'trophy' : 'party-popper'}"></i></span>
      </div>
      <div class="grid grid-cols-3 gap-2 text-center font-mono">
        ${stat('Time', fmtTime(timeMs))}${stat('Moves', moves)}${stat('Mistakes', mistakes)}
      </div>
      ${cheated ? '<p class="mt-3 text-xs text-sun text-center">Assisted with cheats — not counted as a personal best.</p>' : ''}
      <div class="mt-5 flex justify-center gap-3">
        <button type="button" id="win-new" class="btn-primary btn"><i data-lucide="plus"></i> New puzzle</button>
      </div>`,
    onMount: (bodyEl, api) => {
      bodyEl.querySelector('#win-new')?.addEventListener('click', () => { api.close(); openNewPuzzle(); });
    },
  });
}
const stat = (label, val) => `<div class="rounded-lg border border-line bg-surface-2/50 py-2"><div class="text-lg text-ink">${val}</div><div class="text-[10px] uppercase tracking-widest text-ink-faint">${label}</div></div>`;

/* --------------------------------- Cheats -------------------------------- */
const cheatGhostOn = () => localStorage.getItem(LS_CHEAT) === '1';
function markCheated() { session.cheated = true; }
function currentSolution() { return solutionOf(state.puzzle); }
function applyCheatGhost() {
  view?.effects.setGhost(cheatGhostOn() ? currentSolution() : null);
}

/* ----------------------------- Mirror layout ----------------------------- */
function applyMirror(on) {
  const layout = $('#layout');
  // Board and panel swap sides; on mobile the stack order is unaffected.
  layout.classList.toggle('lg:flex-row-reverse', on);
  $('#btn-mirror')?.setAttribute('aria-pressed', String(on));
}

function initMirror() {
  const saved = localStorage.getItem(LS.mirror) === '1';
  applyMirror(saved);
  $('#btn-mirror')?.addEventListener('click', () => {
    const next = localStorage.getItem(LS.mirror) !== '1';
    localStorage.setItem(LS.mirror, next ? '1' : '0');
    applyMirror(next);
    toast(next ? 'Layout mirrored' : 'Layout restored', { kind: 'info', duration: 1400 });
  });
}

/* ------------------------------- Rulebook -------------------------------- */
function openRulebook() {
  openModal({
    eyebrow: 'Reference',
    title: 'The four rules of Tango',
    size: 'lg',
    body: rulebookBody(),
  });
}

/* ------------------------------- Settings -------------------------------- */
function openSettings() {
  const mirrorOn = localStorage.getItem(LS.mirror) === '1';
  openModal({
    eyebrow: 'Preferences',
    title: 'Settings',
    size: 'md',
    body: `
      <div class="space-y-1">
        ${toggleRow('set-mirror', 'Mirror layout', 'Swap the board and explanation panel sides.', mirrorOn)}
        ${toggleRow('set-strict', 'Strict mode', 'Check every move automatically (on) vs. only when you press “Explain this” (off).', strictOn())}
        ${toggleRow('set-reduce', 'Respect reduced motion', 'Follows your system setting; explanations stay visible as static graphics.', true, true)}
      </div>
      <div class="mt-5 pt-4 border-t border-line grid grid-cols-3 gap-2">
        <button type="button" id="set-stats" class="btn text-xs"><i data-lucide="bar-chart-3" style="width:14px;height:14px"></i> Statistics</button>
        <button type="button" id="set-how" class="btn text-xs"><i data-lucide="book-open" style="width:14px;height:14px"></i> How to play</button>
        <button type="button" id="set-download" class="btn text-xs"><i data-lucide="download" style="width:14px;height:14px"></i> Download</button>
      </div>
    `,
    onMount: (bodyEl, api) => {
      bodyEl.querySelector('#set-mirror')?.addEventListener('change', (e) => {
        const on = e.target.checked;
        localStorage.setItem(LS.mirror, on ? '1' : '0');
        applyMirror(on);
      });
      bodyEl.querySelector('#set-strict')?.addEventListener('change', (e) => {
        localStorage.setItem('tango.strict', e.target.checked ? '1' : '0');
        explainer.setStrict(e.target.checked);
        explainer.update({ type: 'resync' });
      });
      bodyEl.querySelector('#set-stats')?.addEventListener('click', () => { api.close(); setTimeout(openStats, 160); });
      bodyEl.querySelector('#set-how')?.addEventListener('click', () => { api.close(); setTimeout(openHowToPlay, 160); });
      bodyEl.querySelector('#set-download')?.addEventListener('click', () => { api.close(); downloadGame(); });
    },
  });
}

/* ------------------------------- Statistics ------------------------------ */
function openStats() {
  const s = getStats();
  const rows = [];
  for (const n of SIZES) {
    for (const d of DIFFICULTIES) {
      const b = s.bests[bestKey(n, d)];
      if (b) rows.push(`<tr class="border-t border-line/60"><td class="py-1.5 pr-4 font-mono text-ink">${n}×${n}</td><td class="pr-4 capitalize text-ink-muted">${d}</td><td class="pr-4 font-mono text-ink">${fmtTime(b.timeMs)}</td><td class="font-mono text-ink-muted">${b.moves}</td></tr>`);
    }
  }
  openModal({
    eyebrow: 'Progress', title: 'Statistics', size: 'md',
    body: `
      <div class="grid grid-cols-3 gap-2 text-center font-mono mb-5">
        ${stat('Played', s.games)}${stat('Solved', s.wins)}${stat('Assisted', s.cheatedWins)}
      </div>
      <div class="eyebrow mb-2">Personal bests</div>
      ${rows.length ? `<table class="w-full text-sm"><thead><tr class="text-left text-xs uppercase tracking-widest text-ink-faint"><th class="pb-1 pr-4">Board</th><th class="pr-4">Difficulty</th><th class="pr-4">Best time</th><th>Moves</th></tr></thead><tbody>${rows.join('')}</tbody></table>`
        : '<p class="text-sm text-ink-muted">No personal bests yet — solve a puzzle without cheats to set one.</p>'}`,
  });
}

/* ------------------------------ How to play ------------------------------ */
function openHowToPlay() {
  const techniques = [
    ['Pair forces the neighbour', 'Two identical symbols side by side force the next cell to the opposite — otherwise you’d get three in a row.'],
    ['Sandwich', 'A gap between two identical symbols (Sun _ Sun) must be the opposite.'],
    ['Line complete', 'Once a row or column holds all N/2 of one symbol, every other cell is the other symbol.'],
    ['Avoid a forced triple', 'If a symbol here would make the line impossible to finish without a triple, place the opposite.'],
    ['= and ×', 'Propagate equals and crosses from any filled neighbour, and chain them across the board.'],
  ];
  openModal({
    eyebrow: 'Guide', title: 'How to play', size: 'lg',
    body: `
      <p class="text-ink-muted mb-4">Fill every cell with a <span class="text-sun">Sun</span> or a <span class="text-moon">Moon</span> so all four rules hold. Every puzzle has one solution, reachable by pure logic.</p>
      <div class="grid sm:grid-cols-2 gap-3 mb-5">
        ${RULEBOOK_RULES.map((r) => `<div class="rounded-lg border border-line bg-surface-2/50 p-3"><div class="font-display text-ink mb-1">${r.n}. ${r.key}</div><div class="text-sm text-ink-muted">${r.text}</div></div>`).join('')}
      </div>
      <div class="eyebrow mb-2">Techniques that crack every puzzle</div>
      <ul class="space-y-2 mb-5">
        ${techniques.map(([t, d]) => `<li class="flex gap-2 text-sm"><span class="text-moon font-medium shrink-0">${t}.</span><span class="text-ink-muted">${d}</span></li>`).join('')}
      </ul>
      <p class="text-sm text-ink-muted">Left-click cycles Sun → Moon → empty (right-click reverses). Press <b class="text-ink">H</b> for a graded hint, <b class="text-ink">R</b> for the rulebook, or “Explain this” to check the board. The full written guide with a worked 6×6 solve is in <span class="font-mono text-ink">HOW-TO-PLAY.md</span>.</p>`,
  });
}

function toggleRow(id, label, help, checked, disabled = false) {
  return `
    <label class="flex items-start justify-between gap-4 py-3 border-b border-line/60 last:border-0 ${disabled ? 'opacity-60' : 'cursor-pointer'}">
      <span class="min-w-0">
        <span class="block text-ink font-medium">${label}</span>
        <span class="block text-sm text-ink-muted">${help}</span>
      </span>
      <input id="${id}" type="checkbox" ${checked ? 'checked' : ''} ${disabled ? 'disabled' : ''}
             class="mt-1 h-5 w-5 shrink-0 accent-moon" />
    </label>`;
}

/* --------------------------------- Help ---------------------------------- */
// Analyses the live board, drives the panel/board animation, and opens a modal
// summarising every current issue (with a jump-to-board button each), or a
// friendly note plus the rulebook link when nothing is broken.
function openHelp() {
  const violations = explainer.analyse();

  let body;
  if (violations.length) {
    const cards = violations.map((v, i) => {
      const m = RULE_META[v.rule];
      return `
        <div class="rounded-xl border border-line bg-surface-2/50 p-4">
          <div class="flex items-center justify-between gap-3 mb-2">
            <div class="flex items-center gap-2">
              <span class="flex h-7 w-7 items-center justify-center rounded-md border border-violation/60 bg-violation/10 text-violation font-mono text-sm">${m.n}</span>
              <h3 class="font-display text-ink">${m.name}</h3>
            </div>
            <button type="button" data-show="${i}" class="btn text-xs px-2.5 py-1">
              <i data-lucide="crosshair" style="width:14px;height:14px"></i> Show on board
            </button>
          </div>
          <div class="text-sm text-ink"><span class="text-sun">What.</span> ${v.headline}</div>
          <div class="text-sm text-ink-muted mt-1"><span class="text-moon">Why.</span> ${v.why}</div>
          <div class="text-sm text-ink-muted mt-1"><span class="text-confirm">How.</span> ${v.fix}</div>
        </div>`;
    }).join('');
    body = `
      <p class="mb-4 text-ink-muted">${violations.length} rule${violations.length > 1 ? 's are' : ' is'} broken right now. The board and the panel show the animated explanation; here’s the summary.</p>
      <div class="space-y-3">${cards}</div>
      <div class="mt-5"><button type="button" id="help-rules" class="btn"><i data-lucide="book-open"></i> Open the rulebook</button></div>`;
  } else {
    const solved = state.isFilled();
    body = `
      <div class="flex items-start gap-3">
        <span class="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-confirm/50 bg-confirm/10 text-confirm"><i data-lucide="${solved ? 'party-popper' : 'check'}"></i></span>
        <div>
          <h3 class="font-display text-lg text-ink mb-1">${solved ? 'Solved — no rules broken' : 'No rules broken'}</h3>
          <p class="text-sm text-ink-muted">${solved ? 'Every line is balanced with no triples and all constraints satisfied.' : 'Everything on the board is legal so far. Step-by-step “what to place next” hints arrive with the solver in Phase 5.'}</p>
        </div>
      </div>
      <div class="mt-5"><button type="button" id="help-rules" class="btn"><i data-lucide="book-open"></i> Open the rulebook</button></div>`;
  }

  openModal({
    eyebrow: 'Explain this',
    title: violations.length ? 'What’s wrong, and how to fix it' : 'Board check',
    size: 'lg',
    body,
    onMount: (bodyEl, api) => {
      bodyEl.querySelector('#help-rules')?.addEventListener('click', () => { api.close(); openRulebook(); });
      bodyEl.querySelectorAll('[data-show]').forEach((btn) => {
        btn.addEventListener('click', () => {
          explainer.selectViolation(Number(btn.dataset.show));
          api.close();
        });
      });
    },
  });
}

/* --------------------------------- Hint ---------------------------------- */
// A graded ladder: the player reveals only as much as they want. Never "just
// the answer" — every level names the technique and can show its derivation.
function openHint() {
  const hint = computeHint(state);

  if (hint.kind !== 'step') {
    const msg = {
      fix: ['Fix the rule first', `You’ve broken ${hint.count > 1 ? `${hint.count} rules` : 'a rule'} right now. Sort that out — the board and panel show exactly what and why — before asking for the next move.`, 'triangle-alert', 'text-violation'],
      solved: ['Already solved', 'Every cell is filled and every rule is satisfied. Nothing left to hint!', 'party-popper', 'text-confirm'],
      stuck: ['Nothing forces a move here', 'No cell can be deduced from this position — a legal-but-wrong symbol may be blocking the solution. Try Undo, or use Explain to look for a mistake.', 'circle-help', 'text-moon'],
    }[hint.kind];
    openModal({
      eyebrow: 'Hint', title: msg[0], size: 'sm',
      body: `<div class="flex items-start gap-3">
        <span class="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-line bg-surface-2 ${msg[3]}"><i data-lucide="${msg[2]}"></i></span>
        <p class="text-sm text-ink-muted">${msg[1]}</p></div>`,
    });
    return;
  }

  const { step, region, target, where } = hint;
  const info = TECHNIQUE_INFO[step.technique];
  const symName = SYMBOL_NAME[step.symbol];
  let level = 0;
  let placed = false;

  openModal({
    eyebrow: 'Hint',
    title: 'Need a nudge?',
    size: 'md',
    onClose: () => {
      if (!placed) { view.effects.clear(); explainer.update({ type: 'resync' }); }
    },
    body: '<div data-hint></div>',
    onMount: (bodyEl, modal) => {
      const host = bodyEl.querySelector('[data-hint]');
      const nextLabels = ['Show me where', 'Which rule?', 'Which cell?', 'Walk me through it'];

      const row = (icon, label, text) => `
        <div class="whyhow-row">
          <span class="whyhow-badge border border-line text-moon"><i data-lucide="${icon}" style="width:13px;height:13px"></i></span>
          <div><div class="text-xs uppercase tracking-widest text-moon font-mono mb-0.5">${label}</div>
          <div class="text-sm text-ink">${text}</div></div>
        </div>`;

      const render = () => {
        if (level >= 1) view.effects.hint(region, level >= 3 ? target : null);

        const steps = [];
        if (level >= 1) steps.push(row('map-pin', 'Where', where));
        if (level >= 2) steps.push(row('book-open', 'Which rule', info.ruleNo ? `${info.name} — Rule ${info.ruleNo} (${info.rule}).` : `${info.name} — ${info.rule}.`));
        if (level >= 3) steps.push(row('crosshair', 'Which cell', 'The pulsing cell on the board is the one you can work out.'));
        if (level >= 4) steps.push(row('wand-sparkles', 'Why', `${step.reason} So it must be a <b class="text-ink">${symName}</b>.`));

        const controls = level < 4
          ? `<button type="button" data-next class="btn-primary btn w-full mt-4">${nextLabels[level]}</button>`
          : (placed ? '' : `<button type="button" data-place class="btn-primary btn w-full mt-4"><i data-lucide="${step.symbol === 'sun' ? 'sun' : 'moon'}"></i> Place the ${symName}</button>`);

        host.innerHTML = `
          ${level === 0 ? '<p class="text-sm text-ink-muted mb-1">Reveal only as much as you want — each step tells you more.</p>' : ''}
          <div class="flex flex-col gap-3">${steps.join('')}</div>
          ${controls}`;
        renderIcons();

        host.querySelector('[data-next]')?.addEventListener('click', () => { level++; render(); });
        host.querySelector('[data-place]')?.addEventListener('click', () => {
          placed = true;
          state.cycle(target.r, target.c, step.symbol === SUN ? +1 : -1);
          modal.close();
        });
      };
      render();
    },
  });
}

/* ------------------------------ Board session ---------------------------- */
function loadPuzzle(puzzle) {
  if (replay) { replay.exit(); replay = null; }
  session = { n: puzzle.n, difficulty: puzzle.difficulty ?? session.difficulty, seed: puzzle.seed ?? session.seed, cheated: false };
  state.load(puzzle);
  recordGameStarted();
  applyCheatGhost();
  const sel = $('#size-select');
  if (sel) sel.value = String(puzzle.n);
  const seedEl = $('#seed-label');
  if (seedEl) {
    seedEl.innerHTML =
      `<button id="seed-copy" class="hover:text-ink transition-colors" title="Copy shareable link">` +
      `<span class="uppercase tracking-wider text-${difficultyTone(session.difficulty)}">${session.difficulty}</span>` +
      ` · seed: <span class="text-ink-muted">${session.seed}</span></button>`;
    $('#seed-copy')?.addEventListener('click', copyShareLink);
  }
  syncUrl();
  refreshControls();
}

function difficultyTone(d) {
  return d === 'hard' ? 'violation' : d === 'medium' ? 'sun' : 'confirm';
}

function refreshControls() {
  const undo = $('#btn-undo'), redo = $('#btn-redo');
  if (undo) undo.disabled = !state.canUndo;
  if (redo) redo.disabled = !state.canRedo;
  const moves = $('#stat-moves');
  if (moves) moves.textContent = String(state.moves);
}

function randomSeed() {
  return Math.random().toString(36).slice(2, 8);
}

// Generate + load a puzzle, showing a progress modal for the big boards.
async function newPuzzle({ n = session.n, difficulty = session.difficulty, seed } = {}) {
  const opts = { n, difficulty, seed: seed ?? randomSeed() };
  const progress = n >= 8 ? openProgress(n, difficulty) : null;
  try {
    const puzzle = await generatePuzzle(opts, { onProgress: (f) => progress?.set(f) });
    progress?.close();
    loadPuzzle(puzzle);
    if (puzzle.difficulty !== difficulty) {
      toast(`Closest available was ${puzzle.difficulty} for this board`, { kind: 'info', duration: 2200 });
    }
  } catch (err) {
    progress?.close();
    toast('Could not generate a puzzle — please try again', { kind: 'warn' });
  }
}

function openProgress(n, difficulty) {
  const api = openModal({
    eyebrow: 'Generating', title: `${n} × ${n} · ${difficulty}`, size: 'sm', dismissable: false,
    body: `
      <p class="text-sm text-ink-muted mb-3">Building a puzzle with exactly one solution, reachable by pure logic…</p>
      <div class="h-2 rounded-full bg-surface-2 overflow-hidden"><div data-bar class="h-full w-0 bg-sun transition-[width] duration-200"></div></div>`,
  });
  const bar = api.bodyEl.querySelector('[data-bar]');
  return {
    set: (f) => { if (bar) bar.style.width = `${Math.round(Math.min(1, f) * 100)}%`; },
    close: () => api.close(),
  };
}

// Which sizes / difficulties are available. The tutorial unlocks the rest.
function isLockedSize(n) { return !isGraduated() && n > 6; }
function isLockedDiff(d) { return !isGraduated() && d !== 'easy'; }

// Open the "New puzzle" chooser (size + difficulty).
function openNewPuzzle() {
  const graduated = isGraduated();
  const seg = (name, options, active, fmt, locked) => options.map((o) => {
    const isLocked = locked(o);
    return `<button type="button" data-${name}="${o}" ${isLocked ? 'data-locked="1"' : ''}
      class="btn ${o === active ? 'btn-primary' : ''} ${isLocked ? 'opacity-40' : ''}">
      ${isLocked ? '<i data-lucide="lock" style="width:12px;height:12px"></i> ' : ''}${fmt(o)}</button>`;
  }).join('');

  openModal({
    eyebrow: 'New puzzle', title: 'Choose your challenge', size: 'md',
    body: `
      <div class="space-y-5">
        <div>
          <div class="eyebrow mb-2">Board size</div>
          <div class="flex flex-wrap gap-2" data-sizes>${seg('size', SIZES, session.n, (o) => `${o} × ${o}`, isLockedSize)}</div>
        </div>
        <div>
          <div class="eyebrow mb-2">Difficulty</div>
          <div class="flex flex-wrap gap-2" data-diffs>${seg('diff', DIFFICULTIES, session.difficulty, (o) => o[0].toUpperCase() + o.slice(1), isLockedDiff)}</div>
          <p class="mt-2 text-xs text-ink-faint">Difficulty is the hardest technique the puzzle requires. 8×8 and 10×10 generate in the background.</p>
        </div>
        ${graduated ? '' : '<p class="text-xs text-sun flex items-center gap-1.5"><i data-lucide="lock" style="width:13px;height:13px"></i> Finish the <button type="button" id="np-tut" class="underline hover:text-ink">tutorial</button> to unlock Medium, Hard and larger boards.</p>'}
      </div>
      <div class="mt-6 flex justify-end">
        <button type="button" id="np-go" class="btn-primary btn"><i data-lucide="sparkles"></i> Generate</button>
      </div>`,
    onMount: (bodyEl, modal) => {
      let n = isLockedSize(session.n) ? 6 : session.n;
      let difficulty = isLockedDiff(session.difficulty) ? 'easy' : session.difficulty;
      const paint = () => {
        bodyEl.querySelectorAll('[data-size]').forEach((b) => b.classList.toggle('btn-primary', Number(b.dataset.size) === n && !b.dataset.locked));
        bodyEl.querySelectorAll('[data-diff]').forEach((b) => b.classList.toggle('btn-primary', b.dataset.diff === difficulty && !b.dataset.locked));
      };
      bodyEl.querySelectorAll('[data-size]').forEach((b) => b.addEventListener('click', () => {
        if (b.dataset.locked) { toast('Finish the tutorial to unlock this size', { kind: 'lock', duration: 1800 }); return; }
        n = Number(b.dataset.size); paint();
      }));
      bodyEl.querySelectorAll('[data-diff]').forEach((b) => b.addEventListener('click', () => {
        if (b.dataset.locked) { toast('Finish the tutorial to unlock this difficulty', { kind: 'lock', duration: 1800 }); return; }
        difficulty = b.dataset.diff; paint();
      }));
      bodyEl.querySelector('#np-tut')?.addEventListener('click', () => { modal.close(); openTutorialMenu(); });
      bodyEl.querySelector('#np-go').addEventListener('click', () => { modal.close(); newPuzzle({ n, difficulty }); });
      paint();
    },
  });
}

async function onNew() {
  if (state.moves > 0) {
    const ok = await confirmModal({
      title: 'New puzzle?',
      message: 'This starts a fresh board. Your current progress will be lost.',
      confirmText: 'New puzzle', cancelText: 'Keep playing',
    });
    if (!ok) return;
  }
  openNewPuzzle();
}

async function onClear() {
  if (!state.grid.some((row, r) => row.some((v, c) => v && !state.isLocked(r, c)))) {
    toast('Nothing to clear', { kind: 'info', duration: 1200 });
    return;
  }
  const ok = await confirmModal({
    title: 'Clear the board?',
    message: 'Removes every symbol you placed. Given clues stay put. You can still undo afterwards.',
    confirmText: 'Clear', cancelText: 'Cancel',
  });
  if (ok) state.clearBoard();
}

function onSizeChange(e) {
  const n = Number(e.target.value);
  if (isLockedSize(n)) {
    toast('Finish the tutorial to unlock larger boards', { kind: 'lock', duration: 1800 });
    e.target.value = String(session.n);
    return;
  }
  newPuzzle({ n });
}

/* ------------------------- Tools: import / solve / cheat ----------------- */
function openTools() {
  const cheatOn = cheatGhostOn();
  openModal({
    eyebrow: 'Tools', title: 'Solve, import & cheats', size: 'md',
    body: `
      <div class="space-y-2">
        ${toolRow('import', 'upload', 'Import a board', 'Transcribe a Tango board from elsewhere and play it here.')}
        ${toolRow('watch', 'clapperboard', 'Watch the solve', 'Replay the logical solution one forced move at a time, with the technique for each.')}
        ${toolRow('reveal', 'wand-sparkles', 'Reveal the solution', 'Fill in the whole board. Flagged as assisted — not a personal best.')}
      </div>
      <div class="mt-5 pt-4 border-t border-line">
        <label class="flex items-start justify-between gap-4 cursor-pointer">
          <span><span class="block text-ink font-medium">Cheat: ghost overlay</span><span class="block text-sm text-ink-muted">Show the correct symbol faintly in every empty cell.</span></span>
          <input type="checkbox" id="tool-ghost" ${cheatOn ? 'checked' : ''} class="mt-1 h-5 w-5 shrink-0 accent-moon" />
        </label>
        <div class="mt-3 flex flex-wrap gap-2">
          <button data-tool="reveal-cell" class="btn text-xs"><i data-lucide="square" style="width:13px;height:13px"></i> Reveal focused cell</button>
          <button data-tool="reveal-line" class="btn text-xs"><i data-lucide="rows-3" style="width:13px;height:13px"></i> Reveal its row</button>
        </div>
        <p class="mt-2 text-xs text-ink-faint">Any reveal or the ghost overlay flags the win as assisted.</p>
      </div>`,
    onMount: (bodyEl, modal) => {
      const act = (fn) => { modal.close(); setTimeout(fn, 160); };
      bodyEl.querySelector('[data-tool="import"]').addEventListener('click', () => act(() => openImport(loadPuzzle)));
      bodyEl.querySelector('[data-tool="watch"]').addEventListener('click', () => act(watchSolve));
      bodyEl.querySelector('[data-tool="reveal"]').addEventListener('click', () => act(() => { markCheated(); revealSolution(state); }));
      bodyEl.querySelector('#tool-ghost').addEventListener('change', (e) => {
        localStorage.setItem(LS_CHEAT, e.target.checked ? '1' : '0');
        if (e.target.checked) markCheated();
        applyCheatGhost();
      });
      bodyEl.querySelector('[data-tool="reveal-cell"]').addEventListener('click', () => {
        markCheated(); const f = view.getFocus(); state.revealCells([f], currentSolution());
      });
      bodyEl.querySelector('[data-tool="reveal-line"]').addEventListener('click', () => {
        markCheated(); const f = view.getFocus();
        const row = Array.from({ length: state.n }, (_, c) => ({ r: f.r, c }));
        state.revealCells(row, currentSolution());
      });
    },
  });
}

function toolRow(id, icon, title, desc) {
  return `<button type="button" data-tool="${id}" class="w-full flex items-start gap-3 rounded-lg border border-line bg-surface-2/50 hover:bg-surface-3 px-3 py-3 text-left transition-colors">
    <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line text-moon"><i data-lucide="${icon}"></i></span>
    <span><span class="block text-sm text-ink font-medium">${title}</span><span class="block text-xs text-ink-muted">${desc}</span></span>
  </button>`;
}

async function watchSolve() {
  if (!currentSolution()) { toast('No solution available for this board', { kind: 'warn' }); return; }
  if (state.moves > 0) {
    const ok = await confirmModal({
      title: 'Watch the solve?',
      message: 'This resets the board to its clues and replays the logical solution. Your progress will be cleared.',
      confirmText: 'Watch it', cancelText: 'Cancel',
    });
    if (!ok) return;
  }
  replay = startReplay({ state, view, explainer, panelEl: $('#explain-mount'), onExit: () => { replay = null; } });
}

/* ------------------------------ Seed & URL ------------------------------- */
function syncUrl() {
  const url = new URL(window.location.href);
  url.searchParams.set('seed', session.seed);
  url.searchParams.set('n', String(session.n));
  url.searchParams.set('d', session.difficulty);
  window.history.replaceState(null, '', url);
}

function copyShareLink() {
  const url = window.location.href;
  navigator.clipboard?.writeText(url)
    .then(() => toast('Shareable link copied', { kind: 'success', duration: 1600 }))
    .catch(() => toast(url, { kind: 'info', duration: 3000 }));
}

/* ------------------------------ Keyboard --------------------------------- */
function initKeyboard() {
  document.addEventListener('keydown', (e) => {
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

    // Undo / redo (Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z).
    if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
      e.preventDefault();
      if (e.shiftKey) state.redo(); else state.undo();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) {
      e.preventDefault(); state.redo(); return;
    }
    if (e.ctrlKey || e.metaKey) return;

    if (e.key === 'r' || e.key === 'R') { e.preventDefault(); openRulebook(); }
    if (e.key === 'h' || e.key === 'H') { e.preventDefault(); openHint(); }
  });
}

/* --------------------------------- Boot ---------------------------------- */
function boot() {
  renderIcons();
  initMirror();
  initKeyboard();

  // Keep the header controls in sync with every state change.
  state.subscribe(refreshControls);

  view = createBoardView($('#board-mount'), state);
  explainer = createExplainer({ panelEl: $('#explain-mount'), view, state });
  // Run the explanation engine on every change (strict mode is on by default).
  explainer.setStrict(strictOn());
  state.subscribe((meta) => explainer.update(meta));
  // Timer, mistake counter, and win detection.
  state.subscribe(onStateChange);

  // Initial puzzle: reproduce from the URL if a seed is present, else fresh.
  const url = new URL(window.location.href);
  const urlN = Number(url.searchParams.get('n'));
  const urlD = url.searchParams.get('d');
  newPuzzle({
    n: SIZES.includes(urlN) ? urlN : 6,
    difficulty: DIFFICULTIES.includes(urlD) ? urlD : 'easy',
    seed: url.searchParams.get('seed') ?? undefined,
  });

  $('#btn-tutorial')?.addEventListener('click', openTutorialMenu);
  $('#btn-tools')?.addEventListener('click', openTools);
  $('#btn-hint')?.addEventListener('click', openHint);
  $('#btn-rulebook')?.addEventListener('click', openRulebook);
  $('#btn-settings')?.addEventListener('click', openSettings);
  $('#btn-help')?.addEventListener('click', openHelp);
  $('#btn-new')?.addEventListener('click', onNew);
  $('#btn-clear')?.addEventListener('click', onClear);
  $('#btn-undo')?.addEventListener('click', () => state.undo());
  $('#btn-redo')?.addEventListener('click', () => state.redo());
  $('#size-select')?.addEventListener('change', onSizeChange);

  // Gentle entrance for the two main columns.
  enter($('#board-col'), { y: 10 });
  enter($('#panel-col'), { y: 10, delay: 0.06 });

  // First-time visitors get the tutorial offered (mandatory-by-default, skippable).
  if (!tutorialSeen() && !isGraduated()) {
    setTimeout(openTutorialIntro, 600);
  }

  // Lightweight inspection hook (handy for debugging + automated checks).
  window.tango = { state, view, explainer, newPuzzle, get session() { return session; }, reset: () => newPuzzle({ ...session, seed: session.seed }) };
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
