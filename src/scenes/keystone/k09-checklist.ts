/**
 * K09 "Ticks itself, every week". A tear-off checklist pad. Row 1 gets a slow, hesitant pencil tick; row 2's pencil
 * tick stops halfway, and the rest tick themselves in accent as a chain, each starting on the frame the previous one
 * completes (row 1 re-inked in accent too). Loop: the week's sheet tears away upward, next week's sheet is already
 * written underneath, and it ticks itself again.
 */
import { checkbox, squiggle, tick } from '../../art/glyphs';
import { drawGroup, drawGroupRange, scheduleWithin, type Slot } from '../../core/ink';
import { boilStep } from '../../core/loop';
import { easeIn, lerp, type Vec2 } from '../../core/math';
import { applyPose, type Pose } from '../../core/puppet';
import type { Scene, SceneFrame } from '../../core/scene';
import { sketch } from '../../core/sketch';
import { chain, clip } from '../../core/track';
import { DURATION, fillPoly, fit, group, lf, LOOP_FROM, nf, paper, perSize, R, S, sec, withAlpha } from './common';

const ROWS = 6;
/** Storyboard in drawn frames (12 fps). */
const F = {
  pad: [0, 13],
  pencil1: [[13, 17], [20, 25]] as const, pencil2: [26, 29] as const,
  cascade: chain(29, [2, 2, 2, 2, 2]), reink: [29, 2] as const, ghostOut: [46, 2] as const,
  loop: { tear: [0, 6], cascade: 12, step: 2 },
} as const;

// the sheet in local units: origin at the binding's left end
const SW = 640, SH = 760, ROW0 = 130, PITCH = 108, BOX = 50;
const rough = (seed: number, roughness = 0.9) => ({ seed, roughness, disableMultiStroke: true });
const rowY = (k: number) => ROW0 + k * PITCH;
const sheetBody: Vec2[] = [[0, 0], [SW, 0], [SW, SH], [0, SH]];
const sheetOutline = group(sketch.linearPath([[0, 0], [0, SH], [SW, SH], [SW, 0]], rough(1001)).outline, S.INK, 1002);
const boxes = group(Array.from({ length: ROWS }, (_, k) => checkbox(BOX, 1010 + k).outline.map(p => p.map(([x, y]): Vec2 => [90 + x, rowY(k) + y]))).flat(), { ...S.INK, size: 4 }, 1020);
const tasks = group(Array.from({ length: ROWS }, (_, k) => squiggle(150, 150 + [380, 300, 340, 260, 360, 220][k]!, rowY(k), 1030 + k, { height: 9, step: 13 })), S.FINE, 1040);
const tickPath = (k: number, size = 64): Vec2[] => tick(size).map(([x, y]): Vec2 => [96 + x, rowY(k) - 6 + y]);
const ticks = group(Array.from({ length: ROWS }, (_, k) => tickPath(k)), S.TICK, 1050);
// the hesitant hand: row 1 in two strokes, row 2 stopped mid-way
const pencil1 = group([tickPath(0).slice(0, 2), tickPath(0).slice(1)], { ...S.PENCIL, size: 3.4 }, 1060);
const pencil2 = group([tickPath(1)], { ...S.PENCIL, size: 3.4 }, 1061);
const SHEET_SLOTS: Slot[][] = [scheduleWithin(sheetOutline, sec(2), sec(6)), scheduleWithin(boxes, sec(5), sec(10), 0.02), scheduleWithin(tasks, sec(6), sec(F.pad[1]), 0.02)];

