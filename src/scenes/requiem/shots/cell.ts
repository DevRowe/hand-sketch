/**
 * The microscope plates: the dissolving cell (a beaded membrane shivering on a dark field), the fizz of bubbles
 * rising through a pale liquid, and the blood vessel wall with its cells streaming past.
 */
import { catmullRom } from '../../../core/geometry';
import { TAU, type Vec2 } from '../../../core/math';
import { noise2, rng } from '../../../core/random';
import { blob, COLD, easeOut, erase, FULL, INK, pool, pushIn, region, scratchLines, shade, shadeRadial, WARM, type Shot } from '../etch';

/** A membrane outline that shivers with time: radius noise over angle and time, never the same twice. */
function membrane(cx: number, cy: number, R: number, seed: number, t: number, n = 96, amp = 0.07): Vec2[] {
  const out: Vec2[] = [];
  for (let k = 0; k < n; k++) {
    const a = (k / n) * TAU, w = 1 + amp * (2 * noise2(Math.cos(a) * 1.3 + t * 0.8, Math.sin(a) * 1.3, seed) + noise2(Math.cos(a) * 4, Math.sin(a) * 4 + t * 2, seed + 1));
    out.push([cx + Math.cos(a) * R * w, cy + Math.sin(a) * R * w * 0.94]);
  }
  return out;
}

export interface CellOptions {
  seed: number;
  /** Where the main cell sits and how big it is. */
  at?: Vec2;
  r?: number;
}

export function cellShot(o: CellOptions): Shot {
  const [cx, cy] = o.at ?? [800, 450], R = o.r ?? 340, r = rng(o.seed);
  const side = [
    { at: [-60 - r() * 80, 120 + r() * 200] as Vec2, r: 200 + r() * 60 },
    { at: [1640 + r() * 80, 700 + r() * 150] as Vec2, r: 180 + r() * 80 },
    { at: [1500 + r() * 120, -60] as Vec2, r: 140 + r() * 40 },
  ];
  const motes = Array.from({ length: 70 }, () => ({ a: r() * TAU, d: 0.2 + r() * 0.75, s: 2 + r() * 5, v: (r() - 0.5) * 0.6 }));
  const t0 = r() * 10;
  const outline = (t: number): Vec2[] => membrane(cx, cy, R, o.seed, t0 + t);
  return {
    view: c => pushIn(c, 0.06, [cx, cy]),
    tint(e) {
      const m = region(outline(e.t));
      pool(e, cx, cy, R * 1.2, COLD, 0.75, m);
      pool(e, cx + R * 0.3, cy - R * 0.2, R * 0.6, WARM, 0.35, m);
      for (const s of side) pool(e, s.at[0], s.at[1], s.r * 1.1, COLD, 0.5);
    },
    tone(e) {
      shade(e, FULL, 0.95);
      for (const s of side) {
        const m = region(membrane(s.at[0], s.at[1], s.r, o.seed + 7, t0 + e.t, 60));
        shade(e, m, 0.45, { blur: 6 });
        shadeRadial(e, s.at[0], s.at[1], s.r, 0.7, 0.35, { clip: m });
      }
      const pts = outline(e.t), m = region(pts);
      // the cytoplasm: mottled, a dark knot of a nucleus, the rim catching the light
      shade(e, m, 0.4, { blur: 4 });
      for (let k = 0; k < 14; k++) {
        const rr = rng(o.seed + 40 + k), a = rr() * TAU, d = rr() * R * 0.7, s = 30 + rr() * 90;
        shade(e, region(blob(cx + Math.cos(a) * d, cy + Math.sin(a) * d, s, s * (0.5 + rr() * 0.5), o.seed + k, 0.3, rr() * TAU, 24)), k % 3 ? 0.62 : 0.2, { blur: 14 });
      }
      shade(e, region(blob(cx - R * 0.12, cy + R * 0.05, R * 0.34, R * 0.26, o.seed + 3, 0.18, 0.5)), 0.82, { blur: 20, max: true });
      const inner = membrane(cx, cy, R * 0.9, o.seed, t0 + e.t);
      shade(e, region(pts, inner), 0.06, { rule: 'evenodd', blur: 5, min: true });
    },
    line(e) {
      const pts = outline(e.t), rr = rng(o.seed + 5);
      scratchLines(e, [catmullRom(pts, 3, true)], 3, INK, 0.9);
      scratchLines(e, [catmullRom(membrane(cx, cy, R * 0.9, o.seed, t0 + e.t), 3, true)], 1.6, INK, 0.7);
      // beads along the membrane, some drifting loose as it dissolves
      const beads = new Path2D(), rims: Vec2[][] = [];
      for (let k = 0; k < 150; k++) {
        const i = Math.floor(rr() * pts.length), [px, py] = pts[i]!, loose = rr() < 0.25 ? easeOut(e.u) * (20 + rr() * 60) : 0;
        const dx = px - cx, dy = py - cy, m = Math.hypot(dx, dy) || 1, sz = 3 + rr() * 9;
        const bx = px + (dx / m) * (loose + (rr() - 0.4) * 18), by = py + (dy / m) * (loose + (rr() - 0.4) * 18);
        beads.moveTo(bx + sz, by);
        beads.arc(bx, by, sz, 0, TAU);
        if (sz > 7) rims.push(Array.from({ length: 13 }, (_, j): Vec2 => [bx + Math.cos((j / 12) * TAU) * sz, by + Math.sin((j / 12) * TAU) * sz]));
      }
      erase(e, beads);
      scratchLines(e, rims, 1.4, INK, 0.8);
      const dots = new Path2D();
      for (const d of motes) {
        const a = d.a + d.v * e.t, x = cx + Math.cos(a) * d.d * R, y = cy + Math.sin(a) * d.d * R * 0.9;
        dots.moveTo(x + d.s, y);
        dots.arc(x, y, d.s, 0, TAU);
      }
      e.ctx.save();
      e.ctx.fillStyle = INK;
      e.ctx.globalAlpha = 0.8;
      e.ctx.fill(dots);
      e.ctx.restore();
    },
  };
}

