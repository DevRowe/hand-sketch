/**
 * P05 "Every Spring" (growth and the turning year). A seed on a ground line. A shoot rises from it and becomes a
 * trunk, and branches grow out of branches (each one morphing from a bud into its full curve, thickening as it goes)
 * until a whole bare tree stands there. The loop is one year of it: blossom, leaf, amber, the letting go of every
 * leaf, snow, and then blossom again.
 */
import { MOODS } from '../../art/moods';
import { plate, printPlate } from '../../art/print';
import { catmullRom, ellipsePoints } from '../../core/geometry';
import { drawGroup, scheduleWithin, type Slot, type StrokeGroup } from '../../core/ink';
import { clamp, TAU, type Vec2 } from '../../core/math';
import { hashSeed, rng } from '../../core/random';
import type { Scene } from '../../core/scene';
import { drawStroke, prepareMorph, prepareStroke, type PreparedStroke, type StrokeStyle } from '../../core/stroke';
import { clip } from '../../core/track';
import { coverage, ease, fillPoly, fit, group, nf, perSize, sec, stock } from './common';

const M = MOODS.grove;
const [BLOSSOM, LEAF, AMBER, RUST] = [M.fills[0]!, M.fills[1]!, M.fills[2]!, M.fills[3]!];
const SNOW = '#fbfaf4', WINTER = '#dfe3e2';
const BRANCH: StrokeStyle = { color: M.ink, size: 4, thinning: 0.5, wobble: 1.2, wobbleWavelength: 140, tremor: 0.3, pressureVariation: 0.45, dryBrush: 0.3, paper: M.paper, taperStart: 0, taperEnd: 40 };
const SIZES = [18, 11, 7, 4.6, 3, 2] as const;

/** Storyboard in drawn frames (12 fps); growth windows by branch depth. */
const F = { ground: [0, 16], seed: [8, 16], loopFrom: 132 } as const;
const GROW: readonly (readonly [number, number])[] = [[18, 50], [42, 70], [60, 86], [76, 100], [88, 112], [98, 122]];
const DEPTH = GROW.length - 1;
const LOOP = 144;
const GROUND = 900;

interface Branch { d: number; path: Vec2[]; start: number; end: number; tip: Vec2 }

/**
 * A deterministic tree: each branch a gently bent curve leaning back towards the light, the trunk splitting in
 * three and the rest in two. A branch starts growing only once its parent has nearly reached the fork.
 */
function growTree(): Branch[] {
  const r = rng(5003), out: Branch[] = [];
  const add = (from: Vec2, angle: number, len: number, d: number, after: number) => {
    const bend = (r() - 0.5) * 0.5, pts: Vec2[] = [from];
    for (let k = 1; k <= 3; k++) {
      const a = angle + (bend * k) / 3, p = pts[k - 1]!;
      pts.push([p[0] + (Math.cos(a) * len) / 3, p[1] + (Math.sin(a) * len) / 3]);
    }
    const [g0, g1] = GROW[d]!, start = Math.max(g0 + r() * 4, after - 3), end = Math.max(g1 + r() * 4, start + 12);
    out.push({ d, path: catmullRom(pts, 6), start, end, tip: pts[3]! });
    if (d >= DEPTH) return;
    const spreads = d === 0 ? [-0.58, 0.04, 0.56] : [-(0.26 + r() * 0.24), 0.26 + r() * 0.24];
    for (const sp of spreads) {
      let a = angle + bend + sp + (r() - 0.5) * 0.12;
      a = clamp(a + (-Math.PI / 2 - a) * 0.14, -Math.PI + 0.25, -0.25);
      add(pts[3]!, a, len * (d === 0 ? 0.7 : 0.74) * (0.88 + r() * 0.24), d + 1, end);
    }
  };
  add([540, GROUND + 4], -Math.PI / 2 + 0.03, 236, 0, 0);
  return out;
}
const TREE = growTree();

