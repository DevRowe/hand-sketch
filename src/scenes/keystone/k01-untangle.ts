/**
 * K01 "Untangle" (hero). A knot of pencilled hand-offs between an inbox and a ledger pulls taut into one accent
 * line; the five hand-offs settle onto it as three steps. Loop: a document rides the line at constant speed, each
 * step ticks on the drawn frame the document reaches it, the ledger ticks on arrival, ticks clear before the seam.
 */
import { sheet, tick } from '../../art/glyphs';
import { drawGroup, prepared, scheduleWithin, type Slot, type StrokeGroup } from '../../core/ink';
import { catmullRom } from '../../core/geometry';
import { boilStep } from '../../core/loop';
import { clamp, easeInOut, lerp, type Vec2 } from '../../core/math';
import { drawPuppet, type Puppet } from '../../core/puppet';
import { hashSeed } from '../../core/random';
import type { Scene } from '../../core/scene';
import { sketch } from '../../core/sketch';
import { drawStroke, prepareMorph, prepareStroke, sampleStroke } from '../../core/stroke';
import { clip } from '../../core/track';
import { accentPlate, coverage, DURATION, fillPoly, fit, group, lf, LOOP_FROM, nf, paper, perSize, R, S, sec, withAlpha } from './common';

/** Storyboard in drawn frames (12 fps). */
const F = { anchors: [1, 11], rows: [7, 16], tangle: [10, 32], morph: [36, 41], ride: 26, clear: [32, 4] } as const;
const STATIONS = [0.3, 0.52, 0.74] as const, STOP_TO_STATION = [0, 0, 1, 2, 2] as const;
const FLOW_SEED = 500;

const square = (x: number, y: number, r: number, seed: number): Vec2[][] =>
  sketch.rectangle(x - r, y - r, 2 * r, 2 * r, { seed, roughness: 1, disableMultiStroke: true }).outline;

interface Layout {
  s: number;
  anchors: StrokeGroup; anchorSlots: Slot[];
  rows: StrokeGroup; rowSlots: Slot[];
  tangle: StrokeGroup; tangleSlots: Slot[];
  route: Vec2[]; straight: Vec2[];
  flow: StrokeGroup;
  stops: Vec2[]; stations: Vec2[];
  stationSquares: StrokeGroup[]; stationTicks: StrokeGroup;
  tray: Vec2[]; ledger: Vec2[]; tickCol: Vec2[]; ledgerTick: StrokeGroup;
}

const layout = perSize((w, h): Layout => {
  const { P, s: fs } = fit(w, h, 1080, 1080), s = fs * 1.06;
  const Q = (x: number, y: number): Vec2 => { const c = P(540, 540); return [c[0] + (x - 540) * s, c[1] + (y - 540) * s]; };
  const A = Q(214, 600), B = Q(842, 548);
  const stops = [Q(380, 400), Q(585, 318), Q(470, 650), Q(662, 560), Q(740, 772)];
  const via: Vec2[] = [A, Q(290, 505), stops[0]!, Q(345, 318), Q(470, 262), stops[1]!, Q(640, 410), Q(530, 470), Q(420, 530), stops[2]!, Q(585, 722), Q(700, 665), stops[3]!, Q(560, 612), Q(628, 758), stops[4]!, Q(832, 722), Q(772, 628), B];
  const route = catmullRom(via, 10);
  const straight = catmullRom([A, Q(528, 560), B], 24);

  // one pencil stroke per leg and a hand-off box after each leg, so the pen hesitates at every hand-off
  const nearest = (p: Vec2) => route.reduce((best, q, k) => (Math.hypot(q[0] - p[0], q[1] - p[1]) < Math.hypot(route[best]![0] - p[0], route[best]![1] - p[1]) ? k : best), 0);
  const legs: Vec2[][] = [];
  let from = 0;
  stops.forEach((p, i) => {
    const c = nearest(p);
    legs.push(route.slice(from, c + 1));
    legs.push(...square(p[0], p[1], 24 * s, 70 + i));
    from = c;
  });
  legs.push(route.slice(from));

  const tray: Vec2[] = [Q(78, 562), Q(214, 562), Q(200, 648), Q(92, 648)];
  const ledger: Vec2[] = [Q(842, 392), Q(1004, 392), Q(1004, 700), Q(842, 700)];
  const anchors = group([
    ...sketch.polygon([Q(104, 470), Q(182, 462), Q(189, 560), Q(110, 566)], { seed: 12, roughness: 1 }).outline,
    ...sketch.polygon(tray, { seed: 13, roughness: 0.9 }).outline,
    ...sketch.polygon(ledger, { seed: 14, roughness: 0.9 }).outline,
  ], S.INK, 11);
  const rows: Vec2[][] = [];
  for (let r = 0; r < 4; r++) {
    const [x0, y] = Q(862, 450 + r * 64), [x1] = Q(938, 0), [bx] = Q(956, 0);
    rows.push(...sketch.line([x0, y], [x1, y], { seed: 30 + r, roughness: 0.8, disableMultiStroke: true }).outline);
    rows.push(...sketch.rectangle(bx, y - 17 * s, 28 * s, 28 * s, { seed: 40 + r, roughness: 0.9, disableMultiStroke: true }).outline);
  }
  const flow = group([straight], S.FLOW, FLOW_SEED);
  const line = prepared(flow)[0]!;
  const stations = STATIONS.map(u => sampleStroke(line, u).point);
  const rowsG = group(rows, S.FINE, 21), tangleG = group(legs, S.PENCIL, 31);
  const lt = Q(970, 450);
  return {
    s,
    anchors, anchorSlots: scheduleWithin(anchors, sec(F.anchors[0]), sec(F.anchors[1])),
    rows: rowsG, rowSlots: scheduleWithin(rowsG, sec(F.rows[0]), sec(F.rows[1]), 0.01),
    tangle: tangleG, tangleSlots: scheduleWithin(tangleG, sec(F.tangle[0]), sec(F.tangle[1]), 0.1),
    route, straight, flow, stops, stations,
    stationSquares: stations.map(([x, y], k) => group(square(x, y, 24 * s, 820 + k), { ...S.INK, size: 3.6, color: R.accent }, 820 + k)),
    stationTicks: group(stations.map(([x, y]) => tick(26 * s).map(([px, py]): Vec2 => [x + px, y + py])), S.TICK, 840),
    tray, ledger, tickCol: [Q(950, 424), Q(994, 424), Q(994, 676), Q(950, 676)],
    ledgerTick: group([tick(25 * s).map(([px, py]): Vec2 => [lt[0] + px, lt[1] + py])], S.TICK, 700),
  };
});

