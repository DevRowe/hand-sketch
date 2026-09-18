/**
 * Shared geometry of the spiral set ("One Wake, Ten Hands"): the solar system seen at an angle while the Sun travels
 * through space and drags its planets along, so every orbit is drawn out into a helix. The ten pieces read their
 * camera, their clock and every trail from here, so they differ in mark-making only, never in where a planet is.
 *
 * - The system is the top-down set's (`../solar/common`): the same eight planets with the same whole turns per loop
 *   and the same starting angles, the Moon, the belt; orbits scaled down by `K` so the system and its wake fit.
 * - The Sun moves at a steady `SPEED` along `MOTION`, towards the viewer and to the right; the camera travels with it,
 *   so the Sun holds its place on the page and the wake streams away behind it, back and to the left, into depth.
 *   The orbital plane is square to the motion, so each planet's path is a circular helix around the Sun's line, its
 *   pitch the distance the Sun covers in one of its years: Mercury a tight, fast corkscrew, Neptune one long, lazy
 *   turn.
 *   This is a visualisation of the idea, tilted and exaggerated for the picture, not a to-scale model.
 * - Perspective: a pinhole camera `DIST` in front of the Sun, looking at it along +z with the orbital plane tipped
 *   `TILT` from face-on. Near halves of the orbits and trails pass in front of the Sun's line, far halves behind;
 *   `paint` lays everything down in that order so every piece shares the same occlusion.
 * - The clock: the top-down set's `LOOP`, counted in whole drawn frames. A trail is the helix sampled back in time
 *   from the planet, `SUB` samples a frame; each sample's angle is a whole-number remainder (`turns * t mod SUB *
 *   LOOP`), and its offset along the wake depends only on its age, so a trail is a pure function of the loop clock,
 *   never accumulated from frame to frame, and the seam frame repeats the first exactly. Dust in the wake scrolls
 *   through a periodic box a whole number of times a loop, fading at the box's ends so nothing pops.
 * - Under the live explorer's dated sky (`../solar/sky`) the same wakes trace the planets' real motion: how far back
 *   they reach is the viewer's choice, and the Sun's pace is set so that span always fills the same depth (see
 *   `datedPlan`). Either way every wake is sampled on a grid fixed in time, so marks keyed to a sample ride with it.
 */
import { clamp, TAU, type Vec2 } from '../../core/math';
import { loopNoise, rng } from '../../core/random';
import type { SceneFrame } from '../../core/scene';
import { BELT as PLAN_BELT, LOOP, MOON as PLAN_MOON, MOON_K, once, PLANETS as PLAN_PLANETS, ROCKS as PLAN_ROCKS, orbitClock, type PlanetName } from '../solar/common';
import { loopSky, skyOf, type Sky, type TrailSpec } from '../solar/sky';

export { BOX, cyclePhase, disc, drawnFrame, enter, frameFit, LOOP, once, POSTER_M, type Frame, type PlanetName } from '../solar/common';

export type Vec3 = readonly [number, number, number];

/* ---------- vectors ---------- */

const dot3 = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross3 = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit3 = (a: Vec3): Vec3 => {
  const l = Math.hypot(a[0], a[1], a[2]);
  return [a[0] / l, a[1] / l, a[2] / l];
};

/* ---------- the system ---------- */

/** Orbit radii are the plan's scaled by `K`; discs by `KR` (less, so the small ones stay legible). */
export const K = 0.56;
export const KR = 0.72;

export const SUN_R = 28;

export interface Planet {
  name: PlanetName;
  /** Index inner to outer, 0..7. */
  k: number;
  /** Orbit radius, design units. */
  a: number;
  /** Disc radius at the Sun's depth. */
  r: number;
  /** Whole turns per loop (the plan's). */
  turns: number;
  /** Angle at the loop start (the plan's). */
  at0: number;
  /** Length of its wake, drawn frames. */
  trail: number;
}

/**
 * How many turns of its helix each planet trails behind it: the inner ones a few tight coils, the outer ones a long
 * part-turn, capped at one loop (so the tail of the wake is always as old as the loop, never older).
 */
