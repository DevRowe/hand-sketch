/**
 * P10 "Small Light" (hope). Darkness. A spark at a wick, gone. Another: a flame kindles, gutters down to almost
 * nothing, holds there, and then takes. Its light blooms outward and finds what was there all along: a candle, a
 * table edge. The loop is the flame breathing in a very large dark.
 */
import { MOODS } from '../../art/moods';
import { catmullRom, ellipsePoints } from '../../core/geometry';
import { drawGroup, type StrokeGroup } from '../../core/ink';
import { boilStep } from '../../core/loop';
import { clamp, type Vec2 } from '../../core/math';
import { loopNoise } from '../../core/random';
import type { Scene } from '../../core/scene';
import { drawStroke, prepareStroke, type StrokeStyle } from '../../core/stroke';
import { clip, track } from '../../core/track';
import { fillPoly, fit, glow, group, lit, nf, perSize, stock, withAlpha } from './common';

const M = MOODS.ember;
const FLAME = M.inks[0]!, CORE = M.accents[1]!;
const CHALK: StrokeStyle = { color: M.chalk, size: 4, thinning: 0.6, wobble: 1.8, wobbleWavelength: 170, tremor: 0.45, pressureVariation: 0.55, dryBrush: 0.35, paper: M.paper, taperStart: 26, taperEnd: 34 };

/** Storyboard in drawn frames (12 fps). */
const F = { spark: [24, 30], kindle: 40, loopFrom: 132 } as const;
const LOOP = 48;

/** Flame size: kindles, gutters to almost nothing, holds, then takes (one frame of overshoot as it catches). */
const size = track([
  { frame: F.kindle, value: 0 }, { frame: 46, value: 0.32, ease: 'out' }, { frame: 56, value: 0.36 },
  { frame: 66, value: 0.13 }, { frame: 72, value: 0.09 }, { frame: 80, value: 0.12 },
  { frame: 96, value: 0.9, ease: 'inOut' }, { frame: 102, value: 1.05, ease: 'out' }, { frame: 114, value: 1 },
]);
/** Reach of the light: slower than the flame, as eyes adjust. */
const reach = track([
  { frame: F.kindle, value: 0 }, { frame: 56, value: 150, ease: 'out' }, { frame: 72, value: 70 },
  { frame: 80, value: 80 }, { frame: 124, value: 640, ease: 'inOut' },
]);

const WICK: Vec2 = [540, 548];

interface Layout { P(x: number, y: number): Vec2; s: number; candle: StrokeGroup }

const layout = perSize((w, h): Layout => {
  const { P, s } = fit(w, h, 1080, 1080);
  const top = 572, bottom = 866, rx = 96;
  const map = (pts: readonly Vec2[]) => pts.map(([x, y]) => P(x, y));
  const rim = ellipsePoints(540, top, rx, 17, { turns: 1.04, start: Math.PI, n: 80 });
  const pool = ellipsePoints(540, top + 3, 62, 9, { turns: 0.98, start: Math.PI * 0.2, n: 50 });
  const left = catmullRom([[444, top + 2], [446, 700], [444, bottom]], 8);
  const right = catmullRom([[636, top + 2], [634, 690], [637, bottom]], 8);
  const base = ellipsePoints(540, bottom, rx + 1, 17, { turns: 0.5, start: 0, n: 40 });
  const drip = catmullRom([[604, top + 13], [609, 612], [606, 640], [612, 652], [616, 628], [616, top + 11]], 6);
  const wick = catmullRom([[540, top - 2], [538, 562], [542, WICK[1]]], 4);
  const table = catmullRom([[40, bottom + 4], [320, bottom + 1], [760, bottom + 3], [1040, bottom]], 10);
  return {
    P, s,
    candle: group([table, base, left, right, rim, pool, drip, wick].map(map), { ...CHALK, size: CHALK.size * s }, 1001),  };
});

