/**
 * The vessels: the amber pill bottle with its ridged cap twisting off, the bottle-cap macro (a fluted metal cap, a
 * white lump dissolving in its liquid), the cap from the side, the graduated glass barrel with its dark stopper
 * sliding, and Sara's table of pills (vials, then the day's tablets, cold and warm).
 */
import { catmullRom } from '../../../core/geometry';
import { lerp, TAU, type Vec2 } from '../../../core/math';
import { noise1, rng } from '../../../core/random';
import { blob, COLD, easeInOut, easeOut, erase, flood, FULL, INK, pool, pushIn, rectPts, region, scratchLines, shade, shadeLinear, shadeRadial, WARM, type Etch, type Shot } from '../etch';
import { engraveFinger, toneFinger, type Finger } from './hands';

const circle = (cx: number, cy: number, rx: number, ry: number, n = 48, a0 = 0, a1 = TAU): Vec2[] =>
  Array.from({ length: n + 1 }, (_, k): Vec2 => { const a = a0 + ((a1 - a0) * k) / n; return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]; });

/** Bubbles: dark rims, clear middles, a glint each (tone and line passes). */
function toneBubbles(e: Etch, bs: readonly (readonly [number, number, number])[]): void {
  for (const [x, y, r] of bs) {
    shade(e, region(circle(x, y, r, r, 20)), 0.6, { blur: 1 });
    shade(e, region(circle(x - r * 0.1, y - r * 0.1, r * 0.7, r * 0.7, 20)), 0.08, { blur: r * 0.1 });
  }
}
function lineBubbles(e: Etch, bs: readonly (readonly [number, number, number])[]): void {
  scratchLines(e, bs.map(([x, y, r]) => circle(x, y, r, r, 20)), 1.4, INK, 0.85);
}

/* ---------- the amber bottle ---------- */

export function bottleShot(o: { cap: 'white' | 'blue'; seed: number }): Shot {
  const TILT = -0.12, C: Vec2 = [820, 560];
  const at = ([x, y]: Vec2): Vec2 => [C[0] + x * Math.cos(TILT) - y * Math.sin(TILT), C[1] + x * Math.sin(TILT) + y * Math.cos(TILT)];
  const glass = rectPts(-360, -180, 720, 900).map(at), cap = rectPts(-390, -470, 780, 300).map(at), rim = circle(0, -470, 390, 60).map(at);
  const pills = Array.from({ length: 7 }, (_, k): Vec2 => [-260 + k * 90 + (k % 2) * 20, 250 + (k % 3) * 70]);
  const thumb: Finger = { tip: [1080, 170], angle: Math.PI + 0.35, w: 260, len: 900, nail: 'bare' };
  const turn = (t: number): number => (o.cap === 'blue' ? 1.8 : 1) * t;
  return {
    view: c => pushIn(c, 0.06, [820, 420]),
    tint(e) {
      flood(e, region(glass), WARM, 0.9);
      if (o.cap === 'blue') {
        flood(e, region(cap), COLD, 0.8);
        flood(e, region(rim), COLD, 0.8);
      }
    },
    tone(e) {
      shade(e, FULL, 0.95);
      // amber glass: dark at the sides, a hot core of light, the pills in shadow inside, a label below
      shade(e, region(glass), 0.5);
      shadeLinear(e, at([-360, 0]), at([360, 0]), 0.75, 0.3, { clip: region(glass), max: false });
      shade(e, region(rectPts(-250, -150, 70, 860).map(at)), 0.04, { blur: 20 });
      shade(e, region(rectPts(250, -150, 40, 860).map(at)), 0.12, { blur: 14 });
      for (const p of pills) shade(e, region(circle(p[0], p[1], 52, 38, 24).map(at)), 0.72, { blur: 8, max: true });
      shade(e, region(rectPts(-360, 430, 720, 400).map(at)), 0.1);
      // the cap: lit ridges round a cylinder, the rim ellipse
      shade(e, region(cap), o.cap === 'blue' ? 0.3 : 0.14);
      shadeLinear(e, at([-390, 0]), at([390, 0]), 0.62, 0.1, { clip: region(cap), max: true });
      shade(e, region(rim), o.cap === 'blue' ? 0.25 : 0.08);
      if (o.cap === 'blue') toneFinger(e, thumb, 0.3);
    },
    line(e) {
      const ph = turn(e.t), ridges: Vec2[][] = [];
      for (let k = 0; k < 48; k++) {
        const a = (k / 48) * TAU + ph, x = Math.cos(a) * 390;
        if (Math.sin(a) < 0) continue;
        ridges.push([at([x, -440]), at([x, -175])]);
      }
      scratchLines(e, ridges, 2.4, INK, 0.8);
      const r = rng(o.seed), label: Vec2[][] = [];
      for (let k = 0; k < 7; k++) label.push([at([-300 + r() * 40, 480 + k * 40]), at([200 - r() * 200, 480 + k * 40])]);
      scratchLines(e, label, 2, INK, 0.7);
      scratchLines(e, [[...glass, glass[0]!], [...cap, cap[0]!], rim, [at([-360, 430]), at([360, 430])]], 3, INK, 0.9);
      if (o.cap === 'blue') engraveFinger(e, thumb, o.seed);
      erase(e, region(rectPts(-240, -130, 16, 500).map(at)), 0.9);
    },
  };
}

