/**
 * The eye: an extreme close-up, lids to brow, the iris dead centre, and the pupil dilating as the hit lands.
 * The iris is a cold (or warm, for a brown eye) wipe under radial fibres scratched from the pupil's edge, the pupil is
 * the plate's deepest black, and the catchlight is burnished back to paper.
 */
import { catmullRom } from '../../../core/geometry';
import { lerp, TAU, type Vec2 } from '../../../core/math';
import { noise1, rng } from '../../../core/random';
import { BOLD, blob, COLD, easeOut, erase, FINE, flood, FULL, INK, lines, once, PEN, pen, pool, pushIn, region, scratchLines, shade, shadeLinear, shadeRadial, WARM, type Etch, type Shot } from '../etch';

const C: Vec2 = [800, 470];
const IRIS = 196;

const UPPER = catmullRom([[250, 505], [370, 385], [560, 292], [800, 262], [1040, 290], [1230, 372], [1350, 468]], 10);
const LOWER = catmullRom([[250, 505], [400, 592], [600, 642], [820, 650], [1040, 622], [1230, 560], [1350, 468]], 10);
const CREASE = catmullRom([[210, 450], [380, 292], [610, 188], [850, 160], [1090, 186], [1300, 300], [1420, 430]], 10);
const BROW = catmullRom([[120, 150], [420, 40], [800, 0], [1180, 30], [1500, 120]], 10);
const OPENING = [...UPPER, ...LOWER.slice().reverse()];
/** The underside of the upper lid: the shadow band it casts on the eyeball. */
const LID_SHADOW = [...UPPER, ...UPPER.slice().reverse().map(([x, y]): Vec2 => [x, y + 34 + 18 * Math.sin(((x - 250) / 1100) * Math.PI)])];

const art = once(() => {
  const r = rng(7301);
  const lash: Vec2[][] = [];
  for (let i = 0; i < 86; i++) {
    const k = 3 + Math.floor((i / 86) * (UPPER.length - 7)), [x, y] = UPPER[k]!;
    const out = (x - C[0]) / 560, len = 70 + 70 * (1 - Math.abs(out - 0.2)) + r() * 30, a = -Math.PI / 2 + out * 1.1 + (r() - 0.5) * 0.3;
    const bend = 0.45 + r() * 0.2;
    lash.push(catmullRom([[x, y], [x + Math.cos(a) * len * 0.5, y + Math.sin(a) * len * 0.5], [x + Math.cos(a + bend) * len, y + Math.sin(a + bend) * len * 0.9]], 5));
  }
  const lower: Vec2[][] = [];
  for (let i = 0; i < 40; i++) {
    const k = 6 + Math.floor((i / 40) * (LOWER.length - 12)), [x, y] = LOWER[k]!;
    const out = (x - C[0]) / 560, len = 24 + r() * 26, a = Math.PI / 2 + out * 0.9 + (r() - 0.5) * 0.4;
    lower.push([[x, y + 4], [x + Math.cos(a) * len, y + 4 + Math.sin(a) * len]]);
  }
  const brow: Vec2[][] = [];
  for (let i = 0; i < 140; i++) {
    const x = 160 + r() * 1300, y0 = 10 + 90 * Math.pow(Math.abs(x - 820) / 700, 2) + r() * 60, len = 50 + r() * 60, a = -0.25 + ((x - 820) / 700) * 0.35 + (r() - 0.5) * 0.3;
    brow.push([[x, y0], [x + Math.cos(a) * len, y0 - Math.sin(a) * len * 0.4 - 10]]);
  }
  // skin: fine wrinkle lines under the lower lid and across the lid fold
  const skin: Vec2[][] = [];
  for (let i = 0; i < 9; i++) skin.push(LOWER.slice(8, -8).map(([x, y], k): Vec2 => [x, y + 30 + i * 22 + 6 * Math.sin(k * 0.4 + i)]));
  for (let i = 0; i < 4; i++) skin.push(CREASE.slice(10, -10).map(([x, y]): Vec2 => [x, y - 22 - i * 20]));
  return {
    lids: [...lines([UPPER], BOLD, 7310), ...lines([LOWER], PEN, 7311), ...lines([CREASE], PEN, 7312)],
    lashes: lines(lash, { ...FINE, size: 2.4, taperStart: 2, taperEnd: 30, thinning: 0.6 }, 7320),
    lowerLashes: lines(lower, { ...FINE, size: 1.5, taperStart: 2, taperEnd: 12 }, 7330),
    brow: lines(brow, { ...FINE, size: 2, taperStart: 10, taperEnd: 20 }, 7340),
    skin: skin.map(p => p),
    opening: region(OPENING),
    lidShadow: region(LID_SHADOW),
    crypts: Array.from({ length: 9 }, (_, k) => {
      const a = (k / 9) * TAU + r() * 0.5, d = 0.55 + r() * 0.2;
      return { a, d, rx: 12 + r() * 12, ry: 6 + r() * 5, seed: 7350 + k };
    }),
  };
});

export interface EyeOptions {
  /** The wiped colour of the iris: cold blue, hazel (cold with a warm ring at the pupil), or warm brown. */
  iris: 'cold' | 'hazel' | 'warm';
  /** Pupil radius as a fraction of the iris at the cut and at the end of the shot. */
  from: number;
  to: number;
  seed: number;
}

const disc = (r: number, seed = 0, wander = 0.012): Path2D => region(blob(C[0], C[1], r, r, seed, wander));

const GLINT = catmullRom([[C[0] - 118, C[1] - 104], [C[0] - 52, C[1] - 126], [C[0] - 40, C[1] - 84], [C[0] - 98, C[1] - 58], [C[0] - 130, C[1] - 70]], 5, true);

