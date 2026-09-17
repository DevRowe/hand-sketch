/**
 * P04 "The Red Thread" (connection). Two small houses on two far hills. A red thread leaves one window and finds its
 * way across the sky: it hesitates, loops, knots itself up badly in the middle, and still arrives at the other window.
 * Then the knot lets go, and the thread eases into one gentle line between them; both windows light. The loop is a
 * tug passed along the thread and back, each window brightening as it arrives, the thread swaying like breath.
 */
import { MOODS } from '../../art/moods';
import { catmullRom } from '../../core/geometry';
import { drawGroup, scheduleWithin, type Slot, type StrokeGroup } from '../../core/ink';
import { clamp, TAU, type Vec2 } from '../../core/math';
import { noise1 } from '../../core/random';
import type { Scene } from '../../core/scene';
import { sketch } from '../../core/sketch';
import { drawStroke, drawStrokeRange, prepareMorph, withPressure, type PreparedStroke, type StrokeStyle } from '../../core/stroke';
import { clip } from '../../core/track';
import { ease, fillPoly, fit, glow, group, nf, pen, perSize, sec, stock } from './common';

const M = MOODS.tenderness;
const RED = M.inks[0]!, LAMP = M.inks[1]!;
const LINE: StrokeStyle = { color: M.ink, size: 3.6, thinning: 0.6, wobble: 1.8, wobbleWavelength: 220, tremor: 0.35, pressureVariation: 0.5, dryBrush: 0.15, paper: M.paper, taperStart: 30, taperEnd: 40 };
const THREAD: StrokeStyle = { color: RED, size: 4.6, thinning: 0.5, wobble: 2.2, wobbleWavelength: 160, tremor: 0.3, pressureVariation: 0.45, taperStart: 16, taperEnd: 16 };

/** Storyboard in drawn frames (12 fps). */
const F = { hills: [0, 36], houseA: [24, 46], houseB: [36, 58], thread: [58, 142], untangle: [152, 184], lamps: [182, 194], loopFrom: 196 } as const;
const LOOP = 72;
/** The tug: out along the thread in 30 frames, a rest, back in 30. */
const TUG = { out: [0, 30], back: [36, 66] } as const;

const WIN_A: Vec2 = [312, 612], WIN_B: Vec2 = [1612, 620];

/** The thread as first drawn: sags, a small loop of hesitation, a hard knot in the middle, then on to the other window. */
function tangled(): Vec2[] {
  const knot: Vec2[] = [];
  for (let k = 0; k <= 64; k++) {
    const u = k / 64, a = u * TAU * 3.3 + 0.6, r = 46 + 30 * Math.sin(u * 9.1) + noise1(u * 7, 4401) * 26;
    knot.push([940 + u * 70 + Math.cos(a) * r * 1.25, 470 + Math.sin(a) * r * 0.9]);
  }
  const loop: Vec2[] = [];
  for (let k = 0; k <= 16; k++) {
    const a = Math.PI * 0.5 - (k / 16) * TAU;
    loop.push([560 + Math.cos(a) * 34, 596 - 34 + Math.sin(a) * 34]);
  }
  return catmullRom([WIN_A, [380, 640], [470, 640], ...loop, [700, 560], [830, 500], ...knot, [1140, 470], [1300, 560], [1460, 640], [1560, 646], WIN_B], 5);
}
/** The same thread let go: one easy sag from window to window. */
function taut(): Vec2[] {
  const pts: Vec2[] = [];
  for (let k = 0; k <= 40; k++) {
    const u = k / 40;
    pts.push([WIN_A[0] + (WIN_B[0] - WIN_A[0]) * u, WIN_A[1] + (WIN_B[1] - WIN_A[1]) * u + 110 * Math.sin(Math.PI * u)]);
  }
  return pts;
}

interface Layout {
  P(x: number, y: number): Vec2; s: number;
  hills: StrokeGroup; hillSlots: Slot[];
  houses: { group: StrokeGroup; slots: Slot[]; body: Vec2[]; window: Vec2[]; lamp: Vec2 }[];
  morph: (t: number) => PreparedStroke;
  first: PreparedStroke;
}

