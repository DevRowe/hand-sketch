// Frame-exact capture of the live explorer for the promo: each shot is a fresh page load under the virtual clock
// (`clock.js`), stepped one output frame at a time and screenshotted, so the footage is smooth and the same on every run.
import { mkdirSync, readFileSync, rmSync, existsSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const here = dirname(fileURLToPath(import.meta.url));
export const FPS = 30;

export function findChrome() {
  if (process.env.CHROME) return process.env.CHROME;
  for (const name of ['google-chrome', 'chromium', 'chromium-browser', 'chrome']) {
    try { return execFileSync('which', [name], { encoding: 'utf8' }).trim(); } catch { /* next */ }
  }
  throw new Error('no Chrome found: set CHROME=/path/to/chrome');
}

/**
 * A Chrome whose pages are `size` CSS pixels drawn at `scale` device pixels each: the interface shots are taken on a
 * smaller page at a larger scale, so the app's own controls read at video size. The scale has to be Chrome's own
 * (an emulated one does not reach the canvas's backing).
 */
export async function launch(size, scale = 1) {
  return puppeteer.launch({
    executablePath: findChrome(), headless: true,
    args: ['--no-sandbox', '--hide-scrollbars', `--force-device-scale-factor=${scale}`, `--window-size=${size.width},${size.height}`],
    defaultViewport: { ...size, deviceScaleFactor: scale },
  });
}

/** Fail on anything the page complains of: a promo frame with an error behind it is not one to ship. */
export function guard(page, label) {
  page.on('pageerror', e => { throw new Error(`${label}: page error: ${e}`); });
  page.on('console', m => { if (m.type() === 'error') throw new Error(`${label}: console error: ${m.text()}`); });
  page.on('requestfailed', r => { throw new Error(`${label}: request failed: ${r.url()}`); });
}

// the passing hint a view opens with, the little "show the controls" button that stays faintly visible while the interface is hidden, the focus rings a
// scripted click leaves behind, and the text caret
const CAPTURE_CSS = `
  .toast { display: none !important; }
  body.hide-ui .chrome { transition: none !important; }
  body.hide-ui .show-ui { display: none !important; }
  *:focus, *:focus-visible { outline: none !important; }
  * { caret-color: transparent !important; }
`;

const CAM = 'function (X, c) { X.app.lookAt(c.at, c.zoom, 0); }';
const mix = (a, b, t) => a + (b - a) * t;
function camAt(cam, f) {
  const t = (f + (cam.offset ?? 0)) / cam.span, to = cam.atTo ?? cam.at;
  return { at: [mix(cam.at[0], to[0], t), mix(cam.at[1], to[1], t)], zoom: cam.from * (cam.to / cam.from) ** t };
}

/**
 * Capture one shot into `dir` as numbered JPEGs. A shot: `hash` (the explorer's URL state), `frames`, optional `clean`
 * (interface hidden), `intro` (keep the draw-on), `warm` (seconds run before the first frame), `speed` (clock seconds
 * per output second, a number or a function of the frame), `setup(X)` and `at: { frame: fn(X) }` run in the page with
 * `X = window.__explorer`, and `click: { frame: fn(X) -> [x, y] }` real mouse clicks (recorded in `meta.json` for the overlay's tap ring).
 */
export async function captureShot(browser, base, shot, dir, size, scale = 1) {
  if (existsSync(dir)) rmSync(dir, { recursive: true });
  mkdirSync(dir, { recursive: true });
  const page = await browser.newPage();
  guard(page, shot.id);
  await page.evaluateOnNewDocument(readFileSync(join(here, 'clock.js'), 'utf8'));
  await page.evaluateOnNewDocument((store) => {
    localStorage.setItem('explorer.welcomed', '1');
    for (const [k, v] of Object.entries(store)) localStorage.setItem(k, v);
  }, shot.store ?? {});
  await page.goto(`${base}${shot.hash ?? ''}`, { waitUntil: 'networkidle0' });
  await page.addStyleTag({ content: CAPTURE_CSS });
  await page.evaluate(() => document.fonts.ready);
  const run = (fn, arg) => page.evaluate(`(${fn})(window.__explorer, ${JSON.stringify(arg ?? null)})`);
  const step = ms => page.evaluate(ms => window.__clock.step(ms), ms);

  if (shot.hide) await page.addStyleTag({ content: `${shot.hide.join(', ')} { display: none !important; }` });
  if (shot.clean) await page.evaluate(() => document.body.classList.add('hide-ui'));
  if (!shot.intro) await page.evaluate(() => { window.__explorer.app.intro = 1e9; });
  if (shot.setup) await run(shot.setup);
  // let the interface's fade and the first glide finish, and the sky run in
  for (let t = 0; t < (shot.warm ?? 1) * FPS; t++) await step(1000 / FPS);
  if (shot.ready) await run(shot.ready);
  if (shot.cam) { await run(CAM, camAt(shot.cam, 0)); await step(0); }

  const clicks = [];
  for (let f = 0; f < shot.frames; f++) {
    if (shot.at?.[f]) await run(shot.at[f]);
    if (shot.click?.[f]) {
      const [x, y] = await run(shot.click[f]);
      clicks.push({ frame: f, x, y });
      await page.mouse.move(x, y);
      await page.mouse.click(x, y);
    }
    if (shot.each) await run(shot.each, f);
    if (shot.cam) await run(CAM, camAt(shot.cam, f));
    const speed = typeof shot.speed === 'function' ? shot.speed(f) : shot.speed ?? 1;
    // a drawing never spans more than the app's own longest step (0.25 s): faster passages take several steps
    let ms = (1000 / FPS) * speed;
    while (ms > 1e-6) { const d = Math.min(ms, 200); await step(d); ms -= d; }
    await page.screenshot({ path: join(dir, `${String(f).padStart(4, '0')}.jpg`), type: 'jpeg', quality: 96 });
  }
  writeFileSync(join(dir, 'meta.json'), JSON.stringify({ id: shot.id, frames: shot.frames, scale, clicks }));
  await page.close();
}

/** The overlay page drawn frame by frame on a transparent ground: `window.renderFrame(f)` is a pure function of `f`. */
export async function captureOverlay(browser, file, sheet, dir) {
  if (existsSync(dir)) rmSync(dir, { recursive: true });
  mkdirSync(dir, { recursive: true });
  const page = await browser.newPage();
  guard(page, 'overlay');
  await page.goto(`file://${file}`, { waitUntil: 'networkidle0' });
  await page.evaluate(sheet => window.setup(sheet), sheet);
  await page.evaluate(() => document.fonts.ready);
  for (let f = 0; f < sheet.total; f++) {
    await page.evaluate(f => window.renderFrame(f), f);
    await page.screenshot({ path: join(dir, `${String(f).padStart(4, '0')}.png`), omitBackground: true });
  }
  await page.close();
}
