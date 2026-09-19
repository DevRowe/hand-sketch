/**
 * The explorer's canvas: the chosen scene drawn live under the simulation's sky, through the view camera, at a
 * resolution the device keeps up with, and then whatever the UI lays over it.
 *
 * - The backing store matches the canvas's device pixels (up to 2 per CSS pixel), so lines stay crisp at any size.
 * - A governor watches how long frames really take (the gap from starting a draw to the next animation frame, which
 *   includes rasterising) and steps the resolution down while the device cannot keep the pace, back up when it has
 *   room. It remembers the level each scene settled on, since the ten styles differ tenfold in cost; a scene it has
 *   not seen starts at full resolution. Frames that paid for building caches (a new style, size or level) say nothing
 *   about the steady cost, so it ignores them.
 * - At rest (paused, nothing moving) the picture is drawn at full resolution, since no pace has to be kept; the
 *   governor's level comes back as soon as anything moves.
 * - Stages are kept per backing size, with their caches: stepping the resolution and back, or returning to a style,
 *   costs no rebuild.
 * - The heaviest styles draw to a smaller pixel budget on dense screens and let the browser scale up: hand-drawn marks
 *   bear it far better than the governor's deeper steps. A phone's budget is smaller still, and smallest In motion,
 *   whose every plate is redrawn as the Sun travels; there the governor also keeps each frame short of a long task, so
 *   a touch is never kept waiting behind a drawing.
 * - A lens scene (the Earth and Moon view) is handed the view instead of drawn through it: the stage stays home, so its
 *   paper stays put, and the scene maps its own geometry (`scenes/cislunar/lens.ts`).
 * - Crossing between the plans and the Earth and Moon view, the last picture swells or shrinks into the new one and
 *   fades (`cross`).
 */
import { DEFAULT_SETTINGS, drawScene, ON_TWOS, toFrames, type Scene } from '../core/scene';
import { Stage, type View } from '../core/stage';
import type { Sky } from '../scenes/solar/sky';
import { enter, frameFit, type Frame } from '../scenes/solar/common';
import { halftone } from '../scenes/gallery/common';
import type { ViewId } from './bodies';

/** Resolution levels, as fractions of the full backing size. */
const LEVELS = [1, 0.84, 0.7, 0.58, 0.48, 0.4];
/** Most device pixels per CSS pixel worth drawing. */
const MAX_DPR = 2;
/** Most backing pixels for the heaviest styles (about a 1440-wide screen at 1.5 device pixels per CSS pixel). */
const HEAVY_PIXELS = 2.5e6;
/** A phone: a screen whose short side is at most this many CSS pixels. */
const PHONE_SIDE = 540;
/**
 * Most backing pixels on a phone, by view: for the heaviest styles, then the rest (about 1.2 and 1.6 device pixels per
 * CSS pixel In motion on a 390-wide phone; an upright phone's canvas holds ~0.33 million CSS pixels).
 */
const PHONE_PIXELS: Readonly<Record<ViewId, readonly [heavy: number, light: number]>> = {
  wake: [0.5e6, 0.8e6],
  sky: [0.8e6, Infinity],
  earth: [Infinity, Infinity],
};
/** Most milliseconds a phone's frame may take: past 50 ms it is a long task, and a touch waits behind it. */
const PHONE_FRAME_MS = 48;
/** Stages (with their caches) kept for recent backing sizes. */
const KEEP_STAGES = 3;
/** Laid under every drawing, so nothing of the last one shows through a scene that leaves a gap. */
const DESK = '#0b0d12';

/** How a scene is drawn: through the view (the plans), or handed it as a lens, with the days the sky moves a drawing. */
export interface DrawOptions {
  lens: boolean;
  step: number;
}

interface Crossing {
  snap: HTMLCanvasElement;
  /** Where the anchor was on the old picture, and where it goes (CSS pixels). */
  from: readonly [number, number];
  to: readonly [number, number];
  /** How much the old picture grows (above 1) or shrinks. */
  scale: number;
  start: number;
  duration: number;
}

const HOME: View = { zoom: 1, x: 0, y: 0 };

export interface Size {
  /** CSS pixels. */
  cssW: number;
  cssH: number;
  /** Device pixels. */
  devW: number;
  devH: number;
}

class Governor {
  level = 0;
  /** Recent frames: whether each missed its slot, and whether it left plenty of room. */
  private recent: { slow: boolean; roomy: boolean }[] = [];
  private cooldown = 0;
  /** Scene name -> the level it settled on. */
  private remembered = new Map<string, number>();
  /** Level -> time (s) it last proved too slow: it is not retried for a while. */
  private failedAt = new Map<number, number>();
  private clock = 0;