const layout = perSize((w, h): Layout => {
  const { P, s } = fit(w, h, 1920, 1080, 1.12, [960, 590]);
  const map = (pts: readonly Vec2[]) => pts.map(([x, y]) => P(x, y));
  const hills = group([
    map(catmullRom([[-120, 716], [120, 668], [300, 652], [470, 676], [700, 760], [960, 800], [1220, 770], [1460, 690], [1620, 660], [1780, 676], [2040, 730]], 12)),
  ], { ...LINE, size: LINE.size * s }, 4001);
  const house = (x: number, base: number, win: Vec2, seed: number, slot: readonly [number, number]) => {
    const r = { roughness: 0.7, disableMultiStroke: true };
    const bodyPts: Vec2[] = [[x - 44, base], [x - 44, base - 58], [x + 44, base - 58], [x + 44, base]];
    const paths = [
      ...sketch.linearPath(bodyPts, { ...r, seed }).outline,
      ...sketch.linearPath([[x - 58, base - 54], [x, base - 104], [x + 58, base - 54]], { ...r, seed: seed + 1 }).outline,
      ...sketch.rectangle(win[0] - 12, win[1] - 12, 24, 24, { ...r, seed: seed + 2 }).outline,
    ].map(map);
    const g = group(paths, { ...LINE, size: 3.2 * s }, seed + 3);
    return {
      group: g, slots: scheduleWithin(g, sec(slot[0]), sec(slot[1]), 0.1),
      body: map([[x - 44, base], [x - 44, base - 58], [x - 58, base - 54], [x, base - 104], [x + 58, base - 54], [x + 44, base - 58], [x + 44, base]]),
      window: map([[win[0] - 11, win[1] - 11], [win[0] + 11, win[1] - 11], [win[0] + 11, win[1] + 11], [win[0] - 11, win[1] + 11]]),
      lamp: P(...win),
    };
  };
  const style = { ...THREAD, size: THREAD.size * s };
  const knotAt = 0.52;
  const morph = prepareMorph(map(tangled()), map(taut()), style, 4101);
  // the pen presses into the knot, and lightens as it lets the thread go on
  const first = withPressure(morph(0), u => 0.8 + 0.5 * Math.exp(-(((u - knotAt) / 0.14) ** 2)));
  return {
    P, s, hills: hills, hillSlots: scheduleWithin(hills, sec(F.hills[0]), sec(F.hills[1]), 0.2),
    houses: [house(312, 652, WIN_A, 4201, F.houseA), house(1612, 660, WIN_B, 4211, F.houseB)],
    morph, first,
  };
});

/** The hand drawing the thread: a hesitation near the start, slow and fussy through the knot, quicker once through it. */
const drawn = pen([
  [F.thread[0], 0], [72, 0.12], [80, 0.14], [96, 0.3, 'inOut'], [112, 0.46], [124, 0.6, 'linear'], [128, 0.61], [F.thread[1], 1, 'inOut'],
]);

export const redThreadScene: Scene = {
  name: 'red-thread',
  duration: (F.loopFrom + LOOP) / 12,
  loopFrom: F.loopFrom / 12,
  poster: (F.loopFrom + 20) / 12,
  draw(f) {
    const { ctx, stage } = f;
    const L = layout(stage.w, stage.h), n = nf(f);
    stock(f, M.paper, { seed: 41, vignette: 0.2, vignetteColor: M.ink });
    const m = f.loopPhase === null ? -1 : (Math.round(f.loopPhase * LOOP * 1e6) / 1e6) % LOOP;

    drawGroup(f, L.hills, L.hillSlots);

    // lamps: both windows light once the thread is let go; in the loop each brightens as the tug arrives
    const lamps = clip(n, F.lamps[0], F.lamps[1] - F.lamps[0]);
    const arrive = (at: number) => (m < 0 ? 0 : Math.max(0, 1 - Math.min(Math.abs(m - at), LOOP - Math.abs(m - at)) / 8) ** 2);
    L.houses.forEach((hs, k) => {
      const [a, b] = k === 0 ? F.houseA : F.houseB;
      fillPoly(ctx, hs.body, M.paper, clip(n, a, b - a));
      const bright = lamps * (0.75 + 0.5 * arrive(k === 0 ? TUG.back[1] : TUG.out[1]));
      if (bright > 0) {
        glow(f, hs.lamp[0], hs.lamp[1], 46 * L.s, LAMP, bright * 0.5, { cell: 5, density: 0.5, falloff: 2.5, bloom: 0.3, seed: 4301 + k });
        fillPoly(ctx, hs.window, LAMP, clamp(bright, 0, 1));
      }
      drawGroup(f, hs.group, hs.slots);
    });

    // the thread: drawn tangled, then let go; in the loop it sways, and a tug travels it
    const t = ease(clip(n, F.untangle[0], F.untangle[1] - F.untangle[0]));
    let thread = t <= 0 ? L.first : L.morph(t);
    if (t > 0 && t < 1) thread = withPressure(thread, u => 0.8 + 0.5 * (1 - t) * Math.exp(-(((u - 0.52) / 0.14) ** 2)));
    if (m >= 0) {
      const sway = 9 * L.s * Math.sin(TAU * (m / LOOP) * 2);
      const base = thread;
      thread = { ...base, points: base.points.map((p, k): Vec2 => [p[0], p[1] + sway * Math.sin(Math.PI * (base.lengths[k]! / base.length))]) };
    }
    drawStroke(ctx, thread, t > 0 ? 1 : drawn(n));
    if (m >= 0) {
      const tug = { ...thread, style: { ...thread.style, size: thread.style.size * 2.3 } };
      const bead = (u: number) => drawStrokeRange(ctx, tug, clamp(u - 0.045, 0, 1), clamp(u + 0.045, 0, 1), { taperStart: 22 * L.s, taperEnd: 22 * L.s });
      const out = clip(m, TUG.out[0], TUG.out[1] - TUG.out[0]), back = clip(m, TUG.back[0], TUG.back[1] - TUG.back[0]);
      if (out > 0 && out < 1) bead(ease(out));
      if (back > 0 && back < 1) bead(1 - ease(back));
    }
  },
};
