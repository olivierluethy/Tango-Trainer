// Tutorial mode — a scripted, modal-driven course. Each lesson runs on its own
// small board (reusing the real board view + explanation engine), teaches one
// concept on a distinct scenario, and — for every rule — deliberately lets the
// learner make the mistake, then runs the full explanation pipeline on it.
//
// Finishing all lessons sets a "graduated" flag that unlocks every difficulty
// and board size. Any lesson can be replayed from the menu at any time.

import { openModal } from './modal.js';
import { GameState } from './state.js';
import { createBoardView } from './render.js';
import { createExplainer } from './explain.js';
import { computeHint, TECHNIQUE_INFO } from './hints.js';
import { renderIcons } from './icons.js';
import { validate } from './rules.js';
import { LESSONS } from './lessons.js';

export { LESSONS };


/* ------------------------------- storage --------------------------------- */
const LS_DONE = 'tango.lessonsDone';
const LS_GRAD = 'tango.graduated';
const LS_SEEN = 'tango.tutorialSeen';

function doneSet() {
  try { return new Set(JSON.parse(localStorage.getItem(LS_DONE) || '[]')); } catch { return new Set(); }
}
function markDone(id) {
  const s = doneSet(); s.add(id);
  localStorage.setItem(LS_DONE, JSON.stringify([...s]));
  if (LESSONS.every((l) => s.has(l.id))) localStorage.setItem(LS_GRAD, '1');
}
export function isGraduated() { return localStorage.getItem(LS_GRAD) === '1'; }
export function tutorialSeen() { return localStorage.getItem(LS_SEEN) === '1'; }
export function markTutorialSeen() { localStorage.setItem(LS_SEEN, '1'); }

