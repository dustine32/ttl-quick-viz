// Builds the site/ webview bundle and copies it into vscode/media/.
// Run from vscode/: `node scripts/build-webview.mjs`
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const siteDir = resolve(here, '../../site');
const distDir = resolve(siteDir, 'dist-webview');
const mediaDir = resolve(here, '../media');

if (!existsSync(siteDir)) {
  console.error('site/ not found at ' + siteDir);
  process.exit(1);
}

console.log('[build-webview] running site build...');
const isWindows = process.platform === 'win32';
const npm = isWindows ? 'npm.cmd' : 'npm';
const result = spawnSync(npm, ['run', 'build:webview'], {
  cwd: siteDir,
  stdio: 'inherit',
  shell: isWindows,
});
if (result.error) {
  console.error('[build-webview] failed to spawn npm:', result.error);
  process.exit(1);
}
if (result.status !== 0) {
  console.error('[build-webview] site build failed (exit ' + result.status + ')');
  process.exit(result.status ?? 1);
}

if (!existsSync(distDir)) {
  console.error('[build-webview] expected ' + distDir + ' to exist after build');
  process.exit(1);
}

if (existsSync(mediaDir)) {
  rmSync(mediaDir, { recursive: true, force: true });
}
mkdirSync(mediaDir, { recursive: true });
cpSync(distDir, mediaDir, { recursive: true });
console.log('[build-webview] copied ' + distDir + ' -> ' + mediaDir);
