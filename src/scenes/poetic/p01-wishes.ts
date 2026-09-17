/**
 * P01 "Wishes" (wonder). Evening. A dandelion stem is drawn and its clock of seeds opens around the head. A breath of
 * wind crosses it, and the seeds let go, the far side first, and drift up as the paper darkens into night. As each
 * one comes to rest high up, its little parachute unfolds (morphs) into a star. One seed stays behind on the stem.
 * The loop is the stars twinkling over the last seed, which sways and does not go.
 */
import { MOODS } from '../../art/moods';
import { mix } from '../../art/color';
import { catmullRom } from '../../core/geometry';
import { clamp, easeIn, lerp, TAU, type Vec2 } from '../../core/math';
import { loopNoise, rng } from '../../core/random';
import type { Scene, SceneFrame } from '../../core/scene';
import { drawStroke, drawStrokeRange, prepareMorph, prepareStroke, type PreparedStroke, type StrokeStyle } from '../../core/stroke';
import { clip } from '../../core/track';
import { ease, fit, glow, nf, perSize, stock, withAlpha } from './common';

const M = MOODS.dusk;
const STAR = M.accents[0]!, DUSK_GOLD = '#d4a043';
const STEM: StrokeStyle = { color: M.ink, size: 5, thinning: 0.55, wobble: 1.6, wobbleWavelength: 200, tremor: 0.35, pressureVariation: 0.5, dryBrush: 0.2, paper: M.paper, taperStart: 30, taperEnd: 20 };
const FIBRE: StrokeStyle = { color: M.ink, size: 1.9, thinning: 0.4, wobble: 0.5, wobbleWavelength: 60, tremor: 0.15, pressureVariation: 0.3, taperStart: 4, taperEnd: 6 };

/** Storyboard in drawn frames (12 fps). */
const F = { stem: [4, 34], head: [26, 58], breath: [66, 88], release: [84, 124], flight: 58, night: [92, 72], loopFrom: 198 } as const;
const LOOP = 72;

const HEAD: Vec2 = [430, 760];
const STALK = 70;
/** The seed that stays. */
const STAYS = 22;

interface Seed { angle: number; reach: number; release: number; target: Vec2; bend: number }

const SEEDS: Seed[] = (() => {
  const r = rng(1101), seeds: Seed[] = [];
  const outer = 34, inner = 18;
  for (let k = 0; k < outer + inner; k++) {
    const ring = k < outer ? 0 : 1, count = ring ? inner : outer;
    const angle = ((ring ? k - outer + 0.5 : k) / count) * TAU + (r() - 0.5) * 0.08;
    seeds.push({ angle, reach: ring ? 0.62 + r() * 0.1 : 0.92 + r() * 0.12, release: 0, target: [0, 0], bend: (r() - 0.5) * 2 });
  }
  // the far (right) side lets go first; targets are spread over the sky on a jittered grid
  const order = seeds.map((sd, k) => ({ k, key: -Math.cos(sd.angle) + (r() - 0.5) * 0.6 })).sort((a, b) => a.key - b.key);
  // one seed per cell of a loose grid over the sky, cells nearer the top more likely, so the stars thin out downward
  const cols = 9, rows = 9;
  const shuffled = Array.from({ length: cols * rows }, (_, c) => ({ c, key: r() * (1 + Math.floor(c / cols) * 0.3) })).sort((a, b) => a.key - b.key).map(e => e.c);
  order.forEach(({ k }, rank) => {
    const sd = seeds[k]!;
    sd.release = F.release[0] + (rank / (seeds.length - 1)) * (F.release[1] - F.release[0]);
    const cell = shuffled[rank]!, cx = cell % cols, cy = Math.floor(cell / cols);
    sd.target = [40 + (cx + 0.05 + r() * 0.9) * (1000 / cols), 50 + (cy + 0.05 + r() * 0.9) * (700 / rows)];
  });
  return seeds;
})();

