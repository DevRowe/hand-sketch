/**
 * K04 "Swivel chair". Two sketched windows: a list on the left, a grid on the right. A pencil hops back and forth
 * re-keying entries by hand, slowly and a little differently each time, until one accent connector is drawn between
 * the windows; on the frame it touches, dashes run across and the remaining rows write themselves. Loop: a new entry
 * writes at the bottom of the list, the list scrolls, a dash crosses, the grid gains the row and scrolls.
 *
 * Every entry and every row is the same squiggle record, so scrolling by exactly one row per loop is seamless.
 */
import { checkbox, squiggle, windowFrame } from '../../art/glyphs';
import { catmullRom } from '../../core/geometry';
import { drawGroup, drawGroupRange, prepared, scheduleWithin, type Slot, type StrokeGroup } from '../../core/ink';
import { boilStep } from '../../core/loop';
import { clamp, easeInOut, type Vec2 } from '../../core/math';
import type { Scene, SceneFrame } from '../../core/scene';
import { sketch } from '../../core/sketch';
import { drawStrokeRange } from '../../core/stroke';
import { chain, clip } from '../../core/track';
import { accentPlate, coverage, DURATION, fillPoly, fit, group, lf, LOOP_FROM, nf, paper, perSize, place, R, S, sec, withAlpha } from './common';

/** Storyboard in drawn frames (12 fps). */
const F = {
  windows: [0, 8], grid: [4, 12], lines: [6, 14],
  swivel: { bracket1: [14, 17], hop1: [17, 21], row1: [21, 27], back: [27, 29], bracket2: [29, 30], hop2: [30, 32], row2: [32, 35] },
  connector: [35, 39], dashes: chain(39, [2, 2, 2]), rows: chain(41, [2, 2, 2]),
  loop: { write: [0, 4], scroll: [4, 6], dash: [10, 8], gridWrite: [18, 3], gridScroll: [21, 6] },
} as const;

const PITCH = 80, SLOT0 = 368, SLOTS = 6;
const DASH = { ...S.FLOW, size: 17, dryBrush: 0 };
const LEFT = { cx: 520, cy: 560, w: 600, h: 560 }, RIGHT = { cx: 1400, cy: 560, w: 600, h: 560 };
const GRID = { x0: 1130, x1: 1670, y0: 328, y1: 808 };
const CELLS = [[1150, 1290], [1330, 1450], [1510, 1570]] as const;

interface Layout {
  P(x: number, y: number): Vec2;
  s: number;
  frames: StrokeGroup; frameDetail: StrokeGroup; frameSlots: Slot[];
  rules: StrokeGroup; ruleSlots: Slot[];
  /** One list entry and one grid row at slot 0; drawn translated per slot. */
  entry: StrokeGroup; row: StrokeGroup; pencilRow: StrokeGroup; scribble: StrokeGroup;
  brackets: StrokeGroup; hops: StrokeGroup;
  connector: StrokeGroup; clips: StrokeGroup;
  leftClip: Vec2[]; gridClip: Vec2[]; bodies: Vec2[][];
}

