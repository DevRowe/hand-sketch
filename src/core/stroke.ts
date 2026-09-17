/**
 * The stroke engine: what makes a line look drawn by a hand with a pen.
 *
 * 1. Resample the centreline evenly, so wobble does not depend on how the shape was sampled.
 * 2. Displace it along its normal by coherent noise over arc length: a slow drift plus a fine tremor.
 * 3. Give every sample a pressure from noise over arc length.
 * 4. Reveal by cutting the *final* (wobbled) centreline at `progress * length`, so progress 1 is exactly complete.
 *    Any sub-range [from, to] can be cut the same way (travelling dashes, erase-from-tail, un-draw), with
 *    wrap-around on closed strokes.
 * 5. Turn the cut into a variable-width, tapered outline with perfect-freehand and fill it.
 * 6. Optionally break the ink with dry-brush streaks in the paper colour.
 *
 * Preparation (1-3) is done once per stroke and seed; drawing (4-6) is cheap per frame.
 */
import { getStroke } from 'perfect-freehand';
import { arcLengths, normalAt, pointAtLength, resample, resampleCount, tangentAtLength } from './geometry';
import { clamp, lerp, type Vec2 } from './math';
import { fbm1, noise1 } from './random';

export interface StrokeStyle {
  color: string;
  /** Nominal width in logical units. */
  size: number;
  alpha?: number;
  /** 0..1: how strongly pressure changes the width. */
  thinning?: number;
  /** 0..1: perfect-freehand outline smoothing. */
  smoothing?: number;
  /** 0..1: perfect-freehand input streamlining. */
  streamline?: number;
  /** Taper lengths in logical units at the start and at the pen head / end. */
  taperStart?: number;
  taperEnd?: number;
  /** Amplitude (logical units) and wavelength (arc length per cycle) of the slow hand drift. */
  wobble?: number;
  wobbleWavelength?: number;
  /** Amplitude of the fine tremor; its wavelength is a sixth of the drift's. */
  tremor?: number;
  /** 0..1 pressure variation along the stroke, and its wavelength. */
  pressureVariation?: number;
  pressureWavelength?: number;
  /** 0..1 dry-brush breakup, drawn in `paper` colour inside the stroke. */
  dryBrush?: number;
  paper?: string;
}

export interface PreparedStroke {
  readonly points: readonly Vec2[];
  readonly lengths: readonly number[];
  readonly pressures: readonly number[];
  readonly length: number;
  readonly style: Readonly<StrokeStyle>;
  readonly seed: number;
  /** A closed stroke ends where it starts (wobble and pressure included), so ranges may wrap across the join. */
  readonly closed: boolean;
}

export interface PrepareOptions {
  /** Treat the path as a closed loop: wobble and pressure become periodic over its length, so the join is invisible. */
  closed?: boolean;
}

const SPACING = 3;

/** Blend a noise channel into its own start over the last `span` of a loop, so value(L) === value(0). */
function periodic(value: (s: number) => number, s: number, total: number, span: number): number {
  const w = clamp((s - (total - span)) / span, 0, 1);
  if (w <= 0) return value(s);
  const e = w * w * (3 - 2 * w);
  return lerp(value(s), value(s - total), e);
}

/**
 * Wobble and pressure for an evenly sampled centreline. `param[k]` is the arc-length position the noise is
 * read at for vertex k: normally the vertex's own arc length, but a morph pins it so the hand quality holds still.
 */
