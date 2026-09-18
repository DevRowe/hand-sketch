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
import { sceneMarks, pick, type BodyId, type Pick, type Scene as Marks, type ViewId } from './bodies';
import { Camera, ZOOM_MAX, ZOOM_MIN } from './camera';
import { LabelLayout } from './labels';
import { Renderer, type Size } from './renderer';
import { clamp, Sim, YEAR } from './sim';
import { STYLES, type Style } from './styles';

export type Selection = BodyId | 'belt' | null;

export const BODY_NAMES: Readonly<Record<BodyId | 'belt', string>> = {
  sun: 'Sun', mercury: 'Mercury', venus: 'Venus', earth: 'Earth', moon: 'Moon', mars: 'Mars',
  jupiter: 'Jupiter', saturn: 'Saturn', uranus: 'Uranus', neptune: 'Neptune', belt: 'Asteroid belt',
};

/** The draw-on has played. */
const DONE = 1e9;

/** Whose name wins when two would overlap. */
const RANK: readonly BodyId[] = ['sun', 'earth', 'jupiter', 'saturn', 'mars', 'venus', 'uranus', 'neptune', 'mercury', 'moon'];

/** Mercury's sidereal period, days: the fastest planet sets the drawing cadence. */
const MERCURY_DAYS = 87.97;
/** Most degrees Mercury may move between drawings before the cadence rises. */
const STEP_DEG = 8;
/** The cadence tops out at film rate: past it a faster planet only blurs, and resolution and battery matter more. */
const MAX_FPS = 30;
/** Most drawings a second for camera moves, drags and controls (the eye wants them quicker than twelve). */
const HAND_FPS = 30;
/** Milliseconds an animation frame that draws nothing may spend sharpening zoomed textures. */
const REFINE_MS = 6;
/**
 * What home must show of each view, design units [x0, y0, x1, y1]: from above, the plan out to Neptune; in motion, the
 * tilted orbits round the Sun (which sits right of centre), a little of the wake behind them and room for names.
 */
const HOME_EXTENT: Readonly<Record<ViewId, readonly [number, number, number, number]>> = {
  sky: [38, 38, 1042, 1042],
  wake: [440, 330, 960, 880],
};
/** CSS pixels kept clear round it, and round a framed moment (whose marks carry names outside the circle). */
const HOME_MARGIN = 10;
const FRAME_MARGIN = 16;
/** On a compact screen home may zoom in this far to fill the room; within `HOME_SNAP` of 1 it rests on the whole page. */
const HOME_ZOOM_MAX = 1.6;
const HOME_SNAP = 0.07;
/** Screens where the controls take a large share of the room: home is fitted to it (elsewhere the page fills the screen). */
const COMPACT = matchMedia('(max-width: 980px), (max-height: 540px)');

/** Trails the explorer starts with: short sweeps read best from above, longer wakes in motion; both at a light touch. */
export const DEFAULT_SPANS: Readonly<Record<ViewId, number>> = { sky: YEAR / 8, wake: 4 * YEAR };
export const DEFAULT_OPACITY = 0.6;

