/**
 * G06 "Murmuration" (creatures; stipple). Dusk over a reed bed, drawn entirely in dots of ink: the sky's gradient,
 * the low sun, the far tree line and the reeds are stippled once and held. Over them a flock of sixteen hundred
 * starlings, one dot each, pours itself through shapes: it stretches, folds, thins into a ribbon, throws off a wing of
 * birds that comes back, while waves of density run through it.
 *
 * Every bird is a fixed point of a unit flock mapped through a shape that changes with the loop phase (centre path,
 * size, turn, a travelling compression wave and a fold), plus its own periodic jitter: whole cycles, so the seam holds.
 */
import { clamp, lerp, TAU, type Vec2 } from '../../core/math';
import { loopNoise, noise1, noise2, rng } from '../../core/random';
import type { Scene } from '../../core/scene';
import { fit, ground, perSize, phase, still, stipple, swell, wave, wrap, type Fit } from './common';
import { GALLERY } from './palettes';

const PAL = GALLERY.stipple;
const INK = PAL.ink, ROSE = PAL.fills[0]!, SAND = PAL.fills[1]!;
const W = 1920, H = 1080, HORIZON = 940;
const SUN: Vec2 = [1330, 800];
const LOOP = 192;

interface Bird { a: number; b: number; z: number; seed: number }
const BIRDS: Bird[] = (() => {
  const r = rng(6060), g = () => r() + r() - 1;
  return Array.from({ length: 2600 }, (_, k) => ({ a: g(), b: g() * 0.8, z: r(), seed: 6100 + k }));
})();

const layout = perSize((w, h): { F: Fit } => ({ F: fit(w, h, W, H) }));

/** The flock's shape at loop phase p, mapping unit-flock coordinates to design space. */
function flockAt(p: number): (bird: Bird) => Vec2 {
  const cx = 900 + 300 * wave(p, 1) + 90 * wave(p, 2, 0.3);
  const cy = 430 + 80 * wave(p, 2, 0.15) + 40 * wave(p, 3, 0.6);
  const A = 340 + 130 * wave(p, 1, 0.1) + 60 * wave(p, 3, 0.4);
  const B = 120 + 60 * wave(p, 2, 0.35);
  const turn = 0.35 * wave(p, 1, 0.2) + 0.15 * wave(p, 3);
  const fold = 90 * wave(p, 2, 0.05);
  const peel = swell(p, 1, 0.55);
  const c = Math.cos(turn), s = Math.sin(turn);
  return bird => {
    // a compression wave travelling along the flock: birds bunch into dark bands and spread again
    const a = bird.a + 0.13 * Math.sin(TAU * (p * 3 - bird.a * 0.9));
    let x = a * A * 2.1, y = bird.b * B * 2.1 * (1 - 0.3 * a * a);
    // the flock folds over itself like a ribbon
    y += fold * Math.sin(a * 2.2 + TAU * p);
    // a wing of birds peels away from the top edge and returns
    if (bird.b > 0.35) { const k = (bird.b - 0.35) * peel; x += k * 260 * (a + 0.4); y -= k * 420; }
    const jx = loopNoise(p, bird.seed, 1.6) * 12, jy = loopNoise(p, bird.seed + 1, 1.6) * 9;
    return [cx + x * c - y * s + jx, cy + x * s + y * c + jy];
  };
}

