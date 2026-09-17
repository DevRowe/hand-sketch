/**
 * Drawn transitions between scenes.
 * The blot wipe follows the ink-blot reveal of alesha-pro/tools hand-drawn-canvas-animation (MIT, see NOTICE),
 * with a coherent-noise contour so the blob edge is organic rather than per-vertex jitter.
 */
import { clamp, easeInOut, TAU } from './math';
import { loopNoise, rng } from './random';
import type { Ctx, Stage } from './stage';

export interface BlotOptions {
  seed: number;
  center?: readonly [number, number];
  fringe?: string;
}

export function blotPath(cx: number, cy: number, R: number, seed: number, points = 120): Path2D {
  const p = new Path2D();
  for (let k = 0; k < points; k++) {
    const u = k / points, a = u * TAU;
    const rr = R * (1 + loopNoise(u, seed, 1.6) * 0.34 + loopNoise(u, seed + 3, 5) * 0.08);
    const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
    if (k) p.lineTo(x, y); else p.moveTo(x, y);
  }
  p.closePath();
  return p;
}

/**
 * Reveal `incoming` over `outgoing` inside a growing ink blot. Both are output-resolution layers.
 * `progress` 0..1; the bristly fringe is seeded once, so it grows with the blot instead of boiling.
 */
export function blotWipe(ctx: Ctx, stage: Stage, outgoing: HTMLCanvasElement, incoming: HTMLCanvasElement, progress: number, o: BlotOptions): void {
  const [fx, fy] = o.center ?? [0.5, 0.5];
  const cx = stage.w * fx, cy = stage.h * fy;
  const reach = Math.hypot(Math.max(cx, stage.w - cx), Math.max(cy, stage.h - cy)) * 1.4;
  // ink spreads fast then slows as it soaks in, but starts from a drop rather than jumping to half the frame
  const R = easeInOut(clamp(progress, 0, 1)) * reach;
  stage.blit(ctx, outgoing);
  if (R <= 0) return;
  ctx.save();
  stage.reset(ctx);
  ctx.clip(blotPath(cx, cy, R, o.seed));
  stage.blit(ctx, incoming);
  ctx.restore();

  ctx.save();
  stage.reset(ctx);
  const r = rng(o.seed);
  ctx.strokeStyle = o.fringe ?? '#1e1630';
  ctx.lineCap = 'round';
  ctx.globalAlpha = 0.85 * (1 - clamp((progress - 0.8) / 0.2, 0, 1));
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  for (let i = 0; i < 420; i++) {
    const u = r(), a = u * TAU, edge = R * (1 + loopNoise(u, o.seed, 1.6) * 0.34 + loopNoise(u, o.seed + 3, 5) * 0.08);
    const inset = (r() - 0.3) * 18, L = 8 + r() * 34;
    const x = cx + Math.cos(a) * (edge + inset), y = cy + Math.sin(a) * (edge + inset);
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a + (r() - 0.5) * 0.3) * L, y + Math.sin(a + (r() - 0.5) * 0.3) * L);
  }
  ctx.stroke();
  // a few splatter dots just outside the edge
  ctx.fillStyle = o.fringe ?? '#1e1630';
  ctx.beginPath();
  for (let i = 0; i < 60; i++) {
    const u = r(), a = u * TAU, edge = R * (1 + loopNoise(u, o.seed, 1.6) * 0.34), d = edge + 20 + r() * 60, s = 1 + r() * 3.5;
    ctx.moveTo(cx + Math.cos(a) * d + s, cy + Math.sin(a) * d);
    ctx.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, s, 0, TAU);
  }
  ctx.fill();
  ctx.restore();
}
