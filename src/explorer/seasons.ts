/**
 * Seasons and the tilt: the Earth's axis leans ~23.4 degrees and keeps pointing the same way in space (towards
 * Polaris) all year, so for half the orbit the north leans towards the Sun (northern summer) and for the other half the
 * south does. The solstices and equinoxes are where that lean is greatest or sideways on.
 *
 * The Sun's place is the ephemeris's (the Earth-Moon barycentre from JPL's mean elements, turned from the barycentre to
 * the Earth's centre with Meeus's Moon), carried to the equinox of date with the general precession, and corrected for
 * nutation and aberration (Meeus, "Astronomical Algorithms", ch. 22 and 25): good to a few minutes of time for the
 * solstices and equinoxes. Day lengths use the standard sunrise altitude of -0.833 degrees (Meeus ch. 15).
 */
import type { Vec2 } from '../core/math';
import { C, planet } from '../scenes/solar/common';
import { heliocentric, moonDistance, moonLatitude, moonLongitude } from '../scenes/solar/ephemeris';
import type { App } from './app';
import { AU_KM } from './live';
import { GOLD, haloStroke, INK, text } from './overlays';
import { planetOnPlan } from './orbits';

const RAD = Math.PI / 180;
const wrap360 = (deg: number): number => ((deg % 360) + 360) % 360;
/** The Moon's share of the Earth-Moon system's mass: how far the Earth's centre sits from their balance point. */
const MOON_SHARE = 1 / 82.30057;

/** The Sun's apparent ecliptic longitude on `day` (days from J2000.0), degrees of the equinox of date. */
export function sunApparent(day: number): number {
  const T = day / 36525, b = heliocentric('earth', day);
  // the Earth's centre, from the barycentre and the Moon (geocentric, au)
  const ml = moonLongitude(day), mb = moonLatitude(day), md = moonDistance(day) / AU_KM;
  const ex = b.r * Math.cos(b.lat) * Math.cos(b.lon) - MOON_SHARE * md * Math.cos(mb) * Math.cos(ml);
  const ey = b.r * Math.cos(b.lat) * Math.sin(b.lon) - MOON_SHARE * md * Math.cos(mb) * Math.sin(ml);
  const R = Math.hypot(ex, ey);
  const j2000 = Math.atan2(-ey, -ex) / RAD;
  // precession to the equinox of date (5,028.83 arcseconds a century), then nutation and aberration (Meeus 22, 25)
  const node = (125.04452 - 1934.136261 * T) * RAD, Ls = (280.4665 + 36000.7698 * T) * RAD, Lm = (218.3165 + 481267.8813 * T) * RAD;
  const nutation = (-17.2 * Math.sin(node) - 1.32 * Math.sin(2 * Ls) - 0.23 * Math.sin(2 * Lm) + 0.21 * Math.sin(2 * node)) / 3600;
  return wrap360(j2000 + (5028.83 / 3600) * T + nutation - 20.4898 / 3600 / R);
}

/** The tilt of the Earth's axis on a date, degrees (23.44 now, shrinking ~47 arcseconds a century). */
export const obliquity = (day: number): number => 23.4392911 - 0.0130042 * (day / 36525);

/** The Sun's declination: the latitude where it stands overhead at noon, degrees. */
export const subsolarLatitude = (day: number): number => Math.asin(Math.sin(obliquity(day) * RAD) * Math.sin(sunApparent(day) * RAD)) / RAD;

export type TurnName = 'March equinox' | 'June solstice' | 'September equinox' | 'December solstice';
const TURNS: readonly TurnName[] = ['March equinox', 'June solstice', 'September equinox', 'December solstice'];

/** The next solstice or equinox after `day`: when the Sun's longitude next reaches a multiple of 90 degrees. */
export function nextTurn(day: number): { name: TurnName; day: number } {
  const q = Math.floor(sunApparent(day) / 90), target = ((q + 1) % 4) * 90;
  // how far short of the target the Sun is, in (-180, 180]
  const short = (d: number): number => ((target - sunApparent(d) + 540) % 360) - 180;
  let lo = day, hi = day + 100;
  for (let k = 0; k < 50; k++) {
    const m = (lo + hi) / 2;
    if (short(m) > 0) lo = m;
    else hi = m;
  }
  return { name: TURNS[(q + 1) % 4]!, day: (lo + hi) / 2 };
}

export interface Season {
  north: string;
  south: string;
  /** "early", "mid" or "late" in the season. */
  part: string;
}

const SEASONS = ['spring', 'summer', 'autumn', 'winter'] as const;

