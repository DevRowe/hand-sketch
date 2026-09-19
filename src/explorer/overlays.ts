/**
 * Annotations the jump-to presets draw over the plan: spacecraft paths with their encounters, transfer orbits and
 * sight lines. They are the explorer's own marks, not the style's: one gold ink with a dark halo so they read on
 * light and dark papers alike, and sized in screen pixels so they stay fine at any zoom.
 */
import type { Vec2 } from '../core/math';
import type { App } from './app';

export const GOLD = '#e8a33d';
const HALO = 'rgba(13,15,21,0.6)';
const INK = '#fff4dc';

/** Screen pixels to design units at the current zoom. */
const px = (app: App): number => 1 / app.renderer.designScale;

function haloStroke(ctx: CanvasRenderingContext2D, k: number, width: number, draw: () => void, color = GOLD, dash: number[] = []): void {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.setLineDash(dash.map(d => d * k));
  ctx.strokeStyle = HALO;
  ctx.lineWidth = (width + 2.5) * k;
  draw();
  ctx.stroke();
  ctx.strokeStyle = color;
  ctx.lineWidth = width * k;
  draw();
  ctx.stroke();
  ctx.restore();
}

function polyline(ctx: CanvasRenderingContext2D, pts: readonly Vec2[]): void {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
}

/** A path: solid where it has been flown, dashed and fainter where it is still to come. */
export function drawPath(ctx: CanvasRenderingContext2D, app: App, flown: readonly Vec2[], ahead: readonly Vec2[], color = GOLD): void {
  const k = px(app);
  if (ahead.length > 1) {
    ctx.save();
    ctx.globalAlpha *= 0.7;
    haloStroke(ctx, k, 1.4, () => polyline(ctx, ahead), color, [5, 6]);
    ctx.restore();
  }
  if (flown.length > 1) haloStroke(ctx, k, 2.2, () => polyline(ctx, flown), color);
}

/**
 * A labelled mark: a small ring at an encounter or a launch. The label stands off radially, away from the Sun at
 * the plan's centre, clear of the orbits and of the planets' own names.
 */
export function drawMark(ctx: CanvasRenderingContext2D, app: App, [x, y]: Vec2, label: string, passed: boolean): void {
  const k = px(app);
  ctx.save();
  ctx.lineWidth = 3.5 * k;
  ctx.strokeStyle = HALO;
  ctx.beginPath();
  ctx.arc(x, y, 5 * k, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 1.6 * k;
  ctx.strokeStyle = GOLD;
  ctx.fillStyle = passed ? GOLD : 'rgba(13,15,21,0.75)';
  ctx.fill();
  ctx.stroke();
  if (label) {
    const a = Math.atan2(y - 540, x - 540), ux = Math.cos(a), uy = Math.sin(a);
    const align: CanvasTextAlign = ux > 0.35 ? 'left' : ux < -0.35 ? 'right' : 'center';
    text(ctx, app, [x + ux * 11 * k, y + uy * 11 * k + (uy > 0.35 ? 10 : uy < -0.35 ? -2 : 4) * k], label, align, passed ? 1 : 0.8);
  }
  ctx.restore();
}

/** The spacecraft now: a bright diamond with a soft glow. */
export function drawCraft(ctx: CanvasRenderingContext2D, app: App, [x, y]: Vec2, label: string): void {
  const k = px(app), s = 6.5 * k;
  ctx.save();
  const glow = ctx.createRadialGradient(x, y, 0, x, y, s * 3.2);
  glow.addColorStop(0, 'rgba(255,236,190,0.55)');
  glow.addColorStop(1, 'rgba(255,236,190,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(x - s * 3.2, y - s * 3.2, s * 6.4, s * 6.4);
  ctx.beginPath();
  ctx.moveTo(x, y - s);
  ctx.lineTo(x + s * 0.7, y);
  ctx.lineTo(x, y + s);
  ctx.lineTo(x - s * 0.7, y);
  ctx.closePath();
  ctx.lineWidth = 2.5 * k;
  ctx.strokeStyle = HALO;
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.fill();
  // above: planets carry their own names on the right, and a craft is often just beside one
  if (label) text(ctx, app, [x, y - 13 * k], label, 'center', 1, true);
  ctx.restore();
}

/** A line of sight from `from` through `to`, carried on past it. */
export function drawSight(ctx: CanvasRenderingContext2D, app: App, from: Vec2, to: Vec2, reach = 1.35): void {
  const end: Vec2 = [from[0] + (to[0] - from[0]) * reach, from[1] + (to[1] - from[1]) * reach];
  haloStroke(ctx, px(app), 1.3, () => polyline(ctx, [from, end]), GOLD, [2, 5]);
}

/** Screen pixels a caption keeps from the screen's sides. */
const EDGE = 6;

/**
 * A small caption in the explorer's type, haloed; slid sideways as needed to stay on the screen. It is set in screen
 * pixels (whatever the zoom, type is never scaled from a fraction of a design unit).
 */
export function text(ctx: CanvasRenderingContext2D, app: App, at: Vec2, s: string, align: CanvasTextAlign, alpha = 1, bold = false): void {
  let [x, y] = app.renderer.toScreen(at[0], at[1]);
  ctx.save();
  ctx.setTransform(app.renderer.cssScale, 0, 0, app.renderer.cssScale, 0, 0);
  ctx.globalAlpha *= alpha;
  ctx.font = `${bold ? 600 : 500} 12px Inter, system-ui, sans-serif`;
  const w = ctx.measureText(s).width, left = align === 'left' ? x : align === 'right' ? x - w : x - w / 2;
  if (left < EDGE) x += EDGE - left;
  else if (left + w > innerWidth - EDGE) x -= left + w - innerWidth + EDGE;
  y = Math.round(y);
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 3.5;
  ctx.strokeStyle = HALO;
  ctx.strokeText(s, x, y);
  ctx.fillStyle = INK;
  ctx.fillText(s, x, y);
  ctx.restore();
}
