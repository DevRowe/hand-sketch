/**
 * Finishes: how a flat fill gets its texture (hatching, grain, halftone dots).
 * Ported from alesha-pro/tools skills/hand-drawn-canvas-animation/assets/core.js (MIT), see NOTICE.
 * Every mark of a layer goes into one path and one fill/stroke call: that is what keeps 50k marks cheap.
 */
import { clamp, TAU } from '../core/math';
import type { Ctx } from '../core/stage';
import { rng } from '../core/random';
import type { Finish, Palette } from './palette';

export type Box = readonly [number, number, number, number];

export interface HatchOptions { angle?: number; gap?: number; len?: number; jitter?: number; color: string; alpha?: number; width?: number; seed?: number }

/** Short parallel strokes on a rotated grid, clipped to `path`. */
export function hatch(ctx: Ctx, path: Path2D, box: Box, o: HatchOptions): void {
  const { angle = 0.9, gap = 7, len = 14, jitter = 6, color, alpha = 0.35, width = 1.2, seed = 1 } = o;
  const r = rng(seed);
  ctx.save();
  ctx.clip(path);
  ctx.strokeStyle = color;
  ctx.globalAlpha *= alpha;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  const [bx, by, bw, bh] = box, cx = bx + bw / 2, cy = by + bh / 2, R = Math.hypot(bw, bh) / 2, ca = Math.cos(angle), sa = Math.sin(angle);
  ctx.beginPath();
  for (let v = -R; v <= R; v += gap) {
    for (let u = -R; u <= R; u += len * 1.7) {
      const uu = u + (r() - 0.5) * jitter * 2, L = len * (0.6 + r() * 0.8);
      const x0 = cx + ca * uu - sa * v + (r() - 0.5) * jitter * 0.6, y0 = cy + sa * uu + ca * v + (r() - 0.5) * jitter * 0.6;
      ctx.moveTo(x0, y0);
      ctx.lineTo(x0 + ca * L, y0 + sa * L);
    }
  }
  ctx.stroke();
  ctx.restore();
}

/** `n` seeded speckles clipped to `path`. */
export function grain(ctx: Ctx, path: Path2D, box: Box, n: number, color: string, alpha: number, seed: number, size = 1.8): void {
  const r = rng(seed);
  ctx.save();
  ctx.clip(path);
  ctx.fillStyle = color;
  ctx.globalAlpha *= alpha;
  ctx.beginPath();
  for (let i = 0; i < n; i++) ctx.rect(box[0] + r() * box[2], box[1] + r() * box[3], size * (0.4 + r()), size * (0.4 + r()));
  ctx.fill();
  ctx.restore();
}

export interface DotScreenOptions { cell?: number; color: string; density?: number | ((x: number, y: number) => number); angle?: number; jitter?: number; seed?: number; alpha?: number; square?: boolean }

/** Halftone dots clipped to `path`; dot area carries the tone. `density` may vary over the plane. */
export function dotScreen(ctx: Ctx, path: Path2D, box: Box, o: DotScreenOptions): void {
  const { cell = 7, color, density = 0.5, angle = 0, jitter = 0, seed = 1, alpha = 1, square = false } = o;
  const r = rng(seed), dens = typeof density === 'function' ? density : () => density;
  ctx.save();
  ctx.clip(path);
  ctx.fillStyle = color;
  ctx.globalAlpha *= alpha;
  const [bx, by, bw, bh] = box, cx = bx + bw / 2, cy = by + bh / 2, R = Math.hypot(bw, bh) / 2, ca = Math.cos(angle), sa = Math.sin(angle);
  ctx.beginPath();
  for (let v = -R; v <= R; v += cell) {
    for (let u = -R; u <= R; u += cell) {
      const x = cx + ca * u - sa * v + (r() - 0.5) * jitter * cell, y = cy + sa * u + ca * v + (r() - 0.5) * jitter * cell;
      const d = clamp(dens(x, y), 0, 1);
      if (d <= 0) continue;
      const rad = cell * 0.62 * Math.sqrt(d);
      if (square) ctx.rect(x - rad, y - rad, rad * 2, rad * 2);
      else { ctx.moveTo(x + rad, y); ctx.arc(x, y, rad, 0, TAU); }
    }
  }
  ctx.fill();
  ctx.restore();
}

export interface SurfaceOptions { finish?: Finish; color?: string; seed?: number; density?: number; angle?: number; gap?: number; len?: number; alpha?: number; width?: number; grain?: number; cell?: number }

/** Texture a filled shape according to the palette's finish (or `o.finish`). */
export function surface(ctx: Ctx, pal: Palette, path: Path2D, box: Box, o: SurfaceOptions = {}): void {
  const f = o.finish ?? pal.finish, color = o.color ?? pal.shade, seed = o.seed ?? 1, density = o.density ?? 0.5;
  if (f === 'ink') {
    hatch(ctx, path, box, { angle: o.angle ?? 1.2, gap: o.gap ?? 4.5, len: o.len ?? 9, jitter: 3, color, alpha: o.alpha ?? 0.35, width: o.width ?? 1, seed });
    grain(ctx, path, box, o.grain ?? 140, color, 0.35, seed + 1, 1.4);
  } else if (f === 'riso') {
    dotScreen(ctx, path, box, { cell: o.cell ?? 7, color, density, angle: o.angle ?? 0.26, jitter: 0.35, seed, alpha: o.alpha ?? 0.9 });
  } else if (f === 'screen') {
    dotScreen(ctx, path, box, { cell: o.cell ?? 6, color, density, angle: o.angle ?? 0, jitter: 0.06, seed, alpha: o.alpha ?? 0.9 });
  } else if (f === 'pencil') {
    hatch(ctx, path, box, { angle: o.angle ?? 1.1, gap: o.gap ?? 9, len: o.len ?? 30, jitter: 4, color, alpha: o.alpha ?? 0.22, width: 0.7, seed });
    grain(ctx, path, box, o.grain ?? 40, color, 0.3, seed + 1, 1.2);
  }
}
