/**
 * Look up tonight: which planets are in the evening sky, which in the morning sky and which are lost in the Sun's glare
 * on the date shown, and the sight-lines that explain why, drawn from the Earth across the From above view.
 *
 * Everything follows from one angle, a planet's elongation: how far from the Sun it stands in our sky. East of the Sun
 * it sets after the Sun (an evening object); west of it, it rises before the Sun (a morning object); opposite the Sun
 * it is up all night; within ~15 degrees of it, it is lost in the glare. The words only say east or west, high or low,
 * so they hold for anywhere on Earth; exact heights depend on your latitude and the season.
 *
 * Positions are the ephemeris's (JPL mean elements, Meeus's Moon); brightness uses the standard magnitude formulas of
 * Meeus, "Astronomical Algorithms", ch. 41, with Saturn's rings from ch. 45.
 */
import type { Vec2 } from '../core/math';
import type { PlanetName } from '../scenes/solar/common';
import { heliocentric, moonLatitude, moonLongitude, sunLongitude } from '../scenes/solar/ephemeris';
import type { App } from './app';
import { moonPhase, type Phase } from './live';
import { planetOnPlan } from './orbits';
import { drawSight, haloStroke, text } from './overlays';

const RAD = Math.PI / 180;

/** Where in the night an object is seen. */
export type Side = 'evening' | 'night' | 'morning' | 'glare';

/** The colours the sight-lines and the Sky sheet share: gold for dusk, pale blue for dawn, pale ink all night. */
export const SIDE_COLOR: Readonly<Record<Side, string>> = { evening: '#e8a33d', night: '#fff4dc', morning: '#8fc3ff', glare: '#9d9a93' };

export const SIDE_TITLE: Readonly<Record<Side, string>> = {
  evening: 'After sunset',
  night: 'Most of the night',
  morning: 'Before sunrise',
  glare: 'Lost in the Sun’s glare',
};

export interface Sighting {
  id: PlanetName | 'moon';
  /** Degrees from the Sun in our sky. */
  elongation: number;
  /** East of the Sun, so it sets after it; west of it, it rises before it. */
  east: boolean;
  side: Side;
  /** Where to look, in a few words that hold for either hemisphere. */
  where: string;
  /** Apparent magnitude (planets), and in a word. */
  mag?: number;
  bright?: string;
  /** Seen with the eye alone (Uranus asks for binoculars, Neptune a telescope). */
  eye: boolean;
}

export interface Tonight {
  planets: Sighting[];
  moon: Sighting & { phase: Phase };
}

/** The planets as the sky list shows them, inner to outer. */
const PLANETS: readonly PlanetName[] = ['mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'];

/** Degrees from the Sun under which each is lost in the twilight glare: brilliant Venus and the Moon survive closer. */
const GLARE: Partial<Record<PlanetName | 'moon', number>> = { venus: 10, moon: 12 };
const GLARE_DEFAULT = 15;
/** From here out an object is up most of the night. */
const NIGHT = 135;

type V3 = [number, number, number];
const xyz = (lon: number, lat: number, r: number): V3 => [r * Math.cos(lat) * Math.cos(lon), r * Math.cos(lat) * Math.sin(lon), r * Math.sin(lat)];
const helio = (name: PlanetName, day: number): V3 => {
  const h = heliocentric(name, day);
  return xyz(h.lon, h.lat, h.r);
};
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a: V3): number => Math.hypot(a[0], a[1], a[2]);
const angle = (a: V3, b: V3): number => Math.acos(Math.max(-1, Math.min(1, dot(a, b) / (len(a) * len(b))))) / RAD;
const wrap180 = (deg: number): number => ((((deg + 180) % 360) + 360) % 360) - 180;

/**
 * Apparent magnitude from the distances to the Sun `r` and the Earth `d` (au) and the phase angle `i` (degrees): the
 * 1984 Astronomical Almanac formulas (Meeus ch. 41); Saturn's rings add brightness as they open to us (`ringTilt`, its
 * sine).
 */