function displace(base: readonly Vec2[], param: readonly number[], style: StrokeStyle, seed: number, closed: boolean, pinned = false): Omit<PreparedStroke, 'style' | 'seed' | 'closed'> {
  const {
    wobble = 2.5, wobbleWavelength = 140, tremor = 0.5,
    pressureVariation = 0.5, pressureWavelength = 90,
  } = style;
  const total = param[param.length - 1] ?? 0;
  const loop = closed && total > 0;
  const offAt = (s: number) => fbm1(s / wobbleWavelength, seed, 2) * 2 * wobble + noise1((s * 6) / wobbleWavelength, seed + 7) * 2 * tremor;
  const presAt = (s: number) => fbm1(s / pressureWavelength, seed + 31, 2);
  const span = (wl: number) => Math.min(total / 2, wl);

  const points: Vec2[] = base.map((p, k) => {
    const s = param[k]!;
    const off = loop ? periodic(offAt, s, total, span(wobbleWavelength)) : offAt(s);
    const [nx, ny] = normalAt(base, k, loop);
    return [p[0] + nx * off, p[1] + ny * off];
  });
  if (loop) points[points.length - 1] = points[0]!;
  const lengths = arcLengths(points);
  // pressure is read along the drawn (wobbled) line, unless a morph pins the parameterisation
  const pAt = pinned ? param : lengths, pTotal = pAt[pAt.length - 1] ?? 0;
  const pressures = lengths.map((_, k) => {
    const s = pAt[k]!;
    const n = loop ? periodic(presAt, s, pTotal, Math.min(pTotal / 2, pressureWavelength)) : presAt(s);
    return clamp(0.55 + n * 1.6 * pressureVariation, 0.08, 1);
  });
  return { points, lengths, pressures, length: lengths[lengths.length - 1] ?? 0 };
}

export function prepareStroke(path: readonly Vec2[], style: StrokeStyle, seed: number, o: PrepareOptions = {}): PreparedStroke {
  const closed = !!o.closed;
  const src = closed && path.length > 2 && (path[0]![0] !== path[path.length - 1]![0] || path[0]![1] !== path[path.length - 1]![1]) ? [...path, path[0]!] : path;
  const base = resample(src, SPACING);
  return { ...displace(base, arcLengths(base), style, seed, closed), style, seed, closed };
}

/**
 * A shape morph with a stable hand: both paths are resampled to the same point count (the target's own
 * sampling), interpolated, and the wobble and pressure are read at the *target's* arc-length positions, so the
 * line does not shimmer or kink as its length changes. At `t` = 1 it equals `prepareStroke(to, style, seed)`.
 */
export function prepareMorph(from: readonly Vec2[], to: readonly Vec2[], style: StrokeStyle, seed: number): (t: number) => PreparedStroke {
  const target = resample(to, SPACING), n = target.length;
  const source = resampleCount(from, n), param = arcLengths(target);
  return t => {
    const u = clamp(t, 0, 1);
    const base = u >= 1 ? target : source.map((p, k): Vec2 => [lerp(p[0], target[k]![0], u), lerp(p[1], target[k]![1], u)]);
    return { ...displace(base, param, style, seed, false, true), style, seed, closed: false };
  };
}

/**
 * The same stroke with its pressure shaped by gesture: every sample's noise pressure is multiplied by
 * `profile(u)`, u being its fraction of the length. A hand that presses at a moment of weight, lightens as it lets
 * go, or rests (a slight pool of ink where the pen paused). Geometry, wobble and length are untouched, so reveals
 * and ranges line up with the plain stroke. The result is capped at 1.6 so a pooled rest stays a line.
 */
export function withPressure(stroke: PreparedStroke, profile: (u: number) => number): PreparedStroke {
  const L = stroke.length;
  const pressures = stroke.pressures.map((p, k) => clamp(p * profile(L > 0 ? stroke.lengths[k]! / L : 0), 0.04, 1.6));
  return { ...stroke, pressures };
}

/** Points and pressures of the stroke between arc lengths a < b (0 <= a, b <= length), with interpolated cut ends. */
function slice(stroke: PreparedStroke, a: number, b: number): { pts: Vec2[]; pressures: number[] } {
  const { points, lengths, pressures } = stroke;
  const pts: Vec2[] = [], pr: number[] = [];
  const n = points.length;
  let k = 0;
  if (a > 0) {
    while (k < n && lengths[k]! <= a) k++;
    pts.push(pointAtLength(points, lengths, a));
    pr.push(pressures[Math.min(k, n - 1)]!);
  }
  for (; k < n && lengths[k]! <= b; k++) {
    pts.push(points[k]!);
    pr.push(pressures[k]!);
  }
  if (k < n) {
    pts.push(pointAtLength(points, lengths, b));
    pr.push(pressures[Math.min(k, n - 1)]!);
  }
  return { pts, pressures: pr };
}

