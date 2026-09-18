/**
 * The Requiem etching kit: one plate language shared by every shot of the montage.
 *
 * Each frame is printed like a two-colour etching on bone paper:
 * - tint: colour wiped into the plate a la poupee (one warm and one cold accent), laid down first with multiply;
 * - tone: each shot paints a darkness map (0 paper .. 1 black) with ordinary fills, gradients and blur;
 * - plate: the map is bitten into line. Five page-locked hatch layers, each at a new angle and a little closer, come in
 *   one after another as the tone deepens: a line appears as a hairline where its layer's threshold is crossed, swells
 *   to its bitten width, and fattens further into the darks, so light passages are single hatching with tapering,
 *   broken ends and shadows are close cross-hatching. Aquatint grain and a solid plate black take the deepest darks.
 *   Then the pen: the stroke engine's needle line in design units, and burnished glints.
 * The plate is roughened by paper tooth and printed with multiply.
 *
 * The hatching never swims: its lines are fixed to the page and only the tone under them moves, so a push-in or a
 * dilating pupil reads as the plate being re-bitten frame by frame. Every shot is designed in a DW x DH box and
 * cover-fitted into its panel (the full frame, or one half of a split screen), so an etching crops like a film frame.
 */
import { alpha, parseColor } from '../../art/color';
import { catmullRom } from '../../core/geometry';
import { clamp, TAU, type Vec2 } from '../../core/math';
import { noise1, rng } from '../../core/random';
import type { SceneFrame } from '../../core/scene';
import type { Ctx } from '../../core/stage';
import { drawStroke, prepareStroke, type PreparedStroke, type StrokeStyle } from '../../core/stroke';
import { cached, composite, ground, knockOut, polyPath, scratch, toothMask } from '../gallery/common';
import { perSize } from '../kit';
import { REQUIEM } from './palette';

export { polyPath };
export const { paper: PAPER, ink: INK, warm: WARM, cold: COLD } = REQUIEM;

/** Design box of every shot. */
export const DW = 1600, DH = 900;

export type Box = readonly [number, number, number, number];

/* ---------- clocks and views ---------- */

/** Where a panel is in its shot and in the montage. */
export interface Clock {
  /** 0..1 through the shot, at drawn-frame centres (a one-frame flash sits at 0.5). */
  readonly u: number;
  /** Seconds since the shot's cut. */
  readonly t: number;
  readonly frame: number;
  readonly frames: number;
  /** 0..1 through the whole montage: the escalation. */
  readonly heat: number;
}

/** Camera on the design box: `zoom` > 1 crops in around `focus` (design units). */
export interface View {
  zoom?: number;
  focus?: Vec2;
}

/** One panel being printed: a layer's context in design units, the panel it is clipped to, and the clock. */
export interface Etch extends Clock {
  readonly f: SceneFrame;
  readonly ctx: Ctx;
  /** Panel in logical units. */
  readonly box: Box;
  /** Design length to logical units. */
  readonly s: number;
  /** Design length to pixels of the layer being drawn (for blur radii). */
  readonly px: number;
  /** Design point to logical units. */
  P(x: number, y: number): Vec2;
  /** In the pen pass: the page-hatch tone at a design point (0 before the tone map exists). */
  tone(x: number, y: number): number;
  /** In the pen pass: the form-engraving tone at a design point, for `engraveCurves`. */
  form(x: number, y: number): number;
}

/** A shot: an optional camera, colour, the tone map, and the pen. */
export interface Shot {
  view?(c: Clock): View;
  tint?(e: Etch): void;
  tone(e: Etch): void;
  line?(e: Etch): void;
}

export interface Panel {
  box: Box;
  shot: Shot;
  clock: Clock;
}

/* ---------- printing ---------- */

function cover(box: Box, v: View): { s: number; ox: number; oy: number } {
  const [bx, by, bw, bh] = box, zoom = v.zoom ?? 1, [fx, fy] = v.focus ?? [DW / 2, DH / 2];
  const s = Math.max(bw / DW, bh / DH) * zoom;
  return { s, ox: bx + bw / 2 - fx * s, oy: by + bh / 2 - fy * s };
}