/** A teardrop flame standing on `base`, `lean` tipping it sideways, as a closed outline. */
function flamePath(x: number, base: number, sz: number, lean: number, stretch: number): Vec2[] {
  const h = 124 * sz * stretch, r = 22 * sz;
  const tip: Vec2 = [x + lean * h, base - h];
  return catmullRom([
    tip, [x + r * 0.72 + lean * h * 0.35, base - h * 0.48], [x + r, base - r * 1.05], [x + r * 0.6, base - r * 0.18], [x, base + r * 0.05],
    [x - r * 0.6, base - r * 0.18], [x - r, base - r * 1.05], [x - r * 0.72 + lean * h * 0.35, base - h * 0.48], tip,
  ], 8);
}

/** Flicker, periodic over the loop and continuous into it: a function of the frame modulo the loop from `loopFrom`. */
function flicker(n: number): { lean: number; stretch: number; breath: number } {
  const phase = (((n - F.loopFrom) % LOOP) + LOOP) % LOOP / LOOP, amp = clip(n, 96, F.loopFrom - 96);
  return {
    lean: amp * 0.16 * loopNoise(phase, 1011, 1.3),
    stretch: 1 + amp * 0.16 * loopNoise(phase, 1012, 1.8),
    breath: 1 + amp * 0.06 * loopNoise(phase, 1013, 0.9),
  };
}

export const smallLightScene: Scene = {
  name: 'small-light',
  duration: (F.loopFrom + LOOP) / 12,
  loopFrom: F.loopFrom / 12,
  poster: (F.loopFrom + 12) / 12,
  draw(f) {
    const { ctx, stage } = f;
    const L = layout(stage.w, stage.h), n = nf(f);
    stock(f, M.paper, { seed: 101, texture: 0.8, vignette: 0.55, vignetteColor: '#000000' });
    const [wx, wy] = L.P(...WICK);
    const sz = size(n), fl = flicker(n);
    const cy = wy - 50 * L.s * sz;

    // the light and what it finds: the candle drawn all along, visible only as far as the light reaches
    const R = reach(n) * L.s * fl.breath;
    if (R > 0) {
      glow(f, wx, cy, R * 0.95, FLAME, clamp(sz, 0, 1) * 0.6, { cell: 9, falloff: 3.2, density: 0.72, bloom: 0.3, seed: 1021 });
      withAlpha(ctx, clamp(sz * 1.4, 0, 1), () => lit(f, 'small-light', wx, cy, R, g => drawGroup(g, L.candle, [], boilStep(f, { hold: 4, variants: 4 }))));
    }

    // the first spark: a glint that does not take
    const spark = clip(n, F.spark[0], 1) * (1 - clip(n, F.spark[0] + 2, F.spark[1] - F.spark[0] - 2));
    if (spark > 0) {
      glow(f, wx, wy - 8 * L.s, 60 * L.s, FLAME, spark * 0.8, { cell: 6, bloom: 0.5, seed: 1031 });
      const r = 16 * L.s * spark, st: StrokeStyle = { ...CHALK, color: CORE, size: 2.4 * L.s, dryBrush: 0, taperStart: r, taperEnd: r };
      drawStroke(ctx, prepareStroke([[wx - r, wy - 8 * L.s], [wx + r, wy - 8 * L.s]], st, 1032), 1);
      drawStroke(ctx, prepareStroke([[wx, wy - 8 * L.s - r], [wx, wy - 8 * L.s + r]], st, 1033), 1);
    }

    // the flame: an amber body, a pale core, and a light hand-drawn edge
    if (sz > 0.001) {
      const outer = flamePath(wx, wy + 4 * L.s, sz * L.s, fl.lean, fl.stretch);
      const inner = flamePath(wx, wy - 2 * L.s, sz * 0.52 * L.s, fl.lean * 0.6, fl.stretch * 0.9);
      fillPoly(ctx, outer, FLAME, 0.92);
      fillPoly(ctx, inner, CORE, 0.95);
      const edge = prepareStroke(outer, { ...CHALK, color: CORE, size: 2.2 * L.s, wobble: 0.8, tremor: 0.2, dryBrush: 0, alpha: 0.7, taperStart: 10, taperEnd: 10 }, 1041, { closed: true });
      drawStroke(ctx, edge, 1);
    }
  },
};
