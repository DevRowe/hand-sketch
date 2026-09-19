/**
 * How far you have travelled through space since you were born: the same stretch of time measured against four
 * different references, each with its own speed. Motion only means something relative to something else, so the
 * figures never add up to one total; each answers "moved relative to what?". Pure arithmetic on elapsed seconds, with
 * the constants and their sources beside them (content/SOURCES.md, "How far you have travelled").
 */
import { AU_KM } from './live';

/** Seconds in a day, and in a Julian year (the astronomers' year of 365.25 days). */
const DAY_S = 86_400;
const JULIAN_YEAR_S = 365.25 * DAY_S;
/** Kilometres in a light-year (IAU: the Julian year times the speed of light). */
export const LIGHT_YEAR_KM = 299_792.458 * JULIAN_YEAR_S;

/** Earth's equatorial radius, km (WGS 84), and its sidereal day, s (23 h 56 min 4.09 s): one turn against the stars. */
const EARTH_RADIUS_KM = 6378.137;
const SIDEREAL_DAY_S = 86_164.0905;
/** A point on the equator circles Earth's axis at this speed: ~0.465 km/s, ~1,674 km/h. */
export const SPIN_KM_S = (2 * Math.PI * EARTH_RADIUS_KM) / SIDEREAL_DAY_S;

/** Earth's mean orbital speed round the Sun, km/s (NASA Earth fact sheet), and its sidereal year, days. */
export const ORBIT_KM_S = 29.78;
const SIDEREAL_YEAR_DAYS = 365.256_363;

/** The Sun's speed round the centre of the Milky Way, km/s (estimates run ~220-250), and one lap, years. */
export const GALAXY_KM_S = 230;
const GALACTIC_YEAR = 230e6;

/** The Solar System's speed against the cosmic microwave background, km/s (Planck 2018: 369.82 ± 0.11). */
export const CMB_KM_S = 369.82;

export interface Frame {
  id: 'spin' | 'orbit' | 'galaxy' | 'cmb';
  /** What is moving, round or through what. */
  title: string;
  /** The reference the motion is measured against. */
  against: string;
  /** Speed in that frame, km/s. */
  speed: number;
  /** Distance covered since the start, km. */
  km: number;
  /** A comparison that makes the distance graspable. */
  compare: string;
}

/** Everything the card shows for a stretch of `seconds`, at `latitude` degrees (spin only). */
export function travelled(seconds: number, latitude = 0): { days: number; laps: number; frames: Frame[] } {
  const t = Math.max(0, seconds), days = t / DAY_S, years = t / JULIAN_YEAR_S;
  const spin = SPIN_KM_S * Math.cos((Math.abs(latitude) * Math.PI) / 180);
  const turns = t / SIDEREAL_DAY_S, laps = days / SIDEREAL_YEAR_DAYS;
  const galaxyKm = GALAXY_KM_S * t, cmbKm = CMB_KM_S * t;
  return {
    days,
    laps,
    frames: [
      {
        id: 'spin',
        title: 'Spinning with Earth',
        against: 'Earth’s axis',
        speed: spin,
        km: spin * t,
        compare: `${count(turns)} turns of Earth`,
      },
      {
        id: 'orbit',
        title: 'Round the Sun',
        against: 'the Sun',
        speed: ORBIT_KM_S,
        km: ORBIT_KM_S * t,
        compare: `${lapCount(laps)} laps of the Sun`,
      },
      {
        id: 'galaxy',
        title: 'Round the Milky Way',
        against: 'the galaxy’s centre',
        speed: GALAXY_KM_S,
        km: galaxyKm,
        compare: `${count(galaxyKm / AU_KM)} au, yet only ${fractionOfLap(years / GALACTIC_YEAR)} of one lap`,
      },
      {
        id: 'cmb',
        title: 'Through the cosmos',
        against: 'the cosmic microwave background',
        speed: CMB_KM_S,
        km: cmbKm,
        compare: `as far as light travels in ~${lightTime(cmbKm)}`,
      },
    ],
  };
}

/** "36.5" laps under a hundred, whole ones beyond. */
export const lapCount = (laps: number): string => (laps < 100 ? laps.toFixed(1) : count(laps));

/** "12,345": whole numbers with thousands separators. */
export const count = (n: number): string => Math.round(n).toLocaleString('en-GB');

