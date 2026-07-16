// Copies runtime dependencies out of node_modules into /vendor so the app
// runs fully offline with no CDN calls. Run via `npm run vendor`.
import { copyFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const R = (...p) => resolve(root, ...p);

function copy(from, to) {
  const dest = R(to);
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(R(from), dest);
  console.log(`  ${from}  ->  ${to}`);
}

console.log('Vendoring runtime libraries:');
// Motion (motion.dev) — UMD build, exposes window.Motion
copy('node_modules/motion/dist/motion.js', 'vendor/motion.min.js');
// Lucide — UMD build, exposes window.lucide
copy('node_modules/lucide/dist/umd/lucide.min.js', 'vendor/lucide.min.js');

console.log('Vendoring self-hosted fonts:');
const fonts = [
  // Fraunces — display face (used with restraint)
  ['node_modules/@fontsource/fraunces/files/fraunces-latin-400-normal.woff2', 'vendor/fonts/fraunces-400.woff2'],
  ['node_modules/@fontsource/fraunces/files/fraunces-latin-600-normal.woff2', 'vendor/fonts/fraunces-600.woff2'],
  ['node_modules/@fontsource/fraunces/files/fraunces-latin-900-normal.woff2', 'vendor/fonts/fraunces-900.woff2'],
  // IBM Plex Sans — body / UI face
  ['node_modules/@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-400-normal.woff2', 'vendor/fonts/plex-sans-400.woff2'],
  ['node_modules/@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-500-normal.woff2', 'vendor/fonts/plex-sans-500.woff2'],
  ['node_modules/@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-600-normal.woff2', 'vendor/fonts/plex-sans-600.woff2'],
  // IBM Plex Mono — data / counters / seed
  ['node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff2', 'vendor/fonts/plex-mono-400.woff2'],
  ['node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-500-normal.woff2', 'vendor/fonts/plex-mono-500.woff2'],
];
for (const [from, to] of fonts) {
  if (!existsSync(R(from))) throw new Error(`Missing font source: ${from} (run npm install)`);
  copy(from, to);
}
console.log('Done. All dependencies are vendored under /vendor.');
