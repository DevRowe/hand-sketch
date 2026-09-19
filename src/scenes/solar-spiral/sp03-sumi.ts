/**
 * SP03 "Sumi Ink" (the moving solar system at an angle; sumi-e ink). Soot ink on bone rice paper. The Sun is the
 * top-down piece's vermilion wash in a loaded black ensō; each wake is one long stroke of the brush, pressed hard at
 * the planet and lifting as it goes back, its bristles separating into dry-brush streaks as the ink runs out. Where a
 * coil passes behind the Sun's line it is painted in diluted ink, the old painters' way of pushing a mountain back.
 * The planets are dabs, grey with a black touch on the side the Sun does not reach; the belt is flicked spatter; a
 * column of writing and the seal stand in the empty corner.
 *
 * The brush's pressure and its dry streaks are keyed to each sample's own time, so they travel with the stroke.
 */
import { catmullRom, ellipsePoints } from '../../core/geometry';
import { clamp, TAU, type Vec2 } from '../../core/math';
import { noise1 } from '../../core/random';
import type { Scene } from '../../core/scene';
import { drawStroke, prepareStroke, withPressure, type PreparedStroke, type StrokeStyle } from '../../core/stroke';
import { mix } from '../../art/color';
import { ground, ink, polyPath, smooth, still, wash } from '../gallery/common';
import { brushChar } from '../solar/common';
import { SOLAR } from '../solar/palettes';
import { along, bodyRing, disc, drawnFrame, dust, E1, E2, enter, frameFit, INTRO, litShape, LOOP, MOTION, once, orbitRings, paint, PLANETS, POSTER_M, project, RINGS, snapshot, spiralSky, strokeRun, SUN_R, tangent, URANUS_RING, type Body, type Sample, type Snapshot } from './common';

const PAL = SOLAR.sumi;
const SOOT = PAL.ink, PAPER = PAL.paper, SEAL = PAL.accents[0]!;
const [GREY, PALE] = PAL.fills as [string, string, string];

const BRUSH: StrokeStyle = { color: SOOT, size: 7, thinning: 0.45, smoothing: 0.6, streamline: 0.3, wobble: 1.8, wobbleWavelength: 380, tremor: 0.25, pressureVariation: 0.25, pressureWavelength: 300, dryBrush: 0.45, paper: PAPER, taperStart: 14, taperEnd: 60 };

/** Half width of each wake's stroke at the planet, at the Sun's depth. */
const WIDTH = [2.8, 3.4, 3.6, 3.2, 5.4, 4.6, 3.8, 3.6];
/** Bristles in a stroke. */
const BRISTLES = 5;

interface Layout {
  enso: PreparedStroke;
  text: PreparedStroke[];
  blots: Vec2[][];
  moonBlot: Vec2[];
  bands: PreparedStroke[];
}

/** A wet dab of ink: a disc whose edge wanders as the paper takes it. */
function blot(r: number, seed: number, n = 36): Vec2[] {
  return Array.from({ length: n }, (_, k): Vec2 => {
    const a = (k / n) * TAU, rr = r * (1 + 0.1 * noise1(k * 0.45, seed) + 0.04 * noise1(k * 1.7, seed + 1));
    return [Math.cos(a) * rr, Math.sin(a) * rr];
  });
}

const ensoPressure = (u: number): number => 1.35 - 0.75 * u + 0.25 * Math.exp(-(((u - 0.04) / 0.05) ** 2));

const layout = once((): Layout => {
  const S = project([0, 0, 0]);
  const enso = withPressure(prepareStroke(ellipsePoints(S.x, S.y, SUN_R + 7, SUN_R + 5, { start: -2.2, turns: 0.96, n: 80 }), { ...BRUSH, size: 12, dryBrush: 0.55, taperStart: 16, taperEnd: 70 }, 2301), ensoPressure);
  // a column of writing down the lower left, and the painter's name beside it
  const chars = [0, 1, 2, 3, 4].flatMap(k => brushChar(84, 640 + k * 62, 42, 2330 + k)).concat(brushChar(134, 890, 24, 2336), brushChar(134, 922, 24, 2337));
  const text = chars.map((pts, k) => prepareStroke(catmullRom(pts, 4), { ...BRUSH, size: k > 20 ? 3.4 : 5.6, dryBrush: 0.35, taperStart: 5, taperEnd: 10 }, 2340 + k));
  const rj = PLANETS[4]!.r;
  const bands = [-0.5, -0.1, 0.3, 0.62].map((y, k) => prepareStroke(([[-1, y + 0.08], [-0.3, y - 0.04], [0.4, y + 0.04], [1, y - 0.08]] as Vec2[]).map(([x, yy]): Vec2 => [x * rj, yy * rj]), { ...BRUSH, size: 3.2, dryBrush: 0.7, taperStart: 6, taperEnd: 8 }, 2323 + k));
  return { enso, text, blots: PLANETS.map(p => blot(p.r, 2350 + p.k)), moonBlot: blot(1, 2359, 20), bands };
});

