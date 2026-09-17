/**
 * G07 "Lamplight" (light and shadow, still life; etching). An etched still life that starts whole: a jug, two pears
 * and a bowl on a table under a hanging lamp. Someone brushed the lamp on the way past; it swings, and the whole plate
 * answers: the pool of light slides across the table and wall, the tone of the room (cross-hatching, layer on layer)
 * follows it, cast shadows swing the other way and the dark side of each object turns. A moth keeps the bulb company.
 *
 * Hatching is page-locked (the lines never swim; only the regions they fill move), each tonal step a further layer at
 * a new angle, as an etcher would bite it. The lamp's warmth is a single hand-laid tint.
 */
import { catmullRom, ellipsePoints } from '../../core/geometry';
import { clamp, TAU, type Vec2 } from '../../core/math';
import { noise1 } from '../../core/random';
import type { Scene } from '../../core/scene';
import { drawStroke, prepareStroke, type PreparedStroke, type StrokeStyle } from '../../core/stroke';
import { fit, ground, hatchLines, perSize, phase, polyPath, still, wave, type Fit } from './common';
import { GALLERY } from './palettes';

const PAL = GALLERY.etching;
const INK = PAL.ink;
const W = 1080, H = 1080;
const BACK = 640, FRONT = 990, PIVOT: Vec2 = [540, -90], CORD = 330;
const LOOP = 144;
const LINE: StrokeStyle = { color: INK, size: 2.2, thinning: 0.45, smoothing: 0.5, wobble: 0.6, wobbleWavelength: 160, tremor: 0.25, pressureVariation: 0.55, taperStart: 10, taperEnd: 14 };

type Box = [number, number, number, number];
const BOX: Box = [0, 0, W, H];

/** A smooth radius profile through [t, r] keys. */
function profile(keys: readonly Vec2[]): (t: number) => number {
  const curve = catmullRom(keys, 10);
  return t => {
    for (let k = 1; k < curve.length; k++) {
      const a = curve[k - 1]!, b = curve[k]!;
      if (t <= b[0]) return a[1] + ((b[1] - a[1]) * (t - a[0])) / Math.max(1e-6, b[0] - a[0]);
    }
    return curve[curve.length - 1]![1];
  };
}

/** A body of revolution's silhouette from a radius profile over height (base at 0, up is negative y). */
function lathe(height: number, radius: (t: number) => number, n = 30): Vec2[] {
  const right: Vec2[] = [], left: Vec2[] = [];
  for (let k = 0; k <= n; k++) {
    const t = k / n, r = radius(t);
    right.push([r, -t * height]);
    left.push([-r, -t * height]);
  }
  return [...right, ...left.reverse()];
}

interface Thing { at: Vec2; h: number; w: number; body: Vec2[]; lines: PreparedStroke[] }

const PEAR = profile([[0, 30], [0.08, 48], [0.28, 55], [0.48, 44], [0.68, 27], [0.84, 19], [0.95, 12], [1, 3]]);

function thing(at: Vec2, h: number, w: number, body: Vec2[], extra: Vec2[][], seed: number): Thing {
  const lines = [prepareStroke([...body, body[0]!], LINE, seed, { closed: true }), ...extra.map((p, k) => prepareStroke(p, { ...LINE, size: 1.8 }, seed + 1 + k))];
  return { at, h, w, body, lines };
}

const THINGS: Thing[] = [
  thing([840, 790], 70, 190, [...lathe(70, t => 60 + 36 * Math.sqrt(t), 16)], [ellipsePoints(0, -70, 96, 16, { start: 0, n: 40 })], 7100),
  thing([695, 836], 160, 110, lathe(160, PEAR, 40), [catmullRom([[0, -160], [4, -182], [14, -196]], 4)], 7200),
  thing([330, 856], 250, 180, lathe(250, profile([[0, 58], [0.12, 80], [0.38, 90], [0.6, 76], [0.76, 48], [0.88, 44], [0.97, 56], [1, 60]]), 40), [
    catmullRom([[-86, -170], [-140, -170], [-150, -120], [-120, -80], [-84, -70]], 6),
    catmullRom([[58, -250], [84, -262], [98, -270]], 4),
    ellipsePoints(0, -250, 60, 12, { start: 0, n: 36 }),
  ], 7300),
  thing([580, 886], 180, 124, lathe(180, t => PEAR(t) * 1.12, 40), [catmullRom([[0, -180], [-6, -204], [-18, -214]], 4)], 7400),
];

interface Layout { F: Fit; plate: PreparedStroke; table: PreparedStroke[]; shade: PreparedStroke[] }

const SHADE: Vec2[] = [[-24, CORD - 64], [24, CORD - 64], [100, CORD + 14], [-100, CORD + 14]];