/* ---------- the cap ---------- */

export function capShot(o: { act: 'macro' | 'side'; seed: number }): Shot {
  const r = rng(o.seed);
  const bubbles = Array.from({ length: 26 }, () => [560 + r() * 480, 560 + r() * 160, 4 + r() * 16, r() * 40 + 30] as const);
  if (o.act === 'side') {
    const top = 330, bot = 640, RX = 520, C = 800;
    return {
      view: c => pushIn(c, 0.05, [800, 470]),
      tone(e) {
        shade(e, FULL, 0.96);
        const body = region([...circle(C, top, RX, 70, 32, Math.PI, 0), ...circle(C, bot, RX, 70, 32, 0, Math.PI)]);
        shade(e, body, 0.55);
        shadeLinear(e, [C - RX, 0], [C + RX, 0], 0.85, 0.25, { clip: body });
        shade(e, region(circle(C, top, RX, 70, 48)), 0.2);
        shade(e, region(circle(C, top + 6, RX - 40, 52, 48)), 0.8, { blur: 4 });
      },
      line(e) {
        const ridges: Vec2[][] = [], ph = e.t * 1.4;
        for (let k = 0; k < 90; k++) {
          const a = (k / 90) * TAU + ph;
          if (Math.sin(a) < 0.05) continue;
          const x = C + Math.cos(a) * RX, y = 70 * Math.sin(a);
          ridges.push([[x, top + y + 8], [x, bot + y - 4]]);
        }
        scratchLines(e, ridges, 3, INK, 0.75);
        const glints: Vec2[][] = [];
        for (let k = 0; k < 90; k += 3) {
          const a = (k / 90) * TAU + e.t * 1.4, x = C + Math.cos(a) * RX;
          if (Math.sin(a) > 0.4 && Math.cos(a) < -0.1) glints.push([[x + 5, top + 40], [x + 5, bot - 30]]);
        }
        e.ctx.save();
        e.ctx.globalCompositeOperation = 'destination-out';
        scratchLines(e, glints, 3.4, '#000', 0.8);
        e.ctx.restore();
        scratchLines(e, [circle(C, top, RX, 70, 64), circle(C, bot, RX, 70, 32, 0, Math.PI), [[C - RX, top], [C - RX, bot]], [[C + RX, top], [C + RX, bot]]], 3, INK, 0.9);
      },
    };
  }
  const lump = (u: number, heat: number): number => 150 * (1 - 0.45 * easeOut(u) - 0.2 * heat);
  return {
    view: c => pushIn(c, 0.06, [800, 560]),
    tint(e) {
      flood(e, region(circle(800, 600, 560, 250, 64)), COLD, 0.45);
    },
    tone(e) {
      shade(e, FULL, 0.95);
      // the fluted wall: alternating bands around the far side of the cap
      shade(e, region(circle(800, 470, 700, 330, 64)), 0.4);
      for (let k = 0; k < 64; k++) {
        const a0 = (k / 64) * TAU, a1 = ((k + 0.5) / 64) * TAU;
        const band = [...circle(800, 470, 700, 330, 4, a0, a1), ...circle(800, 600, 560, 250, 4, a1, a0)];
        shade(e, region(band), Math.sin(a0) < 0 ? 0.12 : 0.62, { blur: 3 });
      }
      shadeRadial(e, 800, 330, 700, 0, 0.5, { clip: region(circle(800, 470, 700, 330, 64)), max: true, sy: 0.4 });
      // the floor: liquid, the lump melting into it
      const floor = region(circle(800, 600, 560, 250, 64));
      shade(e, floor, 0.3);
      shadeRadial(e, 800, 620, 560, 0.15, 0.62, { clip: floor, sy: 0.45 });
      const R = lump(e.u, e.heat);
      shade(e, region(blob(800, 600, R * 1.5, R * 0.7, o.seed + 1, 0.25)), 0.35, { blur: 30, min: true });
      shade(e, region(blob(800, 580, R, R * 0.62, o.seed, 0.2)), 0.03, { blur: 4 });
      shade(e, region(blob(830, 610, R * 0.6, R * 0.25, o.seed + 2, 0.3)), 0.3, { blur: 10 });
      toneBubbles(e, bubbles.map(([x, y, s, v]) => [x, y - v * e.t, s] as const));
    },
    line(e) {
      scratchLines(e, [circle(800, 470, 700, 330, 96), circle(800, 600, 560, 250, 96)], 3, INK, 0.9);
      const R = lump(e.u, e.heat), pts = blob(800, 580, R, R * 0.62, o.seed, 0.2);
      scratchLines(e, [[...pts, pts[0]!]], 2.2, INK, 0.8);
      lineBubbles(e, bubbles.map(([x, y, s, v]) => [x, y - v * e.t, s] as const));
    },
  };
}

