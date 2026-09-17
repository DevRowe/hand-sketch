/**
 * G09 "Rain Window" (weather; watercolour). An evening window in watercolour and pen, whole from the start. Beyond
 * the glass the city has dissolved wet-into-wet: blooms of lamp amber, rose and teal. The weather does the moving:
 * drops gather and suddenly run down the panes in stops and starts, headlights slide by below, the far lights breathe,
 * and steam rises from a cup left on the sill.
 *
 * The outside is glazed once into a cached layer (softened at half size, as paint spreads in wet paper); drops, lights
 * and steam are laid over it each frame. Running drops come from a periodic emitter, so the rain never seams.
 */
import { catmullRom } from '../../core/geometry';
import { emissions } from '../../core/emitter';
import { clamp, lerp, TAU, type Vec2 } from '../../core/math';
import { noise1, rng } from '../../core/random';
import type { Scene, SceneFrame } from '../../core/scene';
import { drawStroke, drawStrokeRange, prepareStroke, type PreparedStroke, type StrokeStyle } from '../../core/stroke';
import { circle, composite, fit, ground, perSize, phase, still, swell, toothMask, wash, wrap, type Fit } from './common';
import { GALLERY } from './palettes';

const PAL = GALLERY.watercolour;
const [INDIGO, BLUE, TEAL, AMBER, ROSE] = PAL.fills as [string, string, string, string, string];
const PEN_INK = PAL.ink;
const W = 1080, H = 1350, LOOP = 144;
const PANES: [number, number, number, number][] = [[140, 150, 386, 396], [556, 150, 386, 396], [140, 572, 386, 470], [556, 572, 386, 470]];
const PEN: StrokeStyle = { color: PEN_INK, size: 2.2, thinning: 0.55, wobble: 1.2, wobbleWavelength: 180, tremor: 0.35, pressureVariation: 0.6, taperStart: 12, taperEnd: 16, alpha: 0.9 };

const inPane = (x: number, y: number): boolean => PANES.some(([px, py, pw, ph]) => x > px + 6 && x < px + pw - 6 && y > py + 6 && y < py + ph - 6);
const panesPath = (): Path2D => {
  const p = new Path2D();
  for (const [x, y, w, h] of PANES) p.rect(x, y, w, h);
  return p;
};

interface Bokeh { x: number; y: number; r: number; color: string; k: number; o: number }
interface Layout {
  F: Fit;
  bokeh: Bokeh[];
  beads: { x: number; y: number; r: number }[];
  pen: PreparedStroke[];
  steam: PreparedStroke[];
}

const layout = perSize((w, h): Layout => {
  const F = fit(w, h, W, H), r = rng(909);
  const colors = [AMBER, AMBER, ROSE, TEAL, '#fff1c9', BLUE];
  const bokeh: Bokeh[] = Array.from({ length: 46 }, (_, k) => {
    const y = 420 + Math.pow(r(), 0.7) * 620;
    return { x: 120 + r() * 840, y, r: 16 + r() * 46 * (y / 1000), color: colors[k % colors.length]!, k: 1 + Math.floor(r() * 3), o: r() };
  });
  const beads: Layout['beads'] = [];
  for (let k = 0; k < 900 && beads.length < 230; k++) {
    const x = 140 + r() * 800, y = 150 + r() * 890, rad = 2 + Math.pow(r(), 3) * 9;
    if (inPane(x, y)) beads.push({ x, y, r: rad });
  }
  const line = (pts: Vec2[], seed: number, o: Partial<StrokeStyle> = {}) => prepareStroke(pts, { ...PEN, ...o }, seed);
  const pen: PreparedStroke[] = [];
  // window frame: outer and pane edges, drawn loosely, overshooting at corners
  for (const [k, [x, y, pw, ph]] of PANES.entries()) {
    pen.push(line([[x - 6, y], [x + pw + 8, y + 1]], 910 + k * 4), line([[x + pw, y - 6], [x + pw - 1, y + ph + 8]], 911 + k * 4), line([[x + pw + 6, y + ph], [x - 8, y + ph - 1]], 912 + k * 4), line([[x, y + ph + 6], [x + 1, y - 8]], 913 + k * 4));
  }
  pen.push(line([[100, 110], [982, 106]], 930, { size: 2.8 }), line([[980, 100], [984, 1082]], 931, { size: 2.8 }), line([[96, 106], [100, 1080]], 932, { size: 2.8 }));
  // the sill, a pot with a trailing plant, a cup
  pen.push(
    line([[40, 1080], [1040, 1084]], 940, { size: 3 }), line([[30, 1134], [1050, 1130]], 941, { size: 2.6 }), line([[40, 1080], [30, 1134]], 942), line([[1040, 1084], [1050, 1130]], 943),
    line(catmullRom([[200, 1080], [212, 990], [340, 990], [352, 1080]], 6), 944), line([[196, 990], [356, 990]], 945),
    line(catmullRom([[250, 990], [230, 900], [180, 850], [150, 860]], 6), 946, { size: 1.8 }),
    line(catmullRom([[300, 990], [320, 880], [380, 820], [430, 830]], 6), 947, { size: 1.8 }),
    line(catmullRom([[276, 990], [270, 860], [290, 760]], 6), 948, { size: 1.8 }),
    line(catmullRom([[760, 1080], [752, 1020], [756, 996], [860, 996], [864, 1020], [856, 1080]], 6), 950),
    line(catmullRom([[864, 1018], [900, 1016], [902, 1050], [860, 1056]], 6), 951, { size: 1.8 }),
    line(catmullRom([[700, 1080], [720, 1090], [900, 1090], [920, 1080]], 6), 952, { size: 1.8 }),
  );
  const steam = [0, 1, 2].map(k => prepareStroke(catmullRom(Array.from({ length: 9 }, (_, j): Vec2 => [808 + noise1(j * 0.6, 960 + k) * 70 + Math.sin(j * 0.9 + k) * 16, 990 - j * 34]), 6), { color: '#8c95a8', size: 7, thinning: 0.4, wobble: 1, taperStart: 50, taperEnd: 80, pressureVariation: 0.3, alpha: 0.5 }, 961 + k));
  return { F, bokeh, beads, pen, steam };
});

