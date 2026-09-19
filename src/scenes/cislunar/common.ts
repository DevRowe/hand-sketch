/**
 * Shared geometry of the Earth and Moon view, "One Neighbourhood": the Earth, the orbits round it and the Moon's, seen
 * from above the north side of the ecliptic (as the solar plans are, the J2000 equinox to the right of the page) and
 * drawn at one true scale, so the gap between the space stations and the Moon reads as it is.
 *
 * - Space is modelled in 3D, in km from the Earth's centre, in the ecliptic frame: x to the equinox, z to the
 *   ecliptic's north (towards the viewer). The page shows x to the right and y up; depth decides what the Earth hides.
 * - The Earth spins by Greenwich sidereal time about an axis tipped 23.4 degrees from the view, so its northern
 *   hemisphere leans towards the Sun in June. The Moon is where Meeus's series put it (longitude, latitude, distance).
 * - Earth orbits are Kepler ellipses given in the equatorial frame (inclination and node against the equator), their
 *   nodes drifting with the Earth's oblateness (J2) as real ones do.
 * - The scale spans 1:10,000: the Moon's mean distance is 440 design units and the Earth's radius 7.3, so the stations
 *   in low orbit sit half a unit off the ground. The live explorer's lens zooms far in; marks keep their size on
 *   screen, and only the geometry grows.
 */
import { TAU, type Vec2 } from '../../core/math';
import { eccentricAnomaly, moonDistance, moonLatitude, moonLongitude, OBLIQUITY, siderealTime, sunLongitude } from '../solar/ephemeris';

/** Design box, as the solar plans'. */
export const BOX = 1080;
export const C: Vec2 = [BOX / 2, BOX / 2];

/** Km per design unit: the Moon's mean distance spans 440 units. */
export const KM = 384400 / 440;

/** Mean radii, km. */
export const EARTH_R = 6371;
export const MOON_R = 1737.4;
/** Equatorial radius, km: altitudes are measured from it. */
export const EARTH_EQ = 6378.137;
/** The Moon's mean distance (semi-major axis), km. */
export const MOON_A = 384400;
/** The Earth's gravitational parameter, km^3/s^2, and its oblateness term. */
export const MU = 398600.4418;
const J2 = 1.08263e-3;
const RAD = Math.PI / 180;
const DAY_S = 86400;

export type V3 = readonly [number, number, number];

const cE = Math.cos(OBLIQUITY), sE = Math.sin(OBLIQUITY);

/** Equatorial (z to the celestial pole) to ecliptic (z to the ecliptic's north) coordinates. */
export const eclipticOf = ([x, y, z]: V3): V3 => [x, y * cE + z * sE, -y * sE + z * cE];

/** A point in space (km, ecliptic) on the page: design units from the box's origin, y down. */
export const onPage = (p: V3): Vec2 => [C[0] + p[0] / KM, C[1] - p[1] / KM];

/** A radius (km) in design units. */
export const units = (km: number): number => km / KM;

/* ---------- the Sun, the Earth's spin, the Moon ---------- */

/** Direction to the Sun (ecliptic, unit). */
export function sunDir(day: number): V3 {
  const l = sunLongitude(day);
  return [Math.cos(l), Math.sin(l), 0];
}

/** Page angle (radians, y down) towards the Sun. */
export const sunAngle = (day: number): number => -sunLongitude(day);

/** How far the Earth has turned: the angle from the equinox to Greenwich, radians. */
export const spin = (day: number): number => siderealTime(day);

/** A place on the Earth (latitude, longitude in degrees, east positive) at `day`, km from the centre (ecliptic). */
export function onEarth(lat: number, lon: number, day: number, r = EARTH_R): V3 {
  const th = lon * RAD + spin(day), c = Math.cos(lat * RAD);
  return eclipticOf([r * c * Math.cos(th), r * c * Math.sin(th), r * Math.sin(lat * RAD)]);
}

/** The Earth's north pole (unit, ecliptic): it leans 23.4 degrees from the view, towards the top of the page. */
export const NORTH: V3 = eclipticOf([0, 0, 1]);

/** The Moon's centre at `day`, km (ecliptic). */
export function moonAt(day: number): V3 {
  const l = moonLongitude(day), b = moonLatitude(day), r = moonDistance(day), cb = Math.cos(b);
  return [r * cb * Math.cos(l), r * cb * Math.sin(l), r * Math.sin(b)];
}