export function magnitude(name: PlanetName, r: number, d: number, i: number, ringTilt = 0): number {
  const base = 5 * Math.log10(r * d);
  switch (name) {
    case 'mercury': return -0.42 + base + 0.038 * i - 0.000273 * i * i + 0.000002 * i * i * i;
    case 'venus': return -4.4 + base + 0.0009 * i + 0.000239 * i * i - 0.00000065 * i * i * i;
    case 'mars': return -1.52 + base + 0.016 * i;
    case 'jupiter': return -9.4 + base + 0.005 * i;
    case 'saturn': return -8.88 + base + 0.044 * i - 2.6 * Math.abs(ringTilt) + 1.25 * ringTilt * ringTilt;
    case 'uranus': return -7.19 + base;
    case 'neptune': return -6.87 + base;
    default: return -3.86 + base;
  }
}

/** A magnitude in a word: how it looks to the eye, or what it takes to see it. */
export function brightness(mag: number): string {
  if (mag <= -3) return 'brilliant';
  if (mag <= -1) return 'very bright';
  if (mag <= 1) return 'bright';
  if (mag <= 3.5) return 'easy to see';
  if (mag <= 5.5) return 'faint';
  if (mag <= 7) return 'binoculars';
  return 'a telescope';
}

/** Saturn's rings: the pole of their plane in the J2000 ecliptic (Meeus ch. 45: inclination 28.08, node 169.51 degrees). */
const RING_I = 28.0752 * RAD, RING_NODE = 169.5085 * RAD;

/** Where to look for an object `e` degrees from the Sun, east or west of it: words that hold in either hemisphere. */
function whereFor(e: number, east: boolean, side: Side, inside: boolean): string {
  if (side === 'glare') {
    if (e < 4) return inside ? 'passing between us and the Sun' : 'behind the Sun';
    return east ? 'too close to the Sun, just after it sets' : 'too close to the Sun, just before it rises';
  }
  if (side === 'night') {
    if (e >= 170) return 'opposite the Sun: up all night';
    return east ? 'in the east at dusk, up most of the night' : 'rises in the evening, up until dawn';
  }
  if (east) return e < 40 ? 'low in the west after sunset' : e < 80 ? 'in the west after sunset' : 'high in the evening sky';
  return e < 40 ? 'low in the east before sunrise' : e < 80 ? 'in the east before sunrise' : 'high in the morning sky';
}

function sideOf(e: number, east: boolean, limit: number): Side {
  if (e < limit) return 'glare';
  if (e >= NIGHT) return 'night';
  return east ? 'evening' : 'morning';
}

const memo = { day: NaN, value: null as Tonight | null };

/** The sky on the night of `day` (days from J2000.0): every planet and the Moon, where and how bright. */
export function tonight(day: number): Tonight {
  if (memo.day === day && memo.value) return memo.value;
  const earth = helio('earth', day), sun: V3 = [-earth[0], -earth[1], -earth[2]], sunLon = Math.atan2(sun[1], sun[0]) / RAD;
  const planets = PLANETS.map((name): Sighting => {
    const p = helio(name, day), g = sub(p, earth), e = angle(g, sun), lon = Math.atan2(g[1], g[0]) / RAD;
    const east = wrap180(lon - sunLon) > 0, limit = GLARE[name] ?? GLARE_DEFAULT, side = sideOf(e, east, limit);
    const r = len(p), d = len(g), i = angle(sub(earth, p), [-p[0], -p[1], -p[2]]);
    let tilt = 0;
    if (name === 'saturn') {
      const beta = Math.asin(g[2] / d), lam = Math.atan2(g[1], g[0]);
      tilt = Math.sin(RING_I) * Math.cos(beta) * Math.sin(lam - RING_NODE) - Math.cos(RING_I) * Math.sin(beta);
    }
    const mag = magnitude(name, r, d, i, tilt);
    // Mercury never strays far from the Sun: even at its best it hangs low in the twilight
    const where = whereFor(e, east, side, d < len(sun)) + (name === 'mercury' && side !== 'glare' ? ', hard to catch' : '');
    return { id: name, elongation: e, east, side, where, mag, bright: brightness(mag), eye: mag <= 5.5 };
  });
  const ml = moonLongitude(day), mb = moonLatitude(day), m = xyz(ml, mb, 1), e = angle(m, sun), east = wrap180(ml / RAD - sunLon) > 0;
  const side = sideOf(e, east, GLARE.moon!);
  const moon = { id: 'moon' as const, elongation: e, east, side, where: whereFor(e, east, side, false), eye: true, phase: moonPhase(day) };
  memo.day = day;
  memo.value = { planets, moon };
  return memo.value;
}