const layout = perSize((w, h): Layout => ({
  F: fit(w, h, W, H),
  plate: prepareStroke([[44, 44], [1036, 44], [1036, 1036], [44, 1036], [44, 44]], { ...LINE, size: 1.4, alpha: 0.5, taperStart: 0, taperEnd: 0 }, 7001, { closed: true }),
  table: [prepareStroke([[44, BACK], [1036, BACK]], { ...LINE, size: 2 }, 7002), prepareStroke([[44, FRONT], [1036, FRONT]], { ...LINE, size: 2.6 }, 7003)],
  shade: [
    prepareStroke([...SHADE, SHADE[0]!], { ...LINE, size: 2.6 }, 7004, { closed: true }),
    prepareStroke(ellipsePoints(0, CORD + 14, 100, 16, { start: 0, n: 40 }), { ...LINE, size: 1.8 }, 7005, { closed: true }),
    prepareStroke([[0, 0], [0, CORD - 64]], { ...LINE, size: 1.8, taperStart: 0 }, 7006),
  ],
}));

/** Clip to everything outside a hand-bitten ellipse (its edge wanders, fixed to the plate), within a rectangle. */
function outside(ctx: CanvasRenderingContext2D, rect: Box, cx: number, cy: number, rx: number, ry: number, seed: number): void {
  const p = new Path2D();
  p.rect(...rect);
  for (let k = 0; k <= 72; k++) {
    const a = (k / 72) * TAU, wob = 1 + 0.07 * noise1(Math.cos(a) * 2 + 5, seed) + 0.05 * noise1(Math.sin(a) * 5 + 9, seed + 1);
    const x = cx + Math.cos(a) * rx * wob, y = cy + Math.sin(a) * ry * wob;
    if (k) p.lineTo(x, y); else p.moveTo(x, y);
  }
  p.closePath();
  ctx.clip(p, 'evenodd');
}

const LAYERS = [
  { angle: 0.85, gap: 7.5, width: 1.05 },
  { angle: -0.72, gap: 8, width: 1 },
  { angle: 0.08, gap: 6.5, width: 0.95 },
  { angle: 1.5, gap: 6, width: 0.9 },
];

function layer(ctx: CanvasRenderingContext2D, k: number, alpha = 0.9): void {
  const L = LAYERS[k]!;
  hatchLines(ctx, null, BOX, { angle: L.angle, gap: L.gap, color: INK, width: L.width, alpha, waver: 0.9, seed: 7010 + k });
}

