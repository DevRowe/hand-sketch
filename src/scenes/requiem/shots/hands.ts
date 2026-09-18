/**
 * Hands: the open palm offering a pill (or a crumble of herb), an old hand with its wedding ring, and two fingertips
 * with black-lacquered nails pinching a tablet, a shard or a capsule. `Finger` is the shared anatomy: a tapering
 * cylinder with a rounded pad and a nail, modelled by engraved rings around its form rather than page hatching.
 */
import { catmullRom } from '../../../core/geometry';
import { clamp, TAU, type Vec2 } from '../../../core/math';
import { noise1, rng } from '../../../core/random';
import { blob, COLD, dense, engraveCurves, erase, flood, FULL, INK, pool, pushIn, region, scratchLines, shade, shadeLinear, shadeRadial, WARM, type Etch, type Shot } from '../etch';

/* ---------- a finger ---------- */

export interface Finger {
  tip: Vec2;
  /** Direction from the base towards the tip, radians. */
  angle: number;
  w: number;
  len: number;
  nail: 'black' | 'bare' | 'none';
}

/** The point `d` back from the tip along the axis and `side` across it. */
export const along = (f: Finger, d: number, side = 0): Vec2 => {
  const c = Math.cos(f.angle), s = Math.sin(f.angle);
  return [f.tip[0] - c * d - s * side, f.tip[1] - s * d + c * side];
};

/** Half width `d` back from the tip: narrower at the pad, a swelling at each knuckle. */
const halfAt = (f: Finger, d: number): number => {
  const w = f.w / 2, k = (x: number): number => Math.exp(-(((d - x * f.w) / (0.35 * f.w)) ** 2));
  return w * (0.9 + 0.1 * clamp(d / (1.4 * f.w), 0, 1) + 0.05 * k(1.35) + 0.06 * k(2.9));
};

/** The finger's outline: its two sides from the base, round over the tip. */
export function fingerOutline(f: Finger): Vec2[] {
  const r = halfAt(f, 0), right: Vec2[] = [], left: Vec2[] = [];
  for (let d = f.len; d >= r; d -= 12) {
    right.push(along(f, d, halfAt(f, d)));
    left.push(along(f, d, -halfAt(f, d)));
  }
  const tip: Vec2[] = [];
  for (let k = 0; k <= 16; k++) {
    const a = Math.PI / 2 - (k / 16) * Math.PI;
    tip.push(along(f, r - Math.cos(a) * r * 1.08, Math.sin(a) * r));
  }
  return [...right, ...tip, ...left.reverse()];
}

export function nailOutline(f: Finger): Vec2[] {
  const out: Vec2[] = [], L = 0.42 * f.w, W = 0.37 * f.w, c = 0.06 * f.w + L;
  for (let k = 0; k < 40; k++) {
    const a = (k / 40) * TAU, ca = Math.cos(a), sa = Math.sin(a);
    // a nearly straight free edge at the tip, a rounded cuticle towards the base, sides that follow the finger
    const x = Math.sign(ca) * Math.pow(Math.abs(ca), ca < 0 ? 0.3 : 0.75), y = Math.sign(sa) * Math.pow(Math.abs(sa), 0.35);
    out.push(along(f, c + x * L, y * W * (ca < 0 ? 0.94 : 0.86)));
  }
  return out;
}

/** The lacquer's reflections: a long curved streak along the lit side and a small glint by the cuticle. */
function nailGlints(f: Finger, light: number): Vec2[][] {
  const W = 0.37 * f.w;
  return [
    catmullRom([along(f, f.w * 0.16, light * W * 0.5), along(f, f.w * 0.46, light * W * 0.6), along(f, f.w * 0.78, light * W * 0.5), along(f, f.w * 0.46, light * W * 0.44)], 6, true),
    catmullRom([along(f, f.w * 0.8, -light * W * 0.1), along(f, f.w * 0.86, -light * W * 0.3), along(f, f.w * 0.82, -light * W * 0.34)], 4, true),
  ];
}

