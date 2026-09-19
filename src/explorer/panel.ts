/**
 * The side panel (a bottom sheet on phones): fact cards for the bodies with live figures for the date on screen, the
 * guide, and the jump-to presets with their stories. A preset stays active (its geometry drawn, named in a pill at the
 * top) after its card is closed, until it is cleared or another is chosen.
 */
import { circularSpeed, EARTH_R, shape } from '../scenes/cislunar/common';
import { trackedById } from '../scenes/cislunar/objects';
import type { PlanetName } from '../scenes/solar/common';
import { moonDistance } from '../scenes/solar/ephemeris';
import { BODY_NAMES, NEIGHBOURS, type App, type Selection } from './app';
import { DWARF_IDS } from './beyond';
import type { BodyId, RingId } from './bodies';
import { COMETS, cometAt, type CometId } from './comets';
import { BODIES } from './content/bodies';
import { GUIDE, SOURCES } from './content/guide';
import type { MenuId } from './controls';
import { dateLabel, dateLong, isFuture, isoDate, parseIsoDate, today } from './format';
import type { Journey } from './journey';
import { lifeFrame, lifeOf, type Life } from './life';
import { AU_KM, fromEarthKm, fromSunAu, km, lightTime, moonPhase, xyz as xyzOf } from './live';
import { PRESETS, presetById, type Preset } from './presets';
import { canRecord } from './clip';
import { t } from './i18n';
import { drawFigures, scaleHtml } from './scale';
import { guessLatitude, moonHtml, seasonsHtml, SKY_LATITUDES, tonightHtml } from './skysheet';
import { clamp, MONTH, PACE_MAX } from './sim';
import { ageLabel, ageLine, CMB_KM_S, count, distance, GALAXY_KM_S, ORBIT_KM_S, outerLaps, planetAges, speed, travelled } from './travel';

export interface PanelHooks {
  toast(text: string): void;
  /** Play a journey with its own bar (or, `play` false, show it arrived); end the one on screen. */
  startJourney(j: Journey, play?: boolean): void;
  endJourney(): boolean;
  /** Show the first visit's welcome again. */
  showWelcome(): void;
  /** Share this moment (a link that opens paused on it), save a picture of it, or record a short clip. */
  share(): void;
  savePicture(): void;
  recordClip(): void;
  /** Take the guided tour. */
  startTour(): void;
}

type Mode = { kind: 'body'; id: NonNullable<Selection> } | { kind: 'guide' } | { kind: 'jump' } | { kind: 'preset'; id: string }
  | { kind: 'look' } | { kind: 'you' } | { kind: 'life' } | { kind: 'sky' } | { kind: 'scale' };

/** The menu each kind of card belongs to (a body's card belongs to none: it comes from the sky). */
const MENU_OF: Readonly<Record<Mode['kind'], MenuId | null>> = { body: null, guide: 'guide', jump: 'moments', preset: 'moments', look: 'look', you: 'you', life: 'you', sky: 'sky', scale: 'scale' };

const VIEW_WORDS = { wake: 'In motion', sky: 'From above', earth: 'Earth & Moon' } as const;

/** Where the travel card keeps the viewer's birthday and latitude: in this browser only. */
const BIRTHDAY_KEY = 'explorer.birthday';
const LATITUDE_KEY = 'explorer.latitude';
/** Where the Sky sheet keeps the latitude its day lengths are for (signed: south negative). */
const SKY_LAT_KEY = 'explorer.skylat';
/** The earliest birthday the card takes. */
const BIRTHDAY_MIN = '1900-01-01';
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
/** What the Earth and Moon view shows round the Earth, for the guide: the heights, then the craft, newest first. */
const ORBIT_IDS: readonly BodyId[] = ['leo', 'gps', 'geo', 'starlink', 'iss', 'tiangong', 'hubble', 'mir', 'skylab', 'salyut', 'sputnik'];
const RING_IDS: ReadonlySet<BodyId | 'belt'> = new Set<RingId>(['leo', 'gps', 'geo', 'starlink']);
/** Bodies only the Earth and Moon view draws. */
const EARTH_ONLY: ReadonlySet<BodyId | 'belt'> = new Set(ORBIT_IDS);
/** The comets, drawn only in the From above view (while the Sky menu shows them). */
const COMET_IDS: ReadonlySet<BodyId | 'belt'> = new Set<CometId>(['halley', 'atlas']);
/** Pluto and the Kuiper belt, drawn only in the From above view (while the Scale menu shows them). */
const DWARFS: ReadonlySet<BodyId | 'belt'> = new Set(DWARF_IDS);
/** The belts: a card with no figures for the date. */
const BELTS: ReadonlySet<BodyId | 'belt'> = new Set(['belt', 'kuiper']);
/** The moments each comet has, offered on its card. */
const COMET_MOMENTS: Readonly<Record<CometId, readonly string[]>> = { halley: ['halley-1986', 'halley-2061'], atlas: ['atlas-2025'] };

const KEYS: readonly [string, string][] = [
  ['Space', 'play or pause (the tour, while it is on)'], ['← →', 'slower, faster; with a moment on show, the one before or after it'], ['R', 'run time backwards'], ['T', 'today'],
  ['V', 'from above / in motion'], ['E', 'the Earth and Moon up close, and back'], ['N', 'the next body in view, with its card (Shift+N: the one before)'],
  ['1 … 0', 'the ten styles ([ ] step through)'], ['W', 'trails on or off'], ['L', 'names on or off'], ['M', 'the sound of the orbits on or off'],
  ['+ −', 'zoom'], ['Z', 'reset the view'], ['J', 'moments and the guided tour'], ['K', 'sky: tonight, the Moon, comets, seasons'], ['C', 'scale: sizes, distances, beyond Neptune, the galaxy'],
  ['S', 'look: styles, trails, names, sound'], ['Y', 'you: share, save a picture or a clip, your years'], ['G', 'guide'],
  ['H', 'hide the controls'], ['F', 'full screen'], ['Esc', 'close, end a journey or the tour, deselect'],
];