export function fizzShot(o: { seed: number }): Shot {
  const r = rng(o.seed);
  const bubbles = Array.from({ length: 46 }, () => {
    const s = r(), rad = 10 + s * s * 110;
    return { x: r() * 1700 - 50, y: r() * 1100 - 100, r: rad, v: 60 + (1 - s) * 140, wob: r() * TAU };
  }).sort((a, b) => a.r - b.r);
  const at = (b: (typeof bubbles)[number], t: number): Vec2 => [b.x + 8 * Math.sin(b.wob + t * 3), b.y - b.v * t];
  return {
    view: c => pushIn(c, 0.04),
    tint(e) {
      pool(e, 800, 450, 1100, COLD, 0.45);
    },
    tone(e) {
      shade(e, FULL, 0.14);
      shadeRadial(e, 800, 450, 1000, 0.08, 0.4, {});
      for (const b of bubbles) {
        const [x, y] = at(b, e.t), c = region(blob(x, y, b.r, b.r, 3, 0.02, 0, 40));
        // a lens of liquid: dark rim, a crescent of shadow low right, the light passing through the middle
        shade(e, c, 0.62, { blur: 2 });
        shade(e, region(blob(x - b.r * 0.12, y - b.r * 0.12, b.r * 0.78, b.r * 0.78, 4, 0.02, 0, 40)), 0.1, { blur: b.r * 0.12 });
        shade(e, region(blob(x - b.r * 0.35, y - b.r * 0.4, b.r * 0.22, b.r * 0.14, 5, 0.05, -0.6, 24)), 0);
      }
    },
    line(e) {
      const rims: Vec2[][] = [];
      for (const b of bubbles) {
        const [x, y] = at(b, e.t);
        rims.push(Array.from({ length: 33 }, (_, j): Vec2 => [x + Math.cos((j / 32) * TAU) * b.r, y + Math.sin((j / 32) * TAU) * b.r]));
      }
      scratchLines(e, rims, 1.8, INK, 0.85);
    },
  };
}

export function vesselShot(o: { seed: number }): Shot {
  const r = rng(o.seed);
  // the wall runs corner to corner; cells stream along it in the channel below
  const wall = (k: number): Vec2[] => catmullRom([[-100, 140 + k], [400, 260 + k], [800, 330 + k], [1200, 470 + k], [1700, 600 + k]], 8);
  const cells = Array.from({ length: 150 }, () => ({ u: r() * 2200 - 300, v: r() * 1400 - 250, s: 34 + r() * 14, a: r() * TAU }));
  const DIR: Vec2 = [0.93, 0.36];
  const pos = (c: (typeof cells)[number], t: number): Vec2 => {
    const u = ((c.u + t * 260 + 300) % 2200) - 300;
    return [u * DIR[0] - c.v * DIR[1] * 0.1, u * DIR[1] + c.v * 0.64];
  };
  return {
    view: c => pushIn(c, 0.05),
    tint(e) {
      pool(e, 800, 450, 1300, WARM, 0.7);
    },
    tone(e) {
      shade(e, FULL, 0.55);
      for (const c of cells) {
        const [x, y] = pos(c, e.t);
        // a biconcave disc: a raised light rim, a dark dimple, a shadow thrown down-right
        shade(e, region(blob(x + 7, y + 8, c.s, c.s * 0.86, 5, 0.06, c.a, 28)), 0.86, { blur: 6, max: true });
        shade(e, region(blob(x, y, c.s, c.s * 0.86, 6, 0.06, c.a, 28)), 0.22, { blur: 3 });
        shade(e, region(blob(x + 2, y + 2, c.s * 0.42, c.s * 0.36, 7, 0.1, c.a, 20)), 0.68, { blur: 5 });
      }
      // the vessel wall: a pale fibrous ridge
      const ridge = [...wall(-40), ...wall(40).reverse()];
      shade(e, region(ridge), 0.04, { blur: 12 });
      shade(e, region([...wall(40), ...wall(120).reverse()]), 0.8, { blur: 24, max: true });
    },
    line(e) {
      const rr = rng(o.seed + 3), fibres: Vec2[][] = [];
      for (let k = 0; k < 16; k++) fibres.push(wall(-40 + rr() * 90).map(([x, y], i): Vec2 => [x, y + 6 * Math.sin(i * 0.7 + k)]));
      scratchLines(e, fibres, 1.3, INK, 0.7);
      const rims: Vec2[][] = [];
      for (const c of cells) {
        const [x, y] = pos(c, e.t);
        const ca = Math.cos(c.a), sa = Math.sin(c.a);
        rims.push(Array.from({ length: 21 }, (_, j): Vec2 => {
          const px = Math.cos((j / 20) * TAU) * c.s, py = Math.sin((j / 20) * TAU) * c.s * 0.86;
          return [x + px * ca - py * sa, y + px * sa + py * ca];
        }));
      }
      scratchLines(e, rims, 1.3, INK, 0.6);
    },
  };
}
