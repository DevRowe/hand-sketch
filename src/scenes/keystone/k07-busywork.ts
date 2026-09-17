/**
 * K07 "Busywork out of the week". A week planner fills with the same small pencil-hatched box at the same times every
 * day. On the beat an accent lane draws below the week; column by column the busywork boxes un-hatch, drop out of
 * the grid into the lane and merge into one accent block, leaving open paper and faint ghosts. Loop: the week stays
 * open while a small hatched task slides along the lane every 12 frames and is absorbed by the block.
 */
import { tick } from '../../art/glyphs';
import { emissions } from '../../core/emitter';
import { drawGroup, drawGroupRange, prepared, scheduleWithin, type Slot, type StrokeGroup } from '../../core/ink';
import { boilStep } from '../../core/loop';
import { easeIn, lerp, type Vec2 } from '../../core/math';
import { applyPose, type Pose } from '../../core/puppet';
import type { Scene, SceneFrame } from '../../core/scene';
import { sketch } from '../../core/sketch';
import { drawStroke } from '../../core/stroke';
import { clip } from '../../core/track';
import { accentPlate, coverage, DURATION, fillPoly, fit, group, lf, LOOP, LOOP_FROM, nf, paper, perSize, S, sec } from './common';

/** Storyboard in drawn frames (12 fps). */
const F = { grid: [0, 11], work: [11, 17], busy: [17, 31], lane: [35, 3], columns: { start: 36, step: 2, drop: 4, unhatch: 3 } } as const;
const EMIT = { every: 12, life: 12 } as const;
const COLS = 5, ROWS = 6, X0 = 360, Y0 = 170, CW = 240, RH = 90;
const BUSY: [number, number][] = [];
for (let c = 0; c < COLS; c++) for (const r of [0, 3]) BUSY.push([c, r]);
BUSY.splice(8, 0, [3, 5]);
const WORK: [number, number, number][] = [[0, 1, 2], [2, 4, 2], [4, 1, 2]];
const LANE_Y = 880, LANE_X0 = 360, BLOCK: Vec2 = [1500, LANE_Y - 38];
/** The pencil's uneven pace: extra frames before each box. */
const HAND = [0, 0.4, 1.1, 0.2, 0.9, 0.3, 1.2, 0.1, 0.6, 1.0, 0.2] as const;

// one busywork box in local units: every box in the week is literally the same box
const BW = 196, BH = 58;
const rough = (seed: number, roughness = 1) => ({ seed, roughness, disableMultiStroke: true });
const boxOutline = group(sketch.rectangle(-BW / 2, -BH / 2, BW, BH, rough(801, 1.3)).outline, S.PENCIL, 802);
const boxHatch = group(sketch.polygon([[-BW / 2, -BH / 2], [BW / 2, -BH / 2], [BW / 2, BH / 2], [-BW / 2, BH / 2]], { seed: 803, fill: 'x', fillStyle: 'hachure', hachureAngle: -41, hachureGap: 9, roughness: 1.1, disableMultiStroke: true, disableMultiStrokeFill: true }).fill, { ...S.PENCIL, size: 2.2, alpha: 0.7, taperStart: 6, taperEnd: 6 }, 804);
const OUTLINE_SLOTS = scheduleWithin(boxOutline, 0, sec(0.7), 0.01);
const HATCH_SLOTS = scheduleWithin(boxHatch, sec(0.6), sec(1.5), 0);

interface Layout {
  P(x: number, y: number): Vec2;
  s: number;
  grid: StrokeGroup; gridSlots: Slot[];
  heads: StrokeGroup; headSlots: Slot[];
  work: StrokeGroup; workSlots: Slot[]; workBodies: Vec2[][];
  lane: StrokeGroup; block: StrokeGroup; blockBody: Vec2[]; blockTick: StrokeGroup;
  laneClip: Vec2[];
}

const layout = perSize((w, h): Layout => {
  const { P, s } = fit(w, h, 1920, 1080);
  const rules: Vec2[][] = [...sketch.rectangle(...P(X0, Y0), COLS * CW * s, ROWS * RH * s, rough(811, 0.6)).outline];
  for (let c = 1; c < COLS; c++) rules.push(...sketch.line(P(X0 + c * CW, Y0), P(X0 + c * CW, Y0 + ROWS * RH), rough(812 + c, 0.4)).outline);
  for (let r = 1; r < ROWS; r++) rules.push(...sketch.line(P(X0, Y0 + r * RH), P(X0 + COLS * CW, Y0 + r * RH), rough(820 + r, 0.4)).outline);
  const grid = group(rules, S.FINE, 830);
  const heads = group(Array.from({ length: COLS }, (_, c) => [P(X0 + c * CW + CW / 2 - 16, Y0 - 34), P(X0 + c * CW + CW / 2 + 16, Y0 - 40)]), { ...S.PENCIL, taperStart: 6, taperEnd: 6 }, 831);
  const workRects = WORK.map(([c, r, span]) => [P(X0 + c * CW + 18, Y0 + r * RH + 14), (CW - 36) * s, (span * RH - 28) * s] as const);
  const work = group(workRects.flatMap(([p, ww, hh], k) => sketch.rectangle(p[0], p[1], ww, hh, rough(840 + k, 0.8)).outline), S.INK, 845);
  const bw = 150, bh = 76;
  const block = group(sketch.rectangle(...P(BLOCK[0] - bw / 2, BLOCK[1] - bh / 2), bw * s, bh * s, rough(850, 0.7)).outline, { ...S.FLOW, size: 6 }, 851);
  return {
    P, s, grid, gridSlots: scheduleWithin(grid, sec(F.grid[0]), sec(F.grid[1]), 0.01),
    heads, headSlots: scheduleWithin(heads, sec(7), sec(F.grid[1]), 0.04),
    work, workSlots: scheduleWithin(work, sec(F.work[0]), sec(F.work[1])),
    workBodies: workRects.map(([p, ww, hh]) => [p, [p[0] + ww, p[1]], [p[0] + ww, p[1] + hh], [p[0], p[1] + hh]]),
    lane: group([[P(LANE_X0, LANE_Y), P(1080, LANE_Y + 3), P(BLOCK[0] - 80, LANE_Y)]], S.FLOW, 852),
    block, blockBody: [P(BLOCK[0] - bw / 2, BLOCK[1] - bh / 2), P(BLOCK[0] + bw / 2, BLOCK[1] - bh / 2), P(BLOCK[0] + bw / 2, BLOCK[1] + bh / 2), P(BLOCK[0] - bw / 2, BLOCK[1] + bh / 2)],
    blockTick: group([tick(40).map(([x, y]): Vec2 => P(BLOCK[0] + 100 + x, BLOCK[1] - 60 + y))], S.TICK, 853),
    laneClip: [P(LANE_X0, 0), P(1920, 0), P(1920, 1080), P(LANE_X0, 1080)],
  };
});

