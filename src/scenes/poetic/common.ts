/**
 * Shared pieces of the poetic set: the stock (paper, texture and a vignette that gathers the eye), light (a soft
 * bloom under a halftone glow), breath and pen clocks, and rising wisps of steam or smoke.
 *
 * The grammar of the set: one stock, one drawing hand, one feeling ink (`MOODS[*].inks[0]`). Motion is slow and
 * eased like breath; each piece has one turn, lands it, and then rests in a seamless loop.
 */
import { dotScreen } from '../../art/finishes';
import { drawPaper } from '../../art/paper';
import { parseColor } from '../../art/color';
import { clamp, TAU, type Vec2 } from '../../core/math';
import { noise1 } from '../../core/random';
import type { SceneFrame } from '../../core/scene';
import { drawStrokeRange, prepareStroke, type PreparedStroke, type StrokeStyle } from '../../core/stroke';
import { track, type Key } from '../../core/track';

export { coverage, fillPoly, fit, group, loopClock, nf, perSize, place, sec, withAlpha, type Fit } from '../kit';

export interface StockOptions {
  seed?: number;
  texture?: number;
  /** 0..1 darkening towards the corners, in `vignetteColor` (default: the stock's own shade). */
  vignette?: number;
  vignetteColor?: string;
}

/** Paper plus a radial vignette, built once per size into a cached layer and blitted, so the stock never boils. */
export function stock(f: SceneFrame, color: string, o: StockOptions = {}): void {
  const { seed = 11, texture = 0.9, vignette = 0.35, vignetteColor } = o;
  const { stage, ctx } = f;
  const key = `poetic-stock:${color}:${seed}:${texture}:${vignette}:${vignetteColor ?? ''}`;
  const fresh = !stage.hasLayer(key), layer = stage.layer(key);
  if (fresh) {
    const g = stage.context(layer);
    drawPaper(g, stage, { color, seed, texture });
    if (vignette > 0) {
      stage.reset(g);
      const [r, gr, b] = parseColor(vignetteColor ?? '#000000');
      const R = Math.hypot(stage.w, stage.h) / 2;
      const grad = g.createRadialGradient(stage.cx, stage.cy, R * 0.35, stage.cx, stage.cy, R);
      grad.addColorStop(0, `rgba(${r},${gr},${b},0)`);
      grad.addColorStop(1, `rgba(${r},${gr},${b},${vignette})`);
      g.fillStyle = grad;
      g.fillRect(0, 0, stage.w, stage.h);
    }
  }
  stage.blit(ctx, layer);
}

export interface GlowOptions {
  /** Halftone cell in logical units. */
  cell?: number;
  /** Falloff exponent of the dot density from the centre. */
  falloff?: number;
  /** Peak dot density at the centre, 0..1. */
  density?: number;
  /** Alpha of the soft bloom laid under the dots (0 = dots only). */
  bloom?: number;
  angle?: number;
  seed?: number;
  blend?: GlobalCompositeOperation;
}

/**
 * Light as print: a soft radial bloom with a halftone glow over it, both fading from `(x, y)` out to `radius`.
 * `amount` 0..1 scales the whole light (fade it in, breathe it).
 */
export function glow(f: SceneFrame, x: number, y: number, radius: number, color: string, amount: number, o: GlowOptions = {}): void {
  if (amount <= 0 || radius <= 0) return;
  const { cell = 8, falloff = 2, density = 0.75, bloom = 0.35, angle = 0.26, seed = 5, blend = 'source-over' } = o;
  const { ctx } = f;
  ctx.save();
  ctx.globalCompositeOperation = blend;
  if (bloom > 0) {
    const [r, g, b] = parseColor(color);
    const grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
    grad.addColorStop(0, `rgba(${r},${g},${b},${clamp(bloom * amount, 0, 1)})`);
    grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }
  const disc = new Path2D();
  disc.arc(x, y, radius, 0, TAU);
  dotScreen(ctx, disc, [x - radius, y - radius, radius * 2, radius * 2], {
    color, cell, angle, jitter: 0.2, seed,
    density: (px, py) => amount * density * Math.pow(Math.max(0, 1 - Math.hypot(px - x, py - y) / radius), falloff),
  });
  ctx.restore();
}