/** Run a pass for one panel on `ctx`, whose pixels are `px` per logical unit: clipped to the panel, in design units. */
function inPanel(f: SceneFrame, ctx: Ctx, px: number, p: Panel, pass: (e: Etch) => void, T?: ToneMap): void {
  const [bx, by, bw, bh] = p.box, { s, ox, oy } = cover(p.box, p.shot.view?.(p.clock) ?? {});
  ctx.save();
  ctx.setTransform(px, 0, 0, px, 0, 0);
  ctx.beginPath();
  ctx.rect(bx, by, bw, bh);
  ctx.clip();
  ctx.translate(ox, oy);
  ctx.scale(s, s);
  const tone = T ? (x: number, y: number): number => sample(T, T.data, ox + x * s, oy + y * s) : (): number => 0;
  const form = T ? (x: number, y: number): number => sample(T, T.form, ox + x * s, oy + y * s) : (): number => 0;
  pass({ ...p.clock, f, ctx, box: p.box, s, px: px * s, P: (x, y) => [ox + x * s, oy + y * s], tone, form });
  ctx.restore();
}

/** Print one frame: paper, every panel's tint, the bitten plate of every panel's tone, the pen, the seams. */
export function print(f: SceneFrame, panels: readonly Panel[]): void {
  const { stage } = f;
  ground(f, PAPER, { seed: 1601, texture: 0.8 });
  if (panels.some(p => p.shot.tint)) {
    const tint = scratch(f, 'requiem-tint', g => {
      for (const p of panels) if (p.shot.tint) inPanel(f, g.ctx, stage.scale, p, e => p.shot.tint!(e));
    });
    composite(f, tint, { blend: 'multiply' });
  }
  const T = toneMap(f, panels);
  const plate = scratch(f, 'requiem-plate', g => {
    engrave(g.ctx, T, hatchGeometry(stage.w, stage.h));
    aquatint(f, g.ctx, T);
    for (const p of panels) if (p.shot.line) inPanel(f, g.ctx, stage.scale, p, e => p.shot.line!(e), T);
    knockOut(f, g.ctx, toothMask(f, { seed: 1602, density: 26, size: 1.1 }), 0.55);
  });
  composite(f, plate, { blend: 'multiply' });
  // split screens: the plates meet at a pressed edge
  const { ctx } = f;
  for (const p of panels.slice(1)) {
    const [x, y, w, h] = p.box;
    ctx.save();
    ctx.fillStyle = INK;
    if (x > 0) ctx.fillRect(x - 1.5, y, 3, h);
    if (y > 0) ctx.fillRect(x, y - 1.5, w, 3);
    ctx.restore();
  }
}

/* ---------- the tone map ---------- */

/** Tone map pixels per output pixel. */
const TONE_RES = 0.5;

interface ToneMap {
  w: number;
  h: number;
  /** Tone map pixels per logical unit. */
  k: number;
  /** Page-hatch darkness 0..1, row-major (the map's red channel). */
  data: Float32Array;
  /** Form-engraving darkness 0..1 (the green channel): drawn only along the curves a shot engraves. */
  form: Float32Array;
}

function toneMap(f: SceneFrame, panels: readonly Panel[]): ToneMap {
  const { stage } = f, w = Math.ceil(stage.outW * TONE_RES), h = Math.ceil(stage.outH * TONE_RES), k = stage.scale * TONE_RES;
  const layer = stage.layer('requiem-tone', w, h), ctx = layer.getContext('2d', { willReadFrequently: true })!;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.filter = 'none';
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w, h);
  for (const p of panels) inPanel(f, ctx, k, p, e => p.shot.tone(e));
  ctx.filter = 'none';
  const img = ctx.getImageData(0, 0, w, h).data, data = new Float32Array(w * h), form = new Float32Array(w * h);
  for (let i = 0; i < data.length; i++) {
    data[i] = img[i * 4]! / 255;
    form[i] = img[i * 4 + 1]! / 255;
  }
  return { w, h, k, data, form };
}

/** Bilinear sample of a tone channel at a logical point. */
function sample(T: ToneMap, d: Float32Array, x: number, y: number): number {
  const fx = clamp(x * T.k - 0.5, 0, T.w - 1.001), fy = clamp(y * T.k - 0.5, 0, T.h - 1.001);
  const ix = Math.floor(fx), iy = Math.floor(fy), ax = fx - ix, ay = fy - iy, i = iy * T.w + ix;
  const top = d[i]! + (d[i + 1]! - d[i]!) * ax, bottom = d[i + T.w]! + (d[i + T.w + 1]! - d[i + T.w]!) * ax;
  return top + (bottom - top) * ay;
}

