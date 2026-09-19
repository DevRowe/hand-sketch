/**
 * The explorer's view camera: a uniform zoom and a pan over the drawn frame, in the stage's logical units, and nothing
 * else (no turning, no tilting: the sky keeps its angle). It is separate from the sky and the style, so it never
 * changes what is drawn, only which part of the frame fills the screen. Zoom goes towards a point (the cursor, a
 * pinch's centre). The page always covers the screen's room: the part the controls leave clear (`room`), or else the
 * whole screen. Where the controls cover the screen's edges, the page may slide under them and the view zoom out until
 * the page just covers the room (the page's textures run on past its edge there: `Stage.pageLayer`'s bleed), so the
 * whole of a plan can be seen between a wide screen's top bar and dock. Moves can be eased, and the view can follow a
 * moving body.
 */
import type { View } from '../core/stage';

export const ZOOM_MIN = 1;
/** Deepest zoom on the solar plans. */
export const ZOOM_MAX = 16;

const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));
const ease = (t: number): number => 1 - (1 - t) ** 3;

/** How far the controls reach in from each edge of the screen, logical units at zoom 1. */
export interface Room {
  l: number;
  t: number;
  r: number;
  b: number;
}

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
  /** The screen's room, or null to keep the whole screen on the page (or, zoomed out, the page on the screen). */
  private room: Room | null = null;
  /** The room before it last changed, still honoured while the view eases into the new one. */
  private easing: Room | null = null;

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

  /**
   * The screen's room has changed (the controls moved, or a card opened or closed): the widest zoom follows it, and a
   * view the new room no longer allows eases into it over `glide` seconds instead of jumping.
   */
  setRoom(room: Room | null, glide = 0.5): void {
    const was = this.room;
    if (was === room || (was && room && was.l === room.l && was.t === room.t && was.r === room.r && was.b === room.b)) return;
    this.room = room;
    const target = this.target, fixed = this.allowed({ ...target, zoom: clamp(target.zoom, room ? Math.min(this.min, this.cover(room)) : this.min, this.max) });
    if (glide > 0 && was && room && (fixed.zoom !== target.zoom || fixed.x !== target.x || fixed.y !== target.y)) {
      this.easing = was;
      this.glide = { from: this.view, to: fixed, t: 0, duration: glide };
    } else if (!this.glide) this.settle();
  }

  /** The widest zoom at which the page still covers `room`. */
  private cover(room: Room): number {
    return Math.max((this.w - room.l - room.r) / this.w, (this.h - room.t - room.b) / this.h);
  }

  /** The widest zoom allowed now: the view's own, or wider where the room lets the page slide under the controls. */
  get least(): number {
    const r = this.room, e = this.easing;
    if (!r) return this.min;
    return Math.min(this.min, e ? Math.min(this.cover(r), this.cover(e)) : this.cover(r));
  }

  /** The nearest view to `v`, at its zoom, that keeps `room` on the page. */
  private allowed(v: View, room = this.room): View {
    const zoom = v.zoom;
    return { zoom, x: clamp(v.x, ...this.span(zoom, this.w, room && room.l, room && room.r)), y: clamp(v.y, ...this.span(zoom, this.h, room && room.t, room && room.b)) };
  }

  /**
   * Where the centre may lie along one side of the page `size` long at `zoom`: so the room (between insets `a` and `b`)
   * stays on the page, or with no room the screen on the page (zoomed in) or the page on the screen (zoomed out).
   */
  private span(zoom: number, size: number, a: number | null, b: number | null): [number, number] {
    if (a === null || b === null) {
      const half = size / 2 / zoom;
      return [Math.min(half, size - half), Math.max(half, size - half)];
    }
    const lo = (size / 2 - a) / zoom, hi = size - (size / 2 - b) / zoom;
    return lo <= hi ? [lo, hi] : [(lo + hi) / 2, (lo + hi) / 2];
  }

  /** Keep the room on the page; while easing into a new room, the old one's reach is allowed too. */
  private settle(): void {
    this.zoom = clamp(this.zoom, this.least, this.max);
    const v = this.allowed(this.view), old = this.easing && this.allowed(this.view, this.easing);
    // while easing, anywhere between the two rooms' nearest allowed centres is fine for now
    const between = (a: number, b: number, c: number): boolean => (c - a) * (c - b) <= 0;
    if (!old || !between(v.x, old.x, this.x)) this.x = v.x;
    if (!old || !between(v.y, old.y, this.y)) this.y = v.y;
  }

  /** Zoom by `factor` keeping the logical point (`lx`, `ly`) where it is on the screen. */
  zoomAt(factor: number, lx: number, ly: number): void {
    this.glide = this.easing = null;
    const z = clamp(this.zoom * factor, this.least, this.max), k = this.zoom / z;
    this.x = lx - (lx - this.x) * k;
    this.y = ly - (ly - this.y) * k;
    this.zoom = z;
    this.settle();
  }

  /** Pan by a logical distance as seen at the current zoom (a drag moves the page with the finger). */
  panBy(dx: number, dy: number): void {
    this.glide = this.easing = null;
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
    const target = { zoom: clamp(to.zoom, this.least, this.max), x: to.x, y: to.y };
    if (duration <= 0) {
      Object.assign(this, target);
      this.glide = this.easing = null;
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
    if (g.t >= 1) this.glide = this.easing = null;
    this.settle();
  }
}
