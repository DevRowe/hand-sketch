/**
 * G02 "Bamboo Wind" (wind; sumi brush). A sumi-e bamboo grove on rice paper, whole from the first frame. The wind is
 * the only thing that moves: gusts bend the culms (a pinned-wobble morph, so the brush quality holds while they
 * bend), leaves shiver and swing downwind, a few tear loose and tumble across, and dry-brush streaks of wind pass.
 *
 * Culms are painted as separate brush segments between nodes (sub-ranges of one morphing stroke), with a knuckle
 * mark at each node riding the wobbled line. Everything is a whole number of cycles per loop.
 */
import { catmullRom } from '../../core/geometry';
import { emissions } from '../../core/emitter';
import { clamp, TAU, type Vec2 } from '../../core/math';
import { hashSeed, loopNoise, rng } from '../../core/random';
import type { Scene } from '../../core/scene';
import { drawStroke, drawStrokeRange, prepareMorph, prepareStroke, sampleStroke, withPressure, type PreparedStroke, type StrokeStyle } from '../../core/stroke';
import { fit, ground, ink, perSize, phase, polyPath, scissor, still, swell, wave, type Fit } from './common';
import { GALLERY } from './palettes';

const PAL = GALLERY.sumi;
const SEAL = PAL.accents[0]!;
const LOOP = 144;

const BRUSH: StrokeStyle = { color: PAL.ink, size: 28, thinning: 0.55, smoothing: 0.6, streamline: 0.25, wobble: 1.2, wobbleWavelength: 380, tremor: 0.25, pressureVariation: 0.7, pressureWavelength: 220, dryBrush: 0.55, paper: PAL.paper, taperStart: 6, taperEnd: 6 };
const LEAF: StrokeStyle = { color: PAL.ink, size: 26, thinning: 0.92, smoothing: 0.7, streamline: 0.3, wobble: 0.8, wobbleWavelength: 200, tremor: 0.2, pressureVariation: 0.25, dryBrush: 0.3, paper: PAL.paper, taperStart: 10, taperEnd: 90 };
const TWIG: StrokeStyle = { ...BRUSH, size: 7, thinning: 0.7, dryBrush: 0.25, taperStart: 4, taperEnd: 30 };

interface Leaf { stroke: PreparedStroke; angle: number; seed: number; tone: number }
interface Cluster { leaves: Leaf[]; at: Vec2 }
interface Branch { u: number; side: number; spread: number; twig: PreparedStroke; clusters: Cluster[] }
interface Culm {
  morph: (t: number) => PreparedStroke;
  nodes: number[];
  node: PreparedStroke;
  branches: Branch[];
  flex: number;
  alpha: number;
  size: number;
}

/** A leaf pointing along +x: fat near its root, drawn out to a fine tip. */
function leaf(len: number, seed: number, scale: number): PreparedStroke {
  const pts = catmullRom([[0, 0], [len * 0.3, -len * 0.05], [len * 0.7, -len * 0.035], [len, len * 0.03]], 8);
  const st = prepareStroke(pts, { ...LEAF, size: LEAF.size * scale, taperEnd: len * 0.75 }, seed);
  return withPressure(st, u => (u < 0.22 ? 0.55 + u * 2.2 : 1.05 - (u - 0.22) * 0.8));
}

function culmPath(x0: number, y0: number, H: number, lean: number, bend: number): Vec2[] {
  return Array.from({ length: 41 }, (_, k): Vec2 => {
    const u = k / 40;
    return [x0 + lean * u * H + bend * u * u, y0 - u * H];
  });
}

const SPECS = [
  { x: 150, lean: 0.03, H: 1560, size: 18, alpha: 0.26, flex: 150, seed: 11 },
  { x: 640, lean: -0.05, H: 1600, size: 20, alpha: 0.24, flex: 170, seed: 12 },
  { x: 930, lean: 0.02, H: 1500, size: 16, alpha: 0.22, flex: 140, seed: 13 },
  { x: 300, lean: -0.035, H: 1620, size: 30, alpha: 0.95, flex: 120, seed: 21 },
  { x: 470, lean: 0.07, H: 1520, size: 25, alpha: 0.9, flex: 160, seed: 22 },
  { x: 770, lean: -0.1, H: 1180, size: 21, alpha: 0.82, flex: 190, seed: 23 },
];

