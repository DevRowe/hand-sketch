/**
 * Trails for the top-down pieces that draw none of their own, when a viewer asks for them (the live explorer; a
 * render's sky carries no trails, so renders never draw these). A trail is the arc of the orbit the planet has just
 * swept, tapering and fading back from it, in the piece's own colour.
 */
import { clamp, TAU } from '../../core/math';
import { C, planetAngle, type Planet } from './common';
import { trailSweep, type Sky } from './sky';

export interface OrbitTrailStyle {
  color: string;
  /** Width at the planet, design units. */
  width: number;
  /** Strength at the planet, 0..1. */
  alpha?: number;
  /** How much of the width is left at the tail, 0..1. */
  tail?: number;
  /** Line ends. */
  cap?: CanvasLineCap;
}

/** Draw planet `p`'s trail under `sky` onto `ctx`, in design units. */
export function orbitTrail(ctx: CanvasRenderingContext2D, p: Planet, sky: Sky, o: OrbitTrailStyle): void {
  if (!sky.trails) return;
  const { sweep, alpha } = trailSweep(sky, p.k, 0);
  if (sweep <= 0 || alpha <= 0) return;
  const a = planetAngle(p, sky), steps = clamp(Math.round((sweep * p.a) / 9), 6, 120), tail = o.tail ?? 0.25;
  ctx.save();
  ctx.strokeStyle = o.color;
  ctx.lineCap = o.cap ?? 'round';
  const base = ctx.globalAlpha * alpha * (o.alpha ?? 1);
  for (let j = 0; j < steps; j++) {
    const u0 = j / steps, u1 = Math.min(1, (j + 1.3) / steps);
    ctx.globalAlpha = base * (1 - u0) ** 1.5;
    ctx.lineWidth = o.width * (1 - (1 - tail) * u0);
    ctx.beginPath();
    // behind the planet: it runs counter-clockwise on the page, so its past lies at larger angles
    ctx.arc(C[0], C[1], p.a, a + u0 * sweep, a + Math.min(u1 * sweep, TAU));
    ctx.stroke();
  }
  ctx.restore();
}
