/**
 * Scene-building kit shared by every scene set: a design-box fit, per-size layout caches, stroke-group and placement
 * shorthands, flat fills, plate coverage greys, and the 12 fps drawn-frame clocks storyboards are keyed on.
 */
import type { StrokeGroup } from '../core/ink';
import type { Vec2 } from '../core/math';
import type { SceneFrame } from '../core/scene';
import type { StrokeStyle } from '../core/stroke';

/** A composition designed in a `dw` x `dh` box, fitted uniformly into the frame and centred. */
export interface Fit {
  /** Design point to scene units. */
  P(x: number, y: number): Vec2;
  /** Design length to scene units. */
  s: number;
}

/** `zoom` > 1 crops into the design box around `focus` (design units, default its centre). */
export function fit(w: number, h: number, dw: number, dh: number, zoom = 1, focus: Vec2 = [dw / 2, dh / 2]): Fit {
  const s = Math.min(w / dw, h / dh) * zoom;
  const ox = w / 2 - focus[0] * s, oy = h / 2 - focus[1] * s;
  return { P: (x, y) => [ox + x * s, oy + y * s], s };
}

/** A layout built once per frame size (a pure function of the size, so it is a legal cache). */
export function perSize<T>(build: (w: number, h: number) => T): (w: number, h: number) => T {
  const cache = new Map<string, T>();
  return (w, h) => {
    const key = `${w}x${h}`;
    let v = cache.get(key);
    if (v === undefined) cache.set(key, (v = build(w, h)));
    return v;
  };
}

export const group = (paths: readonly (readonly Vec2[])[], style: StrokeStyle, seed: number): StrokeGroup => ({ paths, style, seed });

/** Rotate and scale paths about the origin, then translate: glyph (local units) to a position. */
export const place = (paths: readonly (readonly Vec2[])[], x: number, y: number, scale = 1, rotation = 0): Vec2[][] => {
  const c = Math.cos(rotation), n = Math.sin(rotation);
  return paths.map(p => p.map(([px, py]): Vec2 => [x + (px * c - py * n) * scale, y + (px * n + py * c) * scale]));
};

export function fillPoly(ctx: CanvasRenderingContext2D, pts: readonly Vec2[], color: string, alpha = 1): void {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.beginPath();
  pts.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

/** Grey level for plate coverage 0..1. */
export const coverage = (c: number): string => {
  const v = Math.round(255 * (1 - Math.max(0, Math.min(1, c))));
  return `rgb(${v},${v},${v})`;
};

export function withAlpha(ctx: CanvasRenderingContext2D, alpha: number, draw: () => void): void {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  draw();
  ctx.restore();
}

/** Seconds of drawn frame `frame` on twos, for stroke schedules (which are in seconds). */
export const sec = (frame: number): number => frame / 12;

/** Local time in 12 fps drawn frames (fractional when rendered on ones), so storyboards can key frames directly. */
export const nf = (f: SceneFrame): number => Math.round(f.t * 12 * 1e6) / 1e6;

/**
 * Frame inside the loop section in 12 fps drawn frames, [0, loop]; -1 in the intro. It deliberately does not wrap:
 * phase 1 (the never-shown seam frame) is `loop`, so the seam check compares the scene's natural continuation with
 * the loop start instead of the same number twice. Periodic helpers (emitters, boil) do their own modulo.
 */
export function loopClock(f: SceneFrame, loop: number): number {
  if (f.loopPhase === null) return -1;
  return Math.round(f.loopPhase * loop * 1e6) / 1e6;
}
