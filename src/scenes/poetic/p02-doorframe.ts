/**
 * P02 "Doorframe" (memory, growing up). Morning light across a wall and a painted door frame. A pencil makes a mark
 * across it at a child's height, and writes a name and a date beside it; then another, a little higher, a year on.
 * The marks come quicker as the years do, crowd together near the top, and stop. A long stillness. Then, right down
 * at the bottom, next to the very first mark, a new one in coloured pencil. The loop is the quiet morning afterwards,
 * dust turning in the light.
 */
import { MOODS } from '../../art/moods';
import { cursive } from '../../art/glyphs';
import { plate, printPlate } from '../../art/print';
import { catmullRom } from '../../core/geometry';
import { drawGroup, scheduleWithin, type Slot, type StrokeGroup } from '../../core/ink';
import { boilStep } from '../../core/loop';
import { TAU, type Vec2 } from '../../core/math';
import { rng } from '../../core/random';
import type { Scene } from '../../core/scene';
import { drawStroke, prepareStroke, withPressure, type PreparedStroke, type StrokeStyle } from '../../core/stroke';
import { clip } from '../../core/track';
import { coverage, ease, fillPoly, fit, group, nf, perSize, sec, stock } from './common';

const M = MOODS.keepsake;
const LIGHT = M.inks[0]!, NEW = M.accents[0]!;
const PAINT: StrokeStyle = { color: M.ink, size: 3.6, thinning: 0.55, wobble: 1.2, wobbleWavelength: 260, tremor: 0.3, pressureVariation: 0.45, dryBrush: 0.2, paper: M.paper, taperStart: 60, taperEnd: 60 };
const PENCIL: StrokeStyle = { color: '#5f5750', size: 2.5, thinning: 0.35, wobble: 1.4, wobbleWavelength: 90, tremor: 0.7, pressureVariation: 0.7, alpha: 0.88, dryBrush: 0.45, paper: M.paper, taperStart: 10, taperEnd: 16 };

/** Heights in cm at each birthday from two to fifteen: quick at first, then crowding as growth slows. */
const HEIGHTS = [85, 94, 101, 108, 116, 121, 128, 135, 140, 148, 158, 166, 170, 172] as const;
/** Floor line and design units per cm. */
const FLOOR = 1250, CM = 6.4;
const y = (cm: number) => FLOOR - cm * CM;

/** Storyboard in drawn frames (12 fps). Each mark is a tick then its label; the years speed up. */
const F = { frame: [0, 30], grain: [22, 44], light: [0, 60], marks: 50, stillness: 48 } as const;
const MARK_AT = HEIGHTS.map((_, k) => F.marks + HEIGHTS.slice(0, k).reduce((t, _h, j) => t + Math.max(4, 11 - j * 0.6), 0));
const LAST = MARK_AT[MARK_AT.length - 1]! + 10;
const NEW_AT = LAST + F.stillness;
const LOOP_FROM = NEW_AT + 24;
const LOOP = 48;

interface Mark { tick: PreparedStroke; label: PreparedStroke[]; at: number; color: string }

interface Layout {
  P(x: number, y: number): Vec2; s: number;
  frame: StrokeGroup; frameSlots: Slot[]; grain: StrokeGroup; grainSlots: Slot[];
  face: Vec2[]; opening: Vec2[]; beam: Vec2[];
  marks: Mark[];
  motes: { x: number; y: number; r: number; phase: number; drift: number }[];
}

