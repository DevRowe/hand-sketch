/**
 * G20 "Koi" (water; sumi brush). A pond seen from above in soot ink and vermilion on rice paper, whole from the start:
 * lily pads laid in grey wash, a few reeds, and two koi, one white with red patches, one ink-dark, circling each other
 * like the two halves of a yin-yang. Their bodies follow their own path, undulating as they swim; tails sweep, fins
 * paddle, and rings spread where a tail flicked at the surface.
 *
 * A koi is its path: the head leads around a closed loop and every point of the spine is where the head was a little
 * earlier (read from the same periodic function), so bodies bend exactly along their swim and the loop is seamless.
 */
import { catmullRom } from '../../core/geometry';
import { emissions } from '../../core/emitter';
import { clamp, TAU, type Vec2 } from '../../core/math';
import { rng } from '../../core/random';
import type { Scene } from '../../core/scene';
import { drawStroke, prepareStroke, type StrokeStyle } from '../../core/stroke';
import { fit, ground, ink, nf, perSize, polyPath, scissor, still, wash, wrap, type Fit } from './common';
import { GALLERY } from './palettes';

const PAL = GALLERY.sumi;
const INK = PAL.ink, SEAL = PAL.accents[0]!, ORANGE = PAL.accents[1]!;
const W = 1080, H = 1080, LOOP = 192, TICKS = 120;
const C: Vec2 = [540, 540];
const BRUSH: StrokeStyle = { color: INK, size: 7, thinning: 0.7, smoothing: 0.6, wobble: 0.6, wobbleWavelength: 200, tremor: 0.15, pressureVariation: 0.6, dryBrush: 0.35, paper: PAL.paper, taperStart: 30, taperEnd: 60 };

interface Koi { lead: number; body: string; dark: boolean; seed: number }
const KOI: Koi[] = [{ lead: 0, body: '#f6f1e6', dark: false, seed: 2001 }, { lead: 0.5, body: '#2b2926', dark: true, seed: 2002 }];

/** Head position on the swim path at path phase q: a circle that breathes into a gentle S, once around per loop. */
function swim(q: number): Vec2 {
  const a = TAU * q, r = 250 + 40 * Math.sin(2 * a + 0.4);
  return [C[0] + Math.cos(a) * r, C[1] + Math.sin(a) * r * 0.92];
}

const layout = perSize((w, h): { F: Fit } => ({ F: fit(w, h, W, H) }));