const layout = perSize((w, h) => {
  const F: Fit = fit(w, h, 1080, 1350);
  const culms: Culm[] = SPECS.map(sp => {
    const r = rng(sp.seed * 7);
    const style = { ...BRUSH, size: sp.size, dryBrush: sp.alpha > 0.5 ? 0.3 : 0.1 };
    const morph = prepareMorph(culmPath(sp.x, 1420, sp.H, sp.lean, 0), culmPath(sp.x, 1420, sp.H, sp.lean, sp.flex), style, sp.seed * 131);
    const nodes: number[] = [];
    for (let u = 0.1 + r() * 0.05; u < 0.98; u += (150 + r() * 70) / sp.H) nodes.push(u);
    const node = prepareStroke(catmullRom([[-sp.size * 0.85, -3], [-sp.size * 0.3, 2], [sp.size * 0.3, 2], [sp.size * 0.9, -4]], 5), { ...style, size: sp.size * 0.34, thinning: 0.6, taperStart: 6, taperEnd: 10, dryBrush: 0 }, sp.seed * 17);
    const branches: Branch[] = [];
    nodes.forEach((u, k) => {
      if (u < 0.36 || (k + sp.seed) % 2 === 1) return;
      const side = (k + sp.seed) % 4 < 2 ? -1 : 1, len = 150 + r() * 110, spread = 0.55 + r() * 0.35;
      const twigPts = catmullRom([[0, 0], [len * 0.4, -len * 0.08 * side], [len, -len * 0.02 * side]], 6);
      const scale = sp.alpha > 0.5 ? 1 : 0.8;
      const clusterAt = (x: number, y: number, n: number, base: number, sd: number): Cluster => {
        const rr = rng(sd);
        return {
          at: [x, y],
          leaves: Array.from({ length: n }, (_, j) => ({
            stroke: leaf((120 + rr() * 90) * scale, hashSeed(sd, j), scale),
            angle: base + (j - (n - 1) / 2) * 0.32 + (rr() - 0.5) * 0.2,
            seed: hashSeed(sd, j, 3),
            tone: 0.72 + rr() * 0.28,
          })),
        };
      };
      branches.push({
        u, side, spread,
        twig: prepareStroke(twigPts, { ...TWIG, size: TWIG.size * scale }, sp.seed * 1000 + k),
        clusters: [
          clusterAt(len, -len * 0.02 * side, 4 + Math.floor(r() * 2), side > 0 ? 0.8 : Math.PI - 0.8, sp.seed * 97 + k),
          clusterAt(len * 0.45, -len * 0.08 * side, 3, side > 0 ? 1.25 : Math.PI - 1.25, sp.seed * 89 + k),
        ],
      });
    });
    return { morph, nodes, node, branches, flex: sp.flex, alpha: sp.alpha, size: sp.size };
  });
  const streaks = [0, 1, 2, 3].map(k => {
    const y = 260 + k * 260;
    return prepareStroke(catmullRom([[-120, y], [300, y - 30], [700, y + 10], [1220, y - 40]], 8), { ...BRUSH, size: 5, thinning: 0.4, dryBrush: 0.85, taperStart: 120, taperEnd: 200, wobble: 3 }, 700 + k);
  });
  const flyer = leaf(110, 777, 0.9);
  return { F, culms, streaks, flyer };
});

/** Gust strength 0..1: two big gusts per loop over a restless periodic breeze. */
const gust = (p: number): number => clamp(0.15 + 0.55 * swell(p, 2, -0.1) + loopNoise(p, 4040, 1.4) * 0.7, 0, 1);

function drawCulm(ctx: CanvasRenderingContext2D, c: Culm, p: number, lag: number): void {
  const g = gust(p - lag), stroke = c.morph(g);
  ctx.save();
  ctx.globalAlpha *= c.alpha;
  let from = 0;
  const gap = (c.size * 0.35) / stroke.length;
  for (const u of [...c.nodes, 1.02]) {
    drawStrokeRange(ctx, stroke, from + gap, Math.min(1, u - gap), { taperStart: 0, taperEnd: 0 });
    from = u;
  }
  for (const u of c.nodes) {
    const at = sampleStroke(stroke, u);
    ctx.save();
    ctx.translate(at.point[0], at.point[1]);
    ctx.rotate(at.angle + Math.PI / 2);
    drawStroke(ctx, c.node, 1);
    ctx.restore();
  }
  for (const b of c.branches) {
    const at = sampleStroke(stroke, b.u);
    ctx.save();
    ctx.translate(at.point[0], at.point[1]);
    // branches rise off the culm's tangent and swing a little further downwind
    const rotB = at.angle + b.side * b.spread + g * 0.18;
    ctx.rotate(rotB);
    drawStroke(ctx, b.twig, 1);
    for (const cl of b.clusters) {
      ctx.save();
      ctx.translate(cl.at[0], cl.at[1]);
      for (const lf of cl.leaves) {
        const flutter = 0.07 * wave(p, 12, (lf.seed % 97) / 97) * (0.4 + g) + 0.04 * wave(p, 7, (lf.seed % 53) / 53);
        ctx.save();
        // leaves hang at an absolute angle and swing under towards downwind (0 rad) as the gust rises
        ctx.rotate(lf.angle * (1 - g * 0.3) + flutter - rotB);
        ctx.globalAlpha *= lf.tone;
        drawStroke(ctx, lf.stroke, 1);
        ctx.restore();
      }
      ctx.restore();
    }
    ctx.restore();
  }
  ctx.restore();
}