const layout = perSize((w, h): Layout => {
  // close on the stretch of frame the marks climb
  const { P, s } = fit(w, h, 1080, 1350, 1.42, [520, 450]);
  const map = (pts: readonly Vec2[]) => pts.map(([x, yy]) => P(x, yy));
  const line = (x0: number, y0: number, x1: number, y1: number) => map(catmullRom([[x0, y0], [(x0 + x1) / 2 + 1.5, (y0 + y1) / 2], [x1, y1]], 12));
  const frame = group([
    line(398, -30, 400, FLOOR), line(420, -30, 421, FLOOR - 4), line(598, -30, 600, FLOOR - 4), line(620, -30, 621, FLOOR),
    line(-30, FLOOR, 398, FLOOR + 1), line(-30, FLOOR - 70, 398, FLOOR - 70), line(621, FLOOR, 1110, FLOOR - 1),
  ], { ...PAINT, size: PAINT.size * s }, 2001);
  const r = rng(2002);
  const grain = group([0, 1, 2, 3].map(k => {
    const x0 = 440 + k * 40 + r() * 10;
    return map(catmullRom([[x0, -20], [x0 + 3, 300], [x0 - 2, 700], [x0 + 4, 1000], [x0, FLOOR - 10]], 14));
  }), { ...PENCIL, size: 1.6 * s, alpha: 0.28, tremor: 0.4, taperStart: 200, taperEnd: 200, dryBrush: 0 }, 2003);
  const pencil = { ...PENCIL, size: PENCIL.size * s };
  const mark = (cm: number, k: number, at: number, color: string): Mark => {
    const my = y(cm), rm = rng(2100 + k);
    // a tick held against the top of a head (never quite level, never quite the same length), then a name, and
    // sometimes a date under it, in a hand that changes a little from year to year
    const tick = withPressure(prepareStroke(map([[402 + rm() * 10, my + (rm() - 0.5) * 4], [458 + rm() * 40, my + (rm() - 0.5) * 6]]), { ...pencil, color }, 2200 + k), u => 1.2 - 0.45 * u);
    const hand = { ...pencil, color, size: 1.8 * s, dryBrush: 0.2, taperStart: 3, taperEnd: 5 };
    const lx = 504 + rm() * 8, lh = 7 + rm() * 3;
    const label = [prepareStroke(map(cursive(lx, lx + 30 + rm() * 40, my - 1, 2300 + k, { height: lh, step: 6.5 + rm() * 2 })), hand, 2400 + k)];
    if (rm() > 0.35) label.push(prepareStroke(map(cursive(lx + 3, lx + 18 + rm() * 22, my + 14, 2500 + k, { height: lh * 0.65, step: 5 })), { ...hand, size: 1.4 * s }, 2600 + k));
    return { tick, label, at, color };
  };
  const motes = Array.from({ length: 36 }, () => ({ x: r() * 900, y: r() * 1100, r: 1.2 + r() * 2, phase: r(), drift: 30 + r() * 40 }));
  return {
    P, s, frame, frameSlots: scheduleWithin(frame, sec(F.frame[0]), sec(F.frame[1]), 0.02), grain, grainSlots: scheduleWithin(grain, sec(F.grain[0]), sec(F.grain[1])),
    face: map([[400, -40], [620, -40], [620, FLOOR], [400, FLOOR]]),
    opening: map([[621, -40], [1120, -40], [1120, FLOOR], [621, FLOOR]]),
    beam: map([[-200, -40], [420, -40], [1180, 1400], [480, 1400]]),
    marks: [...HEIGHTS.map((cm, k) => mark(cm, k, MARK_AT[k]!, PENCIL.color)), mark(79, 99, NEW_AT, NEW)],
    motes,
  };
});

export const doorframeScene: Scene = {
  name: 'doorframe',
  duration: (LOOP_FROM + LOOP) / 12,
  loopFrom: LOOP_FROM / 12,
  poster: (LOOP_FROM + 6) / 12,
  draw(f) {
    const { ctx, stage } = f;
    const L = layout(stage.w, stage.h), n = nf(f), s = L.s;
    const phase = ((((n - LOOP_FROM) % LOOP) + LOOP) % LOOP) / LOOP;
    stock(f, M.paper, { seed: 21, vignette: 0.26, vignetteColor: M.ink });

    // the doorway beyond the frame sits a shade darker; the morning comes in on a slant across everything
    const painted = clip(n, F.frame[0] + 6, F.frame[1] - F.frame[0]);
    fillPoly(ctx, L.opening, M.ink, 0.06 * painted);
    fillPoly(ctx, L.face, M.light, 0.55 * painted);
    const light = ease(clip(n, F.light[0], F.light[1] - F.light[0]));
    const p = plate(stage, 'doorframe');
    const g = p.ctx.createLinearGradient(L.P(0, 0)[0], L.P(0, 0)[1], L.P(700, 1350)[0], L.P(700, 1350)[1]);
    g.addColorStop(0, coverage(0.2 * light));
    g.addColorStop(1, coverage(0.04 * light));
    p.ctx.fillStyle = g;
    p.ctx.beginPath();
    L.beam.forEach(([x, yy], k) => (k ? p.ctx.lineTo(x, yy) : p.ctx.moveTo(x, yy)));
    p.ctx.fill();
    printPlate(ctx, stage, p.canvas, { ink: LIGHT, cell: 6, angle: 0.5, seed: 2501, alpha: 0.6 });

    const boil = boilStep(f, { hold: 6, variants: 4 });
    drawGroup(f, L.frame, L.frameSlots, boil);
    drawGroup(f, L.grain, L.grainSlots, boil);

    // the marks: a firm tick against the top of a head, then a name and a date written beside it
    for (const m of L.marks) {
      const tick = ease(clip(n, m.at, 4));
      if (tick > 0) drawStroke(ctx, m.tick, tick);
      m.label.forEach((l, j) => {
        const u = clip(n, m.at + 4 + j * 5, 6);
        if (u > 0) drawStroke(ctx, l, u);
      });
    }

    // dust turning in the light, drifting a whole cycle per loop
    const motes = clip(n, 20, 40);
    ctx.save();
    ctx.fillStyle = LIGHT;
    for (const d of L.motes) {
      const u = (phase + d.phase) % 1;
      const x = (d.x + Math.sin(TAU * u) * d.drift) * s + L.P(0, 0)[0], yy = (d.y + Math.cos(TAU * (u + d.phase)) * d.drift * 0.6) * s + L.P(0, 0)[1];
      ctx.globalAlpha = motes * 0.55 * (0.5 + 0.5 * Math.sin(TAU * (u * 2 + d.phase)));
      ctx.beginPath();
      ctx.arc(x, yy, d.r * s, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  },
};
