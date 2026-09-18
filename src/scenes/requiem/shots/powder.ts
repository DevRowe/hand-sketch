/**
 * The powder plates: a heap that bursts outward on the black mirror, two lines racked along the mirror's edge with a
 * blade, the rolled bill drawing a line up, and the bill being rolled tight between black nails.
 */
import { clamp, lerp, TAU, type Vec2 } from '../../../core/math';
import { noise1, rng } from '../../../core/random';
import { blob, COLD, easeInOut, easeOut, erase, flood, FULL, INK, pushIn, rectPts, region, scratchLines, shade, shadeLinear, shadeRadial, type Etch, type Shot } from '../etch';
import { engraveFinger, toneFinger, type Finger } from './hands';

/** Burnish a scatter of specks (paper-white grains) into the plate. */
function specks(e: Etch, pts: readonly (readonly [number, number, number])[], alpha = 1): void {
  const p = new Path2D();
  for (const [x, y, s] of pts) {
    p.moveTo(x + s, y);
    p.arc(x, y, s, 0, TAU);
  }
  erase(e, p, alpha);
}

/** A ragged ridge of powder from x0 to x1 along y: its top edge breaks into grains. */
function ridge(x0: number, x1: number, y: number, h: number, seed: number): Vec2[] {
  const top: Vec2[] = [], bottom: Vec2[] = [];
  for (let x = x0; x <= x1; x += 8) {
    const taper = clamp(Math.min(x - x0, x1 - x) / 60, 0.2, 1);
    top.push([x, y - h * taper * (0.7 + 0.6 * noise1(x / 40, seed))]);
    bottom.push([x, y + h * 0.3 * taper]);
  }
  return [...top, ...bottom.reverse()];
}

function grains(x0: number, x1: number, y: number, h: number, seed: number, n: number): [number, number, number][] {
  const r = rng(seed), out: [number, number, number][] = [];
  for (let i = 0; i < n; i++) out.push([x0 + r() * (x1 - x0), y - h * 1.4 * r() + h * 0.4 + (r() - 0.5) * h, 0.8 + r() * 2.4]);
  return out;
}

/* ---------- the burst ---------- */

export function powderShot(o: { seed: number }): Shot {
  const r = rng(o.seed);
  const motes = Array.from({ length: 1100 }, () => {
    const a = r() * TAU, s = Math.pow(r(), 1.8);
    return { a, v: 120 + s * 760, s: 0.8 + (1 - s) * 3.8 * r(), lift: r() * 0.8 };
  });
  const C: Vec2 = [800, 500];
  return {
    view: c => pushIn(c, 0.05, C),
    tone(e) {
      shade(e, FULL, 0.97);
      const k = easeOut(e.u);
      shadeRadial(e, C[0], C[1], 260 + 380 * k, 0.4, 0.97, { min: true, sy: 0.7 });
      shade(e, region(blob(C[0], C[1], 170 - 40 * k, 90 - 20 * k, o.seed, 0.2)), 0.03, { blur: 20, min: true });
    },
    line(e) {
      const k = easeOut(e.u);
      specks(e, motes.map(m => {
        const d = m.v * k * (0.3 + 0.7 * m.lift + 0.3);
        return [C[0] + Math.cos(m.a) * d, C[1] + Math.sin(m.a) * d * 0.62 - m.lift * 60 * k, m.s] as const;
      }));
      specks(e, grains(C[0] - 150, C[0] + 150, C[1], 70, o.seed + 1, 500));
    },
  };
}

/* ---------- racking the lines ---------- */