/** Seed lines in the seed's own units, hub at the origin, stalk hanging down: stalk first, then the parachute fan. */
function seedLines(variant: number): Vec2[][] {
  const r = rng(1200 + variant);
  const rays = Array.from({ length: 7 }, (_, i): Vec2[] => {
    const a = -Math.PI / 2 + (i - 3) * 0.33 + (r() - 0.5) * 0.1, len = 20 + r() * 6;
    return catmullRom([[0, 0], [Math.cos(a) * len * 0.5 + (r() - 0.5) * 2, Math.sin(a) * len * 0.5], [Math.cos(a) * len, Math.sin(a) * len - 3]], 3);
  });
  return [[[0, 0], [0.6, STALK * 0.5], [0, STALK]], ...rays];
}
/** Star lines, same hub: the stalk becomes the lower long ray, the fan opens round into the other seven. */
function starLines(): Vec2[][] {
  const ray = (j: number): Vec2[] => {
    const a = -Math.PI / 2 + (j * Math.PI) / 4, len = j % 2 === 0 ? 30 : 12;
    return [[Math.cos(a) * 3, Math.sin(a) * 3], [Math.cos(a) * len, Math.sin(a) * len]];
  };
  return [4, 5, 6, 7, 0, 1, 2, 3].map(ray);
}

interface Layout {
  P(x: number, y: number): Vec2; s: number;
  stem: PreparedStroke;
  seeds: { rest: PreparedStroke[]; morph: ((t: number) => PreparedStroke)[] }[];
  breaths: PreparedStroke[];
}

const layout = perSize((w, h): Layout => {
  const { P, s } = fit(w, h, 1080, 1350);
  const stem = prepareStroke(catmullRom([[520, 1420], [500, 1220], [446, 1010], [424, 890], [430, HEAD[1] + 18]], 10).map(([x, y]) => P(x, y)), { ...STEM, size: STEM.size * s }, 1301);
  const stars = starLines();
  const seeds = [0, 1, 2].map(v => {
    const lines = seedLines(v);
    return {
      rest: lines.map((l, i) => prepareStroke(l, FIBRE, 1400 + v * 10 + i)),
      morph: lines.map((l, i) => prepareMorph(l, stars[i]!, FIBRE, 1400 + v * 10 + i)),
    };
  });
  const breaths = [0, 1, 2].map(k => prepareStroke(catmullRom([[-40, 700 + k * 50], [200, 690 + k * 40], [420, 700 + k * 36], [700, 660 + k * 30], [1120, 560 + k * 40]], 10).map(([x, y]) => P(x, y)), { ...STEM, size: 2.4 * s, alpha: 0.45, taperStart: 120, taperEnd: 120, dryBrush: 0 }, 1500 + k));
  return { P, s, stem, seeds, breaths };
});

const bezier = (a: Vec2, b: Vec2, c: Vec2, d: Vec2, t: number): Vec2 => {
  const u = 1 - t;
  return [u * u * u * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t * t * t * d[0], u * u * u * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t * t * t * d[1]];
};

