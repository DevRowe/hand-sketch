/**
 * K08 "Through the gate". Irregular inputs (a crumpled note, a receipt, a handwritten form, an email card) arrive
 * unevenly and jam at a hand-drawn gate. When the gate's accent inner edge is drawn they pass through and emerge as
 * identical record cards at perfectly even spacing. The gate's body hides the swap, so nothing morphs.
 *
 * Every item i has one global timeline: it reaches the gate on frame 51 + 9i, so outputs are metronomic by
 * construction (4 per loop), while its approach uses a per-(i mod 4) pace and tilt, so inputs stay irregular and the
 * pattern repeats exactly each loop. The two jammed items are simply items -2 and -1, held at the mouth until release.
 */
import { crumpledNote, envelope, receipt, sheet, type Glyph } from '../../art/glyphs';
import { drawGroup, scheduleWithin, type Slot, type StrokeGroup } from '../../core/ink';
import { boilStep } from '../../core/loop';
import { clamp, lerp, type Vec2 } from '../../core/math';
import { drawPuppet, posePoint, type Pose, type Puppet } from '../../core/puppet';
import type { Scene, SceneFrame } from '../../core/scene';
import { sketch } from '../../core/sketch';
import { clip, track } from '../../core/track';
import { accentPlate, coverage, DURATION, fillPoly, fit, group, LOOP_FROM, nf, paper, perSize, R, S, sec } from './common';

/** Storyboard in drawn frames (12 fps). */
const F = { gate: [0, 12], pencilBase: [4, 14], edge: [30, 33], accentBase: [33, 35], release: 30 } as const;
/** Item i reaches the gate centre on frame EXIT0 + PERIOD * i. */
const EXIT0 = 51, PERIOD = 9, T_IN = 30, T_OUT = 24;
const GATE_X = 960, BASE_Y = 760, X_IN = -140, X_OUT = 2060;
const POSTS = { left: [880, 922], right: [998, 1040], top: 360 } as const;

const inputs: Glyph[] = [crumpledNote(120, 96, 901), receipt(78, 130, 911), sheet(100, 128, 921, { lines: 4 }), envelope(130, 84, 931)];
const puppet = (g: Glyph, seed: number, detail = S.FINE): Puppet => ({ fills: [{ pts: g.body, color: R.stock }], groups: [group(g.outline, S.INK, seed), group(g.detail, detail, seed + 1)] });
const INPUTS = inputs.map((g, k) => puppet(g, 940 + k * 3, k === 2 ? { ...S.PENCIL, size: 2.4 } : S.FINE));
const card = sheet(132, 96, 951, { lines: 3, header: true });
const CARD = puppet(card, 955);
const CARD_BAND: Vec2[] = [[-66, -48], [66, -48], [66, -22], [-66, -22]];
/** Irregular approach per (i mod 4): pace exponent, tilt, height of the little hops. */
const PACE = [0.72, 1.45, 1.0, 1.25] as const, TILT = [-0.22, 0.3, 0.12, -0.38] as const, HOP = [10, 0, 16, 6] as const;

const mod4 = (i: number) => ((i % 4) + 4) % 4;
const heightOf = (g: Glyph) => { const ys = g.body.map(p => p[1]); return Math.max(...ys) - Math.min(...ys); };

interface Layout {
  P(x: number, y: number): Vec2;
  s: number;
  gate: StrokeGroup; gateSlots: Slot[]; gateBody: Vec2[];
  pencilBase: StrokeGroup; pencilSlots: Slot[];
  edges: StrokeGroup; accentBase: StrokeGroup;
  leftOf: Vec2[]; rightOf: Vec2[];
}

const layout = perSize((w, h): Layout => {
  const { P, s } = fit(w, h, 1920, 1080, 1.15, [960, 640]);
  const rough = (seed: number, roughness = 0.9) => ({ seed, roughness, disableMultiStroke: true });
  const post = (x0: number, x1: number, seed: number) => sketch.rectangle(...P(x0, POSTS.top), (x1 - x0) * s, (BASE_Y + 10 - POSTS.top) * s, rough(seed)).outline;
  const lintel = sketch.rectangle(...P(POSTS.left[0] - 40, POSTS.top - 44), (POSTS.right[1] - POSTS.left[0] + 80) * s, 44 * s, rough(963)).outline;
  const gate = group([...post(...POSTS.left, 961), ...post(...POSTS.right, 962), ...lintel], S.INK, 964);
  return {
    P, s, gate, gateSlots: scheduleWithin(gate, sec(F.gate[0]), sec(F.gate[1])),
    gateBody: [P(POSTS.left[0], POSTS.top), P(POSTS.right[1], POSTS.top), P(POSTS.right[1], BASE_Y + 10), P(POSTS.left[0], BASE_Y + 10)],
    pencilBase: group([[P(80, BASE_Y + 4), P(500, BASE_Y + 1), P(POSTS.left[0], BASE_Y + 4)]], S.PENCIL, 965),
    pencilSlots: scheduleWithin(group([[P(80, BASE_Y + 4), P(500, BASE_Y + 1), P(POSTS.left[0], BASE_Y + 4)]], S.PENCIL, 965), sec(F.pencilBase[0]), sec(F.pencilBase[1])),
    edges: group([[P(POSTS.left[1] + 4, POSTS.top + 10), P(POSTS.left[1] + 4, BASE_Y)], [P(POSTS.right[0] - 4, POSTS.top + 10), P(POSTS.right[0] - 4, BASE_Y)]], { ...S.FLOW, size: 7 }, 966),
    accentBase: group([[P(POSTS.right[1], BASE_Y + 4), P(1500, BASE_Y + 2), P(1920, BASE_Y + 4)]], S.FLOW, 967),
    leftOf: [P(-400, 0), P(GATE_X, 0), P(GATE_X, 1400), P(-400, 1400)],
    rightOf: [P(GATE_X, 0), P(2400, 0), P(2400, 1400), P(GATE_X, 1400)],
  };
});

