/**
 * The office glyph kit: the shared vocabulary of explainer scenes (sheets, envelopes, trays, windows, grids,
 * calendar cards, paper planes, stamps, checkboxes, ticks, dimension lines, arrowheads, squiggle "handwriting").
 *
 * Every glyph is plain polylines in local units centred on its own origin (so it can become a puppet as is),
 * split into `outline` (key ink) and `detail` (fine ink), all seeded rough.js or seeded noise: same seed, same
 * glyph. Nothing here draws; scenes wrap the paths in stroke groups with their role styles.
 */
import { catmullRom } from '../core/geometry';
import type { Vec2 } from '../core/math';
import { noise1, rng } from '../core/random';
import { sketch } from '../core/sketch';

export interface Glyph {
  /** Main outline strokes. */
  outline: Vec2[][];
  /** Interior detail strokes (writing, rows, rules). */
  detail: Vec2[][];
  /** The glyph's silhouette, for paper-coloured backing fills and plate coverage. */
  body: Vec2[];
}

const rough = (seed: number, roughness = 0.9) => ({ seed, roughness, disableMultiStroke: true });
const rect = (w: number, h: number): Vec2[] => [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]];
const outlineOf = (pts: readonly Vec2[], seed: number, roughness = 0.9, close = true): Vec2[][] =>
  (close ? sketch.polygon(pts, rough(seed, roughness)) : sketch.linearPath(pts, rough(seed, roughness))).outline;

/**
 * A line of squiggle "handwriting" from x0 to x1 at height y: small loops and humps of varying size, so it
 * reads as writing without being text. Deterministic per seed.
 */
export function squiggle(x0: number, x1: number, y: number, seed: number, o: { height?: number; step?: number } = {}): Vec2[] {
  const { height = 7, step = 9 } = o;
  const r = rng(seed);
  const pts: Vec2[] = [];
  let x = x0, k = 0;
  while (x < x1) {
    const hump = height * (0.45 + 0.75 * r());
    pts.push([x, y + (k % 2 === 0 ? -hump : hump * 0.35) + noise1(x / 40, seed) * 2]);
    x += step * (0.7 + 0.6 * r());
    k++;
  }
  pts.push([x1, y]);
  return catmullRom(pts, 5);
}

/** A few lines of squiggle writing in a box, the last line shorter. */
export function writing(x: number, y: number, w: number, lines: number, gap: number, seed: number, height = 6): Vec2[][] {
  const r = rng(seed);
  return Array.from({ length: lines }, (_, k) => {
    const len = k === lines - 1 ? w * (0.4 + 0.25 * r()) : w * (0.8 + 0.2 * r());
    return squiggle(x, x + len, y + k * gap, seed * 31 + k, { height });
  });
}

/** A sheet of paper with squiggle writing. */
export function sheet(w: number, h: number, seed: number, o: { lines?: number; header?: boolean } = {}): Glyph {
  const { lines = 3, header = false } = o;
  const body = rect(w, h), pad = w * 0.18, top = -h / 2 + h * (header ? 0.34 : 0.2);
  const gap = (h * 0.62) / Math.max(1, lines);
  const detail = writing(-w / 2 + pad, top + (header ? gap * 0.2 : 0), w - 2 * pad, lines, gap, seed, Math.min(6, gap * 0.28));
  if (header) detail.unshift(...sketch.line([-w / 2 + pad, -h / 2 + h * 0.16], [w / 2 - pad, -h / 2 + h * 0.16], rough(seed + 5, 0.6)).outline);
  return { outline: outlineOf(body, seed), detail, body };
}

/** An envelope: rectangle plus the flap's V. */
export function envelope(w: number, h: number, seed: number): Glyph {
  const body = rect(w, h);
  const flap = sketch.linearPath([[-w / 2, -h / 2], [0, h * 0.08], [w / 2, -h / 2]], rough(seed + 1, 0.8)).outline;
  return { outline: outlineOf(body, seed), detail: flap, body };
}

