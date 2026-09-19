/**
 * Beyond Neptune, on the From above plan: Pluto on its tilted, stretched orbit and a hint of the Kuiper belt, the
 * ring of icy leftovers it belongs to.
 *
 * - Pluto: JPL's mean orbital elements (the same ephemeris as the planets), its distance measured in the planets'
 *   plane and placed on the plan's compressed scale (`planPoint`) like the comets and the spacecraft, so it sits just
 *   outside Neptune's orbit today and dipped inside it around its perihelion (1979 to 1999).
 * - The Kuiper belt: a scatter of a few hundred bodies drawn from seeds (never `Math.random`), in the belt's two
 *   main families: the plutinos, held in step with Neptune (three laps of Neptune to two of theirs) near 39 au, and
 *   the classical belt between ~42 and ~48 au on nearly round orbits. Each circles at the pace its distance gives it
 *   (Kepler's third law), so the belt shears ever so slowly as the years run.
 */
import type { Vec2 } from '../core/math';
import { hashSeed, rng } from '../core/random';
import { C } from '../scenes/solar/common';
import { heliocentric } from '../scenes/solar/ephemeris';
import type { App } from './app';
import type { Mark } from './bodies';
import { planPoint, planRadius, type Polar } from './orbits';
import { rgba } from './overlays';

export type DwarfId = 'pluto' | 'kuiper';
export const DWARF_IDS: readonly DwarfId[] = ['pluto', 'kuiper'];

const TAU = Math.PI * 2;
/** Pluto's sidereal period, days (NASA's Pluto fact sheet: 247.94 years). */
export const PLUTO_PERIOD = 247.94 * 365.25;
/** Pluto's drawn radius on the plan, design units (a little under Mercury's: it is two thirds its size). */
const PLUTO_R = 3.6;
/** Where the Kuiper belt is named and picked: its classical core, au. */
export const KUIPER_AU = 44;

/** Pluto's place on a date: its distance in the planets' plane (au) and its heliocentric longitude. */
export function plutoAt(day: number): Polar {
  const h = heliocentric('pluto', day);
  return { r: h.r * Math.cos(h.lat), lon: h.lon };
}

/** Where Pluto is drawn on the plan, design units. */
export const plutoOnPlan = (day: number): Vec2 => planPoint(plutoAt(day));

/** Pluto's orbit on the plan, one lap from the century the date falls in (its elements drift only slowly). */
const orbits = new Map<number, Vec2[]>();
export function plutoOrbit(day: number): Vec2[] {
  const key = Math.round(day / 36525);
  let pts = orbits.get(key);
  if (pts) return pts;
  pts = [];
  const from = key * 36525, n = 360;
  for (let i = 0; i <= n; i++) pts.push(plutoOnPlan(from + (PLUTO_PERIOD * i) / n));
  if (orbits.size > 8) orbits.clear();
  orbits.set(key, pts);
  return pts;
}

interface Kbo {
  /** Semi-major axis (au), eccentricity, longitude at J2000 and of perihelion (radians), and mean motion (radians a day). */
  a: number;
  e: number;
  lon0: number;
  peri: number;
  n: number;
  /** Dot size (screen pixels: the belt reads as a haze of specks at any zoom), and which ink strength it is drawn in. */
  size: number;
  tone: number;
}

/** The ink strengths the belt's dots are drawn in: each is one path, filled once. */
const TONES = [0.3, 0.45, 0.62] as const;
/** The belt's haze spans these distances, au. */
const HAZE: readonly [number, number] = [36, 50];

/** The belt's bodies: the plutinos near 39.4 au, the classical belt from ~42 to ~48 au, and a few scattered wider. */
const KUIPER: readonly Kbo[] = (() => {
  const r = rng(hashSeed(90377, 3)), out: Kbo[] = [];
  const add = (a: number, e: number): void => {
    out.push({ a, e, lon0: r() * TAU, peri: r() * TAU, n: TAU / (365.25 * Math.pow(a, 1.5)), size: 0.7 + r() * r() * 1.1, tone: Math.floor(r() * TONES.length) });
  };
  for (let i = 0; i < 160; i++) add(39.2 + r() * 0.5, 0.08 + r() * 0.2);
  for (let i = 0; i < 460; i++) add(42 + r() * 5.5, r() * 0.08);
  for (let i = 0; i < 80; i++) add(34 + r() * 22, 0.05 + r() * 0.25);
  return out;
})();