/** Tone as a colour: grey for page hatching, pure green for form engraving (no page hatch under it). */
const grey = (d: number, form = false): string => {
  const v = Math.round(255 * clamp(d, 0, 1));
  return form ? `rgb(0,${v},0)` : `rgb(${v},${v},${v})`;
};

export interface ShadeOptions {
  /** Soften the edge by this many design units. */
  blur?: number;
  rule?: CanvasFillRule;
  /** Only ever darken what is there (the deeper of the two wins). */
  max?: boolean;
  /** Only ever lighten what is there. */
  min?: boolean;
  /**
   * Form tone: the region is modelled by the shot's own engraved curves (`engraveCurves`) following the form, and the
   * page hatching stays out of it.
   */
  form?: boolean;
}

function mode(e: Etch, o: ShadeOptions): void {
  if (o.blur) e.ctx.filter = `blur(${(o.blur * e.px).toFixed(2)}px)`;
  if (o.max) e.ctx.globalCompositeOperation = 'lighten';
  if (o.min) e.ctx.globalCompositeOperation = 'darken';
}

/** Paint `region` (design units; `FULL` for the whole panel) at darkness `dark` into the tone map: 0 is clean paper, 1 the plate's black. */
export function shade(e: Etch, region: Path2D | typeof FULL, dark: number, o: ShadeOptions = {}): void {
  const { ctx } = e;
  ctx.save();
  mode(e, o);
  ctx.fillStyle = grey(dark, o.form);
  if (region) ctx.fill(region, o.rule ?? 'nonzero');
  else ctx.fillRect(-4 * DW, -4 * DH, 9 * DW, 9 * DH);
  ctx.restore();
}

/** A radial falloff of darkness from `inner` at the centre to `outer` at radius `r`, optionally clipped. */
export function shadeRadial(e: Etch, cx: number, cy: number, r: number, inner: number, outer: number, o: ShadeOptions & { clip?: Path2D; sx?: number; sy?: number } = {}): void {
  const { ctx } = e, sx = o.sx ?? 1, sy = o.sy ?? 1;
  ctx.save();
  if (o.clip) ctx.clip(o.clip, o.rule ?? 'nonzero');
  mode(e, o);
  ctx.translate(cx, cy);
  ctx.scale(sx, sy);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
  g.addColorStop(0, grey(inner, o.form));
  g.addColorStop(1, grey(outer, o.form));
  ctx.fillStyle = g;
  ctx.fillRect(-r * 8, -r * 8, r * 16, r * 16);
  ctx.restore();
}

/** A linear ramp of darkness from `d0` at `a` to `d1` at `b`, optionally clipped. */
export function shadeLinear(e: Etch, a: Vec2, b: Vec2, d0: number, d1: number, o: ShadeOptions & { clip?: Path2D } = {}): void {
  const { ctx } = e;
  ctx.save();
  if (o.clip) ctx.clip(o.clip, o.rule ?? 'nonzero');
  mode(e, o);
  const g = ctx.createLinearGradient(a[0], a[1], b[0], b[1]);
  g.addColorStop(0, grey(d0, o.form));
  g.addColorStop(1, grey(d1, o.form));
  ctx.fillStyle = g;
  ctx.fillRect(-4 * DW, -4 * DH, 9 * DW, 9 * DH);
  ctx.restore();
}

/* ---------- biting the plate ---------- */

/** The hatch layers in the order they come in as tone deepens: angle, spacing, bitten width, and threshold. */
const LAYERS = [
  { angle: 0.8, gap: 7.4, width: 1.9, at: 0.05 },
  { angle: -0.68, gap: 7, width: 1.8, at: 0.27 },
  { angle: 0.07, gap: 6.6, width: 1.7, at: 0.45 },
  { angle: 1.52, gap: 6.2, width: 1.6, at: 0.6 },
  { angle: 0.38, gap: 5.4, width: 1.5, at: 0.74 },
] as const;
/** Tone over which a line grows from nothing to its full width. */
const RAMP = 0.13;
/** Sample spacing along a hatch line, logical units. */
const STEP = 8;

