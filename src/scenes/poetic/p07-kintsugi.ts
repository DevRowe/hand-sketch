/**
 * P07 "Kintsugi" (resilience). A bowl is drawn and glazed. On one frame it cracks and three pieces part, only a
 * little, and stay apart for a long breath. Slowly they are brought back together, and the cracks are traced in gold,
 * seam by seam, the pen pressing hardest where the break was worst. The loop is a glint of light travelling the gold.
 */
import { MOODS } from '../../art/moods';
import { plate, printPlate } from '../../art/print';
import { catmullRom, ellipsePoints } from '../../core/geometry';
import { drawGroup, scheduleWithin, type Slot, type StrokeGroup } from '../../core/ink';
import { clamp, type Vec2 } from '../../core/math';
import { rng } from '../../core/random';
import type { Scene } from '../../core/scene';
import { drawStroke, drawStrokeRange, prepareStroke, withPressure, type PreparedStroke, type StrokeStyle } from '../../core/stroke';
import { clip, track } from '../../core/track';
import { coverage, fillPoly, fit, glow, group, nf, perSize, sec, stock } from './common';

const M = MOODS.gilt;
const GOLD = M.inks[0]!, SHINE = '#f6dea0';
const LINE: StrokeStyle = { color: M.ink, size: 4.4, thinning: 0.6, wobble: 1.5, wobbleWavelength: 200, tremor: 0.35, pressureVariation: 0.5, dryBrush: 0.2, paper: M.paper, taperStart: 24, taperEnd: 32 };
const CRACK: StrokeStyle = { color: M.ink, size: 2, thinning: 0.4, wobble: 0.4, tremor: 0.2, pressureVariation: 0.4, taperStart: 8, taperEnd: 8, alpha: 0.9 };
const GILD: StrokeStyle = { color: GOLD, size: 9, thinning: 0.55, wobble: 0.9, wobbleWavelength: 160, tremor: 0.25, pressureVariation: 0.35, dryBrush: 0.3, paper: '#8a6420', taperStart: 14, taperEnd: 18 };

/** Storyboard in drawn frames (12 fps). */
const F = { bowl: [0, 40], ground: [30, 44], glaze: [30, 54], crack: 64, part: [65, 71], mend: [100, 136], gold: [140, 196], loopFrom: 204 } as const;
const LOOP = 48;

const RIM_Y = 430, RX = 300, RY = 44;
const J: Vec2 = [520, 612];

/** A crack between two points: a jagged polyline, seeded. */
function jag(pts: readonly Vec2[], seed: number, amp = 9): Vec2[] {
  const r = rng(seed), out: Vec2[] = [];
  pts.forEach((p, k) => {
    out.push(p);
    const q = pts[k + 1];
    if (!q) return;
    for (let j = 1; j < 3; j++) {
      const t = j / 3, dx = q[0] - p[0], dy = q[1] - p[1], len = Math.hypot(dx, dy) || 1;
      const off = (r() - 0.5) * 2 * amp;
      out.push([p[0] + dx * t - (dy / len) * off, p[1] + dy * t + (dx / len) * off]);
    }
  });
  return out;
}

// the three cracks meet at J: A from over the rim down to J, C from J through the foot, B from J out to the right
const A = jag([[452, 0], [458, 330], [470, 440], [478, 478], [466, 530], [498, 574], J], 7101);
const C = jag([J, [512, 668], [548, 716], [538, 800], [546, 1080]], 7102);
const B = jag([J, [582, 600], [640, 646], [704, 622], [772, 664], [1080, 652]], 7103);
const rev = (p: readonly Vec2[]) => p.slice().reverse();
const REGIONS: Vec2[][] = [
  [[0, 0], ...A, ...C.slice(1), [0, 1080]],
  [[1080, 0], [1080, 652], ...rev(B).slice(1), ...rev(A).slice(1)],
  [...B, [1080, 1080], ...rev(C).slice(0, -1)],
];
/** How each piece parts: offset (design units) and rotation, at full separation. */
const PART: readonly { d: Vec2; r: number }[] = [{ d: [-34, 8], r: -0.045 }, { d: [26, -30], r: 0.05 }, { d: [22, 24], r: 0.035 }];
const PIVOTS: Vec2[] = [[380, 600], [700, 520], [660, 720]];

