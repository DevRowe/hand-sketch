/**
 * The side panel (a bottom sheet on phones): fact cards for the bodies with live figures for the date on screen, the
 * guide, and the jump-to presets with their stories. A preset stays active (its geometry drawn, named in a pill at the
 * top) after its card is closed, until it is cleared or another is chosen.
 */
import type { PlanetName } from '../scenes/solar/common';
import { BODY_NAMES, type App, type Selection } from './app';
import type { BodyId } from './bodies';
import { BODIES } from './content/bodies';
import { GUIDE, SOURCES } from './content/guide';
import { dateLong, isoDate, parseIsoDate, today } from './format';
import type { Journey } from './journey';
import { AU_KM, fromEarthKm, fromSunAu, km, lightTime, moonPhase } from './live';
import { PRESETS, presetById, type Preset } from './presets';
import { clamp, MONTH, PACE_MAX } from './sim';
import { CMB_KM_S, count, distance, GALAXY_KM_S, lapCount, ORBIT_KM_S, speed, travelled } from './travel';

export interface PanelHooks {
  toast(text: string): void;
  /** Play a journey with its own bar. */
  startJourney(j: Journey): void;
  /** Show the first visit's welcome again. */
  showWelcome(): void;
}

type Mode = { kind: 'body'; id: NonNullable<Selection> } | { kind: 'guide' } | { kind: 'jump' } | { kind: 'preset'; id: string } | { kind: 'travel' };

/** Where the travel card keeps the viewer's birthday and latitude: in this browser only. */
const BIRTHDAY_KEY = 'explorer.birthday';
const LATITUDE_KEY = 'explorer.latitude';
const stored = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const store = (key: string, value: string): void => {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage refused (a private window): the card still works for this visit */
  }
};

/** Latitudes to choose from, with places near each (Earth's spin carries you round a smaller circle further north or south). */
const LATITUDES: readonly [number, string][] = [
  [0, 'Near the equator (Singapore, Quito, Nairobi)'],
  [20, '~20° (Mumbai, Mexico City, Honolulu)'],
  [30, '~30° (Cairo, Shanghai, New Orleans)'],
  [35, '~35° (Tokyo, Los Angeles, Sydney)'],
  [40, '~40° (New York, Madrid, Beijing)'],
  [50, '~50° (London, Paris, Vancouver)'],
  [60, '~60° (Oslo, Helsinki, Anchorage)'],
];

/** Seconds a flight through a lifetime takes at most. */
const LIFE_FLIGHT_S = 24;

const esc = (s: string): string => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const facts = (rows: readonly { label: string; value: string }[], live = false): string =>
  `<dl class="facts${live ? ' live' : ''}">${rows.map(r => `<div><dt>${esc(r.label)}</dt><dd>${esc(r.value)}</dd></div>`).join('')}</dl>`;

const PLANET_IDS: readonly BodyId[] = ['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'];

const KEYS: readonly [string, string][] = [
  ['Space', 'play or pause'], ['← →', 'slower, faster'], ['R', 'run time backwards'], ['T', 'today'],
  ['V', 'from above / in motion'], ['1 … 0', 'the ten styles ([ ] step through)'], ['W', 'trails on or off'],
  ['L', 'names on or off'], ['+ −', 'zoom'], ['Z', 'reset the view'], ['J', 'jump to…'], ['G', 'guide'], ['Y', 'your travels'],
  ['H', 'hide the controls'], ['F', 'full screen'], ['Esc', 'close, deselect'],
];

