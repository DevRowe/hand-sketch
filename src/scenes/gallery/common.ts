/**
 * Shared pieces of the gallery set ("Many Hands"): twenty pieces, each in its own visual language, on one engine.
 *
 * Unlike the Keystone and poetic sets there is no single stock or ink here. What the pieces share is technique:
 * - layers: `still` builds a static layer once per frame size and blits it; `scratch` + `composite` draw a per-frame
 *   layer and lay it down with a blend and a registration offset (how riso inks, woodblock colours and pastel dust
 *   are printed);
 * - page-locked marks: `screen` (halftone dots), `hatchLines` (etched parallel lines) and `stipple` keep their grid
 *   fixed to the page while the shapes they fill move, so tones never swim;
 * - textures: `tooth` (seeded specks, streaks or woodgrain) knocked out of a layer, for pastel on toothy paper,
 *   ink starvation and block-print grain;
 * - wet media: `wash`, a watercolour glaze with a pigment edge;
 * - cut paper: `scissor`, a hand-cut polygon of straight facets;
 * - clocks: most pieces start whole and are all loop (`loopFrom` 0), so `phase` is their clock; periodic helpers
 *   (`wave`, `swell`, `wrap`) keep every motion a whole number of cycles per loop.
 */
import { drawPaper } from '../../art/paper';
import { parseColor } from '../../art/color';
import { arcLengths, pointAtLength, resample } from '../../core/geometry';
import { clamp, TAU, type Vec2 } from '../../core/math';
import { noise1, noise2, rng } from '../../core/random';
import type { SceneFrame } from '../../core/scene';
import type { Ctx } from '../../core/stage';

export { fillPoly, fit, group, loopClock, nf, perSize, place, sec, withAlpha, type Fit } from '../kit';

/* ---------- clocks ---------- */

/** 0..1 through a scene that is all loop (`loopFrom` 0); 1 on the never-shown seam frame, so motion must be periodic. */
export const phase = (f: SceneFrame): number => f.loopPhase ?? 0;

/** sin of `cycles` whole turns over the loop, offset by `offset` of a turn. */
export const wave = (p: number, cycles: number, offset = 0): number => Math.sin(TAU * (p * cycles + offset));

/** 0..1..0, `cycles` times over the loop. */
export const swell = (p: number, cycles = 1, offset = 0): number => 0.5 - 0.5 * Math.cos(TAU * (p * cycles + offset));

/** `x` modulo `m`, always in [0, m). */
export const wrap = (x: number, m: number): number => ((x % m) + m) % m;

/** Cosine ease. */
export const ease = (t: number): number => 0.5 - 0.5 * Math.cos(Math.PI * clamp(t, 0, 1));

/** Smoothstep of `x` through [a, b]. */
export const smooth = (a: number, b: number, x: number): number => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

/* ---------- layers ---------- */

/** A static layer built once per frame size and key by `build` (which must not depend on the frame). */
export function cached(f: SceneFrame, key: string, build: (g: SceneFrame) => void): HTMLCanvasElement {
  const { stage } = f, id = `gallery-still:${key}`;
  const fresh = !stage.hasLayer(id), layer = stage.layer(id);
  if (fresh) {
    const g = stage.context(layer);
    stage.reset(g);
    build({ ...f, ctx: g });
    stage.reset(g);
  }
  return layer;
}

/** A static layer (see `cached`), laid onto the frame. */
export function still(f: SceneFrame, key: string, build: (g: SceneFrame) => void, o: CompositeOptions = {}): void {
  composite(f, cached(f, key, build), o);
}

/** A per-frame layer: cleared, drawn by `draw` in logical units, and returned for `composite`. */
export function scratch(f: SceneFrame, key: string, draw: (g: SceneFrame) => void): HTMLCanvasElement {
  const { stage } = f, layer = stage.layer(`gallery-scratch:${key}`), g = stage.context(layer);
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';
  g.filter = 'none';
  g.clearRect(0, 0, layer.width, layer.height);
  stage.reset(g);
  draw({ ...f, ctx: g });
  stage.reset(g);
  g.filter = 'none';
  return layer;
}

export interface CompositeOptions {
  blend?: GlobalCompositeOperation;
  alpha?: number;
  /** Registration offset in logical units. */
  offset?: Vec2;
}

