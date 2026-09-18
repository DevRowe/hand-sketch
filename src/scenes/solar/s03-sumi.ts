/**
 * S03 "Sumi" (the solar system from above; sumi-e ink). Soot ink on bone rice paper, brushed on: the Sun first, a
 * heavy black ensō round a vermilion wash, then each orbit as its own open ensō in paler and paler ink, the planets
 * dabbed onto them, a spatter of ink flicked into the belt, a column of writing and the seal. Then it runs.
 *
 * A planet is two touches of the brush: a dilute grey dab for the whole disc and a black one for the night half.
 */
import { catmullRom, ellipsePoints } from '../../core/geometry';
import { clamp, TAU, type Vec2 } from '../../core/math';
import { noise1 } from '../../core/random';
import type { Scene } from '../../core/scene';
import { drawStroke, prepareStroke, withPressure, type PreparedStroke, type StrokeStyle } from '../../core/stroke';
import { ground, ink, polyPath, still, wash } from '../gallery/common';
import { brushChar, C, enter, frameFit, LOOP, MOON, moonOffset, once, orbitClock, PLANETS, planetAt, POSTER_M, RINGS, ROCKS, rockAt, SUN_R, sunward, URANUS_RING, type Planet } from './common';
import { SOLAR } from './palettes';

const PAL = SOLAR.sumi;
const SOOT = PAL.ink, PAPER = PAL.paper, SEAL = PAL.accents[0]!;
/** The Sun is washed in the seal's vermilion, the painting's only other colour. */
const SUN_WASH = SEAL;
const [GREY, PALE] = PAL.fills as [string, string, string];

const BRUSH: StrokeStyle = { color: SOOT, size: 7, thinning: 0.45, smoothing: 0.6, streamline: 0.3, wobble: 1.8, wobbleWavelength: 380, tremor: 0.25, pressureVariation: 0.25, pressureWavelength: 300, dryBrush: 0.45, paper: PAPER, taperStart: 14, taperEnd: 60 };

/** Storyboard in drawn frames. */
const F = { sun: [0, 12], orbits: 8, every: 5, swing: 9, belt: [40, 50], text: [48, 60], seal: 60, start: 64 } as const;
const LOOP_FROM = F.start;

/** Where each ensō starts and how much of the circle it closes. */
const ENSO = PLANETS.map((_, k) => ({ start: 2.6 + k * 1.37, sweep: 0.9 + ((k * 0.37) % 0.08) }));

interface Layout {
  sun: PreparedStroke;
  orbits: PreparedStroke[];
  ring: PreparedStroke; uranusRing: PreparedStroke;
  bands: PreparedStroke[];
  text: PreparedStroke[];
  blots: Vec2[][];
}

/** A wet dab of ink: a disc whose edge wanders as the paper takes it. */
function blot(r: number, seed: number, n = 40): Vec2[] {
  return Array.from({ length: n }, (_, k): Vec2 => {
    const a = (k / n) * TAU, rr = r * (1 + 0.1 * noise1(k * 0.45, seed) + 0.04 * noise1(k * 1.7, seed + 1));
    return [Math.cos(a) * rr, Math.sin(a) * rr];
  });
}

/** Loaded at the start, running dry at the end: the pressure of a single ensō. */
const ensoPressure = (u: number): number => 1.35 - 0.75 * u + 0.25 * Math.exp(-(((u - 0.04) / 0.05) ** 2));

