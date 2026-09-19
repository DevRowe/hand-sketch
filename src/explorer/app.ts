/**
 * The explorer itself: the simulation, the view camera and the renderer tied together, with the choices the viewer
 * makes (view, style, selection, names, trail lengths) and the animation loop that draws.
 *
 * Drawing follows the hand-drawn cadence: twelve drawings a second ("on twos") at gentle paces, rising to thirty as
 * the pace quickens so a fast planet still moves in readable steps. Camera moves and controls draw at no more than
 * `HAND_FPS`, and while paused it draws only when something changes (a control, the camera, the trails easing), so an
 * idle page costs nothing. Animation frames that draw nothing sharpen the zoomed paper textures a slice at a time.
 */
import { toFrames } from '../core/scene';
import type { View } from '../core/stage';
import { C as EARTH_C } from '../scenes/cislunar/common';
import type { Sky } from '../scenes/solar/sky';
import { sceneMarks, pick, type BodyId, type Mark, type Pick, type Scene as Marks, type ViewId } from './bodies';
import { drawDwarfs, dwarfMarks } from './beyond';
import { Camera } from './camera';
import { cometMarks, drawComets, type CometId } from './comets';
import { LabelLayout, type Box } from './labels';
import { drawLife, lifeFrame, type Life } from './life';
import { drawNeighbourhood } from './neighbourhood';
import { Renderer, type Size } from './renderer';
import { drawSeasons } from './seasons';
import { drawSoundLine } from './sound';
import { clamp, Sim } from './sim';
import { STYLES, type Style } from './styles';
import { drawTonight } from './tonight';
import { VIEWS } from './views';

export type Selection = BodyId | 'belt' | null;

export const BODY_NAMES: Readonly<Record<BodyId | 'belt', string>> = {
  sun: 'Sun', mercury: 'Mercury', venus: 'Venus', earth: 'Earth', moon: 'Moon', mars: 'Mars',
  jupiter: 'Jupiter', saturn: 'Saturn', uranus: 'Uranus', neptune: 'Neptune', belt: 'Asteroid belt',
  iss: 'ISS', tiangong: 'Tiangong', hubble: 'Hubble', mir: 'Mir', skylab: 'Skylab', salyut: 'Salyut 1', sputnik: 'Sputnik 1',
  leo: 'Low Earth orbit', gps: 'GPS · medium orbit', geo: 'Geostationary belt', starlink: 'Starlink',
  halley: 'Halley’s Comet', atlas: '3I/ATLAS', pluto: 'Pluto', kuiper: 'Kuiper belt',
};

/** Where the controls offer a view of the Earth and the Moon up close (their cards, the Earth's double-tap). */
export const NEIGHBOURS: ReadonlySet<BodyId | 'belt'> = new Set(['earth', 'moon']);

/** The draw-on has played. */
const DONE = 1e9;

/** Whose name wins when two would overlap. */
const RANK: readonly BodyId[] = [
  'sun', 'earth', 'jupiter', 'saturn', 'mars', 'venus', 'uranus', 'neptune', 'mercury', 'moon', 'halley', 'atlas', 'pluto',
  'iss', 'tiangong', 'hubble', 'mir', 'skylab', 'salyut', 'sputnik', 'geo', 'gps', 'leo', 'starlink', 'kuiper',
];

/** Most degrees the quickest motion on show may move between drawings before the cadence rises. */
const STEP_DEG = 8;
/** The cadence tops out at film rate: past it a faster planet only blurs, and resolution and battery matter more. */
const MAX_FPS = 30;
/** Most drawings a second for camera moves, drags and controls (the eye wants them quicker than twelve). */
const HAND_FPS = 30;
/** Milliseconds an animation frame that draws nothing may spend sharpening zoomed textures. */
const REFINE_MS = 6;
/** Ms the picture must rest before it is drawn again at full resolution. */
const REST_MS = 350;
/** CSS pixels kept clear round it, and round a framed moment (whose marks carry names outside the circle). */
const HOME_MARGIN = 10;
const FRAME_MARGIN = 16;
/** On a compact screen home may zoom in this far to fill the room; within `HOME_SNAP` of 1 it rests on the whole page. */
const HOME_ZOOM_MAX = 1.6;
const HOME_SNAP = 0.07;
/** Screens where the controls take a large share of the room: home is fitted to it (elsewhere the page fills the screen). */
const COMPACT = matchMedia('(max-width: 980px), (max-height: 540px)');

/** A box in design units: [x0, y0, x1, y1]. */
export type DesignBox = readonly [number, number, number, number];

/** Trails are drawn at a light touch to start with (their lengths are each view's own: `views.ts`). */
export const DEFAULT_OPACITY = 0.6;
/**
 * Zooming on past the deepest zoom of a plan with the Earth near the pointer dives into the Earth and Moon view, and
 * zooming out past its widest climbs back out: once the push past the limit adds up to this factor.
 */