interface HatchLine { n: number; xs: Float32Array; ys: Float32Array; ps: Float32Array }
interface HatchLayer { nx: number; ny: number; width: number; at: number; lines: HatchLine[] }

/** The page-locked hatch lines of every layer for a frame size: each line wavers and presses like a hand-ruled line. */
const hatchGeometry = perSize((w, h): HatchLayer[] => LAYERS.map((L, k) => {
  const ca = Math.cos(L.angle), sa = Math.sin(L.angle), seed = 1610 + k * 17, M = 8;
  const corners: Vec2[] = [[-M, -M], [w + M, -M], [-M, h + M], [w + M, h + M]];
  const us = corners.map(([x, y]) => x * ca + y * sa), vs = corners.map(([x, y]) => -x * sa + y * ca);
  const u0 = Math.floor(Math.min(...us) / STEP) * STEP, u1 = Math.max(...us), v0 = Math.floor(Math.min(...vs) / L.gap), v1 = Math.ceil(Math.max(...vs) / L.gap);
  const lines: HatchLine[] = [];
  for (let v = v0; v <= v1; v++) {
    const xs: number[] = [], ys: number[] = [], ps: number[] = [];
    for (let u = u0; u <= u1; u += STEP) {
      const off = noise1(u / 110, seed + v * 13) * 1.9 + noise1(u / 23, seed + v * 7 + 1) * 0.35, vv = v * L.gap + off;
      const x = u * ca - vv * sa, y = u * sa + vv * ca;
      if (x < -M || y < -M || x > w + M || y > h + M) continue;
      xs.push(x);
      ys.push(y);
      ps.push(0.78 + 0.5 * noise1(u / 60, seed + v * 5 + 3));
    }
    if (xs.length > 1) lines.push({ n: xs.length, xs: Float32Array.from(xs), ys: Float32Array.from(ys), ps: Float32Array.from(ps) });
  }
  return { nx: -sa, ny: ca, width: L.width, at: L.at, lines };
}));

const smoothstep = (a: number, b: number, x: number): number => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

const r1 = (v: number): number => Math.round(v * 10) / 10;

/**
 * Cut every hatch layer's lines where the tone map calls for them, as thin filled outlines on `ctx` (logical units).
 * Each run of line goes to the canvas as its own small SVG path: one binding call per run instead of one per vertex,
 * and many small paths rasterise several times faster than one path of a few hundred thousand vertices.
 */
function engrave(ctx: Ctx, T: ToneMap, layers: readonly HatchLayer[]): void {
  const cap = 1024, lx = new Float32Array(cap), ly = new Float32Array(cap), rx = new Float32Array(cap), ry = new Float32Array(cap);
  let n = 0;
  const flush = (): void => {
    if (n > 1) {
      let d = `M${r1(lx[0]!)} ${r1(ly[0]!)}L`;
      for (let i = 1; i < n; i++) d += `${r1(lx[i]!)} ${r1(ly[i]!)} `;
      for (let i = n - 1; i >= 0; i--) d += `${r1(rx[i]!)} ${r1(ry[i]!)} `;
      ctx.fill(new Path2D(`${d}Z`));
    }
    n = 0;
  };
  ctx.fillStyle = INK;
  for (const L of layers) {
    for (const line of L.lines) {
      for (let i = 0; i < line.n; i++) {
        const x = line.xs[i]!, y = line.ys[i]!, t = sample(T, T.data, x, y);
        if (t <= L.at) { if (n) flush(); continue; }
        const grow = smoothstep(L.at, L.at + RAMP, t), half = 0.5 * L.width * line.ps[i]! * (grow + 0.9 * smoothstep(0.7, 1, t));
        if (half < 0.12) { if (n) flush(); continue; }
        if (n === cap) flush();
        lx[n] = x + L.nx * half; ly[n] = y + L.ny * half; rx[n] = x - L.nx * half; ry[n] = y - L.ny * half;
        n++;
      }
      flush();
    }
  }
}

