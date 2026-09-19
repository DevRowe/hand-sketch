/**
 * Eclipses in the Earth and Moon view: the Moon's shadow, worked out from the real Sun, Moon and Earth on the date, and
 * the moment of the long total eclipse of 2 August 2027.
 *
 * The shadow is two cones behind the Moon: the umbra, where the Sun is wholly hidden, narrowing to a point ~375,000 km
 * back, and the penumbra, where it is partly hidden, widening. Seen from above the ecliptic both always seem to reach
 * the Earth at new Moon; whether they really do depends on the Moon's height above or below the Earth's orbit, which
 * this reads from the Moon's latitude (Meeus). Dates, times and durations of real eclipses are NASA's (Espenak's
 * catalogue), never the model's; the model only draws the geometry.
 */
import type { Vec2 } from '../core/math';
import { C, EARTH_R, MOON_R, moonAt, onEarth, onPage, sunAngle, units, utc, type V3 } from '../scenes/cislunar/common';
import { heliocentric, sunLongitude } from '../scenes/solar/ephemeris';
import type { App } from './app';
import { moonMarkR } from './bodies';
import { dateLong } from './format';
import { AU_KM } from './live';
import { nextNew } from './phase';
import type { Preset } from './presets';
import { drawMark, GOLD, text } from './overlays';

const SUN_R = 695_700;

export type EclipseKind = 'total' | 'annular' | 'partial' | 'none';

export interface Shadow {
  /** Unit vector along the shadow, away from the Sun (ecliptic). */
  dir: V3;
  /** The Moon's centre, km from the Earth's (ecliptic). */
  moon: V3;
  /** Distance along the shadow from the Moon to the point nearest the Earth's centre, km. */
  along: number;
  /** How far the shadow's axis passes from the Earth's centre, km, and on which side of the Earth's orbit. */
  miss: number;
  north: boolean;
  /** Radii there, km: the penumbra, and the umbra (negative past its tip: the antumbra of an annular eclipse). */
  penumbra: number;
  umbra: number;
  kind: EclipseKind;
}

/** The Moon's shadow on `day`, or null while the Moon is on the Earth's night side (no solar eclipse possible). */
export function moonShadow(day: number): Shadow | null {
  const m = moonAt(day), l = sunLongitude(day), s: V3 = [Math.cos(l), Math.sin(l), 0], along = m[0] * s[0] + m[1] * s[1] + m[2] * s[2];
  if (along <= 0) return null;
  const off: V3 = [m[0] - along * s[0], m[1] - along * s[1], m[2] - along * s[2]], miss = Math.hypot(off[0], off[1], off[2]);
  // the Sun from the Moon, km: the Earth's distance less the Moon's lead towards it
  const D = heliocentric('earth', day).r * AU_KM - along;
  const penumbra = MOON_R + (along * (SUN_R + MOON_R)) / D, umbra = MOON_R - (along * (SUN_R - MOON_R)) / D;
  const kind: EclipseKind = miss > EARTH_R + penumbra ? 'none' : miss < EARTH_R + Math.abs(umbra) ? (umbra > 0 ? 'total' : 'annular') : 'partial';
  return { dir: [-s[0], -s[1], -s[2]], moon: m, along, miss, north: off[2] > 0, penumbra, umbra, kind };
}

/** "~9,300 km". */
const kmRound = (n: number): string => `~${(Math.round(n / 100) * 100).toLocaleString('en-GB')} km`;

/** The shadow in a line of words. */
export function shadowWords(sh: Shadow): string {
  if (sh.kind === 'total') return 'falls on the Earth: a total eclipse';
  if (sh.kind === 'annular') return 'falls on the Earth: an annular eclipse';
  if (sh.kind === 'partial') return 'grazes the Earth: a partial eclipse';
  return `misses the Earth, passing ${kmRound(sh.miss - EARTH_R - sh.penumbra)} ${sh.north ? 'north' : 'south'} of it`;
}

/** Degrees from new Moon within which the shadow is drawn. */
const NEAR_NEW = 32;

/**
 * The Moon's shadow over the Earth and Moon view: the penumbra pale, the umbra dark, from the Moon's disc back past the
 * Earth, captioned with whether it lands. Drawn near new Moon only; the widths are true to scale at the Earth, the start
 * follows the Moon's disc as drawn (which never shrinks below a few pixels).
 */
