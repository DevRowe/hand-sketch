/**
 * K05 "One trigger". Four stations in a row: letter slot, stamp, ledger, paper plane, joined by short accent links.
 * An envelope drops into the slot and each station fires the next on the exact drawn frame the pulse arrives:
 * the stamp presses (no in-betweens), a ledger row writes itself and ticks, the plane launches. Nobody chases the
 * next step. Marks clear and a fresh plane draws itself onto the pad before the loop comes round.
 */
import { paperPlane, sheet, stamp, tick } from '../../art/glyphs';
import { catmullRom } from '../../core/geometry';
import { drawGroup, drawGroupRange, prepared, scheduleWithin, type Slot, type StrokeGroup } from '../../core/ink';
import { boilStep } from '../../core/loop';
import { easeIn, lerp, type Vec2 } from '../../core/math';
import { drawPuppet, type Puppet } from '../../core/puppet';
import type { Scene } from '../../core/scene';
import { sketch } from '../../core/sketch';
import { drawStroke, drawStrokeRange } from '../../core/stroke';
import { chain, clip, track } from '../../core/track';
import { accentPlate, coverage, fillPoly, fit, group, lf, paper, perSize, place, PULSE, R, S, sec, withAlpha } from './common';

/** The loop chain in loop frames: every step starts on the frame the previous one ends. */
type FrameSlot = ReturnType<typeof chain>[number];
const [DROP, PULSE1, STAMP, PULSE2, ROW, PULSE3, LAUNCH] = chain(0, [5, 4, 3, 4, 3, 4, 8]) as [FrameSlot, FrameSlot, FrameSlot, FrameSlot, FrameSlot, FrameSlot, FrameSlot];
const CLEAR = [30, 6] as const, REFOLD = [28, 4] as const;
const X = [330, 760, 1190, 1600] as const, Y = 600;

const env = sheet(92, 62, 501, { lines: 2 });
const ENVELOPE: Puppet = { fills: [{ pts: env.body, color: R.stock }], groups: [group([...env.outline, [[-46, -31], [0, 4], [46, -31]]], { ...S.INK, size: 4 }, 502)] };
const st = stamp(120, 511);
const STAMP_P: Puppet = { fills: [{ pts: st.body, color: R.stock }], groups: [group(st.outline, S.INK, 512)] };
const pl = paperPlane(120, 521);
const PLANE: Puppet = { fills: [{ pts: pl.body, color: R.stock }], groups: [group(pl.outline, S.INK, 522), group(pl.detail, S.FINE, 523)] };
const PLANE_SLOTS: Slot[][] = [scheduleWithin(PLANE.groups[0]!, 0, sec(REFOLD[1] - 1)), scheduleWithin(PLANE.groups[1]!, sec(2), sec(REFOLD[1]))];

interface Layout {
  P(x: number, y: number): Vec2;
  s: number;
  stations: StrokeGroup; stationDetail: StrokeGroup; stationSlots: Slot[]; detailSlots: Slot[];
  links: StrokeGroup; linkSlots: Slot[];
  slot: Vec2[]; boxBody: Vec2[]; slotClipY: number;
  row: StrokeGroup; rowTick: StrokeGroup;
  flight: Vec2[]; speed: StrokeGroup;
  mark: Vec2[];
}