const COILS = 2.6;

export const PLANETS: readonly Planet[] = PLAN_PLANETS.map((p, k) => ({
  name: p.name, k, a: p.a * K, r: p.r * KR, turns: p.turns, at0: p.at0,
  trail: Math.min(LOOP, Math.round((COILS * LOOP) / p.turns)),
}));

export const planet = (name: PlanetName): Planet => PLANETS.find(p => p.name === name)!;

/** The Moon round the Earth, in the orbital plane; its own short wake coils round the Earth's. */
export const MOON = { a: 14, r: 2.8, turns: PLAN_MOON.turns, at0: PLAN_MOON.at0, trail: 110 } as const;

export const BELT = { inner: PLAN_BELT.inner * K, outer: PLAN_BELT.outer * K } as const;

export interface Rock { i: number; a: number; at0: number; turns: number; size: number; tone: number }

export const ROCKS: readonly Rock[] = PLAN_ROCKS.map(rk => ({ ...rk, a: rk.a * K, size: rk.size * 0.8 }));

/** Saturn's rings (inner, outer radius) lie in the orbital plane; Uranus's single ring stands square to it. */
export const RINGS = { inner: 20, outer: 29 } as const;
export const URANUS_RING = 16;

/* ---------- motion and camera ---------- */

/** Design units the Sun travels per drawn frame. */
export const SPEED = 2.4;

/** The orbital plane is tipped this far from face-on (about 58 degrees): orbits read as ellipses half as wide as long. */
export const TILT = 1.02;
/** Direction of the Sun's travel across the page, radians (y down): to the right and a little down. */
const HEADING = 0.55;

/** Unit direction of the Sun's travel, camera axes (x right, y down, z away from the viewer): out of the page. */
export const MOTION: Vec3 = [Math.sin(TILT) * Math.cos(HEADING), Math.sin(TILT) * Math.sin(HEADING), -Math.cos(TILT)];

/** The orbital plane's basis: `E1` and `E2` span it, `MOTION` is its normal. */
export const E1: Vec3 = unit3(cross3(MOTION, [0, 0, 1]));
export const E2: Vec3 = cross3(MOTION, E1);

/** Camera distance in front of the Sun; a point at the Sun's depth draws at scale 1. */
export const DIST = 950;

/** Where the Sun sits on the page (the camera's lens is shifted, not turned, so the view stays square to +z). */
export const SUN_AT: Vec2 = [745, 640];

export interface Projected {
  x: number;
  y: number;
  /** Depth: distance in front of the camera. */
  z: number;
  /** Perspective scale: 1 at the Sun's depth, larger nearer. */
  s: number;
}

export function project(p: Vec3): Projected {
  const z = DIST + p[2], s = DIST / Math.max(z, 1);
  return { x: SUN_AT[0] + p[0] * s, y: SUN_AT[1] + p[1] * s, z, s };
}

/** A point in the orbital plane at radius `a`, angle `ang`, relative to the Sun. */
export const inPlane = (a: number, ang: number): Vec3 => {
  const c = Math.cos(ang) * a, s = Math.sin(ang) * a;
  return [E1[0] * c + E2[0] * s, E1[1] * c + E2[1] * s, E1[2] * c + E2[2] * s];
};

/** A point `age` back along the Sun's line (drawn frames at `SPEED`, or any time unit at its `speed`), relative to where the Sun is now. */
export const behind = (p: Vec3, age: number, speed = SPEED): Vec3 => [p[0] - MOTION[0] * speed * age, p[1] - MOTION[1] * speed * age, p[2] - MOTION[2] * speed * age];

/** Whether an offset from the Sun's line lies on the viewer's side of it (the near half of an orbit or a coil). */
export const isNear = (offset: Vec3): boolean => offset[2] < 0;

/* ---------- clock ---------- */

/** Drawn frames of intro before the loop: the wakes unspool from the planets back into the distance. */
export const INTRO = 48;

/** Whole drawn frames since the loop started, unwrapped: negative in the intro, `LOOP` on the seam frame. */
export const spiralClock = (f: SceneFrame): number => orbitClock(f, INTRO);

