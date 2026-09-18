/**
 * SP06 "Stipple" (the moving solar system at an angle; stipple). Single dots of lamp-black and one sunset rose on grey
 * laid paper, whole from the start. The sky darkens towards the corners by dot density alone; the current orbits are
 * chains of dots; the Sun is a rose sphere darkening at its limb inside a thinning corona.
 *
 * Each wake is a dotted band: dots scattered across its width at every step of its own time, fewer and fewer back
 * along the helix and thinner where the coil runs behind the Sun's line, rose for the newest stretch as in the plan.
 * The dots are keyed to the time they mark, so they ride along the helix. Each planet is a stippled sphere lit from
 * the Sun, crescent to full as it swings round; dust drifts past as stray dots.
 */
import { clamp, TAU } from '../../core/math';
import { rng } from '../../core/random';
import type { Scene, SceneFrame } from '../../core/scene';
import { ground, stipple, still } from '../gallery/common';
import { SOLAR } from '../solar/palettes';
import { bodyRing, BOX, dust, E1, E2, enter, frameFit, hash01, INTRO, LOOP, MOTION, once, orbitRing, paint, PLANETS, POSTER_M, project, RINGS, shadeAt, snapshot, spiralClock, SUN_R, tangent, URANUS_RING, type Body, type Frame, type PlanetName, type Sample, type Snapshot, type Vec3 } from './common';

const PAL = SOLAR.stipple;
const BLACK = PAL.ink, ROSE = PAL.accents[0]!, PAPER = PAL.paper;
/** Half width of each wake at the planet, and dots tried across it per step of its time. */
const WIDTH = [2.6, 3.2, 3.4, 3, 5.6, 4.8, 4, 4];
const TRIES = [3, 3, 4, 3, 6, 5, 4, 4];

/** A seeded dot in the unit disc: position, acceptance threshold and size. */
interface Dot { u: number; v: number; keep: number; size: number }

function dots(count: number, seed: number): Dot[] {
  const r = rng(seed), out: Dot[] = [];
  while (out.length < count) {
    const u = r() * 2 - 1, v = r() * 2 - 1;
    if (u * u + v * v > 1) continue;
    out.push({ u, v, keep: r(), size: 0.6 + r() * 0.45 });
  }
  return out;
}

/** Base darkness of each planet's lit side, and its bands (rows of the disc, in radii). */
const TONE: Record<PlanetName, { day: number; bands?: readonly [number, number, number][] }> = {
  mercury: { day: 0.3 },
  venus: { day: 0.08 },
  earth: { day: 0.3, bands: [[-0.8, -0.1, 0.25], [0.2, 0.7, 0.3]] },
  mars: { day: 0.42 },
  jupiter: { day: 0.12, bands: [[-0.72, -0.5, 0.45], [-0.3, -0.08, 0.5], [0.22, 0.34, 0.4], [0.56, 0.74, 0.45]] },
  saturn: { day: 0.14, bands: [[-0.35, -0.15, 0.3], [0.25, 0.4, 0.25]] },
  uranus: { day: 0.22 },
  neptune: { day: 0.48 },
};

const planetDots = once(() => PLANETS.map(p => dots(Math.round(p.r * p.r * Math.PI * 0.6) + 20, 2610 + p.k)));
const moonDots = once(() => dots(24, 2620));

function dot(c: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  c.moveTo(x + s, y);
  c.arc(x, y, s, 0, TAU);
}

/** A sphere in dots, lit from `light`, darkening at the limb, banded in rows. */
function sphere(c: CanvasRenderingContext2D, x: number, y: number, R: number, s: number, light: Vec3, ds: readonly Dot[], tone: { day: number; bands?: readonly [number, number, number][] }): void {
  c.fillStyle = PAPER;
  c.beginPath();
  c.arc(x, y, R + 1.6, 0, TAU);
  c.fill();
  c.fillStyle = BLACK;
  c.beginPath();
  for (const d of ds) {
    const lit = shadeAt(d.u, d.v, light), z = Math.sqrt(Math.max(0, 1 - d.u * d.u - d.v * d.v));
    let dark = lit <= 0 ? 0.62 + 0.2 * (1 - z) : tone.day * (1 - 0.5 * lit) + 0.34 * clamp(1 - lit * 4, 0, 1);
    for (const [b0, b1, extra] of tone.bands ?? []) if (d.v >= b0 && d.v <= b1) dark += extra * (lit <= 0 ? 0.2 : 0.8);
    dark += (1 - z) * 0.22;
    if (d.keep < dark) dot(c, x + d.u * R, y + d.v * R, d.size * Math.min(1.2, s));
  }
  c.fill();
  c.beginPath();
  const rim = Math.max(14, Math.round(R * 2.2));
  for (let j = 0; j < rim; j++) {
    const b = (j / rim) * TAU;
    dot(c, x + Math.cos(b) * R, y + Math.sin(b) * R, 0.85);
  }
  c.fill();
}

