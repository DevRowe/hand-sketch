/**
 * S06 "Stipple" (the solar system from above; stipple). Everything is single dots of lamp-black and one sunset rose
 * on grey laid paper, whole from the start: orbits are chains of dots, the sky darkens towards the corners by dot
 * density alone, the Sun is a rose sphere darkening at its limb inside a thinning corona, and each planet is a
 * stippled sphere whose dark side keeps turning from the Sun.
 *
 * A planet's dots are its own (seeded in its disc and carried round with it); only which of them are inked changes,
 * as the light moves across. Behind each planet a short wake of rose dots follows it.
 */
import { clamp, TAU, type Vec2 } from '../../core/math';
import { rng } from '../../core/random';
import type { Scene, SceneFrame } from '../../core/scene';
import { ground, stipple, still } from '../gallery/common';
import { BOX, C, enter, frameFit, LOOP, MOON, moonOffset, once, PLANETS, planetAngle, planetAt, POSTER_M, RINGS, ROCKS, rockAt, SUN_R, sunward, URANUS_RING, type Frame, type Planet, type PlanetName } from './common';
import { skyOf, type Sky } from './sky';
import { SOLAR } from './palettes';

const PAL = SOLAR.stipple;
const BLACK = PAL.ink, ROSE = PAL.accents[0]!, PAPER = PAL.paper;

/** A seeded dot: position in the unit disc, acceptance threshold and size. */
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

/** Base darkness of each planet's day side, and its bands (page-fixed, in units of the radius). */
const TONE: Record<PlanetName, { day: number; bands?: readonly [number, number, number][] }> = {
  mercury: { day: 0.3 },
  venus: { day: 0.08 },
  earth: { day: 0.32, bands: [[-0.8, -0.1, 0.25], [0.2, 0.7, 0.3]] },
  mars: { day: 0.42 },
  jupiter: { day: 0.12, bands: [[-0.72, -0.5, 0.45], [-0.3, -0.08, 0.5], [0.22, 0.34, 0.4], [0.56, 0.74, 0.45]] },
  saturn: { day: 0.14, bands: [[-0.35, -0.15, 0.3], [0.25, 0.4, 0.25]] },
  uranus: { day: 0.22 },
  neptune: { day: 0.48 },
};

const planetDots = once(() => PLANETS.map((p, k) => dots(Math.round(p.r * p.r * Math.PI * 0.5), 1610 + k)));
const moonDots = once(() => dots(26, 1620));
const ringDots = once(() => {
  const r = rng(1621), out: Vec2[] = [];
  while (out.length < 700) {
    const a = r() * TAU, rr = RINGS.inner + r() * (RINGS.outer - RINGS.inner);
    if (Math.abs(rr - 34) < 1.2) continue;
    const x = Math.cos(a) * rr, y = Math.sin(a) * rr * RINGS.squash;
    out.push([x * Math.cos(RINGS.angle) - y * Math.sin(RINGS.angle), x * Math.sin(RINGS.angle) + y * Math.cos(RINGS.angle)]);
  }
  return out;
});
/** Wake dots: offsets behind the planet along its orbit (fraction of the wake, radial offset in radii) and a threshold. */
const wakeDots = once(() => {
  const r = rng(1622);
  return Array.from({ length: 150 }, () => ({ s: Math.pow(r(), 0.8), w: (r() * 2 - 1) * 0.6, keep: r(), size: 0.8 + r() * 0.6 }));
});

function dot(c: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  c.moveTo(x + s, y);
  c.arc(x, y, s, 0, TAU);
}

/** A sphere in dots: dark on the side turned from the Sun, darkening at the limb, banded in page-fixed rows. */
function planet(c: CanvasRenderingContext2D, p: Planet, k: number, sky: Sky): void {
  const [x, y] = planetAt(p, sky), a = sunward([x, y]), lx = Math.cos(a), ly = Math.sin(a), t = TONE[p.name], r = p.r;
  c.fillStyle = PAPER;
  c.beginPath();
  c.arc(x, y, r + 2, 0, TAU);
  c.fill();
  c.fillStyle = BLACK;
  c.beginPath();
  for (const d of planetDots()[k]!) {
    const z = Math.sqrt(Math.max(0, 1 - d.u * d.u - d.v * d.v)), lit = d.u * lx + d.v * ly;
    // dark falls off from the night side through a soft terminator; the day side keeps its own tone and bands
    let dark = lit < 0 ? 0.45 + 0.4 * clamp(-lit * 2.4, 0, 1) : t.day * (1 - 0.5 * lit) + 0.3 * clamp(1 - lit * 5, 0, 1);
    for (const [b0, b1, extra] of t.bands ?? []) if (d.v >= b0 && d.v <= b1) dark += extra * (lit < 0 ? 0.2 : 0.8);
    dark += (1 - z) * 0.25;
    if (d.keep < dark) dot(c, x + d.u * r, y + d.v * r, d.size);
  }
  c.fill();
  // a firm rim of dots
  c.beginPath();
  const rim = Math.max(18, Math.round(r * 2.2));
  for (let j = 0; j < rim; j++) {
    const b = (j / rim) * TAU;
    dot(c, x + Math.cos(b) * r, y + Math.sin(b) * r, 0.9);
  }
  c.fill();
}