const DIVE_PUSH = 1.4;
/** Pixels from the Earth's centre on screen a dive may start. */
const DIVE_REACH = 90;
/** Seconds the view crossing takes on screen. */
const DIVE_S = 0.75;
/** The zoom the plan starts from, on the Earth, when climbing out of the Earth and Moon view. */
const CLIMB_ZOOM = 12;
/** Zoom that shows each body of the Earth and Moon view whole when flown to: the stations need low orbit to open up. */
const FOCUS: Partial<Record<BodyId, number>> = { earth: 30, moon: 40, iss: 45, tiangong: 45, hubble: 40, mir: 45, skylab: 45, salyut: 45, sputnik: 30 };

/** Something drawn over the scene in design units (a transfer orbit, sight lines). */
export type Overlay = (ctx: CanvasRenderingContext2D, app: App) => void;

/**
 * What the menus draw over the From above view: the Sky menu's sight-lines from the Earth tonight, the seasons (the
 * axis, the solstices and equinoxes) and the comets (on by default); the Scale menu's dwarf planets beyond Neptune
 * (Pluto and the Kuiper belt, on by default).
 */
export interface Layers {
  tonight: boolean;
  seasons: boolean;
  comets: boolean;
  dwarfs: boolean;
}

export interface AppOptions {
  canvas: HTMLCanvasElement;
  labels: HTMLElement;
  sim: Sim;
  view: ViewId;
  style: Style;
  /** Skip the draw-on (reduced motion, or a shared link straight to a moment). */
  skipIntro: boolean;
}

export class App {
  readonly sim: Sim;
  readonly renderer: Renderer;
  camera: Camera;
  view: ViewId;
  style: Style;
  selected: Selection = null;
  /** Keep the selected body centred as it moves. */
  following = false;
  names = true;
  /** Camera moves jump instead of gliding (reduced motion). */
  reducedMotion = false;
  /** Each view keeps its own trail length: short sweeps read best from above, long wakes in motion. */
  readonly spans: Record<ViewId, number> = { sky: VIEWS.sky.span.start, wake: VIEWS.wake.span.start, earth: VIEWS.earth.span.start };
  /** The two plans share a pace; the Earth and Moon view keeps its own. */
  readonly paces: Record<'solar' | 'earth', number> = { solar: VIEWS.wake.pace.start, earth: VIEWS.earth.pace.start };
  /** The plan the Earth and Moon view climbs back out to. */
  private plan: ViewId = 'wake';
  /** How far a zoom has pushed past the limit, towards a view crossing, and when it last pushed (ms). */
  private push = { factor: 1, at: 0 };
  /** Extra drawing over the scene (the jump-to presets' geometry). */
  overlay: Overlay | null = null;
  /** The line the planets sound on, drawn over the From above view while the sound is on. */
  soundLine = false;
  /** The menus' layers over the From above view. */
  readonly layers: Layers = { tonight: false, seasons: false, comets: true, dwarfs: true };
  /** A journey under way stops (and pauses) on this day. */
  private stopAt: number | null = null;
  /** Your years, drawn in the In motion view while they are on screen (`flyLife`), and the wake length they replaced. */
  life: Life | null = null;
  private lifeSpan: number | null = null;
  /** The part of the screen the controls leave free (CSS pixels): framing centres things there. */
  freeRect: () => { x: number; y: number; w: number; h: number } = () => ({ x: 0, y: 0, w: innerWidth, h: innerHeight });
  /** The open card, where one is (CSS pixels): the bodies it covers are not named through it. */
  cardRect: () => DOMRect | null = () => null;
  /** Called after every drawing (readouts) and on every state change (controls). */
  onDraw: () => void = () => {};
  onChange: () => void = () => {};

  /** Drawn frames into the scene's draw-on; `DONE` once it has played (on load or Reset), so a new style starts whole. */
  private intro: number;
  private dirty = true;
  /** The camera rests on (or glides to) the home view. */
  private homed = true;
  /** The design box the camera was last framed on (a moment's geometry), until the viewer moves it. */
  private framed: DesignBox | null = null;
  private lastDraw = -1e9;
  /** When the sky, the camera and the trails last moved (ms). */
  private stillSince = 0;
  /** The interval the last drawing was meant to keep (for the resolution governor). */
  private drawInterval = 1000 / 12;
  private last = 0;
  private marks: Marks | null = null;
  private readonly labelEls = new Map<BodyId, HTMLElement>();
  /** Each name's width on screen, measured once. */
  private readonly labelWidth = new Map<BodyId, number>();
  private readonly labelLayout = new LabelLayout();
  /** A name is waiting to fade in or out: place them again even if nothing is drawn. */
  private labelsPending = false;
  /** Where the overlays set captions in the last drawing (CSS pixels): the names give way to them. */
  captions: Box[] = [];