export function linesShot(o: { seed: number }): Shot {
  const EDGE = (x: number): number => 560 - x * 0.04;
  const blade = (u: number): number => lerp(980, 1420, easeInOut(u));
  return {
    view: c => pushIn(c, 0.03, [800, 520]),
    tint(e) {
      flood(e, region([[0, -50], [1600, -50], [1600, EDGE(1600)], [0, EDGE(0)]]), COLD, 0.8);
    },
    tone(e) {
      shade(e, FULL, 0.95);
      const mirror = region([[0, -100], [1600, -100], [1600, EDGE(1600)], [0, EDGE(0)]]);
      shadeLinear(e, [0, 0], [0, 560], 0.42, 0.8, { clip: mirror });
      // the room reflected in the glass: long soft streaks of light
      for (let k = 0; k < 5; k++) shade(e, region([[200 + k * 290, -60], [300 + k * 290, -60], [120 + k * 300, 540], [60 + k * 300, 540]]), 0.3, { blur: 40, min: true });
      const bx = blade(e.u);
      shade(e, region(ridge(120, 700, EDGE(400) - 20, 32, o.seed)), 0.02, { blur: 1 });
      shade(e, region(ridge(900, bx - 12, EDGE(1100) - 20, 32, o.seed + 1)), 0.02, { blur: 1 });
      // their reflections, dim in the dark glass just above the edge
      shade(e, region(ridge(120, 700, EDGE(400) - 58, 14, o.seed + 6)), 0.5, { blur: 6, min: true });
      // the heap still to be racked, ahead of the blade
      shade(e, region(blob(bx + 90, EDGE(bx) - 26, 80, 30, o.seed + 2, 0.3)), 0.04, { blur: 3 });
      // the blade, edge-on to the glass
      shade(e, region([[bx - 16, EDGE(bx) - 8], [bx + 4, EDGE(bx) - 8], [bx + 60, -120], [bx + 34, -120]]), 0.12);
    },
    line(e) {
      const bx = blade(e.u);
      specks(e, grains(120, 700, EDGE(400) - 18, 22, o.seed + 3, 260));
      specks(e, grains(900, bx - 12, EDGE(1100) - 18, 22, o.seed + 4, Math.round(260 * (bx - 900) / 580)));
      specks(e, grains(bx, bx + 170, EDGE(bx) - 26, 30, o.seed + 5, 200));
      scratchLines(e, [[[bx - 16, EDGE(bx) - 8], [bx + 34, -120]], [[bx + 4, EDGE(bx) - 8], [bx + 60, -120]]], 2.6, INK);
      // the glass's lit front edge
      const edge = region([[0, EDGE(0) - 3], [1600, EDGE(1600) - 3], [1600, EDGE(1600) + 3], [0, EDGE(0) + 3]]);
      erase(e, edge);
    },
  };
}

/* ---------- the bill ---------- */

/** Engraved scrollwork on the bill's surface: arcs around the roll, a lathe-work band and a scrap of oval. */
function billPattern(len: number, rad: number, phase: number): Vec2[][] {
  const out: Vec2[][] = [];
  for (let d = 30; d < len; d += 9) {
    const pts: Vec2[] = [];
    for (let k = 0; k <= 10; k++) {
      const a = -Math.PI / 2 + (k / 10) * Math.PI;
      pts.push([d + 6 * Math.sin(d / 23 + phase + a * 2), Math.sin(a) * rad * 0.94]);
    }
    out.push(pts);
  }
  return out;
}

