/**
 * G12 "Jellyfish" (the deep; pastel on black). Three jellyfish in the dark water, drawn in glowing pastel, whole from
 * the start. Each pulses at its own rate: the bell snaps shut, it lifts, and it sinks back while the bell relaxes; the
 * tentacles trail through the water behind it. Marine snow drifts past.
 *
 * Tentacles need no simulation: a jelly's position is a periodic function of the loop phase, so every point down a
 * tentacle is simply where the bell was a little earlier (plus a travelling wave), which is exactly how a trailing
 * line behaves, and it is seamless for free.
 */
import { clamp, lerp, TAU, type Vec2 } from '../../core/math';
import { rng } from '../../core/random';
import type { Scene, SceneFrame } from '../../core/scene';
import { fit, ground, knockOut, nf, perSize, phase, scratch, still, toothMask, wave, wrap, type Fit } from './common';
import { GALLERY } from './palettes';

const PAL = GALLERY.abyss;
const [CYAN, PINK, VIOLET] = PAL.fills as [string, string, string];
const W = 1080, H = 1920, LOOP = 180;

interface Jelly { x: number; y: number; R: number; pulses: number; thrust: number; color: string; rim: string; drift: number; seed: number }
const JELLIES: Jelly[] = [
  { x: 290, y: 1240, R: 118, pulses: 6, thrust: 30, color: VIOLET, rim: PINK, drift: 50, seed: 1202 },
  { x: 830, y: 1500, R: 80, pulses: 9, thrust: 20, color: PINK, rim: CYAN, drift: 40, seed: 1203 },
  { x: 590, y: 560, R: 196, pulses: 5, thrust: 50, color: CYAN, rim: PINK, drift: 70, seed: 1201 },
];

/** Bell contraction 0..1 over one pulse: a quick snap shut, a long relax. */
const squeeze = (u: number): number => (u < 0.18 ? Math.sin((Math.PI / 2) * (u / 0.18)) : Math.pow(Math.cos((Math.PI / 2) * ((u - 0.18) / 0.82)), 2));

/** Where the bell is at phase p: each pulse lifts it, it sinks back between, net zero over the loop. */
function bellAt(j: Jelly, p: number): { x: number; y: number; c: number; tilt: number } {
  const t = wrap(p, 1) * j.pulses, k = Math.floor(t), u = t - k;
  // lift accumulates through each contraction; sinking at a constant rate cancels it over the loop
  const lift = j.thrust * (k + Math.min(1, u / 0.35)) - j.thrust * j.pulses * wrap(p, 1);
  return {
    x: j.x + j.drift * wave(p, 1, j.seed * 0.01) + 16 * wave(p, 3, j.seed * 0.02),
    y: j.y - lift * 2.2 + 30 * wave(p, 2, j.seed * 0.03),
    c: squeeze(u),
    tilt: 0.08 * wave(p, 1, j.seed * 0.05 + 0.25),
  };
}

function bellPath(R: number, c: number): Vec2[] {
  const w = R * (1 - 0.24 * c), hgt = R * 0.82 * (1 + 0.18 * c), pts: Vec2[] = [];
  for (let k = 0; k <= 40; k++) {
    const a = Math.PI + (k / 40) * Math.PI;
    pts.push([Math.cos(a) * w, Math.sin(a) * hgt * (1 - 0.15 * Math.pow(Math.sin(a), 8))]);
  }
  // the scalloped margin, curling in as it closes
  for (let k = 0; k <= 32; k++) {
    const u = k / 32, x = lerp(w, -w, u);
    pts.push([x * (1 - 0.08 * c), R * 0.12 * (1 + 0.8 * c) + Math.abs(Math.sin(u * Math.PI * 8)) * R * 0.06]);
  }
  return pts;
}

