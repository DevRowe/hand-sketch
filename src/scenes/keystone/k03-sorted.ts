/**
 * K03 "Sorted on arrival". A heap of mixed paperwork; one envelope is carried to its tray by hand along a pencil arc;
 * then an accent route branches into three trays and the heap empties itself along it. Loop: a new item drops onto
 * the empty heap spot every 12 frames, rests, routes to its tray and slides behind the tray front; the tray ticks.
 */
import { calendarCard, envelope, sheet, tick, tray, type Glyph } from '../../art/glyphs';
import { emissions } from '../../core/emitter';
import { catmullRom } from '../../core/geometry';
import { drawGroup, drawGroupRange, prepared, scheduleWithin, type Slot, type StrokeGroup } from '../../core/ink';
import { boilStep } from '../../core/loop';
import { clamp, easeInOut, easeOut, lerp, type Vec2 } from '../../core/math';
import { drawPuppet, type Pose, type Puppet } from '../../core/puppet';
import type { Scene, SceneFrame } from '../../core/scene';
import { sketch } from '../../core/sketch';
import { drawStroke, sampleStroke } from '../../core/stroke';
import { clip, track } from '../../core/track';
import { accentPlate, coverage, DURATION, fillPoly, fit, group, lf, LOOP, LOOP_FROM, nf, paper, perSize, place, R, S, sec, withAlpha } from './common';

/** Storyboard in drawn frames (12 fps). */
const F = { trays: [0, 9], heap: [4, 17], carry: [17, 29], route: [29, 35], beat: 35 } as const;
const EMIT = { every: 12, life: 12 } as const;
const HEAP: Vec2 = [400, 590];
const ITEM = 1.5;
const TRAY_X = 1560, TRAY_Y = [320, 590, 860] as const;

type Kind = 0 | 1 | 2;
const glyphs: Glyph[] = [envelope(96, 64, 401), sheet(70, 92, 411, { lines: 3, header: true }), calendarCard(86, 74, 421)];
const puppetOf = (g: Glyph, seed: number): Puppet => ({ fills: [{ pts: g.body, color: R.stock }], groups: [group(g.outline, { ...S.INK, size: 4 }, seed), group(g.detail, { ...S.FINE, size: 2.2 }, seed + 1)] });
const ITEMS: Puppet[] = glyphs.map((g, k) => puppetOf(g, 430 + k * 10));
const ITEM_SLOTS: Slot[][][] = ITEMS.map(p => [scheduleWithin(p.groups[0]!, 0, 0.3), scheduleWithin(p.groups[1]!, 0.25, 0.4, 0.01)]);

/** The heap, back to front: kind, offset from the heap centre, angle. The last one is carried by hand. */
const PILE: { kind: Kind; dx: number; dy: number; a: number }[] = [
  { kind: 2, dx: -70, dy: 40, a: -0.35 }, { kind: 1, dx: 60, dy: 50, a: 0.42 }, { kind: 0, dx: -10, dy: 70, a: 0.12 },
  { kind: 1, dx: -80, dy: -20, a: 0.6 }, { kind: 2, dx: 70, dy: -30, a: -0.2 }, { kind: 0, dx: 5, dy: 10, a: -0.5 },
  { kind: 0, dx: -20, dy: -60, a: 0.28 },
];
/** Beat order (top of the heap down, the carried envelope excluded), each accelerating a little: the stream gathers pace. */
const BEAT = [5, 4, 3, 2, 1, 0].map((pile, i) => ({ pile, start: F.beat + 2 * i, frames: 8 - i }));

interface Layout {
  P(x: number, y: number): Vec2;
  /** Item puppet scale. */
  k: number;
  s: number;
  trays: StrokeGroup; trayDetail: StrokeGroup; traySlots: Slot[]; trayBodies: Vec2[][];
  marks: StrokeGroup; markSlots: Slot[];
  shadow: StrokeGroup; shadowSlots: Slot[];
  trunk: StrokeGroup; branches: StrokeGroup; routeSlots: Slot[];
  arc: Vec2[]; arcGroup: StrokeGroup;
  ticks: StrokeGroup;
}