/** Separation: 0 whole, snapping apart on the crack (one overshoot frame), held, then eased home. */
const apart = track([
  { frame: F.part[0], value: 0 }, { frame: F.part[0] + 2, value: 1, ease: 'out', settle: 0.12 }, { frame: F.part[1], value: 1 },
  { frame: F.mend[0], value: 1 }, { frame: F.mend[1], value: 0, ease: 'inOut' },
]);

interface Layout {
  P(x: number, y: number): Vec2; s: number;
  bowl: StrokeGroup; bowlSlots: Slot[]; ground: StrokeGroup; groundSlots: Slot[];
  silhouette: Path2D; outer: Vec2[]; foot: Vec2[]; inner: Vec2[]; regions: Path2D[]; pivots: Vec2[];
  cracks: StrokeGroup; seams: PreparedStroke[]; seamSlots: Slot[];
  /** Where the junction falls along the first seam, 0..1. */
  junction: number;
}

const layout = perSize((w, h): Layout => {
  const { P, s } = fit(w, h, 1080, 1080);
  const map = (pts: readonly Vec2[]) => pts.map(([x, y]) => P(x, y));
  const rim = ellipsePoints(540, RIM_Y, RX, RY, { turns: 1.03, start: Math.PI, n: 120 });
  const bodyPts: Vec2[] = [[240, RIM_Y + 2], [258, 540], [318, 660], [412, 736], [540, 756], [668, 736], [762, 660], [822, 540], [840, RIM_Y + 2]];
  const body = catmullRom(bodyPts, 10);
  const foot: Vec2[] = [[440, 748], [446, 792], [634, 792], [640, 748]];
  const bowl = group([rim, body, foot].map(map), { ...LINE, size: LINE.size * s }, 7001);
  const ground = group([map(catmullRom([[250, 796], [540, 794], [830, 797]], 8))], { ...LINE, size: 2.6 * s, alpha: 0.7, taperStart: 80, taperEnd: 80 }, 7002);
  const back = ellipsePoints(540, RIM_Y, RX, RY, { start: Math.PI, turns: 0.5, n: 60 });
  // bowl and foot as two clockwise polygons, so their union clips (nonzero) and fills without seams
  const outer = map([...back, ...body.slice().reverse()]);
  const footBody = map([[440, 740], [640, 740], [634, 792], [446, 792]]);
  const silhouette = new Path2D();
  for (const poly of [outer, footBody]) {
    poly.forEach(([x, y], k) => (k ? silhouette.lineTo(x, y) : silhouette.moveTo(x, y)));
    silhouette.closePath();
  }
  const regions = REGIONS.map(r => {
    const p = new Path2D();
    map(r).forEach(([x, y], k) => (k ? p.lineTo(x, y) : p.moveTo(x, y)));
    p.closePath();
    return p;
  });
  const cracks = group([A, C, B].map(map), { ...CRACK, size: CRACK.size * s }, 7003);
  // the gold: over the rim and down to the foot as one seam, then out along B; pressed hardest round the junction
  const through = [...A, ...C.slice(1)];
  const jAt = A.length / through.length;
  const seams = [
    withPressure(prepareStroke(map(through), { ...GILD, size: GILD.size * s }, 7004), u => 0.55 + 0.75 * Math.exp(-(((u - jAt) / 0.18) ** 2))),
    withPressure(prepareStroke(map(B), { ...GILD, size: GILD.size * s }, 7005), u => 1.25 - 0.7 * u),
  ];
  return {
    P, s, bowl, bowlSlots: scheduleWithin(bowl, sec(F.bowl[0] + 2), sec(F.bowl[1]), 0.12),
    ground, groundSlots: scheduleWithin(ground, sec(F.ground[0]), sec(F.ground[1])),
    silhouette, outer, foot: footBody, inner: map(ellipsePoints(540, RIM_Y, RX - 6, RY - 5, { n: 80 })), regions, pivots: PIVOTS.map(([x, y]) => P(x, y)),
    junction: jAt, cracks, seams, seamSlots: [{ start: sec(F.gold[0]), duration: sec(34) }, { start: sec(F.gold[0] + 36), duration: sec(F.gold[1] - F.gold[0] - 36) }],
  };
});