/** Something drawn over the scene in design units (a transfer orbit, sight lines). */
export type Overlay = (ctx: CanvasRenderingContext2D, app: App) => void;

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
  readonly spans: Record<ViewId, number> = { ...DEFAULT_SPANS };
  /** Extra drawing over the scene (the jump-to presets' geometry). */
  overlay: Overlay | null = null;
  /** A journey under way stops (and pauses) on this day. */
  private stopAt: number | null = null;
  /** The part of the screen the controls leave free (CSS pixels): framing centres things there. */
  freeRect: () => { x: number; y: number; w: number; h: number } = () => ({ x: 0, y: 0, w: innerWidth, h: innerHeight });
  /** Called after every drawing (readouts) and on every state change (controls). */
  onDraw: () => void = () => {};
  onChange: () => void = () => {};

  /** Drawn frames into the scene's draw-on; `DONE` once it has played (on load or Reset), so a new style starts whole. */
  private intro: number;
  private dirty = true;
  /** The camera rests on (or glides to) the home view. */
  private homed = true;
  /** The design circle the camera was last framed on (a moment's geometry), until the viewer moves it. */
  private framed: { radius: number; at: readonly [number, number] } | null = null;
  private lastDraw = -1e9;
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

  constructor(private readonly o: AppOptions) {
    this.sim = o.sim;
    this.view = o.view;
    this.style = o.style;
    this.renderer = new Renderer(o.canvas);
    this.renderer.setHeavy(o.style.heavy);
    const { w, h } = this.renderer.logical;
    this.camera = new Camera(w, h);
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

  /** Seconds a camera move eases over. */
  private get glide(): number { return this.reducedMotion ? 0 : 0.7; }

  /** Mark the picture stale: it redraws on the next frame. */
  invalidate(): void { this.dirty = true; }

  private changed(): void {
    this.dirty = true;
    this.onChange();
  }

  /* ---------- choices ---------- */

  setView(view: ViewId): void {
    if (view === this.view) return;
    this.spans[this.view] = this.sim.trails.span;
    this.view = view;
    this.sim.trails.span = this.spans[view];
    this.sim.trails.reveal = 0;
    this.labelLayout.reset();
    // home differs by view: glide to the new one's
    if (this.homed) this.camera.glideTo(this.homeView(), this.glide);
    this.changed();
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
    this.sim.pace = pace;
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
    this.sim.pace = pace;
    this.sim.playing = true;
    this.stopAt = to;
    this.changed();
  }

  /** Whether a journey is under way. */
  get journeying(): boolean { return this.stopAt !== null; }

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

  /** Zoom by `factor` about a point on screen (CSS pixels), or the centre. */
  zoomBy(factor: number, x?: number, y?: number): void {
    const [lx, ly] = x === undefined || y === undefined ? [this.camera.x, this.camera.y] : this.renderer.toLogical(x, y);
    this.camera.zoomAt(factor, lx, ly);
    this.homed = false;
    this.framed = null;
    if (this.camera.zoom <= ZOOM_MIN) this.following = false;
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
    const [x0, y0, x1, y1] = HOME_EXTENT[this.view], r = this.freeRect(), perDesign = this.renderer.designScale / this.camera.zoom;
    const fit = Math.min((r.w - 2 * HOME_MARGIN) / ((x1 - x0) * perDesign), (r.h - 2 * HOME_MARGIN) / ((y1 - y0) * perDesign));
    // a wide screen shows the whole page unless even its controls would hide much of the system (a very short window)
    if (!COMPACT.matches && fit >= 0.75) return whole;
    const zoom = clamp(fit, ZOOM_MIN, COMPACT.matches ? HOME_ZOOM_MAX : 1);
    if (Math.abs(zoom - 1) < HOME_SNAP) return whole;
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

  /** Glide to fit a circle of `radius` design units round the design point `at` into the free part of the screen. */
  frameDesign(radius: number, at: readonly [number, number], glide = this.glide): void {
    const r = this.freeRect(), perDesign = this.renderer.designScale / this.camera.zoom;
    const zoom = clamp((Math.min(r.w, r.h) - 2 * FRAME_MARGIN) / (2 * radius * perDesign), ZOOM_MIN, ZOOM_MAX);
    const [lx, ly] = this.renderer.designToLogical(at[0], at[1]), [cx, cy] = this.centreFor(lx, ly, zoom);
    this.following = false;
    this.homed = false;
    this.framed = { radius, at };
    this.camera.glideTo({ zoom, x: cx, y: cy }, glide);
    this.changed();
  }

  /**
   * The room the controls leave has changed (a turned phone, a journey's controls in place of the dock): home, or a
   * framed moment, is fitted again into the new room (a followed body is re-centred by every drawing anyway); a view
   * the viewer chose stays as it is.
   */
  refit(glide = this.glide): void {
    if (this.homed) this.camera.glideTo(this.homeView(), glide);
    else if (this.framed) this.frameDesign(this.framed.radius, this.framed.at, glide);
    this.dirty = true;
  }

  /**
   * Keep the selected body in sight: where a card has just covered it (a sheet on a phone, a side panel), glide it into
   * the room the card leaves, at the same zoom. A body already in the clear stays where it is.
   */
  reveal(): void {
    const m = this.markOf(this.selected);
    if (!m) return;
    const r = this.freeRect(), [sx, sy] = this.renderer.toScreen(m.x, m.y), pad = 24;
    if (sx >= r.x + pad && sx <= r.x + r.w - pad && sy >= r.y + pad && sy <= r.y + r.h - pad) return;
    const z = this.camera.target.zoom, [lx, ly] = this.renderer.designToLogical(m.x, m.y), [cx, cy] = this.centreFor(lx, ly, z);
    this.homed = false;
    this.framed = null;
    this.camera.glideTo({ zoom: z, x: cx, y: cy }, this.glide);
    this.changed();
  }

  /** Glide in on the selected body and keep it centred. */
  focusSelected(zoom = 4): void {
    const m = this.markOf(this.selected, true);
    if (!m) return;
    const z = clamp(Math.max(zoom, this.camera.zoom), ZOOM_MIN, ZOOM_MAX), [lx, ly] = this.renderer.designToLogical(m.x, m.y), [cx, cy] = this.centreFor(lx, ly, z);
    this.following = true;
    this.homed = false;
    this.framed = null;
    this.camera.glideTo({ zoom: z, x: cx, y: cy }, this.glide);
    this.changed();
  }

  /* ---------- picking ---------- */

  /** Where a body is drawn: as last drawn, or `fresh` for the sky as it stands now (after a jump). */
  private markOf(id: Selection, fresh = false): { x: number; y: number } | null {
    if (!id || id === 'belt') return null;
    const marks = (!fresh && this.marks) || sceneMarks(this.view, this.sim.sky());
    return marks.bodies.find(b => b.id === id) ?? null;
  }

  /** The body under a point on screen (CSS pixels), as it was last drawn. */
  pickAt(x: number, y: number): Pick | null {
    const marks = this.marks ?? sceneMarks(this.view, this.sim.sky());
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
    const degPerSecond = (this.sim.pace * 360) / MERCURY_DAYS;
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
    const settling = this.sim.settling, moving = this.camera.moving;
    this.camera.step(dt);
    const rest = toFrames(this.scene.loopFrom ?? 0, 12), drawingOn = this.intro < rest;
    if (drawingOn) this.intro = Math.min(rest, this.intro + 12 * dt);
    else this.intro = DONE;
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
    this.marks = sceneMarks(this.view, sky);
    if (this.following) {
      const m = this.marks.bodies.find(b => b.id === this.selected);
      if (m) {
        const [lx, ly] = this.renderer.designToLogical(m.x, m.y);
        // a glide in progress lands on the body where it is now, not where it was when the glide began
        if (this.camera.moving) this.camera.retarget(...this.centreFor(lx, ly, this.camera.target.zoom));
        else this.camera.centre(...this.centreFor(lx, ly, this.camera.zoom));
      }
    }
    const view: View = this.camera.view;
    this.renderer.draw(this.scene, this.intro, sky, view, ctx => {
      this.overlay?.(ctx, this);
      this.drawSelection(ctx);
    });
    this.placeLabels();
    this.onDraw();
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
    const s = this.renderer.designScale;
    const rank = (id: BodyId): number => (id === this.selected ? -1 : RANK.indexOf(id));
    const inputs = [...marks.bodies].sort((a, b) => rank(a.id) - rank(b.id)).flatMap(m => {
      const el = this.labelEls.get(m.id);
      if (!el) return [];
      let w = this.labelWidth.get(m.id);
      if (!w) {
        w = el.offsetWidth || 60;
        this.labelWidth.set(m.id, w);
      }
      const [x, y] = this.renderer.toScreen(m.x, m.y);
      return [{ id: m.id, x, y, r: Math.max(m.id === 'sun' ? m.r : m.reach, m.r) * s, w, h: 18 }];
    });
    const { labels, pending } = this.labelLayout.place(inputs, innerWidth, performance.now());
    this.labelsPending = pending;
    for (const l of labels) {
      const el = this.labelEls.get(l.id as BodyId)!;
      el.style.transform = `translate(${l.left}px, ${l.top}px)`;
      el.classList.toggle('hid', !l.shown);
      el.classList.toggle('selected', l.id === this.selected);
    }
  }
}