/** Lay an output-resolution layer onto the frame. */
export function composite(f: SceneFrame, layer: HTMLCanvasElement, o: CompositeOptions = {}): void {
  const { ctx, stage } = f, { blend = 'source-over', alpha = 1, offset = [0, 0] } = o;
  if (alpha <= 0) return;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = blend;
  ctx.globalAlpha = alpha;
  ctx.drawImage(layer, Math.round(offset[0] * stage.scale), Math.round(offset[1] * stage.scale), stage.outW, stage.outH);
  ctx.restore();
}

/* ---------- ground ---------- */

export interface GroundOptions {
  seed?: number;
  texture?: number;
  /** 0..1 darkening towards the corners. */
  vignette?: number;
  vignetteColor?: string;
}

/** Paper stock with an optional vignette, cached as one layer. */
export function ground(f: SceneFrame, color: string, o: GroundOptions = {}): void {
  const { seed = 17, texture = 1, vignette = 0, vignetteColor = '#000000' } = o;
  still(f, `ground:${color}:${seed}:${texture}:${vignette}:${vignetteColor}`, g => {
    drawPaper(g.ctx, g.stage, { color, seed, texture });
    if (vignette > 0) {
      const { stage, ctx } = g, [r, gr, b] = parseColor(vignetteColor), R = Math.hypot(stage.w, stage.h) / 2;
      const grad = ctx.createRadialGradient(stage.cx, stage.cy, R * 0.3, stage.cx, stage.cy, R);
      grad.addColorStop(0, `rgba(${r},${gr},${b},0)`);
      grad.addColorStop(1, `rgba(${r},${gr},${b},${vignette})`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, stage.w, stage.h);
    }
  });
}

/* ---------- textures ---------- */

export interface ToothOptions {
  seed: number;
  /** Marks per 10 000 square logical units. */
  density?: number;
  /** Mark size range in logical units. */
  size?: number;
  /** 'speck' dots, 'streak' short strokes at `angle`, 'grain' long wavy woodgrain lines. */
  kind?: 'speck' | 'streak' | 'grain';
  angle?: number;
  length?: number;
  /** Mark colour (masks only need alpha; a coloured mask can be laid down as marks). */
  color?: string;
}

/** A cached texture mask (opaque marks on transparent), full frame, page-locked. */
export function toothMask(f: SceneFrame, o: ToothOptions): HTMLCanvasElement {
  const { seed, density = 30, size = 2, kind = 'speck', angle = 0, length = 20, color = '#000' } = o;
  const { stage } = f, id = `gallery-tooth:${seed}:${density}:${size}:${kind}:${angle}:${length}:${color}`;
  const fresh = !stage.hasLayer(id), layer = stage.layer(id);
  if (!fresh) return layer;
  const g = stage.context(layer), r = rng(seed), W = stage.w, H = stage.h;
  stage.reset(g);
  g.fillStyle = color;
  g.strokeStyle = color;
  g.lineCap = 'round';
  const n = Math.round((W * H * density) / 10000);
  if (kind === 'speck') {
    g.beginPath();
    for (let i = 0; i < n; i++) {
      const x = r() * W, y = r() * H, s = size * (0.3 + r()), ry = s * (0.5 + r() * 0.5), a = r() * TAU;
      g.moveTo(x + s * Math.cos(a), y + s * Math.sin(a));
      g.ellipse(x, y, s, ry, a, 0, TAU);
    }
    g.fill();
  } else if (kind === 'streak') {
    const ca = Math.cos(angle), sa = Math.sin(angle);
    g.lineWidth = size;
    g.beginPath();
    for (let i = 0; i < n; i++) {
      const x = r() * W, y = r() * H, L = length * (0.3 + r()), j = (r() - 0.5) * 0.3;
      g.moveTo(x, y);
      g.lineTo(x + (ca - sa * j) * L, y + (sa + ca * j) * L);
    }
    g.stroke();
  } else {
    // woodgrain: long faint lines that meander together, with knots of tighter curvature
    g.lineWidth = size;
    for (let i = 0; i < n; i++) {
      const y0 = r() * H, x0 = r() * W - 200, L = length * (0.5 + r()), a = 0.2 + r() * 0.8;
      g.globalAlpha = a;
      g.beginPath();
      for (let s = 0; s <= L; s += 12) {
        const x = x0 + s, y = y0 + noise2(x / 260, y0 / 90, seed) * 22 + noise1(x / 40, seed + i) * 2;
        if (s === 0) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.stroke();
    }
    g.globalAlpha = 1;
  }
  return layer;
}

/** Knock a texture mask out of layer context `g` (ink skipping on paper tooth, grain in a block). */
export function knockOut(f: SceneFrame, g: Ctx, mask: HTMLCanvasElement, alpha: number): void {
  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = 'destination-out';
  g.globalAlpha = alpha;
  g.drawImage(mask, 0, 0, f.stage.outW, f.stage.outH);
  g.restore();
}

export interface InkOptions extends CompositeOptions {
  /** Texture knocked out of the ink before it is laid down. */
  tooth?: ToothOptions & { alpha: number };
}

/** One ink drawn on its own layer, textured, then laid down (multiply by default: overprints mix like ink). */
export function ink(f: SceneFrame, key: string, draw: (g: SceneFrame) => void, o: InkOptions = {}): void {
  const layer = scratch(f, `ink:${key}`, g => {
    draw(g);
    if (o.tooth) knockOut(f, g.ctx, toothMask(f, o.tooth), o.tooth.alpha);
  });
  composite(f, layer, { blend: 'multiply', ...o });
}

/* ---------- page-locked marks ---------- */

type Box = readonly [number, number, number, number];

/** Grid indices [u0, u1] x [v0, v1] of a lattice at `angle` with spacing `cell`, anchored at the page origin, covering `box`. */
function latticeRange(box: Box, cell: number, angle: number): [number, number, number, number] {
  const ca = Math.cos(angle), sa = Math.sin(angle);
  const corners: Vec2[] = [[box[0], box[1]], [box[0] + box[2], box[1]], [box[0], box[1] + box[3]], [box[0] + box[2], box[1] + box[3]]];
  let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
  for (const [x, y] of corners) {
    const u = (x * ca + y * sa) / cell, v = (-x * sa + y * ca) / cell;
    u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v);
  }
  return [Math.floor(u0) - 1, Math.ceil(u1) + 1, Math.floor(v0) - 1, Math.ceil(v1) + 1];
}