export class Panel {
  private readonly el = document.getElementById('panel') as HTMLElement;
  private readonly title = document.getElementById('panel-title') as HTMLElement;
  private readonly eyebrow = document.getElementById('panel-eyebrow') as HTMLElement;
  private readonly body = document.getElementById('panel-body') as HTMLElement;
  private readonly pill = document.getElementById('preset-pill') as HTMLElement;
  private readonly pillText = document.getElementById('pill-text') as HTMLElement;
  private readonly pillCount = document.getElementById('pill-count') as HTMLElement;
  /** The Look sheet: kept whole (its controls are wired once), shown here when Look opens and put back when it closes. */
  private readonly look = document.getElementById('look-sheet') as HTMLElement;
  private readonly lookHome = this.look.parentElement!;
  /** The life on screen, for its card. */
  private life: { life: Life; to: number } | null = null;
  private mode: Mode | null = null;
  private liveAt = 0;
  /** While the travel card is open: when it opened (ms since 1970), and its once-a-second ticker. */
  private travelOpenedAt = 0;
  private travelTimer = 0;
  /** Where the focus was when the panel opened: it goes back there when the panel closes. */
  private returnFocus: HTMLElement | null = null;
  /** The preset whose geometry is drawn, for the address bar. */
  preset: string | null = null;
  /** The moment last set, marked in the Moments list to carry on from. */
  private lastMoment: string | null = null;
  /** The moments in the order the Moments list showed them last (previous and next step through it). */
  private order: readonly string[] | null = null;
  /** How far the Moments list was scrolled when it was left, to open there again. */
  private jumpScroll = 0;
  /** What the Scale sheet's figures were last drawn for (the style and the width), so they are drawn again only when it changes. */
  private figures = '';

  constructor(private readonly app: App, private readonly hooks: PanelHooks) {
    document.getElementById('panel-close')!.addEventListener('click', () => this.close());
    document.getElementById('pill-open')!.addEventListener('click', () => this.preset && this.openPreset(this.preset, false));
    document.getElementById('pill-clear')!.addEventListener('click', () => this.clearPreset());
    document.getElementById('pill-prev')!.addEventListener('click', () => this.stepMoment(-1));
    document.getElementById('pill-next')!.addEventListener('click', () => this.stepMoment(1));
    this.body.addEventListener('click', e => this.onClick(e));
    this.body.addEventListener('change', e => this.onInput(e));
  }

  /* ---------- showing ---------- */

  private show(mode: Mode, eyebrow: string, title: string, html: string | HTMLElement): void {
    this.keepJumpScroll();
    this.mode = mode;
    clearInterval(this.travelTimer);
    this.eyebrow.textContent = eyebrow;
    this.title.textContent = title;
    if (this.look.parentElement === this.body) this.lookHome.append(this.look);
    if (typeof html === 'string') this.body.innerHTML = html;
    else this.body.replaceChildren(html);
    this.body.scrollTop = 0;
    const opening = this.el.hidden;
    if (opening) {
      const active = document.activeElement;
      this.returnFocus = active instanceof HTMLElement && active !== document.body && !this.el.contains(active) ? active : null;
    }
    this.el.hidden = false;
    this.el.dataset.kind = mode.kind;
    document.body.classList.add('panel-open');
    this.markMenus(MENU_OF[mode.kind]);
    if (opening) this.el.focus({ preventScroll: true });
    // the names under the card are put away (and come back once it closes) on the next drawing
    if (opening) this.app.invalidate();
    // the room the card leaves is where the page must stay
    this.app.syncRoom();
    this.tick(true);
  }

  /** Show which menu's sheet is open (on the menu buttons, and on the tabs they become on a phone). */
  private markMenus(menu: MenuId | null): void {
    for (const b of document.querySelectorAll<HTMLButtonElement>('#menus .menu')) b.setAttribute('aria-expanded', String(b.dataset.menu === menu));
  }

  /** The menu whose sheet is open, if any. */
  get menu(): MenuId | null { return this.mode ? MENU_OF[this.mode.kind] : null; }

  openMenu(id: MenuId): void {
    if (id === 'moments') this.openJump();
    else if (id === 'sky') this.openSky();
    else if (id === 'scale') this.openScale();
    else if (id === 'look') this.openLook();
    else if (id === 'you') this.openYou();
    else this.openGuide();
  }

  /** A menu's button: open its sheet, or close it when it is the one showing (a preset's card belongs to Moments). */
  toggleMenu(id: MenuId): void {
    if (this.menu === id && !(this.mode?.kind === 'preset')) this.close();
    else this.openMenu(id);
  }

  /** Look: the visual style, the trails, the names, zoom (on a compact screen) and the screen itself. */
  openLook(): void {
    this.show({ kind: 'look' }, 'Look', 'How the sky looks and sounds', this.look);
  }

