// Async puzzle generation. Runs the generator in a Web Worker for 8×8 / 10×10
// (with a progress callback + retry-on-timeout), and synchronously for small
// boards. Falls back to synchronous generation whenever a worker can't be
// created or times out — so the app keeps working offline / single-file even
// where module workers are unavailable.

import { generate } from './generator.js';

// In the single-file build this constant is replaced with `true` (esbuild
// define), so the worker branch below is dead-code-eliminated — no separate
// worker file is referenced, and generation falls back to synchronous.
const SINGLE_FILE = typeof __SINGLE_FILE__ !== 'undefined' && __SINGLE_FILE__;

let worker = null;
let nextId = 1;
const pending = new Map();

function getWorker() {
  if (SINGLE_FILE) return null;
  if (worker) return worker;
  try {
    worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = (e) => {
      const { id, type } = e.data;
      const p = pending.get(id);
      if (!p) return;
      if (type === 'progress') { p.onProgress?.(e.data.frac); return; }
      pending.delete(id);
      if (type === 'done') p.resolve(e.data.puzzle);
      else p.reject(new Error(e.data.message || 'worker error'));
    };
    worker.onerror = () => resetWorker();
  } catch {
    worker = null;
  }
  return worker;
}

function resetWorker() {
  if (worker) { try { worker.terminate(); } catch { /* noop */ } }
  worker = null;
  for (const p of pending.values()) p.reject(new Error('worker reset'));
  pending.clear();
}

function runOnWorker(w, opts, onProgress, timeout) {
  return new Promise((resolve, reject) => {
    const id = nextId++;
    const to = setTimeout(() => { pending.delete(id); reject(new Error('timeout')); }, timeout);
    pending.set(id, {
      onProgress,
      resolve: (p) => { clearTimeout(to); resolve(p); },
      reject: (e) => { clearTimeout(to); reject(e); },
    });
    w.postMessage({ id, opts });
  });
}

/**
 * Generate a puzzle, off-thread when it matters.
 * @param {Object} opts generator options (n, difficulty, seed)
 * @param {Object} [ctrl]
 * @param {(frac:number)=>void} [ctrl.onProgress]
 * @param {number} [ctrl.timeout=12000] per worker attempt
 * @param {number} [ctrl.tries=2] worker attempts before the sync fallback
 */
export async function generatePuzzle(opts, { onProgress, timeout = 12000, tries = 2 } = {}) {
  if ((opts.n ?? 6) >= 8) {
    for (let t = 0; t < tries; t++) {
      const w = getWorker();
      if (!w) break;
      try {
        // First attempt keeps the exact seed (reproducible); retries vary it.
        const seed = t === 0 ? opts.seed : `${opts.seed ?? ''}~${t}`;
        return await runOnWorker(w, { ...opts, seed }, onProgress, timeout);
      } catch {
        resetWorker();
      }
    }
  }
  // Small board, or no worker / all worker attempts failed: run synchronously.
  onProgress?.(0.15);
  const puzzle = generate(opts);
  onProgress?.(1);
  return puzzle;
}