/** One year, as phase 0..1 of the loop. Everything is back to the bare tree at both ends. */
function season(p: number) {
  const foliage = ease(clip(p, 0.02, 0.1)) * 0.55 + ease(clip(p, 0.14, 0.14)) * 0.45 - ease(clip(p, 0.62, 0.18));
  const leaf = ease(clip(p, 0.14, 0.12)), turn = ease(clip(p, 0.56, 0.08)), rust = ease(clip(p, 0.64, 0.1));
  const inks: [string, number][] = [[BLOSSOM, 1 - leaf], [LEAF, leaf * (1 - turn)], [AMBER, turn * (1 - rust)], [RUST, rust]];
  return {
    foliage: clamp(foliage, 0, 1), inks,
    density: 0.6 + 0.08 * ease(clip(p, 0.14, 0.14)),
    winter: ease(clip(p, 0.78, 0.08)) * (1 - ease(clip(p, 0.93, 0.07))),
    snowfall: clip(p, 0.78, 0.2),
    drift: ease(clip(p, 0.84, 0.08)) * (1 - ease(clip(p, 0.92, 0.08))),
  };
}

interface Layout {
  P(x: number, y: number): Vec2; s: number;
  ground: StrokeGroup; groundSlots: Slot[];
  seed: StrokeGroup; seedSlots: Slot[];
  branches: { b: Branch; morph: (t: number) => PreparedStroke; grown: PreparedStroke }[];
  clusters: { x: number; y: number; r: number }[];
  leaves: { x: number; y: number; fall: number; sway: number; spin: number; land: number; color: string; shape: PreparedStroke }[];
  flakes: { x: number; y: number; r: number; speed: number }[];
}

const layout = perSize((w, h): Layout => {
  const { P, s } = fit(w, h, 1080, 1080);
  const map = (pts: readonly Vec2[]) => pts.map(([x, y]) => P(x, y));
  const ground = group([map(catmullRom([[40, GROUND + 2], [300, GROUND - 2], [540, GROUND + 3], [800, GROUND], [1040, GROUND + 2]], 10))], { ...BRANCH, size: 3.2 * s, taperStart: 90, taperEnd: 90 }, 5002);
  const seed = group([map(ellipsePoints(540, GROUND - 7, 12, 7, { turns: 1.05, n: 30 }))], { ...BRANCH, size: 2.8 * s, taperStart: 6, taperEnd: 6 }, 5003);
  const branches = TREE.map((b, k) => {
    const full = map(b.path), [bx, by] = full[0]!;
    const bud = full.map(([x, y]): Vec2 => [bx + (x - bx) * 0.04, by + (y - by) * 0.04]);
    const style = { ...BRANCH, size: SIZES[b.d]! * s, taperEnd: (16 + 18 * (DEPTH - b.d)) * s };
    return { b, morph: prepareMorph(bud, full, style, hashSeed(5100, k)), grown: prepareStroke(full, style, hashSeed(5100, k)) };
  });
  const r = rng(5200);
  const clusters = TREE.filter(b => b.d >= DEPTH - 1).map(b => {
    const [x, y] = P(...b.tip);
    return { x, y, r: (b.d === DEPTH ? 44 : 58) * s * (0.85 + r() * 0.3) };
  });
  const leafShape = [0, 1, 2].map(k => prepareStroke(catmullRom([[-9, 0], [-3, -4], [6, -2], [10, 0], [4, 3], [-4, 3], [-9, 0]], 3), { ...BRANCH, size: 2.2, taperStart: 2, taperEnd: 2, dryBrush: 0 }, 5300 + k));
  const leaves = clusters.flatMap((c, k) => [0, 1, 2].map(j => ({
    x: c.x + (r() - 0.5) * c.r * 1.2, y: c.y + (r() - 0.5) * c.r * 0.8,
    fall: 0.6 + r() * 0.2, sway: (r() - 0.5) * 120 * s, spin: (r() - 0.5) * 8,
    land: P(0, GROUND - 4 - r() * 10)[1], color: (k + j) % 3 === 0 ? RUST : AMBER, shape: leafShape[(k + j) % 3]!,
  })));
  const flakes = Array.from({ length: 80 }, () => ({ x: r() * w, y: r() * h, r: (2 + r() * 2.8) * s, speed: 0.8 + r() * 0.5 }));
  return {
    P, s, ground, groundSlots: scheduleWithin(ground, sec(F.ground[0]), sec(F.ground[1])),
    seed, seedSlots: scheduleWithin(seed, sec(F.seed[0]), sec(F.seed[1])),
    branches, clusters, leaves, flakes,
  };
});