  constructor(private readonly o: AppOptions) {
    this.sim = o.sim;
    this.view = o.view;
    this.style = o.style;
    this.renderer = new Renderer(o.canvas);
    this.renderer.setHeavy(o.style.heavy);
    const { w, h } = this.renderer.logical;
    this.camera = new Camera(w, h);
    this.camera.min = VIEWS[o.view].zoomMin;
    this.camera.max = VIEWS[o.view].zoomMax;
    if (o.view !== 'earth') this.plan = o.view;
    o.sim.pace = clamp(o.sim.pace, VIEWS[o.view].pace.min, VIEWS[o.view].pace.max);
    this.paces[VIEWS[o.view].family] = o.sim.pace;
    this.intro = o.skipIntro ? DONE : 0;
    this.sim.trails.span = this.spans[this.view];
    // names are measured once, in the page's own font once it has loaded
    void document.fonts?.ready.then(() => {
      this.labelWidth.clear();
      this.dirty = true;
    });
    for (const id of Object.keys(BODY_NAMES) as (BodyId | 'belt')[]) {
      if (id === 'belt') continue;
      const el = document.createElement('span');
      el.className = `label ${id}`;
      el.textContent = BODY_NAMES[id];
      o.labels.append(el);
      this.labelEls.set(id, el);
    }
  }

  get scene() { return this.style.scenes[this.view]; }

  /** What the current view needs of the controls. */
  get spec() { return VIEWS[this.view]; }

  /** Seconds a camera move eases over. */
  private get glide(): number { return this.reducedMotion ? 0 : 0.7; }

  /** Mark the picture stale: it redraws on the next frame. */
  invalidate(): void { this.dirty = true; }

  private changed(): void {
    this.dirty = true;
    this.onChange();
  }

  /* ---------- choices ---------- */

  /**
   * Show another view. Between the two plans the camera glides to the new one's home; into or out of the Earth and Moon
   * view it dives (or climbs) through the Earth: the old picture swells (or shrinks) into it and fades while the new one
   * settles, and the pace and trails change to the new view's own.
   */
  setView(view: ViewId): void {
    if (view === this.view) return;
    const from = this.view, crossing = VIEWS[from].family !== VIEWS[view].family;
    const anchor = crossing ? this.earthOnScreen() : null;
    this.spans[from] = this.sim.trails.span;
    this.paces[VIEWS[from].family] = this.sim.pace;
    this.view = view;
    if (view !== 'earth') this.plan = view;
    this.sim.trails.span = this.spans[view];
    this.sim.trails.reveal = 0;
    this.labelLayout.reset();
    this.camera.min = VIEWS[view].zoomMin;
    this.camera.max = VIEWS[view].zoomMax;
    this.syncRoom(0);
    this.push = { factor: 1, at: 0 };
    if (!crossing) {
      // home differs by view: glide to the new one's
      if (this.homed) this.camera.glideTo(this.homeView(), this.glide);
      this.changed();
      return;
    }
    this.sim.pace = clamp(this.paces[VIEWS[view].family], VIEWS[view].pace.min, VIEWS[view].pace.max);
    // a body the new view does not show is let go (the Earth and the Moon are in all three)
    if (this.selected && !this.marksAt(view, this.sim.sky(), 1).bodies.some(b => b.id === this.selected)) this.selected = null;
    this.following = false;
    this.framed = null;
    this.homed = true;
    const diving = view === 'earth';
    if (diving) this.camera.glideTo(this.homeView(), 0);
    else {
      // climbing out: start close on the Earth in the plan and pull back to its home
      const m = this.markOf('earth', true), home = this.homeView();
      if (m && !this.reducedMotion) {
        const [lx, ly] = this.renderer.designToLogical(m.x, m.y);
        this.camera.glideTo({ zoom: CLIMB_ZOOM, ...this.centreAt(lx, ly, CLIMB_ZOOM) }, 0);
        this.camera.glideTo(home, DIVE_S * 1.4);
      } else this.camera.glideTo(home, 0);
    }
    if (anchor && !this.reducedMotion) this.renderer.cross(anchor, this.earthOnScreen(), diving ? 3 : 0.3, DIVE_S);
    this.changed();
  }

  /** The Earth's centre on screen (CSS pixels) in the view as last drawn, or as it stands. */
  private earthOnScreen(): [number, number] {
    if (this.view === 'earth') return this.renderer.toScreen(EARTH_C[0], EARTH_C[1]);
    const m = this.markOf('earth', true);
    return m ? this.renderer.toScreen(m.x, m.y) : [innerWidth / 2, innerHeight / 2];
  }

  /** Whether zooming on in a plan would dive into the Earth and Moon view: the camera follows the Earth. */
  get canDive(): boolean { return this.view !== 'earth' && this.following && this.selected === 'earth'; }

  /** Dive into the Earth and Moon view, or climb back out to the plan it was entered from. */
  toggleEarth(): void {
    this.setView(this.view === 'earth' ? this.plan : 'earth');
  }

  setStyle(style: Style): void {
    if (style === this.style) return;
    this.style = style;
    this.renderer.setHeavy(style.heavy);
    this.changed();
  }

  nextStyle(step: number): void {
    const i = STYLES.indexOf(this.style);
    this.setStyle(STYLES[(i + step + STYLES.length) % STYLES.length]!);
  }

