// Bundle the extension into a single CommonJS file so the .vsix doesn't
// need to ship node_modules/ at all. Run via `npm run compile` (production)
// or `npm run watch` (during development).
import { build, context } from 'esbuild';

const watch = process.argv.includes('--watch');
const minify = process.argv.includes('--minify');

const options = {
  entryPoints: ['src/extension.ts'],
  bundle: true,
  outfile: 'out/extension.js',
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  external: ['vscode'],
  sourcemap: !minify,
  minify,
  logLevel: 'info',
};

if (watch) {
  const ctx = await context(options);
  await ctx.watch();
  console.log('[esbuild] watching...');
} else {
  await build(options);
}
