#!/usr/bin/env node
// Offline renderer: headless Chrome draws every frame from the built preview's own canvas
// (toDataURL, no screenshots, so CSS and device pixel ratio never matter), then ffmpeg packs an mp4
// holding each drawn frame for outputFps / fps output frames, plus a contact sheet.
// Modelled on scripts/render.mjs of alesha-pro/tools hand-drawn-canvas-animation (MIT), see NOTICE.
//
// Usage (after `npm run build`, or via `npm run render -- <flags>`):
//   node scripts/render.mjs                          whole demo sequence -> out/<name>.mp4 + contact sheet
//   node scripts/render.mjs --program scene:house    one scene; also loop:<name> (intro + one loop period)
//   node scripts/render.mjs --grid 24                24 evenly spaced frames tiled into one image, no mp4
//   node scripts/render.mjs --only 0,40,90           just these frames as PNGs
//   node scripts/render.mjs --ar 9:16 --width 1080   format and output width (default 16:9 at 1920)
//   node scripts/render.mjs --strokes legacy         the reviewed skill's stroke look, for comparison
//   node scripts/render.mjs --ones                   draw every frame (24 fps) instead of on twos
//   node scripts/render.mjs --verify                 render the selected frames twice and fail if any pixel differs
//   node scripts/render.mjs --out renders            output directory (default out/)
// Env: CHROME=/path/to/chrome when Chrome/Chromium is not on PATH. Needs ffmpeg on PATH for mp4 and sheets.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const argv = process.argv.slice(2);
const flag = name => { const k = argv.indexOf(name); return k >= 0 ? argv[k + 1] : undefined; };
const has = name => argv.includes(name);

const program = flag('--program') ?? 'sequence';
const ar = flag('--ar') ?? '16:9';
const width = Number(flag('--width') ?? 1920);
const strokes = flag('--strokes') === 'legacy' ? 'legacy' : 'engine';
const twos = !has('--ones');
const grid = flag('--grid') ? Number(flag('--grid')) : 0;
const only = flag('--only')?.split(',').map(Number).filter(Number.isInteger);
const verify = has('--verify');
const outRoot = path.resolve(root, flag('--out') ?? 'out');
const name = [program.replace(':', '-'), strokes === 'legacy' ? 'legacy' : null, ar.replace(':', 'x'), twos ? null : 'ones'].filter(Boolean).join('-');

const fail = msg => { console.error(`render: ${msg}`); process.exit(1); };
if (!existsSync(path.join(dist, 'index.html'))) fail('dist/index.html missing: run `npm run build` first (or use `npm run render`)');
if (!/^\d+(\.\d+)?[:x/]\d+(\.\d+)?$/.test(ar)) fail(`bad --ar ${ar}: expected W:H, e.g. 16:9, 4:3, 1:1`);
if (!Number.isFinite(width) || width < 16) fail(`bad --width ${flag('--width')}`);

