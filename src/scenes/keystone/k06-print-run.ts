/**
 * K06 "Built once, runs the same every time". A page is laid out in pencil and inked with care by hand; its accent
 * plate prints one frame out of register and snaps in; then identical impressions peel off onto a stack at a steady
 * cadence. Each copy is a fresh print (its own plate seed), the geometry never changes, and the stack feeds down into
 * its tray by one sheet per copy so its height never changes.
 */
import { squiggle } from '../../art/glyphs';
import { emissions } from '../../core/emitter';
import { drawGroup, scheduleWithin, type Slot, type StrokeGroup } from '../../core/ink';
import { boilStep } from '../../core/loop';
import { easeInOut, lerp, type Vec2 } from '../../core/math';
import { drawPuppet, posePoint, type Pose, type Puppet } from '../../core/puppet';
import type { Scene } from '../../core/scene';
import { sketch } from '../../core/sketch';
import { clip } from '../../core/track';
import { accentPlate, coverage, DURATION, fillPoly, fit, group, lf, LOOP, LOOP_FROM, nf, paper, perSize, R, S, sec, withAlpha } from './common';

/** Storyboard in drawn frames (12 fps). */
/** The intro run lands its last copy on the loop's first frame, where the steady run takes over. */
const F = { guides: [0, 10], ink: [10, 29], register: 29, run: { births: [33, 36, 39, 43], flight: 5 }, shift: 3 } as const;
const EMIT = { every: 6, life: 6 } as const;
/** Impression variants cycled by copy index: 6 copies per loop, so every loop prints the same six. */
const VARIANTS = 6;
/** Sheets visible above the tray lip, besides the one sliding under it. */
const PW = 420, PH = 560, SHEET = 14, PILE = 3;
const MASTER: Vec2 = [460, 520], STACK: Vec2 = [1040, 500];

const rough = (seed: number, roughness = 0.8) => ({ seed, roughness, disableMultiStroke: true });
const rect = (x: number, y: number, w: number, h: number): Vec2[] => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];

// the page in local units, centred on its origin
const L0 = -PW / 2, T0 = -PH / 2, M = 34;
const HEADER = rect(L0 + M, T0 + M, PW - 2 * M, 70);
const TABLE = { x: L0 + M, y: T0 + 300, w: PW - 2 * M, h: 150 };
const TOTAL = rect(L0 + PW - M - 150, T0 + 476, 150, 36);
const TABLE_HEAD = rect(TABLE.x, TABLE.y, TABLE.w, TABLE.h / 3);

const guides = group([
  ...sketch.rectangle(L0 + M, T0 + M, PW - 2 * M, PH - 2 * M, rough(701, 1.4)).outline,
  ...sketch.rectangle(HEADER[0]![0], HEADER[0]![1], PW - 2 * M, 70, rough(702, 1.4)).outline,
  ...sketch.rectangle(TABLE.x, TABLE.y, TABLE.w, TABLE.h, rough(703, 1.4)).outline,
], { ...S.PENCIL, alpha: 0.4 }, 704);
const header = group([...sketch.polygon(HEADER, rough(711)).outline, ...sketch.line([L0 + M + 20, T0 + M + 36], [L0 + M + 170, T0 + M + 36], rough(712, 0.6)).outline], S.INK, 713);
const lines = group(Array.from({ length: 5 }, (_, k) => squiggle(L0 + M + 4, L0 + M + (k === 4 ? 200 : 330 - (k % 2) * 30), T0 + 150 + k * 28, 720 + k, { height: 6 })), S.FINE, 725);
const tableRules: Vec2[][] = [...sketch.rectangle(TABLE.x, TABLE.y, TABLE.w, TABLE.h, rough(731, 0.6)).outline];
for (let c = 1; c < 3; c++) tableRules.push(...sketch.line([TABLE.x + (TABLE.w * c) / 3, TABLE.y], [TABLE.x + (TABLE.w * c) / 3, TABLE.y + TABLE.h], rough(732 + c, 0.5)).outline);
for (let r = 1; r < 3; r++) tableRules.push(...sketch.line([TABLE.x, TABLE.y + (TABLE.h * r) / 3], [TABLE.x + TABLE.w, TABLE.y + (TABLE.h * r) / 3], rough(735 + r, 0.5)).outline);
const table = group(tableRules, S.FINE, 738);
const total = group(sketch.line([TOTAL[0]![0] + 10, TOTAL[2]![1] + 8], [TOTAL[1]![0], TOTAL[2]![1] + 8], rough(741, 0.6)).outline, S.INK, 742);
const outline = group(sketch.rectangle(L0, T0, PW, PH, rough(751, 0.7)).outline, S.INK, 752);
const PAGE: Puppet = { fills: [{ pts: rect(L0, T0, PW, PH), color: R.stock }], groups: [outline, header, lines, table, total] };
/** The master is inked with care: groups one after another at deliberately uneven paces. */
const MASTER_SLOTS: Slot[][] = [
  scheduleWithin(outline, sec(F.ink[0]), sec(13)),
  scheduleWithin(header, sec(13), sec(17)),
  scheduleWithin(lines, sec(16.5), sec(22), 0.05),
  scheduleWithin(table, sec(22), sec(26.5), 0.02),
  scheduleWithin(total, sec(26.5), sec(F.ink[1])),
];
const GUIDE_SLOTS = scheduleWithin(guides, sec(F.guides[0]), sec(F.guides[1]), 0.08);

