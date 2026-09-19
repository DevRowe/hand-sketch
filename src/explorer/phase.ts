/**
 * The Moon's phase as we see it: a small glyph (the lit part as seen from the northern hemisphere, where a waxing Moon
 * is lit on the right; from the south it is mirrored) and the dates of the next new and full Moons.
 */
import { moonLongitude, sunLongitude } from '../scenes/solar/ephemeris';
import type { Phase } from './live';

const TAU = Math.PI * 2;

/** How far the Moon has come round from the Sun in our sky, radians in [0, 2 pi): 0 new, pi full. */
const elongation = (day: number): number => (((moonLongitude(day) - sunLongitude(day)) % TAU) + TAU) % TAU;

/** The next moment on or after `day` when the Moon stands `target` radians round from the Sun (0 new, pi full). */
function nextAt(day: number, target: number): number {
  const off = (d: number): number => ((elongation(d) - target + 3 * Math.PI) % TAU) - Math.PI;
  let a = day, fa = off(a);
  for (let d = day + 0.5; d < day + 32; d += 0.5) {
    const fd = off(d);
    // a crossing from behind (negative) to past (positive), not the jump half a month away
    if (fa < 0 && fd >= 0 && fd - fa < Math.PI) {
      let lo = a, hi = d;
      for (let k = 0; k < 40; k++) {
        const m = (lo + hi) / 2;
        if (off(m) < 0) lo = m;
        else hi = m;
      }
      return (lo + hi) / 2;
    }
    a = d;
    fa = fd;
  }
  return day;
}

/** The next new and full Moons after `day`. */
export const nextNew = (day: number): number => nextAt(day, 0);
export const nextFull = (day: number): number => nextAt(day, Math.PI);

/**
 * The lit part of a Moon of radius `R` centred on (x, y), as a path: the lit limb's half circle closed by the
 * terminator, a half ellipse whose width follows the lit fraction.
 */
export function phasePath(ctx: CanvasRenderingContext2D, x: number, y: number, R: number, p: Phase): void {
  const right = p.waxing, rx = R * Math.abs(1 - 2 * p.lit), gibbous = p.lit > 0.5;
  ctx.beginPath();
  // the lit limb, top to bottom round the lit side
  ctx.arc(x, y, R, -Math.PI / 2, Math.PI / 2, !right);
  // back up the terminator: bulging towards the lit side for a crescent, away from it for a gibbous Moon
  ctx.ellipse(x, y, Math.max(rx, 0.01), R, 0, Math.PI / 2, -Math.PI / 2, right !== gibbous);
  ctx.closePath();
}

/** The same glyph as SVG markup, `size` pixels across, for the cards. */
export function phaseSvg(p: Phase, size = 40): string {
  const R = 18, right = p.waxing, rx = (R * Math.abs(1 - 2 * p.lit)).toFixed(2), gibbous = p.lit > 0.5;
  // SVG's sweep flag 1 turns clockwise on screen: right-hand limb from the top, or the terminator back up the left
  const limb = `A${R} ${R} 0 0 ${right ? 1 : 0} 0 ${R}`, term = `A${rx} ${R} 0 0 ${right === gibbous ? 1 : 0} 0 ${-R}`;
  const lit = p.lit < 0.005 ? '' : p.lit > 0.995 ? `<circle r="${R}" class="lit"/>` : `<path class="lit" d="M0 ${-R}${limb}${term}Z"/>`;
  return `<svg class="phase" viewBox="-20 -20 40 40" width="${size}" height="${size}" aria-hidden="true"><circle r="${R}" class="dark"/>${lit}<circle r="${R}" class="rim"/></svg>`;
}