/** Transform `ctx` so piece `k` sits at separation `a`. */
function pose(ctx: CanvasRenderingContext2D, L: Layout, k: number, a: number): void {
  const [px, py] = L.pivots[k]!, { d, r } = PART[k]!;
  ctx.translate(px + d[0] * L.s * a, py + d[1] * L.s * a);
  ctx.rotate(r * a);
  ctx.translate(-px, -py);
}

function pieces(L: Layout, g: CanvasRenderingContext2D, a: number, paint: (k: number) => void): void {
  for (let k = 0; k < 3; k++) {
    g.save();
    if (a !== 0) pose(g, L, k, a);
    g.clip(L.regions[k]!);
    paint(k);
    g.restore();
  }
}

export const kintsugiScene: Scene = {
  name: 'kintsugi',
  duration: (F.loopFrom + LOOP) / 12,
  loopFrom: F.loopFrom / 12,
  poster: (F.loopFrom + 14) / 12,
  draw(f) {
    const { ctx, stage } = f;
    const L = layout(stage.w, stage.h), n = nf(f);
    stock(f, M.paper, { seed: 71, vignette: 0.22, vignetteColor: M.ink });
    const a = apart(n), broken = n >= F.crack;

    drawGroup(f, L.ground, L.groundSlots);

    // glaze: celadon on the outside, deeper inside the bowl, printed from one plate
    const glaze = clip(n, F.glaze[0], F.glaze[1] - F.glaze[0]);
    if (glaze > 0) {
      const p = plate(stage, 'kintsugi');
      pieces(L, p.ctx, broken ? a : 0, () => {
        fillPoly(p.ctx, L.outer, coverage(0.42 * glaze));
        fillPoly(p.ctx, L.foot, coverage(0.42 * glaze));
        fillPoly(p.ctx, L.inner, coverage(0.68 * glaze));
      });
      printPlate(ctx, stage, p.canvas, { ink: M.inks[1]!, cell: 7, angle: 0.4, seed: 73, alpha: 0.9 });
    }

    pieces(L, ctx, broken ? a : 0, () => {
      drawGroup(f, L.bowl, L.bowlSlots);
      if (broken) {
        ctx.save();
        ctx.clip(L.silhouette);
        drawGroup(f, L.cracks, []);
        ctx.restore();
      }
    });

    // the gold, traced once the pieces are home; then a glint travels it, first down through the junction, then out
    if (n >= F.gold[0]) {
      ctx.save();
      ctx.clip(L.silhouette);
      L.seams.forEach((seam, k) => {
        const slot = L.seamSlots[k]!, u = clamp((f.t - slot.start) / slot.duration, 0, 1);
        drawStroke(ctx, seam, 1 - Math.pow(1 - u, 2));
      });
      if (f.loopPhase !== null) {
        const m = (Math.round(f.loopPhase * LOOP * 1e6) / 1e6) % LOOP;
        const shine = (seam: PreparedStroke, u: number, len: number) => {
          if (u <= 0 || u - len >= 1) return;
          drawStrokeRange(ctx, { ...seam, style: { ...seam.style, color: SHINE, size: seam.style.size * 0.55, dryBrush: 0 } }, Math.max(0, u - len), Math.min(1, u), { taperStart: 18 * L.s, taperEnd: 18 * L.s });
        };
        shine(L.seams[0]!, clip(m, 0, 22) * 1.2, 0.2);
        shine(L.seams[1]!, clip(m, (22 * L.junction) / 1.2, 18) * 1.25, 0.25);
      }
      ctx.restore();
    }
    if (f.loopPhase !== null) {
      const m = (Math.round(f.loopPhase * LOOP * 1e6) / 1e6) % LOOP;
      const [jx, jy] = L.P(...J), spark = clip(m, 9, 3) * (1 - clip(m, 12, 10));
      glow(f, jx, jy, 70 * L.s, SHINE, spark * 0.8, { cell: 6, bloom: 0.5, seed: 7201 });
    }
  },
};