/** An in/out tray seen from the front: an open trapezoid with a lip. */
export function tray(w: number, h: number, seed: number): Glyph {
  const body: Vec2[] = [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2 - w * 0.08, h / 2], [-w / 2 + w * 0.08, h / 2]];
  const lip = sketch.line([-w / 2 + w * 0.04, -h / 2 + h * 0.28], [w / 2 - w * 0.04, -h / 2 + h * 0.28], rough(seed + 2, 0.7)).outline;
  return { outline: outlineOf(body, seed), detail: lip, body };
}

/** An application window: frame, title bar rule and three little dots as short dashes. */
export function windowFrame(w: number, h: number, seed: number, bar = 34): Glyph {
  const body = rect(w, h);
  const rule = sketch.line([-w / 2, -h / 2 + bar], [w / 2, -h / 2 + bar], rough(seed + 3, 0.6)).outline;
  const dots = [0, 1, 2].map((k): Vec2[] => {
    const x = -w / 2 + 18 + k * 18, y = -h / 2 + bar / 2;
    return [[x - 3, y], [x + 3, y + 0.5]];
  });
  return { outline: outlineOf(body, seed), detail: [...rule, ...dots], body };
}

/** A grid of `cols` x `rows` cells (rules only, the frame is the outline). */
export function grid(w: number, h: number, cols: number, rows: number, seed: number): Glyph {
  const body = rect(w, h), detail: Vec2[][] = [];
  for (let c = 1; c < cols; c++) detail.push(...sketch.line([-w / 2 + (w * c) / cols, -h / 2], [-w / 2 + (w * c) / cols, h / 2], rough(seed + 10 + c, 0.5)).outline);
  for (let r = 1; r < rows; r++) detail.push(...sketch.line([-w / 2, -h / 2 + (h * r) / rows], [w / 2, -h / 2 + (h * r) / rows], rough(seed + 40 + r, 0.5)).outline);
  return { outline: outlineOf(body, seed, 0.7), detail, body };
}

/** A calendar card: frame, header band rule, two binding rings and a small grid of day marks. */
export function calendarCard(w: number, h: number, seed: number): Glyph {
  const body = rect(w, h), band = -h / 2 + h * 0.28;
  const detail: Vec2[][] = [...sketch.line([-w / 2, band], [w / 2, band], rough(seed + 1, 0.6)).outline];
  for (const x of [-w * 0.25, w * 0.25]) detail.push([[x, -h / 2 - h * 0.1], [x, -h / 2 + h * 0.1]]);
  for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) {
    const x = -w / 2 + w * (0.25 + c * 0.25), y = band + (h / 2 - band) * (0.32 + r * 0.38);
    detail.push([[x - 3, y], [x + 3, y]]);
  }
  return { outline: outlineOf(body, seed), detail, body };
}

/** A receipt: a narrow slip with a zigzag torn bottom edge and short rows. */
export function receipt(w: number, h: number, seed: number): Glyph {
  const teeth = 6, body: Vec2[] = [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2]];
  for (let k = 1; k <= teeth * 2; k++) body.push([w / 2 - (w * k) / (teeth * 2), h / 2 - (k % 2) * 6]);
  const detail = writing(-w / 2 + w * 0.18, -h / 2 + h * 0.2, w * 0.64, 4, h * 0.16, seed, 4);
  return { outline: outlineOf(body, seed, 0.7), detail, body };
}

/** A crumpled note: an irregular quadrilateral with a crease. */
export function crumpledNote(w: number, h: number, seed: number): Glyph {
  const r = rng(seed), j = (s: number) => (r() - 0.5) * s;
  const body: Vec2[] = [[-w / 2 + j(10), -h / 2 + j(10)], [j(8), -h / 2 - 4 + j(6)], [w / 2 + j(10), -h / 2 + j(10)], [w / 2 + j(8), h / 2 + j(10)], [-w / 2 + j(10), h / 2 + j(8)]];
  const crease = sketch.linearPath([[-w * 0.3, -h * 0.35], [w * 0.05, h * 0.05], [-w * 0.1, h * 0.4]], rough(seed + 1, 1.2)).outline;
  return { outline: outlineOf(body, seed, 1.3), detail: [...crease, ...writing(-w * 0.28, -h * 0.1, w * 0.5, 2, h * 0.28, seed + 3, 4)], body };
}

