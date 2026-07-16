// Lightweight, non-blocking toasts. Used for brief one-line feedback such as
// "This cell is a given clue — it can't be changed." Toasts never carry the
// teaching explanation; that always lives in the panel/modal.

import { renderIcons } from './icons.js';
import { animate, prefersReducedMotion } from './animate.js';

const ICONS = {
  info: 'info',
  warn: 'triangle-alert',
  lock: 'lock',
  success: 'check',
};

/**
 * Show a transient toast.
 * @param {string} message
 * @param {Object} [opts]
 * @param {'info'|'warn'|'lock'|'success'} [opts.kind='info']
 * @param {number} [opts.duration=2200] ms visible before auto-dismiss
 */
export function toast(message, { kind = 'info', duration = 2200 } = {}) {
  const rootEl = document.getElementById('toast-root');
  if (!rootEl) return;

  const accent = kind === 'success' ? 'text-confirm'
    : kind === 'warn' ? 'text-violation'
    : kind === 'lock' ? 'text-sun'
    : 'text-moon';

  const el = document.createElement('div');
  el.className =
    'pointer-events-auto flex items-center gap-2.5 rounded-lg border border-line ' +
    'bg-surface-2/95 backdrop-blur px-4 py-2.5 text-sm text-ink shadow-panel';
  el.setAttribute('role', 'status');
  el.innerHTML =
    `<i data-lucide="${ICONS[kind] ?? ICONS.info}" class="${accent}" style="width:16px;height:16px"></i>` +
    `<span>${message}</span>`;

  rootEl.appendChild(el);
  renderIcons();

  if (!prefersReducedMotion()) {
    animate(el, { opacity: [0, 1], transform: ['translateY(10px)', 'translateY(0)'] }, { duration: 0.22, ease: 'easeOut' });
  }

  const remove = () => {
    if (prefersReducedMotion()) { el.remove(); return; }
    const a = animate(el, { opacity: [1, 0], transform: ['translateY(0)', 'translateY(6px)'] }, { duration: 0.18 });
    if (a?.finished) a.finished.then(() => el.remove());
    else setTimeout(() => el.remove(), 200);
  };

  setTimeout(remove, duration);
  return remove;
}
