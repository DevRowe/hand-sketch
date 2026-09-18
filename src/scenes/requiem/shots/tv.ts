/**
 * The television: the remote lying in the dark, a thumb pressing VISUAL POWER (the lettering burnished out of black
 * plastic, the buttons wiped cold), and the screen coming up in a cold glow, scanlines and static.
 */
import { catmullRom } from '../../../core/geometry';
import { lerp, type Vec2 } from '../../../core/math';
import { rng } from '../../../core/random';
import { blob, COLD, dense, easeInOut, easeOut, engraveCurves, erase, flood, FULL, INK, lettering, pool, pushIn, region, scratchLines, shade, shadeLinear, shadeRadial, type Shot } from '../etch';
import { engraveFinger, toneFinger, type Finger } from './hands';

export type TvAct = 'remote' | 'button' | 'glow';

const rounded = (x: number, y: number, w: number, h: number, r: number): Vec2[] =>
  catmullRom([[x + r, y], [x + w - r, y], [x + w, y + r], [x + w, y + h - r], [x + w - r, y + h], [x + r, y + h], [x, y + h - r], [x, y + r]], 4, true);

export function tvShot(o: { act: TvAct; seed: number }): Shot {
  if (o.act === 'glow') return glowShot(o.seed);
  if (o.act === 'remote') return remoteShot(o.seed);
  const press = (u: number): number => easeInOut(Math.min(1, u * 1.6));
  const thumb = (u: number): Finger => ({ tip: [1080 - 10 * press(u), 560 + 22 * press(u)], angle: Math.PI + 0.75, w: 420, len: 1200, nail: 'bare' });
  const b1 = rounded(430, 520, 240, 110, 40), b2 = (u: number): Vec2[] => rounded(930, 520 + 10 * press(u), 240, 110, 40);
  const words = [lettering('VISUAL', 420, 300, 84), lettering('POWER', 1000, 300, 84), lettering('POWER', 440, 470, 64)];
  return {
    view: c => pushIn(c, 0.04, [800, 450]),
    tint(e) {
      flood(e, region(b1), COLD, 0.9);
      flood(e, region(b2(e.u)), COLD, 0.9);
      pool(e, 1200, 800, 700, COLD, 0.2);
    },
    tone(e) {
      shade(e, FULL, 0.9);
      shadeRadial(e, 800, 300, 900, 0.8, 0.95, { max: false, sy: 0.6 });
      // the panel's bevelled edge catching light at the right
      shade(e, region([[1520, -50], [1560, -50], [1590, 950], [1550, 950]]), 0.3, { blur: 10 });
      shade(e, region(b1), 0.3);
      shade(e, region(b2(e.u)), 0.3 + 0.3 * press(e.u));
      shadeLinear(e, [0, 520], [0, 640], 0.1, 0.6, { clip: region(b1), max: true });
      toneFinger(e, thumb(e.u), 0.3);
    },
    line(e) {
      e.ctx.save();
      e.ctx.globalCompositeOperation = 'destination-out';
      scratchLines(e, words.flat(), 12, '#000', 1);
      e.ctx.restore();
      scratchLines(e, [[...b1, b1[0]!], [...b2(e.u), b2(e.u)[0]!]], 3.4, INK, 0.95);
      engraveFinger(e, thumb(e.u), o.seed);
    },
  };
}

