/**
 * Solar System Explorer: the hand-sketch solar scenes drawn live in the page, at the real positions of the planets on
 * any date, with the viewer driving time, pace, trails, style, view and camera.
 */
import './explorer.css';
import { App, BODY_NAMES } from './app';
import type { ViewId } from './bodies';
import { wireControls } from './controls';
import { isoDate, today } from './format';
import { Panel } from './panel';
import { MONTH, Sim } from './sim';
import { styleByKey, STYLES } from './styles';
import { readUrl, writeUrl } from './url';

const DEFAULT_STYLE = 'pastel';
const DEFAULT_PACE = MONTH;

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const url = readUrl();
const canvas = document.getElementById('sky') as HTMLCanvasElement;

const sim = new Sim(url.day ?? today(), url.pace ?? DEFAULT_PACE, { on: url.trails ?? true, span: 60, opacity: 1 });
if (url.reverse) sim.direction = -1;
if (reduceMotion) sim.playing = false;

const app = new App({
  canvas,
  labels: document.getElementById('labels')!,
  sim,
  view: (url.view ?? 'sky') satisfies ViewId,
  style: styleByKey(url.style ?? DEFAULT_STYLE) ?? STYLES[0]!,
  skipIntro: reduceMotion || url.day !== undefined,
});
if (url.span) app.setSpan(url.span);
if (reduceMotion) {
  // no easing either: trails appear whole
  sim.trails.alpha = sim.trails.on ? sim.trails.opacity : 0;
  sim.trails.reveal = 1;
}

/* ---------- toast ---------- */

const toastEl = document.getElementById('toast')!;
let toastTimer = 0;
function toast(text: string, ms = 4200): void {
  toastEl.textContent = text;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toastEl.classList.remove('show'), ms);
}

/* ---------- panel ---------- */

const panel = new Panel(app, { toast });

/* ---------- controls ---------- */

function reset(): void {
  panel.close();
  app.select(null);
  app.setDirection(1);
  app.setPace(DEFAULT_PACE);
  app.jump(today());
  app.resetView();
  app.play(!reduceMotion);
  if (!reduceMotion) app.redrawIntro();
}

const refresh = wireControls(app, {
  openJump: () => panel.openJump(),
  openGuide: () => panel.openGuide(),
  openBody: id => panel.openBody(id),
  closePanel: () => panel.close(),
  reset,
  toast,
});

/* ---------- address bar ---------- */

let urlTimer = 0;
function syncUrl(): void {
  clearTimeout(urlTimer);
  urlTimer = window.setTimeout(() => {
    writeUrl({
      style: app.style.key === DEFAULT_STYLE ? undefined : app.style.key,
      view: app.view === 'sky' ? undefined : app.view,
      // a moment is shared only when paused on it; a running sky starts from today for whoever opens the link
      date: app.sim.playing ? undefined : isoDate(app.sim.day),
      pace: Math.abs(app.sim.pace / DEFAULT_PACE - 1) < 1e-6 ? undefined : app.sim.pace,
      reverse: app.sim.direction === -1,
      trails: app.sim.trails.on ? undefined : false,
      body: app.selected ?? undefined,
      preset: panel.preset ?? undefined,
    });
  }, 350);
}

app.onChange = () => {
  refresh();
  panel.refresh();
  syncUrl();
};

/* ---------- size ---------- */

function measure(entry?: ResizeObserverEntry): void {
  const rect = canvas.getBoundingClientRect(), cssW = Math.max(1, Math.round(rect.width)), cssH = Math.max(1, Math.round(rect.height));
  const box = entry?.devicePixelContentBoxSize?.[0];
  const devW = box ? box.inlineSize : Math.round(cssW * devicePixelRatio), devH = box ? box.blockSize : Math.round(cssH * devicePixelRatio);
  app.resize({ cssW, cssH, devW: Math.max(1, devW), devH: Math.max(1, devH) });
}
measure();
try {
  new ResizeObserver(entries => measure(entries[0])).observe(canvas, { box: 'device-pixel-content-box' });
} catch {
  new ResizeObserver(() => measure()).observe(canvas);
}

if (url.body && url.body in BODY_NAMES) {
  const id = url.body as keyof typeof BODY_NAMES;
  app.select(id);
  panel.openBody(id);
}
if (url.preset) panel.openPreset(url.preset);
if (reduceMotion) toast('Paused, as your device asks for reduced motion. Press play to set the planets moving.', 6500);

app.start();
refresh();

declare global {
  interface Window {
    /** The running explorer, for tests and the curious. */
    __explorer?: { app: App; panel: Panel };
  }
}
window.__explorer = { app, panel };
