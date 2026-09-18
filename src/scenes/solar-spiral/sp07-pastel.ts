/**
 * SP07 "Pastel" (the moving solar system at an angle; soft pastel on black). Chalk on dark toothy paper, whole from
 * the start: light is what gets drawn. The Sun is hundreds of radiating pastel strokes, cream at the heart through
 * yellow to orange. Each wake is a smudge of its planet's colour: a broad, soft pass rubbed in with the side of the
 * stick and a firmer line down its middle, both fading back along the helix and dimmer where the coil passes behind
 * the Sun's line, so the spirals read as trails of light. Each planet is lit in its own colour on the part the Sun
 * reaches, a crescent or a full face as it swings round, with a rim of light at the limb; the rest is bare paper.
 * Everything drawn is broken by the paper's tooth, then bloomed from a blurred copy of itself.
 *
 * Dust drifts past as flecks of chalk; the stars twinkle a whole number of times per loop.
 */
import { clamp, TAU } from '../../core/math';
import { rng } from '../../core/random';
import type { Scene, SceneFrame } from '../../core/scene';
import { cached, ground, knockOut, polyPath, scratch, still, toothMask } from '../gallery/common';
import { SOLAR } from '../solar/palettes';
import { bodyBand, bodyRing, BOX, cyclePhase, disc, dust, E1, E2, enter, frameFit, INTRO, inWake, litShape, LOOP, MOTION, once, orbitRings, paint, POSTER_M, project, RINGS, snapshot, spiralSky, strokeRun, SUN_R, trace, URANUS_RING, type Body, type Frame, type PlanetName, type Sample, type Snapshot } from './common';

const PAL = SOLAR.pastel;
const [SUN_Y, SUN_O, ROSE, ICE, ULTRA, GREEN, CREAM, LILAC, PEACH] = PAL.fills as [string, string, string, string, string, string, string, string, string];
const PAPER = PAL.paper;
const COLOR: Record<PlanetName, string> = { mercury: LILAC, venus: CREAM, earth: ULTRA, mars: SUN_O, jupiter: PEACH, saturn: '#f1d58e', uranus: ICE, neptune: ULTRA };
/** Wake colours: the planet's, with Neptune's bluer than the Earth's so the two spirals part. */
const WAKE: Record<PlanetName, string> = { mercury: LILAC, venus: CREAM, earth: '#7fb2ff', mars: SUN_O, jupiter: PEACH, saturn: '#f1d58e', uranus: ICE, neptune: '#8f7dff' };
const WIDTH = [2.2, 2.8, 3, 2.6, 4.6, 4, 3.4, 3.4];