export function drawShadow(ctx: CanvasRenderingContext2D, app: App): void {
  const day = app.sim.day, sh = moonShadow(day);
  if (!sh) return;
  const a = sunAngle(day), elong = (Math.atan2(sh.miss, sh.along) * 180) / Math.PI;
  if (elong > NEAR_NEW) return;
  const k = 1 / app.renderer.designScale, M = onPage(sh.moon), u: Vec2 = [-Math.cos(a), -Math.sin(a)], n: Vec2 = [-u[1], u[0]];
  const rm = moonMarkR(app.camera.zoom), reach = units(sh.along + EARTH_R * 1.6);
  const atEarth = units(sh.along), pen = Math.max(units(sh.penumbra), rm * 1.02), umb = Math.max(units(Math.abs(sh.umbra)), 0.8 * k);
  const pt = (t: number, w: number): Vec2 => [M[0] + u[0] * t + n[0] * w, M[1] + u[1] * t + n[1] * w];
  // the penumbra widens steadily from the Moon's limb; the umbra narrows to (nearly) a point at the Earth
  const penAt = (t: number): number => rm + ((pen - rm) * t) / atEarth, umbAt = (t: number): number => rm + ((umb - rm) * t) / atEarth;
  ctx.save();
  // a shadow that passes above or below the Earth is drawn faint: from above it only seems to reach it
  ctx.globalAlpha = Math.min(1, (NEAR_NEW - elong) / 8) * (sh.kind === 'none' ? 0.5 : 1);
  ctx.beginPath();
  ctx.moveTo(...pt(0, rm));
  ctx.lineTo(...pt(reach, penAt(reach)));
  ctx.lineTo(...pt(reach, -penAt(reach)));
  ctx.lineTo(...pt(0, -rm));
  ctx.closePath();
  ctx.fillStyle = 'rgba(13,15,21,0.38)';
  ctx.fill();
  ctx.lineWidth = 1 * k;
  ctx.strokeStyle = 'rgba(232,163,61,0.75)';
  ctx.setLineDash([4 * k, 4 * k]);
  ctx.stroke();
  ctx.setLineDash([]);
  const tip = Math.min(reach, atEarth);
  ctx.beginPath();
  ctx.moveTo(...pt(0, rm));
  ctx.lineTo(...pt(tip, umbAt(tip)));
  ctx.lineTo(...pt(tip, -umbAt(tip)));
  ctx.lineTo(...pt(0, -rm));
  ctx.closePath();
  ctx.fillStyle = 'rgba(5,6,10,0.82)';
  ctx.fill();
  ctx.restore();
  // the caption beside the cone, on the side away from the page's centre line, where the gap's own caption is not
  const mid = atEarth * 0.5, side = n[1] < 0 ? 1 : -1, off = (penAt(mid) + 16 * k) * side;
  const c = pt(mid, off), words = shadowWords(sh);
  ctx.save();
  ctx.globalAlpha = Math.min(1, (NEAR_NEW - elong) / 8);
  text(ctx, app, [c[0], c[1] - 3 * k], 'The Moon’s shadow', 'center', 1, true);
  text(ctx, app, [c[0], c[1] + 12 * k], words, 'center', 0.92, false, sh.kind === 'none' ? '#fff4dc' : GOLD);
  ctx.restore();
}

/* ---------- the total eclipse of 2 August 2027 ---------- */

/** Greatest eclipse (NASA: 10:07 UT) and Luxor, near where it falls. */
const GREATEST = utc(2027, 8, 2, 10, 7);
const LUXOR = { lat: 25.69, lon: 32.64 };

function eclipseOverlay(ctx: CanvasRenderingContext2D, app: App): void {
  if (app.view !== 'earth') return;
  drawShadow(ctx, app);
  // on the day, Luxor, where the shadow lands longest, on the side of the Earth we can see
  const day = app.sim.day;
  if (Math.abs(day - GREATEST) < 0.2) {
    const p = onEarth(LUXOR.lat, LUXOR.lon, day);
    if (p[2] > 0) drawMark(ctx, app, onPage(p), 'Luxor', true);
  }
}

/** The page point halfway between the Earth and the Moon on a day: a moment framed on both. */
const between = (day: number): Vec2 => {
  const [x, y] = onPage(moonAt(day));
  return [(x + C[0]) / 2, (y + C[1]) / 2];
};

export const ECLIPSES: readonly Preset[] = [
  {
    id: 'eclipse-2027',
    group: 'Eclipses',
    title: 'The total solar eclipse of 2027',
    kicker: 'Over six minutes of darkness near Luxor.',
    day: () => GREATEST,
    view: 'earth',
    frame: { fit: 290, at: () => between(GREATEST) },
    journey: () => ({ from: utc(2027, 8, 1, 10), to: utc(2027, 9, 2, 10), pace: 2.5, label: 'Play on a month: why not every new Moon' }),
    overlay: eclipseOverlay,
    card() {
      const sh = moonShadow(GREATEST)!, next = nextNew(GREATEST + 20);
      return {
        when: '2 August 2027',
        intro: 'The Moon passes exactly between the Sun and the Earth, and its shadow sweeps from the Atlantic across the Strait of Gibraltar, North Africa and Arabia. Near Luxor in Egypt the Sun is hidden for up to 6 minutes 23 seconds, the longest total eclipse over land between 1991 and 2114.',
        facts: [
          { label: 'Greatest eclipse', value: '~10:07 UTC, near Luxor, Egypt' },
          { label: 'Totality, at most', value: '6 min 23 s' },
          { label: 'Total along the path', value: 'southern Spain, Morocco, Algeria, Tunisia, Libya, Egypt, Saudi Arabia, Yemen, Somalia' },
          { label: 'Partial from', value: 'most of Europe, Africa and western Asia' },
          { label: 'The last one', value: '12 August 2026 (Greenland, Iceland, Spain)' },
          { label: 'The next one', value: '22 July 2028 (Australia, New Zealand)' },
        ],
        body: [
          `From above you can see why: the Sun, the Moon and the Earth stand in one line, and the Moon’s shadow reaches the Earth. The dark core, the umbra, where the Sun is wholly hidden, is only ${kmRound(2 * sh.umbra)} across where it lands; the paler penumbra, where the eclipse is partial, spans ${kmRound(2 * sh.penumbra)}.`,
          'Why so long: the Moon is near its closest to the Earth, so it looks large, and the Earth is near its farthest from the Sun, so the Sun looks small; and the shadow lands head on near Luxor, where the Sun is almost overhead.',
          `Why not every month: the Moon’s orbit is tilted ~5° to the Earth’s, so at most new Moons its shadow passes above or below the Earth. Play the month on to see the next new Moon, on ${dateLong(next, true)}, miss.`,
        ],
      };
    },
  },
];