const layout = perSize((w, h): Layout => {
  const { P, s } = fit(w, h, 1920, 1080);
  const trayG = TRAY_Y.map((y, k) => ({ g: tray(250, 96, 450 + k), y }));
  const trays = group(trayG.flatMap(({ g, y }) => place(g.outline, ...P(TRAY_X, y + 48), s)), S.INK, 460);
  const trayDetail = group(trayG.flatMap(({ g, y }) => place(g.detail, ...P(TRAY_X, y + 48), s)), S.FINE, 461);
  const marks = group(glyphs.flatMap((g, k) => place([...g.outline, ...g.detail], ...P(TRAY_X + 210, TRAY_Y[k]! + 44), s * 0.9)), { ...S.FINE, size: 2.4 }, 470);
  const shadow = group(sketch.ellipse(...P(HEAP[0] + 10, HEAP[1] + 140), 420 * s, 90 * s, { seed: 480, fill: 'x', fillStyle: 'hachure', hachureAngle: -30, hachureGap: 11 * s, roughness: 1.2, disableMultiStroke: true, disableMultiStrokeFill: true }).fill, { ...S.PENCIL, size: 2.2, alpha: 0.5 }, 481);
  const trunk = group([catmullRom([P(560, 590), P(760, 584), P(980, 590)], 12)], S.FLOW, 490);
  const branches = group(TRAY_Y.map(y => catmullRom([P(980, 590), P(1180, lerp(590, y, 0.55)), P(1380, y - 6), P(TRAY_X - 40, y + 8)], 12)), S.FLOW, 491);
  const top = PILE[PILE.length - 1]!, from = P(HEAP[0] + top.dx, HEAP[1] + top.dy), to = P(TRAY_X - 20, TRAY_Y[0] + 10);
  const arc = catmullRom([from, P(760, 260), P(1180, 170), to], 14);
  const L: Layout = {
    P, s, k: s * ITEM, trays, trayDetail, traySlots: scheduleWithin(trays, sec(F.trays[0]), sec(F.trays[1])),
    trayBodies: trayG.map(({ g, y }) => place([g.body], ...P(TRAY_X, y + 48), s)[0]!),
    marks, markSlots: scheduleWithin(marks, sec(5), sec(12), 0.01),
    shadow, shadowSlots: scheduleWithin(shadow, sec(F.heap[1] - 4), sec(F.heap[1]), 0),
    trunk, branches, routeSlots: [],
    arc,
    // the pencil arc is dashed: every other slice of the path
    arcGroup: group(Array.from({ length: 12 }, (_, k) => arc.slice(Math.floor((k * arc.length) / 12), Math.floor(((k + 0.55) * arc.length) / 12) + 1)).filter(p => p.length > 1), { ...S.PENCIL, taperStart: 6, taperEnd: 6 }, 496),
    ticks: group(TRAY_Y.map(y => place([tick(50)], ...P(TRAY_X + 272, y + 4), s)[0]!), S.TICK, 495),
  };
  L.routeSlots = scheduleWithin(trunk, sec(F.route[0]), sec(F.route[0] + 3));
  return L;
});

/** Where an item is on its way to tray `kind` at progress u, starting from `start`: join, trunk, branch, drop in. */
function riderPose(f: SceneFrame, L: Layout, kind: Kind, u: number, start: Pose, boil: number): Pose {
  const trunk = prepared(L.trunk, boil)[0]!, branch = prepared(L.branches, boil)[kind]!;
  const join = 0.15, onTrunk = 0.5, onBranch = 0.88;
  if (u < join) {
    const k = easeOut(u / join), p = sampleStroke(trunk, 0).point;
    return { x: lerp(start.x, p[0], k), y: lerp(start.y, p[1] - 40 * L.s, k), rotation: lerp(start.rotation ?? 0, 0, k), scale: L.k };
  }
  const lift = 40 * L.s;
  if (u < onBranch) {
    const at = u < onTrunk ? sampleStroke(trunk, (u - join) / (onTrunk - join)) : sampleStroke(branch, (u - onTrunk) / (onBranch - onTrunk));
    return { x: at.point[0], y: at.point[1] - lift, rotation: at.angle * 0.25, scale: L.k };
  }
  const end = sampleStroke(branch, 1).point, k = (u - onBranch) / (1 - onBranch);
  void f;
  return { x: lerp(end[0], end[0] + 60 * L.s, k), y: lerp(end[1] - lift, end[1] + 70 * L.s, k * k), rotation: 0, scale: L.k };
}

const carry = track<readonly number[]>([
  { frame: F.carry[0], value: [0] },
  { frame: 23, value: [0.5], ease: 'out' },
  { frame: 25, value: [0.5], ease: 'hold' },
  { frame: F.carry[1], value: [1], ease: 'in' },
]);

