/**
 * The stroke engine: what makes a line look drawn by a hand with a pen.
 *
 * 1. Resample the centreline evenly, so wobble does not depend on how the shape was sampled.
 * 2. Displace it along its normal by coherent noise over arc length: a slow drift plus a fine tremor.
 * 3. Give every sample a pressure from noise over arc length.
 * 4. Reveal by cutting the *final* (wobbled) centreline at `progress * length`, so progress 1 is exactly complete.
 * 5. Turn the prefix into a variable-width, tapered outline with perfect-freehand and fill it.
 * 6. Optionally break the ink with dry-brush streaks in the paper colour.
 *
 * Preparation (1-3) is done once per stroke and seed; drawing (4-6) is cheap per frame.
 */
import { getStroke } from 'perfect-freehand';
import { arcLengths, cutAtLength, normalAt, resample } from './geometry';
import { clamp, type Vec2 } from './math';
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
}

const SPACING = 3;

export function prepareStroke(path: readonly Vec2[], style: StrokeStyle, seed: number): PreparedStroke {
  const {
    wobble = 2.5, wobbleWavelength = 140, tremor = 0.5,
    pressureVariation = 0.5, pressureWavelength = 90,
  } = style;
  const base = resample(path, SPACING);
  const baseLengths = arcLengths(base);
  const points: Vec2[] = base.map((p, k) => {
    const s = baseLengths[k]!;
    const off = fbm1(s / wobbleWavelength, seed, 2) * 2 * wobble + noise1((s * 6) / wobbleWavelength, seed + 7) * 2 * tremor;
    const [nx, ny] = normalAt(base, k);
    return [p[0] + nx * off, p[1] + ny * off];
  });
  const lengths = arcLengths(points);
  const pressures = lengths.map(s => clamp(0.55 + fbm1(s / pressureWavelength, seed + 31, 2) * 1.6 * pressureVariation, 0.08, 1));
  return { points, lengths, pressures, length: lengths[lengths.length - 1] ?? 0, style, seed };
}

/** Outline polygon of the stroke revealed up to `progress` (0..1). Pure; empty when nothing is drawn yet. */
export function strokeOutline(stroke: PreparedStroke, progress: number): Vec2[] {
  const drawn = clamp(progress, 0, 1) * stroke.length;
  if (drawn <= 0 || stroke.points.length < 2) return [];
  const prefix = cutAtLength(stroke.points, stroke.lengths, drawn);
  const input = prefix.map((p, k) => {
    const pressure = stroke.pressures[Math.min(k, stroke.pressures.length - 1)]!;
    return [p[0], p[1], pressure];
  });
  const { size, thinning = 0.6, smoothing = 0.5, streamline = 0.15, taperStart = size * 4, taperEnd = size * 6 } = stroke.style;
  return getStroke(input, {
    size,
    thinning,
    smoothing,
    streamline,
    simulatePressure: false,
    start: { taper: Math.min(taperStart, drawn * 0.45), cap: true },
    end: { taper: Math.min(taperEnd, drawn * 0.45), cap: true },
    last: progress >= 1,
  }) as unknown as Vec2[];
}

/** Draw the stroke revealed up to `progress`. */
export function drawStroke(ctx: CanvasRenderingContext2D, stroke: PreparedStroke, progress: number): void {
  const outline = strokeOutline(stroke, progress);
  if (outline.length < 3) return;
  const { color, alpha = 1, dryBrush = 0, paper, size } = stroke.style;
  const path = new Path2D();
  outline.forEach(([x, y], k) => (k ? path.lineTo(x, y) : path.moveTo(x, y)));
  path.closePath();
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
    const drawn = clamp(progress, 0, 1) * stroke.length;
    ctx.beginPath();
    for (let j = 0; j < 3; j++) {
      const lane = (j - 1) * size * 0.28;
      let pen = false;
      for (let k = 0; k < stroke.points.length && stroke.lengths[k]! <= drawn; k++) {
        const s = stroke.lengths[k]!;
        const gap = noise1(s / 11, stroke.seed + 53 + j * 13) > 0.18 - dryBrush * 0.25;
        if (!gap) { pen = false; continue; }
        const [nx, ny] = normalAt(stroke.points, k), p = stroke.points[k]!;
        const x = p[0] + nx * lane, y = p[1] + ny * lane;
        if (pen) ctx.lineTo(x, y); else { ctx.moveTo(x, y); pen = true; }
      }
    }
    ctx.stroke();
  }
  ctx.restore();
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
