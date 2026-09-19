/**
 * Solar System Explorer: the hand-sketch solar scenes drawn live in the page, at the real positions of the planets on
 * any date, with the viewer driving time, pace, trails, style, view and camera.
 */
import './explorer.css';
import { App, BODY_NAMES, DEFAULT_OPACITY } from './app';
import type { ViewId } from './bodies';
import { CLIP_S, recordClip } from './clip';
import { BODIES } from './content/bodies';
import { wireControls } from './controls';
import { dateLabel, isoDate, today } from './format';
import { JourneyBar } from './journey';
import { lifeOf } from './life';
import { Panel } from './panel';
import { wireMoments } from './moments';
import { savePicture, shareMoment, type Moment } from './share';
import { Sim } from './sim';
import { styleByKey, STYLES } from './styles';
import { Sonification } from './sound';
import { Tour } from './tour';
import { localize, setLocale, t } from './i18n';
import { hashOf, readUrl, writeUrl } from './url';
import { VIEWS } from './views';
import { wireWelcome } from './welcome';

const DEFAULT_STYLE = 'pastel';
/**
 * The explorer opens in motion: the Sun carrying its planets through space, at two weeks a second (Mercury laps the
 * Sun in about six seconds, the Moon circles Earth in two).
 */
const DEFAULT_VIEW: ViewId = 'wake';

// the page's words, from the table for its language
setLocale(document.documentElement.lang || 'en');
localize();

const motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
let reduceMotion = motionQuery.matches;
const url = readUrl();
const canvas = document.getElementById('sky') as HTMLCanvasElement;

const view: ViewId = url.view ?? DEFAULT_VIEW;
const sim = new Sim(url.day ?? today(), url.pace ?? VIEWS[view].pace.start, { on: url.trails ?? true, span: VIEWS[view].span.start, opacity: url.opacity ?? DEFAULT_OPACITY });
if (url.reverse) sim.direction = -1;
// a link to a date shares that moment: it opens paused there, not running away from it
if (reduceMotion || url.day !== undefined) sim.playing = false;

const app = new App({
  canvas,
  labels: document.getElementById('labels')!,
  sim,
  view,
  style: styleByKey(url.style ?? DEFAULT_STYLE) ?? STYLES[0]!,
  skipIntro: reduceMotion || url.day !== undefined,
});
if (url.span) app.setSpan(url.span);
if (url.tonight) app.layers.tonight = true;
if (url.seasons) app.layers.seasons = true;
if (url.comets === false) app.layers.comets = false;
if (url.dwarfs === false) app.layers.dwarfs = false;
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

/** A quiet word for screen readers (what stepping through the bodies has picked out). */
const announceEl = document.getElementById('announce')!;
function announce(text: string): void {
  announceEl.textContent = '';
  requestAnimationFrame(() => (announceEl.textContent = text));
}

/* ---------- panel, journeys, the tour, welcome ---------- */

const compactQuery = matchMedia('(max-width: 980px), (max-height: 540px)');
// the panel starts journeys and the tour, and they close the panel: each calls into the others
let journeyBar: JourneyBar;
let tour: Tour;
const welcome = wireWelcome({ openGuide: () => panel.openGuide(), startTour: () => tour.start() });
const panel = new Panel(app, {
  toast,
  startJourney: (j, play) => {
    tour.end();
    journeyBar.start(j, play);
  },
  endJourney: () => tour.end() || journeyBar.end(),
  showWelcome: () => welcome.show(),
  share: () => void share(),
  savePicture: () => void picture(),
  recordClip: () => void clip(),
  startTour: () => tour.start(),
});
journeyBar = new JourneyBar(app, { makeRoom: () => panel.close() });
tour = new Tour(app, {
  setMoment: id => panel.setMoment(id),
  clearMoment: () => panel.clearPreset(),
  makeRoom: () => {
    journeyBar.end();
    panel.close();
  },
  toast,
});

/* ---------- sound ---------- */

/** The orbits as sound: off at every visit until switched on (Look, or M). */
const sound = new Sonification();
const soundBtn = document.getElementById('sound-btn') as HTMLButtonElement;
if (!sound.available) {
  soundBtn.disabled = true;
  document.getElementById('sound-note')!.textContent = t('sound.none');
}
async function toggleSound(): Promise<void> {
  if (!sound.available) {
    toast(t('sound.none'));
    return;
  }
  const on = await sound.set(!sound.on);
  app.soundLine = on;
  app.invalidate();
  soundBtn.setAttribute('aria-pressed', String(on));
  // at a slow pace the planets pass their line only now and then: say so, or silence reads as broken
  toast(on ? (app.spec.family === 'solar' && app.sim.pace >= 30 ? t('sound.on') : t('sound.slow')) : t('sound.off'));
}
soundBtn.addEventListener('click', () => void toggleSound());

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
  tour.end();
  journeyBar.end();
  panel.clearPreset();
  panel.close();
  app.select(null);
  app.setDirection(1);
  app.setPace(app.spec.pace.start);
  app.jump(today());
  app.resetView();
  app.play(!reduceMotion);
  if (!reduceMotion) app.redrawIntro();
}

