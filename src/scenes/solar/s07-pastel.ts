/**
 * S07 "Pastel" (the solar system from above; soft pastel on black). Chalk on dark toothy paper, whole from the start:
 * light is what gets drawn. The Sun is built from hundreds of radiating pastel strokes, cream at the heart through
 * yellow to orange; each orbit is a single soft chalk line; each planet is lit in its own colour on the side facing the
 * Sun and left as bare black paper on the other, with a rim of light at the limb; a smudge of its colour trails behind
 * it. Everything drawn is broken by the paper's tooth, then bloomed from a blurred copy of itself.
 *
 * The stars twinkle a whole number of times per loop.
 */
import { clamp, TAU } from '../../core/math';
import { rng } from '../../core/random';
import type { Scene, SceneFrame } from '../../core/scene';
import { cached, ground, knockOut, scratch, still, toothMask } from '../gallery/common';
import { annulus, BOX, C, cyclePhase, disc, enter, frameFit, LOOP, MOON, moonOffset, once, orbitClock, PLANETS, planetAngle, planetAt, POSTER_M, RINGS, ROCKS, rockAt, SUN_R, sunward, URANUS_RING, type Frame, type Planet, type PlanetName } from './common';
import { SOLAR } from './palettes';

const PAL = SOLAR.pastel;
const [SUN_Y, SUN_O, ROSE, ICE, ULTRA, GREEN, CREAM, LILAC, PEACH] = PAL.fills as [string, string, string, string, string, string, string, string, string];
const PAPER = PAL.paper;
const COLOR: Record<PlanetName, string> = { mercury: LILAC, venus: CREAM, earth: ULTRA, mars: SUN_O, jupiter: PEACH, saturn: '#f1d58e', uranus: ICE, neptune: ULTRA };

