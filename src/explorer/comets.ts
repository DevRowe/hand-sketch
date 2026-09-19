/**
 * Comets and interstellar visitors on the plan: Halley's Comet on its long ellipse and 3I/ATLAS, the third object
 * seen passing through from another star, on its open hyperbola. Both are drawn in the From above view, where their
 * paths make Kepler's second law plain: a comet creeps along the far end of its orbit and whips round the Sun.
 *
 * - Shapes and orientations: osculating elements from JPL's Small-Body Database (J2000 ecliptic), solved on Kepler's
 *   equation (the elliptic form for Halley, the hyperbolic one for 3I/ATLAS).
 * - Timing: Halley's orbit is stretched and shrunk by the planets' pulls, so a single set of elements drifts by years
 *   over a few returns. Each lap is instead timed between two real perihelion dates (Yeomans and Kiang's table, as JPL
 *   and NASA quote it), so the comet rounds the Sun on the right day of every return from 1531 to 2134; beyond those it
 *   runs on at the mean period, approximately.
 *
 * Distances are placed on the plan's compressed scale like the spacecraft's (`planPoint`), so a comet at Jupiter's
 * distance crosses Jupiter's orbit.
 */
import type { Vec2 } from '../core/math';
import { C } from '../scenes/solar/common';
import { dayOf } from '../scenes/solar/ephemeris';
import type { App } from './app';
import type { Mark } from './bodies';
import { dateLabel } from './format';
import { planPoint } from './orbits';
import { drawMark, GOLD, haloStroke, polyline, rgba, text } from './overlays';
import type { Preset } from './presets';

export type CometId = 'halley' | 'atlas';

const RAD = Math.PI / 180;
/** The Gaussian gravitational constant: the Sun's pull, in radians a day for an orbit of 1 au. */
const GAUSS_K = 0.01720209895;
const AU_KM = 149_597_870.7;

const utcDay = (y: number, m: number, d: number, h = 0): number => dayOf(Date.UTC(y, m - 1, d, h));

interface Elements {
  /** Perihelion distance, au. */
  q: number;
  e: number;
  /** Inclination, longitude of the ascending node and argument of perihelion, degrees (J2000 ecliptic). */
  i: number;
  node: number;
  peri: number;
}

export interface Comet {
  id: CometId;
  elements: Elements;
  /** Perihelion passages, days from J2000.0, in order: one for a visitor, the real returns for Halley. */
  perihelia: readonly number[];
  /** The mean time between returns (days), for dates past the table's ends; none for a visitor that never returns. */
  period?: number;
  /** Farthest from the Sun it is drawn, au: past this it has left the plan. */
  reach: number;
  /** Days between the ticks along its path: equal times, so their spacing is its speed. */
  tick: number;
}

/** Halley's perihelion dates (UT, rounded to the day): the returns observed from Apian's in 1531 to the next two. */
const HALLEY_PERIHELIA = [
  utcDay(1531, 8, 26), utcDay(1607, 10, 27), utcDay(1682, 9, 15), utcDay(1759, 3, 13), utcDay(1835, 11, 16),
  utcDay(1910, 4, 20), utcDay(1986, 2, 9, 11), utcDay(2061, 7, 28), utcDay(2134, 3, 27),
];

export const COMETS: Readonly<Record<CometId, Comet>> = {
  // 1P/Halley, JPL SBDB (epoch 1994 February 17): q 0.586 au, e 0.967, retrograde at 162 degrees
  halley: {
    id: 'halley',
    elements: { q: 0.5859781, e: 0.9671429, i: 162.26269, node: 58.42008, peri: 111.33249 },
    perihelia: HALLEY_PERIHELIA,
    period: (HALLEY_PERIHELIA[HALLEY_PERIHELIA.length - 1]! - HALLEY_PERIHELIA[0]!) / (HALLEY_PERIHELIA.length - 1),
    reach: 40,
    tick: 365.25,
  },
  // 3I/ATLAS (C/2025 N1), JPL SBDB: perihelion 29 October 2025 at 1.356 au, e 6.14, retrograde at 175 degrees
  atlas: {
    id: 'atlas',
    elements: { q: 1.356434, e: 6.139565, i: 175.11306, node: 322.15681, peri: 128.01049 },
    perihelia: [utcDay(2025, 10, 29, 11)],
    reach: 36,
    tick: 30.4375,
  },
};