  select(id: Selection, follow = this.following): void {
    this.selected = id;
    this.following = id !== null && id !== 'belt' && follow;
    this.changed();
  }

  /** Switch one of the menus' layers on or off (a body selected goes with its layer). */
  setLayer(layer: keyof Layers, on: boolean): void {
    this.layers[layer] = on;
    if (layer === 'comets' && !on && (this.selected === 'halley' || this.selected === 'atlas')) this.select(null);
    if (layer === 'dwarfs' && !on && (this.selected === 'pluto' || this.selected === 'kuiper')) this.select(null);
    this.changed();
  }

  setNames(on: boolean): void {
    this.names = on;
    this.o.labels.classList.toggle('off', !on);
    this.changed();
  }

  play(on: boolean): void {
    this.sim.playing = on;
    this.changed();
  }

  setPace(pace: number): void {
    this.sim.pace = clamp(pace, this.spec.pace.min, this.spec.pace.max);
    this.paces[this.spec.family] = this.sim.pace;
    this.changed();
  }

  setDirection(dir: 1 | -1): void {
    this.sim.direction = dir;
    this.stopAt = null;
    this.changed();
  }

  jump(day: number): void {
    this.sim.jump(day);
    this.stopAt = null;
    this.changed();
  }

  /** Play forwards from `from` to `to` at `pace` days a second, then pause there. */
  journey(from: number, to: number, pace: number): void {
    this.sim.jump(from);
    this.sim.direction = 1;
    this.sim.pace = clamp(pace, this.spec.pace.min, this.spec.pace.max);
    this.sim.playing = true;
    this.stopAt = to;
    this.changed();
  }

  /** Whether a journey is under way. */
  get journeying(): boolean { return this.stopAt !== null; }

  /**
   * Your years in motion, up to `to`: the Earth's wake drawn back to the day you were born, one coil a year, the whole
   * life filling the wake's depth (a journey then flies it).
   */
  showLife(life: Life, to: number): void {
    if (!this.life) this.lifeSpan = this.view === 'wake' ? this.sim.trails.span : this.spans.wake;
    this.life = life;
    this.sim.life = life.born;
    this.setView('wake');
    this.select(null, false);
    this.setTrails(true);
    this.setSpan(clamp(to - life.born, VIEWS.wake.span.min, VIEWS.wake.span.max));
    // framed on the whole helix as it will stand at the end, so it never grows off the screen
    const f = lifeFrame(life, to, this.sim.trails.span, true);
    this.frameDesign(f.radius, f.at);
  }

  /** Put your years away: the wakes go back to the length they had. */
  endLife(): void {
    if (!this.life) return;
    this.life = null;
    this.sim.life = null;
    if (this.lifeSpan !== null) {
      this.spans.wake = this.lifeSpan;
      if (this.view === 'wake') this.sim.trails.span = this.lifeSpan;
    }
    this.lifeSpan = null;
    this.changed();
  }

  setTrails(on: boolean): void {
    this.sim.trails.on = on;
    this.changed();
  }

  setSpan(span: number): void {
    this.sim.trails.span = span;
    this.spans[this.view] = span;
    this.changed();
  }

  setOpacity(opacity: number): void {
    this.sim.trails.opacity = opacity;
    this.changed();
  }

  /** Draw the current scene on again from a blank page. */
  redrawIntro(): void {
    this.intro = 0;
    this.changed();
  }

  /* ---------- camera ---------- */

  /**
   * Zoom by `factor` about a point on screen (CSS pixels), or the centre. Pushing on past a plan's deepest zoom with
   * the Earth under the pointer dives into the Earth and Moon view; pushing out past that view's widest climbs back.
   */
  zoomBy(factor: number, x?: number, y?: number): void {
    const [lx, ly] = x === undefined || y === undefined ? [this.camera.x, this.camera.y] : this.renderer.toLogical(x, y);
    const atMax = this.camera.zoom >= this.camera.max - 1e-6, atMin = this.camera.zoom <= this.camera.min + 1e-6;
    const earthward = this.view !== 'earth' && factor > 1 && atMax, outward = this.view === 'earth' && factor < 1 && atMin;
    if (earthward || outward) {
      const now = performance.now();
      if (now - this.push.at > 600) this.push.factor = 1;
      this.push = { factor: this.push.factor * factor, at: now };
      const [ex, ey] = this.earthOnScreen(), px = x ?? innerWidth / 2, py = y ?? innerHeight / 2;
      const onEarth = this.canDive || Math.hypot(px - ex, py - ey) <= DIVE_REACH;
      if (earthward && this.push.factor >= DIVE_PUSH && onEarth) this.setView('earth');
      else if (outward && this.push.factor <= 1 / DIVE_PUSH) this.setView(this.plan);
      return;
    }
    this.camera.zoomAt(factor, lx, ly);
    this.homed = false;
    this.framed = null;
    if (this.camera.zoom <= this.camera.least) this.following = false;
    this.changed();
  }