/** The Moon's sidereal month, days. */
export const MOON_MONTH = 27.321661;

/* ---------- orbits round the Earth ---------- */

export interface Orbit {
  /** Lowest and highest altitude above the equator's radius, km. */
  peri: number;
  apo: number;
  /** Inclination to the equator, degrees. */
  inc: number;
  /** Right ascension of the ascending node at `epoch`, degrees. */
  node: number;
  /** Argument of perigee, degrees. */
  argp?: number;
  /** Mean anomaly at `epoch`, degrees. */
  m0: number;
  /** Days from J2000.0. */
  epoch: number;
}

/** Semi-major axis (km), eccentricity, period (days) and nodal drift (radians a day) of an orbit. */
export function shape(o: Orbit): { a: number; e: number; period: number; drift: number } {
  const rp = EARTH_EQ + o.peri, ra = EARTH_EQ + o.apo, a = (rp + ra) / 2, e = (ra - rp) / (ra + rp);
  const n = Math.sqrt(MU / (a * a * a)), p = a * (1 - e * e);
  const drift = -1.5 * n * J2 * (EARTH_EQ / p) ** 2 * Math.cos(o.inc * RAD) * DAY_S;
  return { a, e, period: TAU / n / DAY_S, drift };
}

/** Period (days) of a circular orbit `alt` km up. */
export const circularPeriod = (alt: number): number => TAU * Math.sqrt((EARTH_EQ + alt) ** 3 / MU) / DAY_S;

/** Speed (km/s) on a circular orbit `alt` km up. */
export const circularSpeed = (alt: number): number => Math.sqrt(MU / (EARTH_EQ + alt));

/** The orbit's plane at `day`: the in-plane point (x, y) (km, x towards perigee) in space. */
function planeOf(o: Orbit, day: number): (x: number, y: number) => V3 {
  const { drift } = shape(o), W = o.node * RAD + drift * (day - o.epoch), w = (o.argp ?? 0) * RAD, i = o.inc * RAD;
  const cW = Math.cos(W), sW = Math.sin(W), cw = Math.cos(w), sw = Math.sin(w), ci = Math.cos(i), si = Math.sin(i);
  return (x, y) => eclipticOf([
    (cW * cw - sW * sw * ci) * x + (-cW * sw - sW * cw * ci) * y,
    (sW * cw + cW * sw * ci) * x + (-sW * sw + cW * cw * ci) * y,
    sw * si * x + cw * si * y,
  ]);
}

/** Where a body on orbit `o` is at `day`, km (ecliptic). */
export function orbitAt(o: Orbit, day: number): V3 {
  const { a, e, period } = shape(o), M = ((o.m0 * RAD + (TAU * (day - o.epoch)) / period) % TAU + TAU) % TAU;
  const E = eccentricAnomaly(M > Math.PI ? M - TAU : M, e);
  return planeOf(o, day)(a * (Math.cos(E) - e), a * Math.sqrt(1 - e * e) * Math.sin(E));
}

/** The whole orbit at `day` as `n` points, km (ecliptic). */
export function orbitPath(o: Orbit, day: number, n = 120): V3[] {
  const { a, e } = shape(o), at = planeOf(o, day), b = a * Math.sqrt(1 - e * e), out: V3[] = [];
  for (let k = 0; k <= n; k++) {
    const E = (k / n) * TAU;
    out.push(at(a * (Math.cos(E) - e), b * Math.sin(E)));
  }
  return out;
}

/** A circle round the Earth in its equator's plane (the geostationary belt), `r` km across the centre. */
export function equatorRing(r: number, n = 120): V3[] {
  const out: V3[] = [];
  for (let k = 0; k <= n; k++) {
    const a = (k / n) * TAU;
    out.push(eclipticOf([r * Math.cos(a), r * Math.sin(a), 0]));
  }
  return out;
}

/** Whether the Earth hides a point (km, ecliptic): behind it and inside its disc as seen from above. */
export const hiddenByEarth = (p: V3, r = EARTH_R): boolean => p[2] < 0 && p[0] * p[0] + p[1] * p[1] < r * r;

/* ---------- time ---------- */

/** Days from J2000.0 of a UTC date and time. */
export const utc = (y: number, m: number, d: number, h = 0, min = 0): number => (Date.UTC(y, m - 1, d, h, min) - Date.UTC(2000, 0, 1, 12)) / 86_400_000;
