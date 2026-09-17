/**
 * G01 "Rolling Sea" (the sea; woodblock). A two-block ukiyo-e print that starts whole: five bands of curling waves
 * roll to the right in parallax under a vermilion sun and a far snow peak, and a rowing boat rides the middle swell.
 *
 * Each band is a repeating pattern of three wave motifs of different sizes; in one loop it travels exactly one pattern
 * length, so the seam is invisible by construction. Motif strokes are prepared once in local units and only
 * translated, so the carved line holds still as the sea moves. The key block prints a little out of register.
 */
import { catmullRom } from '../../core/geometry';
import { clamp, lerp, TAU, type Vec2 } from '../../core/math';
import { rng } from '../../core/random';
import type { Scene } from '../../core/scene';
import { drawStroke, prepareStroke, type PreparedStroke, type StrokeStyle } from '../../core/stroke';
import { composite, fit, ground, perSize, phase, polyPath, still, toothMask, wave, wrap } from './common';
import { mix } from '../../art/color';
import { GALLERY } from './palettes';

const PAL = GALLERY.woodblock;
const MIST = '#e2d2ae', SKY_BAND = PAL.accents[2]!, SUN = PAL.accents[0]!, PEAK = PAL.accents[1]!, FOAM = PAL.fills[5]!, KEY = PAL.ink;
const LOOP = 144;
const REGISTER: Vec2 = [2.5, -1.5];

const KEYLINE: StrokeStyle = { color: KEY, size: 3.4, thinning: 0.7, smoothing: 0.6, streamline: 0.2, wobble: 0.8, wobbleWavelength: 260, tremor: 0.15, pressureVariation: 0.6, pressureWavelength: 140, taperStart: 30, taperEnd: 40 };

interface Motif {
  w: number;
  crest: Vec2[];
  keyline: PreparedStroke;
  stripes: PreparedStroke[];
  foam: { x: number; y: number; r: number }[];
  claws: PreparedStroke[];
  spray: { x: number; y: number; r: number; k: number }[];
}

interface Band {
  base: number;
  amp: number;
  color: string;
  stripe: string;
  motifs: Motif[];
  /** Local x offset of each motif, and the pattern length. */
  starts: number[];
  span: number;
  /** Highest crest y at each whole local x of the pattern (for riders). */
  surface: Float32Array;
  bob: number;
  seed: number;
}

/** One curling wave of width w and height a, base at y = 0, lip curling to +x. */
function motifPath(w: number, a: number): Vec2[] {
  const k: [number, number][] = [
    [0, 0], [0.16, -0.1], [0.34, -0.3], [0.5, -0.62], [0.62, -0.9], [0.72, -1], [0.81, -0.95], [0.875, -0.8],
    [0.87, -0.64], [0.83, -0.58], [0.8, -0.63], [0.815, -0.5], [0.87, -0.32], [0.94, -0.12], [1, 0],
  ];
  return catmullRom(k.map(([x, y]): Vec2 => [x * w, y * a]), 8);
}