const layout = perSize((w, h): Layout => {
  const { P, s } = fit(w, h, 1920, 1080);
  const wl = windowFrame(LEFT.w, LEFT.h, 601, 44), wr = windowFrame(RIGHT.w, RIGHT.h, 611, 44);
  const frames = group([...place(wl.outline, ...P(LEFT.cx, LEFT.cy), s), ...place(wr.outline, ...P(RIGHT.cx, RIGHT.cy), s)], S.INK, 620);
  const frameDetail = group([...place(wl.detail, ...P(LEFT.cx, LEFT.cy), s), ...place(wr.detail, ...P(RIGHT.cx, RIGHT.cy), s)], S.FINE, 621);
  const rules: Vec2[][] = [];
  for (const x of [1310, 1490]) rules.push(...sketch.line(P(x, GRID.y0), P(x, GRID.y1), { seed: 630 + x, roughness: 0.4, disableMultiStroke: true }).outline);
  for (let k = 1; k < SLOTS; k++) rules.push(...sketch.line(P(GRID.x0, GRID.y0 + k * PITCH), P(GRID.x1, GRID.y0 + k * PITCH), { seed: 640 + k, roughness: 0.4, disableMultiStroke: true }).outline);
  rules.push(...sketch.rectangle(...P(GRID.x0, GRID.y0), (GRID.x1 - GRID.x0) * s, (GRID.y1 - GRID.y0) * s, { seed: 650, roughness: 0.5, disableMultiStroke: true }).outline);
  const rowPaths = (seed: number) => CELLS.map(([a, b], c) => squiggle(P(a, 0)[0], P(b, 0)[0], P(0, SLOT0)[1], seed + c, { height: 7 * s, step: 10 * s }));
  const entry = group([...place(checkbox(20, 660).outline, ...P(270, SLOT0), s), squiggle(P(300, 0)[0], P(720, 0)[0], P(0, SLOT0)[1], 661, { height: 7 * s, step: 10 * s })], S.FINE, 662);
  const hop = (a: Vec2, b: Vec2, lift: number) => catmullRom([P(...a), P((a[0] + b[0]) / 2, Math.min(a[1], b[1]) - lift), P(...b)], 16);
  const dashed = (path: Vec2[]) => Array.from({ length: 7 }, (_, k) => path.slice(Math.floor((k * path.length) / 7), Math.floor(((k + 0.6) * path.length) / 7) + 1));
  const bracket = (y: number): Vec2[] => [P(250, y - 26), P(240, y - 26), P(238, y + 26), P(250, y + 26)];
  return {
    P, s,
    frames, frameDetail, frameSlots: scheduleWithin(frames, sec(F.windows[0]), sec(F.windows[1])),
    rules: group(rules, { ...S.FINE, alpha: 0.6 }, 655), ruleSlots: scheduleWithin(group(rules, S.FINE, 655), sec(F.grid[0]), sec(F.grid[1]), 0.01),
    entry, row: group(rowPaths(670), S.FINE, 673), pencilRow: group(rowPaths(670), S.PENCIL, 676),
    scribble: group([catmullRom([P(1515, SLOT0 + PITCH + 12), P(1535, SLOT0 + PITCH - 10), P(1550, SLOT0 + PITCH + 14), P(1568, SLOT0 + PITCH - 8), P(1585, SLOT0 + PITCH + 10)], 6)], S.PENCIL, 680),
    brackets: group([bracket(SLOT0), bracket(SLOT0 + PITCH)], S.PENCIL, 681),
    hops: group([...dashed(hop([760, SLOT0 - 10], [1150, SLOT0 - 12], 130)), ...dashed(hop([1150, SLOT0 + 6], [760, SLOT0 + PITCH - 10], 60)), ...dashed(hop([760, SLOT0 + PITCH - 10], [1150, SLOT0 + PITCH - 12], 150))], { ...S.PENCIL, taperStart: 6, taperEnd: 6 }, 682),
    connector: group([catmullRom([P(822, 590), P(960, 584), P(1098, 590)], 12)], S.FLOW, 690),
    clips: group([[P(822, 568), P(822, 612)], [P(1098, 568), P(1098, 612)]], { ...S.TICK, size: 7 }, 691),
    leftClip: [P(232, 328), P(808, 328), P(808, 808), P(232, 808)],
    gridClip: [P(GRID.x0, GRID.y0), P(GRID.x1, GRID.y0), P(GRID.x1, GRID.y1), P(GRID.x0, GRID.y1)],
    bodies: [place([wl.body], ...P(LEFT.cx, LEFT.cy), s)[0]!, place([wr.body], ...P(RIGHT.cx, RIGHT.cy), s)[0]!],
  };
});

/** Run `draw` translated to row slot `slot` (fractional while scrolling), clipped to `area`. */
function inSlot(f: SceneFrame, L: Layout, area: Vec2[], slot: number, draw: () => void): void {
  const { ctx } = f;
  ctx.save();
  ctx.beginPath();
  area.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.clip();
  ctx.translate(0, slot * PITCH * L.s);
  draw();
  ctx.restore();
}

/** Writing progress of a squiggle group over `frames` from `start` (machine: linear, all strokes in sequence). */
const writeRange = (n: number, start: number, frames: number, count: number) => (k: number): [number, number] => [0, clamp(clip(n, start, frames) * count - k, 0, 1)];