/** Accent plate coverage for one impression of the page at `pose`. */
function platePage(g: CanvasRenderingContext2D, pose: Pose, amount: number): void {
  if (amount <= 0) return;
  const at = (pts: Vec2[]) => pts.map(p => posePoint(pose, p));
  fillPoly(g, at(HEADER), coverage(0.62 * amount));
  fillPoly(g, at(TABLE_HEAD), coverage(0.3 * amount));
  fillPoly(g, at(TOTAL), coverage(0.45 * amount));
}

interface Layout { P(x: number, y: number): Vec2; s: number; tray: StrokeGroup; lip: Vec2[] }
const layout = perSize((w, h): Layout => {
  const { P, s } = fit(w, h, 1440, 1080, 1.05, [740, 560]);
  const lipY = STACK[1] + PH / 2 + SHEET * (PILE + 0.5) + 4;
  return {
    P, s,
    tray: group([...sketch.linearPath([P(STACK[0] - PW / 2 - 40, lipY - 30), P(STACK[0] - PW / 2 - 30, lipY), P(STACK[0] + PW / 2 + 30, lipY), P(STACK[0] + PW / 2 + 40, lipY - 30)], rough(761)).outline], S.INK, 762),
    lip: [P(STACK[0] - PW / 2 - 60, lipY), P(STACK[0] + PW / 2 + 60, lipY), P(STACK[0] + PW / 2 + 60, 1200), P(STACK[0] - PW / 2 - 60, 1200)],
  };
});

interface Copy { variant: number; pose: Pose }

/**
 * The copies at this frame: those in flight, and the pile (newest first). A copy lands at the stack top; the pile
 * then feeds down by one sheet over F.shift frames, so the next copy lands at the same height.
 */
function run(L: Layout, n: number, loop: number): { flying: Copy[]; pile: Copy[] } {
  const master = L.P(...MASTER), top = L.P(...STACK);
  const fly = (age: number, frames: number): Pose => {
    const u = easeInOut(age / (frames - 1));
    const x = lerp(master[0], top[0], u), y = lerp(master[1], top[1], u) - Math.sin(u * Math.PI) * 170 * L.s;
    return { x, y, rotation: Math.sin(u * Math.PI) * 0.12, scale: L.s };
  };
  const pile = (variants: number[], sinceLanding: number): Copy[] => {
    const shift = easeInOut(clip(sinceLanding, 0, F.shift));
    return variants.slice(0, PILE + 1).map((variant, i) => ({ variant, pose: { x: top[0], y: top[1] + (i + shift) * SHEET * L.s, scale: L.s } }));
  };
  if (loop < 0) {
    const { births, flight } = F.run;
    const flying: Copy[] = [], landed: number[] = [];
    let lastLanding = -Infinity;
    births.forEach((born, c) => {
      const age = n - born;
      if (age < 0) return;
      if (age < flight) { if (age > 0) flying.push({ variant: c, pose: fly(age, flight) }); }
      else { landed.unshift(c); lastLanding = born + flight; }
    });
    return { flying, pile: pile(landed, n - lastLanding) };
  }
  // loop: one copy every EMIT.every frames; the newest landed copy is the one emitted just before the flying one
  const [e] = emissions(loop, LOOP, EMIT);
  if (!e) throw new Error('print-run: the emitter always has one copy in flight');
  const variant = (k: number) => (((e.index - k) % VARIANTS) + VARIANTS) % VARIANTS;
  // at age 0 the copy is still on the master: it peels off from the next frame
  return { flying: e.age > 0 ? [{ variant: variant(0), pose: fly(e.age, EMIT.life) }] : [], pile: pile(Array.from({ length: PILE + 1 }, (_, i) => variant(i + 1)), e.age) };
}

export const printRunScene: Scene = {
  name: 'print-run',
  duration: DURATION,
  loopFrom: LOOP_FROM,
  poster: 5,
  draw(f) {
    const { ctx, stage } = f;
    const L = layout(stage.w, stage.h), n = nf(f), loop = lf(f), boil = boilStep(f);
    paper(f);
    const masterPose: Pose = { x: L.P(...MASTER)[0], y: L.P(...MASTER)[1], scale: L.s };
    const { flying, pile } = run(L, n, loop);

    // pile, oldest first so each newer sheet covers all but the bottom edge of the one beneath
    ctx.save();
    for (let i = pile.length - 1; i >= 0; i--) drawPuppet(f, PAGE, pile[i]!.pose, { boil });
    ctx.restore();
    fillPoly(ctx, L.lip, R.stock);
    drawGroup(f, L.tray, [], boil);
    if (pile[0]) accentPlate(f, 'print-run:pile', g => platePage(g, pile[0]!.pose, 1), { seed: 900 + pile[0]!.variant * 7 });

    // the master: pencil guides, then ink with care; guides fade to 20% once inked
    withAlpha(ctx, lerp(1, 0.5, clip(n, F.ink[1] - 4, 6)), () => drawPuppet(f, { groups: [guides] }, masterPose, { t: f.t, slots: [GUIDE_SLOTS] }));
    drawPuppet(f, { groups: PAGE.groups }, masterPose, { boil, t: f.t, slots: MASTER_SLOTS });
    // registration beat: the plate lands 8 units out of register for exactly one frame, then snaps in
    if (n >= F.register) {
      const off: [number, number] = n < F.register + 1 ? [8 * L.s, -5 * L.s] : [0, 0];
      accentPlate(f, 'print-run:master', g => platePage(g, masterPose, 1), { seed: 880, offset: off });
    }

    for (const c of flying) {
      drawPuppet(f, PAGE, c.pose, { boil });
      accentPlate(f, 'print-run:flying', g => platePage(g, c.pose, 1), { seed: 900 + c.variant * 7 });
    }
  },
};