/* ------------------------------- lesson run ------------------------------ */
function openLesson(index, { sequential = false } = {}) {
  const lesson = LESSONS[index];
  const puzzle = lesson.make();
  const steps = lesson.steps;
  let stepIdx = 0;
  let reached = false;

  const dots = steps.map((_, i) => `<span data-dot="${i}" class="h-1.5 w-1.5 rounded-full bg-line"></span>`).join('');

  // Cleanup handle: onMount fills it, onClose calls it (both run within openModal).
  const cleanupRef = { fn: null };
  const cleanup = () => cleanupRef.fn?.();

  const body = `
    <div class="flex flex-col lg:flex-row gap-5 items-start">
      <div class="mx-auto lg:mx-0 shrink-0">
        <div data-tut-board class="panel p-3"></div>
        <div class="mt-2 flex justify-center gap-2">
          <button data-tut-undo class="btn-icon" title="Undo"><i data-lucide="undo-2"></i></button>
          ${lesson.hints ? '<button data-tut-hint class="btn text-xs"><i data-lucide="lightbulb"></i> Hint</button>' : ''}
        </div>
      </div>
      <div class="flex-1 min-w-0 w-full">
        <div class="rounded-xl border border-line bg-surface-2/40 p-4">
          <div class="eyebrow mb-1">Lesson goal</div>
          <p class="text-sm text-ink mb-3">${lesson.goal}</p>
          <div class="flex items-start gap-2">
            <i data-lucide="graduation-cap" class="text-moon mt-0.5 shrink-0" style="width:16px;height:16px"></i>
            <p data-coach class="text-sm text-ink leading-relaxed"></p>
          </div>
          <div class="mt-4 flex items-center justify-between gap-3">
            <div class="flex items-center gap-1.5" data-dots>${dots}</div>
            <button data-continue class="btn-primary btn"></button>
          </div>
        </div>
        <div data-tut-panel class="panel p-4 mt-4 min-h-[180px]"></div>
      </div>
    </div>`;

  const modal = openModal({
    eyebrow: `Tutorial · Lesson ${index + 1} of ${LESSONS.length}`,
    title: lesson.title,
    size: 'xl',
    body,
    onClose: () => cleanup(),
    onMount: (bodyEl) => {
      const boardEl = bodyEl.querySelector('[data-tut-board]');
      const panelEl = bodyEl.querySelector('[data-tut-panel]');
      const coachEl = bodyEl.querySelector('[data-coach]');
      const continueBtn = bodyEl.querySelector('[data-continue]');

      const tState = new GameState();
      const tView = createBoardView(boardEl, tState);
      const tExplainer = createExplainer({ panelEl, view: tView, state: tState });
      const unsubs = [
        tState.subscribe((m) => tExplainer.update(m)),
        tState.subscribe(() => { if (gateMet()) reached = true; paintContinue(); }),
      ];
      cleanupRef.fn = () => { unsubs.forEach((u) => u()); tView.destroy(); };

      tState.load(puzzle);

      function gateMet() {
        const gt = steps[stepIdx].gate;
        if (gt.type === 'next') return true;
        if (gt.type === 'cell') return tState.cell(gt.r, gt.c) === gt.symbol;
        if (gt.type === 'violation') return validate(tState.grid, tState.puzzle).some((v) => !gt.rule || v.rule === gt.rule);
        if (gt.type === 'solved') return tState.isFilled() && validate(tState.grid, tState.puzzle).length === 0;
        return false;
      }

      function paintContinue() {
        const step = steps[stepIdx];
        const isNext = step.gate.type === 'next';
        const last = stepIdx === steps.length - 1;
        continueBtn.disabled = !(isNext || reached);
        continueBtn.innerHTML = last ? (lesson.last ? 'Finish & graduate' : 'Finish lesson') : 'Continue';
        bodyEl.querySelectorAll('[data-dot]').forEach((d, i) => {
          d.className = `h-1.5 w-1.5 rounded-full ${i < stepIdx ? 'bg-moon' : i === stepIdx ? 'bg-sun' : 'bg-line'}`;
        });
      }

      function renderStep(i) {
        if (i >= steps.length) { finish(); return; }
        stepIdx = i;
        reached = false;
        const step = steps[i];
        tState.activeCells = step.active === undefined ? null
          : step.active === 'none' ? new Set()
          : new Set(step.active.map((a) => `${a.r},${a.c}`));
        tView.effects.clear();
        if (step.focus || step.target) {
          tView.effects.hint((step.focus ?? [step.target]), step.target ?? null);
        }
        coachEl.textContent = step.text;
        if (gateMet()) reached = true;
        paintContinue();
        renderIcons();
      }

      function finish() {
        markDone(lesson.id);
        modal.close();
        if (sequential && index < LESSONS.length - 1) {
          setTimeout(() => openLesson(index + 1, { sequential: true }), 200);
        } else if (lesson.last || isGraduated()) {
          setTimeout(openGraduation, 200);
        } else {
          setTimeout(() => openTutorialMenu(), 200);
        }
      }

      continueBtn.addEventListener('click', () => renderStep(stepIdx + 1));
      bodyEl.querySelector('[data-tut-undo]')?.addEventListener('click', () => tState.undo());
      bodyEl.querySelector('[data-tut-hint]')?.addEventListener('click', () => {
        const h = computeHint(tState);
        if (h.kind === 'step') {
          tView.effects.hint(h.region, h.target);
          const info = TECHNIQUE_INFO[h.step.technique];
          coachEl.innerHTML = `<span class="text-moon">Hint.</span> ${h.where} ${info.ruleNo ? `(Rule ${info.ruleNo})` : ''} The pulsing cell can be worked out.`;
        } else if (h.kind === 'solved') {
          coachEl.innerHTML = '<span class="text-confirm">Solved!</span> Press Continue.';
        } else {
          coachEl.innerHTML = '<span class="text-violation">Check the board</span> — something already placed may be blocking the solve. Try Undo.';
        }
      });

      renderStep(0);
    },
  });
}