export const COMET_IDS: readonly CometId[] = ['halley', 'atlas'];

/** Eccentric anomaly of an ellipse (e < 1) for mean anomaly `M` in [-pi, pi]: Newton's method from Danby's start, safe as e nears 1. */
export function ellipticAnomaly(M: number, e: number): number {
  let E = M + Math.sign(Math.sin(M)) * 0.85 * e;
  for (let k = 0; k < 50; k++) {
    const f = E - e * Math.sin(E) - M, dE = f / (1 - e * Math.cos(E));
    E -= dE;
    if (Math.abs(dE) < 1e-12) break;
  }
  return E;
}

/** Hyperbolic anomaly of a hyperbola (e > 1) for mean anomaly `M`: Newton's method on e sinh H - H = M. */
export function hyperbolicAnomaly(M: number, e: number): number {
  let H = Math.sign(M) * Math.log((2 * Math.abs(M)) / e + 1.8);
  for (let k = 0; k < 60; k++) {
    const f = e * Math.sinh(H) - H - M, dH = f / (e * Math.cosh(H) - 1);
    H -= dH;
    if (Math.abs(dH) < 1e-12) break;
  }
  return H;
}

export interface CometPlace {
  /** Heliocentric ecliptic position, au (J2000). */
  xyz: readonly [number, number, number];
  /** Distance from the Sun, au. */
  r: number;
  /** Heliocentric ecliptic longitude, radians in [0, 2 pi). */
  lon: number;
  /** Speed round the Sun, km/s. */
  speed: number;
}

/** Where the lap containing `day` starts and how long it lasts, for a comet that returns. */
function lapOf(c: Comet, day: number): { tp: number; P: number } {
  const t = c.perihelia, P = c.period!;
  if (day < t[0]!) {
    const n = Math.ceil((t[0]! - day) / P);
    return { tp: t[0]! - n * P, P };
  }
  const last = t[t.length - 1]!;
  if (day >= last) {
    const n = Math.floor((day - last) / P);
    return { tp: last + n * P, P };
  }
  let i = 0;
  while (t[i + 1]! <= day) i++;
  return { tp: t[i]!, P: t[i + 1]! - t[i]! };
}

