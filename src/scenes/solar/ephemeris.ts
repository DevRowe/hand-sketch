/**
 * Where the planets and the Moon really are on a date, to sketch accuracy.
 *
 * - Planets: the mean Keplerian elements and rates of E. M. Standish, "Approximate Positions of the Planets" (JPL
 *   Solar System Dynamics, Tables 2a and 2b, fitted to 3000 BC .. 3000 AD; nominal errors under about 0.6 degrees of
 *   heliocentric longitude), solved on Kepler's equation. "earth" is the Earth-Moon barycentre.
 * - The Moon: its geocentric ecliptic longitude from the mean arguments and the ten largest periodic terms of Meeus,
 *   "Astronomical Algorithms" (2nd ed., ch. 47), good to a few tenths of a degree.
 *
 * Time is counted in days from J2000.0 (2000-01-01 12:00 TT); the minute or so between TT and UTC is far below
 * anything a sketch can show. Longitudes are radians in [0, 2 pi), measured from the J2000 equinox, counter-clockwise
 * as seen from the north.
 */
import { TAU } from '../../core/math';
import type { PlanetName } from './common';

/** J2000.0 as a JS time value (ms since 1970, UTC). */
export const J2000_MS = Date.UTC(2000, 0, 1, 12);
const DAY_MS = 86_400_000;

/** Days from J2000.0 of a JS time value. */
export const dayOf = (ms: number): number => (ms - J2000_MS) / DAY_MS;
/** JS time value of a day count from J2000.0. */
export const msOf = (day: number): number => J2000_MS + day * DAY_MS;

const RAD = Math.PI / 180;
const wrapTau = (a: number): number => ((a % TAU) + TAU) % TAU;

/** An element's value at J2000 and its rate per Julian century. */
type Elem = readonly [number, number];

interface Elements {
  /** Semi-major axis, au. */
  a: Elem;
  e: Elem;
  /** Inclination, degrees. */
  I: Elem;
  /** Mean longitude, degrees. */
  L: Elem;
  /** Longitude of perihelion, degrees. */
  peri: Elem;
  /** Longitude of the ascending node, degrees. */
  node: Elem;
  /** Table 2b terms added to the mean anomaly of the giant planets: b T^2 + c cos(f T) + s sin(f T), degrees. */
  extra?: readonly [b: number, c: number, s: number, f: number];
}

/** JPL Tables 2a and 2b, copied verbatim. */
const ELEMENTS: Readonly<Record<PlanetName, Elements>> = {
  mercury: { a: [0.38709843, 0.00000000], e: [0.20563661, 0.00002123], I: [7.00559432, -0.00590158], L: [252.25166724, 149472.67486623], peri: [77.45771895, 0.15940013], node: [48.33961819, -0.12214182] },
  venus: { a: [0.72332102, -0.00000026], e: [0.00676399, -0.00005107], I: [3.39777545, 0.00043494], L: [181.97970850, 58517.81560260], peri: [131.76755713, 0.05679648], node: [76.67261496, -0.27274174] },
  earth: { a: [1.00000018, -0.00000003], e: [0.01673163, -0.00003661], I: [-0.00054346, -0.01337178], L: [100.46691572, 35999.37306329], peri: [102.93005885, 0.31795260], node: [-5.11260389, -0.24123856] },
  mars: { a: [1.52371243, 0.00000097], e: [0.09336511, 0.00009149], I: [1.85181869, -0.00724757], L: [-4.56813164, 19140.29934243], peri: [-23.91744784, 0.45223625], node: [49.71320984, -0.26852431] },
  jupiter: { a: [5.20248019, -0.00002864], e: [0.04853590, 0.00018026], I: [1.29861416, -0.00322699], L: [34.33479152, 3034.90371757], peri: [14.27495244, 0.18199196], node: [100.29282654, 0.13024619], extra: [-0.00012452, 0.06064060, -0.35635438, 38.35125000] },
  saturn: { a: [9.54149883, -0.00003065], e: [0.05550825, -0.00032044], I: [2.49424102, 0.00451969], L: [50.07571329, 1222.11494724], peri: [92.86136063, 0.54179478], node: [113.63998702, -0.25015002], extra: [0.00025899, -0.13434469, 0.87320147, 38.35125000] },
  uranus: { a: [19.18797948, -0.00020455], e: [0.04685740, -0.00001550], I: [0.77298127, -0.00180155], L: [314.20276625, 428.49512595], peri: [172.43404441, 0.09266985], node: [73.96250215, 0.05739699], extra: [0.00058331, -0.97731848, 0.17689245, 7.67025000] },
  neptune: { a: [30.06952752, 0.00006447], e: [0.00895439, 0.00000818], I: [1.77005520, 0.00022400], L: [304.22289287, 218.46515314], peri: [46.68158724, 0.01009938], node: [131.78635853, -0.00606302], extra: [-0.00041348, 0.68346318, -0.10162547, 7.67025000] },
};