function sky(g: SceneFrame, fr: Frame): void {
  const c = g.ctx, S = project([0, 0, 0]);
  enter(c, fr);
  // the sky darkens away from the system, dot by dot
  stipple(c, [0, 0, BOX, BOX], 120000, (x, y) => {
    const d = Math.hypot(x - S.x + 90, (y - S.y + 60) * 1.15);
    return 0.008 + 0.42 * clamp((d - 380) / 420, 0, 1) ** 1.4;
  }, { color: BLACK, size: 0.8, seed: 2601 });
  // the current orbits: chains of dots, fewer on the far halves, drawn under and over the Sun
  const r = rng(2602), chain = (half: readonly { x: number; y: number }[], gap: number): void => {
    c.beginPath();
    let acc = 0;
    for (let i = 1; i < half.length; i++) {
      const a = half[i - 1]!, b = half[i]!, len = Math.hypot(b.x - a.x, b.y - a.y);
      for (acc += len; acc > gap; acc -= gap) {
        const t = 1 - (acc - gap) / len;
        dot(c, a.x + (b.x - a.x) * t + (r() - 0.5) * 0.6, a.y + (b.y - a.y) * t + (r() - 0.5) * 0.6, 0.8 + r() * 0.3);
      }
    }
    c.fill();
  };
  c.fillStyle = BLACK;
  for (const p of PLANETS) chain(orbitRing(p.k).far, 9);
  // the Sun: rose dots dense at the limb and in a corona thinning outward, a few black at the very edge
  stipple(c, [S.x - 150, S.y - 150, 300, 300], 60000, (x, y) => {
    const d = Math.hypot(x - S.x, y - S.y) / SUN_R;
    return d <= 1 ? 0.42 + 0.5 * d ** 3 : Math.max(0, 0.42 * Math.exp(-(d - 1) * 2.2));
  }, { color: ROSE, size: 1, seed: 2603 });
  stipple(c, [S.x - SUN_R, S.y - SUN_R, SUN_R * 2, SUN_R * 2], 2600, (x, y) => {
    const d = Math.hypot(x - S.x, y - S.y) / SUN_R;
    return d <= 1 ? 0.55 * clamp((d - 0.72) / 0.28, 0, 1) ** 2 : 0;
  }, { color: BLACK, size: 0.8, seed: 2604 });
  c.fillStyle = BLACK;
  for (const p of PLANETS) chain(orbitRing(p.k).near, 5.5);
}

/** A wake in dots: tries across its width at each step of its own time, kept by a hash against a falling density. */
function wakeDots(c: CanvasRenderingContext2D, S: Snapshot, run: readonly Sample[], k: number, near: boolean, half0: number, tries: number, rose: boolean): void {
  const R2 = (SUN_R + 3) ** 2;
  c.beginPath();
  run.forEach((s, i) => {
    const [tx, ty] = tangent(run, i), half = half0 * s.s * (1 - s.age * 0.6);
    const density = Math.pow(Math.max(0, 1 - s.age), 1.1) * (near ? 1 : 0.5);
    for (let j = 0; j < tries; j++) {
      if (hash01(s.q, k, j) >= density) continue;
      const newest = s.age < 0.07 || (s.age < 0.14 && hash01(s.q, k, j, 5) < (0.14 - s.age) / 0.07);
      if (newest !== rose) continue;
      const u = hash01(s.q, k, j, 1) * 2 - 1, w = (hash01(s.q, k, j, 2) - 0.5) * 1.2;
      const x = s.x - ty * u * half + tx * w, y = s.y + tx * u * half + ty * w;
      // behind the Sun's line the Sun covers the dots
      if (!near && (x - S.sun.x) ** 2 + (y - S.sun.y) ** 2 < R2) continue;
      dot(c, x, y, (0.75 + hash01(s.q, k, j, 3) * 0.5) * Math.min(1.25, s.s));
    }
  });
  c.fill();
}