export const koiScene: Scene = {
  name: 'koi',
  duration: LOOP / 12,
  loopFrom: 0,
  poster: 40 / 12,
  draw(f) {
    const { ctx, stage } = f;
    const { F } = layout(stage.w, stage.h), [ox, oy] = F.P(0, 0), s = F.s;
    // ticks: the clock every periodic function reads, exact at the seam
    const tick = Math.round(nf(f) * TICKS), phaseAt = (lag: number) => wrap(tick - lag, LOOP * TICKS) / (LOOP * TICKS);
    const p = phaseAt(0);
    ground(f, PAL.paper, { seed: 2000, texture: 1.3, vignette: 0.14, vignetteColor: '#5a4a2e' });

    // the pond's still things: pads in grey wash with ink rims, reeds in one corner
    still(f, 'g20-pond', g => {
      const c = g.ctx, r = rng(2010);
      c.translate(ox, oy);
      c.scale(s, s);
      for (const [x, y, rad] of [[170, 190, 92], [300, 120, 54], [880, 860, 110], [960, 720, 58], [170, 900, 70], [540, 540, 60]] as const) {
        const notch = r() * TAU, pad: Vec2[] = [];
        for (let k = 0; k <= 60; k++) {
          const a = notch + 0.3 + (k / 60) * (TAU - 0.6);
          pad.push([x + Math.cos(a) * rad, y + Math.sin(a) * rad]);
        }
        pad.push([x, y]);
        wash(c, pad, '#7d7a70', { alpha: 0.4, seed: 2020 + x, bleed: 4, layers: 3, edge: 0.9 });
        drawStroke(c, prepareStroke(pad.slice(0, -1), { ...BRUSH, size: 3.5, alpha: 0.7, dryBrush: 0.5 }, 2030 + x), 1);
        for (let v = 0; v < 5; v++) {
          const a = notch + 0.6 + (v / 5) * (TAU - 1.2);
          drawStroke(c, prepareStroke([[x, y], [x + Math.cos(a) * rad * 0.8, y + Math.sin(a) * rad * 0.8]], { ...BRUSH, size: 1.8, alpha: 0.4, dryBrush: 0 }, 2040 + x + v), 1);
        }
      }
      for (let k = 0; k < 5; k++) {
        const x = 920 + k * 30 + r() * 14, len = 140 + r() * 160, lean = -0.25 - r() * 0.35;
        drawStroke(c, prepareStroke(catmullRom([[x, -20], [x + Math.sin(lean) * len * 0.4, len * 0.45], [x + Math.sin(lean) * len, len]], 6), { ...BRUSH, size: 5 + r() * 3, alpha: 0.35 + r() * 0.35, taperStart: 5, taperEnd: 90 }, 2050 + k), 1);
      }
    });

    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(s, s);
    // rings where a tail flicked, a few seconds back along each path
    for (const e of emissions(f.frame, LOOP, { every: 48, life: 60, offset: 10 })) {
      const koi = KOI[e.index % 2]!, at = swim(wrap(koi.lead + (e.index * 48 + 10) / LOOP - 0.06, 1));
      for (let k = 0; k < 2; k++) {
        const u = clamp(e.u * 1.2 - k * 0.2, 0, 1);
        if (u <= 0) continue;
        ctx.strokeStyle = `rgba(20,19,17,${0.35 * (1 - u)})`;
        ctx.lineWidth = 2.5 * (1 - u) + 0.5;
        ctx.beginPath();
        ctx.ellipse(at[0], at[1], 20 + u * 150, 18 + u * 135, 0, 0, TAU);
        ctx.stroke();
      }
    }

    for (const koi of KOI) {
      // spine: 26 samples back along the path; the swimming wave travels down it
      const n = 26, spine: Vec2[] = [];
      for (let i = 0; i < n; i++) {
        const q = wrap(phaseAt(i * 150) + koi.lead, 1), [x, y] = swim(q);
        const [x2, y2] = swim(wrap(q + 0.002, 1)), dx = x2 - x, dy = y2 - y, m = Math.hypot(dx, dy) || 1;
        const sway = Math.sin(TAU * (p * 24 + koi.lead) - i * 0.42) * (i / n) * 18;
        spine.push([x - (dy / m) * sway, y + (dx / m) * sway]);
      }
      const width = (u: number) => 58 * (u < 0.18 ? Math.sqrt(u / 0.18) * 0.92 + 0.08 : Math.pow(1 - (u - 0.18) / 0.82, 1.3) * 0.88 + 0.12);
      const left: Vec2[] = [], right: Vec2[] = [];
      spine.forEach(([x, y], i) => {
        const a = spine[Math.max(0, i - 1)]!, b = spine[Math.min(n - 1, i + 1)]!, dx = a[0] - b[0], dy = a[1] - b[1], m = Math.hypot(dx, dy) || 1, w = width(i / (n - 1)) / 2;
        left.push([x - (dy / m) * w, y + (dx / m) * w]);
        right.push([x + (dy / m) * w, y - (dx / m) * w]);
      });
      const tail = spine[n - 1]!, pre = spine[n - 3]!, ta = Math.atan2(tail[1] - pre[1], tail[0] - pre[0]), flick = 0.35 * Math.sin(TAU * (p * 24 + koi.lead) - n * 0.42);
      // fins first, under the body: pectorals paddling, the tail fanning
      ctx.save();
      ctx.globalAlpha = koi.dark ? 0.55 : 0.4;
      ctx.fillStyle = koi.dark ? INK : '#9a968b';
      for (const side of [-1, 1]) {
        const at = spine[5]!, nx = (left[5]![0] - at[0]) * side, ny = (left[5]![1] - at[1]) * side, paddle = 0.5 + 0.5 * Math.sin(TAU * p * 36 + side);
        ctx.beginPath();
        ctx.moveTo(at[0] + nx * 0.8, at[1] + ny * 0.8);
        ctx.quadraticCurveTo(at[0] + nx * (2.4 + paddle), at[1] + ny * (2.4 + paddle), spine[8]![0] + nx * 1.6, spine[8]![1] + ny * 1.6);
        ctx.fill();
      }
      ctx.translate(tail[0], tail[1]);
      ctx.rotate(ta + flick);
      ctx.beginPath();
      ctx.moveTo(-24, -4);
      ctx.bezierCurveTo(10, -10, 40, -40, 74, -40);
      ctx.quadraticCurveTo(46, 0, 74, 40);
      ctx.bezierCurveTo(40, 40, 10, 10, -24, 4);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      const body = polyPath([...left, ...[...right].reverse()]);
      ctx.fillStyle = koi.body;
      ctx.fill(body);
      // the white koi's red patches, the dark koi's ink pooling along its back
      ctx.save();
      ctx.clip(body);
      if (!koi.dark) {
        for (const [i, rad, dx] of [[3, 28, -4], [9, 30, 8], [15, 22, -6]] as const) {
          const [x, y] = spine[i]!;
          ctx.fillStyle = i === 9 ? ORANGE : SEAL;
          ctx.globalAlpha = 0.85;
          ctx.beginPath();
          ctx.ellipse(x + dx, y, rad, rad * 0.8, i, 0, TAU);
          ctx.fill();
        }
      } else {
        ctx.strokeStyle = '#6c665c';
        ctx.lineWidth = 6;
        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        spine.slice(2, 20).forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.stroke();
      }
      ctx.restore();
      // brush outline, heavier on one flank, and the eyes
      // one loaded stroke round the snout and down a flank, a drier one down the other
      const [hx, hy] = spine[0]!, [nx2, ny2] = spine[1]!, hdx = hx - nx2, hdy = hy - ny2, hm = Math.hypot(hdx, hdy) || 1;
      const snout: Vec2 = [hx + (hdx / hm) * 16, hy + (hdy / hm) * 16];
      drawStroke(ctx, prepareStroke(catmullRom([right[1]!, snout, ...left.slice(1, n - 2)], 3), { ...BRUSH, color: INK, size: 8 }, koi.seed), 1);
      drawStroke(ctx, prepareStroke(catmullRom(right.slice(2, n - 4), 3), { ...BRUSH, color: INK, size: 5.5, dryBrush: 0.6 }, koi.seed + 1), 1);
      ctx.fillStyle = koi.dark ? '#d9d2c2' : INK;
      for (const side of [0.55, -0.55]) {
        const [x, y] = spine[1]!, [hx, hy] = spine[0]!, dx = hx - x, dy = hy - y, m = Math.hypot(dx, dy) || 1;
        ctx.beginPath();
        ctx.arc(x + (-dy / m) * 14 * side * 1.6, y + (dx / m) * 14 * side * 1.6, 3.4, 0, TAU);
        ctx.fill();
      }
    }
    ctx.restore();

    // the seal
    ink(f, 'g20-seal', g => {
      const c = g.ctx;
      c.translate(ox, oy);
      c.scale(s, s);
      c.fillStyle = SEAL;
      c.fill(polyPath(scissor([[70, 950], [150, 950], [150, 1030], [70, 1030]], 2090, 12, 1.5)));
      c.globalCompositeOperation = 'destination-out';
      c.strokeStyle = '#000';
      c.lineWidth = 5;
      c.lineCap = 'round';
      c.beginPath();
      c.arc(110, 990, 22, 0.3, TAU - 0.3);
      c.moveTo(96, 990); c.quadraticCurveTo(110, 978, 124, 992);
      c.stroke();
    }, { tooth: { seed: 2091, density: 60, size: 1.4, alpha: 0.5 }, alpha: 0.92 });
  },
};
