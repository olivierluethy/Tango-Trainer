// All Motion (motion.dev) calls live here. Uses the vendored UMD build
// (window.Motion) — the DOM/vanilla form of Framer Motion. Never import
// `framer-motion` (React-only).
//
// Every helper degrades gracefully when the user prefers reduced motion:
// the final state is applied instantly and any looping/explanatory animation
// is left in its "answer visible" state rather than hidden.

const M = () => globalThis.Motion;

/** True when the user asked the OS to minimise motion. */
export function prefersReducedMotion() {
  return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

/**
 * Thin wrapper over Motion.animate. Honours reduced-motion by jumping to the
 * end state. Returns the Motion animation controls (or null when skipped).
 * @param {Element|Element[]} el
 * @param {Object} keyframes
 * @param {Object} [options]
 */
export function animate(el, keyframes, options = {}) {
  const Motion = M();
  if (!Motion?.animate) return null;
  if (prefersReducedMotion()) {
    // Apply the resolved end-state without motion.
    const targets = el instanceof Element ? [el] : Array.from(el ?? []);
    for (const node of targets) {
      for (const [prop, val] of Object.entries(keyframes)) {
        const end = Array.isArray(val) ? val[val.length - 1] : val;
        node.style[prop] = typeof end === 'number' && prop === 'opacity' ? String(end) : end;
      }
    }
    return null;
  }
  return Motion.animate(el, keyframes, options);
}

/** Spring config presets tuned for the celestial feel. */
export const spring = {
  place: { type: 'spring', stiffness: 520, damping: 24, mass: 0.7 },
  soft: { type: 'spring', stiffness: 320, damping: 30 },
  pop: { type: 'spring', stiffness: 640, damping: 18 },
};

/** Re-export Motion's stagger helper (falls back to a no-op delay of 0). */
export function stagger(each, opts) {
  const Motion = M();
  return Motion?.stagger ? Motion.stagger(each, opts) : 0;
}

/** Run a callback the first time `el` scrolls into view. */
export function inView(el, onEnter, options) {
  const Motion = M();
  if (!Motion?.inView) {
    onEnter?.();
    return () => {};
  }
  return Motion.inView(el, onEnter, options);
}

/** A short attention shake — used for rejected input (e.g. locked cells). */
export function shake(el) {
  if (!el) return;
  if (prefersReducedMotion()) return;
  animate(
    el,
    { x: [0, -6, 6, -4, 4, 0] },
    { duration: 0.35, ease: 'easeInOut' },
  );
}

/** Fade + rise in. */
export function enter(el, { y = 8, duration = 0.28, delay = 0 } = {}) {
  return animate(el, { opacity: [0, 1], transform: [`translateY(${y}px)`, 'translateY(0px)'] }, {
    duration,
    delay,
    ease: 'easeOut',
  });
}