/** The two jammed items: where they sit (design x), when they slide in, and their nudges. */
const JAM: Record<number, { x: (n: number) => number; tilt: number }> = {
  [-2]: { x: n => track([{ frame: 14, value: X_IN }, { frame: 22, value: 830, ease: 'out' }, { frame: 26, value: 830, ease: 'hold' }, { frame: 27, value: 846, ease: 'hold' }, { frame: 28, value: 846, ease: 'hold' }])(n), tilt: 0.34 },
  [-1]: { x: n => track([{ frame: 17, value: X_IN }, { frame: 26, value: 748, ease: 'out' }, { frame: 28, value: 760, ease: 'hold' }])(n), tilt: -0.2 },
};

function inputPose(L: Layout, i: number, n: number): Pose | null {
  const exit = EXIT0 + PERIOD * i, born = exit - T_IN, k = mod4(i);
  const u = clamp((n - born) / T_IN, 0, 1);
  const natural = lerp(X_IN, GATE_X, Math.pow(u, PACE[k]!));
  let x = natural, tilt: number = TILT[k]!;
  const jam = JAM[i];
  if (jam) {
    // held at the mouth until the gate opens; then it goes on as soon as its own pace catches up
    const held = jam.x(n);
    x = n < F.release ? Math.min(held, GATE_X) : Math.max(Math.min(held, 846), natural);
    tilt = lerp(jam.tilt, TILT[k]!, clip(n, F.release, 4));
    if (n < 14) return null;
  } else if (n < born) return null;
  if (x >= GATE_X || n > exit) return null;
  const hop = Math.abs(Math.sin(u * Math.PI * 5)) * HOP[k]!;
  const g = inputs[k]!;
  const [px, py] = L.P(x, BASE_Y - heightOf(g) / 2 - 4 - hop);
  return { x: px, y: py, rotation: tilt, scale: L.s };
}

function cardPose(L: Layout, i: number, n: number): Pose | null {
  const exit = EXIT0 + PERIOD * i;
  if (n < exit || n >= exit + T_OUT) return null;
  const [x, y] = L.P(lerp(GATE_X, X_OUT, (n - exit) / T_OUT), BASE_Y - 48 - 4);
  return { x, y, scale: L.s };
}

function clipTo(f: SceneFrame, area: Vec2[], draw: () => void): void {
  const { ctx } = f;
  ctx.save();
  ctx.beginPath();
  area.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.clip();
  draw();
  ctx.restore();
}

export const gateScene: Scene = {
  name: 'gate',
  duration: DURATION,
  loopFrom: LOOP_FROM,
  poster: 5,
  draw(f) {
    const { ctx, stage } = f;
    const L = layout(stage.w, stage.h), n = nf(f), boil = boilStep(f);
    paper(f);
    // one global item timeline: item i reaches the gate on frame 51 + 9i, a 36-frame pattern, so the loop repeats by itself
    const t = n, first = Math.floor((t - T_OUT - EXIT0) / PERIOD), last = Math.ceil((t + T_IN - EXIT0) / PERIOD);
    const ids: number[] = [];
    for (let i = Math.max(-2, first); i <= last; i++) ids.push(i);

    const cards = ids.map(i => cardPose(L, i, t)).filter((p): p is Pose => p !== null);

    drawGroup(f, L.pencilBase, L.pencilSlots, boil);
    drawGroup(f, L.accentBase, [{ start: sec(F.accentBase[0]), duration: sec(F.accentBase[1] - F.accentBase[0]) }], boil);

    clipTo(f, L.leftOf, () => {
      for (const i of ids) {
        const p = inputPose(L, i, t);
        if (p) drawPuppet(f, INPUTS[mod4(i)]!, p, { boil });
      }
    });
    clipTo(f, L.rightOf, () => cards.forEach(p => drawPuppet(f, CARD, p, { boil })));
    // uniformity reads through colour: every card's header band is printed in the accent, after the cards' paper
    accentPlate(f, 'gate', g => clipTo({ ...f, ctx: g }, L.rightOf, () => cards.forEach(p => fillPoly(g, CARD_BAND.map(q => posePoint(p, q)), coverage(0.7)))));

    fillPoly(ctx, L.gateBody, R.stock);
    drawGroup(f, L.gate, L.gateSlots, boil);
    drawGroup(f, L.edges, [0, 1].map(() => ({ start: sec(F.edge[0]), duration: sec(F.edge[1] - F.edge[0]) })), boil);
  },
};
