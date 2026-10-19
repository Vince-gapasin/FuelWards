// maplibre-gl loads its web worker via `import.meta.url`, which Metro doesn't support.
// Copy the worker into public/ (served at the site root) so the web map can load it by URL.
// Runs on `npm install` (postinstall); the copy is git-ignored.
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
let source;
try {
  source = join(
    dirname(require.resolve('maplibre-gl/package.json')),
    'dist',
    'maplibre-gl-worker.mjs',
  );
} catch {
  process.exit(0); // maplibre-gl not installed (e.g. a production-only install); nothing to copy.
}

if (existsSync(source)) {
  mkdirSync('public', { recursive: true });
  copyFileSync(source, join('public', 'maplibre-gl-worker.mjs'));
}