function rgba(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${clamp(a, 0, 1)})`;
}

interface Star { x: number; y: number; s: number; cycles: number; off: number }
const STARS = once((): Star[] => {
  const r = rng(1701), out: Star[] = [];
  while (out.length < 230) {
    const x = r() * BOX, y = r() * BOX, d = Math.hypot(x - C[0], y - C[1]);
    if (d < 140) continue;
    out.push({ x, y, s: 0.6 + Math.pow(r(), 5) * 2.8, cycles: r() < 0.25 ? 4 + Math.floor(r() * 8) : 0, off: r() });
  }
  return out;
});

/** The Sun and the orbits: the part of the pastel layer that never changes. */
function staticChalk(g: SceneFrame, fr: Frame): void {
  const c = g.ctx, r = rng(1702);
  enter(c, fr);
  c.lineCap = 'round';
  // orbits: one soft chalk line each, a second fainter pass slightly off
  for (const p of PLANETS) {
    for (const [dr, a, w] of [[0, 0.3, 2.2], [1.6, 0.12, 3.4]] as const) {
      c.strokeStyle = rgba(LILAC, a);
      c.lineWidth = w;
      c.beginPath();
      c.arc(C[0], C[1], p.a + dr, 0, TAU);
      c.stroke();
    }
  }
  // the glow laid first as broad soft strokes, then the radiating strokes of the Sun, dense at the heart
  const glow = c.createRadialGradient(C[0], C[1], SUN_R * 0.6, C[0], C[1], SUN_R * 3.2);
  glow.addColorStop(0, rgba(SUN_O, 0.35));
  glow.addColorStop(0.4, rgba(ROSE, 0.1));
  glow.addColorStop(1, rgba(ROSE, 0));
  c.fillStyle = glow;
  c.fill(disc(C[0], C[1], SUN_R * 3.2));
  c.fillStyle = rgba(SUN_Y, 0.85);
  c.fill(disc(C[0], C[1], SUN_R * 0.95));
  for (let k = 0; k < 1100; k++) {
    const a = r() * TAU, t = Math.pow(r(), 0.8), r0 = t * SUN_R * 1.2, len = 6 + r() * 16 * (0.3 + t);
    const col = t < 0.4 ? CREAM : t < 0.75 ? SUN_Y : t < 0.97 ? SUN_O : ROSE;
    c.strokeStyle = rgba(col, t < 0.8 ? 0.55 + r() * 0.4 : 0.35 + r() * 0.3);
    c.lineWidth = 3 + r() * 4;
    c.beginPath();
    c.moveTo(C[0] + Math.cos(a) * r0, C[1] + Math.sin(a) * r0);
    c.lineTo(C[0] + Math.cos(a + (r() - 0.5) * 0.08) * (r0 + len), C[1] + Math.sin(a + (r() - 0.5) * 0.08) * (r0 + len));
    c.stroke();
  }
}

/** A planet in pastel: bare paper on the night side, its colour scumbled across the day side, a lit rim. */
function planet(c: CanvasRenderingContext2D, p: Planet, m: number): void {
  const [x, y] = planetAt(p, m), toSun = sunward([x, y]), r = p.r, col = COLOR[p.name];
  c.save();
  c.translate(x, y);
  if (p.name === 'saturn') {
    c.fillStyle = rgba('#e8cf95', 0.55);
    c.fill(annulus(0, 0, RINGS.inner, RINGS.outer, RINGS.squash, RINGS.angle));
    c.fillStyle = rgba(PAPER, 0.9);
    c.fill(annulus(0, 0, RINGS.inner + 5, RINGS.inner + 7, RINGS.squash, RINGS.angle));
    // the planet's shadow on the ring
    c.save();
    c.clip(annulus(0, 0, RINGS.inner - 1, RINGS.outer + 1, RINGS.squash, RINGS.angle));
    c.rotate(toSun + Math.PI);
    c.fillStyle = rgba(PAPER, 0.85);
    c.fillRect(0, -r, RINGS.outer + 4, r * 2);
    c.restore();
  }
  if (p.name === 'uranus') {
    c.strokeStyle = rgba(ICE, 0.55);
    c.lineWidth = 1.6;
    c.beginPath();
    c.ellipse(0, 0, URANUS_RING.rx, URANUS_RING.ry, URANUS_RING.angle, 0, TAU);
    c.stroke();
  }
  // bare paper under the disc, so the orbit's chalk stops at the limb
  c.fillStyle = PAPER;
  c.fill(disc(0, 0, r + 1));
  c.save();
  c.clip(disc(0, 0, r));
  c.rotate(toSun);
  const lit = c.createLinearGradient(-r, 0, r, 0);
  lit.addColorStop(0, rgba(col, 0));
  lit.addColorStop(0.42, rgba(col, 0.15));
  lit.addColorStop(0.62, rgba(col, 0.85));
  lit.addColorStop(1, rgba(col, 1));
  c.fillStyle = lit;
  c.fillRect(-r, -r, r * 2, r * 2);
  // scumbled strokes across the lit side
  c.lineCap = 'round';
  c.lineWidth = Math.max(1.4, r * 0.14);
  c.strokeStyle = rgba(CREAM, 0.35);
  c.beginPath();
  for (let j = -r; j < r; j += Math.max(2.4, r * 0.22)) { c.moveTo(r * 0.2, j); c.lineTo(r, j + r * 0.25); }
  c.stroke();
  c.rotate(-toSun);
  if (p.name === 'jupiter') {
    c.fillStyle = rgba(ROSE, 0.55);
    for (const [y0, h] of [[-19, 4], [-8, 6], [6, 4], [14, 5]] as const) c.fillRect(-r, y0, r * 2, h);
  }
  if (p.name === 'earth') {
    c.fillStyle = rgba(GREEN, 0.8);
    c.beginPath();
    c.ellipse(-3, -3, 5, 4, 0.4, 0, TAU);
    c.ellipse(5, 5, 3, 2.4, 0, 0, TAU);
    c.fill();
  }
  c.restore();
  // the rim of light on the sunward limb
  c.strokeStyle = rgba(CREAM, 0.8);
  c.lineWidth = 1.5;
  c.beginPath();
  c.arc(0, 0, r, toSun - 1.2, toSun + 1.2);
  c.stroke();
  if (p.name === 'earth') {
    const [mx, my] = moonOffset(m);
    c.fillStyle = rgba(CREAM, 0.9);
    c.fill(disc(mx, my, MOON.r));
  }
  c.restore();
}

/** A smudge of the planet's colour dragged back along its path, fading. */
function trail(c: CanvasRenderingContext2D, p: Planet, m: number): void {
  const a = planetAngle(p, m), span = 170 / p.a, col = COLOR[p.name], steps = 14;
  c.lineCap = 'round';
  for (let j = 0; j < steps; j++) {
    const u0 = j / steps, u1 = (j + 1.4) / steps;
    c.strokeStyle = rgba(col, 0.42 * (1 - u0) ** 1.6);
    c.lineWidth = p.r * 1.3 * (1 - u0 * 0.7);
    c.beginPath();
    c.arc(C[0], C[1], p.a, a + u0 * span, a + u1 * span);
    c.stroke();
  }
}

export const pastelScene: Scene = {
  name: 'solar-pastel',
  duration: LOOP / 12,
  loopFrom: 0,
  poster: POSTER_M / 12,
  draw(f) {
    const { ctx, stage } = f;
    const fr = frameFit(stage.w, stage.h), m = orbitClock(f, 0);
    ground(f, PAPER, { seed: 1700, texture: 1.7, vignette: 0.55 });
    // the stars, a few twinkling
    ctx.save();
    enter(ctx, fr);
    ctx.fillStyle = CREAM;
    for (const s of STARS()) {
      const tw = s.cycles ? 0.5 + 0.5 * Math.sin(TAU * (cyclePhase(s.cycles, m) + s.off)) : 1;
      ctx.globalAlpha = 0.25 + 0.6 * tw * (0.4 + s.s / 3.4);
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.s * (0.7 + 0.3 * tw), 0, TAU);
      ctx.fill();
    }
    ctx.restore();

    const chalk = cached(f, 's07-static', g => staticChalk(g, fr));
    const layer = scratch(f, 's07-pastel', g => {
      const c = g.ctx;
      g.stage.blit(c, chalk);
      enter(c, fr);
      for (const p of PLANETS) trail(c, p, m);
      c.fillStyle = rgba(LILAC, 0.7);
      c.beginPath();
      for (const rk of ROCKS) {
        const [x, y] = rockAt(rk, m), s = 0.7 + rk.size * 0.7;
        c.moveTo(x + s, y);
        c.arc(x, y, s, 0, TAU);
      }
      c.fill();
      for (const p of PLANETS) planet(c, p, m);
      c.setTransform(1, 0, 0, 1, 0, 0);
      knockOut(g, c, toothMask(g, { seed: 1703, kind: 'streak', angle: -0.6, density: 70, size: 1.1, length: 8 }), 0.45);
      knockOut(g, c, toothMask(g, { seed: 1704, density: 90, size: 1.2 }), 0.45);
    });
    // bloom: a blurred quarter-size copy screened under the sharp chalk
    const qw = Math.round(stage.outW / 4), qh = Math.round(stage.outH / 4), bloom = stage.layer('s07-bloom', qw, qh), bc = stage.context(bloom);
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
    // a last dusting of chalk grain over everything
    still(f, 's07-dust', g => {
      const c = g.ctx;
      enter(c, fr);
      const r = rng(1705);
      c.fillStyle = CREAM;
      c.globalAlpha = 0.06;
      for (let k = 0; k < 900; k++) {
        const x = r() * BOX, y = r() * BOX;
        c.fillRect(x, y, 1 + r() * 1.5, 1 + r() * 1.5);
      }
    });
  },
};
