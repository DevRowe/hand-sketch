/**
 * The explorer itself: the simulation, the view camera and the renderer tied together, with the choices the viewer
 * makes (view, style, selection, names, trail lengths) and the animation loop that draws.
 *
 * Drawing follows the hand-drawn cadence: twelve drawings a second ("on twos") at gentle paces, rising towards the
 * display's rate as the pace quickens so a fast planet still moves in readable steps. While paused it draws only when
 * something changes (a control, the camera, the trails easing), so an idle page costs nothing.
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

/** Mercury's sidereal period, days: the fastest planet sets the drawing cadence. */
const MERCURY_DAYS = 87.97;
/** Most degrees Mercury may move between drawings before the cadence rises. */
const STEP_DEG = 8;

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
  /** Each view keeps its own trail length: short sweeps read best from above, long wakes in motion. */
  readonly spans: Record<ViewId, number> = { sky: 2 * 30.44, wake: 3 * YEAR };
  /** Extra drawing over the scene (the jump-to presets' geometry). */
  overlay: Overlay | null = null;
  /** Called after every drawing (readouts) and on every state change (controls). */
  onDraw: () => void = () => {};
  onChange: () => void = () => {};

  private intro: number;
  private dirty = true;
  private lastDraw = -1e9;
  private last = 0;
  private marks: Marks | null = null;
  private readonly labelEls = new Map<BodyId, HTMLElement>();

  constructor(private readonly o: AppOptions) {
    this.sim = o.sim;
    this.view = o.view;
    this.style = o.style;
    this.renderer = new Renderer(o.canvas);
    const { w, h } = this.renderer.logical;
    this.camera = new Camera(w, h);
    this.intro = o.skipIntro ? 1e9 : 0;
    this.sim.trails.span = this.spans[this.view];
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
    this.changed();
  }

  jump(day: number): void {
    this.sim.jump(day);
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

  /** Zoom by `factor` about a point on screen (CSS pixels), or the centre. */
  zoomBy(factor: number, x?: number, y?: number): void {
    const [lx, ly] = x === undefined || y === undefined ? [this.camera.x, this.camera.y] : this.renderer.toLogical(x, y);
    this.camera.zoomAt(factor, lx, ly);
    if (this.camera.zoom <= ZOOM_MIN) this.following = false;
    this.changed();
  }

  setZoom(zoom: number): void { this.zoomBy(zoom / this.camera.zoom); }

  /** Pan by a drag of (dx, dy) CSS pixels. */
  panBy(dx: number, dy: number): void {
    const k = this.renderer.logicalScale * this.camera.zoom;
    this.camera.panBy(dx / k, dy / k);
    this.following = false;
    this.changed();
  }

  resetView(): void {
    this.following = false;
    this.camera.reset();
    this.changed();
  }

  /** Glide in on the selected body and keep it centred. */
  focusSelected(zoom = 4): void {
    const m = this.markOf(this.selected);
    if (!m) return;
    const [lx, ly] = this.renderer.designToLogical(m.x, m.y);
    this.following = true;
    this.camera.glideTo({ zoom: clamp(Math.max(zoom, this.camera.zoom), ZOOM_MIN, ZOOM_MAX), x: lx, y: ly });
    this.changed();
  }

  /* ---------- picking ---------- */

  private markOf(id: Selection): { x: number; y: number } | null {
    if (!id || id === 'belt') return null;
    const marks = this.marks ?? sceneMarks(this.view, this.sim.sky());
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
    this.dirty = true;
  }

  /** Milliseconds between drawings at the current pace. */
  get interval(): number {
    if (!this.sim.playing) return 1000 / 60;
    const degPerSecond = (this.sim.pace * 360) / MERCURY_DAYS;
    return 1000 / clamp(degPerSecond / STEP_DEG, 12, 60);
  }

  start(): void {
    requestAnimationFrame(this.frame);
  }

  private readonly frame = (now: number): void => {
    const dt = this.last ? Math.min(0.25, (now - this.last) / 1000) : 0;
    this.last = now;
    if (this.renderer.settle(now, this.interval, dt)) this.dirty = true;
    if (this.sim.advance(dt)) this.onChange();
    const settling = this.sim.settling, moving = this.camera.moving;
    this.camera.step(dt);
    const rest = toFrames(this.scene.loopFrom ?? 0, 12), drawingOn = this.intro < rest;
    if (drawingOn) this.intro = Math.min(rest, this.intro + 12 * dt);
    const due = this.sim.playing && now - this.lastDraw >= this.interval - 3;
    if (this.dirty || due || settling || moving || drawingOn) {
      this.draw();
      this.lastDraw = now;
      this.dirty = false;
    }
    requestAnimationFrame(this.frame);
  };

  private draw(): void {
    const sky = this.sim.sky();
    this.marks = sceneMarks(this.view, sky);
    if (this.following) {
      const m = this.markOf(this.selected);
      if (m && !this.camera.moving) {
        const [lx, ly] = this.renderer.designToLogical(m.x, m.y);
        this.camera.centre(lx, ly);
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

  /** Names beside the bodies, where they were drawn. */
  private placeLabels(): void {
    const marks = this.marks;
    if (!marks) return;
    const s = this.renderer.designScale;
    let earth: [number, number] | null = null;
    for (const m of marks.bodies) {
      const el = this.labelEls.get(m.id);
      if (!el) continue;
      const [x, y] = this.renderer.toScreen(m.x, m.y), r = Math.max(m.id === 'sun' ? m.r : m.reach, m.r) * s;
      if (m.id === 'earth') earth = [x, y];
      // the Moon's name only once it stands clear of the Earth's
      const crowded = m.id === 'moon' && earth !== null && Math.hypot(x - earth[0], y - earth[1]) < 34 && this.selected !== 'moon';
      el.style.transform = `translate(${Math.round(x + r + 6)}px, ${Math.round(y - 9)}px)`;
      el.style.visibility = crowded ? 'hidden' : 'visible';
      el.classList.toggle('selected', m.id === this.selected);
    }
  }
}