/** The sky a spiral frame is drawn under: the one it carries (the explorer's), else the loop sky at the spiral clock. */
export const spiralSky = (f: SceneFrame): Sky => skyOf(f, INTRO);

/** Trail samples per drawn frame. */
export const SUB = 2;

const wrapInt = (x: number, m: number): number => ((x % m) + m) % m;

/**
 * Angle of a body with `turns` whole turns per loop at sub-step `q` (drawn frame `q / SUB`): a whole-number remainder,
 * so `q + SUB * LOOP` gives exactly the angle at `q`.
 */
export const angleAt = (turns: number, at0: number, q: number): number => at0 - (TAU * wrapInt(turns * q, SUB * LOOP)) / (SUB * LOOP);

/** How much of each wake has unspooled: 0 at the start of the intro, 1 from the loop start on. */
export const reveal = (m: number): number => {
  const t = clamp((m + INTRO) / INTRO, 0, 1);
  return t * t * (3 - 2 * t);
};

/* ---------- how the wakes are sampled ---------- */

/** Wake index of the Sun's own line; the planets' are 0..7 and the Moon's 8. */
export const SUN_W = 9;

/** How deep a dated sky's wakes reach along the Sun's line, design units: about the plan's Neptune wake. */
const DEPTH = 1400;
/** A dated wake reaches back at most this many turns of its coil, so the inner planets stay coils, not tubes. */
const COILS_MAX = 3;
const MOON_COILS_MAX = 5;
/** Aimed-for distance between neighbouring samples along a dated wake, design units (the loop's are 2 to 3.5). */
const SPACING = 2.5;
/** Most samples a dated wake may take. */
const MAX_SAMPLES = 2400;
/** Sky time a dated wake grid counts from (the year 1000): every key stays positive. */
const ORIGIN = -365_242;

/**
 * How the wakes are sampled under a sky: a render's are the piece's own (`SUB` samples a drawn frame, each wake its
 * fixed length, the Sun at `SPEED`); a dated sky's come from the viewer's trail span.
 */
export interface WakePlan {
  /** Sky time per sample of each wake (planets 0..7, the Moon 8, the Sun's line 9). */
  step: readonly number[];
  /** Samples in each wake when wholly unspooled. */
  full: readonly number[];
  /**
   * Samples per ruler tick along each wake (one Mercury year in a render, a dozen ticks a span on a dated sky): marks
   * at `q % tick === 0` line up in time across wakes.
   */
  tick: readonly number[];
  /** Design units the Sun covers per unit of sky time. */
  speed: number;
  /** 0..1 of each wake unspooled. */
  reveal: number;
  /** 0..1 strength the wakes are drawn at. */
  alpha: number;
  /** Sample keys wrap at this (one loop, so the seam repeats exactly), or never (0). */
  keyWrap: number;
  /** Sky time the sample grid counts from. */
  origin: number;
  /** How far the wake dust has scrolled through its box, in 1/LOOP of the box. */
  dust: number;
}

/** The piece's own wakes, `m` frames into the loop. */
function loopPlan(m: number): WakePlan {
  const full = [...PLANETS.map(pl => pl.trail * SUB), MOON.trail * SUB, LOOP * SUB];
  return {
    step: full.map(() => 1 / SUB), full, tick: full.map(() => (LOOP / PLANETS[0]!.turns) * SUB),
    speed: SPEED, reveal: reveal(m), alpha: 1, keyWrap: SUB * LOOP, origin: 0, dust: DUST_PASSES * m,
  };
}

/**
 * Wakes of the real motion, reaching `spec.span` days back. The Sun's pace is chosen so that span fills `DEPTH`
 * whatever it is: a short span stretches the coils out, a long one packs them tight. Each wake is capped at a few
 * turns of its coil; its samples fall about `SPACING` apart along the path, on a grid of whole fractions of a Mercury
 * year counted from `ORIGIN`, so a mark keyed to a sample rides with it and ruler ticks line up across wakes.
 */
