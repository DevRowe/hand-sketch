import { TAU, type Vec2 } from './math';

/** Cumulative arc length at every vertex; result[0] = 0, last = total length. */
export function arcLengths(pts: readonly Vec2[]): number[] {
  const s = [0];
  for (let k = 1; k < pts.length; k++) {
    const a = pts[k - 1]!, b = pts[k]!;
    s.push(s[k - 1]! + Math.hypot(b[0] - a[0], b[1] - a[1]));
  }
  return s;
}

export function polylineLength(pts: readonly Vec2[]): number {
  const s = arcLengths(pts);
  return s[s.length - 1] ?? 0;
}

/** Point at arc length `d` along a polyline with precomputed cumulative lengths. */
export function pointAtLength(pts: readonly Vec2[], s: readonly number[], d: number): Vec2 {
  if (pts.length === 0) return [0, 0];
  if (d <= 0) return pts[0]!;
  const total = s[s.length - 1]!;
  if (d >= total) return pts[pts.length - 1]!;
  let lo = 0, hi = s.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (s[mid]! <= d) lo = mid; else hi = mid;
  }
  const a = pts[lo]!, b = pts[hi]!, seg = s[hi]! - s[lo]!;
  const f = seg > 0 ? (d - s[lo]!) / seg : 0;
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
}

/** Resample a polyline to (nearly) even spacing. Always keeps both endpoints. */
export function resample(pts: readonly Vec2[], spacing: number): Vec2[] {
  if (pts.length < 2) return pts.slice();
  const s = arcLengths(pts), total = s[s.length - 1]!;
  const n = Math.max(1, Math.ceil(total / spacing));
  const out: Vec2[] = [];
  for (let k = 0; k <= n; k++) out.push(pointAtLength(pts, s, (total * k) / n));
  return out;
}

/** Resample a polyline to exactly `n` (>= 2) points evenly spaced by arc length, keeping both endpoints. */
export function resampleCount(pts: readonly Vec2[], n: number): Vec2[] {
  if (pts.length === 0) return [];
  const count = Math.max(2, Math.round(n));
  const s = arcLengths(pts), total = s[s.length - 1]!;
  return Array.from({ length: count }, (_, k) => pointAtLength(pts, s, (total * k) / (count - 1)));
}

/** Unit direction of travel at arc length `d` (the segment containing it); [1, 0] for a degenerate polyline. */
export function tangentAtLength(pts: readonly Vec2[], s: readonly number[], d: number): Vec2 {
  const n = pts.length;
  if (n < 2) return [1, 0];
  let lo = 0, hi = n - 1;
  const at = Math.max(0, Math.min(s[n - 1]!, d));
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (s[mid]! <= at) lo = mid; else hi = mid;
  }
  // skip zero-length segments so a repeated vertex never yields a zero tangent
  let a = lo, b = hi;
  while (b < n - 1 && s[b]! - s[a]! <= 1e-9) b++;
  while (a > 0 && s[b]! - s[a]! <= 1e-9) a--;
  const dx = pts[b]![0] - pts[a]![0], dy = pts[b]![1] - pts[a]![1], m = Math.hypot(dx, dy);
  return m > 0 ? [dx / m, dy / m] : [1, 0];
}

/** The prefix of a polyline up to arc length `d`, ending exactly at the cut point. */
export function cutAtLength(pts: readonly Vec2[], s: readonly number[], d: number): Vec2[] {
  if (pts.length === 0 || d <= 0) return [];
  const out: Vec2[] = [];
  let k = 0;
  for (; k < pts.length && s[k]! <= d; k++) out.push(pts[k]!);
  if (k < pts.length) out.push(pointAtLength(pts, s, d));
  return out;
}

/** Centripetal-free uniform Catmull-Rom through the points, `steps` samples per segment. */
export function catmullRom(pts: readonly Vec2[], steps = 6, closed = false): Vec2[] {
  const n = pts.length;
  if (n < 3) return pts.slice();
  const at = (i: number): Vec2 => (closed ? pts[((i % n) + n) % n]! : pts[Math.max(0, Math.min(n - 1, i))]!);
  const segs = closed ? n : n - 1;
  const out: Vec2[] = [];
  for (let k = 0; k < segs; k++) {
    const p0 = at(k - 1), p1 = at(k), p2 = at(k + 1), p3 = at(k + 2);
    for (let j = 0; j < steps; j++) {
      const t = j / steps, t2 = t * t, t3 = t2 * t;
      const f = (d: 0 | 1): number =>
        0.5 * (2 * p1[d] + (-p0[d] + p2[d]) * t + (2 * p0[d] - 5 * p1[d] + 4 * p2[d] - p3[d]) * t2 + (-p0[d] + 3 * p1[d] - 3 * p2[d] + p3[d]) * t3);
      out.push([f(0), f(1)]);
    }
  }
  out.push(closed ? pts[0]! : pts[n - 1]!);
  return out;
}

/** Unit normal of the polyline at vertex k (central difference; `closed` wraps the neighbours, skipping the repeated end vertex). */
export function normalAt(pts: readonly Vec2[], k: number, closed = false): Vec2 {
  const n = pts.length;
  const a = closed && k === 0 ? pts[n - 2]! : pts[Math.max(0, k - 1)]!;
  const b = closed && k === n - 1 ? pts[1]! : pts[Math.min(n - 1, k + 1)]!;
  const dx = b[0] - a[0], dy = b[1] - a[1], m = Math.hypot(dx, dy) || 1;
  return [-dy / m, dx / m];
}

/** Points on an ellipse; `turns` > 1 overshoots the start like a hand closing a loop. */
export function ellipsePoints(cx: number, cy: number, rx: number, ry: number, opts: { rotation?: number; start?: number; turns?: number; n?: number } = {}): Vec2[] {
  const { rotation = 0, start = -Math.PI / 2, turns = 1, n = 72 } = opts;
  const count = Math.max(8, Math.round(n * turns));
  const cr = Math.cos(rotation), sr = Math.sin(rotation);
  const out: Vec2[] = [];
  for (let k = 0; k <= count; k++) {
    const a = start + (k / count) * TAU * turns, x = rx * Math.cos(a), y = ry * Math.sin(a);
    out.push([cx + x * cr - y * sr, cy + x * sr + y * cr]);
  }
  return out;
}

/** Axis-aligned bounds [x, y, w, h] of a point set. */
export function bounds(pts: readonly Vec2[]): [number, number, number, number] {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of pts) {
    if (x < x0) x0 = x;
    if (y < y0) y0 = y;
    if (x > x1) x1 = x;
    if (y > y1) y1 = y;
  }
  return [x0, y0, x1 - x0, y1 - y0];
}

export function polygonPath(pts: readonly Vec2[], close = true): Path2D {
  const p = new Path2D();
  pts.forEach(([x, y], k) => (k ? p.lineTo(x, y) : p.moveTo(x, y)));
  if (close) p.closePath();
  return p;
}

/** Flatten a cubic Bezier into `steps` segments (excluding p0). */
export function flattenCubic(p0: Vec2, p1: Vec2, p2: Vec2, p3: Vec2, steps: number, out: Vec2[]): void {
  for (let j = 1; j <= steps; j++) {
    const t = j / steps, u = 1 - t;
    const a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
    out.push([a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]]);
  }
}