/* ---------- the graduated barrel ---------- */

export function barrelShot(o: { seed: number }): Shot {
  const X0 = 470, X1 = 1130, r = rng(o.seed);
  const stop = (u: number, heat: number): number => lerp(170, 330 + 60 * heat, easeInOut(u));
  const bubbles = Array.from({ length: 14 }, () => [X0 + 80 + r() * (X1 - X0 - 160), 600 + r() * 400, 5 + r() * 14, 40 + r() * 60] as const);
  return {
    view: c => pushIn(c, 0.04, [800, 450]),
    tint(e) {
      flood(e, region(rectPts(X0, stop(e.u, e.heat) + 170, X1 - X0, 800)), COLD, 0.5);
    },
    tone(e) {
      shade(e, FULL, 0.9);
      const p = stop(e.u, e.heat), tube = region(rectPts(X0, -100, X1 - X0, 1100));
      shade(e, tube, 0.45);
      shadeLinear(e, [X0, 0], [X1, 0], 0.7, 0.6, { clip: tube });
      shade(e, region(rectPts(X0 + 60, -100, 90, 1100)), 0.12, { blur: 16, min: true });
      // the stopper: black rubber with two ribs, the liquid beneath it and its meniscus
      shade(e, region(rectPts(X0, p - 400, X1 - X0, 580)), 0.97);
      shade(e, region(rectPts(X0, p + 100, X1 - X0, 16)), 0.55, { blur: 3 });
      shade(e, region(rectPts(X0, p + 30, X1 - X0, 12)), 0.6, { blur: 3 });
      const liquid = region([...catmullRom([[X0, p + 190], [800, p + 214], [X1, p + 190]], 8), [X1, 1100], [X0, 1100]]);
      shade(e, liquid, 0.14);
      shadeLinear(e, [0, p + 190], [0, p + 260], 0.5, 0.14, { clip: liquid, max: true });
      toneBubbles(e, bubbles.map(([x, y, s, v]) => [x, Math.max(p + 230, y - v * e.t), s] as const));
    },
    line(e) {
      const p = stop(e.u, e.heat), ticks: Vec2[][] = [];
      for (let k = 0; k < 40; k++) {
        const y = -40 + k * 24, major = k % 5 === 0;
        ticks.push([[X0 + 10, y], [X0 + (major ? 130 : 70), y + 1]]);
      }
      e.ctx.save();
      e.ctx.globalCompositeOperation = 'destination-out';
      scratchLines(e, ticks.filter(t => t[0]![1] < p + 170 && t[0]![1] > p - 400), 4, '#000', 0.9);
      e.ctx.restore();
      scratchLines(e, ticks.filter(t => t[0]![1] >= p + 170 || t[0]![1] <= p - 400), 3.4, INK, 0.9);
      scratchLines(e, [[[X0, -100], [X0, 1100]], [[X1, -100], [X1, 1100]], catmullRom([[X0, p + 190], [800, p + 214], [X1, p + 190]], 8)], 3.4, INK, 0.9);
      lineBubbles(e, bubbles.map(([x, y, s, v]) => [x, Math.max(p + 230, y - v * e.t), s] as const));
    },
  };
}

/* ---------- Sara's table ---------- */

