#!/usr/bin/env node
// The Solar System Explorer's promo video, start to finish: capture the live app shot by shot under a virtual clock,
// draw the captions and end card as a transparent overlay, synthesise the music, and cut it all together with ffmpeg.
//
// Usage: node scripts/promo.mjs                       everything, then publish to docs/promo/
//        node scripts/promo.mjs --stage capture       one stage: capture | overlay | music | cut | publish
//        node scripts/promo.mjs --only hook,card      capture just these shots (then run the later stages)
//        node scripts/promo.mjs --sheets              contact sheets of the captured shots, for review
// The app is served from the committed build (docs/explorer/), so rebuild it first (`npm run explorer`) after changes.
// Env: CHROME=/path/to/chrome when Chrome is not on PATH. Needs ffmpeg on PATH.
import { spawn, execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { captureShot, captureOverlay, launch } from './promo/capture.mjs';
import { EDIT, FLASH, FPS, PALE, SHOTS, TOTAL } from './promo/shots.mjs';
import { writeMusic } from './promo/music.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const flag = name => { const i = args.indexOf(name); return i < 0 ? undefined : args[i + 1]; };
const stage = flag('--stage'), only = flag('--only')?.split(','), sheets = args.includes('--sheets');
const does = s => !stage || stage === s;

const OUT = join(root, 'output/promo'), PORT = 5237;
const SIZE = { width: 1920, height: 1080 };
// interface shots: a 1440x810 page at 4/3 scale, so the controls read at video size
const UI_SCALE = 4 / 3;
const NAME = 'solar-explorer-promo';
const ffmpeg = a => execFileSync('ffmpeg', ['-v', 'error', '-y', ...a], { stdio: ['ignore', 'inherit', 'inherit'] });

async function serve() {
  const server = spawn('npx', ['vite', 'preview', '--outDir', 'docs', '--port', String(PORT), '--strictPort'], { cwd: root, stdio: 'ignore', detached: true });
  for (let i = 0; i < 50; i++) {
    try { if ((await fetch(`http://localhost:${PORT}/explorer/`)).ok) return server; } catch { /* not up yet */ }
    await new Promise(r => setTimeout(r, 200));
  }
  throw new Error('the preview server did not start');
}

function sheet(id, frames) {
  const every = Math.max(1, Math.floor(frames / 12));
  ffmpeg(['-i', join(OUT, 'shots', id, '%04d.jpg'), '-vf', `select='not(mod(n\\,${every}))',scale=960:-1,tile=4x3`, '-frames:v', '1', join(OUT, 'sheets', `${id}.jpg`)]);
}

async function capture() {
  const all = [...SHOTS, ...FLASH].filter(s => !only || only.some(o => s.id.startsWith(o)));
  const base = `http://localhost:${PORT}/explorer/`;
  for (const ui of [false, true]) {
    const shots = all.filter(s => Boolean(s.ui) === ui);
    if (!shots.length) continue;
    const scale = ui ? UI_SCALE : 1, size = { width: Math.round(SIZE.width / scale), height: Math.round(SIZE.height / scale) };
    const browser = await launch(size, scale);
    try {
      for (const s of shots) {
        const t = Date.now();
        await captureShot(browser, base, s, join(OUT, 'shots', s.id), size, scale);
        console.log(`captured ${s.id}: ${s.frames} frames in ${((Date.now() - t) / 1000).toFixed(1)} s`);
      }
    } finally { await browser.close(); }
  }
}

/** The edit as one numbered run of frames (links into the shots), and the overlay's cue sheet. */
function conform() {
  const dir = join(OUT, 'edit');
  if (existsSync(dir)) rmSync(dir, { recursive: true });
  mkdirSync(dir, { recursive: true });
  let n = 0;
  const cues = [], byId = new Map([...SHOTS, ...FLASH].map(s => [s.id, s]));
  for (const e of EDIT) {
    const meta = JSON.parse(readFileSync(join(OUT, 'shots', e.shot, 'meta.json'), 'utf8'));
    const shot = byId.get(e.shot), ui = Boolean(shot.ui), pale = PALE.has(/style=([a-z-]+)/.exec(shot.hash)[1]);
    cues.push({ kind: 'shot', at: n, frames: e.frames, ui, pale, end: Boolean(e.end) });
    for (const c of e.captions ?? []) cues.push({ kind: 'caption', at: n + c.at, frames: c.frames ?? e.frames - c.at, exit: c.frames !== undefined, text: c.text, sub: c.sub ?? '', ui, pale, low: Boolean(shot.journey) });
    if (e.flash) cues.push({ kind: 'flash', at: n, frames: e.frames, text: ['Ten hand-drawn styles', e.flash.name], ui, pale });
    if (e.tap) for (const c of meta.clicks) cues.push({ kind: 'tap', at: n + c.frame - e.from, x: c.x * meta.scale, y: c.y * meta.scale });
    if (e.end) cues.push({ kind: 'end', at: n, frames: e.frames });
    for (let f = 0; f < e.frames; f++, n++) {
      const src = join(OUT, 'shots', e.shot, `${String(e.from + f).padStart(4, '0')}.jpg`);
      if (!existsSync(src)) throw new Error(`${e.shot} has no frame ${e.from + f}`);
      symlinkSync(src, join(dir, `${String(n).padStart(4, '0')}.jpg`));
    }
  }
  writeFileSync(join(OUT, 'cues.json'), JSON.stringify({ total: n, fps: FPS, cues }, null, 1));
  return { total: n, cues };
}

async function overlay() {
  const { total, cues } = conform();
  const browser = await launch(SIZE, 1);
  try { await captureOverlay(browser, join(root, 'scripts/promo/overlay.html'), { total, fps: FPS, cues }, join(OUT, 'overlay')); } finally { await browser.close(); }
  console.log(`overlay: ${total} frames`);
}

function cut() {
  const mp4 = join(OUT, `${NAME}.mp4`);
  ffmpeg([
    '-framerate', String(FPS), '-i', join(OUT, 'edit/%04d.jpg'), '-framerate', String(FPS), '-i', join(OUT, 'overlay/%04d.png'), '-i', join(OUT, 'music.wav'),
    '-filter_complex', '[0:v][1:v]overlay=format=auto,format=yuv420p[v]', '-map', '[v]', '-map', '2:a',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '21', '-profile:v', 'high', '-g', String(FPS * 2), '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709',
    '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', mp4,
  ]);
  ffmpeg(['-i', mp4, '-vf', `select='not(mod(n\\,42))',scale=480:-1,tile=6x4`, '-frames:v', '1', join(OUT, `${NAME}-sheet.jpg`)]);
  console.log(`cut: ${mp4} (${(statSync(mp4).size / 1e6).toFixed(1)} MB, ${(TOTAL / FPS).toFixed(1)} s)`);
}

function publish() {
  const dir = join(root, 'docs/promo');
  mkdirSync(dir, { recursive: true });
  copyFileSync(join(OUT, `${NAME}.mp4`), join(dir, `${NAME}.mp4`));
  // the poster: the end card, as the player shows it before play
  ffmpeg(['-sseof', '-1.5', '-i', join(OUT, `${NAME}.mp4`), '-frames:v', '1', '-q:v', '3', join(dir, `${NAME}-poster.jpg`)]);
  console.log(`published to ${dir}`);
}

mkdirSync(join(OUT, 'sheets'), { recursive: true });
let server = null;
try {
  if (does('capture')) { server = await serve(); await capture(); }
  if (sheets) for (const s of [...SHOTS, ...FLASH]) if (existsSync(join(OUT, 'shots', s.id))) sheet(s.id, s.frames);
  if (does('overlay')) await overlay();
  if (does('music')) {
    const { cues } = JSON.parse(readFileSync(join(OUT, 'cues.json'), 'utf8'));
    writeMusic(join(OUT, 'music.wav'), TOTAL / FPS, cues.filter(c => c.kind === 'tap').map(c => c.at / FPS));
  }
  if (does('cut')) cut();
  if (does('publish')) publish();
} finally {
  if (server) try { process.kill(-server.pid); } catch { /* already gone */ }
}
