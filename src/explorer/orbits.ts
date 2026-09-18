/**
 * Orbit geometry for the jump-to presets: where things really are (heliocentric distance and longitude from the
 * ephemeris), how that maps onto the plan's compressed orbits, Hohmann transfers, launch-window search, and
 * schematic spacecraft paths between real encounters.
 *
 * The plan draws orbits as circles at composed radii, so a real distance is placed by interpolating between the
 * planets' own (au, radius) pairs on a logarithmic scale: a spacecraft at Mars's distance sits on Mars's orbit, one
 * halfway out to Jupiter between the two, whatever the plan's spacing.
 */
import type { Vec2 } from '../core/math';
import { BELT, C, PLANETS, SUN_R, type PlanetName } from '../scenes/solar/common';
import { heliocentric, periodDays } from '../scenes/solar/ephemeris';

const TAU = Math.PI * 2;
const wrapTau = (a: number): number => ((a % TAU) + TAU) % TAU;

/** A place in the ecliptic plane: distance from the Sun (au) and heliocentric longitude (radians). */
export interface Polar {
  r: number;
  lon: number;
}

/** Semi-major axes (au) of the plan's planets, inner to outer, with the belt's edges between Mars and Jupiter. */
const KNOTS: readonly [number, number][] = (() => {
  const au: Record<PlanetName, number> = { mercury: 0.387, venus: 0.723, earth: 1, mars: 1.524, jupiter: 5.203, saturn: 9.537, uranus: 19.19, neptune: 30.07 };
  const k: [number, number][] = PLANETS.map(p => [Math.log(au[p.name]), p.a]);
  k.splice(4, 0, [Math.log(2.2), BELT.inner], [Math.log(3.3), BELT.outer]);
  return k;
})();

/** Radius on the plan (design units from the Sun's centre) for a real distance in au. */
export function planRadius(au: number): number {
  const x = Math.log(Math.max(au, 1e-3));
  let i = 0;
  while (i < KNOTS.length - 2 && x > KNOTS[i + 1]![0]) i++;
  const [x0, y0] = KNOTS[i]!, [x1, y1] = KNOTS[i + 1]!;
  return Math.max(SUN_R + 8, y0 + ((x - x0) / (x1 - x0)) * (y1 - y0));
}

/** A real place drawn on the plan (design units): the page angle is the longitude turned counter-clockwise. */
export function planPoint(p: Polar): Vec2 {
  const R = planRadius(p.r);
  return [C[0] + Math.cos(-p.lon) * R, C[1] + Math.sin(-p.lon) * R];
}

/** A planet's real place on a date. */
export function planetPolar(name: PlanetName, day: number): Polar {
  const h = heliocentric(name, day);
  return { r: h.r * Math.cos(h.lat), lon: h.lon };
}

/** Where a planet is drawn on a date: on its own plan orbit, at its real longitude. */
export function planetOnPlan(name: PlanetName, day: number): Vec2 {
  const a = PLANETS.find(p => p.name === name)!.a, lon = heliocentric(name, day).lon;
  return [C[0] + Math.cos(-lon) * a, C[1] + Math.sin(-lon) * a];
}

/* ---------- transfers ---------- */

/** Days from the Earth to a planet on a Hohmann transfer (half an ellipse touching both orbits). */
export function hohmannDays(r1: number, r2: number): number {
  return 0.5 * 365.25636 * ((r1 + r2) / 2) ** 1.5;
}

/** How far ahead of the Earth (radians) a planet must be at launch for a Hohmann transfer to meet it. */
export function hohmannLead(target: PlanetName): number {
  const r2 = { mercury: 0.387, venus: 0.723, earth: 1, mars: 1.524, jupiter: 5.203, saturn: 9.537, uranus: 19.19, neptune: 30.07 }[target];
  return Math.PI - (TAU * hohmannDays(1, r2)) / periodDays(target);
}

/**
 * The next day on or after `from` when `target` leads the Earth by its Hohmann angle: an idealised launch window
 * (real windows open weeks either side, with trajectories a little faster than Hohmann's).
 */