function drawSeed(f: SceneFrame, L: Layout, k: number, pose: { x: number; y: number; rot: number; scale: number }, color: string, o: { drawn?: number; star?: number; alpha?: number } = {}): void {
  const { ctx } = f, v = L.seeds[k % 3]!, star = o.star ?? 0, drawn = o.drawn ?? 1;
  ctx.save();
  ctx.translate(pose.x, pose.y);
  ctx.rotate(pose.rot);
  ctx.scale(pose.scale, pose.scale);
  ctx.globalAlpha *= o.alpha ?? 1;
  // the seed body at the end of the stalk: it falls away as the star opens
  const body = 1 - clamp(star * 3, 0, 1);
  if (body > 0 && drawn > 0.3) {
    ctx.save();
    ctx.globalAlpha *= body;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(0, STALK + 3, 2.2, 5, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
  if (star <= 0) {
    // the stalk, then the fan, drawn outward from the head
    v.rest.forEach((st, i) => drawStroke(ctx, { ...st, style: { ...st.style, color } }, i === 0 ? drawn * 1.6 : clamp(drawn * 1.6 - 0.6, 0, 1)));
  } else {
    const size = lerp(FIBRE.size, 3.4, star);
    v.morph.forEach(m => {
      const st = m(ease(star));
      drawStroke(ctx, { ...st, style: { ...st.style, color, size } }, 1);
    });
  }
  ctx.restore();
}

export const wishesScene: Scene = {
  name: 'wishes',
  duration: (F.loopFrom + LOOP) / 12,
  loopFrom: F.loopFrom / 12,
  poster: (F.loopFrom + 10) / 12,
  draw(f) {
    const { ctx, stage } = f;
    const L = layout(stage.w, stage.h), n = nf(f), s = L.s;
    const phase = ((((n - F.loopFrom) % LOOP) + LOOP) % LOOP) / LOOP;
    const night = ease(clip(n, F.night[0], F.night[1]));
    stock(f, M.paper, { seed: 12, vignette: 0.22, vignetteColor: M.ink });
    withAlpha(ctx, night, () => stock(f, M.night, { seed: 13, texture: 0.8, vignette: 0.5, vignetteColor: '#000000' }));
    // the line has to cross the paper's brightness as dusk falls; it does so as warm gold against the cooling grey, so
    // it never vanishes into the page (and the seeds catch the last light as they rise)
    const ink = night < 0.5 ? mix(M.ink, DUSK_GOLD, ease(night * 2)) : mix(DUSK_GOLD, M.chalk, ease(night * 2 - 1));
    const [hx, hy] = L.P(...HEAD);

    // the breath of wind across the head
    L.breaths.forEach((b, k) => {
      const u = clip(n, F.breath[0] + k * 3, F.breath[1] - F.breath[0]);
      if (u > 0 && u < 1) drawStrokeRange(ctx, b, Math.max(0, easeIn(u) * 1.4 - 0.45), Math.min(1, ease(u) * 1.3));
    });

    drawStroke(ctx, { ...L.stem, style: { ...L.stem.style, color: ink } }, ease(clip(n, F.stem[0], F.stem[1] - F.stem[0])));
    // the bare head the seeds grow from, seen once they have gone
    const receptacle = clip(n, F.stem[1] - 4, 8);
    if (receptacle > 0) {
      ctx.save();
      ctx.globalAlpha *= receptacle * 0.9;
      ctx.fillStyle = ink;
      ctx.beginPath();
      ctx.ellipse(hx, hy + 9 * s, 9 * s, 9 * s, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }

    SEEDS.forEach((sd, k) => {
      const rest: Vec2 = [hx + Math.cos(sd.angle) * (STALK + 14) * sd.reach * s, hy + Math.sin(sd.angle) * (STALK + 14) * sd.reach * s];
      const restRot = sd.angle + Math.PI / 2, scale = s * sd.reach;
      const drawn = clip(n, F.head[0] + (k % 34) * 0.7, 14);
      if (drawn <= 0) return;
      const u = k === STAYS ? 0 : clip(n, sd.release, F.flight);
      if (u <= 0) {
        // on the head; in the loop the seed that stays sways a little
        const sway = k === STAYS ? 0.12 * Math.sin(TAU * phase) * clip(n, F.release[1], 20) : 0;
        drawSeed(f, L, k, { x: rest[0], y: rest[1], rot: restRot + sway, scale }, ink, { drawn });
        return;
      }
      // flight: up and away on the wind to its place in the sky, turning upright, unfolding into a star at the end
      const target = L.P(...sd.target);
      const fly = u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2;
      const p = bezier(rest, [rest[0] + 240 * s, rest[1] - 90 * s], [target[0] - 120 * s * sd.bend, target[1] + 260 * s], target, fly);
      const wobble = Math.sin(u * Math.PI * 3 + sd.bend * 3) * 22 * s * (1 - u);
      const rot = lerp(restRot, sd.bend * 0.2, ease(clip(u, 0, 0.25)));
      const star = clip(u, 0.78, 0.22);
      const twinkle = 1 + 0.3 * loopNoise(phase, 1600 + k, 1.2) * clip(n, sd.release + F.flight, 12);
      const scaleNow = lerp(scale, s * (0.55 + 0.25 * ((k * 7) % 5) / 4), ease(u)) * (star > 0 ? lerp(1, twinkle, star) : 1);
      if (star > 0) glow(f, p[0] + wobble, p[1], 46 * s * scaleNow / s, STAR, star * (0.35 + 0.25 * (twinkle - 0.7)), { cell: 5, bloom: 0.5, density: 0.5, seed: 1700 + k });
      drawSeed(f, L, k, { x: p[0] + wobble, y: p[1], rot: star > 0 ? lerp(rot, 0, star) : rot, scale: scaleNow }, star > 0 ? mix(ink, STAR, star) : ink, { star });
    });
  },
};