function datedPlan(sky: Sky, spec: TrailSpec): WakePlan {
  // ruler ticks: whole Mercury years, about a dozen along the span
  const speed = DEPTH / spec.span, year = sky.period(0), ruler = Math.max(1, Math.round(spec.span / 12 / year));
  const step: number[] = [], full: number[] = [], tick: number[] = [];
  for (let w = 0; w <= SUN_W; w++) {
    let reach = spec.span, pace = 0;
    if (w < SUN_W) {
      const P = sky.period(w), a = w === MOON_K ? MOON.a : PLANETS[w]!.a;
      reach = Math.min(spec.span, (w === MOON_K ? MOON_COILS_MAX : COILS_MAX) * P);
      // the Moon rides the Earth: bound its pace by the two together
      pace = (TAU * a) / P + (w === MOON_K ? (TAU * PLANETS[2]!.a) / sky.period(2) : 0);
    }
    const ideal = Math.max(SPACING / Math.hypot(pace, speed), reach / MAX_SAMPLES), n = Math.max(2, Math.round(year / ideal));
    step.push(year / n);
    tick.push(n * ruler);
    full.push(reach / (year / n));
  }
  return { step, full, tick, speed, reveal: spec.reveal, alpha: spec.alpha, keyWrap: 0, origin: ORIGIN, dust: (speed * (sky.now - ORIGIN) * LOOP) / DUST_LEN };
}

/** The wake plan of a sky: the viewer's when it carries trails, else the piece's own. */
export const wakePlan = (sky: Sky): WakePlan => (sky.trails ? datedPlan(sky, sky.trails) : loopPlan(sky.now));

/* ---------- a moment of the system ---------- */

export interface Sample extends Projected {
  /** 0 at the head, 1 at the tail of the full-length wake. */
  age: number;
  /**
   * Index of the sample on its wake's grid, fixed in time (wrapped into one loop for a render): a key for marks that
   * should ride along with the path. A head or tail between grid points carries a fractional one.
   */
  q: number;
  near: boolean;
  /** Where the sample sits round the Sun's line: -1 straight behind it .. 1 straight in front (0 on the line). */
  side: number;
}

export interface Trail {
  /** Planet index 0..7, or 8 for the Moon. */
  k: number;
  /** Head first. */
  samples: Sample[];
}

export interface Body extends Projected {
  planet: Planet;
  /** Disc radius on the page. */
  R: number;
  /** Position relative to the Sun. */
  p: Vec3;
  near: boolean;
  /** Direction towards the Sun on the page, radians. */
  toSun: number;
  /** Cosine of the phase angle: 1 fully lit (Sun behind the viewer), -1 new (Sun behind the planet). */
  phase: number;
  /** Unit direction to the Sun, camera axes, for shading a sphere point by point. */
  light: Vec3;
}

export interface MoonState extends Projected {
  R: number;
  p: Vec3;
  /** In front of the Earth. */
  front: boolean;
  toSun: number;
  phase: number;
  light: Vec3;
}

export interface RockState extends Projected {
  rock: Rock;
  near: boolean;
  /** Its angle round the Sun, radians. */
  angle: number;
}

export interface Snapshot {
  /** The moment, in the sky's time unit. */
  now: number;
  /** Drawn frames of ambient motion (twinkles, sparkles, sweeps). */
  beat: number;
  sun: Projected & { R: number };
  bodies: Body[];
  moon: MoonState;
  trails: Trail[];
  /** The Sun's own wake: its line, back into the distance. */
  sunTrail: Sample[];
  rocks: RockState[];
  /** How the wakes were sampled: their strength, ruler ticks and the dust's scroll. */
  plan: WakePlan;
  /**
   * Strength of plain orbit rings standing in for the wakes as a viewer fades them out (0 in renders): pieces that
   * draw no rings of their own draw them at this.
   */
  rings: number;
}

function light(p: Vec3, pr: Projected, sun: Projected): { toSun: number; phase: number; light: Vec3 } {
  const toSunV = unit3([-p[0], -p[1], -p[2]]), toCam = unit3([-p[0], -p[1], -DIST - p[2]]);
  return { toSun: Math.atan2(sun.y - pr.y, sun.x - pr.x), phase: dot3(toSunV, toCam), light: toSunV };
}