export function billShot(o: { seed: number }): Shot {
  const RAD = 78, AX = -0.62;
  const mouth = (u: number): Vec2 => [lerp(760, 420, easeInOut(u)), 400];
  const Y0 = 470;
  const axis = (_m: Vec2): { c: number; s: number } => ({ c: Math.cos(AX), s: Math.sin(AX) });
  /** The roll as a quad from its mouth up and out of frame, plus the mouth ellipse. */
  const roll = (m: Vec2, flip = false): { body: Vec2[]; lip: Vec2[] } => {
    const { c, s } = axis(m), k = flip ? -1 : 1, px = -s, py = c, L = 1400;
    const P = (d: number, side: number): Vec2 => [m[0] + c * d * -1 + px * side, (flip ? 2 * Y0 - m[1] : m[1]) + k * (s * d * -1 + py * side)];
    const body = [P(0, -RAD), P(-L, -RAD), P(-L, RAD), P(0, RAD)];
    const lip: Vec2[] = [];
    for (let j = 0; j < 36; j++) {
      const a = (j / 36) * TAU;
      lip.push(P(Math.cos(a) * RAD * 0.36, Math.sin(a) * RAD));
    }
    return { body, lip };
  };
  return {
    view: c => pushIn(c, 0.05, [640, 440]),
    tint(e) {
      const m = mouth(e.u);
      flood(e, region(roll(m).body), COLD, 0.55);
      flood(e, region(roll(m, true).body), COLD, 0.3);
    },
    tone(e) {
      shade(e, FULL, 0.96);
      const m = mouth(e.u);
      // the line on the black glass, and its reflection
      shade(e, region(ridge(-60, m[0] + 10, Y0 - 4, 14, o.seed)), 0.03);
      shade(e, region(ridge(-60, m[0] + 10, Y0 + 12, 8, o.seed + 1)), 0.55, { blur: 4, min: true });
      const refl = roll(m, true);
      shade(e, region(refl.body), 0.7, { blur: 6, min: true });
      const { body, lip } = roll(m);
      shade(e, region(body), 0.14);
      shadeLinear(e, body[0]!, body[3]!, 0.55, 0.05, { clip: region(body), max: true });
      shade(e, region(lip), 0.12);
      shade(e, region(lip.map(([x, y]): Vec2 => [lerp(x, m[0], 0.28), lerp(y, m[1], 0.28)])), 1, { blur: 3 });
      // breath lifting the line into the roll
      shade(e, region(blob(m[0] - 30, Y0 - 16, 60, 16, o.seed + 2, 0.3)), 0.2, { blur: 10, min: true });
    },
    line(e) {
      const m = mouth(e.u), { lip } = roll(m), { c, s } = axis(m);
      specks(e, grains(-60, m[0] - 20, Y0 - 4, 14, o.seed + 3, Math.round(m[0] * 0.5)));
      // the engraving wrapped around the roll
      const pat = billPattern(1300, RAD, o.seed).map(p => p.map(([d, side]): Vec2 => [m[0] + c * d + -s * side, m[1] + s * d + c * side]));
      e.ctx.save();
      e.ctx.clip(region(roll(m).body));
      scratchLines(e, pat, 1.3, INK, 0.75);
      e.ctx.restore();
      scratchLines(e, [[...lip, lip[0]!]], 2.8, INK, 0.9);
      const { body } = roll(m);
      scratchLines(e, [[body[0]!, body[1]!], [body[3]!, body[2]!]], 3, INK, 0.9);
    },
  };
}

/** The bill rolled tight between two black-nailed fingertips, turning. */
export function billRollShot(o: { seed: number }): Shot {
  const fingers: Finger[] = [
    { tip: [470, 470], angle: 0.1, w: 220, len: 800, nail: 'black' },
    { tip: [1130, 460], angle: Math.PI - 0.05, w: 230, len: 800, nail: 'black' },
  ];
  const body = rectPts(360, 400, 880, 150);
  return {
    view: c => pushIn(c, 0.05),
    tint(e) {
      flood(e, region(body), COLD, 0.55);
    },
    tone(e) {
      shade(e, FULL, 0.93);
      shade(e, region(body), 0.14);
      shadeLinear(e, [0, 400], [0, 550], 0.1, 0.62, { clip: region(body), max: true });
      for (const f of fingers) toneFinger(e, f, 0.3);
    },
    line(e) {
      const turn = e.t * 5;
      e.ctx.save();
      e.ctx.clip(region(body));
      const pat: Vec2[][] = [];
      for (let x = 340; x < 1260; x += 10) {
        const pts: Vec2[] = [];
        for (let k = 0; k <= 8; k++) pts.push([x + 8 * Math.sin(x / 31 + turn + k), 400 + (k / 8) * 150]);
        pat.push(pts);
      }
      scratchLines(e, pat, 1.3, INK, 0.7);
      e.ctx.restore();
      scratchLines(e, [[[360, 400], [1240, 400]], [[360, 550], [1240, 550]]], 3, INK, 0.9);
      fingers.forEach((f, k) => engraveFinger(e, f, o.seed + k));
    },
  };
}

