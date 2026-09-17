/**
 * Puppets: a drawing prepared once in its own local units and drawn anywhere under a transform.
 *
 * Documents, items, stones and stamps move; re-preparing their strokes at every new position would cost a full
 * wobble pass per frame and make their hand shimmer as they travel. A puppet's stroke groups live in local units
 * around its own origin, so `prepared()` caches them once per boil step, and many instances share that preparation.
 * A puppet may run its own clock (its strokes drawing on after it appears) and boil independently of the scene.
 */
import { drawGroup, type Slot, type StrokeGroup } from './ink';
import type { Vec2 } from './math';
import type { SceneFrame } from './scene';

export interface PuppetFill {
  /** Polygon in local units. */
  readonly pts: readonly Vec2[];
  readonly color: string;
  readonly alpha?: number;
}

export interface Puppet {
  /** Flat fills drawn first, e.g. a paper-coloured backing so the puppet occludes what it passes over. */
  readonly fills?: readonly PuppetFill[];
  /** Stroke groups in local units, drawn in order after the fills. */
  readonly groups: readonly StrokeGroup[];
}

export interface Pose {
  x: number;
  y: number;
  /** Radians. */
  rotation?: number;
  /** Uniform scale, multiplied by `sx` / `sy` when given. */
  scale?: number;
  sx?: number;
  sy?: number;
  alpha?: number;
}

export interface PuppetDrawOptions {
  /** Boil step for the puppet's own strokes. Default 0. */
  boil?: number;
  /** The puppet's local clock in seconds, for `slots`. Default: everything fully drawn. */
  t?: number;
  /** Per-group stroke timing on the puppet's clock. */
  slots?: readonly (readonly Slot[] | undefined)[];
  /** Draw extra things in the puppet's local space after its groups (a tick, an accent plate mark). */
  extra?: (ctx: CanvasRenderingContext2D) => void;
}

/** Apply a pose to `ctx` (translate, rotate, scale) inside the caller's save/restore. */
export function applyPose(ctx: CanvasRenderingContext2D, pose: Pose): void {
  const s = pose.scale ?? 1;
  ctx.translate(pose.x, pose.y);
  if (pose.rotation) ctx.rotate(pose.rotation);
  if (s !== 1 || pose.sx !== undefined || pose.sy !== undefined) ctx.scale(s * (pose.sx ?? 1), s * (pose.sy ?? 1));
  if (pose.alpha !== undefined) ctx.globalAlpha *= pose.alpha;
}

/** Map a local point of a posed puppet to scene units. */
export function posePoint(pose: Pose, p: Vec2): Vec2 {
  const s = pose.scale ?? 1, x = p[0] * s * (pose.sx ?? 1), y = p[1] * s * (pose.sy ?? 1);
  const c = Math.cos(pose.rotation ?? 0), n = Math.sin(pose.rotation ?? 0);
  return [pose.x + x * c - y * n, pose.y + x * n + y * c];
}

export function drawPuppet(f: SceneFrame, puppet: Puppet, pose: Pose, o: PuppetDrawOptions = {}): void {
  if (pose.alpha !== undefined && pose.alpha <= 0) return;
  const { ctx } = f;
  ctx.save();
  applyPose(ctx, pose);
  for (const fill of puppet.fills ?? []) {
    ctx.save();
    if (fill.alpha !== undefined) ctx.globalAlpha *= fill.alpha;
    ctx.fillStyle = fill.color;
    ctx.beginPath();
    fill.pts.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  const t = o.t ?? Infinity;
  puppet.groups.forEach((g, k) => drawGroup(f, g, o.slots?.[k] ?? [], o.boil ?? 0, t));
  o.extra?.(ctx);
  ctx.restore();
}
