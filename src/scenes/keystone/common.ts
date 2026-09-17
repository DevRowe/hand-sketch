/**
 * Shared pieces of the Keystone set: the colour roles and stroke presets, a design-box fit, cached layouts,
 * and the accent plate. Every Keystone scene follows the same grammar: pencil = the manual process,
 * key ink = the client's tools, accent = the automation; the intro draws once by hand, then the loop section
 * runs by itself.
 */
import { drawPaper } from '../../art/paper';
import { plate, printPlate, type PrintOptions } from '../../art/print';
import { KEYSTONE_ROLES, roleStrokes } from '../../art/roles';
import type { StrokeGroup } from '../../core/ink';
import type { Vec2 } from '../../core/math';
import type { SceneFrame } from '../../core/scene';
import type { StrokeStyle } from '../../core/stroke';

export const R = KEYSTONE_ROLES;
export const S = roleStrokes(R);

/** Default Keystone timing: 7 s scene (84 drawn frames), loop section from 4 s (frame 48), 36-frame loop. */
export const DURATION = 7;
export const LOOP_FROM = 4;

/** A composition designed in a `dw` x `dh` box, fitted uniformly into the frame and centred. */
export interface Fit {
  /** Design point to scene units. */
  P(x: number, y: number): Vec2;
  /** Design length to scene units. */
  s: number;
}

export function fit(w: number, h: number, dw: number, dh: number): Fit {
  const s = Math.min(w / dw, h / dh);
  const ox = w / 2 - (dw / 2) * s, oy = h / 2 - (dh / 2) * s;
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

export function paper(f: SceneFrame): void {
  drawPaper(f.ctx, f.stage, { color: R.stock, seed: 7, texture: 0.8 });
}

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

/** Paint coverage on the accent plate and print it as halftone dots in the accent ink (the one screen angle of the set). */
export function accentPlate(f: SceneFrame, key: string, paint: (g: CanvasRenderingContext2D) => void, o: Partial<PrintOptions> = {}): void {
  const p = plate(f.stage, `keystone:${key}`);
  paint(p.ctx);
  printPlate(f.ctx, f.stage, p.canvas, { ink: R.accent, cell: 7, angle: 0.26, seed: 3, alpha: 0.9, ...o });
}

export function withAlpha(ctx: CanvasRenderingContext2D, alpha: number, draw: () => void): void {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  draw();
  ctx.restore();
}

/** Seconds of drawn frame `frame` on twos, for stroke schedules (which are in seconds). */
export const sec = (frame: number): number => frame / 12;

/** Drawn frames of the loop section at 12 fps. */
export const LOOP = 36;

/** Local time in 12 fps drawn frames (fractional when rendered on ones), so storyboards can key frames directly. */
export const nf = (f: SceneFrame): number => Math.round(f.t * 12 * 1e6) / 1e6;

/** Frame inside the loop section in 12 fps drawn frames, [0, LOOP); -1 in the intro. Phase 1 (the seam) maps to 0. */
export function lf(f: SceneFrame, loop = LOOP): number {
  if (f.loopPhase === null) return -1;
  return (Math.round(f.loopPhase * loop * 1e6) / 1e6) % loop;
}
