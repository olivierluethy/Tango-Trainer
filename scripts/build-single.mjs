// Build dist/tango-trainer.html — a single, self-contained HTML file that opens
// by double-click and runs fully offline. Bundles the ES modules (esbuild),
// inlines the compiled CSS with base64 fonts, and inlines the vendored
// Motion + Lucide globals. Run via `npm run build:single` (which builds CSS +
// vendor first).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const R = (...p) => resolve(root, ...p);

// 1) Bundle the app. __SINGLE_FILE__=true disables the Web Worker path so no
//    separate worker file is referenced; generation falls back to synchronous.
const bundle = await esbuild.build({
  entryPoints: [R('src/js/main.js')],
  bundle: true,
  format: 'iife',
  target: 'es2020',
  minify: true,
  legalComments: 'none',
  define: { __SINGLE_FILE__: 'true' },
  write: false,
});
const appJs = bundle.outputFiles[0].text;

// 2) Inline CSS, replacing font url()s with base64 data URIs.
let css = readFileSync(R('dist/app.css'), 'utf8');
css = css.replace(/url\((['"]?)([^'")]+\.woff2)\1\)/g, (_m, _q, url) => {
  const file = R('vendor/fonts', basename(url));
  const b64 = readFileSync(file).toString('base64');
  return `url(data:font/woff2;base64,${b64})`;
});

// 3) Vendored globals (Motion, Lucide).
const motion = readFileSync(R('vendor/motion.min.js'), 'utf8');
const lucide = readFileSync(R('vendor/lucide.min.js'), 'utf8');

// 4) Rewrite index.html: drop external refs, inline everything.
// NOTE: string replacements are passed as FUNCTIONS so `$` sequences in the
// minified CSS/JS are treated literally (a plain string arg would interpret
// $&, $', $` and re-inject the matched tag).
let html = readFileSync(R('index.html'), 'utf8');
html = html
  .replace(/\s*<link rel="preload"[^>]*>/g, '')
  .replace(/\s*<link rel="stylesheet"[^>]*>/, () => `\n  <style>\n${css}\n  </style>`)
  .replace(/\s*<script src="vendor\/motion\.min\.js"><\/script>/, '')
  .replace(/\s*<script src="vendor\/lucide\.min\.js"><\/script>/, '')
  .replace(
    /\s*<script type="module" src="src\/js\/main\.js"><\/script>/,
    () => `\n  <script>\n${motion}\n</script>\n  <script>\n${lucide}\n</script>\n  <script>\n${appJs}\n</script>`,
  );

for (const ref of ['src/js/main.js', 'dist/app.css']) {
  const i = html.indexOf(ref);
  if (i >= 0) {
    console.error(`Leftover reference "${ref}" at ${i}: ${JSON.stringify(html.slice(i - 50, i + 20))}`);
    throw new Error('Inlining failed — external references remain in the output.');
  }
}

const out = R('dist/tango-trainer.html');
writeFileSync(out, html);
const kb = (Buffer.byteLength(html) / 1024).toFixed(0);
console.log(`Wrote ${out} (${kb} KB, self-contained, offline).`);
if (!existsSync(R('dist/app.css'))) throw new Error('dist/app.css missing — run `npm run build` first.');
