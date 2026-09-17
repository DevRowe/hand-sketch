/**
 * K10 "Keystone". Loose pencil stones sag into an incomplete arch between two banks of tools. The gap is measured
 * with a pencil dimension line, a keystone is inked in accent to exactly that size and drops in; on the landing frame
 * every stone snaps into alignment (one frame of overshoot) and is re-inked from the crown outward. An accent path
 * draws across, and in the loop documents cross the arch at even spacing into the record stack.
 */
import { calendarCard, dimensionLine, envelope, sheet, type Glyph } from '../../art/glyphs';
import { emissions } from '../../core/emitter';
import { catmullRom } from '../../core/geometry';
import { drawGroup, drawGroupRange, prepared, scheduleWithin, type Slot, type StrokeGroup } from '../../core/ink';
import { boilStep } from '../../core/loop';
import { TAU, type Vec2 } from '../../core/math';
import { drawPuppet, posePoint, type Pose, type Puppet } from '../../core/puppet';
import type { Scene } from '../../core/scene';
import { sketch } from '../../core/sketch';
import { sampleStroke } from '../../core/stroke';
import { clip, track } from '../../core/track';
import { accentPlate, coverage, DURATION, fillPoly, fit, group, lf, LOOP, LOOP_FROM, nf, paper, perSize, R, S, sec, withAlpha } from './common';

/** Storyboard in drawn frames (12 fps). */
const F = { banks: [0, 14], stones: [14, 26], dashed: [22, 26], measure: [26, 32], cut: [29, 35], land: [35, 37], sweep: 37, path: [38, 47] } as const;
const EMIT = { every: 12, life: 24 } as const;
const CX = 960, CY = 790, R_IN = 300, R_OUT = 430;
/** Stone angle spans (degrees, 180 = left springing), left to right, leaving the crown for the keystone. */
const SPANS: [number, number][] = [[180, 159], [159, 138], [138, 117], [117, 97], [83, 63], [63, 42], [42, 21], [21, 0]];
/** How far each stone sags (design units down) and tilts before the keystone locks the arch. */
const SAG = [4, 14, 34, 62, 58, 30, 12, 3] as const, TILT = [0.01, 0.04, 0.09, 0.16, -0.14, -0.08, -0.03, -0.01] as const;
const RING = [3, 2, 1, 0, 0, 1, 2, 3] as const;

const polar = (deg: number, r: number): Vec2 => [CX + Math.cos((deg * TAU) / 360) * r, CY - Math.sin((deg * TAU) / 360) * r];
const centroid = (pts: readonly Vec2[]): Vec2 => [pts.reduce((a, p) => a + p[0], 0) / pts.length, pts.reduce((a, p) => a + p[1], 0) / pts.length];

interface Stone { home: Vec2; body: Vec2[]; pencil: Puppet; ink: Puppet }
const STONES: Stone[] = SPANS.map(([a0, a1], k) => {
  const pts = [polar(a0, R_OUT), polar(a1, R_OUT), polar(a1, R_IN), polar(a0, R_IN)];
  const c = centroid(pts), local = pts.map(([x, y]): Vec2 => [x - c[0], y - c[1]]);
  const outline = (roughness: number, style: typeof S.INK, seed: number) => group(sketch.polygon(local, { seed, roughness, disableMultiStroke: true }).outline, style, seed + 1);
  return { home: c, body: local, pencil: { groups: [outline(1.6, S.PENCIL, 1100 + k * 3)] }, ink: { fills: [{ pts: local, color: R.stock }], groups: [outline(0.8, S.INK, 1130 + k * 3)] } };
});
const keyPts = [polar(97, R_OUT + 26), polar(83, R_OUT + 26), polar(83, R_IN), polar(97, R_IN)];
const KEY_HOME = centroid(keyPts), KEY_LOCAL = keyPts.map(([x, y]): Vec2 => [x - KEY_HOME[0], y - KEY_HOME[1]]);
const KEYSTONE: Puppet = { fills: [{ pts: KEY_LOCAL, color: R.stock }], groups: [group(sketch.polygon(KEY_LOCAL, { seed: 1160, roughness: 0.7, disableMultiStroke: true }).outline, { ...S.FLOW, size: 6.5 }, 1161)] };
const KEY_SLOTS: Slot[][] = [scheduleWithin(KEYSTONE.groups[0]!, 0, sec(F.cut[1] - F.cut[0]))];

