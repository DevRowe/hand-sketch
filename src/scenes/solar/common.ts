/**
 * Shared geometry of the solar set ("One Sky, Ten Hands"): the solar system seen from straight above the ecliptic,
 * drawn ten times in ten visual languages. Every piece reads its layout and its clock from here, so the ten differ in
 * mark-making only, never in where a planet is.
 *
 * - The plan: a 1080 x 1080 design box, the Sun at its centre, eight near-circular orbits spaced for composition
 *   (inner ones true to order, outer ones compressed), an asteroid belt between Mars and Jupiter, the Moon on its own
 *   small orbit around the Earth.
 * - The clock: one loop of `LOOP` drawn frames. Every body makes a whole number of turns per loop, inner faster than
 *   outer, counter-clockwise on the page as seen from the north. Angles are counted as whole-frame remainders
 *   (`turns * m mod LOOP`), so the seam frame is exact, not merely equal up to rounding.
 * - Light: each planet is lit on its sunward half; `sunward` gives the direction, `dayHalf` the lit half-disc.
 *
 * The technique kit (layers, inks, page-locked screens, hatching, stipple, scissor cuts) is the gallery's.
 */
import { TAU, type Vec2 } from '../../core/math';
import { rng } from '../../core/random';
import type { SceneFrame } from '../../core/scene';
import { fit, nf, perSize, type Fit } from '../kit';

/** Design box (square: a plan has no horizon). */
export const BOX = 1080;
export const C: Vec2 = [BOX / 2, BOX / 2];

/** Drawn frames in one loop: 48 s at 12 fps. Mercury's 12 turns and the Moon's 28 close on it exactly. */
export const LOOP = 576;

/** The frame, counted from the loop start, that every poster rests on: the same planetary configuration in all ten. */
export const POSTER_M = 36;

export const SUN_R = 50;

export type PlanetName = 'mercury' | 'venus' | 'earth' | 'mars' | 'jupiter' | 'saturn' | 'uranus' | 'neptune';

export interface Planet {
  name: PlanetName;
  /** Orbit radius, design units. */
  a: number;
  /** Disc radius. */
  r: number;
  /** Whole turns per loop. */
  turns: number;
  /** Angle at the loop start, radians on the page (y down). */
  at0: number;
}

/**
 * Inner to outer. Turns per loop fall off roughly geometrically (about x1.35 a step), which is how Kepler's law reads
 * on orbits compressed like these; the Earth makes seven years in one loop, Neptune one.
 */
export const PLANETS: readonly Planet[] = [
  { name: 'mercury', a: 86, r: 6.5, turns: 12, at0: 5.3 },
  { name: 'venus', a: 122, r: 10.5, turns: 9, at0: 2.2 },
  { name: 'earth', a: 164, r: 11.5, turns: 7, at0: 3.95 },
  { name: 'mars', a: 210, r: 8.5, turns: 5, at0: 0.55 },
  { name: 'jupiter', a: 292, r: 28, turns: 4, at0: 4.75 },
  { name: 'saturn', a: 366, r: 21, turns: 3, at0: 1.2 },
  { name: 'uranus', a: 430, r: 14, turns: 2, at0: 3.05 },
  { name: 'neptune', a: 488, r: 13.5, turns: 1, at0: 5.85 },
];

export const planet = (name: PlanetName): Planet => PLANETS.find(p => p.name === name)!;

/** The Moon's orbit around the Earth: four months to an Earth year here, 28 per loop. */
export const MOON = { a: 25, r: 4, turns: 28, at0: 1.1 } as const;

/**
 * Saturn's rings seen from above: an annulus (inner and outer radius) whose axis stays fixed in space as the planet
 * goes round, foreshortened a little by the planet's tilt.
 */
export const RINGS = { inner: 28, outer: 40, squash: 0.86, angle: -0.5 } as const;

/** Uranus lies on its side: from above its thin ring is a narrow ellipse, also fixed in space. */
export const URANUS_RING = { rx: 22, ry: 6, angle: 0.35 } as const;

export interface Rock {
  a: number;
  at0: number;
  /** Inner rocks keep Mars's pace, outer ones Jupiter's, so the belt shears as it turns. */
  turns: number;
  size: number;
  /** 0..1, for per-rock variation. */
  tone: number;
}

export const BELT = { inner: 232, outer: 256 } as const;

/** The asteroid belt: a seeded scatter, densest mid-belt. */
export const ROCKS: readonly Rock[] = (() => {
  const r = rng(90210), out: Rock[] = [];
  for (let k = 0; k < 170; k++) {
    const u = (r() + r() + r()) / 3, a = BELT.inner + u * (BELT.outer - BELT.inner);
    out.push({ a, at0: r() * TAU, turns: a < (BELT.inner + BELT.outer) / 2 ? 5 : 4, size: 0.6 + Math.pow(r(), 3) * 2.2, tone: r() });
  }
  return out;
})();

/* ---------- clock ---------- */

/**
 * Whole drawn frames since the loop section started, unwrapped: negative through a draw-on intro, `LOOP` on the
 * never-shown seam frame. Rounded so a render on ones shows the same positions as on twos.
 */
export const orbitClock = (f: SceneFrame, loopFromFrames: number): number => Math.round(nf(f)) - loopFromFrames;

/** `x` modulo `m`, always in [0, m). */
const wrap = (x: number, m: number): number => ((x % m) + m) % m;