export function eyeShot(o: EyeOptions): Shot {
  const pupilAt = (u: number, heat: number): number => IRIS * lerp(o.from, Math.min(0.78, o.to + 0.06 * heat), easeOut(u * 1.15));
  const glints = (dx = 0): Path2D => region(GLINT.map(([x, y]): Vec2 => [x + dx, y]), blob(C[0] + 62, C[1] + 70, 13, 9, o.seed + 12, 0.1));
  return {
    view: c => pushIn(c, 0.05, C),
    tint(e) {
      pool(e, 800, 450, 900, WARM, 0.14);
      const iris = disc(IRIS);
      e.ctx.save();
      e.ctx.clip(region(OPENING));
      flood(e, iris, o.iris === 'warm' ? WARM : COLD, 0.85);
      if (o.iris === 'hazel') pool(e, C[0], C[1], pupilAt(e.u, e.heat) + 60, WARM, 0.7, iris);
      e.ctx.restore();
      // the wet rims: inner corner and waterline
      pool(e, 285, 515, 80, WARM, 0.6);
      e.ctx.save();
      e.ctx.clip(region(OPENING));
      pool(e, 800, 720, 540, WARM, 0.12);
      e.ctx.restore();
      erase(e, glints());
    },
    tone(e: Etch) {
      const A = art(), pr = pupilAt(e.u, e.heat);
      // skin: a middle tone, deepening into the orbit and the corners; the brow bone catches the light
      shade(e, FULL, 0.24);
      shadeRadial(e, 240, 480, 330, 0.66, 0.3, { max: true, sx: 0.9, sy: 1.1 });
      shadeRadial(e, 1420, 450, 330, 0.6, 0.3, { max: true, sx: 0.9, sy: 1.1 });
      shade(e, region([...CREASE, ...CREASE.slice().reverse().map(([x, y]): Vec2 => [x, y - 70])]), 0.58, { blur: 26, max: true });
      shade(e, region([...BROW, [1600, -300], [0, -300]]), 0.74, { blur: 30, max: true });
      shade(e, region(blob(820, 222, 420, 44, o.seed + 2, 0.2)), 0.12, { blur: 30, min: true });
      shadeLinear(e, [800, 700], [800, 900], 0.28, 0.5, { max: true });
      // the eyeball: white at the centre, shaded into the corners, the upper lid's shadow along the top
      shadeRadial(e, C[0] + 30, C[1] + 20, 600, 0.04, 0.42, { clip: A.opening, sx: 1, sy: 0.5 });
      shade(e, A.lidShadow, 0.4, { blur: 10, max: true });
      // the iris: a wiped disc darkening to the limbus, the lid's shadow over its top, the collarette, the pupil
      const iris = disc(IRIS, o.seed + 6);
      e.ctx.save();
      e.ctx.clip(A.opening);
      shadeRadial(e, C[0], C[1], IRIS, 0.16, 0.4, { clip: iris });
      shade(e, region(blob(C[0], C[1], IRIS, IRIS, o.seed + 6, 0.012), blob(C[0], C[1], IRIS * 0.84, IRIS * 0.84, o.seed + 7, 0.03)), 0.84, { rule: 'evenodd', blur: 5 });
      shade(e, region([...UPPER.map(([x, y]): Vec2 => [x, y + 80]), [1600, -100], [0, -100]]), 0.72, { blur: 16, max: true });
      for (const c of A.crypts) {
        const d = lerp(pr + 16, IRIS * 0.8, c.d);
        shade(e, region(blob(C[0] + Math.cos(c.a) * d, C[1] + Math.sin(c.a) * d, c.rx, c.ry, c.seed, 0.25, c.a + Math.PI / 2, 20)), 0.76, { blur: 3, max: true });
      }
      shade(e, region(blob(C[0], C[1], pr + 28, pr + 28, o.seed + 9, 0.08), blob(C[0], C[1], pr + 6, pr + 6, o.seed + 10, 0.02)), 0.66, { rule: 'evenodd', blur: 4, max: true });
      shade(e, disc(pr, o.seed + 11, 0.008), 1);
      // the catchlight: a window of paper in the pupil's edge, and a pin of light below
      shade(e, glints(), 0);
      e.ctx.restore();
    },
    line(e: Etch) {
      const A = art(), pr = pupilAt(e.u, e.heat), ctx = e.ctx;
      scratchLines(e, A.skin, 1.3, INK, 0.5);
      ctx.save();
      ctx.clip(A.opening);
      const r = rng(o.seed + 8), fibres: Vec2[][] = [], dark: Vec2[][] = [];
      for (let i = 0; i < 150; i++) {
        const a = (i / 150) * TAU + r() * 0.03, r0 = pr + 3 + r() * 10, r1 = IRIS * (0.62 + r() * 0.34), line: Vec2[] = [];
        for (let k = 0; k <= 6; k++) {
          const d = lerp(r0, r1, k / 6), aa = a + 0.05 * noise1(d / 40, o.seed + i);
          line.push([C[0] + Math.cos(aa) * d, C[1] + Math.sin(aa) * d]);
        }
        (i % 3 === 0 ? dark : fibres).push(line);
      }
      scratchLines(e, fibres, 1.4, INK, 0.8);
      scratchLines(e, dark, 2.4, INK, 0.9);
      scratchLines(e, [catmullRom(blob(C[0], C[1], IRIS, IRIS, o.seed + 6, 0.012), 1, true)], 3, INK, 0.9);
      erase(e, glints());
      ctx.restore();
      pen(e, A.brow);
      pen(e, A.lids);
      pen(e, A.lashes);
      pen(e, A.lowerLashes);
    },
  };
}
