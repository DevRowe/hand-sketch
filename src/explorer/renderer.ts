/**
 * The explorer's canvas: the chosen scene drawn live under the simulation's sky, through the view camera, at a
 * resolution the device keeps up with, and then whatever the UI lays over it.
 *
 * - The backing store matches the canvas's device pixels (up to 2 per CSS pixel), so lines stay crisp at any size.
 * - A governor watches how long frames really take (the gap from starting a draw to the next animation frame, which
 *   includes rasterising) and steps the resolution down while the device cannot keep the pace, back up when it has
 *   room. It remembers the level each scene settled on, since the ten styles differ tenfold in cost.
 */
import { DEFAULT_SETTINGS, drawScene, ON_TWOS, toFrames, type Scene } from '../core/scene';
import { Stage, type View } from '../core/stage';
import type { Sky } from '../scenes/solar/sky';
import { enter, frameFit, type Frame } from '../scenes/solar/common';

/** Resolution levels, as fractions of the full backing size. */
const LEVELS = [1, 0.84, 0.7, 0.58, 0.48, 0.4];
/** Most device pixels per CSS pixel worth drawing. */
const MAX_DPR = 2;

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

  /** Start a scene at the level it last settled on. */
  enter(scene: string): void {
    this.level = this.remembered.get(scene) ?? this.level;
    this.recent = [];
    this.cooldown = 0.6;
  }

  /**
   * A frame meant to last `interval` ms really took `cost` ms (draw start to the next animation frame, rasterising
   * included), `js` of it in script. Returns true when the level changed, so the stage must be rebuilt. `dt` is the
   * wall time since the last observation.
   */
  observe(scene: string, cost: number, js: number, interval: number, dt: number): boolean {
    this.clock += dt;
    this.cooldown -= dt;
    this.recent.push({ slow: cost > interval * 1.3 + 4, roomy: cost <= interval * 1.1 + 2 && js < interval * 0.3 });
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
  private size: Size = { cssW: 1, cssH: 1, devW: 1, devH: 1 };
  private readonly governor = new Governor();
  private drawStart = -1;
  private drawJs = 0;
  private sceneName = '';

  constructor(readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('2D canvas context unavailable');
    this.ctx = ctx;
  }

  /** The canvas's size on screen; the stage is rebuilt on the next draw. */
  resize(size: Size): void {
    const s = this.size;
    if (s.cssW === size.cssW && s.cssH === size.cssH && s.devW === size.devW && s.devH === size.devH) return;
    this.size = { ...size };
    this.stage = null;
  }

  /** The stage for the current size and resolution level. */
  get current(): Stage {
    if (!this.stage) {
      const { devW, devH, cssW } = this.size, k = Math.min(1, (MAX_DPR * cssW) / devW) * LEVELS[this.governor.level]!;
      const width = Math.max(2, Math.round(devW * k)), height = Math.max(2, Math.round(devH * k));
      this.stage = new Stage({ ar: `${devW}:${devH}`, width, height });
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

  /** The scenes' design box fitted into the logical frame. */
  get fit(): Frame { const s = this.current; return frameFit(s.w, s.h); }

  /** Design units to CSS pixels, through the view. */
  toScreen(x: number, y: number): [number, number] {
    const fr = this.fit, [px, py] = this.current.toPixel(fr.ox + x * fr.s, fr.oy + y * fr.s), d = this.density;
    return [px / d, py / d];
  }

  /** CSS pixels to the logical point under them, through the view. */
  toLogical(x: number, y: number): [number, number] {
    const d = this.density;
    return this.current.toLogical(x * d, y * d);
  }

  /** Design units to logical units. */
  designToLogical(x: number, y: number): [number, number] {
    const fr = this.fit;
    return [fr.ox + x * fr.s, fr.oy + y * fr.s];
  }

  /** CSS pixels per design unit at the current zoom. */
  get designScale(): number { return (this.fit.s * this.current.scale) / this.density; }

  /** CSS pixels per logical unit at zoom 1 (for turning a drag into a pan). */
  get logicalScale(): number { return this.current.base / this.density; }

  /**
   * Draw `scene` under `sky` through `view`, `intro` drawn frames into its draw-on (it rests whole from its loop start
   * on), then `overlay` in design units.
   */
  draw(scene: Scene, intro: number, sky: Sky, view: View, overlay?: (ctx: CanvasRenderingContext2D) => void): void {
    if (scene.name !== this.sceneName) {
      this.sceneName = scene.name;
      const before = this.governor.level;
      this.governor.enter(scene.name);
      if (this.governor.level !== before) this.stage = null;
    }
    const stage = this.current, ctx = this.ctx;
    this.drawStart = performance.now();
    stage.setView(view);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#0d0f15';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    const rest = toFrames(scene.loopFrom ?? 0, ON_TWOS.fps);
    drawScene(ctx, stage, scene, Math.min(rest, Math.max(0, intro)), ON_TWOS, DEFAULT_SETTINGS, { sky });
    if (overlay) {
      ctx.save();
      stage.reset(ctx);
      enter(ctx, this.fit);
      overlay(ctx);
      ctx.restore();
    }
    this.drawJs = performance.now() - this.drawStart;
  }

  /**
   * Call at the start of the next animation frame after a draw, with the interval frames are meant to keep: the gap
   * since the draw began is what the frame really cost. Returns true when the resolution changed.
   */
  settle(now: number, interval: number, dt: number): boolean {
    if (this.drawStart < 0) return false;
    const cost = now - this.drawStart;
    this.drawStart = -1;
    if (this.governor.observe(this.sceneName, cost, this.drawJs, interval, dt)) {
      this.stage = null;
      return true;
    }
    return false;
  }

  /** The resolution in use, as a fraction of the full backing size (for diagnostics). */
  get quality(): number { return LEVELS[this.governor.level]!; }
}