export class Panel {
  private readonly el = document.getElementById('panel') as HTMLElement;
  private readonly title = document.getElementById('panel-title') as HTMLElement;
  private readonly eyebrow = document.getElementById('panel-eyebrow') as HTMLElement;
  private readonly body = document.getElementById('panel-body') as HTMLElement;
  private readonly pill = document.getElementById('preset-pill') as HTMLElement;
  private readonly pillText = document.getElementById('pill-text') as HTMLElement;
  private mode: Mode | null = null;
  private liveAt = 0;
  /** While the travel card is open: when it opened (ms since 1970), and its once-a-second ticker. */
  private travelOpenedAt = 0;
  private travelTimer = 0;
  /** Where the focus was when the panel opened: it goes back there when the panel closes. */
  private returnFocus: HTMLElement | null = null;
  /** The preset whose geometry is drawn, for the address bar. */
  preset: string | null = null;

  constructor(private readonly app: App, private readonly hooks: PanelHooks) {
    document.getElementById('panel-close')!.addEventListener('click', () => this.close());
    document.getElementById('pill-open')!.addEventListener('click', () => this.preset && this.openPreset(this.preset, false));
    document.getElementById('pill-clear')!.addEventListener('click', () => this.clearPreset());
    this.body.addEventListener('click', e => this.onClick(e));
    this.body.addEventListener('change', e => this.onInput(e));
  }

  /* ---------- showing ---------- */

  private show(mode: Mode, eyebrow: string, title: string, html: string): void {
    this.mode = mode;
    clearInterval(this.travelTimer);
    this.eyebrow.textContent = eyebrow;
    this.title.textContent = title;
    this.body.innerHTML = html;
    this.body.scrollTop = 0;
    const opening = this.el.hidden;
    if (opening) {
      const active = document.activeElement;
      this.returnFocus = active instanceof HTMLElement && active !== document.body && !this.el.contains(active) ? active : null;
    }
    this.el.hidden = false;
    document.body.classList.add('panel-open');
    document.getElementById('jump-btn')!.setAttribute('aria-expanded', String(mode.kind === 'jump' || mode.kind === 'preset'));
    document.getElementById('guide-btn')!.setAttribute('aria-expanded', String(mode.kind === 'guide'));
    if (opening) this.el.focus({ preventScroll: true });
    this.tick(true);
  }

  openBody(id: NonNullable<Selection>): void {
    const c = BODIES[id], planet = id !== 'sun' && id !== 'moon' && id !== 'belt';
    const actions = id === 'belt' ? '' : `<div class="card-actions">
      <button type="button" class="act" data-act="zoom">Zoom in</button>
      <button type="button" class="act" data-act="follow" aria-pressed="${this.app.following}">Follow</button>
    </div>`;
    const html = `<p class="intro">${esc(c.intro)}</p>
      ${id === 'belt' ? '' : `<section class="now" aria-label="On the date shown"><h3>On <span data-live="date"></span></h3><div data-live="facts"></div></section>`}
      ${actions}
      ${c.facts.length ? `<h3>Key figures</h3>${facts(c.facts)}` : ''}
      ${c.orbit ? `<h3>Its orbit</h3><p>${esc(c.orbit)}</p>` : ''}
      ${c.fun.length ? `<h3>Did you know?</h3><ul class="fun">${c.fun.map(f => `<li>${esc(f)}</li>`).join('')}</ul>` : ''}
      ${planet || id === 'moon' ? '<p class="small">Figures: NASA planetary fact sheets, rounded. Positions for the date: JPL mean orbital elements.</p>' : ''}`;
    this.show({ kind: 'body', id }, c.kind, BODY_NAMES[id], html);
  }