/** The first and last days (from J2000.0) the elements were fitted over: 3000 BC and AD 3000. */
export const VALID_DAYS: readonly [number, number] = [dayOf(Date.UTC(-2999, 0, 1)), dayOf(Date.UTC(3000, 0, 1))];

/** Sidereal period of a planet in days, from the rate of its mean longitude. */
export const periodDays = (name: PlanetName): number => (36525 * 360) / ELEMENTS[name].L[1];

/** The Moon's sidereal month, days. */
export const MOON_PERIOD_DAYS = 27.321661;

/** Eccentric anomaly E of mean anomaly M (radians) and eccentricity e: Newton's method on E - e sin E = M. */
export function eccentricAnomaly(M: number, e: number): number {
  let E = M + e * Math.sin(M);
  for (let k = 0; k < 30; k++) {
    const dE = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    E -= dE;
    if (Math.abs(dE) < 1e-13) break;
  }
  return E;
}

export interface Helio {
  /** Heliocentric ecliptic longitude, radians in [0, 2 pi). */
  lon: number;
  /** Heliocentric ecliptic latitude, radians. */
  lat: number;
  /** Distance from the Sun, au. */
  r: number;
}

/** Heliocentric ecliptic position of a planet `day` days from J2000.0. */
export function heliocentric(name: PlanetName, day: number): Helio {
  const el = ELEMENTS[name], T = day / 36525, at = (x: Elem): number => x[0] + x[1] * T;
  const a = at(el.a), e = at(el.e), I = at(el.I) * RAD, peri = at(el.peri), node = at(el.node);
  let M = at(el.L) - peri;
  if (el.extra) {
    const [b, c, s, f] = el.extra;
    M += b * T * T + c * Math.cos(f * T * RAD) + s * Math.sin(f * T * RAD);
  }
  const E = eccentricAnomaly((((M + 180) % 360 + 360) % 360 - 180) * RAD, e);
  const xp = a * (Math.cos(E) - e), yp = a * Math.sqrt(1 - e * e) * Math.sin(E);
  const w = (peri - node) * RAD, O = node * RAD;
  const cw = Math.cos(w), sw = Math.sin(w), cO = Math.cos(O), sO = Math.sin(O), cI = Math.cos(I), sI = Math.sin(I);
  const x = (cw * cO - sw * sO * cI) * xp + (-sw * cO - cw * sO * cI) * yp;
  const y = (cw * sO + sw * cO * cI) * xp + (-sw * sO + cw * cO * cI) * yp;
  const z = sw * sI * xp + cw * sI * yp;
  return { lon: wrapTau(Math.atan2(y, x)), lat: Math.atan2(z, Math.hypot(x, y)), r: Math.hypot(x, y, z) };
}

/** Geocentric ecliptic longitude of the Moon `day` days from J2000.0, radians in [0, 2 pi) (Meeus ch. 47). */
export function moonLongitude(day: number): number {
  const T = day / 36525, T2 = T * T, T3 = T2 * T, T4 = T3 * T;
  // mean longitude, mean elongation, the Sun's and the Moon's mean anomalies, argument of latitude (degrees)
  const Lp = 218.3164477 + 481267.88123421 * T - 0.0015786 * T2 + T3 / 538841 - T4 / 65194000;
  const D = (297.8501921 + 445267.1114034 * T - 0.0018819 * T2 + T3 / 545868 - T4 / 113065000) * RAD;
  const M = (357.5291092 + 35999.0502909 * T - 0.0001536 * T2 + T3 / 24490000) * RAD;
  const Mp = (134.9633964 + 477198.8675055 * T + 0.0087414 * T2 + T3 / 69699 - T4 / 14712000) * RAD;
  const F = (93.2720950 + 483202.0175233 * T - 0.0036539 * T2 - T3 / 3526000 + T4 / 863310000) * RAD;
  // the terms carrying the Sun's anomaly shrink with the slowly falling eccentricity of the Earth's orbit
  const E = 1 - 0.002516 * T - 0.0000074 * T2;
  const sum =
    6.288774 * Math.sin(Mp) +
    1.274027 * Math.sin(2 * D - Mp) +
    0.658314 * Math.sin(2 * D) +
    0.213618 * Math.sin(2 * Mp) -
    0.185116 * E * Math.sin(M) -
    0.114332 * Math.sin(2 * F) +
    0.058793 * Math.sin(2 * D - 2 * Mp) +
    0.057066 * E * Math.sin(2 * D - M - Mp) +
    0.053322 * Math.sin(2 * D + Mp) +
    0.045758 * E * Math.sin(2 * D - M);
  return wrapTau((Lp + sum) * RAD);
}

/** The Sun's geocentric longitude: the Earth's heliocentric one turned half round. */
export const sunLongitude = (day: number): number => wrapTau(heliocentric('earth', day).lon + Math.PI);
