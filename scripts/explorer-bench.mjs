#!/usr/bin/env node
// The Solar System Explorer's frame-cost matrix: every style in every view, driven in a real Chrome, timed per drawing
// with the raster flushed (`getImageData` of one pixel), so the figure is what a frame costs, not what script costs.
//
// Serve the build first:  npx vite preview --outDir docs --port 5199
// Usage: node scripts/explorer-bench.mjs --profile desktop            1440x900, DPR 1, no throttle
//        node scripts/explorer-bench.mjs --profile phone              390x844, DPR 3 (real backing), 4x CPU throttle
//        ... --styles riso,sumi --views wake,sky --modes play,zoom    a slice (modes: play, notrails, zoom, jump)
//        ... --ms 2500 --warm 1200 --json out.json --url http://localhost:5199/explorer/
//        ... --cpuprofile riso:wake:play                              top self/inclusive functions for one case
// Env: CHROME=/path/to/chrome when Chrome is not on PATH.
import { writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import puppeteer from 'puppeteer-core';

const args = process.argv.slice(2);
const flag = name => { const i = args.indexOf(name); return i < 0 ? undefined : args[i + 1]; };
const profile = flag('--profile') ?? 'desktop';
const url = flag('--url') ?? 'http://localhost:5199/explorer/';
const ms = Number(flag('--ms') ?? 2000), warm = Number(flag('--warm') ?? 1200);
const list = (name, all) => flag(name)?.split(',') ?? all;
const views = list('--views', ['sky', 'wake', 'earth']);
const modes = list('--modes', ['play', 'notrails', 'zoom', 'jump']);
const cpuprofile = flag('--cpuprofile');

const PROFILES = {
  desktop: { width: 1440, height: 900, dpr: 1, throttle: 1 },
  phone: { width: 390, height: 844, dpr: 3, throttle: 4 },
};
const P = PROFILES[profile];
if (!P) throw new Error(`unknown profile ${profile}`);

function findChrome() {
  if (process.env.CHROME) return process.env.CHROME;
  for (const name of ['google-chrome', 'chromium', 'chromium-browser', 'chrome']) {
    try { return execFileSync('which', [name], { encoding: 'utf8' }).trim(); } catch { /* next */ }
  }
  throw new Error('no Chrome found: set CHROME=/path/to/chrome');
}

// an emulated DPR does not reach the canvas's backing: the scale factor has to be Chrome's own
const browser = await puppeteer.launch({
  executablePath: findChrome(), headless: true,
  args: ['--no-sandbox', `--force-device-scale-factor=${P.dpr}`, `--window-size=${P.width},${P.height}`],
  defaultViewport: { width: P.width, height: P.height, deviceScaleFactor: P.dpr, isMobile: profile === 'phone', hasTouch: profile === 'phone' },
});
const page = await browser.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
await page.evaluateOnNewDocument(() => localStorage.setItem('explorer.welcomed', '1'));
await page.goto(url, { waitUntil: 'networkidle0' });
const cdp = await page.createCDPSession();
if (P.throttle > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: P.throttle });

const styles = list('--styles', await page.evaluate(() => window.__explorer.styles.map(s => s.key)));

await page.evaluate(() => {
  const r = window.__explorer.app.renderer, orig = r.draw.bind(r);
  window.__bench = { draws: [], js: [] };
  r.draw = (...a) => {
    const t = performance.now();
    orig(...a);
    const t1 = performance.now();
    r.ctx.getImageData(0, 0, 1, 1);
    window.__bench.js.push(t1 - t);
    window.__bench.draws.push(performance.now() - t);
  };
});