function rgba(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${clamp(a, 0, 1)})`;
}

/** Sub-frame ticks per drawn frame: the tentacles' look-back is counted in whole ticks, so it wraps exactly. */
const TICKS = 120;

function drawJelly(g: SceneFrame, j: Jelly, tick: number): void {
  const c = g.ctx, R = j.R;
  const past = (lagTicks: number): number => wrap(tick - lagTicks, LOOP * TICKS) / (LOOP * TICKS);
  // every motion below is whole cycles per loop, so the tick-exact phase (0 again at the seam) is its true clock
  const p = past(0), b = bellAt(j, p);
  c.lineCap = 'round';
  c.lineJoin = 'round';
  // tentacles and oral arms: each point is where the rim was a moment earlier
  const lag = 48, tentacles = 10;
  for (let t = 0; t < tentacles; t++) {
    const across = lerp(-0.8, 0.8, t / (tentacles - 1)), len = 22 + (t % 3) * 6;
    c.beginPath();
    for (let i = 0; i <= len; i++) {
      const bb = bellAt(j, past(i * lag)), w = R * (1 - 0.24 * bb.c);
      const sway = Math.sin(TAU * (p * 3 - i * 0.045) + t) * i * 0.9 * (R / 100);
      const x = bb.x + across * w * (1 - 0.1 * i / len) + sway, y = bb.y + R * 0.18 + i * R * 0.1;
      if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
    }
    c.strokeStyle = rgba(t % 2 ? j.rim : j.color, 0.55);
    c.lineWidth = (t % 3 === 0 ? 2.6 : 1.6) * (R / 100);
    c.stroke();
  }
  // oral arms: four ruffled ribbons, each a pair of frilled edges that drift apart and together
  for (let t = 0; t < 4; t++) {
    const across = lerp(-0.34, 0.34, t / 3), len = 12 + (t % 2) * 5;
    for (const side of [-1, 1]) {
      c.beginPath();
      for (let i = 0; i <= len; i++) {
        const bb = bellAt(j, past(i * 66));
        const frill = side * (0.03 + 0.05 * Math.abs(Math.sin(i * 0.9 + TAU * p * 5 + t))) * R;
        const x = bb.x + across * R * (1 + i / len * 0.3) + frill + Math.sin(TAU * (p * 2 - i * 0.06) + t) * i * 0.9 * (R / 100), y = bb.y + R * 0.2 + i * R * 0.085;
        if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
      }
      c.strokeStyle = rgba(j.rim, 0.4);
      c.lineWidth = (R / 100) * 2.2;
      c.stroke();
    }
  }
  // the bell: a translucent dome, brighter at its rim, with the four-leaf gonads glowing inside
  c.save();
  c.translate(b.x, b.y);
  c.rotate(b.tilt);
  const dome = new Path2D();
  bellPath(R, b.c).forEach(([x, y], k) => (k ? dome.lineTo(x, y) : dome.moveTo(x, y)));
  dome.closePath();
  const body = c.createRadialGradient(0, -R * 0.3, R * 0.1, 0, 0, R * 1.1);
  body.addColorStop(0, rgba(j.color, 0.18));
  body.addColorStop(0.75, rgba(j.color, 0.32));
  body.addColorStop(1, rgba(j.rim, 0.75));
  c.fillStyle = body;
  c.fill(dome);
  c.strokeStyle = rgba(j.color, 0.9);
  c.lineWidth = 3 * (R / 100);
  c.stroke(dome);
  c.strokeStyle = rgba('#ffffff', 0.5);
  c.lineWidth = 1.4 * (R / 100);
  c.beginPath();
  c.ellipse(0, R * 0.05, R * 0.72 * (1 - 0.24 * b.c), R * 0.5, 0, Math.PI * 1.05, Math.PI * 1.95);
  c.stroke();
  c.fillStyle = rgba(j.rim, 0.45);
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * TAU + 0.4 + p * TAU;
    c.beginPath();
    c.ellipse(Math.cos(a) * R * 0.22, -R * 0.3 + Math.sin(a) * R * 0.08, R * 0.16, R * 0.08, a, 0, TAU);
    c.fill();
  }
  // rim lights
  c.fillStyle = rgba('#ffffff', 0.85);
  for (let k = 0; k < 12; k++) {
    const x = lerp(-1, 1, k / 11) * R * (1 - 0.24 * b.c) * 0.94;
    c.beginPath();
    c.arc(x, R * 0.13 * (1 + 0.8 * b.c), 1.8 * (R / 100) + 1, 0, TAU);
    c.fill();
  }
  c.restore();
}

const layout = perSize((w, h): { F: Fit } => ({ F: fit(w, h, W, H) }));

export const jellyfishScene: Scene = {
  name: 'jellyfish',
  duration: LOOP / 12,
  loopFrom: 0,
  poster: 44 / 12,
  draw(f) {
    const { ctx, stage } = f;
    const { F } = layout(stage.w, stage.h), p = phase(f), [ox, oy] = F.P(0, 0), s = F.s;
    ground(f, PAL.paper, { seed: 1200, texture: 1.4, vignette: 0.6 });
    still(f, 'g12-water', g => {
      const c = g.ctx;
      c.translate(ox, oy);
      c.scale(s, s);
      const shaft = c.createLinearGradient(0, 0, 0, H);
      shaft.addColorStop(0, 'rgba(58,91,217,0.22)');
      shaft.addColorStop(0.6, 'rgba(58,91,217,0.04)');
      shaft.addColorStop(1, 'rgba(58,91,217,0)');
      c.fillStyle = shaft;
      c.filter = `blur(${(60 * g.stage.scale * s).toFixed(1)}px)`;
      c.beginPath();
      c.moveTo(260, 0); c.lineTo(760, 0); c.lineTo(1080, H); c.lineTo(-100, H);
      c.fill();
    });

    const layer = scratch(f, 'g12-life', g => {
      const c = g.ctx;
      c.translate(ox, oy);
      c.scale(s, s);
      // marine snow, rising slowly past (one lap per loop per depth)
      const r = rng(1210);
      c.fillStyle = rgba('#dff6ff', 0.6);
      for (let k = 0; k < 150; k++) {
        const depth = 1 + Math.floor(r() * 2), x = r() * W + 20 * wave(p, depth, r()), y = wrap(r() * (H + 100) - p * (H + 100) * depth, H + 100) - 50;
        c.globalAlpha = 0.2 + r() * 0.5;
        c.beginPath();
        c.arc(x, y, 1 + depth * 0.9 * r(), 0, TAU);
        c.fill();
      }
      c.globalAlpha = 1;
      c.globalCompositeOperation = 'lighter';
      for (const j of JELLIES) drawJelly(g, j, Math.round(nf(f) * TICKS));
      c.globalCompositeOperation = 'source-over';
      knockOut(g, c, toothMask(g, { seed: 1220, density: 70, size: 1.2 }), 0.45);
      knockOut(g, c, toothMask(g, { seed: 1221, kind: 'streak', angle: 1.2, density: 40, size: 1, length: 10 }), 0.3);
    });
    const qw = Math.round(stage.outW / 4), qh = Math.round(stage.outH / 4), bloom = stage.layer('g12-bloom', qw, qh), bc = stage.context(bloom);
    bc.setTransform(1, 0, 0, 1, 0, 0);
    bc.clearRect(0, 0, qw, qh);
    bc.filter = `blur(${((14 * stage.scale * s) / 4).toFixed(2)}px)`;
    bc.drawImage(layer, 0, 0, qw, qh);
    bc.filter = 'none';
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(bloom, 0, 0, stage.outW, stage.outH);
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(layer, 0, 0);
    ctx.restore();
  },
};