/** Tone for a finger (form tone: it is engraved by `engraveFinger`): lit on one side, dark on the other. */
export function toneFinger(e: Etch, f: Finger, dark = 0.34, light = -1): void {
  const body = region(fingerOutline(f)), c = Math.cos(f.angle), s = Math.sin(f.angle), h = f.w / 2;
  const a: Vec2 = [f.tip[0] - s * h * light, f.tip[1] + c * h * light], b: Vec2 = [f.tip[0] + s * h * light, f.tip[1] - c * h * light];
  shadeLinear(e, a, b, clamp(dark - 0.28, 0.02, 1), dark + 0.3, { clip: body, form: true });
  shade(e, region(fingerOutline({ ...f, w: f.w * 0.3, tip: along(f, f.w * 0.1, -light * h * 0.25) })), clamp(dark - 0.3, 0, 1), { blur: f.w * 0.12, form: true, min: true });
  if (f.nail === 'none') return;
  const nail = region(nailOutline(f));
  if (f.nail === 'black') {
    shade(e, nail, 0.98, { blur: 1 });
    for (const g of nailGlints(f, light)) shade(e, region(g), 0.02, { blur: 3 });
  } else {
    shade(e, nail, 0.14, { blur: 2, form: true });
  }
}

/** The finger's engraving: rings around its form, lines along it in the shadow, the outline, nail and knuckle creases. */
export function engraveFinger(e: Etch, f: Finger, seed: number, weight = 1, light = -1): void {
  const r = rng(seed), rings: Vec2[][] = [], runs: Vec2[][] = [];
  for (let d = 10; d < f.len; d += 11) {
    const hw = halfAt(f, d), bow = hw * 0.35, pts: Vec2[] = [];
    for (let k = 0; k <= 14; k++) {
      const v = -1 + (2 * k) / 14;
      pts.push(along(f, d - bow * (1 - v * v), v * hw * 0.98));
    }
    rings.push(pts);
  }
  for (let k = 0; k < 9; k++) {
    const v = -0.95 + (k / 8) * 1.9, pts: Vec2[] = [];
    for (let d = f.w * 0.4; d < f.len; d += 10) pts.push(along(f, d, v * halfAt(f, d)));
    runs.push(pts);
  }
  engraveCurves(e, rings, { width: 2.6 * weight });
  engraveCurves(e, runs, { width: 2.2 * weight, at: 0.42 });
  const creases: Vec2[][] = [];
  for (const j of [1.35, 2.9]) for (let k = 0; k < 3; k++) {
    const d = f.w * (j + (k - 1) * 0.07 + r() * 0.03), hw = halfAt(f, d);
    creases.push(catmullRom([along(f, d, -hw * 0.7), along(f, d - 5 - r() * 8, 0), along(f, d, hw * 0.6)], 4));
  }
  scratchLines(e, creases, 1.6 * weight, INK, 0.75);
  const out = fingerOutline(f);
  scratchLines(e, [out], 3 * weight, INK, 0.95);
  if (f.nail !== 'none') {
    const n = nailOutline(f);
    scratchLines(e, [[...n, n[0]!]], 2.2 * weight, INK, 0.9);
    if (f.nail === 'black') erase(e, region(nailGlints(f, light)[0]!), 0.85);
  }
}

/* ---------- the palm ---------- */

export interface PalmOptions {
  item: 'pill-cold' | 'pill-warm' | 'herb';
  seed: number;
}

/** The web between thumb and fingers: the only gap in an otherwise full-frame palm. */
const GAP = catmullRom([[-60, 330], [120, 250], [260, 120], [330, -60]], 8);
const HEART = catmullRom([[1650, 250], [1300, 230], [1000, 250], [760, 300], [600, 250]], 8);
const HEAD = catmullRom([[250, 420], [520, 420], [820, 470], [1120, 560], [1350, 640]], 8);
const LIFE = catmullRom([[260, 440], [420, 560], [520, 740], [560, 960]], 8);
const MOUNT: Vec2 = [220, 820];

