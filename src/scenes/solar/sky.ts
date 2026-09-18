/**
 * The sky a solar piece is drawn under: where every body is at a moment and how that moment moves, read by both
 * solar sets (top-down and spiral) instead of a bare frame count.
 *
 * - A render draws the loop sky: the plan's own stylised clock, whole turns per 576-frame loop, counted in drawn
 *   frames so the seam frame repeats the first exactly.
 * - The live explorer draws a dated sky: the real positions of the planets and the Moon on a calendar date
 *   (`ephemeris.ts`), time counted in days from J2000.0, with the trails the viewer asks for. It rides into a scene on
 *   its frame (`SkyFrame`), so a scene stays a pure function of what it is handed.
 *
 * Angles are page angles: radians, y down, bodies going round counter-clockwise on the page as seen from the north.
 * On a dated sky the J2000 equinox points to the right of the page.
 */
import { TAU } from '../../core/math';
import type { SceneFrame } from '../../core/scene';
import { BELT, LOOP, MOON, MOON_K, orbitAngle, orbitClock, PLANETS, ROCKS } from './common';
import { heliocentric, MOON_PERIOD_DAYS, moonLongitude, periodDays } from './ephemeris';

export { MOON_K };

/** Trails as a viewer drives them: how far back they reach and how strongly they are drawn. */
export interface TrailSpec {
  /** How far back a trail reaches, in the sky's time unit. */
  readonly span: number;
  /** 0..1: how much of that span has unspooled (trails grow out of their bodies when switched on). */
  readonly reveal: number;
  /** 0..1: the strength trails are drawn at (they fade in and out). */
  readonly alpha: number;
}

export interface Sky {
  /** The moment, in the sky's time unit: drawn frames into the loop for a render, days from J2000.0 for a dated sky. */
  readonly now: number;
  /** Drawn frames of ambient motion (twinkles, sparkles, sweeps), separate from the orbits so it keeps its pace at any speed. */
  readonly beat: number;
  /** Page angle of body `k` (planets 0..7, the Moon round the Earth 8) at time `t`. */
  angle(k: number, t: number): number;
  /** Page angle of belt rock `i` at time `t`. */
  rock(i: number, t: number): number;
  /** Time one orbit of body `k` takes. */
  period(k: number): number;
  /** Trails as the viewer drives them; absent for renders, where each piece draws its own. */
  readonly trails?: TrailSpec;
}

const turnsOf = (k: number): number => (k === MOON_K ? MOON.turns : PLANETS[k]!.turns);
const at0Of = (k: number): number => (k === MOON_K ? MOON.at0 : PLANETS[k]!.at0);

/** The plan's own clock `m` drawn frames into the loop: whole turns per loop, exact on the seam. */
export function loopSky(m: number): Sky {
  return {
    now: m,
    beat: m,
    angle: (k, t) => orbitAngle(turnsOf(k), at0Of(k), t),
    rock: (i, t) => orbitAngle(ROCKS[i]!.turns, ROCKS[i]!.at0, t),
    period: k => LOOP / turnsOf(k),
  };
}

/**
 * The belt's rocks on a dated sky: circular orbits from the belt's real extent (about 2.2 to 3.3 au, mapped from the
 * plan's radii), each starting at its plan angle on J2000.0, so the belt shears at Kepler's pace.
 */
const ROCK_PERIOD = ROCKS.map(rk => 365.25636 * (2.2 + ((rk.a - BELT.inner) / (BELT.outer - BELT.inner)) * 1.1) ** 1.5);

export interface DatedSkyOptions {
  /** Days from J2000.0. */
  day: number;
  /** Ambient beat, drawn frames. */
  beat: number;
  trails?: TrailSpec;
}

/** The real sky on a date: the planets and the Moon where the ephemeris puts them. */
export function datedSky({ day, beat, trails }: DatedSkyOptions): Sky {
  return {
    now: day,
    beat,
    ...(trails ? { trails } : {}),
    angle: (k, t) => -(k === MOON_K ? moonLongitude(t) : heliocentric(PLANETS[k]!.name, t).lon),
    rock: (i, t) => ROCKS[i]!.at0 - (TAU * t) / ROCK_PERIOD[i]!,
    period: k => (k === MOON_K ? MOON_PERIOD_DAYS : periodDays(PLANETS[k]!.name)),
  };
}

/** A frame the explorer drives: its sky rides along. */
export interface SkyFrame extends SceneFrame {
  readonly sky?: Sky;
}

/** The sky a frame is drawn under: the one it carries, else the loop sky at its loop clock. */
export const skyOf = (f: SceneFrame, loopFromFrames: number): Sky => (f as SkyFrame).sky ?? loopSky(orbitClock(f, loopFromFrames));

/**
 * How far back along its orbit body `k`'s trail reaches (radians) and how strongly it is drawn: the viewer's trails
 * when the sky carries them (never more than one lap), else the piece's own `sweep` at full strength.
 */
export function trailSweep(sky: Sky, k: number, sweep: number): { sweep: number; alpha: number } {
  const t = sky.trails;
  if (!t) return { sweep, alpha: 1 };
  return { sweep: TAU * Math.min(1, t.span / sky.period(k)) * t.reveal, alpha: t.alpha };
}