function buildMotif(w: number, a: number, stripe: string, seed: number, foamy: boolean): Motif {
  const crest = motifPath(w, a), r = rng(seed);
  const keyline = prepareStroke(crest, { ...KEYLINE, size: KEYLINE.size * clamp(a / 150, 0.55, 1.2) }, seed);
  // carved stripes inside the body, following the back slope
  const back = crest.filter(([x]) => x > w * 0.12 && x < w * 0.74);
  const stripes = [0.16, 0.3, 0.44].map((d, j) => {
    const off = back.map(([x, y], k): Vec2 => {
      const p = back[Math.max(0, k - 1)]!, q = back[Math.min(back.length - 1, k + 1)]!;
      const dx = q[0] - p[0], dy = q[1] - p[1], m = Math.hypot(dx, dy) || 1;
      // normal pointing into the body (down the slope)
      return [x - (dy / m) * d * a, y + (dx / m) * d * a];
    }).filter(([, y]) => y < -a * 0.05);
    const trimmed = off.slice(Math.floor(off.length * (0.1 + j * 0.12)), Math.floor(off.length * (0.97 - j * 0.05)));
    return prepareStroke(trimmed, { ...KEYLINE, color: stripe, size: 2.6 * clamp(a / 150, 0.5, 1.1), taperStart: 40, taperEnd: 60, pressureVariation: 0.8 }, seed + 11 + j);
  });
  // foam beads along the crest to the lip, shrinking towards it
  const foam: Motif['foam'] = [];
  if (foamy) {
    const lip = crest.filter(([x, y]) => x > w * 0.6 && y < -a * 0.62);
    for (let k = 0; k < 7; k++) {
      const p = lip[Math.min(lip.length - 1, Math.floor(((k + 0.3) / 7) * lip.length))]!;
      const rad = a * lerp(0.075, 0.03, k / 6) * (0.85 + r() * 0.3);
      foam.push({ x: p[0], y: p[1] - rad * 0.35, r: rad });
    }
  }
  // the lip's claws: small foam fingers reaching forward and down
  const tip = crest.reduce((best, pt) => (pt[0] > best[0] && pt[1] < -a * 0.7 ? pt : best), crest[0]!);
  const claws = foamy ? [0, 1, 2, 3].map(j => {
    const ang = -0.5 + j * 0.42, len = a * (0.16 - j * 0.018);
    const pts: Vec2[] = Array.from({ length: 7 }, (_, t): Vec2 => {
      const u = t / 6, bend = ang + u * 1.3;
      return [tip[0] - a * 0.02 + Math.cos(bend) * len * u, tip[1] + a * 0.02 + Math.sin(bend) * len * u];
    });
    return prepareStroke(pts, { ...KEYLINE, color: FOAM, size: a * 0.05, thinning: 0.8, taperStart: 2, taperEnd: len * 0.7, wobble: 0.3 }, seed + 40 + j);
  }) : [];
  const spray = foamy ? Array.from({ length: 6 }, (_, k) => ({ x: w * (0.78 + r() * 0.2), y: -a * (1.02 + r() * 0.25), r: a * (0.012 + r() * 0.018), k })) : [];
  return { w, crest, keyline, stripes, foam, claws, spray };
}

const layout = perSize((w, h) => {
  const { P, s } = fit(w, h, 1920, 1080);
  const specs = [
    { base: 660, amp: 46, widths: [300, 250, 330], color: PAL.fills[0]!, foamy: false },
    { base: 750, amp: 80, widths: [430, 380, 470], color: PAL.fills[1]!, foamy: true },
    { base: 860, amp: 118, widths: [560, 500, 640], color: PAL.fills[2]!, foamy: true },
    { base: 985, amp: 158, widths: [720, 650, 800], color: PAL.fills[3]!, foamy: true },
    { base: 1130, amp: 205, widths: [920, 840, 1000], color: PAL.fills[4]!, foamy: true },
  ];
  const bands: Band[] = specs.map((sp, b) => {
    const stripe = mix(sp.color, FOAM, b < 2 ? 0.45 : 0.32);
    const motifs = sp.widths.map((mw, k) => buildMotif(mw, sp.amp * (0.86 + 0.14 * ((k * 7 + b) % 3) / 2), stripe, 1000 + b * 10 + k, sp.foamy));
    const starts: number[] = [];
    let at = 0;
    for (const m of motifs) { starts.push(at); at += m.w; }
    const surface = new Float32Array(Math.ceil(at) + 1).fill(0);
    motifs.forEach((m, k) => {
      for (const [x, y] of m.crest) {
        const i = Math.round(starts[k]! + x);
        if (i >= 0 && i < surface.length) surface[i] = Math.min(surface[i]!, y);
      }
    });
    for (let i = 1; i < surface.length; i++) if (surface[i] === 0 && surface[i - 1]! < 0) surface[i] = surface[i - 1]!;
    return { base: sp.base, amp: sp.amp, color: sp.color, stripe, motifs, starts, span: at, surface, bob: 5 + b * 3, seed: b };
  });
  return { P, s, bands };
});

/** Pattern shift of band b at loop phase p: exactly one pattern per loop. */
const shiftOf = (band: Band, p: number): number => p * band.span;

