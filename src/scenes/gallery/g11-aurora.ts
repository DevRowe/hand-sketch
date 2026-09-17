/**
 * G11 "Aurora" (night sky; pastel on black). Soft pastel on black toothy paper, whole from the start: mountains and a
 * line of pines around a still lake, and above them two curtains of aurora that ripple, rise and let pulses of light
 * run along their length, the lake holding a darker copy of it all.
 *
 * The curtains are hundreds of upright pastel strokes, each coloured up its length, laid on a scratch layer and
 * broken by the paper's tooth, then bloomed from a blurred quarter-size copy. Every wave in them is a whole number of
 * cycles per loop.
 */
import { clamp, lerp, TAU } from '../../core/math';
import { noise1, rng } from '../../core/random';
import type { Scene, SceneFrame } from '../../core/scene';
import { composite, fit, ground, knockOut, perSize, phase, scratch, still, toothMask, wave, type Fit } from './common';
import { GALLERY } from './palettes';

const PAL = GALLERY.pastelNight;
const [GREEN, TEAL, MAGENTA, SNOW] = PAL.fills as [string, string, string, string];
const W = 1920, H = 1080, SHORE = 770, LOOP = 192;

interface Ribbon { y0: number; height: number; x0: number; x1: number; waves: [number, number, number, number][]; top: string; seed: number }
const RIBBONS: Ribbon[] = [
  { y0: 400, height: 330, x0: -80, x1: 2000, waves: [[80, 700, 1, 0], [34, 260, -2, 0.3], [16, 120, 3, 0.1]], top: MAGENTA, seed: 1101 },
  { y0: 520, height: 240, x0: 260, x1: 1760, waves: [[50, 520, -1, 0.5], [24, 200, 2, 0.8], [12, 90, -3, 0.2]], top: TEAL, seed: 1102 },
];

const ridge = (x: number): number => 690 - 110 * Math.exp(-(((x - 520) / 220) ** 2)) - 150 * Math.exp(-(((x - 1400) / 240) ** 2)) - 50 * Math.exp(-(((x - 920) / 160) ** 2)) + noise1(x / 60, 1110) * 18 + noise1(x / 16, 1111) * 4;

const layout = perSize((w, h): { F: Fit } => ({ F: fit(w, h, W, H) }));

