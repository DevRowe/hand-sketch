/**
 * A faithful reproduction of the reviewed skill's line technique, kept only for side-by-side comparison:
 * per-vertex white-noise jitter on a polyline (`wob`), constant width, revealed with
 * setLineDash([L * progress, L]) where L is the *unjittered* length (`selfDraw`).
 * Source: alesha-pro/tools skills/hand-drawn-canvas-animation/assets/core.js:147 and :270 (MIT), see NOTICE.
 */
import { polylineLength, resample } from './geometry';
import type { Vec2 } from './math';
import { rng } from './random';
import type { Ctx } from './stage';

export interface LegacyStyle { color: string; width: number; alpha?: number; amp?: number }

export function legacyStroke(ctx: Ctx, path: readonly Vec2[], progress: number, seed: number, style: LegacyStyle): void {
  if (progress <= 0 || path.length < 2) return;
  // the skill samples shapes coarsely (ellPts: 44..120 points), so do the same before jittering
  const pts = resample(path, 14);
  const L = polylineLength(pts), r = rng(seed), amp = style.amp ?? 2.5;
  ctx.save();
  ctx.strokeStyle = style.color;
  ctx.globalAlpha *= style.alpha ?? 1;
  ctx.lineWidth = style.width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.setLineDash([L * Math.min(1, progress), L]);
  ctx.beginPath();
  pts.forEach((p, k) => {
    const x = p[0] + (r() - 0.5) * amp, y = p[1] + (r() - 0.5) * amp;
    if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y);
  });
  ctx.stroke();
  ctx.restore();
}