/**
 * One wake as a brush stroke: `BRISTLES` lines side by side across its width, all together near the planet, parting
 * into dry streaks as the ink gives out towards the tail. The ink is diluted as the coil swings behind the Sun's line
 * and as the stroke runs dry; it is laid opaque (diluted towards white, on a layer that multiplies) so bristles that
 * overlap do not stripe.
 */
function brushRun(c: CanvasRenderingContext2D, run: Sample[], half0: number, dark: number, seed: number): void {
  if (run.length < 2) return;
  // a sample's half width, worked out once (every bristle and every segment asks for it)
  const halves = new Map<Sample, number>();
  for (const s of run) halves.set(s, half0 * s.s * Math.max(0, 1 - s.age) * (1 + 0.3 * along(s.q, seed, 26)));
  const normals = run.map((_, i) => tangent(run, i));
  for (let b = 0; b < BRISTLES; b++) {
    const u = (b / (BRISTLES - 1)) * 2 - 1;
    const line: Sample[] = run.map((s, i) => {
      const h = halves.get(s)! * u * 0.8, [tx, ty] = normals[i]!, moved = { ...s, x: s.x - ty * h, y: s.y + tx * h };
      halves.set(moved, halves.get(s)!);
      return moved;
    });
    strokeRun(c, line, 3, s => {
      // the ink runs dry: past a point that creeps along the stroke with age, bristles skip
      const dry = clamp((s.age - 0.2) * 1.4, 0, 0.95);
      if (along(s.q, seed + 17 * b, 70) * 0.5 + 0.5 < dry) return null;
      const inkiness = dark * (0.42 + 0.58 * smooth(-0.6, 0.6, s.side)) * (1 - s.age * 0.45);
      c.strokeStyle = mix('#ffffff', SOOT, clamp(inkiness, 0, 1));
      return { width: ((halves.get(s)! * 2) / BRISTLES) * 1.6 + 0.4, alpha: 1 };
    });
  }
}

function dab(c: CanvasRenderingContext2D, px: number, shape: Vec2[], x: number, y: number, scale: number, toSun: number, phase: number, r: number, light: string): void {
  c.save();
  c.translate(x, y);
  c.scale(scale, scale);
  const path = polyPath(shape);
  c.save();
  c.globalAlpha *= 0.18;
  c.fillStyle = GREY;
  c.scale(1.18, 1.18);
  c.fill(path);
  c.restore();
  c.fillStyle = light;
  c.fill(path);
  // the black touch where the Sun does not reach, soft where the two inks met wet
  c.save();
  c.clip(path);
  const shade = new Path2D();
  shade.addPath(disc(0, 0, r * 1.3));
  shade.addPath(polyPath(litShape(r * 1.02, toSun, phase)));
  c.filter = `blur(${Math.max(0.6, r * scale * 0.12 * px)}px)`;
  c.fillStyle = 'rgba(20,19,17,0.92)';
  c.fill(shade, 'evenodd');
  c.restore();
  c.restore();
}

function drawBody(c: CanvasRenderingContext2D, px: number, L: Layout, S: Snapshot, b: Body): void {
  const name = b.planet.name;
  const ring = name === 'saturn' ? bodyRing(b.p, (RINGS.inner + RINGS.outer) / 2, E1, E2) : name === 'uranus' ? bodyRing(b.p, URANUS_RING, MOTION, E1) : null;
  const ringStroke = (pts: { x: number; y: number }[]): void => {
    c.strokeStyle = SOOT;
    c.lineCap = 'round';
    c.lineWidth = (name === 'saturn' ? 3.4 : 1.4) * b.s;
    c.beginPath();
    pts.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)));
    c.stroke();
  };
  if (ring) { c.globalAlpha = 0.75; ringStroke(ring.back); c.globalAlpha = 1; }
  if (name === 'earth' && !S.moon.front) moonDab(c, px, L, S);
  dab(c, px, L.blots[b.planet.k]!, b.x, b.y, b.s, b.toSun, b.phase, b.planet.r, name === 'venus' || name === 'mercury' ? PALE : GREY);
  if (name === 'jupiter') {
    c.save();
    c.translate(b.x, b.y);
    c.scale(b.s, b.s);
    for (const s of L.bands) drawStroke(c, s, 1);
    c.restore();
  }
  if (ring) ringStroke(ring.front);
  if (name === 'earth' && S.moon.front) moonDab(c, px, L, S);
}