/** Resin grain: a dense even speckle that holds ink as a soft dark (cached per frame size). */
function grainLayer(f: SceneFrame): HTMLCanvasElement {
  return cached(f, 'requiem-aquatint', g => {
    const c = g.ctx, r = rng(1620), W = g.stage.w, H = g.stage.h, n = Math.round((W * H) / 5.5);
    c.fillStyle = INK;
    c.beginPath();
    for (let i = 0; i < n; i++) {
      const x = r() * W, y = r() * H, rad = 0.5 + r() * 0.85;
      c.moveTo(x + rad, y);
      c.arc(x, y, rad, 0, TAU);
    }
    c.fill();
  });
}

/** The deepest darks: aquatint grain from tone 0.8, and a solid plate black from 0.92. */
function aquatint(f: SceneFrame, plate: Ctx, T: ToneMap): void {
  const { stage } = f, [ir, ig, ib] = parseColor(INK);
  const maskOf = (key: string, alpha: (t: number) => number): HTMLCanvasElement | null => {
    const img = new ImageData(T.w, T.h), d = img.data;
    let any = false;
    for (let i = 0; i < T.data.length; i++) {
      const a = alpha(Math.max(T.data[i]!, T.form[i]!));
      if (a <= 0) continue;
      any = true;
      d[i * 4] = ir; d[i * 4 + 1] = ig; d[i * 4 + 2] = ib; d[i * 4 + 3] = Math.round(255 * a);
    }
    if (!any) return null;
    const c = stage.layer(key, T.w, T.h);
    stage.context(c).putImageData(img, 0, 0);
    return c;
  };
  const grain = maskOf('requiem-grain-mask', t => smoothstep(0.78, 0.9, t)), solid = maskOf('requiem-solid-mask', t => 0.82 * smoothstep(0.9, 1, t));
  plate.save();
  plate.setTransform(1, 0, 0, 1, 0, 0);
  plate.imageSmoothingEnabled = true;
  if (grain) {
    const layer = stage.layer('requiem-grain'), g = stage.context(layer);
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'source-over';
    g.clearRect(0, 0, layer.width, layer.height);
    g.drawImage(grain, 0, 0, stage.outW, stage.outH);
    g.globalCompositeOperation = 'source-in';
    g.drawImage(grainLayer(f), 0, 0, stage.outW, stage.outH);
    g.restore();
    plate.drawImage(layer, 0, 0, stage.outW, stage.outH);
  }
  if (solid) plate.drawImage(solid, 0, 0, stage.outW, stage.outH);
  plate.restore();
}

/** Burnish `region` of the plate back to paper in the pen pass (alpha < 1 only lightens). */
export function erase(e: Etch, region: Path2D, alpha = 1, rule: CanvasFillRule = 'nonzero'): void {
  const { ctx } = e;
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#000';
  ctx.fill(region, rule);
  ctx.restore();
}

/** The whole panel, for `shade` (a region generously oversized so any view is covered). */
export const FULL = null;

/* ---------- regions ---------- */

/** A hand-bitten ellipse: its edge wanders by `wander` of the radius, fixed by `seed`. */
export function blob(cx: number, cy: number, rx: number, ry: number, seed: number, wander = 0.05, rot = 0, n = 72): Vec2[] {
  const c = Math.cos(rot), s = Math.sin(rot), out: Vec2[] = [];
  for (let k = 0; k < n; k++) {
    const a = (k / n) * TAU, w = 1 + wander * (1.4 * noise1(Math.cos(a) * 1.6 + 5, seed) + 0.8 * noise1(Math.sin(a) * 4 + 9, seed + 1));
    const x = Math.cos(a) * rx * w, y = Math.sin(a) * ry * w;
    out.push([cx + x * c - y * s, cy + x * s + y * c]);
  }
  return out;
}

/** A closed region from any number of polygons (use the 'evenodd' rule for holes). */
export function region(...polys: readonly (readonly Vec2[])[]): Path2D {
  const p = new Path2D();
  for (const poly of polys) p.addPath(polyPath(poly));
  return p;
}

/** A design-unit rectangle as a polygon. */
export const rectPts = (x: number, y: number, w: number, h: number): Vec2[] => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];

/* ---------- line work ---------- */