  /** Pan by a drag of (dx, dy) CSS pixels. */
  panBy(dx: number, dy: number): void {
    const k = this.renderer.logicalScale * this.camera.zoom;
    this.camera.panBy(dx / k, dy / k);
    this.following = false;
    this.homed = false;
    this.framed = null;
    this.changed();
  }

  resetView(): void {
    this.following = false;
    this.homed = true;
    this.framed = null;
    this.camera.glideTo(this.homeView(), this.glide);
    this.changed();
  }

  /**
   * The view to rest on. On a wide screen, the whole page. On a compact one, where the controls take a large share of
   * the room, the view's own extent fitted into the room they leave: a phone held upright zooms in on the system in
   * motion, a phone on its side sees the whole plan from above (a little zoomed out, the page lying on the desk).
   */
  homeView(): View {
    const { w, h } = this.renderer.logical, whole = { zoom: 1, x: w / 2, y: h / 2 };
    const [x0, y0, x1, y1] = this.spec.home, r = this.freeRect(), perDesign = this.renderer.designScale / this.camera.zoom;
    const fit = Math.min((r.w - 2 * HOME_MARGIN) / ((x1 - x0) * perDesign), (r.h - 2 * HOME_MARGIN) / ((y1 - y0) * perDesign));
    // a wide screen shows the whole page unless even its controls would hide much of the system (a very short window)
    if (!COMPACT.matches && fit >= 0.75 && !this.spec.fitHome) return whole;
    const zoom = clamp(fit, this.spec.zoomMin, COMPACT.matches || this.spec.fitHome ? HOME_ZOOM_MAX : 1);
    // a view fitted home may pull back only a little past it: pushing on climbs out of it
    if (this.spec.fitHome) this.camera.min = Math.max(this.spec.zoomMin, Math.min(1, zoom * 0.85));
    if (Math.abs(zoom - 1) < HOME_SNAP && !this.spec.fitHome) return whole;
    const [lx, ly] = this.renderer.designToLogical((x0 + x1) / 2, (y0 + y1) / 2), [cx, cy] = this.centreFor(lx, ly, zoom);
    return { zoom, x: cx, y: cy };
  }

  /** Whether the camera rests on (or is gliding to) the home view: set by going home, cleared by any other move. */
  get atHome(): boolean { return this.homed; }

  /** Rest on the home view at once. */
  goHome(): void {
    this.following = false;
    this.homed = true;
    this.framed = null;
    this.camera.glideTo(this.homeView(), 0);
    this.changed();
  }

  /**
   * Where the camera must centre (logical units) at `zoom` so the logical point (lx, ly) shows in the middle of the
   * free part of the screen rather than the middle of the screen.
   */
  private centreFor(lx: number, ly: number, zoom: number): [number, number] {
    const r = this.freeRect(), k = this.renderer.logicalScale * zoom;
    return [lx - (r.x + r.w / 2 - innerWidth / 2) / k, ly - (r.y + r.h / 2 - innerHeight / 2) / k];
  }

  private centreAt(lx: number, ly: number, zoom: number): { x: number; y: number } {
    const [x, y] = this.centreFor(lx, ly, zoom);
    return { x, y };
  }

  /**
   * What a shared link keeps of the camera: the design point in the middle of the free part of the screen and the zoom,
   * or null at home (whoever opens the link then gets the home that suits their screen).
   */
  get looking(): { at: [number, number]; zoom: number } | null {
    if (this.homed) return null;
    const r = this.freeRect(), [lx, ly] = this.renderer.toLogical(r.x + r.w / 2, r.y + r.h / 2), fr = this.renderer.fit;
    return { at: [(lx - fr.ox) / fr.s, (ly - fr.oy) / fr.s], zoom: this.camera.target.zoom };
  }

  /** Show the design point `at` in the middle of the free part of the screen at `zoom` (a shared link's view). */
  lookAt(at: readonly [number, number], zoom: number, glide = this.glide): void {
    this.syncRoom();
    const z = clamp(zoom, this.camera.least, this.camera.max), [lx, ly] = this.renderer.designToLogical(at[0], at[1]), [cx, cy] = this.centreFor(lx, ly, z);
    this.following = false;
    this.homed = false;
    this.framed = null;
    this.camera.glideTo({ zoom: z, x: cx, y: cy }, glide);
    this.changed();
  }

  /** Glide to fit a circle of `radius` design units round the design point `at` into the free part of the screen. */
  frameDesign(radius: number, at: readonly [number, number], glide = this.glide): void {
    this.frameBox([at[0] - radius, at[1] - radius, at[0] + radius, at[1] + radius], glide);
  }