export const bambooWindScene: Scene = {
  name: 'bamboo-wind',
  duration: LOOP / 12,
  loopFrom: 0,
  poster: 40 / 12,
  draw(f) {
    const { ctx, stage } = f;
    const L = layout(stage.w, stage.h), p = phase(f), { P, s } = L.F;
    ground(f, PAL.paper, { seed: 202, texture: 1.3, vignette: 0.12, vignetteColor: '#6b5a3a' });
    const [ox, oy] = P(0, 0);

    // a pale ground wash and dry grass at the foot of the grove
    still(f, 'g02-ground', g => {
      const c = g.ctx;
      c.translate(ox, oy);
      c.scale(s, s);
      const grad = c.createLinearGradient(0, 980, 0, 1350);
      grad.addColorStop(0, 'rgba(120,114,100,0)');
      grad.addColorStop(1, 'rgba(120,114,100,0.28)');
      c.fillStyle = grad;
      c.fillRect(-200, 960, 1480, 420);
      const r = rng(2020);
      for (let k = 0; k < 60; k++) {
        const x = r() * 1080, y = 1300 + r() * 70, len = 50 + r() * 90, lean = (r() - 0.3) * 0.9;
        const st = prepareStroke(catmullRom([[x, y], [x + lean * len * 0.4, y - len * 0.6], [x + lean * len, y - len]], 4), { ...TWIG, size: 6 + r() * 3, alpha: 0.35 + r() * 0.5, dryBrush: 0.4, taperStart: 2, taperEnd: len * 0.8 }, 2100 + k);
        drawStroke(c, st, 1);
      }
    });

    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(s, s);
    // the grove: pale far culms first, the ink ones in front; the wind reaches the far ones a moment later
    L.culms.forEach((c, k) => drawCulm(ctx, c, p, c.alpha < 0.5 ? 0.03 + k * 0.01 : k * 0.012));

    // leaves torn loose, tumbling downwind
    for (const e of emissions(f.frame, LOOP, { every: 36, life: 60, offset: 14, jitter: [0, 9, 4, 12] })) {
      const u = e.u, y0 = [330, 520, 240, 420][e.index % 4]!;
      const x = 380 + u * 900, y = y0 + u * 260 + Math.sin(u * TAU * 1.2 + e.index) * 50;
      ctx.save();
      ctx.globalAlpha *= Math.min(1, u * 6) * Math.min(1, (1 - u) * 5) * 0.9;
      ctx.translate(x, y);
      ctx.rotate(u * TAU * (1.5 + (e.index % 2)) + e.index);
      ctx.scale(0.8, 0.8 * Math.cos(u * TAU * 2));
      drawStroke(ctx, L.flyer, 1);
      ctx.restore();
    }

    // wind: dry-brush streaks passing through with each gust
    for (const e of emissions(f.frame, LOOP, { every: 36, life: 30, offset: 6 })) {
      const st = L.streaks[e.index % L.streaks.length]!;
      ctx.save();
      ctx.globalAlpha *= 0.3 * Math.sin(Math.PI * e.u);
      drawStrokeRange(ctx, st, e.u * 1.4 - 0.45, e.u * 1.4);
      ctx.restore();
    }
    ctx.restore();

    // the seal, pressed once
    ink(f, 'g02-seal', g => {
      const c = g.ctx;
      c.translate(ox, oy);
      c.scale(s, s);
      const x = 900, y = 1150, S = 84;
      c.fillStyle = SEAL;
      c.fill(polyPath(scissor([[x, y], [x + S, y], [x + S, y + S * 1.25], [x, y + S * 1.25]], 909, 14, 1.8)));
      c.globalCompositeOperation = 'destination-out';
      c.lineWidth = 5.5;
      c.lineCap = 'square';
      c.strokeStyle = '#000';
      c.strokeRect(x + 9, y + 9, S - 18, S * 1.25 - 18);
      c.lineCap = 'round';
      c.beginPath();
      // a carved culm and two leaves
      c.moveTo(x + 34, y + S * 1.25 - 20); c.bezierCurveTo(x + 32, y + 70, x + 38, y + 44, x + 36, y + 20);
      c.moveTo(x + 36, y + 46); c.quadraticCurveTo(x + 52, y + 36, x + 66, y + 42);
      c.moveTo(x + 36, y + 66); c.quadraticCurveTo(x + 54, y + 64, x + 64, y + 80);
      c.stroke();
    }, { tooth: { seed: 2222, density: 60, size: 1.4, alpha: 0.5 }, alpha: 0.92 });
  },
};