/* ------------------------------- menu / intro ---------------------------- */
export function openTutorialMenu() {
  const done = doneSet();
  const items = LESSONS.map((l, i) => `
    <button type="button" data-lesson="${i}" class="w-full flex items-center gap-3 rounded-lg border border-line bg-surface-2/50 hover:bg-surface-3 px-3 py-2.5 text-left transition-colors">
      <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border ${done.has(l.id) ? 'border-confirm/50 text-confirm' : 'border-line text-ink-faint'} font-mono text-xs">
        ${done.has(l.id) ? '✓' : i + 1}
      </span>
      <span class="min-w-0">
        <span class="block text-sm text-ink">${l.title}</span>
        <span class="block text-xs text-ink-muted truncate">${l.goal}</span>
      </span>
    </button>`).join('');

  openModal({
    eyebrow: 'Tutorial', title: isGraduated() ? 'Replay any lesson' : 'Learn to play Tango', size: 'md',
    body: `
      <p class="text-sm text-ink-muted mb-4">${isGraduated() ? 'You have graduated — revisit any lesson any time.' : 'Fourteen short lessons, each on a fresh board. You will make each mistake once and see exactly why it is wrong.'}</p>
      <div class="mb-4"><button type="button" id="tut-start" class="btn-primary btn w-full"><i data-lucide="play"></i> ${done.size ? 'Continue the course' : 'Start from the beginning'}</button></div>
      <div class="space-y-2 max-h-[46vh] overflow-y-auto pr-1">${items}</div>`,
    onMount: (bodyEl, api) => {
      bodyEl.querySelector('#tut-start')?.addEventListener('click', () => {
        api.close();
        const firstUndone = LESSONS.findIndex((l) => !done.has(l.id));
        setTimeout(() => openLesson(firstUndone < 0 ? 0 : firstUndone, { sequential: true }), 180);
      });
      bodyEl.querySelectorAll('[data-lesson]').forEach((b) => b.addEventListener('click', () => {
        api.close();
        setTimeout(() => openLesson(Number(b.dataset.lesson), { sequential: false }), 180);
      }));
    },
  });
}

export function openTutorialIntro() {
  markTutorialSeen();
  openModal({
    eyebrow: 'Welcome', title: 'New to Tango?', size: 'sm',
    body: `
      <p class="text-sm text-ink-muted mb-5">Tango is a logic puzzle of Suns and Moons. A quick guided course teaches every rule — and shows you why each mistake is a mistake — in a few minutes. You can skip and explore anytime.</p>
      <div class="flex justify-end gap-3">
        <button type="button" id="intro-skip" class="btn">Explore on my own</button>
        <button type="button" id="intro-start" class="btn-primary btn"><i data-lucide="graduation-cap"></i> Start tutorial</button>
      </div>`,
    onMount: (bodyEl, api) => {
      bodyEl.querySelector('#intro-skip')?.addEventListener('click', () => api.close());
      bodyEl.querySelector('#intro-start')?.addEventListener('click', () => { api.close(); setTimeout(() => openLesson(0, { sequential: true }), 180); });
    },
  });
}

function openGraduation() {
  openModal({
    eyebrow: 'Tutorial complete', title: 'You have graduated!', size: 'sm',
    body: `
      <div class="text-center py-2">
        <span class="inline-flex h-16 w-16 items-center justify-center rounded-full border border-confirm/50 bg-confirm/10 text-confirm mb-3"><i data-lucide="graduation-cap"></i></span>
        <p class="text-sm text-ink-muted">Every difficulty — Easy, Medium and Hard — and all board sizes up to 10×10 are now unlocked. Any lesson stays available to replay from the Tutorial menu.</p>
      </div>
      <div class="mt-4"><button type="button" id="grad-go" class="btn-primary btn w-full">Start playing</button></div>`,
    onMount: (bodyEl, api) => { bodyEl.querySelector('#grad-go')?.addEventListener('click', () => api.close()); },
  });
}