interface Layout { P(x: number, y: number): Vec2; s: number; origin: Vec2; binding: ReturnType<typeof group>; bindingSlots: Slot[]; bindingBody: Vec2[]; stub: ReturnType<typeof group> }
const layout = perSize((w, h): Layout => {
  const { P, s } = fit(w, h, 1080, 1440, 1, [540, 740]);
  const x0 = 540 - SW / 2, y0 = 330;
  const band = sketch.rectangle(...P(x0 - 20, y0 - 56), (SW + 40) * s, 56 * s, rough(1070, 0.8)).outline;
  const rings = Array.from({ length: 7 }, (_, k): Vec2[] => [P(x0 + 40 + k * 93, y0 - 42), P(x0 + 40 + k * 93, y0 - 14)]);
  // what a tear leaves at the binding: a ragged pencil edge
  const teeth: Vec2[] = [];
  for (let k = 0; k <= 24; k++) teeth.push(P(x0 + (k * SW) / 24, y0 + 8 + (k % 2 ? 10 : 0) + ((k * 7) % 5)));
  return {
    P, s, origin: P(x0, y0),
    binding: group([...band, ...rings], S.INK, 1071), bindingSlots: scheduleWithin(group([...band, ...rings], S.INK, 1071), 0, sec(4)),
    bindingBody: [P(x0 - 20, y0 - 56), P(x0 + SW + 20, y0 - 56), P(x0 + SW + 20, y0), P(x0 - 20, y0)],
    stub: group([teeth], { ...S.PENCIL, size: 2.4 }, 1072),
  };
});

/** Draw one sheet at `pose` (local origin at the binding's left end) with each row's tick drawn to `ticked[k]`. */
function drawSheet(f: SceneFrame, pose: Pose, ticked: readonly number[], o: { boil: number; t?: number; pencil?: (ctx: CanvasRenderingContext2D) => void }): void {
  const { ctx } = f;
  ctx.save();
  applyPose(ctx, pose);
  fillPoly(ctx, sheetBody, R.stock);
  [sheetOutline, boxes, tasks].forEach((g, k) => drawGroup(f, g, SHEET_SLOTS[k]!, o.boil, o.t ?? Infinity));
  o.pencil?.(ctx);
  drawGroupRange(f, ticks, k => [0, ticked[k] ?? 0], o.boil);
  ctx.restore();
}

export const checklistScene: Scene = {
  name: 'checklist',
  duration: DURATION,
  loopFrom: LOOP_FROM,
  poster: 46 / 12,
  draw(f) {
    const { ctx, stage } = f;
    const L = layout(stage.w, stage.h), n = nf(f), loop = lf(f), boil = boilStep(f);
    paper(f);
    const home: Pose = { x: L.origin[0], y: L.origin[1], scale: L.s };

    if (loop < 0) {
      const ticked = Array.from({ length: ROWS }, (_, k) => k === 0 ? clip(n, F.reink[0], F.reink[1]) : clip(n, F.cascade[k - 1]!.start, F.cascade[k - 1]!.frames));
      drawSheet(f, home, ticked, {
        boil, t: f.t,
        // the pencil: slow, two strokes with a hold, then a second tick abandoned halfway; it fades just before the loop
        pencil: () => withAlpha(ctx, 1 - clip(n, F.ghostOut[0], F.ghostOut[1]), () => withAlpha(ctx, n >= F.reink[0] + 2 ? R.ghost / 0.82 : 1, () => {
          drawGroupRange(f, pencil1, k => [0, clip(n, F.pencil1[k]![0], F.pencil1[k]![1] - F.pencil1[k]![0])]);
          drawGroupRange(f, pencil2, () => [0, 0.5 * clip(n, F.pencil2[0], F.pencil2[1] - F.pencil2[0])]);
        })),
      });
    } else {
      // next week's sheet is already written underneath; it ticks itself as a chain once the old one has gone
      const cascade = Array.from({ length: ROWS }, (_, k) => clip(loop, F.loop.cascade + k * F.loop.step, F.loop.step));
      const tear = clip(loop, F.loop.tear[0], F.loop.tear[1]);
      // before the tear starts the old sheet covers the new one completely, so only one sheet is drawn
      if (tear > 0) drawSheet(f, home, cascade, { boil });
      withAlpha(ctx, tear > 0 ? 1 - clip(loop, F.loop.tear[1], 6) : 0, () => drawGroupRange(f, L.stub, () => [0, 1]));
      if (tear < 1) {
        const k = easeIn(tear);
        drawSheet(f, { ...home, x: home.x + lerp(0, 60, k) * L.s, y: home.y - lerp(0, 1500, k) * L.s, rotation: lerp(0, -0.16, k) }, Array(ROWS).fill(1), { boil });
      }
    }

    drawGroup(f, L.binding, L.bindingSlots, boil);
  },
};