const moments = wireMoments({ open: id => panel.openPreset(id), openAll: () => panel.openJump(), tour: () => tour.start() });

const controls = wireControls(app, {
  toggleMenu: id => panel.toggleMenu(id),
  openMenu: id => panel.openMenu(id),
  endJourney: () => tour.end() || journeyBar.end(),
  openBody: id => panel.openBody(id),
  closePanel: () => panel.close(),
  reset,
  toast,
  relayout: () => settle(),
  togglePlay: () => (tour.on ? tour.togglePause() : app.play(!app.sim.playing)),
  toggleSound: () => void toggleSound(),
  stepBody: dir => {
    const id = app.stepSelection(dir);
    if (!id) {
      announce(t('announce.none'));
      return;
    }
    panel.openBody(id);
    app.reveal();
    announce(t('announce.body', { name: BODY_NAMES[id], facts: BODIES[id].kind }));
  },
});

/* ---------- address bar ---------- */

/**
 * The state worth keeping in a link, defaults left out. The address bar keeps a date only while paused (a running sky
 * starts from today for whoever opens it); a shared moment always keeps it, and so opens paused there.
 */
function stateOf(sharing: boolean): Record<string, string | number | boolean | undefined> {
  const look = app.looking, life = app.life;
  return {
    style: app.style.key === DEFAULT_STYLE ? undefined : app.style.key,
    view: app.view === DEFAULT_VIEW ? undefined : app.view,
    date: app.sim.playing && !sharing ? undefined : isoDate(app.sim.day),
    // a life's link flies at its own pace and frames itself
    pace: Math.abs(app.sim.pace / app.spec.pace.start - 1) < 1e-6 || (sharing && life) ? undefined : app.sim.pace,
    reverse: app.sim.direction === -1,
    // a switch turned off is written out as "0" (a false value is left out of the address altogether)
    trails: app.sim.trails.on ? undefined : '0',
    span: Math.abs(app.sim.trails.span / app.spec.span.start - 1) < 1e-6 || life ? undefined : app.sim.trails.span,
    opacity: Math.abs(app.sim.trails.opacity - DEFAULT_OPACITY) < 0.005 ? undefined : Math.round(app.sim.trails.opacity * 100) / 100,
    // a body followed across the sky keeps moving the camera: the link keeps the body instead
    zoom: look && !app.following && !(sharing && life) ? look.zoom : undefined,
    at: look && !app.following && !(sharing && life) ? look.at.map(v => v.toFixed(1)).join(',') : undefined,
    // a life's helix is shared only on purpose, from its own card or the You sheet while it is on screen
    born: sharing && life ? life.iso : undefined,
    body: app.selected ?? undefined,
    preset: panel.preset ?? undefined,
    tonight: app.layers.tonight,
    seasons: app.layers.seasons,
    comets: app.layers.comets ? undefined : '0',
    dwarfs: app.layers.dwarfs ? undefined : '0',
  };
}

let urlTimer = 0;
function syncUrl(): void {
  clearTimeout(urlTimer);
  urlTimer = window.setTimeout(() => writeUrl(stateOf(false)), 350);
}

/* ---------- sharing ---------- */

const PLACE = { wake: 'Solar System', sky: 'Solar System', earth: 'Earth & Moon' } as const;

/** This moment: its link (opening paused on it) and its caption, "Solar System · 20 Aug 1977 · Riso". */
function moment(): Moment {
  const life = app.life, style = app.style.title, day = app.sim.day;
  const url = `${location.origin}${location.pathname}${hashOf(stateOf(true))}`;
  const caption = life ? `My years · ${dateLabel(life.born)} to ${dateLabel(day)} · ${style}` : `${PLACE[app.view]} · ${dateLabel(day)} · ${style}`;
  const slug = `${life ? `my-years-${life.iso}` : `${PLACE[app.view].toLowerCase().replace(/ & /, '-and-').replace(/ /g, '-')}-${isoDate(day)}`}-${app.style.key}`;
  return { url, caption, slug };
}

async function share(): Promise<void> {
  const m = moment(), result = await shareMoment(m);
  if (result === 'copied') toast(t('toast.copied', { date: dateLabel(app.sim.day) }));
  else if (result === 'failed') {
    panel.showLink(m.url);
    toast(t('toast.copyBelow'));
  }
}

let drawing = false;
async function picture(): Promise<void> {
  if (drawing) return;
  drawing = true;
  toast(t('toast.drawing'), 20_000);
  // let the toast show before the drawing holds the page for a moment
  await new Promise(r => requestAnimationFrame(() => setTimeout(r, 30)));
  try {
    const result = await savePicture(app, moment());
    if (result === 'saved') toast(t('toast.pictureSaved'));
    else if (result === 'failed') toast(t('toast.pictureFailed'));
    else toastEl.classList.remove('show');
  } finally {
    drawing = false;
  }
}