const layout = perSize((w, h): Layout => {
  const { P, s } = fit(w, h, 1920, 1080, 1.14, [965, 590]);
  const rough = (seed: number) => ({ seed, roughness: 0.9, disableMultiStroke: true });
  // letter slot: a box with a slot in its top
  const box = sketch.rectangle(...P(X[0] - 105, Y - 60), 210 * s, 170 * s, rough(531)).outline;
  const slot: Vec2[] = [P(X[0] - 62, Y - 68), P(X[0] + 62, Y - 68), P(X[0] + 62, Y - 52), P(X[0] - 62, Y - 52)];
  // stamp station: a document on a pad
  const doc = sheet(190, 110, 541, { lines: 2 });
  const pad = sketch.line(P(X[1] - 130, Y + 112), P(X[1] + 130, Y + 112), rough(542)).outline;
  // ledger: a sheet with three written rows and an empty fourth
  const ledger = sheet(190, 250, 551, { lines: 3, header: true });
  // plane pad: a small launch platform
  const platform = sketch.linearPath([P(X[3] - 100, Y + 40), P(X[3] + 100, Y + 40)], rough(561)).outline;
  const legs: Vec2[][] = [[P(X[3] - 70, Y + 40), P(X[3] - 80, Y + 110)], [P(X[3] + 70, Y + 40), P(X[3] + 80, Y + 110)]];
  const outline = [...box, ...place(doc.outline, ...P(X[1], Y + 55), s), ...pad, ...place(ledger.outline, ...P(X[2], Y - 5), s), ...platform];
  const detail = [...place(doc.detail, ...P(X[1], Y + 55), s), ...place(ledger.detail, ...P(X[2], Y - 30), s), ...legs];
  const stations = group(outline, S.INK, 570), stationDetail = group(detail, S.FINE, 571);
  const links = group([[P(450, Y), P(625, Y - 4)], [P(885, Y + 2), P(1080, Y)], [P(1300, Y), P(1488, Y + 2)]].map(p => catmullRom([p[0]!, [(p[0]![0] + p[1]![0]) / 2, (p[0]![1] + p[1]![1]) / 2 - 3], p[1]!], 10)), S.FLOW, 580);
  return {
    P, s, stations, stationDetail,
    stationSlots: scheduleWithin(stations, 0, sec(15), 0.02), detailSlots: scheduleWithin(stationDetail, sec(6), sec(17), 0.01),
    links, linkSlots: [sec(5), sec(10), sec(15)].map(t => ({ start: t, duration: sec(2) })),
    slot, boxBody: [P(X[0] - 105, Y - 60), P(X[0] + 105, Y - 60), P(X[0] + 105, Y + 110), P(X[0] - 105, Y + 110)], slotClipY: P(0, Y - 60)[1],
    row: group([catmullRom([P(X[2] - 60, Y + 85), P(X[2] - 20, Y + 78), P(X[2] + 10, Y + 90), P(X[2] + 45, Y + 80)], 8)], { ...S.FINE, size: 2.8 }, 590),
    rowTick: group([place([tick(40)], ...P(X[2] + 72, Y + 80), s)[0]!], S.TICK, 591),
    flight: catmullRom([P(X[3], Y - 6), P(X[3] + 120, Y - 120), P(X[3] + 260, Y - 420), P(X[3] + 420, Y - 760)], 12),
    speed: group([[P(X[3] - 110, Y - 30), P(X[3] - 40, Y - 30)], [P(X[3] - 120, Y - 5), P(X[3] - 60, Y - 5)], [P(X[3] - 100, Y + 20), P(X[3] - 50, Y + 20)]], { ...S.PENCIL, taperStart: 8, taperEnd: 8 }, 595),
    mark: [P(X[1] - 52, Y + 30), P(X[1] + 52, Y + 30), P(X[1] + 52, Y + 72), P(X[1] - 52, Y + 72)],
  };
});

/** Envelope height above its landing point: a straight ease-in drop from above the frame. */
const drop = track([{ frame: DROP.start, value: 1 }, { frame: DROP.start + DROP.frames, value: 0, ease: 'in' }]);
/** Stamp offset: 1 frame down (no in-betweens), held, 1 frame up. */
const press = track([{ frame: STAMP.start - 1, value: 0 }, { frame: STAMP.start, value: 1, ease: 'hold' }, { frame: STAMP.start + STAMP.frames, value: 0, ease: 'hold' }]);