/** Draw one busywork box at `pose`: outline, and hatching revealed or un-drawn to `hatch` (0..1 of its strokes). */
function drawBox(f: SceneFrame, pose: Pose, o: { t?: number; hatch?: number; boil: number; alpha?: number }): void {
  const { ctx } = f;
  ctx.save();
  applyPose(ctx, pose);
  if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
  const t = o.t ?? Infinity;
  drawGroup(f, boxOutline, OUTLINE_SLOTS, o.boil, t);
  if (o.hatch === undefined) drawGroup(f, boxHatch, HATCH_SLOTS, o.boil, t);
  else {
    const count = boxHatch.paths.length, shown = o.hatch * count;
    drawGroupRange(f, boxHatch, k => [0, Math.max(0, Math.min(1, shown - k))], o.boil);
  }
  ctx.restore();
}

export const busyworkScene: Scene = {
  name: 'busywork',
  duration: DURATION,
  loopFrom: LOOP_FROM,
  poster: 5.5,
  draw(f) {
    const { ctx, stage } = f;
    const L = layout(stage.w, stage.h), n = nf(f), loop = lf(f), boil = boilStep(f);
    paper(f);

    const laneIn = clip(n, F.lane[0], F.lane[1]);
    const absorbed = loop < 0 ? 0 : 1;
    accentPlate(f, 'busywork', g => {
      L.workBodies.forEach((b, k) => fillPoly(g, b, coverage(0.2 * clip(n, F.work[0] + 2 * k, 4))));
      const merged = loop < 0 ? clip(n, F.columns.start + F.columns.drop, 4) : absorbed;
      if (merged > 0) fillPoly(g, L.blockBody, coverage(0.6 * merged));
    });

    drawGroup(f, L.grid, L.gridSlots, boil);
    drawGroup(f, L.heads, L.headSlots);
    drawGroup(f, L.work, L.workSlots, boil);

    // the busywork: pencilled in day by day, then each column drops out into the lane, leaving a 15% ghost
    let at = F.busy[0];
    BUSY.forEach(([c, r], k) => {
      at += HAND[k]!;
      const [x, y] = L.P(X0 + c * CW + CW / 2, Y0 + r * RH + RH / 2);
      const home: Pose = { x, y, scale: L.s };
      const leave = F.columns.start + c * F.columns.step;
      if (n < leave) { drawBox(f, home, { t: f.t - sec(at), boil: 0 }); at += 1; return; }
      at += 1;
      drawBox(f, home, { boil: 0, alpha: 0.15, hatch: 0 });
      const u = clip(n, leave, F.columns.drop);
      if (u >= 1) return;
      const k2 = easeIn(u), [bx, by] = L.P(...BLOCK);
      drawBox(f, { x: lerp(x, bx, k2), y: lerp(y, by, k2), scale: L.s * lerp(1, 0.35, k2) }, { boil: 0, hatch: 1 - clip(n, leave, F.columns.unhatch) });
    });

    drawGroupRange(f, L.lane, () => [0, laneIn], boil);
    if (n >= F.columns.start + F.columns.drop) drawGroup(f, L.block, [], boil);

    // loop: a small hatched task slides out from the lane's mouth at constant speed and is absorbed by the block
    if (loop >= 0) {
      const [x0] = L.P(LANE_X0 - 60, 0), [x1] = L.P(BLOCK[0] - 100, 0), [, ly] = L.P(0, LANE_Y - 26);
      ctx.save();
      ctx.beginPath();
      L.laneClip.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.clip();
      for (const e of emissions(loop, LOOP, EMIT)) {
        if (e.age >= EMIT.life - 1) continue;
        drawBox(f, { x: lerp(x0, x1, e.age / (EMIT.life - 1)), y: ly, scale: L.s * 0.5 }, { boil });
      }
      ctx.restore();
      // the absorbing frame: a one-frame tick pulse
      const pulse = emissions(loop, LOOP, EMIT).some(e => e.age === EMIT.life - 1);
      if (pulse) drawStroke(ctx, prepared(L.blockTick)[0]!, 1);
    }
  },
};