function rgba(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${clamp(a, 0, 1)})`;
}

function drawAurora(g: SceneFrame, p: number): void {
  const c = g.ctx;
  c.lineCap = 'round';
  for (const rb of RIBBONS) {
    for (let x = rb.x0; x <= rb.x1; x += 6) {
      let y = rb.y0;
      for (const [amp, len, cyc, off] of rb.waves) y += amp * Math.sin((x / len) * TAU + TAU * (p * cyc + off));
      const fold = 0.5 + 0.5 * Math.sin(x / 150 + TAU * (p * 2 + rb.seed * 0.01));
      const pulse = 0.55 + 0.45 * Math.sin(x / 210 - TAU * p * 4);
      const edge = clamp(Math.min(x - rb.x0, rb.x1 - x) / 260, 0, 1);
      const hgt = rb.height * (0.55 + 0.45 * Math.sin(x / 330 + TAU * (p + rb.seed * 0.1))) * (0.7 + 0.3 * fold);
      const a = edge * pulse * (0.35 + 0.65 * fold);
      if (a < 0.03) continue;
      const grad = c.createLinearGradient(0, y + 20, 0, y - hgt);
      grad.addColorStop(0, rgba(GREEN, 0));
      grad.addColorStop(0.08, rgba('#d9ffe9', a));
      grad.addColorStop(0.22, rgba(GREEN, a * 0.95));
      grad.addColorStop(0.6, rgba(rb.top, a * 0.45));
      grad.addColorStop(1, rgba(rb.top, 0));
      c.strokeStyle = grad;
      c.lineWidth = 7 + 5 * fold;
      c.beginPath();
      c.moveTo(x, y + 20);
      c.lineTo(x + 6 * Math.sin(x / 90), y - hgt);
      c.stroke();
    }
  }
}

export const auroraScene: Scene = {
  name: 'aurora',
  duration: LOOP / 12,
  loopFrom: 0,
  poster: 40 / 12,
  draw(f) {
    const { ctx, stage } = f;
    const { F } = layout(stage.w, stage.h), p = phase(f), [ox, oy] = F.P(0, 0), s = F.s;
    ground(f, PAL.paper, { seed: 1100, texture: 1.6, vignette: 0.5 });

    still(f, 'g11-stars', g => {
      const c = g.ctx, r = rng(1120);
      c.translate(ox, oy);
      c.scale(s, s);
      c.fillStyle = SNOW;
      for (let k = 0; k < 260; k++) {
        const x = r() * W, y = r() * 560, rad = 0.6 + Math.pow(r(), 4) * 2.6;
        c.globalAlpha = 0.3 + r() * 0.6;
        c.beginPath();
        c.arc(x, y, rad, 0, TAU);
        c.fill();
      }
    });

    // the aurora on its own layer, broken by the tooth of the paper, then bloomed
    const aurora = scratch(f, 'g11-aurora', g => {
      g.ctx.translate(ox, oy);
      g.ctx.scale(s, s);
      drawAurora(g, p);
      knockOut(g, g.ctx, toothMask(g, { seed: 1130, kind: 'streak', angle: Math.PI / 2, density: 90, size: 1.2, length: 9 }), 0.55);
      knockOut(g, g.ctx, toothMask(g, { seed: 1131, density: 80, size: 1.3 }), 0.5);
    });
    const qw = Math.round(stage.outW / 4), qh = Math.round(stage.outH / 4), bloom = stage.layer('g11-bloom', qw, qh), bc = stage.context(bloom);
    bc.setTransform(1, 0, 0, 1, 0, 0);
    bc.clearRect(0, 0, qw, qh);
    bc.filter = `blur(${(10 * stage.scale * s / 4).toFixed(2)}px)`;
    bc.drawImage(aurora, 0, 0, qw, qh);
    bc.filter = 'none';
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = 0.9;
    ctx.drawImage(bloom, 0, 0, stage.outW, stage.outH);
    ctx.globalAlpha = 1;
    ctx.drawImage(aurora, 0, 0);
    ctx.restore();

    // mountains and pines, black with pastel light along their edges
    still(f, 'g11-land', g => {
      const c = g.ctx, r = rng(1140);
      c.translate(ox, oy);
      c.scale(s, s);
      const land = new Path2D();
      land.moveTo(-20, SHORE);
      for (let x = -20; x <= W + 20; x += 6) land.lineTo(x, ridge(x));
      land.lineTo(W + 20, SHORE);
      land.closePath();
      c.fillStyle = '#0b0c0f';
      c.fill(land);
      // snowfields on the peaks, dragged on with the side of a stick
      c.strokeStyle = SNOW;
      c.lineCap = 'round';
      for (let k = 0; k < 700; k++) {
        const x = r() * W, top = ridge(x), depth = Math.pow(r(), 2) * 90;
        if (top > 600) continue;
        const slope = (ridge(x + 8) - ridge(x - 8)) / 16, len = 8 + r() * 26;
        c.globalAlpha = (0.05 + r() * 0.16) * (1 - depth / 100);
        c.lineWidth = 1 + r() * 2.5;
        c.beginPath();
        c.moveTo(x, top + depth + 4);
        c.lineTo(x + len, top + depth + 4 + slope * len);
        c.stroke();
      }
      // the aurora's light caught along the ridge
      c.strokeStyle = '#b7f5d3';
      for (const [dy, a, lw] of [[1, 0.5, 2.2], [5, 0.16, 5], [12, 0.06, 9]] as const) {
        c.globalAlpha = a;
        c.lineWidth = lw;
        c.beginPath();
        for (let x = -20; x <= W + 20; x += 6) (x === -20 ? c.moveTo(x, ridge(x) + dy) : c.lineTo(x, ridge(x) + dy));
        c.stroke();
      }
      // pines along the far shore
      c.globalAlpha = 1;
      c.fillStyle = '#07080a';
      for (let x = -10; x < W + 10; x += 9 + r() * 20) {
        const hgt = 40 + r() * 90 * (0.6 + 0.4 * Math.sin(x / 200));
        c.beginPath();
        c.moveTo(x, SHORE - hgt);
        for (let t = 1; t <= 6; t++) { const y = SHORE - hgt + (t / 6) * hgt, half = (t / 6) * hgt * 0.26; c.lineTo(x + half, y); c.lineTo(x + half * 0.4, y); }
        for (let t = 6; t >= 1; t--) { const y = SHORE - hgt + (t / 6) * hgt, half = (t / 6) * hgt * 0.26; c.lineTo(x - half * 0.4, y); c.lineTo(x - half, y); }
        c.closePath();
        c.fill();
      }
      c.fillRect(-20, SHORE - 6, W + 40, 12);
      knockOut(g, c, toothMask(g, { seed: 1141, density: 60, size: 1.1 }), 0.25);
    });

    // the lake: the sky upside down, darker, broken into horizontal strokes
    const lake = scratch(f, 'g11-lake', g => {
      const c = g.ctx, top = (oy + SHORE * s) * stage.scale;
      c.save();
      c.setTransform(1, 0, 0, -0.9, 0, top * 1.9);
      c.globalAlpha = 0.55;
      c.drawImage(aurora, 0, 0);
      c.drawImage(bloom, 0, 0, stage.outW, stage.outH);
      c.restore();
      c.translate(ox, oy);
      c.scale(s, s);
      c.globalCompositeOperation = 'destination-in';
      c.fillStyle = '#000';
      c.fillRect(-20, SHORE + 4, W + 40, H);
      c.globalCompositeOperation = 'source-over';
      knockOut(g, c, toothMask(g, { seed: 1150, kind: 'streak', angle: 0, density: 70, size: 2.4, length: 60 }), 0.8);
      // chalk ripple lines drifting a little
      c.strokeStyle = SNOW;
      c.lineCap = 'round';
      const r = rng(1151);
      for (let k = 0; k < 60; k++) {
        const y = SHORE + 20 + Math.pow(r(), 1.6) * (H - SHORE), x = r() * W + 30 * wave(p, 1, r()), len = 20 + r() * 120 * ((y - SHORE) / 300);
        c.globalAlpha = 0.06 + r() * 0.12;
        c.lineWidth = 1 + r() * 2;
        c.beginPath();
        c.moveTo(x, y);
        c.lineTo(x + len, y + lerp(-1, 1, r()));
        c.stroke();
      }
    });
    composite(f, lake, { blend: 'screen' });
  },
};
