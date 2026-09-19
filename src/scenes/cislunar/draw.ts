/**
 * The Earth and Moon view drawn in one visual style: the paper and the hand come from the style (`looks.ts`), the
 * geometry from `common.ts` and the crowds and stations from `objects.ts`.
 *
 * Two layers. A static one, built once per lens: the low-orbit band, the shells of medium and geostationary orbit, the
 * geostationary belt's circle, the Moon's mean orbit and (close in) the Karman line, textured by the style's tooth. A
 * live one, drawn every frame: whatever moves, painted far to near, so the Earth hides the parts of orbits behind it:
 * the Moon's path and the Moon, the stations with their orbits, the crowds of satellites and the spinning Earth, lit on
 * the side facing the Sun.
 */
import { clamp, TAU, type Vec2 } from '../../core/math';
import { rng } from '../../core/random';
import type { Scene, SceneFrame } from '../../core/scene';
import type { Ctx } from '../../core/stage';
import { composite, ground, hatchLines, knockOut, scratch, toothMask, type GroundOptions, type ToothOptions } from '../gallery/common';
import { C, EARTH_EQ, EARTH_R, equatorRing, hiddenByEarth, MOON_A, MOON_MONTH, MOON_R, moonAt, onEarth, onPage, orbitAt, orbitPath, shape, sunAngle, units, utc, type Orbit, type V3 } from './common';
import { LAND } from './land';
import { enterLens, lensLayer, lensOf, onScreen, ringOnScreen, type Lens, type LensFrame } from './lens';
import { censusAt, flying, GEO_COUNT, GPS_COUNT, SLOTS, STARLINK_COUNT, STARLINK_PER_DOT, STARLINK_SHELL, TRACKED, type Tracked } from './objects';

/** How a style lays its lines. */
export type Hand = 'pen' | 'chalk' | 'brush' | 'dots' | 'print' | 'cut' | 'bold';

export interface Look {
  key: string;
  paper: string;
  ground: GroundOptions & { seed: number };
  hand: Hand;
  /** Shells, orbits, outlines. */
  line: string;
  /** Construction lines: the Moon's mean orbit, the Karman line. */
  faint: string;
  /** The geostationary belt and the stations. */
  accent: string;
  /** The GPS shell and the crowds of satellites. */
  accent2: string;
  /** The low-orbit band's tint. */
  band: string;
  bandAlpha: number;
  ocean: string;
  land: string;
  night: string;
  nightAlpha: number;
  moon: string;
  mare: string;
  /** The Moon's path. */
  trail: string;
  /** Light on the sunward limb. */
  rim: string;
  /** Base line weight, logical units. */
  width: number;
  /** Texture knocked out of both layers. */
  tooth?: ToothOptions & { alpha: number };
  /** The crowds and the stations printed in a second ink, off register by this much (logical units). */
  misregister?: Vec2;
  /** Night sides hatched rather than washed. */
  hatch?: boolean;
  /** A soft glow of the marks screened under them. */
  bloom?: boolean;
  /** Paper shadows under the cut shells. */
  shadow?: string;
}

/** The altitudes the view names, km: low orbit's band, GPS's shell, the geostationary belt, the Karman line. */
export const LEO_LOW = 160;
export const LEO_HIGH = 2000;
export const GPS_ALT = 20180;
export const GEO_ALT = 35786;
export const KARMAN = 100;

/** A day to draw when a frame carries no sky (a render): the Artemis II crew's flyby of the Moon. */
const DEMO_DAY = utc(2026, 4, 6, 23);

const RAD = Math.PI / 180;