  /**
   * Glide to fit a design box into the free part of the screen. On a wide screen a tall box (a flight out to Neptune)
   * may take the page under the top bar and the dock, and zoom out past the whole page where the cards leave the room
   * narrow (`Camera.setRoom`).
   */
  frameBox(box: DesignBox, glide = this.glide): void {
    this.syncRoom();
    const [x0, y0, x1, y1] = box, r = this.freeRect(), perDesign = this.renderer.designScale / this.camera.zoom;
    const fit = Math.min((r.w - 2 * FRAME_MARGIN) / ((x1 - x0) * perDesign), (r.h - 2 * FRAME_MARGIN) / ((y1 - y0) * perDesign));
    const zoom = clamp(fit, this.camera.least, this.camera.max);
    const [lx, ly] = this.renderer.designToLogical((x0 + x1) / 2, (y0 + y1) / 2), [cx, cy] = this.centreFor(lx, ly, zoom);
    this.following = false;
    this.homed = false;
    this.framed = box;
    this.camera.glideTo({ zoom, x: cx, y: cy }, glide);
    this.changed();
  }

  /**
   * Tell the camera which part of the screen the controls leave clear, so the page may slide under them (the plans only:
   * the Earth and Moon view keeps its paper home and maps the view itself). A room that no longer allows the view eases
   * into one that does.
   */
  syncRoom(glide = this.glide): void {
    if (this.view === 'earth') {
      this.camera.setRoom(null, 0);
      return;
    }
    const r = this.freeRect(), k = this.renderer.logicalScale;
    this.camera.setRoom({ l: r.x / k, t: r.y / k, r: Math.max(0, innerWidth - r.x - r.w) / k, b: Math.max(0, innerHeight - r.y - r.h) / k }, glide);
  }

  /**
   * The room the controls leave has changed (a turned phone, a journey's controls in place of the dock): home, or a
   * framed moment, is fitted again into the new room (a followed body is re-centred by every drawing anyway); a view
   * the viewer chose stays as it is.
   */
  refit(glide = this.glide): void {
    this.syncRoom(glide);
    if (this.homed) this.camera.glideTo(this.homeView(), glide);
    else if (this.framed) this.frameBox(this.framed, glide);
    this.dirty = true;
  }

  /**
   * Keep the selected body in sight: where a card has just covered it (a sheet on a phone, a side panel), glide it into
   * the room the card leaves, at the same zoom. A body already in the clear stays where it is.
   */
  reveal(): void {
    const m = this.markOf(this.selected);
    if (!m) return;
    this.syncRoom();
    const r = this.freeRect(), [sx, sy] = this.renderer.toScreen(m.x, m.y), pad = 24;
    if (sx >= r.x + pad && sx <= r.x + r.w - pad && sy >= r.y + pad && sy <= r.y + r.h - pad) return;
    const z = this.camera.target.zoom, [lx, ly] = this.renderer.designToLogical(m.x, m.y), [cx, cy] = this.centreFor(lx, ly, z);
    this.homed = false;
    this.framed = null;
    this.camera.glideTo({ zoom: z, x: cx, y: cy }, this.glide);
    this.changed();
  }

  /** Glide in on the selected body and keep it centred (close enough, in the Earth and Moon view, to see it whole). */
  focusSelected(zoom = 4): void {
    const m = this.markOf(this.selected, true);
    if (!m || m.ring !== undefined) return;
    const least = this.view === 'earth' ? (FOCUS[m.id] ?? 4) : 1;
    const z = clamp(Math.max(zoom, least, this.camera.zoom), this.camera.least, this.camera.max), [lx, ly] = this.renderer.designToLogical(m.x, m.y), [cx, cy] = this.centreFor(lx, ly, z);
    this.following = true;
    this.homed = false;
    this.framed = null;
    this.camera.glideTo({ zoom: z, x: cx, y: cy }, this.glide);
    this.changed();
  }

  /* ---------- picking ---------- */

  /** Every body a view draws under `sky`, with the comets and the dwarf planets where the menus show them. */
  private marksAt(view: ViewId, sky: Sky, zoom: number): Marks {
    const marks = sceneMarks(view, sky, zoom);
    if (view === 'sky' && this.layers.dwarfs) marks.bodies.push(...dwarfMarks(sky.now));
    if (view === 'sky' && this.layers.comets) marks.bodies.push(...cometMarks(sky.now));
    return marks;
  }

  /** Where a body is drawn: as last drawn, or `fresh` for the sky as it stands now (after a jump). */
  private markOf(id: Selection, fresh = false): Mark | null {
    if (!id || id === 'belt') return null;
    const marks = (!fresh && this.marks) || this.marksAt(this.view, this.sim.sky(), this.camera.target.zoom);
    return marks.bodies.find(b => b.id === id) ?? null;
  }

  /**
   * Pick out the body after the selected one (or before it) among those the view draws, in their order out from the
   * Sun (or the Earth), for stepping through them from the keyboard; null where the view draws none.
   */
  stepSelection(dir: 1 | -1): BodyId | null {
    const ids = (this.marks ?? this.marksAt(this.view, this.sim.sky(), this.camera.zoom)).bodies.map(b => b.id), n = ids.length;
    if (!n) return null;
    const i = this.selected && this.selected !== 'belt' ? ids.indexOf(this.selected) : -1;
    const next = ids[i < 0 ? (dir === 1 ? 0 : n - 1) : (i + dir + n) % n]!;
    this.select(next, false);
    return next;
  }