const doc = sheet(70, 90, 1170, { lines: 3 });
const DOC: Puppet = { fills: [{ pts: doc.body, color: R.stock }], groups: [group(doc.outline, { ...S.INK, size: 3.6 }, 1171), group(doc.detail, { ...S.FINE, size: 2.2 }, 1172)] };

const bankGlyphs: [Glyph, Vec2][] = [[calendarCard(200, 150, 1180), [300, 720]], [sheet(170, 150, 1181, { lines: 3 }), [300, 555]], [envelope(210, 130, 1182), [300, 405]]];

interface Layout {
  P(x: number, y: number): Vec2;
  s: number;
  banks: StrokeGroup; bankDetail: StrokeGroup; bankSlots: Slot[]; detailSlots: Slot[]; bankBodies: Vec2[][];
  records: StrokeGroup; recordBody: Vec2[];
  ground: StrokeGroup;
  dashed: StrokeGroup; measure: StrokeGroup; path: StrokeGroup;
}

const layout = perSize((w, h): Layout => {
  const { P, s } = fit(w, h, 1920, 1080, 1.05, [960, 560]);
  const at = (paths: Vec2[][], [x, y]: Vec2) => paths.map(p => p.map(([px, py]): Vec2 => P(x + px, y + py)));
  const banks = group(bankGlyphs.flatMap(([g, c]) => at(g.outline, c)), S.INK, 1190);
  const bankDetail = group(bankGlyphs.flatMap(([g, c]) => at(g.detail, c)), S.FINE, 1191);
  const recordPaths: Vec2[][] = [];
  for (let k = 0; k < 5; k++) recordPaths.push(...sketch.rectangle(...P(1520, 470 + k * 64), 210 * s, 58 * s, { seed: 1200 + k, roughness: 0.8, disableMultiStroke: true }).outline);
  const records = group(recordPaths, S.INK, 1206);
  const gap = [polar(97, R_OUT + 60), polar(83, R_OUT + 60)] as const;
  const across = catmullRom([P(250, 338), P(560, 334), P(960, 326), P(1360, 334), P(1625, 466)], 16);
  return {
    P, s, banks, bankDetail, bankSlots: scheduleWithin(banks, 0, sec(F.banks[1] - 4)), detailSlots: scheduleWithin(bankDetail, sec(6), sec(F.banks[1]), 0.01),
    bankBodies: bankGlyphs.map(([g, c]) => g.body.map(([x, y]) => P(c[0] + x, c[1] + y))),
    records, recordBody: [P(1520, 470), P(1730, 470), P(1730, 790), P(1520, 790)],
    ground: group([[P(120, 800), P(900, 804), P(1800, 798)]], S.FINE, 1210),
    dashed: group(Array.from({ length: 5 }, (_, k): Vec2[] => [P(330 + k * 110, 350 + k * 6), P(390 + k * 110, 352 + k * 6)]), { ...S.PENCIL, taperStart: 6, taperEnd: 6 }, 1211),
    measure: group(dimensionLine(P(...gap[0]), P(...gap[1]), 1212, 26 * s), { ...S.PENCIL, size: 2.6 }, 1213),
    path: group([across], S.FLOW, 1214),
  };
});

/** 0 while the arch sags; on the landing frame it snaps past aligned (one overshoot frame), then rests at 1. */
const lock = track([{ frame: F.land[1] - 1, value: 0 }, { frame: F.land[1], value: 1, ease: 'hold', settle: 0.18 }]);
/** The keystone's drop: held above the gap, then lands in two frames with no in-betweens to speak of. */
const drop = track([{ frame: F.land[0], value: 1 }, { frame: F.land[1], value: 0, ease: 'in' }]);

