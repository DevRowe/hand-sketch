/**
 * Solar System Explorer: the hand-sketch solar scenes drawn live in the page, at the real positions of the planets on
 * any date, with the viewer driving time, pace, trails, style, view and camera.
 */
import './explorer.css';
import { App, BODY_NAMES, DEFAULT_OPACITY, DEFAULT_SPANS } from './app';
import type { ViewId } from './bodies';
import { wireControls } from './controls';
import { isoDate, today } from './format';
import { JourneyBar } from './journey';
import { Panel } from './panel';
import { wireMoments } from './moments';
import { Sim, WEEK } from './sim';
import { styleByKey, STYLES } from './styles';
import { readUrl, writeUrl } from './url';
import { wireWelcome } from './welcome';

const DEFAULT_STYLE = 'pastel';
/** The explorer opens in motion: the Sun carrying its planets through space. */
const DEFAULT_VIEW: ViewId = 'wake';
/** Two weeks a second: Mercury laps the Sun in about six seconds, the Moon circles Earth in two. */
const DEFAULT_PACE = 2 * WEEK;

const motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
let reduceMotion = motionQuery.matches;
const url = readUrl();
const canvas = document.getElementById('sky') as HTMLCanvasElement;

const view: ViewId = url.view ?? DEFAULT_VIEW;
const sim = new Sim(url.day ?? today(), url.pace ?? DEFAULT_PACE, { on: url.trails ?? true, span: DEFAULT_SPANS[view], opacity: DEFAULT_OPACITY });
if (url.reverse) sim.direction = -1;
if (reduceMotion) sim.playing = false;

const app = new App({
  canvas,
  labels: document.getElementById('labels')!,
  sim,
  view,
  style: styleByKey(url.style ?? DEFAULT_STYLE) ?? STYLES[0]!,
  skipIntro: reduceMotion || url.day !== undefined,
});
if (url.span) app.setSpan(url.span);
// reduced motion: trails switch and the camera moves at once, without easing
sim.instant = reduceMotion;
app.reducedMotion = reduceMotion;

/* ---------- toast ---------- */

const toastEl = document.getElementById('toast')!;
let toastTimer = 0;
function toast(text: string, ms = 4200): void {
  toastEl.textContent = text;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toastEl.classList.remove('show'), ms);
}

/* ---------- panel, journeys, welcome ---------- */

const compactQuery = matchMedia('(max-width: 980px), (max-height: 540px)');
// the panel starts journeys and the journey bar closes the panel: each calls into the other
let journeyBar: JourneyBar;
const welcome = wireWelcome({ openGuide: () => panel.openGuide() });
const panel = new Panel(app, {
  toast,
  startJourney: j => journeyBar.start(j),
  showWelcome: () => welcome.show(),
});
journeyBar = new JourneyBar(app, { makeRoom: () => panel.close() });

/* ---------- controls ---------- */

/**
 * Fit home (or a framed moment) to the room the controls leave, now and again once a new shape of screen has settled:
 * a turn of the phone moves controls between the top bar and the dock, and their sizes land a frame or two later.
 */
let settleTimer = 0;
function settle(): void {
  app.refit(0);
  requestAnimationFrame(() => requestAnimationFrame(() => app.refit(0)));
  clearTimeout(settleTimer);
  settleTimer = window.setTimeout(() => app.refit(0), 300);
}

function reset(): void {
  journeyBar.end();
  panel.clearPreset();
  panel.close();
  app.select(null);
  app.setDirection(1);
  app.setPace(DEFAULT_PACE);
  app.jump(today());
  app.resetView();
  app.play(!reduceMotion);
  if (!reduceMotion) app.redrawIntro();
}

const moments = wireMoments({ open: id => panel.openPreset(id), openAll: () => panel.openJump() });

const controls = wireControls(app, {
  openJump: () => panel.openJump(),
  openGuide: () => panel.openGuide(),
  openTravel: () => panel.openTravel(),
  endJourney: () => journeyBar.end(),
  openBody: id => panel.openBody(id),
  closePanel: () => panel.close(),
  reset,
  toast,
  relayout: () => settle(),
});

/* ---------- address bar ---------- */