  /** Start a scene at the level it last settled on, or at full resolution. */
  enter(scene: string): void {
    this.level = this.remembered.get(scene) ?? 0;
    this.recent = [];
    this.cooldown = 0.6;
  }

  /**
   * A frame meant to last `interval` ms really took `cost` ms (draw start to the next animation frame, rasterising
   * included), `js` of it in script. Returns true when the level changed. `dt` is the wall time since the last
   * observation.
   */
  observe(scene: string, cost: number, js: number, interval: number, dt: number): boolean {
    this.clock += dt;
    this.cooldown -= dt;
    // slow: it missed its slot; roomy: it left a quarter of it free, little of it in script
    this.recent.push({ slow: cost > interval + 2, roomy: cost <= interval * 0.75 && js < interval * 0.3 });
    if (this.recent.length > 10) this.recent.shift();
    if (this.cooldown > 0 || this.recent.length < 10) return false;
    const slow = this.recent.filter(f => f.slow).length;
    let next = this.level;
    if (slow >= 7 && this.level < LEVELS.length - 1) {
      this.failedAt.set(this.level, this.clock);
      next = this.level + 1;
    } else if (slow === 0 && this.recent.every(f => f.roomy) && this.level > 0 && this.clock - (this.failedAt.get(this.level - 1) ?? -1e9) > 20) {
      next = this.level - 1;
    }
    if (next === this.level) return false;
    this.level = next;
    this.remembered.set(scene, next);
    this.recent = [];
    this.cooldown = 1.2;
    return true;
  }
}

export class Renderer {
  readonly ctx: CanvasRenderingContext2D;
  private stage: Stage | null = null;
  /** The stage drawn with last (it survives `stage` being cleared for a new size). */
  private last: Stage | null = null;
  /** Stages by backing size, most recent last. */
  private readonly stages = new Map<string, Stage>();
  /** What is drawn, for the pixel budget: one of the heaviest styles, in which view. */
  private load: { heavy: boolean; view: ViewId } = { heavy: false, view: 'wake' };
  /** The last draw built caches (its cost is no guide to the steady one). */
  private built = false;
  private size: Size = { cssW: 1, cssH: 1, devW: 1, devH: 1 };
  private readonly governor = new Governor();
  private drawStart = -1;
  private drawJs = 0;
  private sceneName = '';
  /** The view the last drawing was made for: every mapping between the screen and the design goes through it. */
  private view: View = HOME;
  private crossingNow: Crossing | null = null;
  /** Output pixels per CSS pixel of a still being drawn (`still`). */
  private stillScale: number | null = null;
  /** The picture is at rest (`rest`): drawn at full resolution, whatever level the governor keeps for motion. */
  private resting = false;

  constructor(readonly canvas: HTMLCanvasElement) {
    // moving halftones are redrawn every frame here: filled as patterns, not dot by dot
    halftone.live = true;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('2D canvas context unavailable');
    this.ctx = ctx;
  }

  /** The canvas's size on screen; the stage is rebuilt on the next draw. */
  resize(size: Size): void {
    const s = this.size;
    if (s.cssW === size.cssW && s.cssH === size.cssH && s.devW === size.devW && s.devH === size.devH) return;
    this.size = { ...size };
    this.stage = this.last = null;
    // a new shape of screen: the old stages will not come back
    this.stages.clear();
  }

  /** What is drawn: whether the style is one of the heaviest, and the view; both set the pixel budget. */
  setLoad(heavy: boolean, view: ViewId): void {
    const before = this.budget;
    this.load = { heavy, view };
    if (this.budget !== before) this.stage = null;
  }

  /** Whether the screen is a phone's. */
  private get phone(): boolean { return Math.min(this.size.cssW, this.size.cssH) <= PHONE_SIDE; }

  /** Backing pixels the drawing may use at most (a phone's smaller budget is for motion: at rest it draws sharp). */
  private get budget(): number {
    const { heavy, view } = this.load, desk = heavy ? HEAVY_PIXELS : Infinity;
    return this.phone && !this.resting ? Math.min(desk, PHONE_PIXELS[view][heavy ? 0 : 1]) : desk;
  }