  /**
   * Sky: what is up tonight and why (sight-lines from the Earth), the Moon's phase and the eclipse to come, the comets,
   * and the seasons. The lists follow the date on screen; the switches draw each over the From above view.
   */
  openSky(): void {
    const L = this.app.layers, lat = this.skyLatitude();
    const options = SKY_LATITUDES.map(([v, label]) => `<option value="${v}"${v === lat ? ' selected' : ''}>${esc(label)}</option>`).join('');
    const moments = (ids: readonly string[]): string => `<ul class="presets">${ids.map(presetById).filter((p): p is Preset => p !== undefined).map(p => presetItem(p)).join('')}</ul>`;
    const html = `<p class="intro">What you can see from the Earth on <b data-live="sky-date"></b>, and why: from above, the Sun, the Earth and every planet are in view at once.</p>
      <section class="sky-sec" aria-labelledby="sky-tonight-h">
        <h3 id="sky-tonight-h">Look up tonight</h3>
        <div data-live="tonight"></div>
        <div class="card-actions">
          <button type="button" class="act primary" data-act="layer" data-layer="tonight" aria-pressed="${L.tonight}">${LAYER_ICON}Draw the sight-lines</button>
          <button type="button" class="act" data-act="tonight">Tonight</button>
        </div>
        <details class="guide"><summary><h3>Evening star or morning star?</h3></summary>
          <p>The Earth turns towards the east, so the Sun and everything near it in our sky rises in the east and sets in the west. A planet a little east of the Sun sets soon after it: look west after sunset. A planet west of the Sun rises before it: look east before dawn. One opposite the Sun rises as it sets and is up all night. Within ~15° of the Sun, a planet is lost in its glare.</p>
          <p>From above you can see which it is: from the Earth, look along the gold lines at dusk, the blue ones before dawn. The plan squeezes the outer orbits to fit, so the lines’ angles are only roughly true; the lists use the real ones. Exact heights depend on your latitude and the season.</p>
        </details>
      </section>
      <section class="sky-sec" aria-labelledby="sky-moon-h">
        <h3 id="sky-moon-h">The Moon and eclipses</h3>
        <div data-live="moon"></div>
        <p class="small">The Moon as seen from the northern hemisphere; from the south it is turned the other way up. From above it is always half lit, by the Sun; from the Earth we see a changing share of that lit half.</p>
        ${moments(['eclipse-2027'])}
        <div class="card-actions"><button type="button" class="act" data-act="earth-view">See the Earth and Moon up close</button></div>
      </section>
      <section class="sky-sec" aria-labelledby="sky-comets-h">
        <h3 id="sky-comets-h">Comets and visitors</h3>
        <p>Comets swing in on long, stretched orbits, creeping at the far end and racing round the Sun: Kepler’s second law, drawn. One from another star passes once and never returns.</p>
        <div class="row">
          <button type="button" class="toggle" data-act="layer" data-layer="comets" aria-pressed="${L.comets}"><span class="dot" aria-hidden="true"></span>Comets on the plan</button>
          <button type="button" class="chip" data-body="halley">Halley’s Comet</button>
          <button type="button" class="chip" data-body="atlas">3I/ATLAS</button>
        </div>
        ${moments(COMET_MOMENTS.halley.concat(COMET_MOMENTS.atlas))}
      </section>
      <section class="sky-sec" aria-labelledby="sky-seasons-h">
        <h3 id="sky-seasons-h">Seasons and the tilt</h3>
        <label class="sky-lat">Daylight at<select id="sky-lat-in">${options}</select></label>
        <div data-live="seasons"></div>
        <div class="card-actions"><button type="button" class="act" data-act="layer" data-layer="seasons" aria-pressed="${L.seasons}">${LAYER_ICON}Draw the tilt and seasons</button></div>
        <details class="guide"><summary><h3>Why are there seasons?</h3></summary>
          <p>The Earth’s axis leans ~23.4° and keeps pointing the same way in space, towards Polaris, all year round. From June the north leans towards the Sun: long days and a high Sun bring summer there, while the south has winter. Six months later, on the far side of the orbit, it is the other way round.</p>
          <p>It is not the distance: the Earth is closest to the Sun in early January (~147 million km) and farthest in early July (~152 million km), a difference of only ~3%.</p>
        </details>
      </section>
      <p class="small">Positions: JPL mean orbital elements and Meeus’s Moon; comets from JPL’s Small-Body Database; brightness from the standard magnitude formulas; eclipse times and durations from NASA’s eclipse catalogue. See Sources in the guide.</p>`;
    this.show({ kind: 'sky' }, 'Sky', 'The sky from Earth', html);
  }

  /**
   * Scale: the bodies side by side at one true scale, their true distances in a model with the Sun as a basketball,
   * what lies beyond Neptune (the switch that draws it), the Sun's path round the galaxy, and how the drawings cheat.
   */
  openScale(): void {
    const item = (id: string): string => {
      const p = presetById(id);
      return p ? presetItem(p) : '';
    };
    this.show({ kind: 'scale' }, 'Scale', 'How big, how far', scaleHtml(this.app.sim.day, Math.min(innerWidth, innerHeight), this.app.layers.dwarfs, item));
    this.figures = '';
    this.drawFigures();
  }

  /** Draw the Scale sheet's figures, for the style on show at the sheet's width (again only once either changes). */
  private drawFigures(): void {
    if (this.mode?.kind !== 'scale') return;
    const key = `${this.app.style.key}:${this.body.clientWidth}`;
    if (key === this.figures) return;
    this.figures = key;
    drawFigures(this.body, this.app.style.swatch);
  }

  /** The latitude the Sky sheet's day lengths are for: the one chosen here before, else a guess from the clock. */
  private skyLatitude(): number {
    const v = Number(stored(SKY_LAT_KEY) ?? NaN);
    return SKY_LATITUDES.some(([l]) => l === v) ? v : guessLatitude();
  }

  openBody(id: NonNullable<Selection>): void {
    const c = BODIES[id], planet = PLANET_IDS.includes(id as BodyId), ring = RING_IDS.has(id), comet = COMET_IDS.has(id), band = BELTS.has(id);
    // the Earth and the Moon, seen in a plan, offer the view that shows them up close
    const closer = NEIGHBOURS.has(id) && this.app.view !== 'earth' ? '<button type="button" class="act primary" data-act="earth-view">See the Earth and Moon up close</button>' : '';
    const actions = band ? '' : ring ? `<div class="card-actions"><button type="button" class="act" data-act="frame-ring">Show it whole</button></div>` : `<div class="card-actions">
      ${closer}
      ${comet ? COMET_MOMENTS[id as CometId].map(pid => `<button type="button" class="act primary" data-preset="${pid}">${esc(presetById(pid)!.title)}</button>`).join('') : ''}
      <button type="button" class="act" data-act="zoom">Zoom in</button>
      <button type="button" class="act" data-act="follow" aria-pressed="${this.app.following}">Follow</button>
    </div>`;
    const small = planet || id === 'moon' ? '<p class="small">Figures: NASA planetary fact sheets, rounded. Positions for the date: JPL mean orbital elements.</p>'
      : EARTH_ONLY.has(id) ? '<p class="small">Figures: NASA, CMSA and J. McDowell’s satellite catalogue, rounded; see Sources in the guide. Heights and tilts are real; where a craft is along its orbit is illustrative.</p>'
      : comet ? '<p class="small">Figures: NASA and ESA, rounded. Its orbit: JPL’s Small-Body Database, placed on the plan’s squeezed scale; its tails show which way they point, not their true length.</p>'
      : DWARFS.has(id) ? '<p class="small">Figures: NASA, rounded. Pluto’s place for the date: JPL mean orbital elements, on the plan’s squeezed scale (only From above draws what lies beyond Neptune).</p>' : '';
    const html = `<p class="intro">${esc(c.intro)}</p>
      ${band || ring ? '' : `<section class="now" aria-label="On the date shown"><h3>On <span data-live="date"></span></h3><div data-live="facts"></div></section>`}
      ${actions}
      ${c.facts.length ? `<h3>Key figures</h3>${facts(c.facts)}` : ''}
      ${c.orbit ? `<h3>Its orbit</h3><p>${esc(c.orbit)}</p>` : ''}
      ${c.fun.length ? `<h3>Did you know?</h3><ul class="fun">${c.fun.map(f => `<li>${esc(f)}</li>`).join('')}</ul>` : ''}
      ${small}`;
    this.show({ kind: 'body', id }, c.kind, BODY_NAMES[id], html);
  }