  /** The body under a point on screen (CSS pixels), as it was last drawn. */
  pickAt(x: number, y: number): Pick | null {
    const marks = this.marks ?? this.marksAt(this.view, this.sim.sky(), this.camera.zoom);
    return pick(marks, x, y, (dx, dy) => this.renderer.toScreen(dx, dy), this.renderer.designScale);
  }

  /* ---------- the loop ---------- */

  resize(size: Size): void {
    this.renderer.resize(size);
    const { w, h } = this.renderer.logical;
    this.camera.resize(w, h);
    // resting at home, or on a moment, stay there for the new shape of screen
    this.refit(0);
  }

  /** Milliseconds between drawings at the current pace (paused, between drawings for a control or the camera). */
  get interval(): number {
    if (!this.sim.playing) return 1000 / HAND_FPS;
    const degPerSecond = (this.sim.pace * 360) / this.spec.quickest;
    return 1000 / clamp(degPerSecond / STEP_DEG, 12, MAX_FPS);
  }

  start(): void {
    requestAnimationFrame(this.frame);
  }

  private readonly frame = (now: number): void => {
    // ask for the next frame first: nothing thrown below can stop the loop
    requestAnimationFrame(this.frame);
    const dt = this.last ? Math.min(0.25, (now - this.last) / 1000) : 0;
    this.last = now;
    if (this.renderer.settle(now, this.drawInterval, dt)) this.dirty = true;
    if (this.sim.advance(dt)) this.onChange();
    if (this.stopAt !== null && this.sim.playing && this.sim.direction === 1 && this.sim.day >= this.stopAt) {
      this.sim.day = this.stopAt;
      this.sim.playing = false;
      this.stopAt = null;
      this.changed();
    }
    const settling = this.sim.settling, moving = this.camera.moving || this.renderer.crossing;
    this.camera.step(dt);
    const rest = toFrames(this.scene.loopFrom ?? 0, 12), drawingOn = this.intro < rest;
    if (drawingOn) this.intro = Math.min(rest, this.intro + 12 * dt);
    else this.intro = DONE;
    // a picture left at rest a moment is drawn again at full resolution
    if (this.sim.playing || settling || moving || drawingOn) this.stillSince = now;
    if (this.renderer.rest(now - this.stillSince > REST_MS)) this.dirty = true;
    // the sky keeps the pace's cadence; a control or the camera may draw sooner, but never above HAND_FPS
    const interval = this.dirty || moving ? Math.min(this.interval, 1000 / HAND_FPS) : this.interval;
    if ((this.dirty || this.sim.playing || settling || moving || drawingOn) && now - this.lastDraw >= interval - 3) {
      // the governor judges frames by the sky's own cadence (on twos while paused): a camera move or a control drawing
      // quicker than that is a bonus, and missing it is no reason to lower the resolution
      this.drawInterval = this.sim.playing ? this.interval : 1000 / 12;
      this.draw();
      this.lastDraw = now;
      this.dirty = false;
    } else {
      if (this.labelsPending) this.placeLabels();
      if (!moving && this.renderer.refine(REFINE_MS)) this.dirty = true;
    }
  };

  private draw(): void {
    const sky = this.sim.sky();
    this.marks = this.marksAt(this.view, sky, this.camera.zoom);
    if (this.following) {
      const m = this.marks.bodies.find(b => b.id === this.selected);
      if (m) {
        const [lx, ly] = this.renderer.designToLogical(m.x, m.y);
        // a glide in progress lands on the body where it is now, not where it was when the glide began
        if (this.camera.moving) this.camera.retarget(...this.centreFor(lx, ly, this.camera.target.zoom));
        else this.camera.centre(...this.centreFor(lx, ly, this.camera.zoom));
      }
    }
    const view: View = this.camera.view, step = this.sim.playing ? (this.sim.velocity * this.interval) / 1000 : 0;
    this.captions = [];
    this.renderer.draw(this.scene, this.intro, sky, view, ctx => this.decorate(ctx, true), this.view === 'earth' ? { lens: true, step } : undefined);
    this.placeLabels();
    this.onDraw();
  }

  /**
   * What the explorer draws over the scene: the Sky menu's layers, a moment's geometry, your years, the Earth's
   * neighbourhood, and the selection.
   */
  private decorate(ctx: CanvasRenderingContext2D, selection: boolean): void {
    if (this.view === 'sky') {
      if (this.layers.dwarfs) drawDwarfs(ctx, this, this.selected === 'pluto');
      if (this.layers.seasons) drawSeasons(ctx, this);
      if (this.layers.tonight) drawTonight(ctx, this);
      if (this.layers.comets) drawComets(ctx, this, (id: CometId) => id === this.selected);
      if (this.soundLine) drawSoundLine(ctx, this);
    }
    this.overlay?.(ctx, this);
    if (this.life && this.view === 'wake') drawLife(ctx, this, this.life);
    if (this.view === 'earth') drawNeighbourhood(ctx, this, this.overlay !== null);
    if (selection) this.drawSelection(ctx);
  }

