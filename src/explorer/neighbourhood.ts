/**
 * The Earth and Moon view's own annotations, drawn over the style like the moments' geometry: the gap to the Moon,
 * measured live (km, light-seconds, Earths side by side), and which way the sunlight comes from.
 */
import type { Vec2 } from '../core/math';
import { C, EARTH_R, moonAt, onPage, sunAngle, units } from '../scenes/cislunar/common';
import type { App } from './app';
import { moonMarkR } from './bodies';
import { GOLD, text } from './overlays';

const HALO = 'rgba(13,15,21,0.6)';
const C_KM_S = 299_792.458;

/** Pixels the gap must span on screen before it is measured. */
const GAP_LEAST = 200;

export function drawNeighbourhood(ctx: CanvasRenderingContext2D, app: App, busy: boolean): void {
  const k = 1 / app.renderer.designScale;
  drawSunward(ctx, app, k);
  if (!busy) drawGap(ctx, app, k);
}

/** A dashed line from the Earth's limb to the Moon's, captioned with the distance between their centres. */
function drawGap(ctx: CanvasRenderingContext2D, app: App, k: number): void {
  const day = app.sim.day, m = moonAt(day), [mx, my] = onPage(m), d = Math.hypot(m[0], m[1], m[2]);
  const [sx0, sy0] = app.renderer.toScreen(C[0], C[1]), [sx1, sy1] = app.renderer.toScreen(mx, my);
  if (Math.hypot(sx1 - sx0, sy1 - sy0) < GAP_LEAST) return;
  const ux = (mx - C[0]) / Math.hypot(mx - C[0], my - C[1]), uy = (my - C[1]) / Math.hypot(mx - C[0], my - C[1]);
  const e = units(EARTH_R) + 6 * k, r = moonMarkR(app.camera.zoom) + 6 * k;
  const a: Vec2 = [C[0] + ux * e, C[1] + uy * e], b: Vec2 = [mx - ux * r, my - uy * r];
  ctx.save();
  ctx.lineCap = 'round';
  ctx.setLineDash([2 * k, 6 * k]);
  for (const [color, w] of [[HALO, 3], ['rgba(255,244,220,0.7)', 1.2]] as const) {
    ctx.strokeStyle = color;
    ctx.lineWidth = w * k;
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.stroke();
  }
  ctx.restore();
  const mid: Vec2 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], earths = d / (2 * EARTH_R);
  // the caption stands off the line, on the side away from the page's centre line
  const nx = -uy, ny = ux, side = ny > 0 ? 1 : -1;
  text(ctx, app, [mid[0] + nx * side * 14 * k, mid[1] + ny * side * 14 * k + 4 * k], `${Math.round(d).toLocaleString('en-GB')} km · ${(d / C_KM_S).toFixed(2)} light-seconds · ${earths.toFixed(0)} Earths across`, 'center', 0.92);
}

/** Where the sunlight comes from: a short gold arrow near the edge of the room, pointing at the Earth. */
function drawSunward(ctx: CanvasRenderingContext2D, app: App, k: number): void {
  const a = sunAngle(app.sim.day), r = app.freeRect(), [ex, ey] = app.renderer.toScreen(C[0], C[1]);
  // the point where a ray from the Earth towards the Sun leaves the room, pulled in a little
  const dx = Math.cos(a), dy = Math.sin(a), pad = 34;
  const tx = dx > 0 ? (r.x + r.w - pad - ex) / dx : dx < 0 ? (r.x + pad - ex) / dx : Infinity;
  const ty = dy > 0 ? (r.y + r.h - pad - ey) / dy : dy < 0 ? (r.y + pad - ey) / dy : Infinity;
  const t = Math.min(tx, ty);
  if (!(t > 60)) return;
  // that screen point back in design units
  const [lx, ly] = app.renderer.toLogical(ex + dx * t, ey + dy * t), fr = app.renderer.fit;
  const px = (lx - fr.ox) / fr.s, py = (ly - fr.oy) / fr.s, L = 26 * k, head = 7 * k;
  const tip: Vec2 = [px - dx * L, py - dy * L], tail: Vec2 = [px, py];
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const [color, w] of [[HALO, 4], [GOLD, 1.8]] as const) {
    ctx.strokeStyle = color;
    ctx.lineWidth = w * k;
    ctx.beginPath();
    ctx.moveTo(tail[0], tail[1]);
    ctx.lineTo(tip[0], tip[1]);
    ctx.moveTo(tip[0] + (dx * Math.cos(0.5) - dy * Math.sin(0.5)) * head, tip[1] + (dy * Math.cos(0.5) + dx * Math.sin(0.5)) * head);
    ctx.lineTo(tip[0], tip[1]);
    ctx.lineTo(tip[0] + (dx * Math.cos(-0.5) - dy * Math.sin(-0.5)) * head, tip[1] + (dy * Math.cos(-0.5) + dx * Math.sin(-0.5)) * head);
    ctx.stroke();
  }
  ctx.restore();
  const below = dy < -0.5 ? 1 : -1;
  text(ctx, app, [tail[0], tail[1] + (below > 0 ? 16 : -8) * k], 'Sunlight', dx > 0.5 ? 'right' : dx < -0.5 ? 'left' : 'center', 0.9);
}