export const lamplightScene: Scene = {
  name: 'lamplight',
  duration: LOOP / 12,
  loopFrom: 0,
  poster: 22 / 12,
  draw(f) {
    const { ctx, stage } = f;
    const L = layout(stage.w, stage.h), p = phase(f), { P, s } = L.F, [ox, oy] = P(0, 0);
    ground(f, PAL.paper, { seed: 707, texture: 0.9 });
    // the plate mark: the image area a shade darker, pressed into the sheet
    still(f, 'g07-plate', g => {
      const c = g.ctx;
      c.translate(ox, oy);
      c.scale(s, s);
      c.fillStyle = 'rgba(80,60,30,0.06)';
      c.fillRect(44, 44, 992, 992);
      drawStroke(c, L.plate, 1);
    });

    const swing = 0.14 * wave(p, 2);
    const bulb: Vec2 = [PIVOT[0] - Math.sin(swing) * (CORD + 8), PIVOT[1] + Math.cos(swing) * (CORD + 8)];
    const foot: Vec2 = [bulb[0], 800];

    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(s, s);
    ctx.beginPath();
    ctx.rect(44, 44, 992, 992);
    ctx.clip();

    // the warm tint first, under the line work: the lamp's own pool on wall and table
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    const wallGlow = ctx.createRadialGradient(bulb[0], bulb[1], 20, bulb[0], bulb[1], 520);
    wallGlow.addColorStop(0, 'rgba(232,184,90,0.55)');
    wallGlow.addColorStop(1, 'rgba(232,184,90,0)');
    ctx.fillStyle = wallGlow;
    ctx.fillRect(0, 0, W, BACK);
    ctx.save();
    ctx.translate(foot[0], foot[1]);
    ctx.scale(1, 0.34);
    const tableGlow = ctx.createRadialGradient(0, 0, 10, 0, 0, 560);
    tableGlow.addColorStop(0, 'rgba(232,184,90,0.5)');
    tableGlow.addColorStop(1, 'rgba(232,184,90,0)');
    ctx.fillStyle = tableGlow;
    ctx.fillRect(-1200, -1200, 2400, 2400);
    ctx.restore();
    ctx.restore();

    // the room's tone: each step darker away from the lamp is one more bitten layer
    const wall: Box = [0, 0, W, BACK], table: Box = [0, BACK, W, FRONT - BACK];
    [230, 360, 520, 700].forEach((R, k) => {
      ctx.save();
      outside(ctx, wall, bulb[0], bulb[1], R, R * 0.92, 7030 + k);
      layer(ctx, k, 0.8);
      ctx.restore();
      ctx.save();
      outside(ctx, table, foot[0], foot[1], R * 1.6, R * 0.5, 7040 + k);
      layer(ctx, k, 0.8);
      ctx.restore();
    });
    // the table's front apron in deep shade
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, FRONT, W, H - FRONT);
    ctx.clip();
    for (let k = 0; k < 4; k++) layer(ctx, k, 0.9);
    ctx.restore();

    // cast shadows: each silhouette thrown across the table away from the lamp's foot
    const shadows = new Path2D();
    for (const t of THINGS) {
      const dx = t.at[0] - foot[0], dy = t.at[1] - foot[1] + 60, m = Math.hypot(dx, dy) || 1, k = 0.9 + m / 500;
      const pts = t.body.map(([x, y]): Vec2 => [t.at[0] + x + (dx / m) * -y * k, t.at[1] + (dy / m) * -y * k * 0.45]);
      shadows.addPath(polyPath(pts));
      shadows.ellipse(t.at[0], t.at[1], t.w * 0.52, t.w * 0.12, 0, 0, TAU);
    }
    ctx.save();
    ctx.clip(shadows);
    for (let k = 0; k < 3; k++) layer(ctx, k, 0.95);
    ctx.restore();

    drawStroke(ctx, L.table[0]!, 1);
    drawStroke(ctx, L.table[1]!, 1);

    // the objects, back to front: paper first so they occlude, then their turning dark side, then line
    for (const t of [...THINGS].sort((a, b) => a.at[1] - b.at[1])) {
      const body = polyPath(t.body.map(([x, y]): Vec2 => [t.at[0] + x, t.at[1] + y]));
      ctx.fillStyle = PAL.paper;
      ctx.fill(body);
      const c: Vec2 = [t.at[0], t.at[1] - t.h * 0.5];
      const lx = bulb[0] - c[0], ly = bulb[1] - c[1], lm = Math.hypot(lx, ly), ux = lx / lm, uy = ly / lm;
      [-0.05, -0.32, -0.6].forEach((d, k) => {
        const o: Vec2 = [c[0] + ux * d * t.w, c[1] + uy * d * t.w], px = -uy, py = ux;
        const half: Vec2[] = [[o[0] + px * 900, o[1] + py * 900], [o[0] - px * 900, o[1] - py * 900], [o[0] - px * 900 - ux * 900, o[1] - py * 900 - uy * 900], [o[0] + px * 900 - ux * 900, o[1] + py * 900 - uy * 900]];
        ctx.save();
        ctx.clip(body);
        ctx.clip(polyPath(half));
        layer(ctx, k, 0.85);
        ctx.restore();
      });
      ctx.save();
      ctx.translate(t.at[0], t.at[1]);
      for (const st of t.lines) drawStroke(ctx, st, 1);
      ctx.restore();
    }

    // the lamp: cord, a dark hatched shade lit inside, and the bulb
    ctx.save();
    ctx.translate(PIVOT[0], PIVOT[1]);
    ctx.rotate(swing);
    const shade = polyPath(SHADE);
    ctx.fillStyle = PAL.paper;
    ctx.fill(shade);
    ctx.save();
    ctx.clip(shade);
    for (let k = 0; k < 3; k++) {
      const Lk = LAYERS[k]!;
      hatchLines(ctx, null, [-120, CORD - 80, 240, 110], { angle: Lk.angle, gap: 5, color: INK, width: 1.1, seed: 7020 + k, waver: 0.5 });
    }
    ctx.restore();
    ctx.fillStyle = '#fff4d6';
    ctx.beginPath();
    ctx.ellipse(0, CORD + 14, 96, 14, 0, 0, TAU);
    ctx.fill();
    for (const st of L.shade) drawStroke(ctx, st, 1);
    ctx.restore();
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const bloom = ctx.createRadialGradient(bulb[0], bulb[1] + 12, 0, bulb[0], bulb[1] + 12, 120);
    bloom.addColorStop(0, 'rgba(255,238,190,0.9)');
    bloom.addColorStop(1, 'rgba(255,238,190,0)');
    ctx.fillStyle = bloom;
    ctx.fillRect(bulb[0] - 120, bulb[1] - 108, 240, 240);
    ctx.restore();

    // the moth, three circuits of the bulb per loop, wings beating
    const a = TAU * p * 3, mx = bulb[0] + Math.cos(a) * 130, my = bulb[1] + 40 + Math.sin(a) * 46 + 14 * wave(p, 7);
    const beat = Math.abs(Math.sin(TAU * p * 60));
    ctx.save();
    ctx.translate(mx, my);
    ctx.rotate(Math.cos(a) * 0.4);
    ctx.fillStyle = PAL.paper;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.3;
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.scale(side * clamp(0.25 + beat, 0.25, 1), 1);
      ctx.beginPath();
      ctx.ellipse(9, -3, 11, 7, -0.4, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.ellipse(0, 0, 2.6, 7, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
    ctx.restore();
  },
};