export function palmShot(o: PalmOptions): Shot {
  const r = rng(o.seed), flakes = Array.from({ length: 70 }, () => ({ x: 640 + r() * 420, y: 420 + r() * 240, s: 6 + r() * 18, a: r() * TAU }));
  const shake = (t: number): Vec2 => [8 * noise1(t * 3, o.seed), 6 * noise1(t * 3 + 9, o.seed)];
  const pill = (t: number): Vec2 => { const [dx, dy] = shake(t); return [860 + dx, 520 + dy]; };
  const pillPts = (t: number, dy = 0): Vec2[] => { const [x, y] = pill(t); return blob(x, y + dy, 124, 90, 1, 0.01, -0.25, 48); };
  const lines = (dy: number): Vec2[][] => [HEART, HEAD, LIFE].map(c => dense(c.map(([x, y]): Vec2 => [x, y + dy]), 6));
  return {
    view: c => pushIn(c, 0.06, [860, 520]),
    tint(e) {
      pool(e, 800, 520, 1000, WARM, 0.42);
      if (o.item !== 'herb') flood(e, region(pillPts(e.t)), o.item === 'pill-cold' ? COLD : WARM, 0.85);
    },
    tone(e) {
      shade(e, FULL, 0.26, { form: true });
      shadeRadial(e, 860, 520, 700, 0.3, 0.12, { min: true, form: true });
      shadeRadial(e, MOUNT[0], MOUNT[1], 420, 0.02, 0.3, { min: true, form: true, sx: 1.1 });
      shadeLinear(e, [0, 0], [1600, 900], 0.5, 0.2, { max: true, form: true });
      shade(e, region([...GAP, [-200, -200]]), 0.93, { blur: 10 });
      for (const c of [HEART, HEAD, LIFE]) shade(e, region([...c, ...c.slice().reverse().map(([x, y]): Vec2 => [x + 4, y + 18])]), 0.7, { blur: 10, max: true, form: true });
      if (o.item === 'herb') {
        for (const fl of flakes) shade(e, region(blob(fl.x, fl.y, fl.s, fl.s * 0.6, 3, 0.4, fl.a, 10)), 0.86, { max: true });
      } else {
        const [x, y] = pill(e.t);
        shade(e, region(blob(x + 30, y + 44, 140, 92, 2, 0.05, -0.25, 40)), 0.72, { blur: 18, max: true });
        shade(e, region(pillPts(e.t, 24)), 0.5);
        shade(e, region(pillPts(e.t)), 0.08);
        shade(e, region(blob(x - 44, y - 34, 44, 18, 4, 0.1, -0.25, 20)), 0);
      }
    },
    line(e) {
      // the skin's grain: short engraved rings following the palm's swell, crossed in its hollows
      const rings: Vec2[][] = [];
      for (let k = 0; k < 70; k++) {
        const R = 60 + k * 16, pts: Vec2[] = [];
        for (let a = -0.4; a <= 1.9; a += 0.02) pts.push([MOUNT[0] + Math.cos(-a) * R * 1.25, MOUNT[1] - Math.sin(a) * R + 4 * noise1(a * 6 + k, o.seed)]);
        rings.push(pts);
      }
      engraveCurves(e, rings, { width: 2.4 });
      const cross: Vec2[][] = [];
      for (let k = 0; k < 90; k++) cross.push(dense([[-100, k * 14 - 300], [1700, k * 14 + 200]], 8));
      engraveCurves(e, cross, { width: 2, at: 0.4 });
      scratchLines(e, lines(0), 3.4, INK, 0.9);
      scratchLines(e, lines(10), 1.4, INK, 0.5);
      scratchLines(e, [GAP], 3.4, INK, 0.95);
      if (o.item !== 'herb') {
        const [x, y] = pill(e.t), top = pillPts(e.t), side = pillPts(e.t, 24);
        scratchLines(e, [[...top, top[0]!], side.slice(0, 25), [[x - 104, y + 42], [x + 102, y - 44]]], 3, INK, 0.9);
      } else {
        const dots = new Path2D();
        for (const fl of flakes) { dots.moveTo(fl.x + 3, fl.y); dots.arc(fl.x, fl.y, 3, 0, TAU); }
        erase(e, dots, 0.6);
      }
    },
  };
}

/* ---------- the ringed hand ---------- */

