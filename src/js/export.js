// "Download the game" — save the self-contained single-file build. When served,
// this fetches the pre-built dist/tango-trainer.html. When already running as
// the single file (opened from disk), the current document is itself fully
// self-contained, so we serialise and save that.

import { toast } from './toast.js';

function saveBlob(html, filename) {
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** True when the page is fully inlined (no external css/js) — the single file. */
function isSelfContained() {
  const hasExternalCss = !!document.querySelector('link[rel="stylesheet"]');
  const hasModuleScript = !!document.querySelector('script[type="module"][src]');
  return !hasExternalCss && !hasModuleScript;
}

export async function downloadGame() {
  const filename = 'tango-trainer.html';
  // Prefer the pre-built single file when it's reachable.
  try {
    const res = await fetch('dist/tango-trainer.html', { cache: 'no-store' });
    if (res.ok) {
      const html = await res.text();
      if (html.length > 1000) { saveBlob(html, filename); toast('Downloaded tango-trainer.html', { kind: 'success' }); return; }
    }
  } catch { /* not served / not built — fall through */ }

  if (isSelfContained()) {
    saveBlob('<!DOCTYPE html>\n' + document.documentElement.outerHTML, filename);
    toast('Downloaded this game as a single file', { kind: 'success' });
    return;
  }
  toast('Run “npm run build:single” to create the downloadable file', { kind: 'warn', duration: 3200 });
}