export const everySpringScene: Scene = {
  name: 'every-spring',
  duration: (F.loopFrom + LOOP) / 12,
  loopFrom: F.loopFrom / 12,
  poster: (F.loopFrom + Math.round(LOOP * 0.7)) / 12,
  draw(f) {
    const { ctx, stage } = f;
    const L = layout(stage.w, stage.h), n = nf(f), s = L.s;
    const p = f.loopPhase === null ? -1 : (Math.round(f.loopPhase * LOOP * 1e6) / 1e6 % LOOP) / LOOP;
    const S = p < 0 ? null : season(p);
    stock(f, M.paper, { seed: 51, vignette: 0.2, vignetteColor: M.ink });
    if (S && S.winter > 0) fillPoly(ctx, [[0, 0], [stage.w, 0], [stage.w, stage.h], [0, stage.h]], WINTER, S.winter * 0.45);

    // foliage: soft clusters on a plate, printed as dots in the season's ink
    if (S && S.foliage > 0) {
      const pl = plate(stage, 'every-spring');
      pl.ctx.globalCompositeOperation = 'multiply';
      for (const c of L.clusters) {
        const r = c.r * (0.35 + 0.65 * S.foliage);
        const g = pl.ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, r);
        g.addColorStop(0, coverage(S.density * Math.min(1, S.foliage * 1.4)));
        g.addColorStop(0.7, coverage(S.density * 0.6 * S.foliage));
        g.addColorStop(1, coverage(0));
        pl.ctx.fillStyle = g;
        pl.ctx.fillRect(c.x - r, c.y - r, r * 2, r * 2);
      }
      pl.ctx.globalCompositeOperation = 'source-over';
      // one plate, printed once per season ink by its share: a turn of season is two screens of dots mingling
      S.inks.forEach(([ink, share], k) => {
        if (share > 0.01) printPlate(ctx, stage, pl.canvas, { ink, gain: share, cell: 7, angle: 0.4 + k * 0.33, seed: 5401 + k, alpha: 0.92, maxCoverage: 0.85 * share });
      });
    }

    // the ground, the seed, and the tree growing out of it, thicker as each branch grows
    drawGroup(f, L.ground, L.groundSlots);
    ctx.save();
    ctx.globalAlpha *= 1 - clip(n, 30, 20);
    drawGroup(f, L.seed, L.seedSlots);
    ctx.restore();
    for (const { b, morph, grown } of L.branches) {
      const t = ease(clip(n, b.start, b.end - b.start));
      if (t <= 0) continue;
      if (t >= 1) { drawStroke(ctx, grown, 1); continue; }
      const st = morph(t);
      drawStroke(ctx, { ...st, style: { ...st.style, size: st.style.size * (0.35 + 0.65 * t) } }, 1);
    }

    if (!S) return;
    // autumn: every leaf lets go, drifts down turning, lies on the ground a while
    for (const lf of L.leaves) {
      const u = clip(p, lf.fall, 0.12);
      if (u <= 0 || p > 0.93) continue;
      const y = lf.y + (lf.land - lf.y) * ease(u), x = lf.x + lf.sway * Math.sin(u * Math.PI * 1.5);
      ctx.save();
      ctx.globalAlpha *= clip(p, lf.fall - 0.02, 0.02) * (1 - clip(p, 0.86, 0.06));
      ctx.translate(x, y);
      ctx.rotate(lf.spin * u);
      ctx.scale(s * 1.4, s * 1.4 * (0.4 + 0.6 * Math.abs(Math.cos(u * 9))));
      fillPoly(ctx, lf.shape.points, lf.color, 0.95);
      ctx.restore();
    }

    // winter: snow falls, settles in a thin drift along the ground, and melts back into spring
    if (S.winter > 0) {
      ctx.save();
      ctx.fillStyle = SNOW;
      ctx.beginPath();
      for (const fl of L.flakes) {
        const y = (fl.y + (p - 0.78) * fl.speed * stage.h * 2.2) % stage.h, a = fl.x + Math.sin(y / (60 * s) + fl.r) * 14 * s;
        ctx.moveTo(a + fl.r, y);
        ctx.arc(a, y, fl.r, 0, TAU);
      }
      ctx.globalAlpha = Math.min(S.winter, 1 - S.snowfall ** 4);
      ctx.fill();
      ctx.restore();
      if (S.drift > 0) {
        const [, gy] = L.P(0, GROUND);
        const top = catmullRom([[-20, 0], [200, -10], [420, -5], [540, -14], [700, -6], [900, -11], [1100, -2]], 8).map(([x, y]): Vec2 => [L.P(x, 0)[0], gy + y * s * S.drift - 2 * s]);
        fillPoly(ctx, [...top, [stage.w, gy + 3 * s], [0, gy + 3 * s]], SNOW, 0.95 * S.drift);
      }
    }
  },
};