/** An extreme close-up of an old ring finger: the gold band dominating, the skin gathered in folds at the knuckle. */
export function ringShot(o: { seed: number }): Shot {
  const tap = (t: number): number => 0.04 * Math.max(0, Math.sin(t * 8));
  const finger = (t: number): Finger => ({ tip: [-260, 60 - 200 * tap(t)], angle: Math.PI + 0.42 + tap(t), w: 470, len: 2400, nail: 'none' });
  const other = (t: number): Finger => ({ tip: [-100, -280 - 120 * tap(t)], angle: Math.PI + 0.5, w: 430, len: 2400, nail: 'none' });
  const RING = 1320;
  const band = (f: Finger, grow = 0): { face: Vec2[]; near: Vec2[]; far: Vec2[] } => {
    const hw = halfAt(f, RING) * 1.06 + grow, face: Vec2[] = [], near: Vec2[] = [], far: Vec2[] = [];
    for (let k = 0; k <= 20; k++) {
      const v = -1 + (2 * k) / 20, bow = hw * 0.3 * (1 - v * v);
      near.push(along(f, RING - 70 - bow, v * hw));
      far.push(along(f, RING + 70 - bow, v * hw));
    }
    face.push(...near, ...far.slice().reverse());
    return { face, near, far };
  };
  /** A strip of the band's surface between `v0` and `v1` across the finger. */
  const strip = (f: Finger, v0: number, v1: number): Vec2[] => {
    const hw = halfAt(f, RING) * 1.06, at = (d: number, v: number): Vec2 => along(f, d - hw * 0.3 * (1 - v * v), v * hw), a: Vec2[] = [], b: Vec2[] = [];
    for (let d = RING - 70; d <= RING + 70; d += 10) { a.push(at(d, v0)); b.push(at(d, v1)); }
    return [...a, ...b.reverse()];
  };
  const spots = Array.from({ length: 14 }, (_, k) => { const r = rng(o.seed + k); return { d: 500 + r() * 1400, v: (r() - 0.5) * 1.4, s: 14 + r() * 26 }; });
  return {
    view: c => pushIn(c, 0.05, [800, 470]),
    tint(e) {
      pool(e, 800, 450, 1100, WARM, 0.36);
      flood(e, region(band(finger(e.t)).face), WARM, 0.85);
    },
    tone(e) {
      shade(e, FULL, 0.9);
      const f = finger(e.t), g = other(e.t);
      toneFinger(e, g, 0.5, 1);
      toneFinger(e, f, 0.3, 1);
      for (const s of spots) shade(e, region(blob(...along(f, s.d, s.v * halfAt(f, s.d) * 0.6), s.s, s.s * 0.7, 3, 0.3, 0, 16)), 0.55, { blur: 6, max: true, form: true });
      // the knuckle's folds gather dark between them
      for (let k = 0; k < 6; k++) shade(e, region(fingerOutline({ ...f, tip: along(f, 820 + k * 34), len: 14 })), 0.62, { blur: 8, max: true, form: true });
      // the band: polished gold, a hot streak along its lit side, the room's dark reflected across its middle
      const b = band(f);
      shade(e, region(b.face), 0.4, { form: true });
      shade(e, region(strip(f, -0.72, -0.4)), 0.02, { blur: 6, form: true });
      shade(e, region(strip(f, 0.05, 0.5)), 0.9, { blur: 8, max: true, form: true });
      shade(e, region(strip(f, 0.78, 1)), 0.7, { blur: 4, max: true, form: true });
      shade(e, region([...b.far, ...band(f, 12).far.slice().reverse()]), 0.95, { blur: 3, max: true });
    },
    line(e) {
      const f = finger(e.t), g = other(e.t);
      engraveFinger(e, g, o.seed + 1, 1.2);
      engraveFinger(e, f, o.seed + 2, 1.2);
      const r = rng(o.seed + 3), folds: Vec2[][] = [];
      for (let k = 0; k < 26; k++) {
        const d = 760 + r() * 280, hw = halfAt(f, d), v0 = -0.9 + r() * 0.8, v1 = v0 + 0.4 + r() * 0.7;
        folds.push(catmullRom([along(f, d, v0 * hw), along(f, d - 18 - r() * 20, ((v0 + v1) / 2) * hw), along(f, d + 6, Math.min(0.95, v1) * hw)], 5));
      }
      scratchLines(e, folds, 2, INK, 0.8);
      const b = band(f), hw = halfAt(f, RING) * 1.06, arcs: Vec2[][] = [];
      for (let d = RING - 66; d <= RING + 66; d += 6) {
        const pts: Vec2[] = [];
        for (let k = 0; k <= 40; k++) { const v = -1 + k / 20; pts.push(along(f, d - hw * 0.3 * (1 - v * v), v * hw)); }
        arcs.push(pts);
      }
      e.ctx.save();
      e.ctx.clip(region(b.face));
      engraveCurves(e, arcs, { width: 3 });
      e.ctx.restore();
      scratchLines(e, [b.near, b.far, [b.near[0]!, b.far[0]!], [b.near[20]!, b.far[20]!]], 3.4, INK, 0.95);
      erase(e, region(strip(f, -0.64, -0.5)), 0.9);
    },
  };
}