const morphs = perSize((w, h) => {
  const L = layout(w, h);
  return {
    flow: prepareMorph(L.route, L.straight, S.FLOW, hashSeed(FLOW_SEED, 0, 0)),
    pencil: prepareMorph(L.route, L.straight, S.PENCIL, 99),
  };
});

/** The travelling document: a small sheet with a paper backing, prepared once in local units. */
const doc = sheet(44, 60, 60, { lines: 3 });
const DOCUMENT: Puppet = {
  fills: [{ pts: doc.body, color: R.stock }],
  groups: [group(doc.outline, { ...S.INK, size: 3.2, dryBrush: 0 }, 600), group(doc.detail, { ...S.FINE, size: 2.2 }, 620)],
};

export const untangleScene: Scene = {
  name: 'untangle',
  duration: DURATION,
  loopFrom: LOOP_FROM,
  poster: 5.2,
  draw(f) {
    const { ctx, stage } = f;
    const L = layout(stage.w, stage.h), n = nf(f), loop = lf(f), boil = boilStep(f);
    paper(f);

    const m = easeInOut(clip(n, F.morph[0], F.morph[1] - F.morph[0]));
    // the old route stays as a faint ghost: the "before" survives in the resting (poster) frame
    withAlpha(ctx, lerp(1, R.ghost, m), () => drawGroup(f, L.tangle, L.tangleSlots));
    if (m > 0 && m < 1) {
      const M = morphs(stage.w, stage.h);
      withAlpha(ctx, 1 - m, () => drawStroke(ctx, M.pencil(m), 1));
      drawStroke(ctx, M.flow(m), m);
      // hand-offs slide onto the line and merge into three steps
      L.stops.forEach((p, i) => {
        const q = L.stations[STOP_TO_STATION[i]!]!;
        withAlpha(ctx, 1 - m * 0.6, () => square(lerp(p[0], q[0], m), lerp(p[1], q[1], m), 24 * L.s, 800 + i).forEach((sq, k) => drawStroke(ctx, prepareStroke(sq, S.PENCIL, 800 + i * 7 + k), 1)));
      });
    }

    let ledgerTick = 0;
    if (m >= 1) {
      drawGroup(f, L.flow, [], boil);
      const line = prepared(L.flow, boil)[0]!;
      const clear = loop < 0 ? 0 : clip(loop, F.clear[0], F.clear[1]);
      const u = loop < 0 ? 0 : clamp(loop / F.ride, 0, 1);
      L.stations.forEach(([x, y], k) => {
        const r = 24 * L.s;
        fillPoly(ctx, [[x - r, y - r], [x + r, y - r], [x + r, y + r], [x - r, y + r]], R.stock);
        drawGroup(f, L.stationSquares[k]!, [], boil);
      });
      // each step ticks on the drawn frame the document reaches it
      const ticked = STATIONS.map(st => (loop > 0 && u >= st ? 1 - clear : 0));
      ticked.forEach((a, k) => withAlpha(ctx, a, () => drawStroke(ctx, prepared(L.stationTicks)[k]!, 1)));
      ledgerTick = loop >= F.ride ? 1 - clear : 0;
      if (u > 0 && u < 1) {
        const at = sampleStroke(line, u);
        drawPuppet(f, DOCUMENT, { x: at.point[0], y: at.point[1] - 84 * L.s, rotation: at.angle * 0.35, scale: L.s * 1.5 }, { boil });
      }
    }

    // tools in key ink, drawn over the route so the document leaves the tray and disappears into the ledger
    fillPoly(ctx, L.ledger, R.stock);
    accentPlate(f, 'untangle', g => {
      fillPoly(g, L.tray, coverage(0.24 * clip(n, 11, 6)));
      fillPoly(g, L.tickCol, coverage(0.18 * clip(n, 13, 6)));
    });
    drawGroup(f, L.anchors, L.anchorSlots, boil);
    drawGroup(f, L.rows, L.rowSlots, boil);
    withAlpha(ctx, ledgerTick, () => drawGroup(f, L.ledgerTick, [], 0));
  },
};