  openGuide(section?: string): void {
    const bodies = `<div class="chiplist">${(['sun', ...PLANET_IDS.slice(0, 3), 'moon', ...PLANET_IDS.slice(3), 'belt'] as const)
      .map(id => `<button type="button" class="chip" data-body="${id}">${esc(BODY_NAMES[id])}</button>`).join('')}</div>`;
    const sections = GUIDE.map(s => `<details class="guide" id="guide-${s.id}"${s.id === (section ?? 'orbits') ? ' open' : ''}>
        <summary><h3>${esc(s.title)}</h3></summary>
        ${s.intro ? `<p>${esc(s.intro)}</p>` : ''}
        ${s.items.map(i => `<p><b>${esc(i.title)}.</b> ${esc(i.text)}</p>`).join('')}
      </details>`).join('');
    const keys = `<details class="guide"><summary><h3>Keys and gestures</h3></summary>
        <p>Drag to pan, scroll or pinch to zoom, tap a planet for its card, double-tap to fly in and follow it. While a journey plays, its bar replaces the controls; Esc or × ends it.</p>
        <dl class="keys">${KEYS.map(([k, v]) => `<div><dt><kbd>${esc(k)}</kbd></dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
      </details>`;
    const sourcesIntro = `<p><button type="button" class="link" data-act="welcome">Show the welcome tips again</button></p>`;
    const sources = `<details class="guide"><summary><h3>Sources</h3></summary>
        <p>Figures come from NASA, ESA and JPL; each is rounded, "~" marks approximations, and counts that keep changing (moons, satellites) carry their date.</p>
        <ul class="sources">${SOURCES.map(s => `<li><a href="${esc(s.href)}" target="_blank" rel="noopener">${esc(s.label)}</a></li>`).join('')}</ul>
        <p class="small">The drawings are hand-sketch, deterministic Canvas 2D scenes drawn live in your browser. <a href="../">See the recorded pieces</a>.</p>
      </details>`;
    this.show({ kind: 'guide' }, 'Guide', 'The solar system', `<p class="intro">Tap any body for its card:</p>${bodies}${sections}${keys}${sources}${sourcesIntro}`);
  }

  /** How far you have travelled through space since your birthday, measured four ways. */
  openTravel(): void {
    const bday = stored(BIRTHDAY_KEY) ?? '', lat = Number(stored(LATITUDE_KEY) ?? 0);
    const options = LATITUDES.map(([v, label]) => `<option value="${v}"${v === lat ? ' selected' : ''}>${esc(label)}</option>`).join('');
    const html = `<p class="intro">You have never once sat still. Enter your birthday to see how far you have been carried through space since.</p>
      <div class="bday">
        <label>Your birthday<input type="date" id="bday-in" min="1900-01-01" max="${isoDate(today())}" value="${esc(bday)}"></label>
        <label>Where you have mostly lived<select id="lat-in">${options}</select></label>
      </div>
      <div data-live="travel"></div>
      <h3>Why the numbers don’t add up</h3>
      <p>Speed only means something against a reference, and each figure above uses a different one. The motions also point in different directions, so they never simply add: your ~${Math.round(CMB_KM_S)} km/s against the microwave background already includes the Sun’s ~${GALAXY_KM_S} km/s round the galaxy, Earth’s ~${ORBIT_KM_S} km/s round the Sun and the Milky Way’s own drift. Against the chair you are sitting in, you have hardly moved at all.</p>
      <ul class="fun">
        <li><b>Spin</b>: a point on the equator circles Earth’s axis once a sidereal day (23 h 56 min), 40,075 km at ~1,674 km/h; nearer the poles the circle, and the speed, shrink with the cosine of the latitude (~71% at 45°).</li>
        <li><b>Round the Sun</b>: Earth averages 29.78 km/s, ~940 million km a lap, a little faster in January (closest) than in July.</li>
        <li><b>Round the Milky Way</b>: the Sun circles the galaxy’s centre at ~230 km/s (estimates run from ~220 to ~250), one lap every ~230 million years.</li>
        <li><b>Through the cosmos</b>: against the cosmic microwave background, the afterglow of the Big Bang, the Solar System moves at ~370 km/s towards the constellations Leo and Crater (Planck 2018: 369.8 km/s).</li>
      </ul>
      <p class="small">Figures: NASA’s Earth fact sheet, WGS 84, Reid et al. 2019 and the Planck 2018 results; see Sources in the guide. Your birthday stays in this browser.</p>`;
    this.show({ kind: 'travel' }, 'Your travels', 'How far have you come?', html);
    this.travelOpenedAt = Date.now();
    this.renderTravel();
    this.travelTimer = window.setInterval(() => this.tickTravel(), 1000);
  }

  /** The viewer's birthday as a day count (noon UTC of that date), or null when none is set or it lies ahead. */
  private birthday(): number | null {
    const v = this.body.querySelector<HTMLInputElement>('#bday-in')?.value ?? '', day = parseIsoDate(v);
    return day !== null && day <= today() ? day : null;
  }

  /** Seconds lived: from the start of the birthday, local time, to now. */
  private static secondsSince(iso: string): number {
    const [y, m, d] = iso.split('-').map(Number) as [number, number, number], start = new Date(y, m - 1, d);
    start.setFullYear(y);
    return (Date.now() - start.getTime()) / 1000;
  }

  private renderTravel(): void {
    const box = this.body.querySelector('[data-live="travel"]');
    if (!box) return;
    const input = this.body.querySelector<HTMLInputElement>('#bday-in')!, day = this.birthday();
    if (day === null) {
      box.innerHTML = input.value
        ? '<p class="ticker">That date is still to come. Pick the day you were born.</p>'
        : `<p class="ticker">Even without a birthday: since you opened this card, you have moved <b data-live="since">0 km</b> round the Sun.</p>`;
      return;
    }
    const lat = Number(this.body.querySelector<HTMLSelectElement>('#lat-in')?.value ?? 0);
    const t = travelled(Panel.secondsSince(input.value), lat);
    box.innerHTML = `<p class="age">You are <b>${count(t.days)} days</b> old: <b>${lapCount(t.laps)}</b> trips round the Sun.</p>
      <ul class="frames">${t.frames.map(f => `<li><div class="f-head"><span class="f-title">${esc(f.title)}</span><span class="f-speed">~${esc(speed(f.speed))}${f.id === 'spin' ? (lat ? ` at ~${lat}°` : ' at the equator') : ''}</span></div>
        <span class="f-km">~${esc(distance(f.km))}</span><span class="f-note">${esc(f.compare)} · measured against ${esc(f.against)}</span></li>`).join('')}</ul>
      <p class="ticker">Since you opened this card: <b data-live="since">0 km</b> round the Sun, <b data-live="since-cmb">0 km</b> through the cosmos.</p>
      <div class="card-actions">
        <button type="button" class="act primary" data-act="life"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l12.5-7.5z"/></svg>Fly your years, in motion</button>
        <button type="button" class="act" data-act="birth-sky">The sky on your birthday</button>
      </div>`;
    this.tickTravel();
  }

  /** The since-you-opened-this counters. */
  private tickTravel(): void {
    const s = (Date.now() - this.travelOpenedAt) / 1000;
    const since = this.body.querySelector('[data-live="since"]'), cmb = this.body.querySelector('[data-live="since-cmb"]');
    if (since) since.textContent = `${count(ORBIT_KM_S * s)} km`;
    if (cmb) cmb.textContent = `${count(CMB_KM_S * s)} km`;
  }

  private onInput(e: Event): void {
    const t = e.target as HTMLElement;
    if (t.id === 'bday-in') {
      const v = (t as HTMLInputElement).value;
      if (this.birthday() !== null) store(BIRTHDAY_KEY, v);
      this.renderTravel();
    } else if (t.id === 'lat-in') {
      store(LATITUDE_KEY, (t as HTMLSelectElement).value);
      this.renderTravel();
    }
  }

  openJump(): void {
    // "now and next" reads by the calendar: what is still ahead, and what has just passed
    const now = today(), groups = new Map<string, Preset[]>();
    for (const p of PRESETS) {
      const g = p.group === 'Now and next' ? (p.day() >= now ? 'Coming up' : 'Recent milestones') : p.group;
      groups.set(g, [...(groups.get(g) ?? []), p]);
    }
    const html = [...groups].map(([g, ps]) => `<h3 class="group">${esc(g)}</h3><ul class="presets">${ps.map(p => `<li><button type="button" class="preset" data-preset="${p.id}">
        <span class="p-title">${esc(p.title)}</span><span class="p-when">${esc(dateLong(p.day()))}</span><span class="p-kicker">${esc(p.kicker)}</span>
      </button></li>`).join('')}</ul>`).join('');
    this.show({ kind: 'jump' }, 'Jump to', 'Key moments', `<p class="intro">Set the sky to a real moment and see why it matters.</p>${html}`);
  }

  /** Open a preset's card; `apply` also sets the sky to its moment. */
  openPreset(id: string, apply = true): void {
    const p = presetById(id);
    if (!p) return;
    const c = p.card(), j = p.journey?.();
    const html = `<p class="when">${esc(c.when)}</p>
      <p class="intro">${esc(c.intro)}</p>
      <div class="card-actions">
        ${j ? `<button type="button" class="act primary" data-act="journey"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l12.5-7.5z"/></svg>${esc(j.label)}</button>` : ''}
        <button type="button" class="act" data-act="moment">Back to the moment</button>
        <button type="button" class="act" data-act="list">All key moments</button>
      </div>
      ${facts(c.facts)}
      ${c.body.map(b => `<p>${esc(b)}</p>`).join('')}
      ${c.notes?.length ? `<ul class="notes">${c.notes.map((n, i) => (i === 0 && n.endsWith(':') ? `<li class="lead">${esc(n)}</li>` : `<li>${esc(n)}</li>`)).join('')}</ul>` : ''}`;
    this.show({ kind: 'preset', id }, p.group === 'Now and next' ? 'Coming up' : p.group, p.title, html);
    // framing measures the room the open card leaves, so set the moment once the card is up
    if (apply) this.apply(p);
  }

  /** Set the sky to a preset's moment: paused there, framed, with its geometry. */
  private apply(p: Preset): void {
    const app = this.app;
    this.preset = p.id;
    app.overlay = p.overlay ? (ctx, a) => p.overlay!(ctx, a) : null;
    app.play(false);
    app.setDirection(1);
    app.jump(p.day());
    if (p.view) app.setView(p.view);
    const target = p.focus?.body ?? p.select ?? null;
    app.select(target, false);
    if (p.focus) app.focusSelected(p.focus.zoom);
    else if (p.frame) app.frameDesign(p.frame.fit, p.frame.at ?? [540, 540]);
    else if (!app.atHome) app.resetView();
    this.pillText.textContent = p.title;
    this.pill.hidden = false;
  }

  /** Stop drawing a preset's geometry. */
  clearPreset(): void {
    this.preset = null;
    this.app.overlay = null;
    this.pill.hidden = true;
    if (this.mode?.kind === 'preset') this.close();
    this.app.invalidate();
    this.app.onChange();
  }

  /** Close the panel; false when it was not open. */
  close(): boolean {
    if (this.el.hidden) return false;
    // the focus must not stay behind in a hidden card (a date field there would swallow the keyboard shortcuts)
    const hadFocus = this.el.contains(document.activeElement);
    this.el.hidden = true;
    if (hadFocus) {
      const back = this.returnFocus;
      if (back?.isConnected && back.offsetParent !== null) back.focus({ preventScroll: true });
      else (document.activeElement as HTMLElement | null)?.blur();
    }
    this.returnFocus = null;
    this.mode = null;
    clearInterval(this.travelTimer);
    document.body.classList.remove('panel-open');
    for (const id of ['jump-btn', 'guide-btn']) document.getElementById(id)!.setAttribute('aria-expanded', 'false');
    return true;
  }

  /* ---------- keeping up ---------- */

  /** Keep the open card in step with the app (the selected body may change under it). */
  refresh(): void {
    const m = this.mode;
    if (m?.kind === 'body' && this.app.selected && this.app.selected !== m.id) this.openBody(this.app.selected);
    const follow = this.body.querySelector<HTMLButtonElement>('[data-act="follow"]');
    follow?.setAttribute('aria-pressed', String(this.app.following));
    this.tick(true);
  }

  /** Update the live figures (a few times a second while the date runs). */
  tick(force = false): void {
    const m = this.mode;
    if (m?.kind !== 'body' || m.id === 'belt') return;
    const now = performance.now();
    if (!force && now - this.liveAt < 250) return;
    this.liveAt = now;
    const day = this.app.sim.day, date = this.body.querySelector('[data-live="date"]'), box = this.body.querySelector('[data-live="facts"]');
    if (!date || !box) return;
    date.textContent = dateLong(day);
    box.innerHTML = facts(liveFacts(m.id, day), true);
  }

  private onClick(e: Event): void {
    const t = (e.target as HTMLElement).closest<HTMLElement>('[data-act], [data-body], [data-preset]');
    if (!t) return;
    const app = this.app;
    if (t.dataset.body) {
      const id = t.dataset.body as NonNullable<Selection>;
      app.select(id);
      this.openBody(id);
    } else if (t.dataset.preset) this.openPreset(t.dataset.preset);
    else if (t.dataset.act === 'zoom') app.focusSelected(Math.max(4, app.camera.zoom * 2));
    else if (t.dataset.act === 'follow') {
      if (app.following) app.select(app.selected, false);
      else app.focusSelected(Math.max(2.5, app.camera.zoom));
    } else if (t.dataset.act === 'journey' && this.preset) {
      const j = presetById(this.preset)?.journey?.();
      if (j) this.hooks.startJourney(j);
    } else if (t.dataset.act === 'life') {
      const from = this.birthday();
      if (from === null) return;
      // the Sun carrying you through space reads best in motion, from the day you were born to today
      this.clearPreset();
      app.setView('wake');
      app.select(null, false);
      app.resetView();
      const to = today();
      this.hooks.startJourney({ from, to, pace: clamp((to - from) / LIFE_FLIGHT_S, MONTH, PACE_MAX), label: 'Your years so far' });
    } else if (t.dataset.act === 'birth-sky') {
      const day = this.birthday();
      if (day === null) return;
      this.clearPreset();
      app.play(false);
      app.jump(day);
      if (!app.atHome) app.resetView();
      this.hooks.toast(`The sky on ${dateLong(day)}`);
    } else if (t.dataset.act === 'welcome') {
      this.close();
      this.hooks.showWelcome();
    } else if (t.dataset.act === 'moment' && this.preset) {
      const p = presetById(this.preset);
      if (p) this.apply(p);
    } else if (t.dataset.act === 'list') this.openJump();
  }
}

/** Figures for the date on screen. */
function liveFacts(id: BodyId, day: number): { label: string; value: string }[] {
  if (id === 'sun') {
    const d = fromSunAu('earth', day) * AU_KM;
    return [{ label: 'From Earth', value: km(d) }, { label: 'Sunlight takes', value: lightTime(d) }];
  }
  if (id === 'moon') {
    const p = moonPhase(day);
    return [{ label: 'Phase', value: `${p.name}, ${Math.round(p.lit * 100)}% lit` }, { label: 'Light to Earth', value: '~1.3 s' }];
  }
  if (id === 'earth') {
    const au = fromSunAu('earth', day);
    return [{ label: 'From the Sun', value: `${km(au * AU_KM)} (${au.toFixed(3)} au)` }, { label: 'Sunlight takes', value: lightTime(au * AU_KM) }];
  }
  const name = id as PlanetName, d = fromEarthKm(name, day), au = fromSunAu(name, day);
  return [
    { label: 'From Earth', value: km(d) },
    { label: 'Its light takes', value: lightTime(d) },
    { label: 'From the Sun', value: `${au.toFixed(au < 2 ? 3 : 2)} au` },
  ];
}