  /** The stage for the current size, budget and resolution level. */
  get current(): Stage {
    if (!this.stage) {
      const donor = this.last;
      const { devW, devH, cssW } = this.size;
      const full = Math.min(1, (MAX_DPR * cssW) / devW, Math.sqrt(this.budget / (devW * devH))), k = full * this.quality;
      const width = Math.max(2, Math.round(devW * k)), height = Math.max(2, Math.round(devH * k)), id = `${width}x${height}`;
      let stage = this.stages.get(id);
      if (stage) this.stages.delete(id);
      else {
        stage = new Stage({ ar: `${devW}:${devH}`, width, height });
        // a new resolution for the same screen: start from the old one's paper and textures, scaled
        if (donor) stage.adopt(donor);
      }
      this.stages.set(id, stage);
      for (const old of this.stages.keys()) if (this.stages.size > KEEP_STAGES) this.stages.delete(old);
      this.stage = this.last = stage;
      this.canvas.width = width;
      this.canvas.height = height;
    }
    return this.stage;
  }

  /** Logical frame size (for the camera). */
  get logical(): { w: number; h: number } {
    const s = this.current;
    return { w: s.w, h: s.h };
  }

  /** Output pixels per CSS pixel. */
  private get density(): number { return this.current.outW / this.size.cssW; }

  /** Canvas pixels per CSS pixel (for marks set in screen pixels): the screen's, or a still's while one is drawn. */
  get cssScale(): number { return this.stillScale ?? this.density; }

  /** The scenes' design box fitted into the logical frame. */
  get fit(): Frame { const s = this.current; return frameFit(s.w, s.h); }

  /** The view as the renderer maps it (home before anything is drawn). */
  private get mapView(): View {
    const s = this.current;
    return this.view === HOME ? { zoom: 1, x: s.w / 2, y: s.h / 2 } : this.view;
  }

  /** Design units to CSS pixels, through the view. */
  toScreen(x: number, y: number): [number, number] {
    const fr = this.fit, s = this.current, { zoom, x: vx, y: vy } = this.mapView, d = this.density;
    const lx = fr.ox + x * fr.s, ly = fr.oy + y * fr.s;
    return [(s.base * (s.w / 2 + zoom * (lx - vx))) / d, (s.base * (s.h / 2 + zoom * (ly - vy))) / d];
  }

  /** CSS pixels to the logical point under them, through the view. */
  toLogical(x: number, y: number): [number, number] {
    const s = this.current, { zoom, x: vx, y: vy } = this.mapView, d = this.density;
    return [vx + ((x * d) / s.base - s.w / 2) / zoom, vy + ((y * d) / s.base - s.h / 2) / zoom];
  }

  /** Design units to logical units. */
  designToLogical(x: number, y: number): [number, number] {
    const fr = this.fit;
    return [fr.ox + x * fr.s, fr.oy + y * fr.s];
  }

  /** CSS pixels per design unit at the current zoom. */
  get designScale(): number { return (this.fit.s * this.current.base * this.mapView.zoom) / this.density; }

  /** CSS pixels per logical unit at zoom 1 (for turning a drag into a pan). */
  get logicalScale(): number { return this.current.base / this.density; }

  /**
   * Draw `scene` under `sky` through `view` (or handing it `view` as a lens), `intro` drawn frames into its draw-on (it
   * rests whole from its loop start on), then `overlay` in design units, then any view crossing under way.
   */
  draw(scene: Scene, intro: number, sky: Sky, view: View, overlay?: (ctx: CanvasRenderingContext2D) => void, o?: DrawOptions): void {
    if (scene.name !== this.sceneName) {
      this.sceneName = scene.name;
      const before = this.governor.level;
      this.governor.enter(scene.name);
      if (this.governor.level !== before) this.stage = null;
    }
    const stage = this.current, builds = stage.builds;
    this.drawStart = performance.now();
    this.view = view;
    this.paint(this.ctx, stage, scene, intro, sky, view, overlay, o);
    this.drawCrossing();
    this.drawJs = performance.now() - this.drawStart;
    this.built = stage.builds !== builds;
  }

  /** The scene under `sky` through `view` on `stage`, painted into `ctx` (its canvas the stage's output size), then `overlay`. */
  private paint(ctx: CanvasRenderingContext2D, stage: Stage, scene: Scene, intro: number, sky: Sky, view: View, overlay?: (ctx: CanvasRenderingContext2D) => void, o?: DrawOptions): void {
    stage.setView(o?.lens ? { zoom: 1, x: stage.w / 2, y: stage.h / 2 } : view);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = DESK;
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    const rest = toFrames(scene.loopFrom ?? 0, ON_TWOS.fps);
    drawScene(ctx, stage, scene, Math.min(rest, Math.max(0, intro)), ON_TWOS, DEFAULT_SETTINGS, o?.lens ? { sky, lens: view, step: o.step } : { sky });
    if (overlay) {
      ctx.save();
      const k = stage.base * view.zoom;
      ctx.setTransform(k, 0, 0, k, stage.base * (stage.w / 2 - view.zoom * view.x), stage.base * (stage.h / 2 - view.zoom * view.y));
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      enter(ctx, frameFit(stage.w, stage.h));
      overlay(ctx);
      ctx.restore();
    }
  }