let urlTimer = 0;
function syncUrl(): void {
  clearTimeout(urlTimer);
  urlTimer = window.setTimeout(() => {
    writeUrl({
      style: app.style.key === DEFAULT_STYLE ? undefined : app.style.key,
      view: app.view === DEFAULT_VIEW ? undefined : app.view,
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

/** Light papers get more solid controls, so hatching and grain never show through them. */
const LIGHT_PAPER = new Set(STYLES.filter(st => {
  const hex = st.swatch[0].replace('#', ''), n = parseInt(hex.length === 3 ? [...hex].map(c => c + c).join('') : hex, 16);
  return ((n >> 16) & 255) * 0.299 + ((n >> 8) & 255) * 0.587 + (n & 255) * 0.114 > 140;
}));

app.onChange = () => {
  controls.refresh();
  panel.refresh();
  journeyBar.refresh();
  moments.refresh(panel.preset);
  document.body.classList.toggle('light-paper', LIGHT_PAPER.has(app.style));
  syncUrl();
};
app.onDraw = () => {
  controls.onDraw();
  panel.tick();
  journeyBar.onDraw();
};

/* ---------- the room the controls leave ---------- */

/** Where the dock's top rests with its extras folded away: home is framed for that, not for a passing look at More. */
let restingDockTop: number | null = null;

app.freeRect = () => {
  const W = innerWidth, H = innerHeight, gap = 12, body = document.body.classList;
  const hidden = body.contains('hide-ui'), journey = body.contains('journey');
  let top = 0, bottom = H, left = 0, right = W;
  const box = (id: string): DOMRect | null => {
    const el = document.getElementById(id);
    if (!el || el.hidden || el.closest('[hidden]')) return null;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return null;
    return el.getBoundingClientRect();
  };
  // a journey trades the dock and the moments (and on a compact screen the top bar) for its own small bar
  if (!hidden) {
    const t = journey && compactQuery.matches ? null : box('top'), d = journey ? null : box('dock'), m = journey ? null : box('moments');
    if (t) top = t.bottom + gap;
    if (d) {
      const expanded = document.getElementById('dock')!.classList.contains('expanded');
      if (!expanded) restingDockTop = d.top;
      bottom = Math.min(bottom, (expanded && restingDockTop !== null ? restingDockTop : d.top) - gap);
    }
    // the key moments: a rail down the left, or a strip under the top bar (or inside it, on a short screen)
    if (m && m.width < W / 3) left = m.right + gap;
    else if (m) top = Math.max(top, m.bottom + gap);
  }
  const j = journey ? box('journey-bar') : null;
  if (j) bottom = Math.min(bottom, j.top - gap);
  const p = box('panel');
  if (p) {
    // a side panel on a wide or short screen, a sheet along the bottom on an upright phone
    if (p.width < W * 0.7) right = p.left - gap;
    else bottom = Math.min(bottom, p.top - gap);
  }
  return { x: left, y: top, w: Math.max(80, right - left), h: Math.max(80, bottom - top) };
};

/* ---------- size ---------- */


function measure(entry?: ResizeObserverEntry): void {
  if (document.getElementById('dock')!.classList.contains('expanded')) restingDockTop = null;
  const rect = canvas.getBoundingClientRect(), cssW = Math.max(1, Math.round(rect.width)), cssH = Math.max(1, Math.round(rect.height));
  const box = entry?.devicePixelContentBoxSize?.[0];
  const devW = box ? box.inlineSize : Math.round(cssW * devicePixelRatio), devH = box ? box.blockSize : Math.round(cssH * devicePixelRatio);
  app.resize({ cssW, cssH, devW: Math.max(1, devW), devH: Math.max(1, devH) });
  settle();
}
measure();
try {
  new ResizeObserver(entries => measure(entries[0])).observe(canvas, { box: 'device-pixel-content-box' });
} catch {
  new ResizeObserver(() => measure()).observe(canvas);
}

// rest on the home view for this screen, fitted into the room the controls leave (again once the fonts have set the
// controls' final size)
app.goHome();
void document.fonts?.ready.then(settle);

if (url.body && url.body in BODY_NAMES) {
  const id = url.body as keyof typeof BODY_NAMES;
  app.select(id);
  panel.openBody(id);
}
if (url.preset) panel.openPreset(url.preset);
if (reduceMotion) toast('Paused, as your device asks for reduced motion. Press play to set the planets moving.', 6500);
// the device's wish can change while the page is open: follow it
motionQuery.addEventListener('change', () => {
  reduceMotion = motionQuery.matches;
  sim.instant = reduceMotion;
  app.reducedMotion = reduceMotion;
  if (reduceMotion && app.sim.playing) {
    app.play(false);
    toast('Paused, as your device now asks for reduced motion. Press play to set the planets moving.', 6500);
  }
});

// the top bar's and the dock's heights, for what sits between them
for (const [id, name] of [['top', '--top-h'], ['dock', '--dock-h']] as const) {
  const el = document.getElementById(id)!;
  new ResizeObserver(() => document.documentElement.style.setProperty(name, `${Math.round(el.getBoundingClientRect().height)}px`)).observe(el);
}

app.start();
controls.refresh();
// a first visit gets a short welcome; a link straight to a moment or a body goes there without one
if (!url.preset && !url.body) welcome.showOnce();
moments.refresh(panel.preset);
document.body.classList.toggle('light-paper', LIGHT_PAPER.has(app.style));

declare global {
  interface Window {
    /** The running explorer, for tests and the curious. */
    __explorer?: { app: App; panel: Panel };
  }
}
window.__explorer = { app, panel };