function rgba(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${clamp(a, 0, 1)})`;
}

interface Star { x: number; y: number; s: number; cycles: number; off: number }

const STARS = once((): Star[] => {
  const r = rng(2701), out: Star[] = [], S = project([0, 0, 0]);
  while (out.length < 230) {
    const x = r() * BOX, y = r() * BOX;
    if (Math.hypot(x - S.x, y - S.y) < 110) continue;
    out.push({ x, y, s: 0.6 + Math.pow(r(), 5) * 2.8, cycles: r() < 0.25 ? 4 + Math.floor(r() * 8) : 0, off: r() });
  }
  return out;
});

/** The Sun: a soft glow laid first, then radiating strokes, dense at the heart. */
function sunChalk(g: SceneFrame, fr: Frame): void {
  const c = g.ctx, r = rng(2702), S = project([0, 0, 0]), X = S.x, Y = S.y;
  enter(c, fr);
  c.lineCap = 'round';
  const glow = c.createRadialGradient(X, Y, SUN_R * 0.6, X, Y, SUN_R * 3.4);
  glow.addColorStop(0, rgba(SUN_O, 0.35));
  glow.addColorStop(0.4, rgba(ROSE, 0.1));
  glow.addColorStop(1, rgba(ROSE, 0));
  c.fillStyle = glow;
  c.fill(disc(X, Y, SUN_R * 3.4));
  c.fillStyle = rgba(SUN_Y, 0.85);
  c.fill(disc(X, Y, SUN_R * 0.95));
  for (let k = 0; k < 700; k++) {
    const a = r() * TAU, t = Math.pow(r(), 0.8), r0 = t * SUN_R * 1.2, len = 4 + r() * 11 * (0.3 + t);
    const col = t < 0.4 ? CREAM : t < 0.75 ? SUN_Y : t < 0.97 ? SUN_O : ROSE;
    c.strokeStyle = rgba(col, t < 0.8 ? 0.55 + r() * 0.4 : 0.35 + r() * 0.3);
    c.lineWidth = 2.2 + r() * 3;
    c.beginPath();
    c.moveTo(X + Math.cos(a) * r0, Y + Math.sin(a) * r0);
    c.lineTo(X + Math.cos(a + (r() - 0.5) * 0.08) * (r0 + len), Y + Math.sin(a + (r() - 0.5) * 0.08) * (r0 + len));
    c.stroke();
  }
}

/** A wake in pastel: a broad soft smudge, then a firmer line down its middle. */
function smudge(c: CanvasRenderingContext2D, run: readonly Sample[], color: string, half: number, near: boolean): void {
  const depth = (s: Sample): number => (near ? 1 : 0.5) * (0.75 + 0.25 * s.side);
  c.strokeStyle = color;
  strokeRun(c, run, 4, s => ({ width: half * 4.2 * s.s * (1 - s.age * 0.4), alpha: 0.13 * Math.pow(1 - s.age, 1.3) * depth(s) }));
  strokeRun(c, run, 4, s => ({ width: half * 1.9 * s.s * (1 - s.age * 0.5), alpha: 0.3 * Math.pow(1 - s.age, 1.4) * depth(s) }));
  strokeRun(c, run, 4, s => ({ width: half * 0.7 * s.s * (1 - s.age * 0.6), alpha: 0.8 * Math.pow(1 - s.age, 1.6) * depth(s) }));
}

/** A sphere in pastel: its colour on the lit part, scumbled, a rim of light at the sunward limb; bare paper else. */
function lit(c: CanvasRenderingContext2D, x: number, y: number, R: number, toSun: number, phase: number, col: string, extra?: (c: CanvasRenderingContext2D) => void): void {
  c.save();
  c.translate(x, y);
  c.fillStyle = PAPER;
  c.fill(disc(0, 0, R + 1));
  const shape = polyPath(litShape(R, toSun, phase));
  c.save();
  c.clip(shape);
  c.fillStyle = rgba(col, 0.95);
  c.fillRect(-R, -R, R * 2, R * 2);
  extra?.(c);
  c.rotate(toSun);
  c.lineCap = 'round';
  c.lineWidth = Math.max(1.2, R * 0.14);
  c.strokeStyle = rgba(CREAM, 0.35);
  c.beginPath();
  for (let j = -R; j < R; j += Math.max(2.2, R * 0.22)) { c.moveTo(-R * 0.2, j); c.lineTo(R, j + R * 0.25); }
  c.stroke();
  c.restore();
  // the rim of light on the sunward limb
  c.strokeStyle = rgba(CREAM, 0.8);
  c.lineWidth = 1.4;
  c.beginPath();
  c.arc(0, 0, R, toSun - 1.2, toSun + 1.2);
  c.stroke();
  c.restore();
}

function drawBody(c: CanvasRenderingContext2D, S: Snapshot, b: Body): void {
  const name = b.planet.name;
  const band = name === 'saturn' ? bodyBand(b.p, RINGS.inner, RINGS.outer, E1, E2) : null;
  const ur = name === 'uranus' ? bodyRing(b.p, URANUS_RING, MOTION, E1) : null;
  if (band) { c.fillStyle = rgba('#e8cf95', 0.5); c.fill(polyPath(band.back)); }
  if (ur) { c.strokeStyle = rgba(ICE, 0.55); c.lineWidth = 1.5; c.beginPath(); trace(c, ur.back); c.stroke(); }
  const mo = S.moon;
  if (name === 'earth' && !mo.front) lit(c, mo.x, mo.y, mo.R, mo.toSun, mo.phase, CREAM);
  lit(c, b.x, b.y, b.R, b.toSun, b.phase, COLOR[name], name === 'jupiter' ? cc => {
    cc.fillStyle = rgba(ROSE, 0.55);
    for (const [y0, h] of [[-0.68, 0.14], [-0.28, 0.22], [0.2, 0.14], [0.5, 0.2]] as const) cc.fillRect(-b.R, y0 * b.R, b.R * 2, h * b.R);
  } : name === 'earth' ? cc => {
    cc.fillStyle = rgba(GREEN, 0.8);
    cc.beginPath();
    cc.ellipse(-0.25 * b.R, -0.25 * b.R, 0.45 * b.R, 0.35 * b.R, 0.4, 0, TAU);
    cc.ellipse(0.4 * b.R, 0.4 * b.R, 0.26 * b.R, 0.2 * b.R, 0, 0, TAU);
    cc.fill();
  } : undefined);
  if (band) { c.fillStyle = rgba('#e8cf95', 0.55); c.fill(polyPath(band.front)); }
  if (ur) { c.strokeStyle = rgba(ICE, 0.55); c.lineWidth = 1.5; c.beginPath(); trace(c, ur.front); c.stroke(); }
  if (name === 'earth' && mo.front) lit(c, mo.x, mo.y, mo.R, mo.toSun, mo.phase, CREAM);
}

export const pastelSpiral: Scene = {
  name: 'spiral-pastel',
  duration: (INTRO + LOOP) / 12,
  loopFrom: INTRO / 12,
  poster: (INTRO + POSTER_M) / 12,
  draw(f) {
    const { ctx, stage } = f;
    const fr = frameFit(stage.w, stage.h), S = snapshot(spiralSky(f));
    ground(f, PAPER, { seed: 2700, texture: 1.7, vignette: 0.55 });
    ctx.save();
    enter(ctx, fr);
    ctx.fillStyle = CREAM;
    for (const s of STARS()) {
      const tw = s.cycles ? 0.5 + 0.5 * Math.sin(TAU * (cyclePhase(s.cycles, S.beat) + s.off)) : 1;
      ctx.globalAlpha = 0.25 + 0.6 * tw * (0.4 + s.s / 3.4);
      ctx.fill(disc(s.x, s.y, s.s));
    }
    ctx.restore();

    const sun = cached(f, 'sp07-sun', g => sunChalk(g, fr));
    const layer = scratch(f, 'sp07-chalk', g => {
      const c = g.ctx;
      enter(c, fr);
      c.lineCap = 'round';
      // flecks of chalk dust streaming past, drawn out a little along the path
      const dx = MOTION[0], dy = MOTION[1];
      for (const d of dust(S)) {
        const len = (2 + d.tone * 7) * d.s;
        c.strokeStyle = rgba(d.tone < 0.3 ? ICE : CREAM, 0.5 * d.alpha);
        c.lineWidth = (0.8 + d.tone * 1.2) * d.s;
        c.beginPath();
        c.moveTo(d.x - dx * len, d.y - dy * len);
        c.lineTo(d.x, d.y);
        c.stroke();
      }
      paint(S, {
        run: (t, run, near) => inWake(c, S, () => {
          if (t.k === 8) smudge(c, run, CREAM, 0.9, near);
          else smudge(c, run, WAKE[S.bodies[t.k]!.planet.name], WIDTH[t.k]!, near);
        }),
        orbit: (_pl, half, near) => orbitRings(c, S, half, near, LILAC, 1.3),
        rocks(rocks) {
          c.fillStyle = rgba(LILAC, 0.7);
          c.beginPath();
          for (const r of rocks) { const s = (0.6 + r.rock.size * 0.6) * r.s; c.moveTo(r.x + s, r.y); c.arc(r.x, r.y, s, 0, TAU); }
          c.fill();
        },
        sunTrail: st => inWake(c, S, () => smudge(c, st, SUN_O, 4, true)),
        sun() { g.stage.blit(c, sun); },
        body: b => drawBody(c, S, b),
      });
      c.setTransform(1, 0, 0, 1, 0, 0);
      knockOut(g, c, toothMask(g, { seed: 2703, kind: 'streak', angle: -0.6, density: 70, size: 1.1, length: 8 }), 0.45);
      knockOut(g, c, toothMask(g, { seed: 2704, density: 90, size: 1.2 }), 0.45);
    });
    // bloom: a blurred quarter-size copy screened under the sharp chalk
    const qw = Math.round(stage.outW / 4), qh = Math.round(stage.outH / 4), bloom = stage.layer('sp07-bloom', qw, qh), bc = stage.context(bloom);
    bc.setTransform(1, 0, 0, 1, 0, 0);
    bc.clearRect(0, 0, qw, qh);
    bc.filter = `blur(${((9 * stage.scale * fr.s) / 4).toFixed(2)}px)`;
    bc.drawImage(layer, 0, 0, qw, qh);
    bc.filter = 'none';
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'screen';
    ctx.drawImage(bloom, 0, 0, stage.outW, stage.outH);
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(layer, 0, 0);
    ctx.restore();
    still(f, 'sp07-dust', g => {
      const c = g.ctx;
      enter(c, fr);
      const r = rng(2705);
      c.fillStyle = CREAM;
      c.globalAlpha = 0.06;
      for (let k = 0; k < 900; k++) c.fillRect(r() * BOX, r() * BOX, 1 + r() * 1.5, 1 + r() * 1.5);
    });
  },
};