  openGuide(section?: string): void {
    const bodies = `<div class="chiplist">${(['sun', ...PLANET_IDS.slice(0, 3), 'moon', ...PLANET_IDS.slice(3), 'pluto', 'belt', 'kuiper', 'halley', 'atlas'] as const)
      .map(id => `<button type="button" class="chip" data-body="${id}">${esc(BODY_NAMES[id])}</button>`).join('')}</div>`;
    const round = `<div class="chiplist">${ORBIT_IDS.map(id => `<button type="button" class="chip" data-body="${id}">${esc(BODY_NAMES[id])}</button>`).join('')}</div>`;
    const sections = GUIDE.map(s => `<details class="guide" id="guide-${s.id}"${s.id === (section ?? 'orbits') ? ' open' : ''}>
        <summary><h3>${esc(s.title)}</h3></summary>
        ${s.intro ? `<p>${esc(s.intro)}</p>` : ''}
        ${s.items.map(i => `<p><b>${esc(i.title)}.</b> ${esc(i.text)}</p>`).join('')}
      </details>`).join('');
    const keys = `<details class="guide"><summary><h3>Keys and gestures</h3></summary>
        <p>Drag to pan, scroll or pinch to zoom, tap a planet for its card, double-tap to fly in and follow it. While a journey plays, its bar replaces the controls; Esc or × ends it.</p>
        <dl class="keys">${KEYS.map(([k, v]) => `<div><dt><kbd>${esc(k)}</kbd></dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
      </details>`;
    const sourcesIntro = `<p class="guide-links"><button type="button" class="link" data-act="tour">${esc(t('tour.start'))}</button><button type="button" class="link" data-act="welcome">Show the welcome tips again</button></p>`;
    const sources = `<details class="guide"><summary><h3>Sources</h3></summary>
        <p>Figures come from NASA, ESA and JPL; each is rounded, "~" marks approximations, and counts that keep changing (moons, satellites) carry their date.</p>
        <ul class="sources">${SOURCES.map(s => `<li><a href="${esc(s.href)}" target="_blank" rel="noopener">${esc(s.label)}</a></li>`).join('')}</ul>
        <p class="small">The drawings are hand-sketch, deterministic Canvas 2D scenes drawn live in your browser. <a href="../">See the recorded pieces</a>.</p>
      </details>`;
    this.show({ kind: 'guide' }, 'Guide', 'The solar system', `<p class="intro">Tap any body for its card:</p>${bodies}<p class="intro">And round the Earth (the Earth and Moon view):</p>${round}${sections}${keys}${sources}${sourcesIntro}`);
  }

  /**
   * You: this moment to share or keep as a picture, and your own years from your birthday: flown in motion, your age on
   * every planet, and how far you have travelled through space, measured four ways.
   */
  openYou(): void {
    const bday = stored(BIRTHDAY_KEY) ?? '', lat = Number(stored(LATITUDE_KEY) ?? 0);
    const options = LATITUDES.map(([v, label]) => `<option value="${v}"${v === lat ? ' selected' : ''}>${esc(label)}</option>`).join('');
    const html = `<section class="this-moment" aria-labelledby="moment-h">
        <h3 id="moment-h">This moment</h3>
        <p class="moment-line" data-live="moment"></p>
        <div class="card-actions">${SHARE_ACTS}</div>
        <div data-live="share-link"></div>
        <p class="small share-note">The link opens paused on this moment, in this view and style; the picture is drawn afresh at twice the size of your screen${canRecord() ? ', and the clip records six seconds of the sky as it moves' : ''}.</p>
      </section>
      <h3>Your years</h3>
      <p class="lede">Enter your birthday to fly your years in motion, and see your age on every planet and how far you have come.</p>
      <div class="bday">
        <label>Your birthday<input type="date" id="bday-in" min="${BIRTHDAY_MIN}" max="${isoDate(today())}" value="${esc(bday)}"></label>
        <label>Where you have mostly lived<select id="lat-in">${options}</select></label>
      </div>
      <div data-live="travel"></div>
      <details class="guide"><summary><h3>Why the distances don’t add up</h3></summary>
      <p>Speed only means something against a reference, and each figure above uses a different one. The motions also point in different directions, so they never simply add: your ~${Math.round(CMB_KM_S)} km/s against the microwave background already includes the Sun’s ~${GALAXY_KM_S} km/s round the galaxy, Earth’s ~${ORBIT_KM_S} km/s round the Sun and the Milky Way’s own drift. Against the chair you are sitting in, you have hardly moved at all.</p>
      <ul class="fun">
        <li><b>Spin</b>: a point on the equator circles Earth’s axis once a sidereal day (23 h 56 min), 40,075 km at ~1,674 km/h; nearer the poles the circle, and the speed, shrink with the cosine of the latitude (~71% at 45°).</li>
        <li><b>Round the Sun</b>: Earth averages 29.78 km/s, ~940 million km a lap, a little faster in January (closest) than in July.</li>
        <li><b>Round the Milky Way</b>: the Sun circles the galaxy’s centre at ~230 km/s (estimates run from ~220 to ~250), one lap every ~230 million years.</li>
        <li><b>Through the cosmos</b>: against the cosmic microwave background, the afterglow of the Big Bang, the Solar System moves at ~370 km/s towards the constellations Leo and Crater (Planck 2018: 369.8 km/s).</li>
      </ul>
      </details>
      <p class="small">Figures: NASA’s planetary and Earth fact sheets, WGS 84, Reid et al. 2019 and the Planck 2018 results; see Sources in the guide. Your birthday stays in this browser.</p>`;
    this.show({ kind: 'you' }, 'You', 'Your sky', html);
    this.travelOpenedAt = Date.now();
    this.renderTravel();
    this.travelTimer = window.setInterval(() => this.tickTravel(), 1000);
  }

  /** The link, shown to copy by hand where the clipboard was refused. */
  showLink(url: string): void {
    const box = this.body.querySelector('[data-live="share-link"]');
    if (!box) return;
    box.innerHTML = `<label class="share-link">Copy this link<input type="text" readonly value="${esc(url)}"></label>`;
    const input = box.querySelector('input')!;
    input.focus();
    input.select();
  }

  /**
   * Your life's helix, flown: every coil behind the Earth a year of your life, and your age on every planet. Where
   * `play` is false it is shown as flown (a shared link).
   */
  flyLife(life: Life, to: number, play = true): void {
    // the journey on screen (a life flown before, perhaps) leaves first, putting its own things away
    this.hooks.endJourney();
    this.clearPreset();
    this.close();
    this.life = { life, to };
    this.app.showLife(life, to);
    const pace = clamp((to - life.born) / LIFE_FLIGHT_S, MONTH, PACE_MAX);
    this.hooks.startJourney({
      from: life.born, to, pace, label: 'Your years so far', clear: true,
      arrive: () => this.openLife(),
      leave: () => {
        this.life = null;
        this.app.endLife();
        if (this.mode?.kind === 'life') this.close();
      },
    }, play);
  }

  /** The card a life's flight lands on: your years in coils, and your age on every planet. */
  openLife(): void {
    const l = this.life;
    if (!l) return;
    const days = l.to - l.life.born, ages = planetAges(days), [mercury, , earth, mars] = ages, years = Math.floor(earth!.age);
    const galaxy = travelled(days * 86_400).frames.find(f => f.id === 'galaxy')!;
    const html = `<p class="intro">You are <b>${ageLabel(earth!.age)}</b> on Earth, <b>${ageLabel(mars!.age)}</b> on Mars and <b>${ageLabel(mercury!.age)}</b> on Mercury.</p>
      ${agesHtml(days, l.life.born)}
      <p>Since you were born, ${esc(outerLaps(ages))}.</p>
      <div class="card-actions">
        <button type="button" class="act primary" data-act="life-again"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l12.5-7.5z"/></svg>Fly again</button>
        ${SHARE_ACTS}
      </div>
      <div data-live="share-link"></div>
      <p>Every coil behind the Earth is a year of your life, ${years} of them since ${esc(dateLong(l.life.born))}, each birthday ticked in gold. All the while the Sun carried you ~${esc(distance(galaxy.km))} round the galaxy.</p>
      <p class="small">Your age on a planet is the laps it has made round the Sun since you were born: your days divided by its sidereal year (NASA planetary fact sheets).</p>`;
    this.show({ kind: 'life' }, 'Your years', 'Your life’s helix', html);
    // the helix alone, framed in the room the card leaves
    const f = lifeFrame(l.life, l.to, this.app.sim.trails.span, false);
    this.app.frameDesign(f.radius, f.at);
  }

  /** The viewer's birthday as a day count (noon of that date), or null when none is set, it lies ahead or before 1900. */
  private birthday(): number | null {
    const v = this.body.querySelector<HTMLInputElement>('#bday-in')?.value ?? '', day = parseIsoDate(v);
    return day !== null && !isFuture(v) && v >= BIRTHDAY_MIN ? day : null;
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
    const t = travelled(Panel.secondsSince(input.value), lat), ages = planetAges(t.days);
    box.innerHTML = `<div class="card-actions">
        <button type="button" class="act primary" data-act="life"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l12.5-7.5z"/></svg>Fly your years</button>
        <button type="button" class="act" data-act="birth-sky">The sky on your birthday</button>
      </div>
      <p class="small fly-note">Flies your life in motion: the Earth’s wake drawn back to the day you were born, a coil a year.</p>
      <h3>Your age on every planet</h3>
      ${agesHtml(t.days, day)}
      <p>Since you were born, ${esc(outerLaps(ages))}.</p>
      <h3>How far you have travelled</h3>
      <p class="age">${ageLine(t.days, t.laps)}</p>
      <ul class="frames">${t.frames.map(f => `<li><div class="f-head"><span class="f-title">${esc(f.title)}</span><span class="f-speed">~${esc(speed(f.speed))}${f.id === 'spin' ? (lat ? ` at ~${lat}°` : ' at the equator') : ''}</span></div>
        <span class="f-km">~${esc(distance(f.km))}</span><span class="f-note">${esc(f.compare)} · measured against ${esc(f.against)}</span></li>`).join('')}</ul>
      <p class="ticker">Since you opened this card: <b data-live="since">0 km</b> round the Sun, <b data-live="since-cmb">0 km</b> through the cosmos.</p>`;
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
    } else if (t.id === 'sky-lat-in') {
      store(SKY_LAT_KEY, (t as HTMLSelectElement).value);
      this.tick(true);
    }
  }

  openJump(): void {
    const groups = momentGroups(this.app.view === 'earth'), last = this.lastMoment;
    this.order = groups.flatMap(([, ps]) => ps.map(p => p.id));
    const html = groups.map(([g, ps]) => `<h3 class="group">${esc(g)}</h3><ul class="presets">${ps.map(p => presetItem(p, p.id === last)).join('')}</ul>`).join('');
    const tour = `<button type="button" class="tour-card" data-act="tour"><span class="tc-play" aria-hidden="true">${PLAY_ICON}</span><span class="tc-text"><b>${esc(t('tour.start'))}</b><small>${esc(t('tour.lede'))}</small></span></button>`;
    this.show({ kind: 'jump' }, 'Moments', 'Key moments', `${tour}<p class="intro">Or set the sky to a real moment and see why it matters: in space round the Earth, or out among the planets.</p>${html}`);
    // back where the list was left, with the moment last seen in sight
    this.body.scrollTop = this.jumpScroll;
    const mark = this.body.querySelector<HTMLElement>('.preset.last');
    if (mark) {
      const b = this.body.getBoundingClientRect(), m = mark.getBoundingClientRect();
      if (m.top < b.top || m.bottom > b.bottom) this.body.scrollTop += m.top - b.top - (b.height - m.height) / 2;
    }
  }

  /** Remember how far the Moments list is scrolled, as it is left. */
  private keepJumpScroll(): void {
    if (this.mode?.kind === 'jump' && !this.el.hidden) this.jumpScroll = this.body.scrollTop;
  }

  /** The moments previous and next step through: the Moments list's order as last shown, or as it would be now. */
  private get moments(): readonly string[] {
    return (this.order ??= momentGroups(this.app.view === 'earth').flatMap(([, ps]) => ps.map(p => p.id)));
  }

  /**
   * Show the moment before or after the one on show, in the Moments list's order (round from the last to the first):
   * with its card while the Moments menu is open (its card or its list), without while the panel is closed.
   */
  stepMoment(dir: 1 | -1): boolean {
    const order = this.moments, at = this.preset ? order.indexOf(this.preset) : -1;
    if (at < 0) return false;
    const id = order[(at + dir + order.length) % order.length]!;
    if (this.menu === 'moments') this.openPreset(id);
    else {
      const p = presetById(id);
      if (p) this.apply(p);
    }
    this.app.onChange();
    return true;
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
        ${p.related ? `<button type="button" class="act" data-preset="${p.related.id}">${esc(p.related.label)}</button>` : ''}
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

  /** Set the sky to a moment without opening its card (the guided tour's stops). */
  setMoment(id: string): void {
    const p = presetById(id);
    if (!p) return;
    this.close();
    this.apply(p);
  }

  /** Set the sky to a preset's moment: paused there, framed, with its geometry. */
  private apply(p: Preset): void {
    const app = this.app;
    // the order to step through is the list's as it stands in the view the moment is picked from
    void this.moments;
    this.preset = p.id;
    app.overlay = p.overlay ? (ctx, a) => p.overlay!(ctx, a) : null;
    app.play(false);
    app.setDirection(1);
    app.jump(p.day());
    if (p.view) app.setView(p.view);
    if (p.pace) app.setPace(p.pace);
    const target = p.focus?.body ?? p.select ?? null;
    app.select(target, false);
    if (p.focus) app.focusSelected(p.focus.zoom);
    else if (p.frame && 'box' in p.frame) app.frameBox(p.frame.box(), undefined, p.frame.wide);
    else if (p.frame) app.frameDesign(p.frame.fit, typeof p.frame.at === 'function' ? p.frame.at() : p.frame.at ?? [540, 540]);
    // home, fitted into the room the card leaves
    else app.resetView();
    this.lastMoment = p.id;
    this.pillText.textContent = p.title;
    const order = this.moments, at = order.indexOf(p.id);
    this.pillCount.textContent = at < 0 ? '' : `${at + 1} / ${order.length}`;
    this.pillCount.setAttribute('aria-label', at < 0 ? '' : t('moment.of', { n: at + 1, of: order.length }));
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
    this.keepJumpScroll();
    this.el.hidden = true;
    if (hadFocus) {
      const back = this.returnFocus;
      if (back?.isConnected && back.offsetParent !== null) back.focus({ preventScroll: true });
      else (document.activeElement as HTMLElement | null)?.blur();
    }
    this.returnFocus = null;
    this.mode = null;
    clearInterval(this.travelTimer);
    if (this.look.parentElement === this.body) this.lookHome.append(this.look);
    document.body.classList.remove('panel-open');
    this.markMenus(null);
    this.app.reframe();
    this.app.invalidate();
    return true;
  }

  /* ---------- keeping up ---------- */

  /** Keep the open card in step with the app (the selected body may change under it). */
  refresh(): void {
    const m = this.mode;
    if (m?.kind === 'body' && this.app.selected && this.app.selected !== m.id) this.openBody(this.app.selected);
    const follow = this.body.querySelector<HTMLButtonElement>('[data-act="follow"]');
    follow?.setAttribute('aria-pressed', String(this.app.following));
    for (const b of this.body.querySelectorAll<HTMLButtonElement>('[data-layer]')) b.setAttribute('aria-pressed', String(this.app.layers[b.dataset.layer as keyof App['layers']]));
    this.drawFigures();
    this.tick(true);
  }

  /** Update the live figures (a few times a second while the date runs). */
  tick(force = false): void {
    const m = this.mode;
    if (m?.kind === 'you') {
      const line = this.body.querySelector('[data-live="moment"]'), app = this.app;
      const text = `${dateLabel(app.sim.day)} · ${VIEW_WORDS[app.view]} · ${app.style.title}`;
      if (line && line.textContent !== text) line.textContent = text;
      return;
    }
    if (m?.kind === 'sky') {
      const now = performance.now();
      if (!force && now - this.liveAt < 250) return;
      this.liveAt = now;
      const day = this.app.sim.day;
      this.live('sky-date', dateLong(day), true);
      this.live('tonight', tonightHtml(day));
      this.live('moon', moonHtml(day));
      this.live('seasons', seasonsHtml(day, this.skyLatitude()));
      return;
    }
    if (m?.kind !== 'body' || m.id === 'belt' || m.id === 'kuiper') return;
    const now = performance.now();
    if (!force && now - this.liveAt < 250) return;
    this.liveAt = now;
    const day = this.app.sim.day, date = this.body.querySelector('[data-live="date"]'), box = this.body.querySelector('[data-live="facts"]');
    if (!date || !box) return;
    date.textContent = dateLong(day);
    box.innerHTML = facts(liveFacts(m.id, day), true);
  }

  /** Put markup (or `plain` text) in a live box of the open card, only when it has changed (a list stays still under a finger). */
  private live(key: string, content: string, plain = false): void {
    const box = this.body.querySelector<HTMLElement>(`[data-live="${key}"]`);
    if (!box || box.dataset.shown === content) return;
    box.dataset.shown = content;
    if (plain) box.textContent = content;
    else box.innerHTML = content;
  }

  private onClick(e: Event): void {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-act], [data-body], [data-preset]');
    if (!el) return;
    const app = this.app;
    if (el.dataset.body) {
      const id = el.dataset.body as NonNullable<Selection>;
      // what flies round the Earth is only drawn up close; the comets only from above
      if (EARTH_ONLY.has(id) && app.view !== 'earth') app.setView('earth');
      if (COMET_IDS.has(id)) {
        if (!app.layers.comets) app.setLayer('comets', true);
        if (app.view !== 'sky') app.setView('sky');
      }
      if (DWARFS.has(id)) {
        if (!app.layers.dwarfs) app.setLayer('dwarfs', true);
        if (app.view !== 'sky') app.setView('sky');
      }
      app.select(id);
      this.openBody(id);
      if (RING_IDS.has(id)) app.frameDesign(ringFit(id as RingId), [540, 540]);
      else if (EARTH_ONLY.has(id)) app.focusSelected();
      // Pluto, out at the page's edge, is brought into the clear; a comet's whole path and the belt reach out past Neptune
      else if (id === 'pluto') app.focusSelected(2.5);
      else if (COMET_IDS.has(id) || DWARFS.has(id)) app.resetView();
    } else if (el.dataset.preset) this.openPreset(el.dataset.preset);
    else if (el.dataset.act === 'layer' && el.dataset.layer) {
      const layer = el.dataset.layer as keyof App['layers'], on = !app.layers[layer];
      app.setLayer(layer, on);
      // the layers are drawn from above: switching one on there shows it
      if (on && app.view !== 'sky') app.setView('sky');
      if (on && layer === 'tonight' && !app.atHome) app.resetView();
      this.hooks.toast(LAYER_TOAST[layer][on ? 1 : 0]);
    } else if (el.dataset.act === 'tonight') {
      // tonight: the sky as it stands now, held still
      this.clearPreset();
      app.play(false);
      app.jump(today());
    }
    else if (el.dataset.act === 'zoom') app.focusSelected(Math.max(4, app.camera.zoom * 2));
    else if (el.dataset.act === 'follow') {
      if (app.following) app.select(app.selected, false);
      else app.focusSelected(Math.max(2.5, app.camera.zoom));
    } else if (el.dataset.act === 'journey' && this.preset) {
      const j = presetById(this.preset)?.journey?.();
      if (j) this.hooks.startJourney(j);
    } else if (el.dataset.act === 'life') {
      // the Sun carrying you through space reads best in motion, from the day you were born to today
      const iso = this.body.querySelector<HTMLInputElement>('#bday-in')?.value ?? '', life = this.birthday() === null ? null : lifeOf(iso, today());
      if (life) this.flyLife(life, today());
    } else if (el.dataset.act === 'life-again' && this.life) {
      this.flyLife(this.life.life, this.life.to);
    } else if (el.dataset.act === 'share') {
      this.hooks.share();
    } else if (el.dataset.act === 'save') {
      this.hooks.savePicture();
    } else if (el.dataset.act === 'clip') {
      this.hooks.recordClip();
    } else if (el.dataset.act === 'tour') {
      this.hooks.startTour();
    } else if (el.dataset.act === 'view-wake') {
      app.setView('wake');
    } else if (el.dataset.act === 'birth-sky') {
      const day = this.birthday();
      if (day === null) return;
      this.clearPreset();
      app.play(false);
      app.jump(day);
      if (!app.atHome) app.resetView();
      this.hooks.toast(`The sky on ${dateLong(day)}`);
    } else if (el.dataset.act === 'earth-view') {
      const id = this.mode?.kind === 'body' ? this.mode.id : 'earth';
      app.setView('earth');
      app.select(id, false);
      this.openBody(id);
    } else if (el.dataset.act === 'frame-ring' && this.mode?.kind === 'body') {
      app.frameDesign(ringFit(this.mode.id as RingId), [540, 540]);
    } else if (el.dataset.act === 'welcome') {
      this.close();
      this.hooks.showWelcome();
    } else if (el.dataset.act === 'moment' && this.preset) {
      const p = presetById(this.preset);
      if (p) this.apply(p);
    } else if (el.dataset.act === 'list') this.openJump();
  }
}

/** Design radius to frame an orbit's height by (the ring and a little room round it). */
function ringFit(id: RingId): number {
  const alt = { leo: 2000, gps: 20180, geo: 35786, starlink: 480 }[id];
  return ((6378 + alt) / (384400 / 440)) * 1.12;
}

/** "3 years, 41 days": how long since a day count. */
function since(from: number, day: number): string {
  const d = Math.floor(day - from), y = Math.floor(d / 365.25), rest = Math.floor(d - y * 365.25);
  return y ? `${y} year${y === 1 ? '' : 's'}, ${rest} day${rest === 1 ? '' : 's'}` : `${d} day${d === 1 ? '' : 's'}`;
}

/** Figures for the date on screen. */
function liveFacts(id: BodyId, day: number): { label: string; value: string }[] {
  const craft = trackedById(id);
  if (craft) {
    const flyingNow = day >= craft.from && (craft.to === undefined || day < craft.to);
    if (!flyingNow) return [{ label: 'In orbit', value: day < craft.from ? 'not yet launched' : 'no longer: it has come down' }];
    const o = craft.orbit, sh = shape(o), alt = (o.peri + o.apo) / 2;
    return [
      { label: 'In orbit for', value: since(craft.from, day) },
      { label: 'Laps a day', value: `~${(1 / sh.period).toFixed(1)}` },
      { label: 'Speed', value: `~${circularSpeed(alt).toFixed(2)} km/s` },
    ];
  }
  if (COMET_IDS.has(id)) {
    const c = COMETS[id as CometId], place = cometAt(c, day), e = xyzOf('earth', day);
    const fromEarth = Math.hypot(place.xyz[0] - e[0], place.xyz[1] - e[1], place.xyz[2] - e[2]) * AU_KM;
    const peri = c.period ? c.perihelia.find(t => t > day) : c.perihelia[0];
    const rows = [
      { label: 'From the Sun', value: `${place.r.toFixed(place.r < 2 ? 2 : 1)} au (${km(place.r * AU_KM)})` },
      { label: 'From Earth', value: km(fromEarth) },
      { label: 'Speed', value: `~${place.speed.toFixed(place.speed < 10 ? 1 : 0)} km/s round the Sun` },
    ];
    if (peri !== undefined) rows.push({ label: peri > day ? 'Next round the Sun' : 'Round the Sun', value: `${dateLong(peri, true)}${peri > day ? ` (in ${since(day, peri)})` : ` (${since(peri, day)} ago)`}` });
    return rows;
  }
  if (id === 'moon') {
    const p = moonPhase(day), d = moonDistance(day);
    return [
      { label: 'Phase', value: `${p.name}, ${Math.round(p.lit * 100)}% lit` },
      { label: 'From Earth', value: `${km(d)} (centre to centre)` },
      { label: 'Light to Earth', value: `${(d / 299_792.458).toFixed(2)} s` },
      { label: 'Earths in between', value: `~${(d / (2 * EARTH_R)).toFixed(1)} side by side` },
    ];
  }
  if (id === 'sun') {
    const d = fromSunAu('earth', day) * AU_KM;
    return [{ label: 'From Earth', value: km(d) }, { label: 'Sunlight takes', value: lightTime(d) }];
  }
  if (id === 'earth') {
    const au = fromSunAu('earth', day);
    return [{ label: 'From the Sun', value: `${km(au * AU_KM)} (${au.toFixed(3)} au)` }, { label: 'Sunlight takes', value: lightTime(au * AU_KM) }];
  }
  const name = id as PlanetName | 'pluto', d = fromEarthKm(name, day), au = fromSunAu(name, day);
  return [
    { label: 'From Earth', value: km(d) },
    { label: 'Its light takes', value: lightTime(d) },
    { label: 'From the Sun', value: `${au.toFixed(au < 2 ? 3 : 2)} au` },
  ];
}


/**
 * The moments as the Moments list shows them, by group: "now and next" read by the calendar (what is still ahead, and
 * what has just passed), and the moments of the view on show first.
 */
function momentGroups(earthFirst: boolean): [string, Preset[]][] {
  const now = today(), groups = new Map<string, Preset[]>();
  const ordered = [...PRESETS].sort((a, b) => Number((a.view === 'earth') !== earthFirst) - Number((b.view === 'earth') !== earthFirst));
  for (const p of ordered) {
    const g = p.group === 'Now and next' ? (p.day() >= now ? 'Coming up' : 'Recent milestones') : p.group;
    groups.set(g, [...(groups.get(g) ?? []), p]);
  }
  return [...groups];
}

/** A moment in a list: its title, date and one line (and a mark on the one last seen). */
const presetItem = (p: Preset, last = false): string => `<li><button type="button" class="preset${last ? ' last' : ''}" data-preset="${p.id}"${last ? ' aria-current="true"' : ''}>
    <span class="p-title">${esc(p.title)}${last ? `<span class="p-last">${esc(t('moment.last'))}</span>` : ''}</span><span class="p-when">${esc(dateLong(p.day(), true))}</span><span class="p-kicker">${esc(p.kicker)}</span>
  </button></li>`;

/** The mark on the Sky sheet's switches that draw over the plan. */
const LAYER_ICON = '<svg class="line" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="2.4"/><path d="M12 3.5v3M12 17.5v3M3.5 12h3M17.5 12h3"/></svg>';

/** What each switch says as it goes off and on. */
const LAYER_TOAST: Readonly<Record<keyof App['layers'], readonly [string, string]>> = {
  tonight: ['Sight-lines off.', 'From the Earth: gold lines to the evening sky, blue to the morning sky.'],
  seasons: ['Seasons off.', 'The Earth’s axis always leans the same way: towards the Sun in June, away in December.'],
  comets: ['Comets hidden.', 'Comets shown on the plan, from above.'],
  dwarfs: ['Pluto and the Kuiper belt hidden.', 'Pluto and the Kuiper belt shown on the plan, from above.'],
};

/** The ways to take a moment away with you: its link, a picture, and a short clip where the browser can record one. */
const SHARE_ACTS = `<button type="button" class="act" data-act="share"><svg class="line" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 14.5V3.8M7.8 8 12 3.8 16.2 8"/><path d="M5 11.5v8h14v-8"/></svg>Share this moment</button>
  <button type="button" class="act" data-act="save"><svg class="line" viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="14" rx="2"/><path d="m3.5 16 5-5 4 4 2.5-2.5 5.5 5.5"/><circle cx="15.5" cy="9.2" r="1.4"/></svg>Save a picture</button>
  ${canRecord() ? `<button type="button" class="act" data-act="clip"><svg class="line" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="6.5" width="13" height="11" rx="2"/><path d="m16 10.5 5-3v9l-5-3"/></svg>Record a clip</button>` : ''}`;

/** A play mark, for the tour and the journeys. */
const PLAY_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l12.5-7.5z"/></svg>';

/** Your age on each planet after `days`, with your next birthday there (from your birth, `born`). */
function agesHtml(days: number, born: number): string {
  const cells = planetAges(days).map(a => `<li class="age-${a.id}"><span class="a-name">${esc(a.name)}</span><span class="a-age">${esc(ageLabel(a.age))}</span><span class="a-next" title="Your next birthday on ${esc(a.name)}">${esc(dateLabel(born + a.next))}</span></li>`);
  return `<p class="ages-key">Your age on each planet, and your next birthday there</p><ul class="ages">${cells.join('')}</ul>`;
}