/** The bottom half of the opening split screen: the table changes under her hands as she sorts the day's pills. */
export function tableShot(o: { seed: number }): Shot {
  const vials = [0, 1, 2, 3].map(k => 520 + k * 220);
  const tablets = Array.from({ length: 5 }, (_, k): Vec2 => [800 + Math.cos(k * 1.26 + 0.3) * 230, 450 + Math.sin(k * 1.26 + 0.3) * 120]);
  const hand: Finger[] = [0, 1, 2].map(k => ({ tip: [860 + k * 150, 470 + (k === 1 ? -20 : 0)], angle: Math.PI / 2 + 0.25 - k * 0.1, w: 120, len: 500, nail: 'bare' }));
  const phase = (t: number): 'vials' | 'cold' | 'warm' | 'hand' => (t < 0.28 ? 'vials' : t < 0.8 ? 'cold' : t < 1.04 ? 'warm' : 'hand');
  return {
    view: c => ({ zoom: 1 + 0.02 * c.u, focus: [800, 450] }),
    tint(e) {
      pool(e, 800, 450, 1000, WARM, 0.35);
      const ph = phase(e.t);
      if (ph === 'cold' || ph === 'warm') for (const [x, y] of tablets) flood(e, region(circle(x, y, 118, 90, 32)), ph === 'cold' ? COLD : WARM, 0.8);
      else for (const x of vials) flood(e, region(rectPts(x - 80, 270, 160, 240)), WARM, 0.75);
    },
    tone(e) {
      shade(e, FULL, 0.4);
      shadeRadial(e, 800, 450, 900, 0.3, 0.7, { max: true, sy: 0.5 });
      const ph = phase(e.t);
      if (ph === 'cold' || ph === 'warm') {
        for (const [x, y] of tablets) {
          shade(e, region(circle(x + 16, y + 24, 124, 94, 32)), 0.75, { blur: 14, max: true });
          shade(e, region(circle(x, y + 16, 118, 90, 32)), 0.5);
          shade(e, region(circle(x, y, 118, 90, 32)), 0.1);
          shade(e, region(circle(x, y + 8, 92, 68, 32)), 0.3, { blur: 8 });
        }
        return;
      }
      // the paper note beside the vials
      shade(e, region([[120, 250], [420, 230], [440, 560], [140, 590]]), 0.06);
      for (const x of vials) {
        shade(e, region(rectPts(x - 80, 270, 160, 240)), 0.45);
        shade(e, region(rectPts(x - 80, 400, 160, 110)), 0.08);
        shade(e, region(circle(x, 270, 80, 26, 24)), 0.95);
      }
      if (ph === 'hand') for (const f of hand) toneFinger(e, f, 0.26);
    },
    line(e) {
      const ph = phase(e.t);
      // the cloth's weave
      const r = rng(o.seed), weave: Vec2[][] = [];
      for (let k = 0; k < 90; k++) {
        const y = 200 + k * 6 + noise1(k, o.seed) * 2;
        weave.push([[-50, y], [1650, y + 3 * Math.sin(k)]]);
      }
      scratchLines(e, weave, 0.9, INK, 0.25);
      if (ph === 'cold' || ph === 'warm') {
        scratchLines(e, tablets.flatMap(([x, y]) => [circle(x, y, 118, 90, 48), circle(x, y + 16, 118, 90, 24, 0, Math.PI), circle(x, y + 8, 92, 68, 40), [[x - 80, y + 8], [x + 80, y + 8]]]), 2.6, INK, 0.9);
        return;
      }
      const scrawl: Vec2[][] = [];
      for (let k = 0; k < 7; k++) {
        const y = 290 + k * 40, pts: Vec2[] = [];
        for (let x = 160; x < 400 - r() * 80; x += 6) pts.push([x, y + 6 * Math.sin(x / 7 + k) + (x - 160) * -0.06]);
        scrawl.push(pts);
      }
      scratchLines(e, scrawl, 1.6, INK, 0.8);
      scratchLines(e, [[[120, 250], [420, 230], [440, 560], [140, 590], [120, 250]]], 2.2, INK, 0.9);
      for (const x of vials) scratchLines(e, [[...rectPts(x - 80, 270, 160, 240), [x - 80, 270]], circle(x, 270, 80, 26, 32), [[x - 80, 400], [x + 80, 400]]], 2.6, INK, 0.9);
      if (ph === 'hand') hand.forEach((f, k) => engraveFinger(e, f, o.seed + k, 0.8));
    },
  };
}