/** "539 million km", "34.5 billion km", "1.2 trillion km": three significant figures in words. */
export function distance(km: number): string {
  const units: [number, string][] = [[1e12, 'trillion'], [1e9, 'billion'], [1e6, 'million']];
  for (const [size, name] of units) {
    if (km >= size) return `${sig3(km / size)} ${name} km`;
  }
  return `${count(km)} km`;
}

/** "1,674 km/h" for slow speeds, "29.8 km/s" for the rest. */
export function speed(kmS: number): string {
  return kmS < 1 ? `${count(kmS * 3600)} km/h` : `${sig3(kmS)} km/s`;
}

/** How long light takes to cover `km`: "16.5 days", "3.2 hours", "1.2 years". */
export function lightTime(km: number): string {
  const days = (km / LIGHT_YEAR_KM) * 365.25;
  if (days >= 365.25) return plural(days / 365.25, 'year');
  if (days >= 1) return plural(days, 'day');
  return plural(days * 24, 'hour');
}

const plural = (n: number, unit: string): string => {
  const s = sig3(n);
  return `${s} ${unit}${s === '1' ? '' : 's'}`;
};

/** "0.000016%" style: a tiny fraction as a percentage with two significant figures. */
function fractionOfLap(f: number): string {
  if (f <= 0) return '0%';
  const pct = f * 100, digits = Math.max(0, 1 - Math.floor(Math.log10(pct)));
  return `${pct.toFixed(Math.min(12, digits))}%`;
}

/** Three significant figures, trailing zeros kept only where they carry meaning ("34.5", "539", "1.20" -> "1.2"). */
function sig3(x: number): string {
  if (x >= 100) return count(x);
  return String(Number(x.toPrecision(3)));
}

/* ---------- your age on every planet ---------- */

/**
 * The planets' sidereal years, days: one lap against the stars (NASA planetary fact sheets; the outer four given there
 * in Julian years). Your age on a planet is the laps it has made since you were born.
 */
export const PLANET_YEARS = [
  { id: 'mercury', name: 'Mercury', days: 87.97 },
  { id: 'venus', name: 'Venus', days: 224.7 },
  { id: 'earth', name: 'Earth', days: 365.256 },
  { id: 'mars', name: 'Mars', days: 686.98 },
  { id: 'jupiter', name: 'Jupiter', days: 11.862 * 365.25 },
  { id: 'saturn', name: 'Saturn', days: 29.457 * 365.25 },
  { id: 'uranus', name: 'Uranus', days: 84.02 * 365.25 },
  { id: 'neptune', name: 'Neptune', days: 164.8 * 365.25 },
] as const;

export type PlanetId = (typeof PLANET_YEARS)[number]['id'];

export interface PlanetAge {
  id: PlanetId;
  name: string;
  /** Your age there in its own years: the laps it has made round the Sun since you were born. */
  age: number;
  /** Days from your birth to your next birthday there. */
  next: number;
}

/** Your age on each planet after `days` of life, Mercury first. */
export const planetAges = (days: number): PlanetAge[] =>
  PLANET_YEARS.map(p => {
    const age = Math.max(0, days) / p.days;
    return { id: p.id, name: p.name, age, next: (Math.floor(age) + 1) * p.days };
  });

/** "152", "36.6", "3.09", "0.44": an age to about three figures. */
export const ageLabel = (age: number): string => (age >= 100 ? count(Math.floor(age)) : age >= 10 ? age.toFixed(1) : age.toFixed(2));

/** "3 times", "once", "44% of the way": how far round a planet has gone. */
export function lapsLabel(laps: number): string {
  if (laps < 1) return `${Math.max(1, Math.round(laps * 100))}% of the way`;
  const whole = Math.floor(laps);
  return whole === 1 ? 'once' : whole === 2 ? 'twice' : `${count(whole)} times`;
}

/** "Jupiter has gone round 3 times, Saturn once, Uranus 44% of the way and Neptune 22%": the outer planets since a birth. */
export function outerLaps(ages: readonly PlanetAge[]): string {
  const outer = ages.filter(a => a.id === 'jupiter' || a.id === 'saturn' || a.id === 'uranus' || a.id === 'neptune');
  let partial = false;
  const words = outer.map((a, i) => {
    let w = lapsLabel(a.age);
    // after the first "of the way", the rest read as bare percentages
    if (a.age < 1 && partial) w = w.replace(' of the way', '');
    if (a.age < 1) partial = true;
    return i === 0 ? `${a.name} has gone round ${w}` : `${a.name} ${w}`;
  });
  return words.length > 1 ? `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}` : (words[0] ?? '');
}
