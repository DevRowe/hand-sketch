/**
 * Representative paths of crewed flights for the Earth and Moon view: real dates and real heights, joined by the
 * simplest orbits that fit them, never a navigation solution.
 *
 * - Round the Earth, a flight flies a Kepler orbit launched from its real pad: the orbit's node is set so that at
 *   launch the craft is over the pad, climbing north-east, at the orbit's tilt.
 * - To the Moon, a flight waits in a parking orbit, leaves at translunar injection on the Kepler ellipse (perigee at
 *   the burn) whose climb to the Moon takes the real time, swings round the Moon along keyframes set in the Moon's own
 *   frame (from the Earth outwards, and along the Moon's motion), and falls home on a second ellipse to its entry.
 *   Legs meet exactly at their ends, so the path is continuous.
 */
import { clamp, TAU } from '../core/math';
import { EARTH_EQ, EARTH_R, MOON_R, moonAt, MU, onPage, orbitAt, type Orbit, type V3 } from '../scenes/cislunar/common';
import { eccentricAnomaly, siderealTime } from '../scenes/solar/ephemeris';
import type { Vec2 } from '../core/math';

const RAD = Math.PI / 180;
const DAY_S = 86400;

/**
 * An orbit launched from a pad at (`lat`, `lon`) degrees at `day`: at that moment the craft is at the orbit's perigee,
 * over the pad, heading north-east at inclination `inc` (which must be at least the pad's latitude).
 */
export function launchOrbit(peri: number, apo: number, inc: number, lat: number, lon: number, day: number): Orbit {
  const i = inc * RAD, ra = lon * RAD + siderealTime(day), u = Math.asin(clamp(Math.sin(lat * RAD) / Math.sin(i), -1, 1));
  const node = ra - Math.atan2(Math.cos(i) * Math.sin(u), Math.cos(u));
  return { peri, apo, inc, node: node / RAD, argp: u / RAD, m0: 0, epoch: day };
}

/* ---------- Kepler legs ---------- */

interface Ellipse {
  rp: number;
  e: number;
  a: number;
  /** Mean motion, radians a day. */
  n: number;
}

const ellipse = (rp: number, e: number): Ellipse => {
  const a = rp / (1 - e);
  return { rp, e, a, n: Math.sqrt(MU / (a * a * a)) * DAY_S };
};

/** Days to climb from perigee to radius `r`, and the true anomaly reached. */
function climb(el: Ellipse, r: number): { days: number; nu: number } {
  const cosE = clamp((1 - r / el.a) / el.e, -1, 1), E = Math.acos(cosE), M = E - el.e * Math.sin(E);
  return { days: M / el.n, nu: 2 * Math.atan(Math.sqrt((1 + el.e) / (1 - el.e)) * Math.tan(E / 2)) };
}

/** The ellipse from perigee `rp` that reaches `r` in `days`, as near as an ellipse can (the pace is then stretched). */
function fit(rp: number, r: number, days: number): Ellipse {
  // near-parabolic ellipses add nothing a drawing can show: past 0.99 the pace is stretched instead
  let lo = (r - rp) / (r + rp) + 1e-9, hi = 0.99;
  for (let k = 0; k < 80; k++) {
    const mid = (lo + hi) / 2;
    // a longer climb wants a less eccentric (slower) ellipse
    if (climb(ellipse(rp, mid), r).days > days) lo = mid;
    else hi = mid;
  }
  return ellipse(rp, (lo + hi) / 2);
}

/**
 * Eccentric anomaly of mean anomaly `M` (in [-pi, pi]) on an orbit of eccentricity `e`: bracketed, so it holds for the
 * long, near-parabolic ellipses of a trip to the Moon, where Newton's method alone can run away.
 */