/* ---------- the pinch ---------- */

export interface PinchOptions {
  item: 'tablet' | 'shard' | 'capsule' | 'cube';
  seed: number;
}

export function pinchShot(o: PinchOptions): Shot {
  const squeeze = (u: number): number => 10 * Math.min(1, u * 1.4);
  const fingersAt = (u: number): Finger[] => [
    { tip: [866 - squeeze(u) * 0.8, 352 + squeeze(u)], angle: Math.PI / 2 + 0.95, w: 300, len: 1100, nail: 'black' },
    { tip: [726 + squeeze(u) * 0.8, 596 - squeeze(u)], angle: -Math.PI / 2 + 0.95, w: 330, len: 1100, nail: 'black' },
  ];
  const turn = (t: number): number => 0.25 * t;
  const place = (t: number) => {
    const c = Math.cos(turn(t)), s = Math.sin(turn(t));
    return (pts: readonly Vec2[]): Vec2[] => pts.map(([x, y]): Vec2 => [800 + x * c - y * s, 470 + x * s + y * c]);
  };
  const SHAPES: Record<PinchOptions['item'], Vec2[]> = {
    shard: [[-80, -46], [12, -86], [92, -34], [76, 46], [-22, 74], [-90, 22]],
    cube: [[-74, -74], [74, -74], [74, 74], [-74, 74]],
    capsule: blob(0, 0, 130, 50, 1, 0, 0, 40),
    tablet: blob(0, 0, 92, 40, 1, 0, 0, 40),
  };
  const item = (t: number): Vec2[] => place(t)(SHAPES[o.item]);
  return {
    view: c => pushIn(c, 0.05, [800, 470]),
    tint(e) {
      pool(e, 800, 470, 900, WARM, 0.32);
      if (o.item === 'capsule') {
        e.ctx.save();
        e.ctx.clip(region(item(e.t)));
        flood(e, region(place(e.t)([[0, -100], [200, -100], [200, 100], [0, 100]])), COLD, 0.8);
        e.ctx.restore();
      }
    },
    tone(e) {
      shade(e, FULL, 0.95);
      shade(e, region(item(e.t).map(([x, y]): Vec2 => [x + 20, y + 30])), 0.8, { blur: 18, max: true });
      for (const f of fingersAt(e.u)) toneFinger(e, f, 0.34);
      const it = region(item(e.t));
      shade(e, it, 0.06, { blur: 1 });
      shadeRadial(e, 770, 440, 170, 0, 0.4, { clip: it, max: true });
    },
    line(e) {
      fingersAt(e.u).forEach((f, k) => engraveFinger(e, f, o.seed + k));
      const pts = item(e.t);
      scratchLines(e, [[...pts, pts[0]!]], 3, INK, 0.95);
      if (o.item === 'shard') scratchLines(e, [[pts[0]!, [800, 470], pts[3]!], [[800, 470], pts[1]!]], 1.6, INK, 0.7);
      if (o.item === 'tablet') scratchLines(e, [[pts[0]!, pts[20]!]], 1.8, INK, 0.8);
      if (o.item === 'capsule') scratchLines(e, [place(e.t)([[0, -48], [0, 48]])], 2, INK, 0.9);
      erase(e, region(blob(770, 446, 22, 8, 2, 0.1, turn(e.t), 12)));
    },
  };
}