export const murmurationScene: Scene = {
  name: 'murmuration',
  duration: LOOP / 12,
  loopFrom: 0,
  poster: 70 / 12,
  draw(f) {
    const { ctx, stage } = f;
    const { F } = layout(stage.w, stage.h), p = phase(f), [ox, oy] = F.P(0, 0), s = F.s;
    ground(f, PAL.paper, { seed: 606, texture: 0.7 });

    // the held world: every tone a density of dots
    still(f, 'g06-world', g => {
      const c = g.ctx;
      c.translate(ox, oy);
      c.scale(s, s);
      const box: [number, number, number, number] = [0, 0, W, H];
      // the sun's rose light, low and wide
      stipple(c, box, 420000, (x, y) => {
        const d = Math.hypot((x - SUN[0]) / 1.8, y - SUN[1]);
        return y > HORIZON ? 0 : clamp(0.45 * Math.pow(Math.max(0, 1 - d / 700), 1.6) + (Math.hypot(x - SUN[0], y - SUN[1]) < 58 ? 0.6 : 0), 0, 1);
      }, { color: ROSE, size: 1.5, seed: 6061 });
      stipple(c, box, 160000, (x, y) => (y > HORIZON ? 0 : 0.28 * Math.pow(Math.max(0, 1 - Math.hypot((x - SUN[0]) / 2.2, y - SUN[1]) / 900), 1.2)), { color: SAND, size: 1.5, seed: 6062 });
      // dusk from above, with long streaks of cloud
      stipple(c, box, 520000, (x, y) => {
        if (y > HORIZON) return 0;
        const sky = 0.16 * Math.pow(1 - y / HORIZON, 1.6) - 0.06 * Math.max(0, 1 - Math.hypot((x - SUN[0]) / 2, y - SUN[1]) / 500);
        const cloud = Math.max(0, noise2(x / 760, y / 20, 6063) - 0.14) * 0.36 * (y < 620 ? 1 : 0.25);
        return clamp(sky + cloud, 0, 1);
      }, { color: INK, size: 1.3, seed: 6064 });
      // far tree line and the reed bed, dense
      const treeTop = (x: number) => HORIZON - 26 - Math.max(0, noise1(x / 90, 6065) * 70 + noise1(x / 22, 6066) * 14) - (x > 300 && x < 700 ? 40 * Math.sin(((x - 300) / 400) * Math.PI) : 0);
      stipple(c, [0, HORIZON - 150, W, 190], 260000, (x, y) => (y > treeTop(x) ? 0.8 : 0), { color: INK, size: 1.5, seed: 6067 });
      stipple(c, [0, HORIZON, W, H - HORIZON], 420000, (x, y) => clamp(0.42 + (y - HORIZON) / 420 + noise2(x / 60, y / 14, 6068) * 0.45, 0, 0.9), { color: INK, size: 1.6, seed: 6069 });
      // reeds standing out of the bed, each a string of dots
      const r = rng(6070);
      c.fillStyle = INK;
      for (let k = 0; k < 140; k++) {
        const x = r() * W, top = HORIZON - 30 - r() * 150, lean = (r() - 0.5) * 40;
        c.beginPath();
        for (let y = HORIZON + 30; y > top; y -= 3.2) {
          const u = (HORIZON + 30 - y) / (HORIZON + 30 - top), px = x + lean * u * u + (r() - 0.5) * 1.6;
          c.moveTo(px + 1.5, y);
          c.arc(px, y, 1.1 + r() * 0.6, 0, TAU);
        }
        // plume
        if (r() < 0.5) for (let j = 0; j < 40; j++) { const py = top + r() * 30, px = x + lean + (r() - 0.5) * 10; c.moveTo(px + 1.6, py); c.arc(px, py, 1 + r(), 0, TAU); }
        c.fill();
      }
    });

    // the flock: one dot a bird, farther birds smaller
    const at = flockAt(p);
    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(s, s);
    ctx.fillStyle = INK;
    ctx.beginPath();
    for (const bird of BIRDS) {
      const [x, y] = at(bird), rad = lerp(1.3, 2.7, bird.z);
      ctx.moveTo(x + rad, y);
      ctx.arc(x, y, rad, 0, TAU);
    }
    ctx.fill();

    // three stragglers close by, flapping hard to catch up: one lap of the frame per loop
    for (let k = 0; k < 3; k++) {
      const u = wrap(p + k / 3, 1), x = lerp(-120, W + 120, u), y = 610 + k * 70 + 30 * wave(p, 3, k * 0.2);
      const flap = Math.sin(TAU * (p * 48 + k * 0.3));
      ctx.save();
      ctx.translate(x, y);
      ctx.fillStyle = INK;
      ctx.beginPath();
      // wings as dot strings: a bird still made of stipple
      for (const side of [-1, 1]) {
        for (let j = 0; j <= 7; j++) {
          const t = j / 7, wx = side * t * 26, wy = -flap * 12 * t * t + t * 3;
          ctx.moveTo(wx + 1.9, wy);
          ctx.arc(wx, wy, 1.9 - t * 0.6, 0, TAU);
        }
      }
      ctx.moveTo(3.2, 1);
      ctx.arc(0, 1, 3.2, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  },
};