/**
 * Draw something only where a light reaches it: `draw` paints into an offscreen layer (through a frame whose `ctx`
 * is the layer), which is then masked by a radial falloff around `(x, y)` and composited. `floor` is how much
 * survives outside the light (0 = the dark swallows it).
 */
export function lit(f: SceneFrame, key: string, x: number, y: number, radius: number, draw: (g: SceneFrame) => void, floor = 0): void {
  const { stage } = f;
  if (radius <= 0 && floor <= 0) return;
  const layer = stage.layer(`lit:${key}`), g = stage.context(layer);
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, layer.width, layer.height);
  stage.reset(g);
  draw({ ...f, ctx: g });
  stage.reset(g);
  g.globalCompositeOperation = 'destination-in';
  if (radius > 0) {
    const mask = g.createRadialGradient(x, y, 0, x, y, radius);
    mask.addColorStop(0, 'rgba(0,0,0,1)');
    mask.addColorStop(0.45, `rgba(0,0,0,${0.55 + 0.45 * floor})`);
    mask.addColorStop(1, `rgba(0,0,0,${floor})`);
    g.fillStyle = mask;
  } else {
    g.fillStyle = `rgba(0,0,0,${floor})`;
  }
  g.fillRect(0, 0, stage.w, stage.h);
  stage.reset(g);
  stage.blit(f.ctx, layer);
}

/** Cosine ease, softer than the cubic: a breath in and out. */
export const ease = (t: number): number => 0.5 - 0.5 * Math.cos(Math.PI * clamp(t, 0, 1));

/** 0..1..0 over one loop period, `cycles` times: periodic in `phase` by construction. */
export const breath = (phase: number, cycles = 1): number => 0.5 - 0.5 * Math.cos(TAU * phase * cycles);

/**
 * A hand's progress through a stroke over drawn frames, keyed as [frame, progress] pairs (with an optional ease per
 * key): hesitations are keys that barely move, a quickening is keys that close in.
 */
export function pen(keys: readonly (readonly [number, number] | readonly [number, number, Key['ease']])[]): (frame: number) => number {
  return track(keys.map(([frame, value, e]) => ({ frame, value, ease: e ?? 'inOut' })));
}

/** A rising wisp: a soft S drifting sideways as it climbs from `base` by `height`, seeded. */
export function wispPath(base: Vec2, height: number, seed: number, sway = 1): Vec2[] {
  const pts: Vec2[] = [];
  const n = 40;
  for (let k = 0; k <= n; k++) {
    const u = k / n;
    const drift = (noise1(u * 1.8, seed) * 150 + Math.sin(u * 6.5 + seed) * 26 * u) * sway * (0.2 + u);
    pts.push([base[0] + drift, base[1] - u * height]);
  }
  return pts;
}

const wispCache = new Map<string, PreparedStroke>();

/**
 * Draw a wisp at age `u` in [0, 1]: its head rises along the path while its tail dissolves after it, thinning
 * and fading as it climbs. Pure in (base, height, seed, style, u); preparation is cached.
 */
export function drawWisp(f: SceneFrame, base: Vec2, height: number, seed: number, style: StrokeStyle, u: number, o: { length?: number; sway?: number; alpha?: number } = {}): void {
  const { length = 0.45, sway = 1, alpha = 1 } = o;
  if (u <= 0 || u >= 1 || alpha <= 0) return;
  const key = `${base[0]}:${base[1]}:${height}:${seed}:${sway}:${JSON.stringify(style)}`;
  let s = wispCache.get(key);
  if (!s) wispCache.set(key, (s = prepareStroke(wispPath(base, height, seed, sway), style, seed)));
  const head = u * (1 + length), tail = head - length;
  const fade = Math.min(1, u / 0.15) * Math.pow(1 - u, 1.3);
  f.ctx.save();
  f.ctx.globalAlpha *= alpha * fade;
  drawStrokeRange(f.ctx, s, Math.max(0, tail), Math.min(1, head), { taperStart: style.size * 10, taperEnd: style.size * 8 });
  f.ctx.restore();
}