/* ---------- drawn over the From above view ---------- */

/** How far from the Earth the arcs that name the evening and the morning halves of the sky stand: design units, kept between two sizes on screen. */
const ARC = 70, ARC_MIN_PX = 44, ARC_MAX_PX = 66;

/**
 * The sky from the Earth: the evening half (east of the Sun) and the morning half (west of it) as two arcs round the
 * Earth, the midnight direction (away from the Sun), and a sight-line to every planet in its side's colour. The plan
 * squeezes the outer orbits, so the lines' angles are only roughly true; which side a planet is on is exact.
 */
export function drawTonight(ctx: CanvasRenderingContext2D, app: App): void {
  const day = app.sim.day, t = tonight(day), E = planetOnPlan('earth', day), k = 1 / app.renderer.designScale;
  // the page turns ecliptic longitude clockwise: the Sun's direction from the Earth is at page angle -longitude
  const toSun = -sunLongitude(day), R = Math.max(Math.min(Math.max(ARC, ARC_MIN_PX * k), ARC_MAX_PX * k), 11.5 + 26 * k);
  const at = (a: number, r: number): Vec2 => [E[0] + Math.cos(a) * r, E[1] + Math.sin(a) * r];
  ctx.save();
  // the two halves of the sky: evening from the Sun round to midnight on the east side, morning on the west
  for (const [side, from, to] of [['evening', toSun - Math.PI, toSun], ['morning', toSun, toSun + Math.PI]] as const) {
    haloStroke(ctx, k, 1.8, () => {
      ctx.beginPath();
      ctx.arc(E[0], E[1], R, from + 0.12, to - 0.12);
    }, SIDE_COLOR[side]);
  }
  // midnight: straight up for whoever is on the Earth's night side at midnight
  const mid = toSun + Math.PI;
  drawSight(ctx, app, at(mid, 11.5 + 4 * k), at(mid, R + 30 * k), 1, SIDE_COLOR.night, 1.2, [1, 4]);
  for (const s of t.planets) {
    const P = planetOnPlan(s.id as PlanetName, day), inner = s.id === 'mercury' || s.id === 'venus';
    const faint = !s.eye || s.side === 'glare';
    drawSight(ctx, app, E, P, inner ? 1.7 : 1.1, SIDE_COLOR[s.side], faint ? 0.9 : 1.5, s.side === 'glare' ? [1, 5] : faint ? [2, 6] : [5, 5]);
  }
  ctx.restore();
  const em = toSun - Math.PI / 2, mo = toSun + Math.PI / 2, lab = R + 14 * k;
  const align = (a: number): CanvasTextAlign => (Math.cos(a) > 0.4 ? 'left' : Math.cos(a) < -0.4 ? 'right' : 'center');
  const lift = (a: number): number => (Math.sin(a) > 0.4 ? 12 : Math.sin(a) < -0.4 ? -4 : 4) * k;
  text(ctx, app, [at(em, lab)[0], at(em, lab)[1] + lift(em)], 'evening sky', align(em), 1, true, SIDE_COLOR.evening);
  text(ctx, app, [at(mo, lab)[0], at(mo, lab)[1] + lift(mo)], 'morning sky', align(mo), 1, true, SIDE_COLOR.morning);
  const mEnd = R + 38 * k;
  text(ctx, app, [at(mid, mEnd)[0], at(mid, mEnd)[1] + lift(mid)], 'midnight', align(mid), 0.85);
}