/** The astronomical season in each hemisphere (from the solstices and equinoxes). */
export function seasonOf(day: number): Season {
  const L = sunApparent(day), q = Math.floor(L / 90), f = (L - q * 90) / 90;
  return { north: SEASONS[q]!, south: SEASONS[(q + 2) % 4]!, part: f < 1 / 3 ? 'early' : f < 2 / 3 ? 'mid' : 'late' };
}

/** Hours from sunrise to sunset at latitude `lat` (degrees) on `day`: 0 in polar night, 24 under the midnight Sun. */
export function daylight(lat: number, day: number): number {
  const d = subsolarLatitude(day) * RAD, p = lat * RAD;
  const c = (Math.sin(-0.8333 * RAD) - Math.sin(p) * Math.sin(d)) / (Math.cos(p) * Math.cos(d));
  if (c <= -1) return 24;
  if (c >= 1) return 0;
  return (2 * Math.acos(c)) / RAD / 15;
}

/** "12 h 07 min". */
export function hoursLabel(h: number): string {
  if (h >= 24) return '24 h: the Sun never sets';
  if (h <= 0) return '0 h: the Sun never rises';
  let H = Math.floor(h), m = Math.round((h - H) * 60);
  if (m === 60) { H += 1; m = 0; }
  return `${H} h ${String(m).padStart(2, '0')} min`;
}

/* ---------- drawn over the From above view ---------- */

/** Where the Earth is on its orbit at each turn: its heliocentric longitude is the Sun's, turned half round. */
const TURN_EARTH_LON: readonly [TurnName, number][] = [['March equinox', 180], ['June solstice', 270], ['September equinox', 0], ['December solstice', 90]];
/** The Earth's perihelion and aphelion longitudes (J2000, degrees), with the dates they fall on (~3 January, ~4 July). */
const APSES: readonly [string, number][] = [['closest to the Sun, ~3 Jan', 102.94], ['farthest, ~4 Jul', 282.94]];

/**
 * The seasons on the plan: the solstices and equinoxes marked on the Earth's orbit, its closest and farthest points,
 * and the Earth's axis, whose north end always leans the same way (towards the top of the page, where the Sun is seen
 * from the Earth at the June solstice).
 */
export function drawSeasons(ctx: CanvasRenderingContext2D, app: App): void {
  const k = 1 / app.renderer.designScale, a = planet('earth').a, day = app.sim.day;
  const on = (lon: number, r: number): Vec2 => [C[0] + Math.cos(-lon * RAD) * r, C[1] + Math.sin(-lon * RAD) * r];
  const earthLon = heliocentric('earth', day).lon / RAD;
  for (const [name, lon] of TURN_EARTH_LON) {
    const [x0, y0] = on(lon, a - 7 * k), [x1, y1] = on(lon, a + 7 * k);
    haloStroke(ctx, k, 2, () => {
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
    }, GOLD);
    // with the Earth passing, its own name (and its axis) stand where this one would: this one stands off beyond them
    const near = Math.abs(((earthLon - lon + 540) % 360) - 180) < 14;
    const u = on(lon, a + (near ? 80 : 16) * k), cx = Math.cos(-lon * RAD), cy = Math.sin(-lon * RAD);
    text(ctx, app, [u[0], u[1] + (cy > 0.5 ? 10 : cy < -0.5 ? -2 : 4) * k], name, cx > 0.5 ? 'left' : cx < -0.5 ? 'right' : 'center', 0.95, true, GOLD);
  }
  for (const [name, lon] of APSES) {
    const p = on(lon, a);
    ctx.save();
    ctx.lineWidth = 3.4 * k;
    ctx.strokeStyle = 'rgba(13,15,21,0.6)';
    ctx.beginPath();
    ctx.arc(p[0], p[1], 3.2 * k, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 1.4 * k;
    ctx.strokeStyle = INK;
    ctx.stroke();
    ctx.restore();
    // named inside the orbit, clear of the solstices' names outside it
    const u = on(lon, a - 14 * k), cx = Math.cos(-lon * RAD), cy = Math.sin(-lon * RAD);
    text(ctx, app, [u[0], u[1] + (cy > 0.5 ? -4 : cy < -0.5 ? 12 : 4) * k], name, cx > 0.5 ? 'right' : cx < -0.5 ? 'left' : 'center', 0.8);
  }
  // the axis through the Earth, its north end leaning towards the top of the page all year
  const E = planetOnPlan('earth', day), r = planet('earth').r, n: Vec2 = [E[0], E[1] - r - 12 * k], s: Vec2 = [E[0], E[1] + r + 6 * k];
  haloStroke(ctx, k, 1.8, () => {
    ctx.beginPath();
    ctx.moveTo(s[0], s[1]);
    ctx.lineTo(n[0], n[1]);
  }, INK);
  text(ctx, app, [n[0], n[1] - 5 * k], 'N', 'center', 1, true);
}