/**
 * Angle of a body making `turns` whole turns per loop, `m` frames into it: counter-clockwise on the page. The turn is
 * counted as a whole-frame remainder, so `m = LOOP` gives exactly the angle at `m = 0`.
 */
export const orbitAngle = (turns: number, at0: number, m: number): number => at0 - (TAU * wrap(turns * m, LOOP)) / LOOP;

export const planetAngle = (p: Planet, m: number): number => orbitAngle(p.turns, p.at0, m);

/** Phase 0..1 of something that runs `cycles` whole cycles per loop, `m` frames in: exact at the seam, like the angles. */
export const cyclePhase = (cycles: number, m: number): number => wrap(cycles * m, LOOP) / LOOP;

/** Centre of a planet `m` frames into the loop, design units. */
export function planetAt(p: Planet, m: number): Vec2 {
  const a = planetAngle(p, m);
  return [C[0] + Math.cos(a) * p.a, C[1] + Math.sin(a) * p.a];
}

/** The Moon's offset from the Earth's centre. */
export function moonOffset(m: number): Vec2 {
  const a = orbitAngle(MOON.turns, MOON.at0, m);
  return [Math.cos(a) * MOON.a, Math.sin(a) * MOON.a];
}

export function rockAt(rk: Rock, m: number): Vec2 {
  const a = orbitAngle(rk.turns, rk.at0, m);
  return [C[0] + Math.cos(a) * rk.a, C[1] + Math.sin(a) * rk.a];
}

/** Direction from a point towards the Sun, radians. */
export const sunward = ([x, y]: Vec2): number => Math.atan2(C[1] - y, C[0] - x);

/* ---------- shapes ---------- */

/**
 * The lit half of a disc of radius `r` at the origin whose Sun lies at angle `toSun`: the half-disc facing it, from
 * limb to limb.
 */
export function dayHalf(r: number, toSun: number, n = 32): Vec2[] {
  const out: Vec2[] = [];
  for (let k = 0; k <= n; k++) {
    const a = toSun - Math.PI / 2 + (k / n) * Math.PI;
    out.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  return out;
}

/** An annulus as a Path2D (outer ring clockwise, inner counter-clockwise), for even-odd free filling. */
export function annulus(cx: number, cy: number, inner: number, outer: number, squash = 1, angle = 0): Path2D {
  const p = new Path2D();
  p.ellipse(cx, cy, outer, outer * squash, angle, 0, TAU);
  p.moveTo(cx + Math.cos(angle) * inner, cy + Math.sin(angle) * inner);
  p.ellipse(cx, cy, inner, inner * squash, angle, 0, TAU, true);
  return p;
}

/** A disc as a Path2D. */
export function disc(cx: number, cy: number, r: number): Path2D {
  const p = new Path2D();
  p.arc(cx, cy, r, 0, TAU);
  return p;
}

/**
 * An invented brush character centred at (x, y) in a `size` box: a few seeded horizontals, verticals, sweeps and dots.
 * It reads as writing in a cartouche or a colophon without being any real script.
 */
export function brushChar(x: number, y: number, size: number, seed: number): Vec2[][] {
  const r = rng(seed), out: Vec2[][] = [], h = size / 2;
  const count = 3 + Math.floor(r() * 3);
  for (let k = 0; k < count; k++) {
    const kind = r();
    if (kind < 0.36) {
      const yy = y + (r() - 0.5) * size * 0.85, x0 = x - h * (0.5 + r() * 0.4), x1 = x + h * (0.5 + r() * 0.4);
      out.push([[x0, yy], [(x0 + x1) / 2, yy - size * 0.03], [x1, yy + size * 0.02]]);
    } else if (kind < 0.66) {
      const xx = x + (r() - 0.5) * size * 0.7, y0 = y - h * (0.55 + r() * 0.4), y1 = y + h * (0.5 + r() * 0.45);
      out.push([[xx, y0], [xx + size * 0.02, (y0 + y1) / 2], [xx - (r() < 0.4 ? size * 0.12 : 0), y1]]);
    } else if (kind < 0.86) {
      const dir = r() < 0.5 ? -1 : 1, x0 = x + (r() - 0.5) * size * 0.3, y0 = y - h * (0.2 + r() * 0.5);
      out.push([[x0, y0], [x0 + dir * size * 0.18, y0 + size * 0.3], [x0 + dir * size * 0.42, y0 + size * 0.5]]);
    } else {
      const xx = x + (r() - 0.5) * size * 0.8, yy = y + (r() - 0.5) * size * 0.8;
      out.push([[xx, yy], [xx + size * 0.08, yy + size * 0.1]]);
    }
  }
  return out;
}

/* ---------- layout ---------- */

export interface Frame {
  F: Fit;
  /** Output-space origin of the design box and its scale, for `ctx.translate(ox, oy); ctx.scale(s, s)`. */
  ox: number;
  oy: number;
  s: number;
}

export const frameFit = perSize((w, h): Frame => {
  const F = fit(w, h, BOX, BOX), [ox, oy] = F.P(0, 0);
  return { F, ox, oy, s: F.s };
});

/** A value built on first use: layouts in design units are the same for every frame size. */
export function once<T>(build: () => T): () => T {
  let v: T | undefined;
  return () => (v ??= build());
}

/** Enter the design box on `ctx` (callers wrap it in save/restore). */
export function enter(ctx: CanvasRenderingContext2D, fr: Frame): void {
  ctx.translate(fr.ox, fr.oy);
  ctx.scale(fr.s, fr.s);
}