/** The etching needle: an even line with a slight waver, a little heavier where the hand pressed. */
export const PEN: StrokeStyle = { color: INK, size: 2.6, thinning: 0.35, smoothing: 0.5, wobble: 0.8, wobbleWavelength: 170, tremor: 0.3, pressureVariation: 0.5, taperStart: 8, taperEnd: 12 };
export const FINE: StrokeStyle = { ...PEN, size: 1.6, taperStart: 5, taperEnd: 8 };
export const BOLD: StrokeStyle = { ...PEN, size: 4, thinning: 0.45 };

/** Prepare pen lines (design units) once; `closed` for loops. */
export function lines(paths: readonly (readonly Vec2[])[], style: StrokeStyle, seed: number, closed = false): PreparedStroke[] {
  return paths.map((p, k) => prepareStroke(p, style, seed + k * 7, { closed }));
}

export function pen(e: Etch, strokes: readonly PreparedStroke[], progress = 1): void {
  for (const st of strokes) drawStroke(e.ctx, st, progress);
}

export interface EngraveOptions {
  /** Full bitten width in design units. */
  width: number;
  /** Form tone at which the curves start to show, and over which they grow to full width. */
  at?: number;
  ramp?: number;
  /** Extra swelling into the darks (0 keeps an even line). */
  swell?: number;
}

/**
 * Engrave curves that follow the form, their width read from the form tone under them (see `ShadeOptions.form`): a
 * burin line swelling in the shadows and thinning to nothing in the lights. Curves should be densely sampled.
 */
export function engraveCurves(e: Etch, curves: readonly (readonly Vec2[])[], o: EngraveOptions): void {
  const { width, at = 0.04, ramp = 0.16, swell = 0.8 } = o, { ctx } = e;
  const L: Vec2[] = [], R: Vec2[] = [];
  const path = new Path2D();
  const flush = (): void => {
    if (L.length > 1) {
      path.moveTo(L[0]![0], L[0]![1]);
      for (let i = 1; i < L.length; i++) path.lineTo(L[i]![0], L[i]![1]);
      for (let i = R.length - 1; i >= 0; i--) path.lineTo(R[i]![0], R[i]![1]);
      path.closePath();
    }
    L.length = 0;
    R.length = 0;
  };
  for (const c of curves) {
    for (let i = 0; i < c.length; i++) {
      const [x, y] = c[i]!, a = c[Math.max(0, i - 1)]!, b = c[Math.min(c.length - 1, i + 1)]!;
      const g = e.form(x, y), grow = smoothstep(at, at + ramp, g), half = 0.5 * width * (grow + swell * smoothstep(0.65, 1, g));
      if (grow <= 0.02 || half * e.s < 0.12) { flush(); continue; }
      const dx = b[0] - a[0], dy = b[1] - a[1], m = Math.hypot(dx, dy) || 1, nx = -dy / m, ny = dx / m;
      L.push([x + nx * half, y + ny * half]);
      R.push([x - nx * half, y - ny * half]);
    }
    flush();
  }
  ctx.save();
  ctx.fillStyle = INK;
  ctx.fill(path);
  ctx.restore();
}

/** Resample a polyline to points every `step` design units (for engraving curves). */
export function dense(pts: readonly Vec2[], step = 6): Vec2[] {
  const out: Vec2[] = [];
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1]!, [bx, by] = pts[i]!, n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / step));
    for (let k = 0; k < n; k++) out.push([ax + ((bx - ax) * k) / n, ay + ((by - ay) * k) / n]);
  }
  if (pts.length) out.push(pts[pts.length - 1]!);
  return out;
}

/** A lazily built value (stroke sets in design units do not depend on the frame size). */
export function once<T>(build: () => T): () => T {
  let v: T | undefined;
  return () => (v ??= build());
}

/** Plain etched polylines (form hatching, fibres, lettering): round caps, fixed width in design units. */
export function scratchLines(e: Etch, paths: readonly (readonly Vec2[])[], width: number, color: string = INK, alpha = 1): void {
  const { ctx } = e;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  for (const p of paths) p.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.stroke();
  ctx.restore();
}


/* ---------- tint ---------- */