/** A paper plane in profile, pointing along +x. */
export function paperPlane(size: number, seed: number): Glyph {
  const s = size / 2;
  const body: Vec2[] = [[s, 0], [-s, -s * 0.55], [-s * 0.45, 0], [-s, s * 0.55]];
  const fold = sketch.line([s, 0], [-s * 0.45, 0], rough(seed + 1, 0.5)).outline;
  const wing = sketch.linearPath([[-s * 0.45, 0], [-s * 0.7, s * 0.3]], rough(seed + 2, 0.5)).outline;
  return { outline: outlineOf(body, seed, 0.7), detail: [...fold, ...wing], body };
}

/** A rubber stamp: a knob handle on a neck over a wide base; the face is at y = +size/2. */
export function stamp(size: number, seed: number): Glyph {
  const s = size / 2;
  const base: Vec2[] = [[-s, s * 0.45], [s, s * 0.45], [s, s], [-s, s]];
  const neck: Vec2[] = [[-s * 0.22, s * 0.45], [-s * 0.22, -s * 0.15], [s * 0.22, -s * 0.15], [s * 0.22, s * 0.45]];
  const knob = sketch.ellipse(0, -s * 0.5, s * 0.9, s * 0.75, rough(seed + 2, 0.6)).outline;
  const body: Vec2[] = [[-s, s], [-s, s * 0.45], [-s * 0.22, s * 0.45], [-s * 0.22, -s * 0.15], [-s * 0.45, -s * 0.5], [0, -s * 0.9], [s * 0.45, -s * 0.5], [s * 0.22, -s * 0.15], [s * 0.22, s * 0.45], [s, s * 0.45], [s, s]];
  return { outline: [...outlineOf(base, seed, 0.7), ...outlineOf(neck, seed + 1, 0.6, false), ...knob], detail: [], body };
}

/** An empty checkbox of side `size`. */
export function checkbox(size: number, seed: number): Glyph {
  const body = rect(size, size);
  return { outline: outlineOf(body, seed, 1), detail: [], body };
}

/** A tick mark centred near the origin, drawn as one stroke (short down-stroke, long up-stroke). */
export function tick(size: number): Vec2[] {
  const k = size / 24;
  return [[-10 * k, 1 * k], [-2 * k, 10 * k], [13 * k, -11 * k]];
}

/** A dimension line between a and b with perpendicular end ticks (for "measured to fit"). */
export function dimensionLine(a: Vec2, b: Vec2, seed: number, tickSize = 14): Vec2[][] {
  const dx = b[0] - a[0], dy = b[1] - a[1], m = Math.hypot(dx, dy) || 1, nx = -dy / m, ny = dx / m, t = tickSize / 2;
  return [
    ...sketch.line(a, b, rough(seed, 0.5)).outline,
    [[a[0] - nx * t, a[1] - ny * t], [a[0] + nx * t, a[1] + ny * t]],
    [[b[0] - nx * t, b[1] - ny * t], [b[0] + nx * t, b[1] + ny * t]],
  ];
}

/** An open arrowhead at `tip` pointing along `dir` (radians). */
export function arrowhead(tip: Vec2, dir: number, size: number): Vec2[] {
  const a = dir + Math.PI - 0.45, b = dir + Math.PI + 0.45;
  return [[tip[0] + Math.cos(a) * size, tip[1] + Math.sin(a) * size], tip, [tip[0] + Math.cos(b) * size, tip[1] + Math.sin(b) * size]];
}

/** Translate paths (glyphs are centred on their origin; layouts place them). */
export const at = (paths: readonly (readonly Vec2[])[], x: number, y: number, scale = 1): Vec2[][] =>
  paths.map(p => p.map(([px, py]): Vec2 => [x + px * scale, y + py * scale]));
