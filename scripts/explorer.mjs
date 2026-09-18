#!/usr/bin/env node
// The Solar System Explorer's static build: explorer/index.html and src/explorer/ bundled by Vite into docs/explorer/,
// which GitHub Pages serves from main as https://devrowe.github.io/hand-sketch/explorer/. The build is committed, so
// Pages needs no CI.
//
// Usage: npm run explorer                        rebuild docs/explorer/
//        node scripts/explorer.mjs --check        build into a scratch folder and fail unless it matches docs/explorer/
//                                                 byte for byte (npm run check runs this, so a stale build cannot land)
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { build } from 'vite';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const target = path.join(root, 'docs', 'explorer');
const check = process.argv.includes('--check');

const files = dir => {
  const out = [];
  const walk = d => {
    for (const name of readdirSync(d).sort()) {
      const p = path.join(d, name);
      if (statSync(p).isDirectory()) walk(p);
      else out.push(path.relative(dir, p));
    }
  };
  walk(dir);
  return out;
};

const outDir = check ? mkdtempSync(path.join(tmpdir(), 'explorer-check-')) : target;
try {
  await build({ configFile: path.join(root, 'vite.explorer.config.ts'), logLevel: check ? 'error' : 'info', build: { outDir, emptyOutDir: true } });
  if (check) {
    const want = files(outDir), have = (() => { try { return files(target); } catch { return []; } })();
    const stale = want.length !== have.length || want.some((f, i) => f !== have[i] || !readFileSync(path.join(outDir, f)).equals(readFileSync(path.join(target, f))));
    if (stale) {
      console.error('docs/explorer/ is out of date with explorer/ and src/: run `npm run explorer` and commit docs/explorer/.');
      process.exitCode = 1;
    } else console.log(`docs/explorer/ is up to date (${want.length} files).`);
  }
} finally {
  if (check) rmSync(outDir, { recursive: true, force: true });
}
