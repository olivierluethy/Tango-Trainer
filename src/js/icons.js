// Lucide icon initialisation. Uses the vendored UMD build (window.lucide).
// Never import `lucide-react` — this project is framework-free.

/**
 * Replace all <i data-lucide="name"> placeholders within `root` with SVGs.
 * Safe to call repeatedly (e.g. after injecting new DOM).
 * @param {ParentNode} [root=document]
 */
export function renderIcons(root = document) {
  const lucide = globalThis.lucide;
  if (!lucide?.createIcons) {
    console.warn('Lucide not loaded — icons will not render.');
    return;
  }
  // lucide.createIcons scans `document` for [data-lucide] placeholders and
  // swaps them for inline SVGs. It ignores already-rendered icons, so calling
  // it after injecting new DOM (e.g. a modal) is safe and idempotent.
  lucide.createIcons({
    nameAttr: 'data-lucide',
    attrs: { 'stroke-width': 1.75, class: 'lucide' },
  });
  void root;
}

/**
 * Convenience helper: build the markup for an inline icon placeholder.
 * @param {string} name Lucide icon name (kebab-case)
 * @param {string} [cls] extra classes
 */
export function icon(name, cls = '') {
  return `<i data-lucide="${name}" class="${cls}"></i>`;
}