export interface RangeOptions {
  /** Override the style's taper lengths at the cut ends (short dashes want short tapers). */
  taperStart?: number;
  taperEnd?: number;
}

/** The arc-length spans [a, b] a range covers: one span, or two when a closed stroke's range wraps across the join. */
function spans(stroke: PreparedStroke, from: number, to: number): [number, number][] {
  const L = stroke.length;
  if (L <= 0) return [];
  if (!stroke.closed) {
    const a = clamp(from, 0, 1) * L, b = clamp(to, 0, 1) * L;
    return b > a ? [[a, b]] : [];
  }
  const width = clamp(to - from, 0, 1);
  if (width <= 0) return [];
  if (width >= 1) return [[0, L]];
  const a = (((from % 1) + 1) % 1) * L, b = a + width * L;
  return b <= L ? [[a, b]] : [[a, L], [0, b - L]];
}

function outlineOf(stroke: PreparedStroke, pts: readonly Vec2[], pressures: readonly number[], len: number, last: boolean, o: RangeOptions): Vec2[] {
  const { size, thinning = 0.6, smoothing = 0.5, streamline = 0.15 } = stroke.style;
  const taperStart = o.taperStart ?? stroke.style.taperStart ?? size * 4, taperEnd = o.taperEnd ?? stroke.style.taperEnd ?? size * 6;
  return getStroke(pts.map((p, k) => [p[0], p[1], pressures[k]!]), {
    size,
    thinning,
    smoothing,
    streamline,
    simulatePressure: false,
    start: { taper: Math.min(taperStart, len * 0.45), cap: true },
    end: { taper: Math.min(taperEnd, len * 0.45), cap: true },
    last,
  }) as unknown as Vec2[];
}

/**
 * Outline polygons of the part of the stroke between fractions `from` and `to` of its length, each cut end
 * tapered. On a closed stroke the range wraps (from 0.9 to 1.2 draws across the join as one piece where it can).
 */
export function strokeRangeOutlines(stroke: PreparedStroke, from: number, to: number, o: RangeOptions = {}): Vec2[][] {
  if (stroke.points.length < 2) return [];
  const parts = spans(stroke, from, to);
  if (parts.length === 2) {
    // join the wrapped halves into one polyline so the head does not show a seam at the start point
    const [[a1, b1], [a2, b2]] = parts as [[number, number], [number, number]];
    const tail = slice(stroke, a1, b1), head = slice(stroke, a2, b2);
    const pts = [...tail.pts, ...head.pts.slice(1)], pr = [...tail.pressures, ...head.pressures.slice(1)];
    return [outlineOf(stroke, pts, pr, b1 - a1 + b2 - a2, false, o)];
  }
  return parts.map(([a, b]) => {
    const { pts, pressures } = slice(stroke, a, b);
    return outlineOf(stroke, pts, pressures, b - a, b >= stroke.length, o);
  });
}

/** Outline polygon of the stroke revealed up to `progress` (0..1). Pure; empty when nothing is drawn yet. */
export function strokeOutline(stroke: PreparedStroke, progress: number): Vec2[] {
  const drawn = clamp(progress, 0, 1) * stroke.length;
  if (drawn <= 0 || stroke.points.length < 2) return [];
  const { pts, pressures } = slice(stroke, 0, drawn);
  return outlineOf(stroke, pts, pressures, drawn, progress >= 1, {});
}