const layout = once((): Layout => {
  const sun = withPressure(prepareStroke(ellipsePoints(C[0], C[1], SUN_R + 8, SUN_R + 6, { start: -2.2, turns: 0.97, n: 90 }), { ...BRUSH, size: 17, dryBrush: 0.55, taperStart: 20, taperEnd: 90 }, 1301), ensoPressure);
  const orbits = PLANETS.map((p, k) => {
    const e = ENSO[k]!, far = k / (PLANETS.length - 1);
    return withPressure(prepareStroke(ellipsePoints(C[0], C[1], p.a, p.a * 0.995, { start: e.start, turns: e.sweep, n: Math.round(60 + p.a / 3) }), {
      // thin lines keep their dry-brush light: at this width a heavy breakup would tear whole stretches out
      ...BRUSH, color: far < 0.3 ? SOOT : far < 0.7 ? GREY : PALE, size: 5.4 - far * 1.8, dryBrush: 0.12 + far * 0.1, alpha: 0.95 - far * 0.2, wobble: 1.8 + far * 2.2,
    }, 1310 + k), ensoPressure);
  });
  const ring = prepareStroke(ellipsePoints(0, 0, (RINGS.inner + RINGS.outer) / 2, ((RINGS.inner + RINGS.outer) / 2) * RINGS.squash, { rotation: RINGS.angle, start: 2.8, turns: 1.08, n: 60 }), { ...BRUSH, size: 6.5, dryBrush: 0.6, taperStart: 10, taperEnd: 40 }, 1321);
  const uranusRing = prepareStroke(ellipsePoints(0, 0, URANUS_RING.rx, URANUS_RING.ry, { rotation: URANUS_RING.angle, start: 2.2, turns: 1.05, n: 36 }), { ...BRUSH, size: 2.4, dryBrush: 0.3, taperStart: 6, taperEnd: 14 }, 1322);
  const bands = [-12, -2, 9, 17].map((y, k) => prepareStroke([[-26, y + 2], [-8, y - 1], [10, y + 1], [26, y - 2]], { ...BRUSH, size: 4.2, dryBrush: 0.75, taperStart: 8, taperEnd: 12 }, 1323 + k));
  // a column of writing down the right margin, and the painter's name below it
  const chars = [0, 1, 2, 3, 4].flatMap(k => brushChar(1016, 120 + k * 62, 42, 1330 + k)).concat(brushChar(1016, 470, 26, 1336), brushChar(1016, 505, 26, 1337));
  const text = chars.map((pts, k) => prepareStroke(catmullRom(pts, 4), { ...BRUSH, size: k > 20 ? 3.6 : 6, dryBrush: 0.35, taperStart: 5, taperEnd: 10 }, 1340 + k));
  const blots = PLANETS.map((p, k) => blot(p.r, 1350 + k));
  return { sun, orbits, ring, uranusRing, bands, text, blots };
});

const orbitDone = (k: number): number => F.orbits + k * F.every + F.swing;