export function nextWindow(target: PlanetName, from: number): number {
  const lead = hohmannLead(target);
  // how far the target is past its launch angle: this falls steadily as the Earth gains on it (outer planets)
  const miss = (d: number): number => {
    const x = wrapTau(heliocentric(target, d).lon - heliocentric('earth', d).lon - lead);
    return x > Math.PI ? x - TAU : x;
  };
  let a = from, fa = miss(a);
  for (let d = from + 5; d < from + 3000; d += 5) {
    const fd = miss(d);
    // a crossing from ahead (positive) to behind (negative), not the jump at the far side
    if (fa > 0 && fd <= 0 && fa - fd < Math.PI) {
      let lo = a, hi = d;
      for (let k = 0; k < 40; k++) {
        const mid = (lo + hi) / 2;
        if (miss(mid) > 0) lo = mid; else hi = mid;
      }
      return (lo + hi) / 2;
    }
    a = d;
    fa = fd;
  }
  return from;
}

/* ---------- schematic legs between real encounters ---------- */

export interface Waypoint {
  day: number;
  at: Polar;
  /** What happens here: "Launch", "Jupiter flyby". */
  label: string;
}

interface Leg {
  from: Waypoint;
  to: Waypoint;
  /** Cumulative time (0..1) against angle fraction, for pacing by Kepler's second law. */
  table: Float64Array;
  sweep: number;
}

const SAMPLES = 200;

function makeLeg(from: Waypoint, to: Waypoint): Leg {
  const dt = to.day - from.day;
  // a transfer ellipse between the two distances takes roughly this long a lap: count whole laps the flight must add
  const period = 365.25636 * ((from.at.r + to.at.r) / 2) ** 1.5;
  const direct = wrapTau(to.at.lon - from.at.lon), expected = (TAU * dt) / period;
  const laps = Math.max(0, Math.round((expected - direct) / TAU));
  const sweep = direct + laps * TAU;
  // time spent on each step of angle goes as r squared (equal areas in equal times)
  const table = new Float64Array(SAMPLES + 1);
  let acc = 0;
  for (let i = 1; i <= SAMPLES; i++) {
    const r = legRadius(from.at.r, to.at.r, (i - 0.5) / SAMPLES);
    acc += r * r;
    table[i] = acc;
  }
  for (let i = 1; i <= SAMPLES; i++) table[i]! /= acc;
  return { from, to, table, sweep };
}

/** Distance along a leg at angle fraction u: log-interpolated with level ends, as a transfer leaves and meets orbits. */
function legRadius(r0: number, r1: number, u: number): number {
  const s = u * u * (3 - 2 * u);
  return r0 * (r1 / r0) ** s;
}

function legAt(leg: Leg, day: number): Polar {
  const t = Math.min(1, Math.max(0, (day - leg.from.day) / (leg.to.day - leg.from.day)));
  // invert the time table: the angle fraction reached by time fraction t
  let lo = 0, hi = SAMPLES;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (leg.table[mid]! < t) lo = mid; else hi = mid;
  }
  const t0 = leg.table[lo]!, t1 = leg.table[hi]!, u = (lo + (t1 > t0 ? (t - t0) / (t1 - t0) : 0)) / SAMPLES;
  return { r: legRadius(leg.from.at.r, leg.to.at.r, u), lon: leg.from.at.lon + leg.sweep * u };
}

/** A spacecraft's schematic path through real encounters: where it was on any day between the first and the last. */
export class Flight {
  private readonly legs: Leg[];

  constructor(readonly waypoints: readonly Waypoint[]) {
    this.legs = waypoints.slice(1).map((w, i) => makeLeg(waypoints[i]!, w));
  }

  get start(): number { return this.waypoints[0]!.day; }
  get end(): number { return this.waypoints[this.waypoints.length - 1]!.day; }

  /** Where the craft was on `day`, from launch to its last encounter (null outside them). */
  at(day: number): Polar | null {
    if (day < this.start || day > this.end) return null;
    return legAt(this.legs.find(l => day <= l.to.day) ?? this.legs[this.legs.length - 1]!, day);
  }

  /** The path as plan points from `from` to `to` (days), finely enough to draw. */
  path(from: number, to: number, step = 4): Vec2[] {
    const out: Vec2[] = [];
    const a = Math.max(from, this.start), b = to;
    if (b <= a) return out;
    const n = Math.min(4000, Math.max(2, Math.ceil((b - a) / step)));
    for (let i = 0; i <= n; i++) {
      const p = this.at(a + ((b - a) * i) / n);
      if (p) out.push(planPoint(p));
    }
    return out;
  }
}