export const sortedScene: Scene = {
  name: 'sorted',
  duration: DURATION,
  loopFrom: LOOP_FROM,
  poster: 67 / 12,
  draw(f) {
    const { ctx, stage } = f;
    const L = layout(stage.w, stage.h), n = nf(f), loop = lf(f), boil = boilStep(f);
    paper(f);

    const routed = n >= F.beat;
    withAlpha(ctx, routed ? lerp(1, R.ghost / 0.5, clip(n, F.beat, 12)) : 1, () => drawGroup(f, L.shadow, L.shadowSlots));

    // the manual carry: a pencil dashed arc drawn as the hand goes, pausing mid-arc; it stays as a ghost
    const c = carry(n)[0]!;
    withAlpha(ctx, n >= F.route[1] ? R.ghost / 0.82 : 1, () => drawGroupRange(f, L.arcGroup, k => [0, clamp(c * 12 - k, 0, 1)]));

    drawGroup(f, L.trunk, L.routeSlots, boil);
    const branchT = clip(n, F.route[0] + 3, 3);
    if (branchT > 0) drawGroupRange(f, L.branches, () => [0, easeInOut(branchT)], boil);

    // which items are riding the route now, with where they are; the accent plate marks items being handled
    const riders: { kind: Kind; pose: Pose }[] = [];
    const heapPose = (i: number): Pose => { const p = PILE[i]!, [x, y] = L.P(HEAP[0] + p.dx * ITEM, HEAP[1] + p.dy * ITEM); return { x, y, rotation: p.a, scale: L.k }; };
    const onHeap: number[] = [];
    if (loop < 0) {
      PILE.forEach((_, i) => {
        const b = BEAT.find(x => x.pile === i);
        if (i === PILE.length - 1 || !b || n < b.start) onHeap.push(i);
        else if (n < b.start + b.frames) riders.push({ kind: PILE[i]!.kind, pose: riderPose(f, L, PILE[i]!.kind, (n - b.start) / b.frames, heapPose(i), boil) });
      });
    } else {
      for (const e of emissions(loop, LOOP, EMIT)) {
        const kind = (e.index % 3) as Kind, spot = L.P(HEAP[0], HEAP[1] + 20);
        const rest: Pose = { x: spot[0], y: spot[1], rotation: 0.18 * (kind - 1), scale: L.k };
        if (e.age < 2) riders.push({ kind, pose: { ...rest, y: rest.y - (e.age === 0 ? 30 * L.s : 0) } });
        else riders.push({ kind, pose: riderPose(f, L, kind, (e.age - 1) / 10, rest, boil) });
      }
    }

    accentPlate(f, 'sorted', g => {
      for (const r of riders) {
        const body = place([glyphs[r.kind]!.body], r.pose.x, r.pose.y, L.k, r.pose.rotation)[0]!;
        fillPoly(g, body, coverage(0.3));
      }
    });

    // heap items (before the carry the top one sits on the heap; during it, it rides the arc)
    for (const i of onHeap) {
      const p = PILE[i]!;
      if (i === PILE.length - 1 && n >= F.carry[0]) {
        if (c >= 1) continue;
        const at = L.arc[Math.min(L.arc.length - 1, Math.round(c * (L.arc.length - 1)))]!;
        drawPuppet(f, ITEMS[p.kind]!, { x: at[0], y: at[1], rotation: lerp(p.a, 0, c), scale: L.k });
        continue;
      }
      drawPuppet(f, ITEMS[p.kind]!, heapPose(i), { t: f.t - sec(F.heap[0] + i * 1.6), slots: ITEM_SLOTS[p.kind]! });
    }
    for (const r of riders) drawPuppet(f, ITEMS[r.kind]!, r.pose, { boil });

    // trays over the items, so they slide in behind the front
    for (const body of L.trayBodies) fillPoly(ctx, body, R.stock);
    drawGroup(f, L.trays, L.traySlots, boil);
    drawGroup(f, L.trayDetail, L.traySlots, boil);
    drawGroup(f, L.marks, L.markSlots, boil);

    // a tray ticks on the frame its item lands, then the tick fades
    TRAY_Y.forEach((_, k) => {
      let since = Infinity;
      if (loop < 0) {
        if (n >= F.carry[1] && k === 0) since = n - F.carry[1];
        for (const b of BEAT) if (PILE[b.pile]!.kind === k && n >= b.start + b.frames) since = Math.min(since, n - (b.start + b.frames));
      } else {
        for (let j = 0; j < LOOP / EMIT.every; j++) if (j % 3 === k) since = Math.min(since, (((loop - (j * EMIT.every + 11)) % LOOP) + LOOP) % LOOP);
      }
      withAlpha(ctx, 1 - clip(since, 5, 6), () => drawStroke(ctx, prepared(L.ticks)[k]!, 1));
    });
  },
};