function moonDab(c: CanvasRenderingContext2D, px: number, L: Layout, S: Snapshot): void {
  const mo = S.moon;
  dab(c, px, L.moonBlot, mo.x, mo.y, mo.R, mo.toSun, mo.phase, 1, PALE);
}

export const sumiSpiral: Scene = {
  name: 'spiral-sumi',
  duration: (INTRO + LOOP) / 12,
  loopFrom: INTRO / 12,
  poster: (INTRO + POSTER_M) / 12,
  draw(f) {
    const { stage } = f;
    const fr = frameFit(stage.w, stage.h), L = layout(), S = snapshot(spiralSky(f)), n = drawnFrame(f);
    ground(f, PAPER, { seed: 2300, texture: 1.5, vignette: 0.12, vignetteColor: '#6b5a3a' });
    still(f, 'sp03-sun-wash', g => {
      enter(g.ctx, fr);
      wash(g.ctx, ellipsePoints(S.sun.x, S.sun.y, SUN_R - 2, SUN_R - 3, { start: 0, n: 36 }).slice(0, -1), SEAL, { seed: 2302, alpha: 1.5, bleed: 4, layers: 5, edge: 0.9 });
    }, { blend: 'multiply' });

    ink(f, 'sp03-ink', g => {
      const c = g.ctx;
      enter(c, fr);
      // dust the system flies through: fine grey specks, as if flicked from the brush
      c.fillStyle = GREY;
      for (const d of dust(S)) {
        if (d.tone > 0.6) continue;
        c.globalAlpha = d.alpha * 0.55;
        const s = (0.5 + d.tone * 1.4) * d.s;
        c.beginPath();
        c.ellipse(d.x, d.y, s * 1.5, s, Math.atan2(MOTION[1], MOTION[0]), 0, TAU);
        c.fill();
      }
      c.globalAlpha = 1;
      paint(S, {
        run(t, run) {
          // a fading wake is thinner ink, not a paler layer: the bristles stay opaque so they never stripe
          if (t.k === 8) brushRun(c, run, 1.1, 0.8 * S.plan.alpha, 2390);
          else brushRun(c, run, WIDTH[t.k]!, 0.96 * S.plan.alpha, 2370 + t.k * 3);
        },
        orbit: (_pl, half, near) => orbitRings(c, S, half, near, SOOT, 1.1),
        rocks(rocks) {
          c.fillStyle = GREY;
          c.beginPath();
          for (const r of rocks) {
            const s = (0.5 + r.rock.size * 0.8) * r.s, a = r.rock.at0 * 3;
            c.moveTo(r.x + Math.cos(a) * s * (1 + r.rock.tone), r.y + Math.sin(a) * s * (1 + r.rock.tone));
            c.ellipse(r.x, r.y, s * (1 + r.rock.tone), s, a, 0, TAU);
          }
          c.fill();
        },
        sunTrail(st) {
          // the Sun's own path: a wide, pale wash dragged back into the distance
          brushRun(c, st, 9, 0.22 * S.plan.alpha, 2395);
        },
        sun() { drawStroke(c, L.enso, clamp((n + 12) / 12, 0, 1)); },
        body: b => drawBody(c, fr.s * stage.scale, L, S, b),
      });
      for (const s of L.text) drawStroke(c, s, 1);
    }, { tooth: { seed: 2303, density: 24, size: 1.3, alpha: 0.22 } });

    ink(f, 'sp03-seal', g => {
      const c = g.ctx;
      enter(c, fr);
      c.fillStyle = SEAL;
      c.fillRect(64, 962, 40, 40);
      c.strokeStyle = PAPER;
      c.lineWidth = 3;
      c.lineCap = 'square';
      c.beginPath();
      for (const pts of brushChar(84, 982, 26, 2360)) pts.forEach(([x, y], k) => (k ? c.lineTo(x, y) : c.moveTo(x, y)));
      c.stroke();
    }, { tooth: { seed: 2304, density: 60, size: 1.6, alpha: 0.5 }, alpha: 0.92, fixed: true });
  },
};