function leaf(c: CanvasRenderingContext2D, x: number, y: number, a: number, s: number, seed: number): void {
  const pts = [[0, 0], [s * 0.5, -s * 0.28], [s, 0], [s * 0.5, s * 0.22]].map(([px, py]): Vec2 => [x + px! * Math.cos(a) - py! * Math.sin(a), y + px! * Math.sin(a) + py! * Math.cos(a)]);
  wash(c, catmullRom(pts, 5, true), '#5f8f5a', { alpha: 0.6, seed, bleed: 3, layers: 2 });
}

export const rainWindowScene: Scene = {
  name: 'rain-window',
  duration: LOOP / 12,
  loopFrom: 0,
  poster: 50 / 12,
  draw(f) {
    const { ctx, stage } = f;
    const L = layout(stage.w, stage.h), p = phase(f), { P, s } = L.F, [ox, oy] = P(0, 0);
    ground(f, PAL.paper, { seed: 909, texture: 1.5 });

    // outside, wet into wet: the sky, the dissolved blocks of the far street, softened at half size
    still(f, 'g09-outside', (g: SceneFrame) => {
      const half = g.stage.layer('g09-wet', Math.round(g.stage.outW / 2), Math.round(g.stage.outH / 2)), hc = g.stage.context(half);
      hc.setTransform(g.stage.scale / 2, 0, 0, g.stage.scale / 2, 0, 0);
      hc.translate(ox, oy);
      hc.scale(s, s);
      const sky = hc.createLinearGradient(0, 140, 0, 1060);
      sky.addColorStop(0, 'rgba(47,62,110,0.92)');
      sky.addColorStop(0.55, 'rgba(74,111,165,0.7)');
      sky.addColorStop(1, 'rgba(127,167,181,0.55)');
      hc.fillStyle = sky;
      hc.fillRect(120, 130, 840, 940);
      const r = rng(9090);
      for (let k = 0; k < 14; k++) {
        const bx = 100 + r() * 860, bw = 60 + r() * 140, top = 380 + r() * 260;
        wash(hc, [[bx, 1070], [bx, top], [bx + bw, top + (r() - 0.5) * 30], [bx + bw, 1070]], INDIGO, { alpha: 0.5, seed: 9100 + k, bleed: 14, layers: 3 });
      }
      wash(hc, [[100, 1070], [100, 930], [980, 900], [980, 1070]], '#1f2a4a', { alpha: 0.6, seed: 9120, bleed: 20 });
      const gc = g.ctx;
      gc.save();
      gc.translate(ox, oy);
      gc.scale(s, s);
      gc.clip(panesPath());
      gc.setTransform(1, 0, 0, 1, 0, 0);
      gc.filter = `blur(${(6 * g.stage.scale * s).toFixed(2)}px)`;
      gc.drawImage(half, 0, 0, g.stage.outW, g.stage.outH);
      gc.filter = 'none';
      gc.restore();
    });

    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(s, s);
    ctx.save();
    ctx.clip(panesPath());
    // the far lights breathe; every one a glaze with its pigment at the rim
    for (const [k, b] of L.bokeh.entries()) {
      const a = 0.55 + 0.45 * swell(p, b.k, b.o), disc = circle(b.x, b.y, b.r, 28, b.o * TAU);
      // light is paper lifted back out of the wash, then a thin tint glazed over it
      wash(ctx, disc, '#fbf6ea', { alpha: 0.32 * a, seed: 9200 + k, bleed: 3, layers: 2, edge: 0 });
      wash(ctx, disc, b.color, { alpha: 0.28 * a, seed: 9250 + k, bleed: 2.5, layers: 2, edge: 1.6 });
    }
    // headlights sliding by in the street, one lap per loop
    for (let k = 0; k < 2; k++) {
      const x = lerp(1180, -260, wrap(p + k * 0.5, 1)), y = 985 + k * 30;
      for (const dx of [0, 70]) {
        const glow = ctx.createRadialGradient(x + dx, y, 0, x + dx, y, 80);
        glow.addColorStop(0, 'rgba(255,236,190,0.85)');
        glow.addColorStop(0.3, 'rgba(240,166,74,0.45)');
        glow.addColorStop(1, 'rgba(240,166,74,0)');
        ctx.fillStyle = glow;
        ctx.fillRect(x + dx - 80, y - 80, 160, 160);
      }
      const trail = ctx.createLinearGradient(x, 0, x + 360, 0);
      trail.addColorStop(0, 'rgba(228,106,77,0.5)');
      trail.addColorStop(1, 'rgba(228,106,77,0)');
      ctx.fillStyle = trail;
      ctx.fillRect(x + 60, y + 16, 360, 8);
    }
    // rain beyond the glass
    ctx.strokeStyle = 'rgba(230,240,245,0.22)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    const r = rng(9300);
    for (let k = 0; k < 90; k++) {
      const x0 = r() * 1000 + 60, y0 = r() * 1100, sp = 1 + Math.floor(r() * 3), y = wrap(y0 + p * 1100 * sp * 4, 1100) + 100, x = x0 - (y - 100) * 0.12;
      ctx.moveTo(x, y);
      ctx.lineTo(x - 5, y + 38);
    }
    ctx.stroke();

    // drops on the glass: still beads, each a lens with a dark rim and a white glint
    const bead = (x: number, y: number, rad: number, alpha = 1) => {
      ctx.globalAlpha = alpha;
      ctx.fillStyle = 'rgba(255,255,255,0.14)';
      ctx.beginPath();
      ctx.arc(x, y, rad, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = 'rgba(31,42,74,0.55)';
      ctx.lineWidth = Math.max(1, rad * 0.35);
      ctx.beginPath();
      ctx.arc(x, y, rad * 0.8, 0.2, 2.2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath();
      ctx.arc(x - rad * 0.35, y - rad * 0.35, Math.max(0.8, rad * 0.22), 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
    };
    for (const b of L.beads) bead(b.x, b.y, b.r);
    // running drops: gather, then run in stops and starts, leaving a wet trail
    for (const e of emissions(f.frame, LOOP, { every: 9, life: 54, jitter: [0, 4, 2, 7] })) {
      const rr = rng(9400 + e.index), x0 = 150 + rr() * 780, y0 = 160 + rr() * 300;
      const pane = PANES.find(([px, py, pw, ph]) => x0 > px + 10 && x0 < px + pw - 10 && y0 > py && y0 < py + ph);
      if (!pane) continue;
      const bottom = pane[1] + pane[3] - 12, run = clamp((e.u - 0.2) / 0.8, 0, 1);
      // stick-slip: progress advances in lurches
      const lurch = run + 0.06 * Math.sin(run * TAU * 3 + e.index);
      const y = lerp(y0, bottom, clamp(lurch, 0, 1)), wig = (yy: number) => x0 + noise1(yy / 60, 9500 + e.index) * 14;
      const fade = 1 - clamp((e.u - 0.85) / 0.15, 0, 1);
      if (run > 0) {
        ctx.strokeStyle = `rgba(255,255,255,${0.28 * fade})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        for (let yy = y0; yy <= y; yy += 6) (yy === y0 ? ctx.moveTo(wig(yy), yy) : ctx.lineTo(wig(yy), yy));
        ctx.stroke();
      }
      bead(wig(y), y, 5 + 3 * Math.min(1, e.u * 5), fade);
    }
    ctx.restore();
    ctx.restore();

    // the room side: frame washes and pen, the sill and its things
    still(f, 'g09-room', g => {
      const c = g.ctx;
      c.translate(ox, oy);
      c.scale(s, s);
      const wood = '#9b7b62';
      const frame = new Path2D();
      frame.rect(96, 104, 890, 976);
      for (const [x, y, pw, ph] of PANES) frame.rect(x, y, pw, ph);
      c.save();
      c.clip(frame, 'evenodd');
      wash(c, [[96, 104], [986, 104], [986, 1080], [96, 1080]], wood, { alpha: 0.55, seed: 9600, bleed: 6 });
      c.restore();
      wash(c, [[0, 0], [1080, 0], [1080, 100], [0, 96]], '#c9bfb2', { alpha: 0.5, seed: 9601, bleed: 10 });
      wash(c, [[0, 96], [96, 104], [96, 1080], [0, 1080]], '#c9bfb2', { alpha: 0.5, seed: 9602, bleed: 10 });
      wash(c, [[986, 104], [1080, 96], [1080, 1080], [986, 1080]], '#b8ad9f', { alpha: 0.5, seed: 9603, bleed: 10 });
      wash(c, [[30, 1080], [1050, 1082], [1050, 1134], [30, 1136]], '#b88f6a', { alpha: 0.6, seed: 9604, bleed: 4 });
      wash(c, [[0, 1136], [1080, 1130], [1080, 1350], [0, 1350]], '#cfc5b8', { alpha: 0.45, seed: 9605, bleed: 12 });
      wash(c, [[204, 990], [348, 990], [340, 1080], [212, 1080]], '#c46a4a', { alpha: 0.7, seed: 9606, bleed: 3 });
      wash(c, [[756, 998], [860, 998], [856, 1080], [760, 1080]], '#e9e1d2', { alpha: 0.8, seed: 9607, bleed: 3 });
      wash(c, [[770, 1000], [846, 1000], [846, 1018], [770, 1018]], '#6b4a32', { alpha: 0.7, seed: 9608, bleed: 2 });
      const rl = rng(9610);
      for (let k = 0; k < 16; k++) {
        const stem = k % 3, t = rl();
        const [sx, sy] = stem === 0 ? [lerp(250, 150, t), lerp(990, 860, t)] : stem === 1 ? [lerp(300, 430, t), lerp(990, 830, t)] : [lerp(276, 290, t), lerp(990, 760, t)];
        leaf(c, sx, sy, -1.2 - rl() * 2 + (stem === 1 ? 1.8 : 0), 40 + rl() * 30, 9620 + k);
      }
      // curtains drawn back to either side, and their rod
      for (const side of [0, 1]) {
        const x0 = side ? 1100 : -20, x1 = side ? 930 : 150, sign = side ? -1 : 1;
        const cloth: Vec2[] = [[x0, 50], [x1, 50], ...catmullRom([[x1, 50], [x1 - sign * 30, 400], [x1 + sign * 10, 800], [x1 - sign * 40, 1300]], 8).slice(1), [x0, 1300]];
        wash(c, cloth, '#c9867a', { alpha: 0.62, seed: 9640 + side, bleed: 8, layers: 3, edge: 0.9 });
        for (let j = 1; j < 4; j++) {
          const fx = lerp(x0, x1, j / 4);
          wash(c, catmullRom([[fx - 8, 60], [fx + sign * 6, 600], [fx - sign * 10, 1290], [fx + 10, 1290], [fx + sign * 16, 600], [fx + 8, 60]], 6), '#8f4f4a', { alpha: 0.35, seed: 9650 + side * 10 + j, bleed: 5, layers: 2 });
        }
      }
      wash(c, [[-10, 40], [1090, 40], [1090, 58], [-10, 58]], '#6b4a32', { alpha: 0.75, seed: 9660, bleed: 2 });
      for (const st of L.pen) drawStroke(c, st, 1);
      // pigment granulation and paper lifting through all of it
      composite(g, toothMask(g, { seed: 9670, density: 40, size: 1.4, color: '#3a3226' }), { alpha: 0.12 });
      composite(g, toothMask(g, { seed: 9671, density: 60, size: 0.9, color: PAL.paper }), { alpha: 0.18 });
    });

    // steam from the cup
    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(s, s);
    for (const e of emissions(f.frame, LOOP, { every: 16, life: 48, offset: 3 })) {
      const st = L.steam[e.index % 3]!;
      ctx.save();
      ctx.globalAlpha = Math.sin(Math.PI * e.u) * 0.8;
      drawStrokeRange(ctx, st, e.u * 1.2 - 0.4, e.u * 1.2);
      ctx.restore();
    }
    ctx.restore();
  },
};
