/**
 * Riso colour separations. Draw each ink's coverage in black/grey on a white plate, then print plates in
 * order with multiply blending, as rotated halftone dots. Overlaps mix like ink on paper.
 * Ported from alesha-pro/tools skills/hand-drawn-canvas-animation/assets/core.js `plate`/`printPlate` (MIT), see NOTICE.
 */
import { clamp, TAU } from '../core/math';
import { rng } from '../core/random';
import type { Ctx, Stage } from '../core/stage';

/** A white full-frame plate at output resolution, transformed to logical units, ready to draw coverage on. */
export function plate(stage: Stage, key: string): { canvas: HTMLCanvasElement; ctx: Ctx } {
  const canvas = stage.layer(`plate:${key}`), ctx = stage.context(canvas);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  stage.reset(ctx);
  ctx.fillStyle = '#000';
  return { canvas, ctx };
}

export interface PrintOptions {
  ink: string;
  cell?: number;
  angle?: number;
  jitter?: number;
  seed?: number;
  /** Coverage multiplier. */
  gain?: number;
  /** Coverage ceiling, so paper always shows between dots. */
  maxCoverage?: number;
  blend?: GlobalCompositeOperation;
  alpha?: number;
}

/** Print a plate onto `ctx` (logical transform expected) as halftone dots in `ink`. */
export function printPlate(ctx: Ctx, stage: Stage, plateCanvas: HTMLCanvasElement, o: PrintOptions): void {
  const { ink, cell = 7, angle = 0.26, jitter = 0.2, seed = 1, gain = 1, maxCoverage = 0.78, blend = 'multiply', alpha = 0.95 } = o;
  const r = rng(seed), W = stage.w, H = stage.h;
  const sw = Math.ceil(W / cell), sh = Math.ceil(H / cell);
  const cov = stage.layer('plate:coverage', sw, sh), g = cov.getContext('2d', { willReadFrequently: true });
  if (!g) throw new Error('2D canvas context unavailable');
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, sw, sh);
  g.drawImage(plateCanvas, 0, 0, sw, sh);
  const d = g.getImageData(0, 0, sw, sh).data;
  ctx.save();
  stage.reset(ctx);
  ctx.globalCompositeOperation = blend;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = ink;
  ctx.beginPath();
  const R = Math.hypot(W, H) / 2, ca = Math.cos(angle), sa = Math.sin(angle);
  for (let v = -R; v <= R; v += cell) {
    for (let u = -R; u <= R; u += cell) {
      const x = W / 2 + ca * u - sa * v + (r() - 0.5) * jitter * cell, y = H / 2 + sa * u + ca * v + (r() - 0.5) * jitter * cell;
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const k = (Math.floor(y / cell) * sw + Math.floor(x / cell)) * 4;
      const c = clamp((1 - (d[k]! * 0.299 + d[k + 1]! * 0.587 + d[k + 2]! * 0.114) / 255) * gain, 0, maxCoverage);
      if (c < 0.03) continue;
      const rad = cell * 0.62 * Math.sqrt(c);
      ctx.moveTo(x + rad, y);
      ctx.arc(x, y, rad, 0, TAU);
    }
  }
  ctx.fill();
  ctx.restore();
}