export interface ScreenOptions {
  cell?: number;
  angle?: number;
  color: string;
  /** Dot density 0..1 over the plane. */
  density: number | ((x: number, y: number) => number);
  /** Clip to this path first. */
  clip?: Path2D;
  alpha?: number;
}

/** Halftone dots on a page-locked lattice within `box`; dot area carries the tone. */
export function screen(ctx: Ctx, box: Box, o: ScreenOptions): void {
  const { cell = 7, angle = 0.26, color, density, clip, alpha = 1 } = o;
  const dens = typeof density === 'function' ? density : () => density;
  const [u0, u1, v0, v1] = latticeRange(box, cell, angle), ca = Math.cos(angle), sa = Math.sin(angle);
  ctx.save();
  if (clip) ctx.clip(clip);
  ctx.globalAlpha *= alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let v = v0; v <= v1; v++) {
    for (let u = u0; u <= u1; u++) {
      const x = (u * ca - v * sa) * cell, y = (u * sa + v * ca) * cell;
      if (x < box[0] - cell || y < box[1] - cell || x > box[0] + box[2] + cell || y > box[1] + box[3] + cell) continue;
      const d = clamp(dens(x, y), 0, 1);
      if (d <= 0.02) continue;
      const rad = cell * 0.62 * Math.sqrt(d);
      ctx.moveTo(x + rad, y);
      ctx.arc(x, y, rad, 0, TAU);
    }
  }
  ctx.fill();
  ctx.restore();
}

export interface HatchLineOptions {
  angle: number;
  gap: number;
  color: string;
  width?: number;
  alpha?: number;
  /** Amplitude of the hand's waver along each line. */
  waver?: number;
  seed?: number;
  /** Per-line length breaks: 0 = continuous, towards 1 = broken into dashes. */
  breakup?: number;
}