/** A comet's place on a date (days from J2000.0). */
export function cometAt(c: Comet, day: number): CometPlace {
  const { q, e } = c.elements;
  let xp: number, yp: number, r: number, a: number;
  if (e < 1) {
    // an ellipse: the lap is timed between real perihelia, and the mean anomaly shared out evenly across it
    const { tp, P } = lapOf(c, day);
    a = q / (1 - e);
    let M = (2 * Math.PI * (day - tp)) / P;
    if (M > Math.PI) M -= 2 * Math.PI;
    const E = ellipticAnomaly(M, e);
    xp = a * (Math.cos(E) - e);
    yp = a * Math.sqrt(1 - e * e) * Math.sin(E);
    r = a * (1 - e * Math.cos(E));
  } else {
    a = q / (1 - e);
    const n = GAUSS_K / Math.pow(-a, 1.5), H = hyperbolicAnomaly(n * (day - c.perihelia[0]!), e);
    xp = -a * (e - Math.cosh(H));
    yp = -a * Math.sqrt(e * e - 1) * Math.sinh(H);
    r = -a * (e * Math.cosh(H) - 1);
  }
  const w = c.elements.peri * RAD, O = c.elements.node * RAD, I = c.elements.i * RAD;
  const cw = Math.cos(w), sw = Math.sin(w), cO = Math.cos(O), sO = Math.sin(O), cI = Math.cos(I), sI = Math.sin(I);
  const x = (cw * cO - sw * sO * cI) * xp + (-sw * cO - cw * sO * cI) * yp;
  const y = (cw * sO + sw * cO * cI) * xp + (-sw * sO + cw * cO * cI) * yp;
  const z = sw * sI * xp + cw * sI * yp;
  // vis-viva: v^2 = GM (2/r - 1/a), with GM = k^2 au^3/day^2
  const v = GAUSS_K * Math.sqrt(2 / r - 1 / a) * (AU_KM / 86_400);
  return { xyz: [x, y, z], r, lon: ((Math.atan2(y, x) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI), speed: v };
}

/** Where a comet is drawn on the plan (design units), or null while it is farther out than the plan reaches. */
export function cometOnPlan(c: Comet, day: number): Vec2 | null {
  const p = cometAt(c, day);
  return p.r > c.reach ? null : planPoint({ r: p.r, lon: p.lon });
}

/** A comet's path on the plan: one lap for Halley (perihelion to perihelion), the whole pass for a visitor. */
export interface CometPath {
  /** Points along it with their dates, in order. */
  points: { at: Vec2; day: number }[];
  /** Equal-time ticks along it: their spacing is the comet's speed. */
  ticks: Vec2[];
  /** The perihelia at the lap's ends (or the visitor's one). */
  perihelia: number[];
}

const paths = new Map<string, CometPath>();

/** The path round `day`, as far out as the plan reaches (cached per lap). */
export function cometPath(c: Comet, day: number): CometPath {
  const lap = c.period ? lapOf(c, day) : null, from = lap ? lap.tp : c.perihelia[0]! - 3000, to = lap ? lap.tp + lap.P : c.perihelia[0]! + 3000;
  const key = `${c.id}:${Math.round(from)}`;
  let path = paths.get(key);
  if (path) return path;
  const points: CometPath['points'] = [];
  // step so the points fall a couple of design units apart: a comet near the Sun covers in hours what takes it years
  // at the far end of its orbit
  for (let d = from; d <= to;) {
    const p = cometOnPlan(c, d);
    const q = cometOnPlan(c, d + 0.25), perDay = p && q ? Math.hypot(q[0] - p[0], q[1] - p[1]) * 4 : 0;
    if (p) points.push({ at: p, day: d });
    d += Math.min(120, Math.max(1 / 24, perDay > 0 ? 2.5 / perDay : 30));
  }
  const end = cometOnPlan(c, to);
  if (end) points.push({ at: end, day: to });
  const ticks: Vec2[] = [];
  for (let t = from + c.tick; t < to; t += c.tick) {
    const p = cometOnPlan(c, t);
    if (p) ticks.push(p);
  }
  path = { points, ticks, perihelia: lap ? [from, to] : [c.perihelia[0]!] };
  if (paths.size > 16) paths.clear();
  paths.set(key, path);
  return path;
}

/** How long a comet's tail is drawn (design units) at `r` au from the Sun: none past ~5 au, where its ices stay frozen. */
export function tailLength(r: number): number {
  if (r >= 5) return 0;
  const grow = Math.min(1, (5 - r) / 2.5);
  return Math.min(72, 34 / Math.pow(Math.max(r, 0.4), 1.3)) * grow;
}

/* ---------- on the plan ---------- */

/** Where each comet is drawn on `day`, for picking and naming (none while beyond the plan). */
export function cometMarks(day: number): Mark[] {
  return COMET_IDS.flatMap(id => {
    const p = cometOnPlan(COMETS[id], day);
    return p ? [{ id, x: p[0], y: p[1], r: 3.5, reach: 6 }] : [];
  });
}

/**
 * The comets on the plan, in the style's own ink: a bright head, and near the Sun two tails pointing away from it (a
 * straight gas tail, and a broader dust tail curving back along the path). Where `pathOf` asks, the path too: flown
 * solid, ahead dashed, with a dot every tick of time and the perihelion marked.
 */
export function drawComets(ctx: CanvasRenderingContext2D, app: App, withPath: (id: CometId) => boolean): void {
  const day = app.sim.day, k = 1 / app.renderer.designScale, [paper, ink, accent] = app.style.swatch;
  for (const id of COMET_IDS) {
    const c = COMETS[id];
    if (withPath(id)) drawCometPath(ctx, app, c);
    const place = cometAt(c, day);
    if (place.r > c.reach) continue;
    const P = planPoint({ r: place.r, lon: place.lon }), dx = P[0] - C[0], dy = P[1] - C[1], dl = Math.hypot(dx, dy) || 1;
    const t: Vec2 = [dx / dl, dy / dl], L = tailLength(place.r);
    ctx.save();
    if (L > 0) {
      // the way it is heading, on the plan: the dust tail lags behind it
      const a = cometOnPlan(c, day - 1) ?? P, b = cometOnPlan(c, day + 1) ?? P, vl = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      const v: Vec2 = [(b[0] - a[0]) / vl, (b[1] - a[1]) / vl];
      const dustEnd: Vec2 = [P[0] + t[0] * L * 0.9 - v[0] * L * 0.45, P[1] + t[1] * L * 0.9 - v[1] * L * 0.45];
      const dustMid: Vec2 = [P[0] + t[0] * L * 0.55 - v[0] * L * 0.08, P[1] + t[1] * L * 0.55 - v[1] * L * 0.08];
      const g = ctx.createLinearGradient(P[0], P[1], dustEnd[0], dustEnd[1]);
      g.addColorStop(0, rgba(accent, 0.75));
      g.addColorStop(1, rgba(accent, 0));
      ctx.strokeStyle = g;
      ctx.lineCap = 'round';
      // the dust tail: a fan of strands spreading as it goes
      for (const s of [-1, -0.5, 0, 0.5, 1]) {
        const n: Vec2 = [-t[1] * s * L * 0.12, t[0] * s * L * 0.12];
        ctx.lineWidth = (2.2 - Math.abs(s)) * k;
        ctx.beginPath();
        ctx.moveTo(P[0], P[1]);
        ctx.quadraticCurveTo(dustMid[0] + n[0] * 0.5, dustMid[1] + n[1] * 0.5, dustEnd[0] + n[0], dustEnd[1] + n[1]);
        ctx.stroke();
      }
      // the gas tail: straight away from the Sun, narrow and long
      const gasEnd: Vec2 = [P[0] + t[0] * L * 1.25, P[1] + t[1] * L * 1.25], w = 2.2 * k;
      const h = ctx.createLinearGradient(P[0], P[1], gasEnd[0], gasEnd[1]);
      h.addColorStop(0, rgba(ink, 0.85));
      h.addColorStop(1, rgba(ink, 0));
      ctx.fillStyle = h;
      ctx.beginPath();
      ctx.moveTo(P[0] - t[1] * w, P[1] + t[0] * w);
      ctx.lineTo(gasEnd[0], gasEnd[1]);
      ctx.lineTo(P[0] + t[1] * w, P[1] - t[0] * w);
      ctx.closePath();
      ctx.fill();
    }
    // the head: a soft coma round a bright point, ringed in the paper so it stands off whatever it crosses
    const coma = (L > 0 ? 7 : 4.5) * k, glow = ctx.createRadialGradient(P[0], P[1], 0, P[0], P[1], coma);
    glow.addColorStop(0, rgba(ink, 0.7));
    glow.addColorStop(1, rgba(ink, 0));
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(P[0], P[1], coma, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(P[0], P[1], 2.3 * k, 0, Math.PI * 2);
    ctx.fillStyle = ink;
    ctx.fill();
    ctx.lineWidth = 1 * k;
    ctx.strokeStyle = rgba(paper, 0.9);
    ctx.stroke();
    ctx.restore();
  }
}

/** A comet's path: flown solid, ahead dashed, a dot every tick, and its perihelion (the one nearest the date) marked. */
export function drawCometPath(ctx: CanvasRenderingContext2D, app: App, c: Comet): void {
  const day = app.sim.day, path = cometPath(c, day), k = 1 / app.renderer.designScale;
  const flown = path.points.filter(p => p.day <= day).map(p => p.at), ahead = path.points.filter(p => p.day >= day).map(p => p.at);
  const here = cometOnPlan(c, day);
  if (here && flown.length) flown.push(here);
  if (here && ahead.length) ahead.unshift(here);
  ctx.save();
  if (ahead.length > 1) {
    ctx.globalAlpha *= 0.75;
    haloStroke(ctx, k, 1.1, () => polyline(ctx, ahead), GOLD, [5, 6]);
    ctx.globalAlpha /= 0.75;
  }
  if (flown.length > 1) haloStroke(ctx, k, 1.5, () => polyline(ctx, flown), GOLD);
  ctx.fillStyle = GOLD;
  for (const [x, y] of path.ticks) {
    ctx.beginPath();
    ctx.arc(x, y, 1.9 * k, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  const peri = path.perihelia.reduce((a, b) => (Math.abs(b - day) < Math.abs(a - day) ? b : a)), at = cometOnPlan(c, peri);
  if (at) {
    drawMark(ctx, app, at, '', day >= peri);
    // the caption stands away from the Sun, or, while the comet (and its name, on its right) is close by, away from it
    const [sx, sy] = app.renderer.toScreen(at[0], at[1]), hs = here ? app.renderer.toScreen(here[0], here[1]) : null;
    const vx = hs ? hs[0] - sx : 0, vy = hs ? hs[1] - sy : 0, vl = hs ? Math.hypot(vx, vy) : Infinity;
    const a = Math.atan2(at[1] - C[1], at[0] - C[0]);
    const [ux, uy] = vl < 10 ? [-1, 0] : vl < 150 ? [-vx / vl, -vy / vl] : [Math.cos(a), Math.sin(a)];
    const align: CanvasTextAlign = ux > 0.35 ? 'left' : ux < -0.35 ? 'right' : 'center';
    const x = at[0] + ux * 13 * k, y = at[1] + uy * 13 * k + (uy > 0.35 ? 12 : uy < -0.35 ? -18 : -3) * k;
    text(ctx, app, [x, y], `Closest to the Sun, ${dateLabel(peri, true)}`, align, 1, true);
    text(ctx, app, [x, y + 14 * k], c.tick > 300 ? 'dots a year apart' : 'dots a month apart', align, 0.85);
  }
}

/* ---------- moments ---------- */

const pathOverlay = (id: CometId, marks: readonly { day: number; label: string }[] = []) => (ctx: CanvasRenderingContext2D, app: App): void => {
  if (app.view !== 'sky') return;
  // the comets layer draws the path of whichever is selected: here it is drawn whatever is selected
  if (!app.layers.comets || app.selected !== id) drawCometPath(ctx, app, COMETS[id]);
  for (const m of marks) {
    const at = cometOnPlan(COMETS[id], m.day);
    if (at) drawMark(ctx, app, at, m.label, app.sim.day >= m.day);
  }
};

const GIOTTO = utcDay(1986, 3, 14);

export const COMET_PRESETS: readonly Preset[] = [
  {
    id: 'halley-1986',
    group: 'Comets',
    title: 'Halley’s last visit',
    kicker: 'Round the Sun in 1986, met by five spacecraft.',
    day: () => COMETS.halley.perihelia[6]!,
    view: 'sky',
    frame: { fit: 250 },
    select: 'halley',
    overlay: pathOverlay('halley', [{ day: GIOTTO, label: 'Giotto 1986' }]),
    journey: () => ({ from: utcDay(1985, 9, 1), to: utcDay(1986, 7, 1), pace: 22, label: 'Watch it round the Sun' }),
    card: () => ({
      when: '9 February 1986',
      intro: 'Every ~76 years Halley’s Comet falls in from beyond Neptune, whips round the Sun and heads back out. In 1986 it rounded the Sun on the far side from the Earth, one of its poorest showings on record, but the first time spacecraft flew out to meet a comet.',
      facts: [
        { label: 'Closest to the Sun', value: '0.59 au (~88 million km), 9 February 1986' },
        { label: 'Farthest', value: '~35 au, beyond Neptune (last in December 2023)' },
        { label: 'Speed', value: '~55 km/s near the Sun, under 1 km/s at the far end' },
        { label: 'One lap', value: '~76 years, going round the “wrong” way (retrograde), tilted 162°' },
        { label: 'Met by', value: 'ESA’s Giotto, 596 km from its nucleus on 14 March 1986, and the Vega 1 and 2, Suisei and Sakigake probes' },
        { label: 'Its nucleus', value: '~15 km long and ~8 km wide, one of the darkest things in the solar system' },
      ],
      body: [
        'The dots along its path are a year apart: bunched far out, where it crawls at under 1 km/s, and flung wide near the Sun, where it races at ~55 km/s. That is Kepler’s second law: the line from the Sun to a comet sweeps out equal areas in equal times.',
        'Its tails always point away from the Sun, pushed by sunlight and the solar wind, so on its way back out the comet travels tail first.',
        'The dust it leaves along its orbit gives us two meteor showers a year, the Eta Aquariids in May and the Orionids in October.',
      ],
    }),
  },
  {
    id: 'halley-2061',
    group: 'Comets',
    title: 'Halley’s Comet returns',
    kicker: 'Back round the Sun on 28 July 2061.',
    day: () => COMETS.halley.perihelia[7]!,
    view: 'sky',
    frame: { fit: 250 },
    select: 'halley',
    overlay: pathOverlay('halley'),
    journey: () => ({ from: utcDay(2023, 12, 9), to: utcDay(2062, 1, 1), pace: 2.7 * 365.25, label: 'The long fall back, from 2023' }),
    card: () => ({
      when: '28 July 2061',
      intro: 'Halley’s Comet turned round at the far end of its orbit, beyond Neptune, in December 2023, and is falling back towards the Sun. It rounds the Sun on 28 July 2061, this time on the same side as the Earth, so it should be a far finer sight than in 1986.',
      facts: [
        { label: 'Farthest from the Sun', value: '~35 au, December 2023' },
        { label: 'Back round the Sun', value: '28 July 2061' },
        { label: 'Expected brightness', value: '~-0.3, a bright naked-eye comet' },
        { label: 'The return after', value: '27 March 2134, passing ~0.09 au (~14 million km) from the Earth that May' },
      ],
      body: [
        'Play the long fall: for decades it barely moves, then in the last few years it plunges past Jupiter and whips round the Sun in weeks. The dots are a year apart.',
        'No two laps are quite the same length: the planets’ pulls, and the push of its own jets of gas, have stretched its recorded laps between ~74 and ~79 years. This view times every lap to the real (and predicted) returns.',
      ],
    }),
  },
  {
    id: 'atlas-2025',
    group: 'Comets',
    title: 'A visitor from another star',
    kicker: '3I/ATLAS passes through, never to return.',
    day: () => COMETS.atlas.perihelia[0]!,
    view: 'sky',
    frame: { fit: 320 },
    select: 'atlas',
    overlay: pathOverlay('atlas', [{ day: utcDay(2025, 7, 1), label: 'Found, 1 Jul 2025' }]),
    journey: () => ({ from: utcDay(2025, 6, 1), to: utcDay(2026, 5, 1), pace: 24, label: 'Watch it pass through' }),
    card: () => ({
      when: '29 October 2025',
      intro: 'On 1 July 2025 the ATLAS survey telescope in Chile spotted a comet moving too fast for the Sun to hold: only the third object ever seen coming from another star, after ʻOumuamua (2017) and Borisov (2019). It swung round the Sun and is heading back out to interstellar space, never to return.',
      facts: [
        { label: 'Closest to the Sun', value: '1.36 au (~203 million km), 29 October 2025, just inside Mars’s orbit' },
        { label: 'Speed', value: '~58 km/s far from the Sun, ~68 km/s at its closest' },
        { label: 'Past Mars', value: '~29 million km, 3 October 2025' },
        { label: 'Past the Earth', value: 'never closer than ~270 million km (1.8 au), 19 December 2025' },
        { label: 'Past Jupiter', value: '~54 million km, 16 March 2026' },
        { label: 'Its path', value: 'an open curve (a hyperbola, eccentricity ~6.1), within 5° of the planets’ plane but going round the other way' },
      ],
      body: [
        'Its path is not a loop but an open curve: it came in far faster than the Sun’s escape speed, so the Sun could only bend its course. The dots are a month apart, and stay almost evenly spaced: at ~60 km/s, the Sun’s pull barely changes its speed.',
        'It came in from the direction of Sagittarius and carries ice and dust made round another star. Spacecraft at Mars, among them NASA’s Mars Reconnaissance Orbiter and ESA’s Mars Express and ExoMars orbiters, photographed it as it passed.',
      ],
    }),
  },
];