  /**
   * The picture on screen as a still, drawn afresh `scale` times its size in CSS pixels (sharp, not enlarged), whole
   * (never part-way through a draw-on), without the selection ring.
   */
  still(scale: number): HTMLCanvasElement {
    // the still's captions are its own: the names on screen keep to the last drawing's
    const captions = this.captions;
    const still = this.renderer.still(scale, this.scene, this.sim.sky(), this.camera.view, ctx => this.decorate(ctx, false), this.view === 'earth' ? { lens: true, step: 0 } : undefined);
    this.captions = captions;
    return still;
  }

  /** A ring round the selected body, the same width on screen at any zoom, legible on light and dark papers. */
  private drawSelection(ctx: CanvasRenderingContext2D): void {
    const id = this.selected;
    if (!id || id === 'belt' || !this.marks) return;
    const m = this.marks.bodies.find(b => b.id === id);
    if (!m) return;
    const px = 1 / this.renderer.designScale, R = Math.max(m.reach, m.r) + 9 * px;
    ctx.save();
    ctx.lineCap = 'round';
    if (m.ring !== undefined) {
      // an orbit's height: the ring itself, traced over
      for (const [color, width] of [['rgba(13,15,21,0.55)', 4.5], ['#e8a33d', 2]] as const) {
        ctx.strokeStyle = color;
        ctx.lineWidth = width * px;
        ctx.setLineDash([10 * px, 7 * px]);
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.ring, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
      return;
    }
    for (const [color, width] of [['rgba(13,15,21,0.55)', 4.5], ['#e8a33d', 2]] as const) {
      ctx.strokeStyle = color;
      ctx.lineWidth = width * px;
      // four arcs with gaps, like a sight
      for (let k = 0; k < 4; k++) {
        const a = (k * Math.PI) / 2 + 0.28;
        ctx.beginPath();
        ctx.arc(m.x, m.y, R, a, a + Math.PI / 2 - 0.56);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  /**
   * Names beside the bodies, where they were drawn. Where names would overlap, the more important one wins (the
   * selected body, then the Sun, then the bigger planets) and the other fades out until zooming in parts them; the
   * layout's hysteresis keeps names from blinking as the bodies pass each other.
   */
  private placeLabels(): void {
    const marks = this.marks;
    if (!marks) return;
    const s = this.renderer.designScale, free = this.freeRect(), card = this.cardRect();
    const rank = (id: BodyId): number => (id === this.selected ? -1 : RANK.indexOf(id));
    const inputs = [...marks.bodies].sort((a, b) => rank(a.id) - rank(b.id)).flatMap(m => {
      const el = this.labelEls.get(m.id);
      if (!el) return [];
      let w = this.labelWidth.get(m.id);
      if (!w) {
        w = el.offsetWidth || 60;
        this.labelWidth.set(m.id, w);
      }
      if (m.ring !== undefined) {
        // an orbit's height is named where its ring crosses the free part of the screen, towards the upper right
        const at = this.ringLabelAt(m, free, w);
        return at ? [{ id: m.id, x: at[0], y: at[1], r: 3, w, h: 18 }] : [];
      }
      const [x, y] = this.renderer.toScreen(m.x, m.y);
      // a body off the screen, or under the open card, names nothing: its name would hang over the edge or show
      // through the card
      if (x < 0 || x > innerWidth || y < 0 || y > innerHeight) return [];
      if (card && x >= card.left && x <= card.right && y >= card.top && y <= card.bottom) return [];
      return [{ id: m.id, x, y, r: Math.max(m.id === 'sun' ? m.r : m.reach, m.r) * s, w, h: 18 }];
    });
    const { labels, pending } = this.labelLayout.place(inputs, innerWidth, performance.now(), this.captions);
    this.labelsPending = pending;
    const placed = new Set<string>();
    for (const l of labels) {
      const el = this.labelEls.get(l.id as BodyId)!;
      placed.add(l.id);
      el.style.transform = `translate(${l.left}px, ${l.top}px)`;
      el.classList.toggle('hid', !l.shown);
      el.classList.toggle('selected', l.id === this.selected);
    }
    // names of bodies this view does not show (or has no room for) are put away
    for (const [id, el] of this.labelEls) if (!placed.has(id)) el.classList.add('hid');
  }

  /** Where on screen to name a ring: the first of a few points round it that lies in the free room, with its name. */
  private ringLabelAt(m: Mark, free: { x: number; y: number; w: number; h: number }, w: number): [number, number] | null {
    const R = m.ring! * this.renderer.designScale, [cx, cy] = this.renderer.toScreen(m.x, m.y);
    if (R < 26) return null;
    for (const deg of [-38, -142, 38, 142, -64, -116, -90, 90, 0, 180]) {
      const a = (deg * Math.PI) / 180, x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R;
      if (x >= free.x + 8 && x + w + 12 <= free.x + free.w && y >= free.y + 14 && y <= free.y + free.h - 14) return [x, y];
    }
    return null;
  }
}