export const keystoneScene: Scene = {
  name: 'keystone',
  duration: DURATION,
  loopFrom: LOOP_FROM,
  poster: 5,
  draw(f) {
    const { ctx, stage } = f;
    const L = layout(stage.w, stage.h), n = nf(f), loop = lf(f), boil = boilStep(f);
    paper(f);
    const locked = lock(n);
    const stonePose = (k: number, amount: number): Pose => {
      const [x, y] = L.P(STONES[k]!.home[0], STONES[k]!.home[1] + SAG[k]! * (1 - amount));
      return { x, y, rotation: TILT[k]! * (1 - amount), scale: L.s };
    };

    drawGroup(f, L.ground, [{ start: 0, duration: sec(8) }], boil);

    // the documents cross the arch in the loop: drawn before the banks so they come out of one and go into the other
    const line = prepared(L.path, boil)[0]!;
    const riders = loop < 0 ? [] : emissions(loop, LOOP, EMIT).map(e => {
      const at = sampleStroke(line, e.u), lift = 50 * L.s;
      return { x: at.point[0] - at.normal[0] * lift, y: at.point[1] - at.normal[1] * lift, rotation: at.angle * 0.6, scale: L.s } as Pose;
    });

    // the manual arch: pencil stones and a dashed path that stops at the gap; after the lock they stay as a ghost
    STONES.forEach((st, k) => {
      const t = f.t - sec(F.stones[0] + k * 1.4);
      withAlpha(ctx, n >= F.sweep ? R.ghost / 0.82 : 1, () => drawPuppet(f, st.pencil, stonePose(k, 0), { t, slots: [scheduleWithin(st.pencil.groups[0]!, 0, sec(2))] }));
    });
    withAlpha(ctx, n >= F.sweep ? R.ghost : 1, () => drawGroupRange(f, L.dashed, k => [0, Math.max(0, Math.min(1, clip(n, F.dashed[0], F.dashed[1] - F.dashed[0]) * 5 - k))]));

    // the fit: measure the gap, cut the keystone to it (it stays faint once used)
    withAlpha(ctx, n >= F.sweep ? R.ghost / 0.82 : 1, () => drawGroupRange(f, L.measure, k => [0, Math.max(0, Math.min(1, clip(n, F.measure[0], F.measure[1] - F.measure[0]) * 3 - k))]));

    // on the landing frame the stones snap into place and re-ink from the crown outward
    if (n >= F.land[1]) {
      STONES.forEach((st, k) => {
        const inked = clip(n, F.sweep + RING[k]!, 1);
        if (inked > 0) drawPuppet(f, st.ink, stonePose(k, locked), { boil });
      });
    }

    accentPlate(f, 'keystone', g => {
      if (n < F.cut[0]) return;
      const pose: Pose = { x: L.P(...KEY_HOME)[0], y: L.P(KEY_HOME[0], KEY_HOME[1] - 200 * drop(n))[1], scale: L.s };
      fillPoly(g, KEY_LOCAL.map(p => posePoint(pose, p)), coverage(0.55 * clip(n, F.cut[0] + 2, 4)));
    });
    if (n >= F.cut[0]) {
      const [kx, ky] = L.P(KEY_HOME[0], KEY_HOME[1] - 200 * drop(n));
      drawPuppet(f, { groups: KEYSTONE.groups }, { x: kx, y: ky, scale: L.s }, { boil, t: f.t - sec(F.cut[0]), slots: KEY_SLOTS });
    }

    drawGroupRange(f, L.path, () => [0, clip(n, F.path[0], F.path[1] - F.path[0])], boil);
    for (const p of riders) drawPuppet(f, DOC, p, { boil });

    for (const b of L.bankBodies) fillPoly(ctx, b, R.stock);
    fillPoly(ctx, L.recordBody, R.stock);
    drawGroup(f, L.banks, L.bankSlots, boil);
    drawGroup(f, L.bankDetail, L.detailSlots, boil);
    drawGroup(f, L.records, scheduleWithin(L.records, sec(4), sec(F.banks[1])), boil);
  },
};
