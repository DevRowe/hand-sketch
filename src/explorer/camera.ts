/**
 * The explorer's view camera: a uniform zoom and a pan over the drawn frame, in the stage's logical units, and nothing
 * else (no turning, no tilting: the sky keeps its angle). It is separate from the sky and the style, so it never
 * changes what is drawn, only which part of the frame fills the screen. Zoom goes towards a point (the cursor, a
 * pinch's centre). The zoom never drops below 1, so the page always covers the screen and its edge never shows; zoomed
 * in, the screen stays on the page. Moves can be eased, and the view can follow a moving body.
 */
import type { View } from '../core/stage';

export const ZOOM_MIN = 1;
/** Deepest zoom on the solar plans. */
export const ZOOM_MAX = 16;

const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));
const ease = (t: number): number => 1 - (1 - t) ** 3;

interface Glide {
  from: View;
  to: View;
  t: number;
  duration: number;
}

export class Camera {
  zoom = 1;
  /** Widest and deepest zoom allowed (the Earth and Moon view, whose paper never moves, goes wider and far deeper). */
  min = ZOOM_MIN;
  max = ZOOM_MAX;
  /** Logical point at the centre of the screen. */
  x: number;
  y: number;
  private glide: Glide | null = null;

  constructor(private w: number, private h: number) {
    this.x = w / 2;
    this.y = h / 2;
  }

  get view(): View { return { zoom: this.zoom, x: this.x, y: this.y }; }

  /** Where the camera is heading (its own view when at rest). */
  get target(): View { return this.glide?.to ?? this.view; }

  /** Whether an eased move is under way. */
  get moving(): boolean { return this.glide !== null; }

  /** At rest on the whole frame. */
  get home(): boolean { return this.zoom === 1 && this.x === this.w / 2 && this.y === this.h / 2 && !this.glide; }

  /** A new logical frame size: keep the same part of the page in view. */
  resize(w: number, h: number): void {
    const fx = this.x / this.w, fy = this.y / this.h;
    this.w = w;
    this.h = h;
    this.x = fx * w;
    this.y = fy * h;
    this.glide = null;
    this.settle();
  }

  /** Keep the screen on the page (zoomed in), or the page on the screen (zoomed out, where a view allows it). */
  private settle(): void {
    this.zoom = clamp(this.zoom, this.min, this.max);
    const hw = this.w / 2 / this.zoom, hh = this.h / 2 / this.zoom;
    this.x = clamp(this.x, Math.min(hw, this.w - hw), Math.max(hw, this.w - hw));
    this.y = clamp(this.y, Math.min(hh, this.h - hh), Math.max(hh, this.h - hh));
  }

  /** Zoom by `factor` keeping the logical point (`lx`, `ly`) where it is on the screen. */
  zoomAt(factor: number, lx: number, ly: number): void {
    this.glide = null;
    const z = clamp(this.zoom * factor, this.min, this.max), k = this.zoom / z;
    this.x = lx - (lx - this.x) * k;
    this.y = ly - (ly - this.y) * k;
    this.zoom = z;
    this.settle();
  }

  /** Pan by a logical distance as seen at the current zoom (a drag moves the page with the finger). */
  panBy(dx: number, dy: number): void {
    this.glide = null;
    this.x -= dx;
    this.y -= dy;
    this.settle();
  }

  /** Centre on a logical point at once (following a body). */
  centre(lx: number, ly: number): void {
    this.x = lx;
    this.y = ly;
    this.settle();
  }

  /** Ease to a view over `duration` seconds (0 jumps). */
  glideTo(to: View, duration = 0.7): void {
    const target = { zoom: clamp(to.zoom, this.min, this.max), x: to.x, y: to.y };
    if (duration <= 0) {
      Object.assign(this, target);
      this.glide = null;
      this.settle();
      return;
    }
    this.glide = { from: this.view, to: target, t: 0, duration };
  }

  /** Move an eased move's destination (a body it is gliding towards has moved on). */
  retarget(x: number, y: number): void {
    if (this.glide) this.glide.to = { ...this.glide.to, x, y };
  }

  /** Back to the whole frame. */
  reset(duration = 0.6): void {
    this.glideTo({ zoom: 1, x: this.w / 2, y: this.h / 2 }, duration);
  }

  /** Advance an eased move by `dt` seconds. */
  step(dt: number): void {
    const g = this.glide;
    if (!g) return;
    g.t = Math.min(1, g.t + dt / g.duration);
    const e = ease(g.t);
    // zoom eases in log space, so a big zoom does not rush at its start
    this.zoom = Math.exp(Math.log(g.from.zoom) + (Math.log(g.to.zoom) - Math.log(g.from.zoom)) * e);
    this.x = g.from.x + (g.to.x - g.from.x) * e;
    this.y = g.from.y + (g.to.y - g.from.y) * e;
    if (g.t >= 1) this.glide = null;
    this.settle();
  }
}
