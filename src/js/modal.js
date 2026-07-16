// Modal system. This app never navigates away and never opens a second page —
// settings, tutorial lessons, the rulebook, help, and confirmations are ALL
// modals rendered into #modal-root. Supports stacking, focus trapping, ESC to
// dismiss the top layer, backdrop click, and focus restoration.

import { renderIcons } from './icons.js';
import { animate, prefersReducedMotion } from './animate.js';

const FOCUSABLE = [
  'a[href]', 'button:not([disabled])', 'input:not([disabled])',
  'select:not([disabled])', 'textarea:not([disabled])', '[tabindex]:not([tabindex="-1"])',
].join(',');

/** @type {Array<{overlay: HTMLElement, restore: Element|null, onClose?: Function}>} */
const stack = [];

function root() {
  let r = document.getElementById('modal-root');
  if (!r) {
    r = document.createElement('div');
    r.id = 'modal-root';
    document.body.appendChild(r);
  }
  return r;
}

/**
 * Open a modal.
 * @param {Object} opts
 * @param {string} [opts.title] heading text
 * @param {string} [opts.eyebrow] small label above the title
 * @param {string|Node} opts.body HTML string or node for the modal body
 * @param {string} [opts.size] 'sm' | 'md' | 'lg' | 'xl'
 * @param {boolean} [opts.dismissable=true] allow ESC / backdrop / close button
 * @param {Function} [opts.onClose] called after the modal closes
 * @param {Function} [opts.onMount] called with (bodyEl, api) after mount
 * @returns {{close: Function, el: HTMLElement}}
 */
export function openModal(opts) {
  const {
    title, eyebrow, body, size = 'md',
    dismissable = true, onClose, onMount,
  } = opts;

  const restore = document.activeElement;

  const overlay = document.createElement('div');
  overlay.className =
    'fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 ' +
    'bg-base/70 backdrop-blur-sm';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');

  const widths = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };
  const titleId = `modal-title-${stack.length}`;
  if (title) overlay.setAttribute('aria-labelledby', titleId);

  const dialog = document.createElement('div');
  dialog.className =
    `panel w-full ${widths[size] ?? widths.md} max-h-[88vh] overflow-hidden ` +
    'flex flex-col shadow-panel';

  const headHtml = (title || dismissable)
    ? `<header class="flex items-start justify-between gap-4 px-6 pt-5 pb-4 border-b border-line">
         <div>
           ${eyebrow ? `<div class="eyebrow mb-1">${eyebrow}</div>` : ''}
           ${title ? `<h2 id="${titleId}" class="font-display text-xl text-ink">${title}</h2>` : ''}
         </div>
         ${dismissable
           ? `<button type="button" data-close class="btn-icon shrink-0" aria-label="Close">
                <i data-lucide="x"></i>
              </button>`
           : ''}
       </header>`
    : '';

  dialog.innerHTML =
    headHtml +
    `<div data-modal-body class="px-6 py-5 overflow-y-auto text-ink-muted leading-relaxed"></div>`;

  const bodyEl = dialog.querySelector('[data-modal-body]');
  if (typeof body === 'string') bodyEl.innerHTML = body;
  else if (body instanceof Node) bodyEl.appendChild(body);

  overlay.appendChild(dialog);
  root().appendChild(overlay);
  renderIcons();

  const entry = { overlay, restore, onClose };
  stack.push(entry);
  document.documentElement.style.overflow = 'hidden';

  const close = () => closeEntry(entry);

  // Dismissal wiring
  if (dismissable) {
    overlay.addEventListener('mousedown', (e) => {
      // Only close on genuine backdrop clicks (not drags starting inside).
      if (e.target === overlay) close();
    });
    dialog.querySelector('[data-close]')?.addEventListener('click', close);
  }

  // Entrance animation
  if (!prefersReducedMotion()) {
    animate(overlay, { opacity: [0, 1] }, { duration: 0.15 });
    animate(dialog,
      { opacity: [0, 1], transform: ['translateY(12px) scale(0.98)', 'translateY(0) scale(1)'] },
      { duration: 0.28, ease: [0.34, 1.56, 0.64, 1] });
  }

  // Focus the first focusable element (or the dialog itself).
  const first = dialog.querySelector(FOCUSABLE);
  (first ?? dialog).focus?.();
  if (!first) dialog.setAttribute('tabindex', '-1');

  const api = { close, el: dialog, bodyEl };
  onMount?.(bodyEl, api);
  return api;
}

function closeEntry(entry) {
  const idx = stack.indexOf(entry);
  if (idx === -1) return;
  stack.splice(idx, 1);

  const finish = () => {
    entry.overlay.remove();
    if (stack.length === 0) document.documentElement.style.overflow = '';
    entry.onClose?.();
    if (entry.restore instanceof HTMLElement) entry.restore.focus?.();
  };

  if (prefersReducedMotion()) {
    finish();
  } else {
    const a = animate(entry.overlay, { opacity: [1, 0] }, { duration: 0.15 });
    if (a?.finished) a.finished.then(finish);
    else setTimeout(finish, 160);
  }
}

/** Close the top-most modal, if any. Returns true if one was closed. */
export function closeTopModal() {
  const top = stack[stack.length - 1];
  if (top) { closeEntry(top); return true; }
  return false;
}

/** Whether any modal is currently open. */
export function isModalOpen() {
  return stack.length > 0;
}

// Global key + focus-trap handling for the top-most modal.
document.addEventListener('keydown', (e) => {
  const top = stack[stack.length - 1];
  if (!top) return;

  if (e.key === 'Escape') {
    // Only dismissable modals respond to ESC.
    if (top.overlay.querySelector('[data-close]')) {
      e.preventDefault();
      closeEntry(top);
    }
    return;
  }

  if (e.key === 'Tab') {
    const nodes = Array.from(top.overlay.querySelectorAll(FOCUSABLE))
      .filter((n) => n.offsetParent !== null);
    if (nodes.length === 0) { e.preventDefault(); return; }
    const firstNode = nodes[0];
    const lastNode = nodes[nodes.length - 1];
    if (e.shiftKey && document.activeElement === firstNode) {
      e.preventDefault(); lastNode.focus();
    } else if (!e.shiftKey && document.activeElement === lastNode) {
      e.preventDefault(); firstNode.focus();
    }
  }
});

/**
 * Convenience confirm dialog. Resolves true (confirmed) or false (cancelled).
 * @param {Object} opts
 * @returns {Promise<boolean>}
 */
export function confirmModal({
  title = 'Are you sure?', message = '',
  confirmText = 'Confirm', cancelText = 'Cancel', danger = false,
}) {
  return new Promise((resolve) => {
    let decided = false;
    const api = openModal({
      title,
      size: 'sm',
      body: `
        <p class="text-ink-muted">${message}</p>
        <div class="mt-6 flex justify-end gap-3">
          <button type="button" data-cancel class="btn">${cancelText}</button>
          <button type="button" data-confirm class="btn ${danger ? 'bg-violation/90 border-transparent text-white hover:bg-violation' : 'btn-primary'}">${confirmText}</button>
        </div>`,
      onClose: () => { if (!decided) resolve(false); },
      onMount: (bodyEl) => {
        bodyEl.querySelector('[data-confirm]').addEventListener('click', () => {
          decided = true; resolve(true); api.close();
        });
        bodyEl.querySelector('[data-cancel]').addEventListener('click', () => {
          decided = true; resolve(false); api.close();
        });
      },
    });
  });
}
