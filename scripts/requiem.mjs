#!/usr/bin/env node
// Render "Requiem", the etched montage (src/scenes/requiem/), into output/requiem/: requiem.mp4 (the whole montage,
// 12 drawn fps held to 24 fps), requiem-poster.png/.jpg at the catalogue's poster moment, a contact sheet, and
// requiem.json (format, length and the cut list on the drawn-frame grid). The render is a local artifact: output/ is
// ignored and this set is not force-added to the repository.
//
// Usage (via `npm run requiem -- <flags>`):
//   --verify        render every frame twice in independent page loads and fail if any differs
//   --out dir       delivery folder (default output/requiem/)
//   --keep-frames   keep the frame PNGs in output/requiem-frames/ (removed after encoding by default)
import { execFileSync } from 'node:child_process';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { root } from './lib/web-set.mjs';

const argv = process.argv.slice(2);
const flag = name => { const k = argv.indexOf(name); return k >= 0 ? argv[k + 1] : undefined; };
const outDir = path.resolve(root, flag('--out') ?? 'output/requiem');
const frames = path.join(root, 'output', 'requiem-frames');
const catalog = JSON.parse(readFileSync(path.join(root, 'src/scenes/requiem/catalog.json'), 'utf8'));

const args = ['scripts/render.mjs', '--program', 'sequence:requiem', '--ar', catalog.ar, '--width', String(catalog.width), '--out', outDir, '--name', 'requiem', '--poster', '--frames', frames];
if (argv.includes('--verify')) args.push('--verify');
try {
  execFileSync(process.execPath, args, { cwd: root, stdio: 'inherit' });
} catch {
  // render.mjs has already said what went wrong
  process.exit(1);
}
if (!argv.includes('--keep-frames')) rmSync(frames, { recursive: true, force: true });

// the cut list as the montage plays it: every film cut snapped to the 12 fps grid, flashes shorter than a frame gone
const FPS = 12, total = Math.round(catalog.end * FPS);
const film = [...new Set([0, ...catalog.filmCuts, ...catalog.addedCuts])].sort((a, b) => a - b);
const snapped = film.map(t => Math.round(t * FPS));
const cuts = snapped.filter((f, k) => f < total && (k + 1 === snapped.length || snapped[k + 1] > f));
const [w, h] = catalog.ar.split(':').map(Number);
writeFileSync(path.join(outDir, 'requiem.json'), JSON.stringify({
  title: catalog.title, line: catalog.line, program: 'sequence:requiem', ar: catalog.ar, width: catalog.width, height: Math.round((catalog.width * h) / w / 2) * 2,
  fps: FPS, outputFps: 24, frames: total, seconds: total / FPS, shots: cuts.length, poster: Math.round(catalog.poster * FPS),
  cuts: cuts.map(f => ({ frame: f, seconds: f / FPS })),
  video: 'requiem.mp4', posterImage: { png: 'requiem-poster.png', jpg: 'requiem-poster.jpg' }, contactSheet: 'requiem-contact.jpg', alt: catalog.alt,
}, null, 2) + '\n');
console.log(`requiem: ${cuts.length} shots in ${(total / FPS).toFixed(2)} s -> ${path.relative(root, outDir)}/`);