function saturnRing(c: CanvasRenderingContext2D, p: Planet, sky: Sky): void {
  const [x, y] = planetAt(p, sky), a = sunward([x, y]), lx = Math.cos(a), ly = Math.sin(a);
  c.fillStyle = BLACK;
  c.beginPath();
  ringDots().forEach(([u, v], j) => {
    const along = u * lx + v * ly, across = Math.abs(-u * ly + v * lx);
    // the planet's shadow falls across the ring on the side away from the Sun
    const shadow = along < 0 && across < p.r ? 1 : 0;
    if ((j * 0.618) % 1 < 0.3 + shadow * 0.6) dot(c, x + u, y + v, 0.8);
  });
  c.fill();
}

function skyDots(g: SceneFrame, fr: Frame): void {
  const c = g.ctx;
  enter(c, fr);
  // the sky darkens towards the corners, dot by dot
  stipple(c, [0, 0, BOX, BOX], 110000, (x, y) => {
    const d = Math.hypot(x - C[0], y - C[1]);
    return d < PLANETS[7]!.a + 20 ? 0.006 + 0.03 * clamp((d - 150) / 330, 0, 1) : 0.05 + 0.4 * clamp((d - 510) / 260, 0, 1) ** 1.3;
  }, { color: BLACK, size: 0.8, seed: 1601 });
  // orbits: chains of dots, a little uneven in spacing and weight
  const r = rng(1602);
  c.fillStyle = BLACK;
  c.beginPath();
  for (const p of PLANETS) {
    const n = Math.round((TAU * p.a) / 5.2);
    for (let j = 0; j < n; j++) {
      const b = ((j + (r() - 0.5) * 0.35) / n) * TAU, rr = p.a + (r() - 0.5) * 0.9;
      dot(c, C[0] + Math.cos(b) * rr, C[1] + Math.sin(b) * rr, 1 + r() * 0.4);
    }
  }
  c.fill();
  // the Sun: rose dots dense at the limb and in a corona thinning outward, a few black at the very edge
  stipple(c, [C[0] - 200, C[1] - 200, 400, 400], 110000, (x, y) => {
    const d = Math.hypot(x - C[0], y - C[1]) / SUN_R;
    return d <= 1 ? 0.42 + 0.5 * d ** 3 : Math.max(0, 0.42 * Math.exp(-(d - 1) * 2.2));
  }, { color: ROSE, size: 1, seed: 1603 });
  stipple(c, [C[0] - SUN_R, C[1] - SUN_R, SUN_R * 2, SUN_R * 2], 6000, (x, y) => {
    const d = Math.hypot(x - C[0], y - C[1]) / SUN_R;
    return d <= 1 ? 0.55 * clamp((d - 0.72) / 0.28, 0, 1) ** 2 : 0;
  }, { color: BLACK, size: 0.8, seed: 1604 });
}

export const stippleScene: Scene = {
  name: 'solar-stipple',
  duration: LOOP / 12,
  loopFrom: 0,
  poster: POSTER_M / 12,
  draw(f) {
    const { ctx, stage } = f;
    const fr = frameFit(stage.w, stage.h), sky = skyOf(f, 0);
    ground(f, PAPER, { seed: 1600, texture: 1.1 });
    still(f, 's06-sky', g => skyDots(g, fr));

    ctx.save();
    enter(ctx, fr);
    // wakes of rose dots, carried with each planet
    ctx.fillStyle = ROSE;
    ctx.beginPath();
    for (const p of PLANETS) {
      const a = planetAngle(p, sky), span = 140 / p.a;
      for (const w of wakeDots()) {
        if (w.keep > 0.85 * (1 - w.s) ** 1.3) continue;
        const b = a + w.s * span, rr = p.a + w.w * p.r * (1 - w.s * 0.5);
        dot(ctx, C[0] + Math.cos(b) * rr, C[1] + Math.sin(b) * rr, w.size);
      }
    }
    ctx.fill();
    // the belt
    ctx.fillStyle = BLACK;
    ctx.beginPath();
    for (const rk of ROCKS) {
      const [x, y] = rockAt(rk, sky);
      dot(ctx, x, y, 0.6 + rk.size * 0.45);
    }
    ctx.fill();
    PLANETS.forEach((p, k) => {
      if (p.name === 'saturn') saturnRing(ctx, p, sky);
      planet(ctx, p, k, sky);
      const [x, y] = planetAt(p, sky);
      if (p.name === 'uranus') {
        ctx.fillStyle = BLACK;
        ctx.beginPath();
        for (let j = 0; j < 30; j++) {
          const b = (j / 30) * TAU, u = Math.cos(b) * URANUS_RING.rx, v = Math.sin(b) * URANUS_RING.ry;
          const px = u * Math.cos(URANUS_RING.angle) - v * Math.sin(URANUS_RING.angle), py = u * Math.sin(URANUS_RING.angle) + v * Math.cos(URANUS_RING.angle);
          if (px * px + py * py > p.r * p.r || py > 0) dot(ctx, x + px, y + py, 0.75);
        }
        ctx.fill();
      }
      if (p.name === 'earth') {
        const [mx, my] = moonOffset(sky), a = sunward([x + mx, y + my]);
        ctx.fillStyle = BLACK;
        ctx.beginPath();
        for (let j = 0; j < 34; j++) {
          const b = (j / 34) * TAU;
          dot(ctx, x + Math.cos(b) * MOON.a, y + Math.sin(b) * MOON.a, 0.55);
        }
        for (const d of moonDots()) if (d.u * Math.cos(a) + d.v * Math.sin(a) < -0.1 || d.keep < 0.15) dot(ctx, x + mx + d.u * MOON.r, y + my + d.v * MOON.r, 0.7);
        ctx.fill();
      }
    });
    ctx.restore();
  },
};
