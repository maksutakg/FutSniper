import { build } from 'esbuild';
import { readFile } from 'node:fs/promises';

const pkg = JSON.parse(await readFile(new URL('./package.json', import.meta.url), 'utf8'));

const banner = `// ==UserScript==
// @name         FUT Sniper
// @namespace    fut-sniper
// @version      ${pkg.version}
// @description  EA FC Web App tek hedef sniper
// @match        https://www.ea.com/*ultimate-team/web-app*
// @grant        none
// @run-at       document-idle
// ==/UserScript==`;

await build({
  entryPoints: ['src/main.js'],
  bundle: true,
  format: 'iife',
  target: 'es2020',
  outfile: 'dist/fut-sniper.user.js',
  banner: { js: banner },
});

console.log('dist/fut-sniper.user.js yazıldı');