function fillOutlines(ctx: CanvasRenderingContext2D, stroke: PreparedStroke, outlines: readonly Vec2[][], ranges: readonly [number, number][]): void {
  const shapes = outlines.filter(o => o.length >= 3);
  if (shapes.length === 0) return;
  const { color, alpha = 1, dryBrush = 0, paper, size } = stroke.style;
  const path = new Path2D();
  for (const outline of shapes) {
    outline.forEach(([x, y], k) => (k ? path.lineTo(x, y) : path.moveTo(x, y)));
    path.closePath();
  }
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.fillStyle = color;
  ctx.fill(path);
  if (dryBrush > 0 && paper) {
    ctx.clip(path);
    ctx.strokeStyle = paper;
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(0.4, size * 0.13);
    ctx.globalAlpha = alpha * clamp(dryBrush, 0, 1) * 0.8;
    ctx.beginPath();
    for (let j = 0; j < 3; j++) {
      const lane = (j - 1) * size * 0.28;
      for (const [a, b] of ranges) {
        let pen = false;
        for (let k = 0; k < stroke.points.length && stroke.lengths[k]! <= b; k++) {
          const s = stroke.lengths[k]!;
          if (s < a) continue;
          const gap = noise1(s / 11, stroke.seed + 53 + j * 13) > 0.18 - dryBrush * 0.25;
          if (!gap) { pen = false; continue; }
          const [nx, ny] = normalAt(stroke.points, k), p = stroke.points[k]!;
          const x = p[0] + nx * lane, y = p[1] + ny * lane;
          if (pen) ctx.lineTo(x, y); else { ctx.moveTo(x, y); pen = true; }
        }
      }
    }
    ctx.stroke();
  }
  ctx.restore();
}

/** Draw the stroke revealed up to `progress`. */
export function drawStroke(ctx: CanvasRenderingContext2D, stroke: PreparedStroke, progress: number): void {
  const drawn = clamp(progress, 0, 1) * stroke.length;
  fillOutlines(ctx, stroke, [strokeOutline(stroke, progress)], [[0, drawn]]);
}

/**
 * Draw only the part of the stroke between fractions `from` and `to`: a travelling dash or pulse
 * (`from` and `to` both moving), erase-from-tail (`from` rising to meet `to`), or un-draw (`to` falling).
 */
export function drawStrokeRange(ctx: CanvasRenderingContext2D, stroke: PreparedStroke, from: number, to: number, o: RangeOptions = {}): void {
  fillOutlines(ctx, stroke, strokeRangeOutlines(stroke, from, to, o), spans(stroke, from, to));
}

export interface StrokeSample {
  /** Position on the wobbled centreline, where the ink actually is. */
  point: Vec2;
  /** Unit direction of travel. */
  tangent: Vec2;
  /** Unit normal (tangent rotated a quarter turn clockwise on screen, i.e. to the left of travel in y-down space). */
  normal: Vec2;
  /** Tangent angle in radians. */
  angle: number;
}

/**
 * Position and direction at fraction `u` of the stroke's wobbled centreline, so riders sit on the ink rather
 * than on the clean path. Closed strokes wrap `u`; open strokes clamp it.
 */
export function sampleStroke(stroke: PreparedStroke, u: number): StrokeSample {
  const L = stroke.length;
  const f = stroke.closed ? ((u % 1) + 1) % 1 : clamp(u, 0, 1);
  const d = f * L;
  const point = pointAtLength(stroke.points, stroke.lengths, d);
  const tangent = tangentAtLength(stroke.points, stroke.lengths, d);
  return { point, tangent, normal: [-tangent[1], tangent[0]], angle: Math.atan2(tangent[1], tangent[0]) };
}

/**
 * Timing for a group of strokes drawn one after another by one hand: each stroke's duration is
 * proportional to its length at `speed` units per second, with `gap` seconds between strokes.
 * Returns start times and durations, so a scene can map local time to per-stroke progress.
 */
export function strokeSchedule(strokes: readonly PreparedStroke[], start: number, speed: number, gap = 0.04): { start: number; duration: number }[] {
  let t = start;
  return strokes.map(s => {
    const duration = speed > 0 ? s.length / speed : 0;
    const slot = { start: t, duration };
    t += duration + gap;
    return slot;
  });
}

/** Progress of a scheduled stroke at time `t`, with ease-in-out so the pen accelerates and settles. */
export function scheduledProgress(slot: { start: number; duration: number }, t: number): number {
  if (slot.duration <= 0) return t >= slot.start ? 1 : 0;
  const u = clamp((t - slot.start) / slot.duration, 0, 1);
  return u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
}