/** A few seconds of the sky as it moves (set going for the clip if it was paused, and paused again after). */
async function clip(): Promise<void> {
  if (drawing) return;
  drawing = true;
  const paused = !app.sim.playing;
  if (paused) app.play(true);
  toast(t('clip.recording', { s: CLIP_S }), (CLIP_S + 4) * 1000);
  try {
    const result = await recordClip(app, canvas, moment(), CLIP_S);
    if (result === 'saved') toast(t('clip.saved'));
    else if (result === 'failed') toast(t('clip.failed'));
    else toastEl.classList.remove('show');
  } finally {
    drawing = false;
    if (paused) app.play(false);
  }
}

/** Light papers get more solid controls, so hatching and grain never show through them. */
const LIGHT_PAPER = new Set(STYLES.filter(st => {
  const hex = st.swatch[0].replace('#', ''), n = parseInt(hex.length === 3 ? [...hex].map(c => c + c).join('') : hex, 16);
  return ((n >> 16) & 255) * 0.299 + ((n >> 8) & 255) * 0.587 + (n & 255) * 0.114 > 140;
}));

/** The first time the Earth and Moon view shows, a word on how to read it. */
let earthTold = false;

app.onChange = () => {
  // (not while the tour shows the view: its own words say what it is)
  if (app.view === 'earth' && !earthTold && !document.body.classList.contains('welcoming') && !tour.on) {
    earthTold = true;
    toast(t('toast.earth'), 6500);
  }
  controls.refresh();
  panel.refresh();
  journeyBar.refresh();
  tour.refresh();
  moments.refresh(panel.preset, app.view);
  document.body.classList.toggle('light-paper', LIGHT_PAPER.has(app.style));
  syncUrl();
};
app.onDraw = () => {
  controls.onDraw();
  panel.tick();
  journeyBar.onDraw();
  sound.tick(app);
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
  // a journey's bar, or the tour's
  const j = journey ? box('journey-bar') ?? box('tour-bar') : null;
  if (j) bottom = Math.min(bottom, j.top - gap);
  const p = box('panel');
  if (p) {
    // a side panel on a wide or short screen, a sheet along the bottom on an upright phone
    if (p.width < W * 0.7) right = p.left - gap;
    else bottom = Math.min(bottom, p.top - gap);
  }
  return { x: left, y: top, w: Math.max(80, right - left), h: Math.max(80, bottom - top) };
};

const panelEl = document.getElementById('panel')!;
app.cardRect = () => (panelEl.hidden ? null : panelEl.getBoundingClientRect());

/* ---------- size ---------- */


function measure(entry?: ResizeObserverEntry): void {
  if (document.getElementById('dock')!.classList.contains('expanded')) restingDockTop = null;
  const rect = canvas.getBoundingClientRect(), cssW = Math.max(1, Math.round(rect.width)), cssH = Math.max(1, Math.round(rect.height));
  const box = entry?.devicePixelContentBoxSize?.[0];
  const devW = box ? box.inlineSize : Math.round(cssW * devicePixelRatio), devH = box ? box.blockSize : Math.round(cssH * devicePixelRatio);
  app.resize({ cssW, cssH, devW: Math.max(1, devW), devH: Math.max(1, devH) });
  settle();
  // an open sheet's figures follow its new width
  panel.refresh();
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

// a shared camera: the same point at the same zoom, in the middle of this screen's free room
if (url.zoom !== undefined && url.at) app.lookAt(url.at, url.zoom, 0);
if (url.body && url.body in BODY_NAMES) {
  const id = url.body as keyof typeof BODY_NAMES;
  app.select(id);
  panel.openBody(id);
}
if (url.preset) panel.openPreset(url.preset);
// a shared life's helix: shown as flown, up to the shared date, with the way to fly it again
if (url.born !== undefined) {
  const to = url.day ?? today(), life = lifeOf(isoDate(url.born), to);
  if (life) panel.flyLife(life, to, false);
}
if (reduceMotion) toast(t('toast.reduced'), 6500);
// the device's wish can change while the page is open: follow it
motionQuery.addEventListener('change', () => {
  reduceMotion = motionQuery.matches;
  sim.instant = reduceMotion;
  app.reducedMotion = reduceMotion;
  if (reduceMotion && app.sim.playing) {
    app.play(false);
    toast(t('toast.reducedNow'), 6500);
  }
});

// the top bar's and the dock's heights, for what sits between them
for (const [id, name] of [['top', '--top-h'], ['dock', '--dock-h']] as const) {
  const el = document.getElementById(id)!;
  new ResizeObserver(() => document.documentElement.style.setProperty(name, `${Math.round(el.getBoundingClientRect().height)}px`)).observe(el);
}

app.start();
controls.refresh();
// a first visit gets a short welcome; a link straight to a moment, a body or a life goes there without one
if (!url.preset && !url.body && url.born === undefined) welcome.showOnce();
moments.refresh(panel.preset, app.view);
document.body.classList.toggle('light-paper', LIGHT_PAPER.has(app.style));

declare global {
  interface Window {
    /** The running explorer, for tests and the curious. */
    __explorer?: { app: App; panel: Panel; tour: Tour; sound: Sonification; styles: typeof STYLES };
  }
}
window.__explorer = { app, panel, tour, sound, styles: STYLES };