  /**
   * The picture on screen drawn afresh `scale` times its size in CSS pixels, for a still to keep: a stage of its own
   * (the engine draws at any resolution, so it is sharp, not an enlargement), the same scene, sky and view, and the
   * overlay, whose marks set in screen pixels scale with it. The heaviest styles take a moment to build their paper.
   */
  still(scale: number, scene: Scene, sky: Sky, view: View, overlay?: (ctx: CanvasRenderingContext2D) => void, o?: DrawOptions): HTMLCanvasElement {
    const { cssW, cssH } = this.size, width = Math.max(2, Math.round(cssW * scale)), height = Math.max(2, Math.round(cssH * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('2D canvas context unavailable');
    this.stillScale = scale;
    try {
      this.paint(ctx, new Stage({ ar: `${width}:${height}`, width, height }), scene, Infinity, sky, view, overlay, o);
    } finally {
      this.stillScale = null;
    }
    return canvas;
  }

  /**
   * Spend up to `ms` on sharpening the zoomed textures (call on animation frames that draw nothing). True when a sharp
   * copy is ready and the frame is worth drawing again.
   */
  refine(ms: number): boolean {
    return this.stage?.refine(ms) ?? false;
  }

  /**
   * Call at the start of the next animation frame after a draw, with the interval frames are meant to keep: the gap
   * since the draw began is what the frame really cost. Returns true when the resolution changed.
   */
  settle(now: number, interval: number, dt: number): boolean {
    if (this.drawStart < 0) return false;
    const cost = now - this.drawStart;
    this.drawStart = -1;
    // a drawing at rest keeps no pace, and one that built caches says nothing of the steady cost
    if (this.built || this.resting) return false;
    if (this.governor.observe(this.sceneName, cost, this.drawJs, this.phone ? Math.min(interval, PHONE_FRAME_MS) : interval, dt)) {
      this.stage = null;
      return true;
    }
    return false;
  }

  /**
   * Start a view crossing: the picture on the canvas now is kept and, over `duration` seconds of the drawings that
   * follow, grows by `scale` (or shrinks, below 1) about `from` while carrying that point to `to` (CSS pixels), and fades.
   */
  cross(from: readonly [number, number], to: readonly [number, number], scale: number, duration: number): void {
    const snap = document.createElement('canvas');
    snap.width = this.canvas.width;
    snap.height = this.canvas.height;
    snap.getContext('2d')!.drawImage(this.canvas, 0, 0);
    this.crossingNow = { snap, from, to, scale, start: performance.now(), duration: duration * 1000 };
  }

  /** Whether a view crossing is still on screen (the picture must keep being drawn). */
  get crossing(): boolean { return this.crossingNow !== null; }

  private drawCrossing(): void {
    const c = this.crossingNow;
    if (!c) return;
    const t = Math.min(1, (performance.now() - c.start) / c.duration);
    if (t >= 1) {
      this.crossingNow = null;
      return;
    }
    const e = 1 - (1 - t) ** 3, k = Math.exp(Math.log(c.scale) * e), d = this.canvas.width / this.size.cssW;
    const [ax, ay] = c.from, bx = ax + (c.to[0] - ax) * e, by = ay + (c.to[1] - ay) * e, ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = (1 - t) ** 1.6;
    ctx.setTransform(k, 0, 0, k, (bx - ax * k) * d, (by - ay * k) * d);
    ctx.drawImage(c.snap, 0, 0, this.canvas.width, this.canvas.height);
    ctx.restore();
  }

  /**
   * Whether the picture is at rest (paused, the camera and the trails still). At rest nothing has a pace to keep, so it
   * is drawn at full resolution, past a phone's motion budget (a heavy style's paper sharpening in idle slices); the
   * level the governor chose for motion comes back the moment anything moves, its stage kept. True when that changes
   * the resolution.
   */
  rest(on: boolean): boolean {
    if (on === this.resting) return false;
    const budget = this.budget;
    this.resting = on;
    if (this.governor.level === 0 && this.budget === budget) return false;
    this.stage = null;
    return true;
  }

  /** The resolution in use, as a fraction of the full backing size. */
  get quality(): number { return LEVELS[this.resting ? 0 : this.governor.level]!; }
}