/** A Kuiper-belt body's place on a date: a Kepler orbit, its mean anomaly advanced at its own pace. */
function kboAt(k: Kbo, day: number): Polar {
  const M = k.lon0 - k.peri + k.n * day;
  // to first order in e, which is all a dot on a squeezed plan can show
  const lon = k.peri + M + 2 * k.e * Math.sin(M);
  return { r: k.a * (1 - k.e * Math.cos(M)), lon };
}

/**
 * Where the belt's bodies are drawn (design units, x and y in turn), worked out afresh only every `BELT_DAYS`: the
 * quickest of them moves a twentieth of a design unit a day, far less than a pixel between drawings.
 */
const BELT_DAYS = 2;
let beltAt = { key: NaN, xy: new Float64Array(0) };
function beltPlaces(day: number): Float64Array {
  const key = Math.round(day / BELT_DAYS);
  if (key !== beltAt.key) {
    const xy = new Float64Array(KUIPER.length * 2);
    KUIPER.forEach((b, i) => {
      const [x, y] = planPoint(kboAt(b, key * BELT_DAYS));
      xy[2 * i] = x;
      xy[2 * i + 1] = y;
    });
    beltAt = { key, xy };
  }
  return beltAt.xy;
}

/** Pluto (where the plan shows it) and the belt, as a ring along its core, for picking and naming. */
export function dwarfMarks(day: number): Mark[] {
  const [x, y] = plutoOnPlan(day);
  return [
    { id: 'pluto', x, y, r: PLUTO_R, reach: PLUTO_R + 2 },
    { id: 'kuiper', x: C[0], y: C[1], r: 0, reach: 0, ring: planRadius(KUIPER_AU) },
  ];
}

/**
 * The belt as a haze of dots in the style's ink, Pluto's orbit as a fine dashed line (a dwarf planet's, not a
 * planet's hand-drawn ring), and Pluto itself: a small disc of ink ringed in the paper, like the comets' heads.
 * `selected` strengthens the orbit while Pluto's card is open.
 */
export function drawDwarfs(ctx: CanvasRenderingContext2D, app: App, selected: boolean): void {
  const day = app.sim.day, k = 1 / app.renderer.designScale, [paper, ink] = app.style.swatch;
  ctx.save();
  // a faint haze marks out the belt's span, fading at its edges, so its dots read as a belt rather than as stars
  const [r0, r1] = HAZE.map(planRadius) as [number, number], haze = ctx.createRadialGradient(C[0], C[1], r0, C[0], C[1], r1);
  haze.addColorStop(0, rgba(ink, 0));
  haze.addColorStop(0.35, rgba(ink, 0.06));
  haze.addColorStop(0.7, rgba(ink, 0.06));
  haze.addColorStop(1, rgba(ink, 0));
  ctx.fillStyle = haze;
  ctx.beginPath();
  ctx.arc(C[0], C[1], r1, 0, TAU);
  ctx.arc(C[0], C[1], r0, TAU, 0, true);
  ctx.fill();
  // specks a pixel or two across: squares, as the paper's own stars are, and far cheaper to draw than discs
  const xy = beltPlaces(day);
  TONES.forEach((tone, t) => {
    ctx.fillStyle = rgba(ink, tone);
    KUIPER.forEach((b, i) => {
      if (b.tone !== t) return;
      const s = b.size * k;
      ctx.fillRect(xy[2 * i]! - s, xy[2 * i + 1]! - s, 2 * s, 2 * s);
    });
  });
  const orbit = plutoOrbit(day);
  ctx.lineCap = 'round';
  ctx.setLineDash([3 * k, 5 * k]);
  ctx.lineWidth = (selected ? 1.5 : 1) * k;
  ctx.strokeStyle = rgba(ink, selected ? 0.8 : 0.42);
  ctx.beginPath();
  orbit.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.stroke();
  ctx.setLineDash([]);
  const [px, py] = plutoOnPlan(day), r = Math.max(PLUTO_R, 2.6 * k);
  ctx.fillStyle = ink;
  ctx.beginPath();
  ctx.arc(px, py, r, 0, TAU);
  ctx.fill();
  ctx.lineWidth = 1.2 * k;
  ctx.strokeStyle = rgba(paper, 0.9);
  ctx.stroke();
  ctx.restore();
}