/** A soft wiped pool of colour: radial falloff from `strength` at the centre to nothing at `r`. */
export function pool(e: Etch, cx: number, cy: number, r: number, color: string, strength: number, clip?: Path2D): void {
  const { ctx } = e, a = clamp(strength, 0, 1);
  ctx.save();
  if (clip) ctx.clip(clip);
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  g.addColorStop(0, alpha(color, a));
  g.addColorStop(0.55, alpha(color, a * 0.6));
  g.addColorStop(1, alpha(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(cx - r, cy - r, 2 * r, 2 * r);
  ctx.restore();
}

/** Flood a region with colour. */
export function flood(e: Etch, region: Path2D, color: string, alpha: number): void {
  const { ctx } = e;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.fillStyle = color;
  ctx.fill(region);
  ctx.restore();
}

/* ---------- lettering ---------- */

/** A needle-drawn capital alphabet, just the letters the plates need: unit height, baseline at y = 1. */
const GLYPHS: Record<string, { w: number; paths: Vec2[][] }> = {
  A: { w: 0.7, paths: [[[0, 1], [0.35, 0], [0.7, 1]], [[0.14, 0.62], [0.56, 0.62]]] },
  E: { w: 0.58, paths: [[[0.58, 0], [0, 0], [0, 1], [0.58, 1]], [[0, 0.5], [0.48, 0.5]]] },
  I: { w: 0.12, paths: [[[0.06, 0], [0.06, 1]]] },
  L: { w: 0.54, paths: [[[0, 0], [0, 1], [0.54, 1]]] },
  N: { w: 0.66, paths: [[[0, 1], [0, 0], [0.66, 1], [0.66, 0]]] },
  O: { w: 0.8, paths: [catmullRom([[0.4, 0], [0.74, 0.16], [0.8, 0.5], [0.74, 0.84], [0.4, 1], [0.06, 0.84], [0, 0.5], [0.06, 0.16]], 4, true)] },
  P: { w: 0.6, paths: [[[0, 1], [0, 0], [0.4, 0], [0.56, 0.08], [0.6, 0.26], [0.55, 0.43], [0.4, 0.52], [0, 0.52]]] },
  R: { w: 0.62, paths: [[[0, 1], [0, 0], [0.4, 0], [0.56, 0.08], [0.6, 0.26], [0.55, 0.43], [0.4, 0.52], [0, 0.52]], [[0.3, 0.52], [0.62, 1]]] },
  S: { w: 0.6, paths: [catmullRom([[0.58, 0.14], [0.42, 0.01], [0.2, 0.01], [0.05, 0.14], [0.08, 0.36], [0.32, 0.5], [0.54, 0.64], [0.58, 0.84], [0.42, 0.99], [0.18, 0.99], [0, 0.86]], 4)] },
  T: { w: 0.64, paths: [[[0, 0], [0.64, 0]], [[0.32, 0], [0.32, 1]]] },
  U: { w: 0.6, paths: [catmullRom([[0, 0], [0, 0.68], [0.08, 0.92], [0.3, 1], [0.52, 0.92], [0.6, 0.68], [0.6, 0]], 4)] },
  V: { w: 0.7, paths: [[[0, 0], [0.35, 1], [0.7, 0]]] },
  W: { w: 0.92, paths: [[[0, 0], [0.2, 1], [0.46, 0.3], [0.72, 1], [0.92, 0]]] },
};

/** Polylines of `text` set at `x`, baseline `y`, cap height `size`, tracked by `track` of the height. */
export function lettering(text: string, x: number, y: number, size: number, track = 0.22): Vec2[][] {
  const out: Vec2[][] = [];
  let pen = x;
  for (const ch of text) {
    if (ch === ' ') { pen += size * 0.5; continue; }
    const g = GLYPHS[ch];
    if (!g) throw new Error(`requiem lettering: no glyph for "${ch}"`);
    for (const p of g.paths) out.push(p.map(([gx, gy]): Vec2 => [pen + gx * size, y - size + gy * size]));
    pen += (g.w + track) * size;
  }
  return out;
}

/* ---------- motion ---------- */

export const easeOut = (t: number): number => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
export const easeInOut = (t: number): number => {
  const x = clamp(t, 0, 1);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
};

/** The default camera: a slow push-in that quickens as the montage heats up. */
export const pushIn = (c: Clock, amount = 0.035, focus?: Vec2): View => ({ zoom: 1 + amount * (1 + c.heat) * c.u, ...(focus ? { focus } : {}) });