function surfaceY(band: Band, x: number, p: number): number {
  const local = wrap(x - shiftOf(band, p), band.span), i = Math.floor(local), t = local - i;
  const a = band.surface[i] ?? 0, b = band.surface[Math.min(band.surface.length - 1, i + 1)] ?? 0;
  return band.base + lerp(a, b, t) + band.bob * wave(p, 2, band.seed * 0.17);
}

const HULL: Vec2[] = catmullRom([[-160, -8], [-130, 12], [-40, 20], [60, 20], [130, 10], [176, -30], [156, -18], [80, -6], [-60, -6], [-160, -8]], 5);
const GUNWALE: Vec2[] = catmullRom([[-150, -4], [-60, -2], [80, -2], [150, -12], [166, -24], [140, 4], [60, 10], [-40, 10], [-128, 6]], 4);

export const rollingSeaScene: Scene = {
  name: 'rolling-sea',
  duration: LOOP / 12,
  loopFrom: 0,
  poster: 30 / 12,
  draw(f) {
    const { ctx, stage } = f;
    const L = layout(stage.w, stage.h), p = phase(f);
    ground(f, PAL.paper, { seed: 101, texture: 1.1 });
    const [ox, oy] = L.P(0, 0);

    // sky: the bokashi band, the sun and the far peak are one static block
    still(f, 'g01-sky', g => {
      const c = g.ctx;
      c.translate(ox, oy);
      c.scale(L.s, L.s);
      const grad = c.createLinearGradient(0, 0, 0, 330);
      grad.addColorStop(0, SKY_BAND);
      grad.addColorStop(1, 'rgba(46,74,107,0)');
      c.globalAlpha = 0.75;
      c.fillStyle = grad;
      c.fillRect(-400, -200, 2720, 540);
      c.globalAlpha = 1;
      c.fillStyle = SUN;
      c.beginPath();
      c.arc(1545, 255, 112, 0, TAU);
      c.fill();
      const peak: Vec2[] = [[1000, 700], [1180, 540], [1290, 452], [1330, 440], [1372, 456], [1470, 545], [1660, 700]];
      c.fillStyle = PEAK;
      c.fill(polyPath(peak));
      const snow: Vec2[] = [[1244, 492], [1290, 452], [1330, 440], [1372, 456], [1420, 500], [1396, 512], [1376, 494], [1352, 520], [1330, 500], [1306, 526], [1284, 498], [1262, 514]];
      c.fillStyle = FOAM;
      c.fill(polyPath(snow));
      c.translate(REGISTER[0], REGISTER[1]);
      c.strokeStyle = KEY;
      c.lineWidth = 2.2;
      c.lineJoin = 'round';
      c.beginPath();
      peak.forEach(([x, y], k) => (k ? c.lineTo(x, y) : c.moveTo(x, y)));
      c.stroke();
    });

    // mist bands (kasumi): long stepped bars of a darker stock that drift a little
    const sway = 26 * wave(p, 1);
    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(L.s, L.s);
    for (const [k, [x, y, len, th]] of ([[140, 250, 640, 40], [360, 318, 420, 30], [1040, 150, 380, 28], [1500, 400, 360, 26]] as const).entries()) {
      const dx = sway * (k % 2 ? -1 : 1) * (y / 360);
      ctx.fillStyle = MIST;
      ctx.beginPath();
      ctx.roundRect(x + dx, y, len, th, th / 2);
      ctx.roundRect(x + dx + len * 0.18, y - th * 0.55, len * 0.5, th, th / 2);
      ctx.fill();
    }

    L.bands.forEach((band, b) => {
      const shift = shiftOf(band, p), bob = band.bob * wave(p, 2, band.seed * 0.17);
      // pattern copies from left of the frame to past its right edge
      const x0 = wrap(shift, band.span) - band.span, reps = Math.ceil((2000 - x0) / band.span) + 1;
      // body: every motif's crest joined into one outline, closed below the frame
      const body = new Path2D();
      let first = true;
      for (let r = 0; r < reps; r++) {
        band.motifs.forEach((m, k) => {
          const mx = x0 + r * band.span + band.starts[k]!;
          if (mx > 2000 || mx + m.w < -80) return;
          for (const [x, y] of m.crest) {
            if (first) { body.moveTo(mx + x, band.base + bob + y); first = false; } else body.lineTo(mx + x, band.base + bob + y);
          }
        });
      }
      body.lineTo(2100, 1200);
      body.lineTo(-200, 1200);
      body.closePath();
      ctx.fillStyle = band.color;
      ctx.fill(body);

      for (let r = 0; r < reps; r++) {
        band.motifs.forEach((m, k) => {
          const mx = x0 + r * band.span + band.starts[k]!;
          if (mx > 2000 || mx + m.w < -80) return;
          ctx.save();
          ctx.translate(mx, band.base + bob);
          for (const st of m.stripes) drawStroke(ctx, st, 1);
          for (const cl of m.claws) drawStroke(ctx, cl, 1);
          ctx.fillStyle = FOAM;
          for (const fb of m.foam) {
            ctx.beginPath();
            ctx.arc(fb.x, fb.y, fb.r, 0, TAU);
            ctx.fill();
          }
          for (const sp of m.spray) {
            const lift = (wave(p, 6, sp.k / 6) + 1) * m.w * 0.006;
            ctx.beginPath();
            ctx.arc(sp.x, sp.y - lift, sp.r, 0, TAU);
            ctx.fill();
          }
          ctx.translate(REGISTER[0], REGISTER[1]);
          drawStroke(ctx, m.keyline, 1);
          ctx.strokeStyle = KEY;
          ctx.lineWidth = 1.4;
          for (const fb of m.foam) {
            ctx.beginPath();
            ctx.arc(fb.x, fb.y, fb.r, 0, TAU);
            ctx.stroke();
          }
          ctx.restore();
        });
      }

      // the boat rides the middle swell, between it and the next band
      if (b === 2) {
        const bx = 1060, span = 110;
        const yl = surfaceY(band, bx - span, p), yc = surfaceY(band, bx, p), yr = surfaceY(band, bx + span, p);
        const y = (yl + 2 * yc + yr) / 4 - 4, tilt = Math.atan2(yr - yl, span * 2) * 0.8;
        ctx.save();
        ctx.translate(bx, y);
        ctx.rotate(tilt);
        ctx.scale(1.35, 1.35);
        // rowers hunched low over their oars, pulling in time
        const pull = wave(p, 6);
        ctx.lineCap = 'round';
        for (let k = 0; k < 6; k++) {
          const rx = -118 + k * 40, lean = pull * 4;
          ctx.strokeStyle = KEY;
          ctx.lineWidth = 2.2;
          ctx.beginPath();
          ctx.moveTo(rx + 6, -10);
          ctx.lineTo(rx + 34 + pull * 9, 30);
          ctx.stroke();
          ctx.fillStyle = KEY;
          ctx.beginPath();
          ctx.ellipse(rx + lean, -12, 13, 11, -0.5, Math.PI, TAU);
          ctx.fill();
          ctx.fillStyle = FOAM;
          ctx.beginPath();
          ctx.arc(rx + lean + 7, -21, 4.5, 0, TAU);
          ctx.fill();
        }
        ctx.fillStyle = FOAM;
        ctx.fill(polyPath(HULL));
        ctx.fillStyle = PAL.fills[4]!;
        ctx.fill(polyPath(GUNWALE));
        ctx.strokeStyle = KEY;
        ctx.lineWidth = 2.2;
        ctx.lineJoin = 'round';
        ctx.stroke(polyPath(HULL));
        ctx.restore();
      }
    });
    ctx.restore();

    // the block's grain printed through everything, lighter where the baren pressed less
    composite(f, toothMask(f, { seed: 1301, kind: 'grain', density: 1.3, size: 1.1, length: 900, color: PAL.paper }), { alpha: 0.35 });
    composite(f, toothMask(f, { seed: 1302, kind: 'speck', density: 9, size: 1.6, color: PAL.paper }), { alpha: 0.4 });
  },
};
