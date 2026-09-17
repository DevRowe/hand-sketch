/**
 * G18 "Fire Mountain" (fire and earth; riso poster). A four-ink risograph travel poster, whole from the start: a
 * volcano island at sunset in fluorescent orange, teal, purple and yellow. The mountain smokes: puffs lift from the
 * crater lit orange from below, grow and drift off on the wind as purple cloud; the lava glows and dims; the sun lays a
 * shivering road across the sea; palms sway in the foreground and birds cross.
 *
 * As in "Night City", each ink is its own plate (solids plus page-locked halftone at its own screen angle), static parts
 * cached per plate, printed out of register and multiplied. The smoke is a periodic emitter, so it never seams.
 */
import { catmullRom } from '../../core/geometry';
import { emissions } from '../../core/emitter';
import { clamp, lerp, TAU, type Vec2 } from '../../core/math';
import { rng } from '../../core/random';
import type { Scene, SceneFrame } from '../../core/scene';
import { cached, composite, fit, ground, ink, perSize, phase, polyPath, screen, smooth, swell, wave, wrap, type Fit } from './common';
import { GALLERY } from './palettes';

const PAL = GALLERY.risoIsland;
const [ORANGE, TEAL, PURPLE, YELLOW] = PAL.inks as [string, string, string, string];
const W = 1080, H = 1350, HORIZON = 880, LOOP = 144;
const SUN: Vec2 = [800, 540], SUN_R = 170, CRATER: Vec2 = [500, 480];

const CONE: Vec2[] = [[40, 930], [210, 780], [360, 600], [455, 486], [545, 478], [640, 590], [800, 760], [1040, 930]];
const LAVA: Vec2[][] = [
  [[480, 492], [470, 560], [430, 640], [400, 720], [340, 820], [300, 900]],
  [[520, 490], [540, 580], [520, 660], [560, 760], [590, 900]],
  [[560, 494], [600, 560], [650, 640], [700, 720], [780, 800]],
];
const LAND: Vec2[] = catmullRom([[-40, 1350], [-40, 1150], [160, 1120], [360, 1180], [520, 1260], [680, 1240], [860, 1150], [1120, 1170], [1120, 1350]], 8);

/** A lava channel: a ribbon narrowing as it runs down the slope. */
function channel(pts: Vec2[], w0: number, w1: number): Vec2[] {
  const line = catmullRom(pts, 8), n = line.length - 1, left: Vec2[] = [], right: Vec2[] = [];
  line.forEach(([x, y], k) => {
    const a = line[Math.max(0, k - 1)]!, b = line[Math.min(n, k + 1)]!, dx = b[0] - a[0], dy = b[1] - a[1], m = Math.hypot(dx, dy) || 1;
    const w = lerp(w0, w1, k / n) * (0.8 + 0.2 * Math.sin(k * 0.7)) / 2;
    left.push([x - (dy / m) * w, y + (dx / m) * w]);
    right.push([x + (dy / m) * w, y - (dx / m) * w]);
  });
  return [...left, ...right.reverse()];
}

const layout = perSize((w, h): { F: Fit } => ({ F: fit(w, h, W, H) }));

function palm(c: CanvasRenderingContext2D, base: Vec2, height: number, lean: number, sway: number, seed: number): void {
  const top: Vec2 = [base[0] + lean * height + sway * 30, base[1] - height];
  const trunk = catmullRom([base, [base[0] + lean * height * 0.3, base[1] - height * 0.5], top], 8);
  c.fill(polyPath(channel(trunk, 34, 16)));
  const r = rng(seed);
  for (let k = 0; k < 7; k++) {
    const a = -Math.PI + (k / 6) * Math.PI + (r() - 0.5) * 0.3 + sway * 0.25, len = height * (0.45 + r() * 0.2);
    const tip: Vec2 = [top[0] + Math.cos(a) * len, top[1] + Math.sin(a) * len * 0.6 + len * 0.35];
    const mid: Vec2 = [top[0] + Math.cos(a) * len * 0.55, top[1] + Math.sin(a) * len * 0.55 - len * 0.08];
    c.fill(polyPath(channel([top, mid, tip], 58, 4)));
  }
}