function anomaly(M: number, e: number): number {
  let lo = -Math.PI, hi = Math.PI;
  for (let k = 0; k < 64; k++) {
    const mid = (lo + hi) / 2;
    if (mid - e * Math.sin(mid) < M) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** Radius and true anomaly `tau` days after perigee (negative: before it). */
function kepler(el: Ellipse, tau: number): { r: number; nu: number } {
  const M = el.n * tau, E = el.e < 0.3 ? eccentricAnomaly(M - TAU * Math.round(M / TAU), el.e) : anomaly(M - TAU * Math.round(M / TAU), el.e);
  return { r: el.a * (1 - el.e * Math.cos(E)), nu: 2 * Math.atan(Math.sqrt((1 + el.e) / (1 - el.e)) * Math.tan(E / 2)) };
}

/** A leg between the Earth's neighbourhood (perigee at `tp`) and a point `far` reached at `tf`, either way round. */
interface Leg {
  el: Ellipse;
  /** Direction of perigee, radians (ecliptic longitude). */
  peri: number;
  tp: number;
  tf: number;
  far: V3;
  /** Real days per day along the fitted ellipse. */
  stretch: number;
}

function leg(rp: number, tp: number, far: V3, tf: number): Leg {
  const r = Math.hypot(far[0], far[1]), days = Math.abs(tf - tp), el = fit(rp, r, days), c = climb(el, r);
  const out = tf > tp, at = Math.atan2(far[1], far[0]);
  // outbound the far point lies ahead of perigee; homebound perigee lies ahead of it (the flight keeps going round)
  return { el, peri: out ? at - c.nu : at + c.nu, tp, tf, far, stretch: c.days / days };
}

function onLeg(l: Leg, t: number): V3 {
  const { r, nu } = kepler(l.el, (t - l.tp) * l.stretch), a = l.peri + nu, f = clamp((t - l.tp) / (l.tf - l.tp), 0, 1);
  return [r * Math.cos(a), r * Math.sin(a), l.far[2] * f];
}

/* ---------- the Moon's frame ---------- */

/** A place in the Moon's frame at a moment: angle from the Earth-Moon line, degrees (0 on the far side, 90 ahead of the Moon), and distance from the Moon's centre, km. */
export type MoonKey = readonly [day: number, deg: number, km: number];

function moonFrame(day: number, deg: number, km: number): V3 {
  const m = moonAt(day), d = Math.hypot(m[0], m[1]), x: Vec2 = [m[0] / d, m[1] / d], a = deg * RAD;
  return [m[0] + km * (Math.cos(a) * x[0] - Math.sin(a) * x[1]), m[1] + km * (Math.cos(a) * x[1] + Math.sin(a) * x[0]), m[2]];
}

function onKeys(keys: readonly MoonKey[], t: number): V3 {
  let k = 1;
  while (k < keys.length - 1 && t > keys[k]![0]) k++;
  const [t0, a0, r0] = keys[k - 1]!, [t1, a1, r1] = keys[k]!, f = clamp((t - t0) / (t1 - t0), 0, 1);
  // closing in and pulling away read as a hyperbola: the distance changes on a log scale
  return moonFrame(t, a0 + (a1 - a0) * f, Math.exp(Math.log(r0) + (Math.log(r1) - Math.log(r0)) * f));
}

/* ---------- flights ---------- */

export interface FlightEvent {
  day: number;
  label: string;
  /** Where to mark it: on the path (default), or at the Moon. */
  at?: 'moon';
}

export interface Flight {
  start: number;
  end: number;
  at(day: number): V3;
  events: readonly FlightEvent[];
  /** Days between samples of the drawn path, by part (short for loops round the Earth or the Moon). */
  sample(day: number): number;
}

/** A flight round the Earth on one orbit from launch to landing. */
export function earthFlight(o: Orbit, start: number, end: number, events: readonly FlightEvent[] = []): Flight {
  return { start, end, at: d => orbitAt(o, d), events, sample: () => 1 / 1440 };
}

export interface LunarPlan {
  launch: number;
  tli: number;
  /** Before the burn: a circular parking orbit this high (km), or an elliptical one [perigee, apogee]. */
  park: number | readonly [number, number];
  /** Keyframes in the Moon's frame from arrival to departure. */
  keys: readonly MoonKey[];
  /** When the flight meets the upper air on its way home, and splashes down. */
  entry: number;
  splash: number;
  events: readonly FlightEvent[];
}

/** Days over which a Kepler leg and the Moon's frame are blended where they meet. */
const BLEND = 0.35;

/** `a` blending into `b` as `f` runs 0..1 (eased; clamped). */
function blend(a: V3, b: V3, f: number): V3 {
  const u = clamp(f, 0, 1), e = u * u * (3 - 2 * u);
  return [a[0] + (b[0] - a[0]) * e, a[1] + (b[1] - a[1]) * e, a[2] + (b[2] - a[2]) * e];
}

export function lunarFlight(p: LunarPlan): Flight {
  const arrive = p.keys[0]!, leave = p.keys[p.keys.length - 1]!;
  const parkPeri = EARTH_EQ + (typeof p.park === 'number' ? p.park : p.park[0]);
  const out = leg(parkPeri, p.tli, onKeys(p.keys, arrive[0]), arrive[0]);
  const home = leg(EARTH_R + 120, p.entry, onKeys(p.keys, leave[0]), leave[0]);
  // the parking orbit ends at the burn, where the outbound ellipse has its perigee
  const park = typeof p.park === 'number' ? ellipse(parkPeri, 1e-9) : ellipse(parkPeri, (p.park[1] - p.park[0]) / (2 * EARTH_EQ + p.park[0] + p.park[1]));
  // an elliptical parking orbit is flown once round, launch to burn, both at its perigee
  const lap = typeof p.park === 'number' ? 1 : TAU / park.n / (p.tli - p.launch);
  const parked = (t: number): V3 => {
    const { r, nu } = kepler(park, (t - p.tli) * lap), a = out.peri + nu;
    return [r * Math.cos(a), r * Math.sin(a), 0];
  };
  return {
    start: p.launch,
    end: p.splash,
    events: p.events,
    at(t) {
      if (t <= p.tli) return parked(t);
      // the Kepler legs hand over to the Moon's frame gradually, so the path turns without a corner
      if (t <= arrive[0]) return blend(onLeg(out, t), onKeys(p.keys, t), (t - (arrive[0] - BLEND)) / BLEND);
      if (t <= leave[0]) return onKeys(p.keys, t);
      if (t <= p.entry) return blend(onLeg(home, t), onKeys(p.keys, t), (leave[0] + BLEND - t) / BLEND);
      const { r, nu } = kepler(home.el, 0), a = home.peri + nu;
      return [r * Math.cos(a), r * Math.sin(a), 0];
    },
    sample(t) {
      if (t <= p.tli || (t > leave[0] && t > p.entry - 0.1)) return 1 / 720;
      // finely round the Moon, where the path turns tightly and is seen close up
      if (t > arrive[0] - BLEND - 0.3 && t <= leave[0] + BLEND + 0.3) return 1 / 192;
      return 1 / 24;
    },
  };
}

/** The drawn path of a flight from `t0` to `t1`, design units. */
export function flightPath(f: Flight, t0: number, t1: number): Vec2[] {
  const out: Vec2[] = [];
  for (let t = t0; t < t1; t += f.sample(t)) out.push(onPage(f.at(t)));
  if (t1 > t0) out.push(onPage(f.at(t1)));
  return out;
}

/** Where the Moon's surface is, for a flight's keyframes: `alt` km up. */
export const aboveMoon = (alt: number): number => MOON_R + alt;

/** The farthest a flight gets from the Earth's centre (km) and when, searched on its keyframed part. */
export function farthest(f: Flight, t0: number, t1: number): { day: number; km: number } {
  let best = { day: t0, km: 0 };
  for (let t = t0; t <= t1; t += 1 / 288) {
    const p = f.at(t), r = Math.hypot(p[0], p[1], p[2]);
    if (r > best.km) best = { day: t, km: r };
  }
  return best;
}