export const oneTriggerScene: Scene = {
  name: 'one-trigger',
  duration: 5,
  loopFrom: 2,
  poster: 45 / 12,
  draw(f) {
    const { ctx, stage } = f;
    const L = layout(stage.w, stage.h), loop = lf(f), boil = boilStep(f);
    paper(f);
    const clear = loop < 0 ? 0 : clip(loop, CLEAR[0], CLEAR[1]);

    // the stamp's accent mark, printed through the plate so the impression shows dot texture
    const marked = loop >= STAMP.start ? 1 - clear : 0;
    accentPlate(f, 'one-trigger', g => { if (marked > 0) fillPoly(g, L.mark, coverage(0.72 * marked)); });

    drawGroup(f, L.stations, L.stationSlots, boil);
    drawGroup(f, L.stationDetail, L.detailSlots, boil);
    drawGroup(f, L.links, L.linkSlots, boil);

    // the envelope drops in from above the frame and disappears into the slot (clipped at the box top)
    if (loop >= DROP.start && loop <= DROP.start + DROP.frames) {
      const [x, y] = L.P(X[0], Y - 60), top = -80;
      const landed = loop === DROP.start + DROP.frames;
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, stage.w, L.slotClipY);
      ctx.clip();
      drawPuppet(f, ENVELOPE, { x, y: lerp(y, top, drop(loop)) - (landed ? 10 * L.s : 0), scale: L.s, ...(landed ? { sx: 1.1, sy: 0.8 } : {}) });
      ctx.restore();
    }
    fillPoly(ctx, L.slot, R.key, 0.85);

    // pulses: each link fires on the frame the previous station finishes
    const links = prepared(L.links, boil);
    [PULSE1, PULSE2, PULSE3].forEach((p, k) => {
      const u = loop < 0 ? 0 : clip(loop, p.start, p.frames);
      if (u > 0 && u < 1) drawStrokeRange(ctx, { ...links[k]!, style: PULSE }, u * 1.2 - 0.2, u * 1.2, { taperStart: 8, taperEnd: 8 });
    });

    // stamp: up above the document, down for exactly its frames
    const [sx, sy] = L.P(X[1], Y - 110);
    drawPuppet(f, STAMP_P, { x: sx, y: sy + (loop < 0 ? 0 : press(loop)) * 62 * L.s, scale: L.s }, { t: f.t - sec(8), slots: [scheduleWithin(STAMP_P.groups[0]!, 0, sec(5))] });

    // ledger row writes itself, then ticks; both clear before the loop comes round
    const rowIn = loop < 0 ? 0 : clip(loop, ROW.start, ROW.frames);
    withAlpha(ctx, 1 - clear, () => {
      drawGroupRange(f, L.row, () => [0, rowIn], boil);
      if (loop >= ROW.start + ROW.frames) drawStroke(ctx, prepared(L.rowTick)[0]!, 1);
    });

    // the plane: on its pad until the pulse arrives, then launches along an arc and leaves the frame;
    // a fresh plane folds itself onto the pad before the loop comes round
    const launch = loop < 0 ? 0 : clip(loop, LAUNCH.start, LAUNCH.frames);
    const [px, py] = L.P(X[3], Y - 6);
    if (loop < 0 || loop < LAUNCH.start) {
      drawPuppet(f, PLANE, { x: px, y: py, scale: L.s }, { boil, t: f.t - sec(12), slots: PLANE_SLOTS });
    } else if (launch < 1) {
      const k = easeIn(launch), i = Math.min(L.flight.length - 2, Math.floor(k * (L.flight.length - 1)));
      const a = L.flight[i]!, b = L.flight[i + 1]!, fr = k * (L.flight.length - 1) - i;
      drawPuppet(f, PLANE, { x: lerp(a[0], b[0], fr), y: lerp(a[1], b[1], fr), rotation: Math.atan2(b[1] - a[1], b[0] - a[0]) * Math.min(1, launch * 3), scale: L.s }, { boil });
      withAlpha(ctx, loop < LAUNCH.start + 2 ? 1 : 0, () => drawGroup(f, L.speed, []));
    }
    if (loop >= REFOLD[0]) drawPuppet(f, PLANE, { x: px, y: py, scale: L.s }, { boil, t: sec(loop - REFOLD[0]), slots: PLANE_SLOTS });
  },
};