export const swivelChairScene: Scene = {
  name: 'swivel-chair',
  duration: DURATION,
  loopFrom: LOOP_FROM,
  poster: 62 / 12,
  draw(f) {
    const { ctx, stage } = f;
    const L = layout(stage.w, stage.h), n = nf(f), loop = lf(f), boil = boilStep(f);
    const sw = F.swivel;
    paper(f);

    for (const b of L.bodies) fillPoly(ctx, b, R.stock);
    drawGroup(f, L.rules, L.ruleSlots, boil);

    // scroll offsets (in rows) and which bottom slots are being written, from the loop clock
    const listScroll = loop < 0 ? 0 : easeInOut(clip(loop, F.loop.scroll[0], F.loop.scroll[1]));
    const gridScroll = loop < 0 ? 0 : easeInOut(clip(loop, F.loop.gridScroll[0], F.loop.gridScroll[1]));

    // accent plate on the grid's newest row: it hands over to the row being written
    const newRow = loop < 0 ? 0 : clip(loop, F.loop.gridWrite[0], F.loop.gridWrite[1]);
    const plateIn = loop < 0 ? clip(n, F.rows[2]!.start, 3) : 1;
    accentPlate(f, 'swivel', g => {
      g.save();
      g.beginPath();
      L.gridClip.forEach(([x, y], k) => (k ? g.lineTo(x, y) : g.moveTo(x, y)));
      g.clip();
      // zero coverage paints nothing (a white fill would still eat the antialiased edge of its neighbour)
      const band = (slot: number, c: number) => c > 0 && fillPoly(g, [L.P(GRID.x0, GRID.y0 + slot * PITCH), L.P(GRID.x1, GRID.y0 + slot * PITCH), L.P(GRID.x1, GRID.y0 + (slot + 1) * PITCH), L.P(GRID.x0, GRID.y0 + (slot + 1) * PITCH)], coverage(c));
      band(4 - gridScroll, 0.22 * plateIn * (1 - newRow));
      band(5 - gridScroll, 0.22 * newRow);
      g.restore();
    });

    // the list: five entries, plus one writing at the bottom in the loop
    const entries = 5;
    for (let k = 0; k < entries; k++) {
      const range = loop < 0 ? writeRange(n, F.lines[0] + k * 1.6, 2, L.entry.paths.length) : () => [0, 1] as [number, number];
      inSlot(f, L, L.leftClip, k - listScroll, () => drawGroupRange(f, L.entry, range, boil));
    }
    if (loop >= 0) inSlot(f, L, L.leftClip, entries - listScroll, () => drawGroupRange(f, L.entry, writeRange(loop, F.loop.write[0], F.loop.write[1], L.entry.paths.length), boil));

    // the grid: rows 1-2 by hand in pencil (re-inked by the machine at the beat), rows 3-5 write themselves
    for (let k = 0; k < 5; k++) {
      let range: (i: number) => [number, number] = () => [0, 1];
      if (loop < 0) {
        if (k < 2) range = writeRange(n, F.rows[0]!.start - 2, 2, 3);
        else range = writeRange(n, F.rows[k - 2]!.start, F.rows[k - 2]!.frames, 3);
      }
      inSlot(f, L, L.gridClip, k - gridScroll, () => drawGroupRange(f, L.row, range, boil));
    }
    if (loop >= 0) inSlot(f, L, L.gridClip, 5 - gridScroll, () => drawGroupRange(f, L.row, writeRange(loop, F.loop.gridWrite[0], F.loop.gridWrite[1], 3), boil));

    if (loop < 0) {
      // the manual swivel: slow, uneven, pencil; it fades once the connector takes over (the arcs stay as ghosts)
      const gone = 1 - clip(n, F.rows[0]!.start - 2, 6);
      withAlpha(ctx, gone, () => {
        drawGroupRange(f, L.brackets, k => [0, k === 0 ? clip(n, sw.bracket1[0], 3) : clip(n, sw.bracket2[0], 1)]);
        inSlot(f, L, L.gridClip, 0, () => drawGroupRange(f, L.pencilRow, writeRange(n, sw.row1[0], sw.row1[1] - sw.row1[0], 3)));
        inSlot(f, L, L.gridClip, 1, () => drawGroupRange(f, L.pencilRow, writeRange(n, sw.row2[0], 2.4, 3)));
        drawGroupRange(f, L.scribble, () => [0, clip(n, 34, 1)]);
      });
    }
    const hopProgress = [clip(n, sw.hop1[0], 4), clip(n, sw.back[0], 2), clip(n, sw.hop2[0], 2)];
    withAlpha(ctx, n >= F.connector[1] ? R.ghost : 1, () => drawGroupRange(f, L.hops, k => [0, clamp(hopProgress[Math.floor(k / 7)]! * 7 - (k % 7), 0, 1)]));

    drawGroup(f, L.frames, L.frameSlots, boil);
    drawGroup(f, L.frameDetail, L.frameSlots, boil);

    // the connector, its clips, and dashes travelling on it
    const conn = prepared(L.connector, boil)[0]!;
    drawGroupRange(f, L.connector, () => [0, easeInOut(clip(n, F.connector[0], F.connector[1] - F.connector[0]))], boil);
    drawGroupRange(f, L.clips, k => [0, clip(n, k === 0 ? F.connector[0] : F.connector[1] - 1, 1)]);
    // a dash is a bold slug of the same line: same wobble, heavier pen
    const slug = { ...conn, style: DASH };
    const dash = (u: number) => { if (u > 0 && u < 1) drawStrokeRange(ctx, slug, u * 1.25 - 0.25, u * 1.25, { taperStart: 10, taperEnd: 10 }); };
    if (loop < 0) F.dashes.forEach(d => dash(clip(n, d.start, d.frames)));
    else dash(clip(loop, F.loop.dash[0], F.loop.dash[1]));
  },
};