function rgba(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${clamp(a, 0, 1)})`;
}

/* ---------- lines in the style's hand ---------- */

interface LineOpts {
  color: string;
  /** Weight, logical units. */
  w: number;
  alpha?: number;
  dash?: readonly number[];
  seed?: number;
}

/** Stroke the current path of `g` in the look's hand (widths in logical units, through lens `L`). */
function inHand(g: Ctx, L: Lens, look: Look, path: Path2D, o: LineOpts): void {
  const u = L.u, a = o.alpha ?? 1;
  g.save();
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.setLineDash((o.dash ?? []).map(d => d * u));
  const pass = (color: string, w: number, alpha: number): void => {
    g.strokeStyle = color;
    g.globalAlpha = alpha;
    g.lineWidth = w * u;
    g.stroke(path);
  };
  switch (look.hand) {
    case 'chalk':
      pass(o.color, o.w * 2.6, a * 0.14);
      pass(o.color, o.w, a * 0.7);
      break;
    case 'dots':
      if (!o.dash) g.setLineDash([0.01 * u, o.w * 3.4 * u]);
      pass(o.color, o.w * 1.7, a);
      break;
    case 'bold':
      pass(o.color, o.w * 1.8, a);
      break;
    case 'brush':
      pass(o.color, o.w * 2.2, a * 0.18);
      pass(o.color, o.w * 1.1, a * 0.85);
      break;
    default:
      pass(o.color, o.w, a);
  }
  g.restore();
}

/** A circle as a path (design units). */
function ringPath(x: number, y: number, r: number): Path2D {
  const p = new Path2D();
  p.arc(x, y, r, 0, TAU);
  return p;
}

/** A polyline of points in space as a path on the page, split where the Earth hides it: [behind, in front]. */
function spacePaths(pts: readonly V3[]): [Path2D, Path2D] {
  const back = new Path2D(), front = new Path2D();
  let prev: 'b' | 'f' | null = null;
  for (const p of pts) {
    const [x, y] = onPage(p), side = p[2] < 0 ? 'b' : 'f', path = side === 'b' ? back : front;
    if (side !== prev) {
      // carry the line one point over the change, so the two halves meet
      if (prev) (prev === 'b' ? back : front).lineTo(x, y);
      path.moveTo(x, y);
    } else path.lineTo(x, y);
    prev = side;
  }
  return [back, front];
}

/* ---------- the static layer ---------- */

/** The low-orbit band as an annulus path. */
function annulusPath(r0: number, r1: number): Path2D {
  const p = new Path2D();
  p.arc(C[0], C[1], r1, 0, TAU);
  p.moveTo(C[0] + r0, C[1]);
  p.arc(C[0], C[1], r0, 0, TAU, true);
  return p;
}

function drawStatic(g: Ctx, L: Lens, look: Look): void {
  enterLens(g, L);
  const E = units(EARTH_EQ), leo0 = units(EARTH_EQ + LEO_LOW), leo1 = units(EARTH_EQ + LEO_HIGH);
  const gps = units(EARTH_EQ + GPS_ALT), geo = units(EARTH_EQ + GEO_ALT), moon = units(MOON_A), px = L.u;
  // the low-orbit band: a tint from 160 to 2,000 km, only once it has room to show
  if ((leo1 - E) / px > 1.5 && onScreen(L, C[0], C[1], leo1)) {
    const band = annulusPath(leo0, leo1);
    if (look.hand === 'cut' && look.shadow) {
      g.save();
      g.shadowColor = look.shadow;
      g.shadowBlur = 10 * L.k * px;
      g.shadowOffsetY = 3 * L.k * px;
      g.fillStyle = rgba(look.band, look.bandAlpha);
      g.fill(band, 'evenodd');
      g.restore();
    } else {
      g.fillStyle = rgba(look.band, look.bandAlpha);
      g.fill(band, 'evenodd');
    }
    if (look.hand === 'dots') {
      // a stippled band: its tone from dots, not a wash
      const r = rng(7300), n = Math.min(2600, Math.round(((leo1 * leo1 - leo0 * leo0) * Math.PI) / (px * px * 55)));
      g.fillStyle = look.line;
      for (let k = 0; k < n; k++) {
        const a = r() * TAU, rr = Math.sqrt(leo0 * leo0 + r() * (leo1 * leo1 - leo0 * leo0));
        g.beginPath();
        g.arc(C[0] + Math.cos(a) * rr, C[1] + Math.sin(a) * rr, 0.7 * px, 0, TAU);
        g.fill();
      }
    }
    inHand(g, L, look, ringPath(C[0], C[1], leo1), { color: look.line, w: look.width * 0.7, alpha: 0.55 });
  }
  // the Karman line, once 100 km is a few pixels off the ground
  const karman = units(EARTH_R + KARMAN);
  if ((karman - units(EARTH_R)) / px > 4 && ringOnScreen(L, C[0], C[1], karman)) {
    inHand(g, L, look, ringPath(C[0], C[1], karman), { color: look.faint, w: look.width * 0.6, dash: [2, 5], alpha: 0.9 });
  }
  // medium orbit: the GPS shell
  if (ringOnScreen(L, C[0], C[1], gps)) inHand(g, L, look, ringPath(C[0], C[1], gps), { color: look.accent2, w: look.width * 0.8, dash: [7, 6], alpha: 0.8 });
  // the geostationary belt: a shell's outline and, tipped with the equator, the belt itself
  if (ringOnScreen(L, C[0], C[1], geo)) {
    inHand(g, L, look, ringPath(C[0], C[1], geo), { color: look.accent, w: look.width * 0.5, dash: [2, 4], alpha: 0.6 });
    const belt = new Path2D();
    equatorRing(EARTH_EQ + GEO_ALT, 180).forEach((p, k) => {
      const [x, y] = onPage(p);
      if (k) belt.lineTo(x, y);
      else belt.moveTo(x, y);
    });
    inHand(g, L, look, belt, { color: look.accent, w: look.width, alpha: 0.95 });
  }
  // the Moon's mean orbit, for scale
  if (ringOnScreen(L, C[0], C[1], moon)) inHand(g, L, look, ringPath(C[0], C[1], moon), { color: look.faint, w: look.width * 0.7, dash: [3, 7], alpha: 0.85 });
}

/* ---------- the Earth ---------- */

/** The land as seen now: each coast projected on the disc, hidden stretches run along the limb. */
function landPath(day: number): Path2D {
  const p = new Path2D(), R = units(EARTH_R);
  for (const ring of LAND) {
    let started = false, any = false, lastHidden: number | null = null;
    const n = ring.length / 2;
    for (let k = 0; k <= n; k++) {
      const i = (k % n) * 2, q = onEarth(ring[i + 1]! / 10, ring[i]! / 10, day), [x, y] = onPage(q);
      if (q[2] >= 0) any = true;
      let px = x, py = y;
      if (q[2] < 0) {
        // behind the limb: run along it instead of cutting across the disc
        const a = Math.atan2(y - C[1], x - C[0]);
        if (lastHidden !== null && started) {
          let d = a - lastHidden;
          d -= TAU * Math.round(d / TAU);
          const steps = Math.ceil(Math.abs(d) / 0.12);
          for (let s = 1; s < steps; s++) {
            const b = lastHidden + (d * s) / steps;
            p.lineTo(C[0] + Math.cos(b) * R, C[1] + Math.sin(b) * R);
          }
        }
        px = C[0] + Math.cos(a) * R;
        py = C[1] + Math.sin(a) * R;
        lastHidden = a;
      } else lastHidden = null;
      if (started) p.lineTo(px, py);
      else {
        p.moveTo(px, py);
        started = true;
      }
    }
    if (!any) continue;
    p.closePath();
  }
  return p;
}

function drawEarth(g: Ctx, L: Lens, look: Look, day: number): void {
  const R = units(EARTH_R), px = L.u, rScreen = R / px, disc = ringPath(C[0], C[1], R), toSun = sunAngle(day);
  g.fillStyle = look.ocean;
  g.fill(disc);
  g.save();
  g.clip(disc);
  if (rScreen > 3) {
    g.fillStyle = look.land;
    g.fill(landPath(day));
  }
  // the night half, away from the Sun: hatched on the screen's own lattice, or washed with a soft terminator
  if (look.hatch && rScreen > 14) {
    const night = new Path2D(), toLogical = new DOMMatrix([L.k / L.base, 0, 0, L.k / L.base, L.tx / L.base, L.ty / L.base]);
    night.arc(C[0], C[1], R, toSun + Math.PI / 2, toSun + (3 * Math.PI) / 2);
    night.closePath();
    const clip = new Path2D();
    clip.addPath(night, toLogical);
    const [x0, y0] = [toLogical.e + (C[0] - R) * toLogical.a, toLogical.f + (C[1] - R) * toLogical.a], size = 2 * R * toLogical.a;
    g.save();
    g.setTransform(L.base, 0, 0, L.base, 0, 0);
    hatchLines(g, clip, [x0, y0, x0 + size, y0 + size], { angle: 0.75, gap: 3, color: look.night, width: 0.8, alpha: look.nightAlpha, seed: 41 });
    g.restore();
  } else {
    g.save();
    g.translate(C[0], C[1]);
    g.rotate(toSun);
    const grad = g.createLinearGradient(-R, 0, R, 0);
    // the terminator softens over ~6 degrees of arc either side, as twilight does
    grad.addColorStop(0, rgba(look.night, look.nightAlpha));
    grad.addColorStop(0.45, rgba(look.night, look.nightAlpha));
    grad.addColorStop(0.5, rgba(look.night, look.nightAlpha * 0.55));
    grad.addColorStop(0.55, rgba(look.night, 0));
    grad.addColorStop(1, rgba(look.night, 0));
    g.fillStyle = grad;
    g.fillRect(-R, -R, 2 * R, 2 * R);
    g.restore();
  }
  g.restore();
  // the rim: light on the sunward limb, the outline all round
  g.save();
  g.lineCap = 'round';
  g.strokeStyle = look.rim;
  g.globalAlpha = 0.9;
  g.lineWidth = look.width * 1.1 * px;
  g.beginPath();
  g.arc(C[0], C[1], R, toSun - 1.25, toSun + 1.25);
  g.stroke();
  g.restore();
  inHand(g, L, look, disc, { color: look.line, w: look.width * 0.8, alpha: 0.9 });
}

/* ---------- the Moon ---------- */

/** Near-side seas: selenographic latitude and longitude (degrees) and size (degrees of arc). */
const MARIA: readonly [number, number, number][] = [
  [32.8, -15.6, 11], [28, 17.5, 7], [8.5, 31.4, 8], [17, 59.1, 5], [18.4, -57.4, 13], [-21.3, -16.6, 6], [-7.8, 53.3, 6], [56, 1.4, 6],
];

/** The Moon's drawn radius: true to scale, but never less than a few pixels. */
export const moonRadius = (L: Lens): number => Math.max(units(MOON_R), MOON_LEAST * L.u);
/** The least radius the Moon is drawn at, logical units. */
export const MOON_LEAST = 8;

function drawMoon(g: Ctx, L: Lens, look: Look, day: number): void {
  const m = moonAt(day), [x, y] = onPage(m), R = moonRadius(L), px = L.u;
  if (!onScreen(L, x, y, R)) return;
  const disc = ringPath(x, y, R), toSun = sunAngle(day), toEarth = Math.atan2(C[1] - y, C[0] - x);
  g.fillStyle = look.moon;
  g.fill(disc);
  g.save();
  g.clip(disc);
  if (R / px > 9) {
    // the seas of the near side, always turned to the Earth: the Moon keeps one face towards us
    g.fillStyle = look.mare;
    for (const [lat, lon, size] of MARIA) {
      const a = toEarth - lon * RAD, d = R * Math.cos(lat * RAD), s = R * Math.sin(size * RAD);
      g.beginPath();
      g.ellipse(x + Math.cos(a) * d, y + Math.sin(a) * d, s * Math.max(0.35, Math.sin(lat * RAD + 0.4)), s, a, 0, TAU);
      g.fill();
    }
  }
  g.translate(x, y);
  g.rotate(toSun);
  const grad = g.createLinearGradient(-R, 0, R, 0);
  grad.addColorStop(0, rgba(look.night, look.nightAlpha));
  grad.addColorStop(0.46, rgba(look.night, look.nightAlpha));
  grad.addColorStop(0.54, rgba(look.night, 0));
  grad.addColorStop(1, rgba(look.night, 0));
  g.fillStyle = grad;
  g.fillRect(-R, -R, 2 * R, 2 * R);
  g.restore();
  inHand(g, L, look, disc, { color: look.line, w: look.width * 0.7, alpha: 0.85 });
}

/** The Moon's path behind it over the trail's span (at most one lap), fading. */
function drawMoonTrail(g: Ctx, L: Lens, look: Look, day: number, span: number, alpha: number): void {
  if (span <= 0 || alpha <= 0) return;
  const back = Math.min(span, MOON_MONTH * 0.98), n = Math.max(8, Math.round((back / MOON_MONTH) * 160)), pieces = 12;
  for (let j = 0; j < pieces; j++) {
    const p = new Path2D();
    for (let k = 0; k <= n / pieces + 1; k++) {
      const s = Math.min(n, (j * n) / pieces + k), [x, y] = onPage(moonAt(day - (s / n) * back));
      if (k) p.lineTo(x, y);
      else p.moveTo(x, y);
    }
    inHand(g, L, look, p, { color: look.trail, w: look.width * 1.4, alpha: alpha * 0.8 * (1 - j / pieces) ** 1.3 });
  }
}

/* ---------- stations and crowds ---------- */

/** Whether low orbit has room on screen at `u` design units per logical unit: a station flies clear of the ground. */
export const leoShows = (u: number): boolean => units(400) / u > 5;

/** A small glyph for a station, a telescope or a satellite at (x, y), lined up with its motion `dir`. */
function glyph(g: Ctx, L: Lens, look: Look, t: Tracked, x: number, y: number, dir: number): void {
  const px = L.u;
  g.save();
  g.translate(x, y);
  g.rotate(dir);
  g.scale(px * 1.3, px * 1.3);
  g.lineJoin = 'round';
  g.fillStyle = look.accent;
  g.strokeStyle = look.paper;
  g.lineWidth = 1.4;
  if (t.kind === 'station') {
    // a truss across the motion with a wing of panels at each end
    g.beginPath();
    g.rect(-1, -6.5, 2, 13);
    g.rect(-3.2, -9.5, 6.4, 3.4);
    g.rect(-3.2, 6.1, 6.4, 3.4);
    g.rect(-2.2, -2.2, 4.4, 4.4);
    g.stroke();
    g.fill();
  } else if (t.kind === 'telescope') {
    g.beginPath();
    g.rect(-5, -2.2, 10, 4.4);
    g.rect(-1.5, -6.5, 3, 13);
    g.stroke();
    g.fill();
  } else {
    g.beginPath();
    g.arc(0, 0, 2.6, 0, TAU);
    g.moveTo(0, 0);
    for (const a of [0.5, 1.6, 2.6, 3.7]) {
      g.moveTo(0, 0);
      g.lineTo(Math.cos(a) * 6, Math.sin(a) * 6);
    }
    g.stroke();
    g.strokeStyle = look.accent;
    g.lineWidth = 0.9;
    g.stroke();
    g.fill();
  }
  g.restore();
}

interface Placed {
  t: Tracked;
  at: V3;
  x: number;
  y: number;
}

/** The stations in orbit on `day`, where they are. */
export function stationsOn(day: number): Placed[] {
  const out: Placed[] = [];
  for (const t of TRACKED) {
    if (!flying(t, day)) continue;
    const at = orbitAt(t.orbit, day), [x, y] = onPage(at);
    out.push({ t, at, x, y });
  }
  return out;
}

/** Degrees a body on `o` moves between drawings. */
const sweepDeg = (o: Orbit, step: number): number => (360 * Math.abs(step)) / shape(o).period;

/** The crowds on `day`: every member's place (km, ecliptic), with its crowd (Starlink only when `leo` has room to show it). */
export function crowdsOn(day: number, leo = true): { kind: 'gps' | 'geo' | 'starlink'; at: V3 }[] {
  const out: { kind: 'gps' | 'geo' | 'starlink'; at: V3 }[] = [];
  const nGeo = censusAt(GEO_COUNT, day);
  for (let k = 0; k < nGeo; k++) out.push({ kind: 'geo', at: onEarth(0, SLOTS.geo[k]!, day, EARTH_EQ + GEO_ALT) });
  const nGps = censusAt(GPS_COUNT, day), perPlane = Math.max(1, Math.ceil(nGps / 6));
  for (let k = 0; k < nGps; k++) {
    const plane = k % 6, slot = Math.floor(k / 6);
    out.push({ kind: 'gps', at: orbitAt({ peri: GPS_ALT, apo: GPS_ALT, inc: 55, node: plane * 60, m0: (slot * 360) / perPlane + plane * 17, epoch: 0 }, day) });
  }
  const nStar = leo ? Math.round(censusAt(STARLINK_COUNT, day) / STARLINK_PER_DOT) : 0;
  for (let k = 0; k < nStar; k++) {
    const s = SLOTS.starlink[k]!;
    out.push({ kind: 'starlink', at: orbitAt({ peri: STARLINK_SHELL.alt, apo: STARLINK_SHELL.alt, inc: STARLINK_SHELL.inc, node: s.node, m0: s.phase, epoch: 0 }, day) });
  }
  return out;
}

type Crowd = ReturnType<typeof crowdsOn>;

function drawCrowds(g: Ctx, L: Lens, look: Look, crowds: Crowd, side: 'back' | 'front'): void {
  const px = L.u, leo = leoShows(L.u);
  // the first few geostationary satellites are drawn larger: one lone dot must still be found
  const lone = crowds.reduce((n, c) => n + (c.kind === 'geo' ? 1 : 0), 0) < 12 ? 2 : 1;
  for (const c of crowds) {
    if (c.kind === 'starlink' && !leo) continue;
    const behind = c.at[2] < 0;
    if ((side === 'back') !== behind || hiddenByEarth(c.at)) continue;
    const [x, y] = onPage(c.at);
    if (!onScreen(L, x, y, 0, 4)) continue;
    g.fillStyle = c.kind === 'geo' ? look.accent : c.kind === 'gps' ? look.accent2 : look.line;
    g.globalAlpha = c.kind === 'starlink' ? 0.7 : 1;
    g.beginPath();
    g.arc(x, y, (c.kind === 'starlink' ? 0.9 : c.kind === 'geo' ? 1.5 * lone : 1.5) * px, 0, TAU);
    g.fill();
  }
  g.globalAlpha = 1;
}

function drawStations(g: Ctx, L: Lens, look: Look, day: number, step: number, trailAlpha: number, side: 'back' | 'front'): void {
  if (!leoShows(L.u)) return;
  for (const s of stationsOn(day)) {
    const [back, front] = spacePaths(orbitPath(s.t.orbit, day, 160));
    inHand(g, L, look, side === 'back' ? back : front, { color: look.accent, w: look.width * 0.55, alpha: 0.35 + 0.4 * trailAlpha });
    const sweep = sweepDeg(s.t.orbit, step);
    if (sweep > 40) {
      // too fast to see between drawings: a streak along the orbit, as a long exposure would show it
      const n = 24, pts: V3[] = [];
      for (let k = 0; k <= n; k++) pts.push(orbitAt(s.t.orbit, day - (Math.min(sweep, 330) / 360) * shape(s.t.orbit).period * (k / n)));
      const [b, f] = spacePaths(pts);
      inHand(g, L, look, side === 'back' ? b : f, { color: look.accent, w: look.width * 1.6, alpha: 0.8 });
      continue;
    }
    if ((side === 'back') !== (s.at[2] < 0) || hiddenByEarth(s.at)) continue;
    const ahead = onPage(orbitAt(s.t.orbit, day + shape(s.t.orbit).period / 90));
    glyph(g, L, look, s.t, s.x, s.y, Math.atan2(ahead[1] - s.y, ahead[0] - s.x));
  }
}

/* ---------- the scene ---------- */

/** The moment drawn: the sky's, or for a render (which carries none) the still of `DEMO_DAY`. */
const momentOf = (f: SceneFrame): number => (f as LensFrame).sky?.now ?? DEMO_DAY;

export function cislunarScene(look: Look): Scene {
  return {
    name: `cislunar-${look.key}`,
    duration: 48,
    loopFrom: 0,
    draw(f) {
      const { stage } = f, L = lensOf(f), day = momentOf(f), lf = f as LensFrame, trails = lf.sky?.trails;
      const step = lf.step ?? 0, trailAlpha = trails ? trails.alpha : 0.6;
      ground(f, look.paper, look.ground);
      const still = lensLayer(f, `static:${look.key}`, L, g => {
        drawStatic(g, L, look);
        if (look.tooth) knockOut(f, g, toothMask(f, look.tooth), look.tooth.alpha);
      });
      composite(f, still, look.hand === 'print' ? { blend: 'multiply' } : {});
      const live = scratch(f, `cislunar-live:${look.key}`, gf => {
        const g = gf.ctx;
        enterLens(g, L);
        if (trails) drawMoonTrail(g, L, look, day, trails.span * trails.reveal, trails.alpha);
        else drawMoonTrail(g, L, look, day, 6, 0.6);
        const crowds = crowdsOn(day, leoShows(L.u));
        drawCrowds(g, L, look, crowds, 'back');
        drawStations(g, L, look, day, step, trailAlpha, 'back');
        drawEarth(g, L, look, day);
        drawCrowds(g, L, look, crowds, 'front');
        drawStations(g, L, look, day, step, trailAlpha, 'front');
        drawMoon(g, L, look, day);
        g.setTransform(1, 0, 0, 1, 0, 0);
        if (look.tooth) knockOut(f, g, toothMask(f, look.tooth), look.tooth.alpha * 0.6);
      });
      if (look.bloom) {
        const qw = Math.round(stage.outW / 4), qh = Math.round(stage.outH / 4), bloom = stage.layer(`cislunar-bloom:${look.key}`, qw, qh), bc = stage.context(bloom);
        bc.setTransform(1, 0, 0, 1, 0, 0);
        bc.clearRect(0, 0, qw, qh);
        bc.filter = `blur(${((7 * stage.scale) / 4).toFixed(2)}px)`;
        bc.drawImage(live, 0, 0, qw, qh);
        bc.filter = 'none';
        f.ctx.save();
        f.ctx.setTransform(1, 0, 0, 1, 0, 0);
        f.ctx.globalCompositeOperation = 'screen';
        f.ctx.drawImage(bloom, 0, 0, stage.outW, stage.outH);
        f.ctx.restore();
      }
      composite(f, live);
      if (look.misregister) composite(f, live, { blend: 'multiply', alpha: 0.35, offset: look.misregister });
    },
  };
}

