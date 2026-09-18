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
/** Screens this narrow (CSS pixels) frame the system into the room the controls leave. */
const PHONE = 720;
/** Design units from the Sun to the far side of Neptune; and CSS pixels kept clear round it. */
const HOME_REACH = 502;
const HOME_MARGIN = 10;

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
  readonly spans: Record<ViewId, number> = { sky: 2 * 30.44, wake: 12 * YEAR };
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
  private lastDraw = -1e9;
  /** The interval the last drawing was meant to keep (for the resolution governor). */
  private drawInterval = 1000 / 12;
  private last = 0;
  private marks: Marks | null = null;
  private readonly labelEls = new Map<BodyId, HTMLElement>();
  /** Each name's width on screen, measured once. */
  private readonly labelWidth = new Map<BodyId, number>();

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
    if (this.camera.zoom <= ZOOM_MIN) this.following = false;
    this.changed();
  }


  /** Pan by a drag of (dx, dy) CSS pixels. */
  panBy(dx: number, dy: number): void {
    const k = this.renderer.logicalScale * this.camera.zoom;
    this.camera.panBy(dx / k, dy / k);
    this.following = false;
    this.homed = false;
    this.changed();
  }

  resetView(): void {
    this.following = false;
    this.homed = true;
    this.camera.glideTo(this.homeView(), this.glide);
    this.changed();
  }

  /**
   * The view to rest on: the whole frame, or on a phone, where the controls leave a narrower band free, the system out
   * to Neptune fitted into that band (a little zoomed out, the page lying on the desk).
   */
  homeView(): View {
    const { w, h } = this.renderer.logical, whole = { zoom: 1, x: w / 2, y: h / 2 };
    if (innerWidth > PHONE) return whole;
    const r = this.freeRect(), perDesign = this.renderer.designScale / this.camera.zoom;
    const zoom = clamp((Math.min(r.w, r.h) / 2 - HOME_MARGIN) / (HOME_REACH * perDesign), ZOOM_MIN, 1);
    const [lx, ly] = this.renderer.designToLogical(540, 540), [cx, cy] = this.centreFor(lx, ly, zoom);
    return { zoom, x: cx, y: cy };
  }

  /** Whether the camera rests on (or is gliding to) the home view: set by going home, cleared by any other move. */
  get atHome(): boolean { return this.homed; }

  /** Rest on the home view at once. */
  goHome(): void {
    this.following = false;
    this.homed = true;
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
  frameDesign(radius: number, [x, y]: readonly [number, number]): void {
    const r = this.freeRect(), perDesign = this.renderer.designScale / this.camera.zoom;
    const zoom = clamp(Math.min(r.w, r.h) / (2 * radius * perDesign), ZOOM_MIN, ZOOM_MAX);
    const [lx, ly] = this.renderer.designToLogical(x, y), [cx, cy] = this.centreFor(lx, ly, zoom);
    this.following = false;
    this.homed = false;
    this.camera.glideTo({ zoom, x: cx, y: cy }, this.glide);
    this.changed();
  }

  /** Glide in on the selected body and keep it centred. */
  focusSelected(zoom = 4): void {
    const m = this.markOf(this.selected, true);
    if (!m) return;
    const z = clamp(Math.max(zoom, this.camera.zoom), ZOOM_MIN, ZOOM_MAX), [lx, ly] = this.renderer.designToLogical(m.x, m.y), [cx, cy] = this.centreFor(lx, ly, z);
    this.following = true;
    this.homed = false;
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
    const home = this.homed;
    this.renderer.resize(size);
    const { w, h } = this.renderer.logical;
    this.camera.resize(w, h);
    // resting at home, stay at home for the new shape of screen
    if (home) this.camera.glideTo(this.homeView(), 0);
    this.dirty = true;
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
      this.drawInterval = interval;
      this.draw();
      this.lastDraw = now;
      this.dirty = false;
    } else if (!moving && this.renderer.refine(REFINE_MS)) this.dirty = true;
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
   * selected body, then the Sun, then the bigger planets) and the other waits until zooming in parts them.
   */
  private placeLabels(): void {
    const marks = this.marks;
    if (!marks) return;
    const s = this.renderer.designScale, placed: [number, number, number, number][] = [];
    const rank = (id: BodyId): number => (id === this.selected ? -1 : RANK.indexOf(id));
    for (const m of [...marks.bodies].sort((a, b) => rank(a.id) - rank(b.id))) {
      const el = this.labelEls.get(m.id);
      if (!el) continue;
      const [x, y] = this.renderer.toScreen(m.x, m.y), r = Math.max(m.id === 'sun' ? m.r : m.reach, m.r) * s;
      let w = this.labelWidth.get(m.id);
      if (!w) {
        w = el.offsetWidth || 60;
        this.labelWidth.set(m.id, w);
      }
      // a name that would run off the right of the screen goes on the body's other side
      let left = Math.round(x + r + 6);
      if (left + w > innerWidth - 4) left = Math.round(x - r - 6 - w);
      const top = Math.round(y - 9), h = 18;
      const clash = placed.some(([a, b, c, d]) => left < c && left + w > a && top < d && top + h > b);
      el.style.transform = `translate(${left}px, ${top}px)`;
      el.style.visibility = clash ? 'hidden' : 'visible';
      el.classList.toggle('selected', m.id === this.selected);
      if (!clash) placed.push([left - 2, top - 2, left + w + 2, top + h + 2]);
    }
  }
}