function findChrome() {
  if (process.env.CHROME) return process.env.CHROME;
  const candidates = ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'];
  for (const bin of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'chrome']) {
    try { candidates.push(execFileSync('which', [bin], { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()); } catch { /* not on PATH */ }
  }
  const hit = candidates.find(c => c && existsSync(c));
  if (!hit) fail('no Chrome found: set CHROME=/path/to/chrome');
  return hit;
}

function hasFfmpeg() {
  try { execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' }); return true; } catch { return false; }
}
const needFfmpeg = !only;
if (needFfmpeg && !hasFfmpeg()) fail('ffmpeg not found on PATH');

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json' };
const server = createServer((req, res) => {
  const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '') || 'index.html';
  const file = path.join(dist, rel);
  if (!file.startsWith(dist) || !existsSync(file)) { res.writeHead(404).end(); return; }
  res.writeHead(200, { 'content-type': MIME[path.extname(file)] ?? 'application/octet-stream' }).end(readFileSync(file));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
const query = new URLSearchParams({ bare: '1', frame: '0', program, ar, w: String(width), strokes, twos: twos ? '1' : '0' });
const url = `http://127.0.0.1:${port}/index.html?${query}`;

const browser = await puppeteer.launch({ executablePath: findChrome(), headless: true, args: ['--no-sandbox'] });
const errors = [];

async function openPage() {
  const page = await browser.newPage();
  let reject;
  const broken = new Promise((_, r) => { reject = r; });
  broken.catch(() => {}); // an error during page load must surface through the race below, not crash the process
  const report = msg => { errors.push(msg); reject(new Error(msg)); };
  page.on('pageerror', e => report(`page error: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error') report(`console error: ${m.text()}`); });
  page.on('requestfailed', r => report(`request failed: ${r.url()} ${r.failure()?.errorText ?? ''}`));
  page.on('response', r => { if (r.status() >= 400) report(`HTTP ${r.status()}: ${r.url()}`); });
  await page.goto(url, { waitUntil: 'load' });
  // fail fast on a broken page instead of waiting out the timeout
  await Promise.race([page.waitForFunction('window.__handSketch && window.__handSketch.ready === true', { timeout: 30000 }), broken]);
  return page;
}

const save = (file, dataUrl) => writeFileSync(file, Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64'));
const pad = i => String(i).padStart(5, '0');
const frameDir = path.join(outRoot, `${name}-frames`);
let code = 0;

try {
  const page = await openPage();
  const meta = await page.evaluate(() => ({ frames: window.__handSketch.frames, fps: window.__handSketch.fps, outputFps: window.__handSketch.outputFps, size: window.__handSketch.size }));
  const { frames: N, fps, outputFps, size } = meta;
  // guard: the page must render the shape that was asked for (a silently square 4:3 render once slipped through)
  const [ra, rb] = ar.split(/[:x/]/).map(Number);
  if (!(ra > 0 && rb > 0) || Math.abs(size.w / size.h - ra / rb) > 0.01) throw new Error(`asked for --ar ${ar} but the page renders ${size.w}x${size.h}`);
  console.log(`${name}: ${N} drawn frames (${(N / fps).toFixed(2)} s, ${fps} fps drawn -> ${outputFps} fps out), logical ${size.w}x${size.h}, output ${size.outW}x${size.outH}`);

  const evenly = n => [...new Set(Array.from({ length: n }, (_, k) => Math.round((k * (N - 1)) / Math.max(1, n - 1))))];
  const list = grid ? evenly(grid) : only ? only.filter(i => i >= 0 && i < N) : [...Array(N).keys()];

  // a full render replaces the frame folder so no stale frames leak into the mp4; spot checks add to it
  if (!grid && !only) rmSync(frameDir, { recursive: true, force: true });
  mkdirSync(frameDir, { recursive: true });
  const t0 = performance.now();
  for (const [k, i] of list.entries()) {
    save(path.join(frameDir, `${pad(i)}.png`), await page.evaluate(i => window.__handSketch.frame(i), i));
    if (process.stdout.isTTY) process.stdout.write(`\rframe ${k + 1}/${list.length}`);
  }
  const secs = (performance.now() - t0) / 1000;
  console.log(`${process.stdout.isTTY ? '\n' : ''}rendered ${list.length} frames in ${secs.toFixed(1)} s (${((secs * 1000) / list.length).toFixed(0)} ms/frame) -> ${frameDir}`);

  if (verify) {
    const again = await openPage();
    let diffs = 0;
    for (const i of list) {
      const a = readFileSync(path.join(frameDir, `${pad(i)}.png`));
      const b = await again.evaluate(i => window.__handSketch.frame(i), i);
      if (!a.equals(Buffer.from(b.slice(b.indexOf(',') + 1), 'base64'))) { diffs++; console.error(`verify: frame ${i} differs between two page loads`); }
    }
    if (diffs) { errors.push(`${diffs} of ${list.length} frames are not deterministic`); }
    else console.log(`verify: ${list.length} frames byte-identical across two independent page loads`);
  }

  if (errors.length === 0 && needFfmpeg) {
    const ff = args => execFileSync('ffmpeg', ['-v', 'error', '-y', ...args], { stdio: 'inherit' });
    const tile = (frames, file) => {
      const cols = 6, rows = Math.ceil(frames.length / cols);
      const listFile = path.join(frameDir, 'tiles.txt');
      writeFileSync(listFile, frames.map(i => `file '${path.join(frameDir, `${pad(i)}.png`)}'`).join('\n'));
      ff(['-f', 'concat', '-safe', '0', '-i', listFile, '-vf', `scale=320:-2,tile=${cols}x${rows}:padding=4:color=0x16151a`, '-frames:v', '1', file]);
      rmSync(listFile);
    };
    if (grid) {
      const sheet = path.join(outRoot, `${name}-grid.jpg`);
      tile(list, sheet);
      console.log(`grid: ${sheet}`);
    } else {
      const mp4 = path.join(outRoot, `${name}.mp4`);
      ff(['-framerate', String(fps), '-start_number', '0', '-i', path.join(frameDir, '%05d.png'), '-r', String(outputFps), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-movflags', '+faststart', mp4]);
      // contact sheet: two tiles per second, rounded to whole rows of six so there are no blank tiles
      const tiles = Math.max(6, 6 * Math.round((N / fps) * 2 / 6));
      const sheet = path.join(outRoot, `${name}-contact.jpg`);
      tile(evenly(tiles), sheet);
      console.log(`mp4: ${mp4}\ncontact sheet: ${sheet}`);
    }
  }
} catch (e) {
  if (!errors.length) errors.push(String(e?.message ?? e));
} finally {
  await browser.close();
  server.close();
}

if (errors.length) {
  console.error(`render failed:\n  ${[...new Set(errors)].join('\n  ')}`);
  code = 1;
}
process.exit(code);