function drawPlanet(ctx: CanvasRenderingContext2D, L: Layout, p: Planet, k: number, m: number, dab: number): void {
  const [x, y] = planetAt(p, m), toSun = sunward([x, y]), s = 0.4 + 0.6 * dab;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  if (p.name === 'saturn') drawStroke(ctx, L.ring, 1);
  const shape = polyPath(L.blots[k]!);
  // the grey dab, with the bleed of wet ink into the fibres around it
  ctx.save();
  ctx.globalAlpha *= 0.18;
  ctx.fillStyle = GREY;
  ctx.scale(1.18, 1.18);
  ctx.fill(shape);
  ctx.restore();
  ctx.fillStyle = p.name === 'venus' || p.name === 'mercury' ? PALE : GREY;
  ctx.fill(shape);
  // the black touch on the night half, its inner edge soft where the two inks met wet
  ctx.save();
  ctx.clip(shape);
  ctx.rotate(toSun + Math.PI);
  const r = p.r;
  const grad = ctx.createLinearGradient(-r * 0.25, 0, r * 0.35, 0);
  grad.addColorStop(0, 'rgba(20,19,17,0)');
  grad.addColorStop(1, 'rgba(20,19,17,0.94)');
  ctx.fillStyle = grad;
  ctx.fillRect(-r * 0.25, -r * 1.3, r * 2.6, r * 2.6);
  ctx.restore();
  if (p.name === 'jupiter') for (const b of L.bands) drawStroke(ctx, b, 1);
  if (p.name === 'uranus') drawStroke(ctx, L.uranusRing, 1);
  if (p.name === 'earth') {
    const [mx, my] = moonOffset(m);
    ctx.fillStyle = SOOT;
    ctx.beginPath();
    ctx.arc(mx, my, MOON.r, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

export const sumiScene: Scene = {
  name: 'solar-sumi',
  duration: (LOOP_FROM + LOOP) / 12,
  loopFrom: LOOP_FROM / 12,
  poster: (LOOP_FROM + POSTER_M) / 12,
  draw(f) {
    const { stage } = f;
    const fr = frameFit(stage.w, stage.h), L = layout(), m = orbitClock(f, LOOP_FROM), n = m + LOOP_FROM;
    ground(f, PAPER, { seed: 1300, texture: 1.5, vignette: 0.12, vignetteColor: '#6b5a3a' });

    // the Sun: a vermilion wash, then the ensō round it in one loaded stroke
    const sunIn = clamp((n - F.sun[0]) / (F.sun[1] - F.sun[0]), 0, 1);
    if (sunIn > 0) {
      still(f, 's03-sun-wash', g => {
        enter(g.ctx, fr);
        wash(g.ctx, ellipsePoints(C[0], C[1], SUN_R - 2, SUN_R - 4, { start: 0, n: 40 }).slice(0, -1), SUN_WASH, { seed: 1302, alpha: 1.5, bleed: 6, layers: 5, edge: 0.9 });
      }, { alpha: clamp(sunIn * 2 - 0.6, 0, 1), blend: 'multiply' });
    }
    ink(f, 's03-ink', g => {
      const c = g.ctx;
      enter(c, fr);
      if (sunIn > 0) drawStroke(c, L.sun, sunIn);
      PLANETS.forEach((_, k) => {
        const prog = clamp((n - F.orbits - k * F.every) / F.swing, 0, 1);
        if (prog > 0) drawStroke(c, L.orbits[k]!, prog);
      });
      // the belt: ink flicked from the brush, each drop keeping its own orbit
      const beltIn = clamp((n - F.belt[0]) / (F.belt[1] - F.belt[0]), 0, 1);
      if (beltIn > 0) {
        c.save();
        c.fillStyle = GREY;
        c.beginPath();
        ROCKS.forEach((rk, k) => {
          if (k / ROCKS.length > beltIn) return;
          const [x, y] = rockAt(rk, m), s = 0.5 + rk.size * 0.9, a = rk.at0 * 3;
          c.moveTo(x + Math.cos(a) * s * (1 + rk.tone), y + Math.sin(a) * s * (1 + rk.tone));
          c.ellipse(x, y, s * (1 + rk.tone), s, a, 0, TAU);
        });
        c.fill();
        c.restore();
      }
      PLANETS.forEach((p, k) => {
        const dab = clamp((n - orbitDone(k)) / 3, 0, 1);
        if (dab > 0) drawPlanet(c, L, p, k, m, dab);
      });
      const textIn = (n - F.text[0]) / (F.text[1] - F.text[0]);
      L.text.forEach((s, k) => {
        const prog = clamp(textIn * L.text.length - k, 0, 1);
        if (prog > 0) drawStroke(c, s, prog);
      });
    }, { tooth: { seed: 1303, density: 24, size: 1.3, alpha: 0.22 } });

    // the seal, pressed last, a little uneven
    if (n >= F.seal) {
      ink(f, 's03-seal', g => {
        const c = g.ctx;
        enter(c, fr);
        c.fillStyle = SEAL;
        c.fillRect(996, 548, 40, 40);
        c.strokeStyle = PAPER;
        c.lineWidth = 3;
        c.lineCap = 'square';
        c.beginPath();
        for (const pts of brushChar(1016, 568, 26, 1360)) pts.forEach(([x, y], k) => (k ? c.lineTo(x, y) : c.moveTo(x, y)));
        c.stroke();
      }, { tooth: { seed: 1304, density: 60, size: 1.6, alpha: 0.5 }, alpha: 0.92 });
    }
  },
};