const measure = (style, view, mode) => page.evaluate(async (style, view, mode, ms, warm) => {
  const X = window.__explorer, a = X.app, r = a.renderer;
  const wait = t => new Promise(res => setTimeout(res, t));
  a.setView(view);
  a.setStyle(X.styles.find(s => s.key === style));
  a.goHome();
  // the steady cost, not the draw-on's: the scene is whole from the first drawing
  a.intro = 1e9;
  a.setTrails(mode !== 'notrails');
  a.play(true);
  await wait(warm);
  const B = window.__bench;
  B.draws = [];
  B.js = [];
  const gaps = [];
  let last = performance.now(), n = 0;
  const end = last + ms, day0 = a.sim.day;
  await new Promise(res => {
    const f = t => {
      gaps.push(t - last);
      last = t;
      n++;
      if (mode === 'zoom') a.zoomBy(n % 120 < 60 ? 1.012 : 1 / 1.012);
      if (mode === 'jump' && n % 90 === 45) a.jump(day0 + 431 * (n / 90));
      if (t < end) requestAnimationFrame(f); else res();
    };
    requestAnimationFrame(f);
  });
  const q = (arr, p) => { const d = arr.slice().sort((x, y) => x - y); return d.length ? +d[Math.min(d.length - 1, Math.floor(p * d.length))].toFixed(1) : null; };
  if (mode === 'zoom') a.goHome();
  return {
    style, view, mode, draws: +(B.draws.length / (ms / 1000)).toFixed(1), js50: q(B.js, 0.5), p50: q(B.draws, 0.5), p90: q(B.draws, 0.9),
    max: q(B.draws, 1), long: gaps.filter(g => g > 50).length, raf: +(gaps.length / (ms / 1000)).toFixed(0), q: r.quality, px: `${r.canvas.width}x${r.canvas.height}`,
  };
}, style, view, mode, ms, warm);

async function profileCase(spec) {
  const [style, view, mode] = spec.split(':');
  await measure(style, view, mode);
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.setSamplingInterval', { interval: 200 });
  await cdp.send('Profiler.start');
  const row = await measure(style, view, mode);
  const { profile: prof } = await cdp.send('Profiler.stop');
  const nodes = new Map(prof.nodes.map(n => [n.id, n])), self = new Map(), parent = new Map();
  let total = 0;
  prof.samples.forEach((id, i) => { const d = prof.timeDeltas[i]; total += d; self.set(id, (self.get(id) ?? 0) + d); });
  for (const nd of prof.nodes) for (const c of nd.children ?? []) parent.set(c, nd.id);
  const key = nd => `${nd.callFrame.functionName || '(anon)'} ${nd.callFrame.url.replace(/.*\//, '')}:${nd.callFrame.lineNumber + 1}:${nd.callFrame.columnNumber}`;
  const selfBy = new Map(), inclBy = new Map();
  for (const [id, t] of self) {
    selfBy.set(key(nodes.get(id)), (selfBy.get(key(nodes.get(id))) ?? 0) + t);
    const seen = new Set();
    for (let cur = id; cur !== undefined; cur = parent.get(cur)) {
      const k = key(nodes.get(cur));
      if (!seen.has(k)) { seen.add(k); inclBy.set(k, (inclBy.get(k) ?? 0) + t); }
    }
  }
  const fmt = m => [...m].sort((x, y) => y[1] - x[1]).filter(([k]) => !/^\((root|program|idle)\)/.test(k)).slice(0, 25)
    .map(([k, t]) => `${(t / 1000).toFixed(0).padStart(6)}ms ${((100 * t) / total).toFixed(1).padStart(5)}%  ${k}`).join('\n');
  console.log(JSON.stringify(row));
  console.log(`--- self (of ${(total / 1000).toFixed(0)} ms sampled)\n${fmt(selfBy)}\n--- inclusive\n${fmt(inclBy)}`);
}

const rows = [];
if (cpuprofile) await profileCase(cpuprofile);
else {
  console.log(`${profile}: ${P.width}x${P.height} DPR ${P.dpr}, ${P.throttle}x CPU; per drawing, raster included (ms)`);
  console.log('style        view  mode      draws/s  js50   p50    p90    max   long  q     backing');
  for (const view of views) for (const style of styles) for (const mode of modes) {
    const r = await measure(style, view, mode);
    rows.push(r);
    console.log(`${r.style.padEnd(12)} ${r.view.padEnd(5)} ${r.mode.padEnd(9)} ${String(r.draws).padStart(6)} ${String(r.js50).padStart(6)} ${String(r.p50).padStart(6)} ${String(r.p90).padStart(6)} ${String(r.max).padStart(6)} ${String(r.long).padStart(5)}  ${String(r.q).padEnd(5)} ${r.px}`);
  }
}
if (flag('--json')) writeFileSync(flag('--json'), JSON.stringify({ profile, P, rows }, null, 1));
if (errors.length) { console.error(`page errors:\n${errors.slice(0, 10).join('\n')}`); process.exitCode = 1; }
await browser.close();