/**
 * Brightness 0..1 of the point (u, v) of a sphere's disc (unit radius, page axes) lit from `light`: the sphere's
 * normal there faces the viewer (-z), so this is the true phase, crescent to full.
 */
export function shadeAt(u: number, v: number, light: Vec3): number {
  const w = Math.sqrt(Math.max(0, 1 - u * u - v * v));
  return Math.max(0, u * light[0] + v * light[1] - w * light[2]);
}

/** A deterministic, well-mixed hash of up to four integers to [0, 1), for marks keyed to a sample's own time. */
export function hash01(a: number, b = 0, c = 0, d = 0): number {
  let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul((b | 0) + 0x3c6ef372, 0x165667b1) ^ Math.imul((c | 0) + 0x5be0cd19, 0x9e3779b9) ^ Math.imul((d | 0) + 0x1f83d9ab, 0x85ebca77);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/**
 * Wake `w` sampled back from `now` along its grid: the head, every grid point behind it, and the tail where the
 * unspooled length runs out (head and tail fall between grid points when `now` does).
 */
function wakeOf(plan: WakePlan, w: number, now: number, at: (t: number) => Vec3): Sample[] {
  const out: Sample[] = [], h = plan.step[w]!, full = plan.full[w]!, q0 = (now - plan.origin) / h, n = Math.round(full * plan.reveal);
  const sample = (q: number): Sample => {
    const back = q0 - q, off = at(plan.origin + q * h), pr = project(behind(off, back * h, plan.speed)), r = Math.hypot(off[0], off[1], off[2]);
    return { ...pr, age: back / full, q: plan.keyWrap ? wrapInt(q, plan.keyWrap) : q, near: isNear(off), side: r > 0 ? -off[2] / r : 0 };
  };
  out.push(sample(q0));
  for (let q = Math.ceil(q0) - 1; q > q0 - n; q--) out.push(sample(q));
  if (n > 0) out.push(sample(q0 - n));
  return out;
}

/** The whole system under a sky (a render's loop sky, or the explorer's dated one), as the camera sees it. */
export function snapshot(sky: Sky): Snapshot {
  const now = sky.now, plan = wakePlan(sky), sun = { ...project([0, 0, 0]), R: SUN_R };
  const bodies = PLANETS.map((pl): Body => {
    const p = inPlane(pl.a, sky.angle(pl.k, now)), pr = project(p);
    return { ...pr, planet: pl, R: pl.r * pr.s, p, near: isNear(p), ...light(p, pr, sun) };
  });
  const earth = bodies[2]!;
  const moonAt = (t: number): Vec3 => {
    const e = inPlane(PLANETS[2]!.a, sky.angle(2, t)), o = inPlane(MOON.a, sky.angle(MOON_K, t));
    return [e[0] + o[0], e[1] + o[1], e[2] + o[2]];
  };
  const mp = moonAt(now), mpr = project(mp);
  const moon: MoonState = { ...mpr, R: MOON.r * mpr.s, p: mp, front: mp[2] < earth.p[2], ...light(mp, mpr, sun) };
  // a faded-out wake is not sampled at all
  const live = plan.alpha > 0;
  const trails: Trail[] = PLANETS.map(pl => ({ k: pl.k, samples: live ? wakeOf(plan, pl.k, now, t => inPlane(pl.a, sky.angle(pl.k, t))) : [] }));
  trails.push({ k: MOON_K, samples: live ? wakeOf(plan, MOON_K, now, moonAt) : [] });
  const sunTrail = live ? wakeOf(plan, SUN_W, now, () => [0, 0, 0]) : [];
  const rocks = ROCKS.map((rock): RockState => {
    const angle = sky.rock(rock.i, now), p = inPlane(rock.a, angle);
    return { ...project(p), rock, near: isNear(p), angle };
  });
  return { now, beat: sky.beat, sun, bodies, moon, trails, sunTrail, rocks, plan, rings: sky.trails ? 1 - sky.trails.alpha : 0 };
}

/** The loop sky's snapshot `m` frames into the loop: what a render draws. */
export const loopSnapshot = (m: number): Snapshot => snapshot(loopSky(m));

/* ---------- wake dust ---------- */

export interface Mote extends Projected {
  /** 0..1, fading in and out at the ends of the box. */
  alpha: number;
  tone: number;
}

/** The box of dust the system flies through: this long along the Sun's line, scrolled `DUST_PASSES` times a loop. */
const DUST_LEN = 2400;
const DUST_PASSES = Math.round((SPEED * LOOP) / DUST_LEN);
const DUST_BASE = (() => {
  const r = rng(52_041), out: { along: number; u: number; v: number; tone: number }[] = [];
  for (let k = 0; k < 420; k++) out.push({ along: Math.floor(r() * LOOP), u: (r() * 2 - 1) * 1400, v: (r() * 2 - 1) * 1400, tone: r() });
  return out;
})();

/** A second, perpendicular axis across the Sun's line, for spreading the dust. */
const ACROSS: Vec3 = unit3(cross3(MOTION, E1));

/**
 * Dust motes of a moment, projected. Each rides the box at the Sun's speed (it is still; the camera moves), counted in
 * whole frames on the loop sky so the seam is exact, and fades in and out at the ends of the box.
 */
export function dust(S: Snapshot): Mote[] {
  const out: Mote[] = [];
  for (const d of DUST_BASE) {
    const w = wrapInt(d.along - S.plan.dust, LOOP) / LOOP, along = (w - 0.35) * DUST_LEN;
    const p: Vec3 = [
      MOTION[0] * along + E1[0] * d.u + ACROSS[0] * d.v,
      MOTION[1] * along + E1[1] * d.u + ACROSS[1] * d.v,
      MOTION[2] * along + E1[2] * d.u + ACROSS[2] * d.v,
    ];
    if (DIST + p[2] < DIST * 0.45) continue;
    const pr = project(p);
    const alpha = Math.sin(Math.PI * w) ** 1.5;
    out.push({ ...pr, alpha, tone: d.tone });
  }
  return out;
}

/* ---------- shapes ---------- */

/** The current orbit of a planet round the Sun, projected, split into its far and near halves (each an open run). */
export const orbitRing = (k: number): { far: Projected[]; near: Projected[] } => ORBITS()[k]!;
const ORBITS = once(() => PLANETS.map(pl => orbitHalves(pl.a)));

function orbitHalves(a: number, n = 120): { far: Projected[]; near: Projected[] } {
  const far: Projected[] = [], near: Projected[] = [];
  // the near half is where the plane's offset points at the viewer: angles where inPlane(...)[2] < 0
  const a0 = Math.atan2(-E2[2], -E1[2]);
  for (let j = 0; j <= n; j++) {
    const t = a0 - Math.PI / 2 + (j / n) * Math.PI;
    near.push(project(inPlane(a, t)));
    far.push(project(inPlane(a, t + Math.PI)));
  }
  return { far, near };
}

/**
 * The lit part of a disc of radius `r` at the origin with the Sun towards `toSun` on the page and phase cosine
 * `phase`: the sunward limb and the terminator, a half-ellipse bulging away from the Sun when gibbous, towards it
 * when a crescent.
 */
export function litShape(r: number, toSun: number, phase: number, n = 24): Vec2[] {
  const ux = Math.cos(toSun), uy = Math.sin(toSun), wx = -uy, wy = ux, out: Vec2[] = [];
  for (let j = 0; j <= n; j++) {
    const t = -Math.PI / 2 + (j / n) * Math.PI, c = Math.cos(t) * r, s = Math.sin(t) * r;
    out.push([ux * c + wx * s, uy * c + wy * s]);
  }
  for (let j = 0; j <= n; j++) {
    const t = Math.PI / 2 - (j / n) * Math.PI, c = -phase * Math.cos(t) * r, s = Math.sin(t) * r;
    out.push([ux * c + wx * s, uy * c + wy * s]);
  }
  return out;
}

/** A ring of radius `rad` round a body at `c` (relative to the Sun) in the plane of `u`, `v`; split by depth. */
export function bodyRing(c: Vec3, rad: number, u: Vec3, v: Vec3, n = 64): { back: Projected[]; front: Projected[] } {
  const back: Projected[] = [], front: Projected[] = [];
  const a0 = Math.atan2(-v[2], -u[2]);
  for (let j = 0; j <= n; j++) {
    const t = a0 - Math.PI / 2 + (j / n) * Math.PI;
    const at = (tt: number): Vec3 => [c[0] + (u[0] * Math.cos(tt) + v[0] * Math.sin(tt)) * rad, c[1] + (u[1] * Math.cos(tt) + v[1] * Math.sin(tt)) * rad, c[2] + (u[2] * Math.cos(tt) + v[2] * Math.sin(tt)) * rad];
    front.push(project(at(t)));
    back.push(project(at(t + Math.PI)));
  }
  return { back, front };
}

/** A flat ring (Saturn's) round a body as two closed polygons, the half behind the body and the half in front. */
export function bodyBand(c: Vec3, inner: number, outer: number, u: Vec3, v: Vec3, n = 48): { back: Vec2[]; front: Vec2[] } {
  const o = bodyRing(c, outer, u, v, n), i = bodyRing(c, inner, u, v, n);
  const poly = (a: Projected[], b: Projected[]): Vec2[] => [...a.map((p): Vec2 => [p.x, p.y]), ...[...b].reverse().map((p): Vec2 => [p.x, p.y])];
  return { back: poly(o.back, i.back), front: poly(o.front, i.front) };
}

/* ---------- marks along a wake ---------- */

/**
 * Smooth periodic noise, about -1..1, keyed on a sample's own time `q`: a mark keyed on it rides along with the path
 * instead of swimming, and repeats exactly on the seam. `cycles` sets roughly how many features it has per loop.
 */
export const along = (q: number, seed: number, cycles = 24): number => loopNoise(q / (SUB * LOOP), seed, cycles / TAU);

/** Unit tangent of a run on the page at sample `i`, head to tail. */
export function tangent(run: readonly Sample[], i: number): Vec2 {
  const a = run[Math.max(0, i - 1)]!, b = run[Math.min(run.length - 1, i + 1)]!;
  const dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1;
  return [dx / l, dy / l];
}

/** A ribbon along a run: the left edge head to tail, then the right edge back; `half` is the half width at a sample. */
export function ribbon(run: readonly Sample[], half: (s: Sample, i: number) => number): Vec2[] {
  const left: Vec2[] = [], right: Vec2[] = [];
  run.forEach((s, i) => {
    const [tx, ty] = tangent(run, i), h = half(s, i);
    left.push([s.x - ty * h, s.y + tx * h]);
    right.push([s.x + ty * h, s.y - tx * h]);
  });
  return left.concat(right.reverse());
}

/**
 * Stroke a run in pieces, each with the width and alpha `style` gives its middle sample (null to skip it): a line that
 * thins and fades along its length. Pieces break where a sample's own time `q` is a multiple of `step` (which should
 * divide `SUB * LOOP`), so they ride along with the path: dashes keyed on the middle sample stay put on it. Pieces
 * share their end samples and have butt ends, so the joins neither gap nor double up at these sampling densities.
 */
export function strokeRun(ctx: CanvasRenderingContext2D, run: readonly Sample[], step: number, style: (s: Sample) => { width: number; alpha: number } | null): void {
  ctx.save();
  ctx.lineCap = 'butt';
  ctx.lineJoin = 'round';
  const base = ctx.globalAlpha;
  for (let i = 0; i < run.length - 1;) {
    let j = i + 1;
    while (j < run.length - 1 && run[j]!.q % step !== 0) j++;
    const st = style(run[(i + j) >> 1]!);
    if (st && st.alpha > 0 && st.width > 0) {
      ctx.globalAlpha = base * st.alpha;
      ctx.lineWidth = st.width;
      ctx.beginPath();
      for (let k = i; k <= j; k++) (k === i ? ctx.moveTo(run[k]!.x, run[k]!.y) : ctx.lineTo(run[k]!.x, run[k]!.y));
      ctx.stroke();
    }
    i = j;
  }
  ctx.restore();
}

/** Trace a run of points into the current path. */
export function trace(ctx: CanvasRenderingContext2D | Path2D, pts: readonly { x: number; y: number }[]): void {
  pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
}

/**
 * Draw part of a wake at the wakes' strength: as it is in a render, faded as the viewer asks in the explorer (a
 * wholly faded wake has no samples, so nothing reaches `draw`).
 */
export function inWake(ctx: CanvasRenderingContext2D, S: Snapshot, draw: () => void): void {
  const a = S.plan.alpha;
  if (a >= 1) return draw();
  if (a <= 0) return;
  ctx.save();
  ctx.globalAlpha *= a;
  draw();
  ctx.restore();
}

/**
 * One half of a plain orbit ring, for pieces that draw no rings of their own: the rings stand in for the wakes as a
 * viewer fades them out (`S.rings`, 0 in a render, so renders never draw them). The far half is fainter and finer.
 */
export function orbitRings(ctx: CanvasRenderingContext2D, S: Snapshot, half: readonly Projected[], near: boolean, color: string, width: number): void {
  if (S.rings <= 0) return;
  ctx.save();
  ctx.globalAlpha *= S.rings * (near ? 0.8 : 0.45);
  ctx.strokeStyle = color;
  ctx.lineWidth = width * (near ? 1 : 0.75);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  trace(ctx, half);
  ctx.stroke();
  ctx.restore();
}

/* ---------- painter's order ---------- */

export interface Painter {
  /** A run of a wake on one side of the Sun's line, head first. */
  run?(t: Trail, run: Sample[], near: boolean): void;
  orbit?(pl: Planet, half: Projected[], near: boolean): void;
  rocks?(rocks: RockState[], near: boolean): void;
  body?(b: Body): void;
  sunTrail?(samples: Sample[]): void;
  sun?(): void;
}

/** Split a wake into runs on one side of the Sun's line; neighbouring runs share their boundary sample. */
export function runs(samples: readonly Sample[]): { near: boolean; run: Sample[] }[] {
  const out: { near: boolean; run: Sample[] }[] = [];
  let cur: Sample[] = [], side = samples[0]?.near ?? false;
  for (const s of samples) {
    if (s.near !== side && cur.length) {
      cur.push(s);
      out.push({ near: side, run: cur });
      cur = [s];
      side = s.near;
    } else cur.push(s);
  }
  if (cur.length > 1) out.push({ near: side, run: cur });
  return out;
}

/**
 * Lay the system down back to front: far wakes (outer first), far orbit halves and far rocks, far planets (deepest
 * first), the Sun's wake and the Sun, then near orbit halves and rocks, near wakes (inner first), near planets.
 */
export function paint(snap: Snapshot, p: Painter): void {
  const split = snap.trails.map(t => ({ t, rs: runs(t.samples) }));
  const trailOrder = (near: boolean): typeof split => [...split].sort((a, b) => {
    const ka = a.t.k === 8 ? 2.5 : a.t.k, kb = b.t.k === 8 ? 2.5 : b.t.k;
    return near ? ka - kb : kb - ka;
  });
  const bodies = [...snap.bodies].sort((a, b) => b.z - a.z);
  for (const { t, rs } of trailOrder(false)) for (const r of rs) if (!r.near) p.run?.(t, r.run, false);
  if (p.orbit) for (const pl of [...PLANETS].reverse()) p.orbit(pl, orbitRing(pl.k).far, false);
  p.rocks?.(snap.rocks.filter(r => !r.near), false);
  for (const b of bodies) if (!b.near) p.body?.(b);
  p.sunTrail?.(snap.sunTrail);
  p.sun?.();
  if (p.orbit) for (const pl of PLANETS) p.orbit(pl, orbitRing(pl.k).near, true);
  p.rocks?.(snap.rocks.filter(r => r.near), true);
  for (const { t, rs } of trailOrder(true)) for (const r of rs) if (r.near) p.run?.(t, r.run, true);
  for (const b of bodies) if (b.near) p.body?.(b);
}