function remoteShot(seed: number): Shot {
  const A: Vec2 = [300, 900], B: Vec2 = [1300, 120], half = 300;
  const dir = [B[0] - A[0], B[1] - A[1]], len = Math.hypot(dir[0]!, dir[1]!), ux = dir[0]! / len, uy = dir[1]! / len, px = -uy, py = ux;
  const P = (d: number, s: number): Vec2 => [A[0] + ux * d + px * s, A[1] + uy * d + py * s];
  const slab = [P(-200, -half), P(len + 100, -half * 0.7), P(len + 100, half * 0.7), P(-200, half)];
  const keys: { pts: Vec2[]; cold: boolean }[] = [];
  for (let row = 0; row < 9; row++) for (let col = 0; col < 4; col++) {
    const d = 120 + row * 95, s = -170 + col * 112 * (1 - row * 0.03), w = 70 * (1 - row * 0.035);
    const c = P(d, s);
    keys.push({ pts: blob(c[0], c[1], w * 0.55, w * 0.34, seed + row * 4 + col, 0.02, Math.atan2(uy, ux), 20), cold: row === 1 && col > 1 });
  }
  const finger = (u: number): Finger => ({ tip: [lerp(160, 360, easeOut(u)), lerp(260, 380, easeOut(u))], angle: 0.5, w: 280, len: 1000, nail: 'bare' });
  return {
    view: c => pushIn(c, 0.05, [760, 480]),
    tint(e) {
      for (const k of keys) if (k.cold) flood(e, region(k.pts), COLD, 0.9);
    },
    tone(e) {
      shade(e, FULL, 0.96);
      shade(e, region(slab), 0.8);
      shadeLinear(e, P(0, -half), P(0, half), 0.55, 0.92, { clip: region(slab), max: true });
      for (const k of keys) shade(e, region(k.pts), k.cold ? 0.3 : 0.5, { blur: 2 });
      toneFinger(e, finger(e.u), 0.35);
    },
    line(e) {
      scratchLines(e, [[...slab, slab[0]!], ...keys.map(k => [...k.pts, k.pts[0]!])], 2.6, INK, 0.9);
      erase(e, region([P(-200, -half), P(len + 100, -half * 0.7), P(len + 100, -half * 0.7 + 8), P(-200, -half + 10)]), 0.9);
      engraveFinger(e, finger(e.u), seed);
    },
  };
}

function glowShot(seed: number): Shot {
  // small enough that the dark bezel shows round it even in half of a split screen
  const screen = catmullRom([[470, 200], [800, 184], [1130, 200], [1156, 450], [1130, 700], [800, 716], [470, 700], [444, 450]], 8, true);
  const r = rng(seed), noise = Array.from({ length: 700 }, () => [r() * 760 + 420, r() * 560 + 170, 1 + r() * 2.2] as const);
  return {
    view: c => pushIn(c, 0.05),
    tint(e) {
      flood(e, region(screen), COLD, 0.55);
      pool(e, 800, 450, 700, COLD, 0.35);
    },
    tone(e) {
      const on = easeOut(e.u);
      // the dark room, lit only by the set: the glow spilling onto the bezel round the tube
      shade(e, FULL, 0.95);
      shadeRadial(e, 800, 450, 620, lerp(0.95, 0.6, on), 0.95, { min: true, sy: 0.8 });
      shade(e, region(screen), lerp(0.8, 0.1, on), { form: true });
      shadeRadial(e, 800, 450, 420, lerp(0.8, 0, on), lerp(0.85, 0.55, on), { clip: region(screen), max: false, form: true, sy: 0.75 });
      // the rolling bar
      const y = 160 + ((e.t * 700) % 600);
      shade(e, region([[0, y], [1600, y], [1600, y + 50], [0, y + 50]]), 0.4, { blur: 18, max: true, form: true });
    },
    line(e) {
      e.ctx.save();
      e.ctx.clip(region(screen));
      const scan: Vec2[][] = [];
      for (let y = 170; y < 740; y += 6) scan.push(dense([[420, y], [800, y - 2], [1180, y]], 10));
      engraveCurves(e, scan, { width: 2.2, at: 0.1 });
      const p = new Path2D();
      for (const [x, y, s] of noise) { p.moveTo(x + s, y); p.arc(x, y, s, 0, 7); }
      erase(e, p, 0.8);
      e.ctx.restore();
      const bezel = rounded(380, 130, 840, 640, 70);
      scratchLines(e, [[...screen, screen[0]!]], 4, INK, 0.95);
      scratchLines(e, [[...bezel, bezel[0]!]], 3, INK, 0.9);
      // the bezel's lit inner lip
      erase(e, region(screen.map(([x, y]): Vec2 => [800 + (x - 800) * 1.025, 450 + (y - 450) * 1.03]), screen), 0.35, 'evenodd');
    },
  };
}