function drawBody(c: CanvasRenderingContext2D, S: Snapshot, b: Body): void {
  const name = b.planet.name;
  c.save();
  if (!b.near) {
    // behind the Sun's line: the Sun, laid down beneath, covers it
    const hide = new Path2D();
    hide.rect(-100, -100, BOX + 200, BOX + 200);
    hide.moveTo(S.sun.x + SUN_R + 2, S.sun.y);
    hide.arc(S.sun.x, S.sun.y, SUN_R + 2, 0, TAU, true);
    c.clip(hide);
  }
  const ringDots = (back: boolean): void => {
    if (name !== 'saturn' && name !== 'uranus') return;
    c.fillStyle = BLACK;
    c.beginPath();
    const radii = name === 'saturn' ? [RINGS.inner + 1, RINGS.inner + 4, RINGS.outer - 5, RINGS.outer - 1.5] : [URANUS_RING];
    radii.forEach((rad, j) => {
      const ring = name === 'saturn' ? bodyRing(b.p, rad, E1, E2, 60) : bodyRing(b.p, rad, MOTION, E1, 30);
      (back ? ring.back : ring.front).forEach((p, i) => { if ((i + j) % 2 === 0) dot(c, p.x, p.y, 0.8); });
    });
    c.fill();
  };
  ringDots(true);
  const mo = S.moon;
  if (name === 'earth' && !mo.front) sphere(c, mo.x, mo.y, mo.R, mo.s, mo.light, moonDots(), { day: 0.2 });
  sphere(c, b.x, b.y, b.R, b.s, b.light, planetDots()[b.planet.k]!, TONE[name]);
  ringDots(false);
  if (name === 'earth' && mo.front) sphere(c, mo.x, mo.y, mo.R, mo.s, mo.light, moonDots(), { day: 0.2 });
  c.restore();
}

export const stippleSpiral: Scene = {
  name: 'spiral-stipple',
  duration: (INTRO + LOOP) / 12,
  loopFrom: INTRO / 12,
  poster: (INTRO + POSTER_M) / 12,
  draw(f) {
    const { ctx, stage } = f;
    const fr = frameFit(stage.w, stage.h), m = spiralClock(f), S = snapshot(m);
    ground(f, PAPER, { seed: 2600, texture: 1.1 });
    still(f, 'sp06-sky', g => sky(g, fr));

    ctx.save();
    enter(ctx, fr);
    // dust drifting past: stray dots
    ctx.fillStyle = BLACK;
    for (const d of dust(m)) {
      if (d.tone > 0.55) continue;
      ctx.globalAlpha = d.alpha;
      ctx.beginPath();
      dot(ctx, d.x, d.y, (0.6 + d.tone) * Math.min(1.4, d.s));
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    paint(S, {
      run(t, run, near) {
        const k = t.k === 8 ? 8 : t.k, half = t.k === 8 ? 1.2 : WIDTH[t.k]!, tries = t.k === 8 ? 1 : TRIES[t.k]!;
        ctx.fillStyle = BLACK;
        wakeDots(ctx, S, run, k, near, half, tries, false);
        ctx.fillStyle = ROSE;
        wakeDots(ctx, S, run, k, near, half, tries, true);
      },
      rocks(rocks, near) {
        ctx.fillStyle = BLACK;
        ctx.beginPath();
        for (const r of rocks) {
          if (!near && (r.x - S.sun.x) ** 2 + (r.y - S.sun.y) ** 2 < (SUN_R + 2) ** 2) continue;
          dot(ctx, r.x, r.y, (0.55 + r.rock.size * 0.4) * r.s);
        }
        ctx.fill();
      },
      sunTrail(st) {
        // the Sun's path: a sparse line of rose dots back into the distance
        ctx.fillStyle = ROSE;
        ctx.beginPath();
        for (const s of st) {
          if (s.q % 3 !== 0 || hash01(s.q, 99) > 0.8 * (1 - s.age) || Math.hypot(s.x - S.sun.x, s.y - S.sun.y) < SUN_R + 4) continue;
          dot(ctx, s.x + (hash01(s.q, 98) - 0.5) * 3, s.y + (hash01(s.q, 97) - 0.5) * 3, 1.1 * s.s);
        }
        ctx.fill();
      },
      body: b => drawBody(ctx, S, b),
    });
    ctx.restore();
  },
};