/** Long etched parallel lines on a page-locked lattice, clipped to `clip` and limited to `box`. */
export function hatchLines(ctx: Ctx, clip: Path2D | null, box: Box, o: HatchLineOptions): void {
  const { angle, gap, color, width = 1.1, alpha = 1, waver = 0.8, seed = 3, breakup = 0 } = o;
  const [, , v0, v1] = latticeRange(box, gap, angle), ca = Math.cos(angle), sa = Math.sin(angle);
  const [u0, u1] = latticeRange(box, 1, angle);
  ctx.save();
  if (clip) ctx.clip(clip);
  ctx.globalAlpha *= alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.beginPath();
  const step = 14;
  for (let v = v0; v <= v1; v++) {
    let pen = false;
    for (let u = Math.floor(u0 / step) * step; u <= u1; u += step) {
      const on = breakup <= 0 || noise1(u / 60, seed + v * 7) > breakup - 0.5;
      if (!on) { pen = false; continue; }
      const off = noise1(u / 90, seed + v * 13) * 2 * waver, vv = v * gap + off;
      const x = u * ca - vv * sa, y = u * sa + vv * ca;
      if (pen) ctx.lineTo(x, y); else { ctx.moveTo(x, y); pen = true; }
    }
  }
  ctx.stroke();
  ctx.restore();
}

/** Seeded stipple dots in `box` accepted with probability `density(x, y)`; page-locked for a fixed seed and box. */
export function stipple(ctx: Ctx, box: Box, count: number, density: (x: number, y: number) => number, o: { color: string; size?: number; seed: number; alpha?: number }): void {
  const { color, size = 1.6, seed, alpha = 1 } = o;
  const r = rng(seed);
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < count; i++) {
    const x = box[0] + r() * box[2], y = box[1] + r() * box[3], keep = r(), s = size * (0.55 + r() * 0.7);
    if (keep >= density(x, y)) continue;
    ctx.moveTo(x + s, y);
    ctx.arc(x, y, s, 0, TAU);
  }
  ctx.fill();
  ctx.restore();
}

/* ---------- wet media and cut paper ---------- */

export interface WashOptions {
  alpha?: number;
  seed: number;
  /** How far the edge wanders, in logical units. */
  bleed?: number;
  /** Glaze layers. */
  layers?: number;
  /** Pigment gathered at the edge, 0..1. */
  edge?: number;
}

/** A watercolour glaze: jittered translucent layers of a shape, each with pigment gathered at its edge. */
export function wash(ctx: Ctx, pts: readonly Vec2[], color: string, o: WashOptions): void {
  const { alpha = 0.4, seed, bleed = 8, layers = 3, edge = 0.6 } = o;
  const base = resample([...pts, pts[0]!], 10);
  const [r, g, b] = parseColor(color);
  ctx.save();
  ctx.lineJoin = 'round';
  for (let l = 0; l < layers; l++) {
    const path = new Path2D();
    base.forEach(([x, y], k) => {
      const dx = noise2(x / 70, y / 70, seed + l * 31) * 2 * bleed, dy = noise2(x / 70 + 9, y / 70, seed + l * 31) * 2 * bleed;
      if (k) path.lineTo(x + dx, y + dy); else path.moveTo(x + dx, y + dy);
    });
    path.closePath();
    ctx.fillStyle = `rgba(${r},${g},${b},${alpha / layers})`;
    ctx.fill(path);
    ctx.strokeStyle = `rgba(${r},${g},${b},${(alpha * edge) / layers})`;
    ctx.lineWidth = 2.2;
    ctx.stroke(path);
  }
  ctx.restore();
}

/** A hand-cut outline: the shape walked in straight scissor facets of about `facet` units, each corner nudged. */
export function scissor(pts: readonly Vec2[], seed: number, facet = 26, nudge = 2.2): Vec2[] {
  const closed = [...pts, pts[0]!], s = arcLengths(closed), total = s[s.length - 1]!, r = rng(seed);
  const out: Vec2[] = [];
  for (let d = 0; d < total; d += facet * (0.6 + r() * 0.8)) {
    const [x, y] = pointAtLength(closed, s, d);
    out.push([x + (r() - 0.5) * 2 * nudge, y + (r() - 0.5) * 2 * nudge]);
  }
  return out;
}

/** A closed polygon as a Path2D. */
export function polyPath(pts: readonly Vec2[]): Path2D {
  const p = new Path2D();
  pts.forEach(([x, y], k) => (k ? p.lineTo(x, y) : p.moveTo(x, y)));
  p.closePath();
  return p;
}

/** Points on a circle. */
export const circle = (cx: number, cy: number, r: number, n = 48, start = 0): Vec2[] =>
  Array.from({ length: n }, (_, k): Vec2 => [cx + Math.cos(start + (k / n) * TAU) * r, cy + Math.sin(start + (k / n) * TAU) * r]);

/** Rotate a point about the origin. */
export const rot = ([x, y]: Vec2, a: number): Vec2 => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