export const fireMountainScene: Scene = {
  name: 'fire-mountain',
  duration: LOOP / 12,
  loopFrom: 0,
  poster: 60 / 12,
  draw(f) {
    const { stage } = f;
    const { F } = layout(stage.w, stage.h), p = phase(f), [ox, oy] = F.P(0, 0), s = F.s;
    ground(f, PAL.paper, { seed: 1800, texture: 0.8 });
    const design = (g: SceneFrame) => { g.ctx.translate(ox, oy); g.ctx.scale(s, s); return g.ctx; };
    const glow = 0.55 + 0.35 * swell(p, 3);
    const puffs = emissions(f.frame, LOOP, { every: 12, life: 108, jitter: [0, 5, 2, 7] });
    const puffAt = (u: number, index: number): { x: number; y: number; r: number } => ({
      x: CRATER[0] + Math.pow(u, 1.4) * 520 + Math.sin(u * 4 + index) * 40 * u,
      y: CRATER[1] - 20 - Math.pow(u, 0.7) * 430,
      r: 40 + u * 190,
    });
    const smoke = () => {
      const path = new Path2D();
      for (const e of puffs) { const q = puffAt(e.u, e.index); path.moveTo(q.x + q.r, q.y); path.arc(q.x, q.y, q.r, 0, TAU); }
      return path;
    };
    const tooth = (seed: number) => ({ seed, density: 26, size: 1.8, alpha: 0.32 });

    ink(f, 'g18-purple', g => {
      composite(g, cached(f, 'g18-purple-static', st => {
        const c = design(st);
        screen(c, [0, 0, W, HORIZON], { color: PURPLE, cell: 7, angle: 0.79, density: (_x, y) => 0.75 * (1 - smooth(0, 520, y)) });
        // the cone's shadow side
        c.save();
        c.clip(polyPath(CONE));
        screen(c, [500, 470, 560, 470], { color: PURPLE, cell: 7, angle: 0.79, density: (x, y) => clamp((x - 500 - (y - 480) * 0.35) / 180, 0, 0.55) });
        c.restore();
        c.fillStyle = PURPLE;
        c.fill(polyPath(LAND));
        c.globalCompositeOperation = 'destination-out';
        c.beginPath(); c.arc(SUN[0], SUN[1], SUN_R, 0, TAU); c.fill();
      }));
      const c = design(g);
      screen(c, [0, 0, W, HORIZON], { color: PURPLE, cell: 7, angle: 0.79, density: 0.6, clip: smoke() });
      c.fillStyle = PURPLE;
      palm(c, [150, 1250], 420, 0.16, wave(p, 2), 1810);
      palm(c, [950, 1230], 340, -0.2, wave(p, 2, 0.3), 1811);
      palm(c, [860, 1260], 260, -0.05, wave(p, 2, 0.6), 1812);
      // birds crossing
      c.strokeStyle = PURPLE;
      c.lineWidth = 5;
      c.lineCap = 'round';
      for (let k = 0; k < 4; k++) {
        const x = lerp(-80, W + 80, wrap(p + k * 0.13, 1)), y = 250 + k * 34 + 20 * wave(p, 2, k * 0.2), flap = 10 * wave(p, 24, k * 0.25);
        c.beginPath(); c.moveTo(x - 20, y - flap); c.quadraticCurveTo(x - 8, y - 4, x, y + 2); c.quadraticCurveTo(x + 8, y - 4, x + 20, y - flap); c.stroke();
      }
    }, { tooth: tooth(1820), offset: [-3, 2], alpha: 0.95 });

    ink(f, 'g18-teal', g => {
      composite(g, cached(f, 'g18-teal-static', st => {
        const c = design(st);
        c.fillStyle = TEAL;
        c.fill(polyPath(CONE));
        screen(c, [0, HORIZON, W, H - HORIZON], { color: TEAL, cell: 7, angle: 1.31, density: (_x, y) => 0.45 + 0.4 * smooth(HORIZON, H, y) });
        c.globalCompositeOperation = 'destination-out';
        for (const lv of LAVA) c.fill(polyPath(channel(lv, 30, 10)));
      }));
    }, { tooth: tooth(1821), offset: [2, -2] });

    ink(f, 'g18-orange', g => {
      composite(g, cached(f, 'g18-orange-static', st => {
        const c = design(st);
        screen(c, [0, 0, W, HORIZON], { color: ORANGE, cell: 7, angle: 0.26, density: (_x, y) => 0.6 * smooth(120, 640, y) * (1 - smooth(700, HORIZON, y) * 0.4) });
        c.globalCompositeOperation = 'destination-out';
        c.beginPath(); c.arc(SUN[0], SUN[1], SUN_R, 0, TAU); c.fill();
        c.globalCompositeOperation = 'source-over';
        c.fillStyle = ORANGE;
        for (const lv of LAVA) c.fill(polyPath(channel(lv, 30, 10)));
      }));
      const c = design(g);
      // smoke lit from below while it is young
      c.save();
      for (const e of puffs) {
        const q = puffAt(e.u, e.index), hot = clamp(1 - e.u * 2.2, 0, 1);
        if (hot <= 0) continue;
        const path = new Path2D();
        path.arc(q.x, q.y + q.r * 0.3, q.r * 0.9, 0, TAU);
        screen(c, [q.x - q.r, q.y - q.r, q.r * 2, q.r * 2.4], { color: ORANGE, cell: 7, angle: 0.26, density: 0.7 * hot, clip: path });
      }
      c.restore();
      // the sun's road on the open water
      const water = new Path2D();
      water.rect(0, HORIZON, W, H - HORIZON);
      water.addPath(polyPath(LAND));
      c.clip(water, 'evenodd');
      c.fillStyle = ORANGE;
      for (let k = 0; k < 14; k++) {
        const y = HORIZON + 18 + k * 30, half = (150 - k * 6) * (0.7 + 0.3 * wave(p, 3, k * 0.17)), dx = 14 * wave(p, 2, k * 0.11);
        c.fillRect(SUN[0] - half + dx, y, half * 2, 7 + k * 0.4);
      }
    }, { tooth: tooth(1822), alpha: 0.95 });

    ink(f, 'g18-yellow', g => {
      composite(g, cached(f, 'g18-yellow-static', st => {
        const c = design(st);
        screen(c, [0, 0, W, HORIZON], { color: YELLOW, cell: 7, angle: 0, density: (_x, y) => 0.95 * smooth(260, HORIZON, y) });
        c.fillStyle = YELLOW;
        c.beginPath(); c.arc(SUN[0], SUN[1], SUN_R, 0, TAU); c.fill();
        c.globalCompositeOperation = 'destination-out';
        c.save();
        c.beginPath(); c.arc(SUN[0], SUN[1], SUN_R + 1, 0, TAU); c.clip();
        for (let k = 0; k < 6; k++) c.fillRect(SUN[0] - SUN_R, SUN[1] + 20 + k * 30, SUN_R * 2, 6 + k * 3);
        c.restore();
        c.fill(polyPath(CONE));
        c.globalCompositeOperation = 'source-over';
        screen(c, [0, HORIZON, W, H - HORIZON], { color: YELLOW, cell: 7, angle: 0, density: (x, y) => 0.5 * Math.max(0, 1 - Math.abs(x - SUN[0]) / 360) * (1 - smooth(HORIZON, H, y)) });
      }));
      const c = design(g);
      // lava: hot cores and the crater's breathing glow
      c.fillStyle = YELLOW;
      for (const lv of LAVA) c.fill(polyPath(channel(lv, 12 * glow, 3)));
      screen(c, [CRATER[0] - 260, CRATER[1] - 240, 520, 420], { color: YELLOW, cell: 6, angle: 0, density: (x, y) => glow * clamp(1 - Math.hypot(x - CRATER[0], (y - CRATER[1]) * 1.4) / 230, 0, 1) });
    }, { tooth: tooth(1823), offset: [1, 3] });
  },
};
