/**
 * P03 "Paper Boat" (journeys, letting go). Wide still water under a far shore, first light low on the horizon. Close
 * by, a square of paper is drawn, folded once into a hat and once more into a boat, and set down on the water, where
 * it rocks. Then the current takes it: it drifts out towards the light, smaller and smaller, and does not come back.
 * The loop is the water moving and the boat, very far now, still going.
 */
import { MOODS } from '../../art/moods';
import { plate, printPlate } from '../../art/print';
import { emissions, lifeWindow } from '../../core/emitter';
import { catmullRom, ellipsePoints } from '../../core/geometry';
import { drawGroup, scheduleWithin, type Slot, type StrokeGroup } from '../../core/ink';
import { clamp, TAU, type Vec2 } from '../../core/math';
import { rng } from '../../core/random';
import type { Scene } from '../../core/scene';
import { drawStroke, drawStrokeRange, prepareMorph, prepareStroke, type PreparedStroke, type StrokeStyle } from '../../core/stroke';
import { clip, track } from '../../core/track';
import { coverage, ease, fillPoly, fit, group, nf, perSize, sec, stock } from './common';

const M = MOODS.tide;
const WATER = M.inks[0]!, DAWN = M.blush, BOAT = M.fills[3]!;
const LINE: StrokeStyle = { color: M.ink, size: 3.2, thinning: 0.55, wobble: 1.6, wobbleWavelength: 220, tremor: 0.35, pressureVariation: 0.5, dryBrush: 0.2, paper: M.paper, taperStart: 50, taperEnd: 60 };
const FOLD: StrokeStyle = { color: M.ink, size: 3.4, thinning: 0.45, wobble: 0.8, wobbleWavelength: 160, tremor: 0.25, pressureVariation: 0.35, taperStart: 8, taperEnd: 8 };

/** Storyboard in drawn frames (12 fps). */
const F = { shore: [0, 24], water: [6, 40], dawn: [10, 70], reeds: [16, 34], sheet: [30, 46], hat: [52, 64], boat: [70, 82], crease: [82, 90], down: [90, 100], away: [106, 204], loopFrom: 208 } as const;
const LOOP = 48;
/** Perspective: the horizon, the near water (design y), where the water vanishes, and how fast things shrink. */
const HORIZON = 600, NEAR = 1000, VX = 1080, DEPTH = 6;
/** The boat's course: set down here, carried out to FAR (0 = here, 1 = the horizon). */
const START_X = 700, FAR = 0.92;

const scaleAt = (z: number) => 1 / (1 + z * DEPTH);
/** Design position on the water of a point at depth z that would sit at `x` close by. */
const onWater = (x: number, z: number): Vec2 => {
  const k = scaleAt(z);
  return [VX + (x - VX) * k, HORIZON + (NEAR - HORIZON) * k];
};

// the paper, in its own units around its centre: flat sheet, hat, boat; all closed, all starting bottom left
const SHEET: Vec2[] = [[-112, 58], [-100, -62], [104, -78], [114, 46], [-112, 58]];
const HAT: Vec2[] = [[-112, 50], [-112, 28], [-88, 28], [0, -104], [88, 28], [112, 28], [112, 50], [-112, 50]];
const HULL: Vec2[] = [[-78, 50], [-120, 4], [-44, 4], [0, -96], [44, 4], [120, 4], [78, 50], [-78, 50]];

interface Layout {
  P(x: number, y: number): Vec2; s: number;
  shore: StrokeGroup; shoreSlots: Slot[]; reeds: StrokeGroup; reedSlots: Slot[];
  sheet: PreparedStroke; toHat: (t: number) => PreparedStroke; toBoat: (t: number) => PreparedStroke; boat: PreparedStroke; crease: PreparedStroke;
  ripple: PreparedStroke[]; ring: PreparedStroke;
}

const layout = perSize((w, h): Layout => {
  const { P, s } = fit(w, h, 1920, 1080);
  const map = (pts: readonly Vec2[]) => pts.map(([x, y]) => P(x, y));
  const shore = group([
    map(catmullRom([[-60, HORIZON], [700, HORIZON + 1], [1400, HORIZON - 1], [1980, HORIZON]], 10)),
    map(catmullRom([[-60, HORIZON - 30], [180, HORIZON - 58], [420, HORIZON - 40], [640, HORIZON - 86], [860, HORIZON - 34], [980, HORIZON - 6]], 10)),
    map(catmullRom([[1180, HORIZON - 4], [1360, HORIZON - 46], [1560, HORIZON - 30], [1760, HORIZON - 70], [1980, HORIZON - 40]], 10)),
  ], { ...LINE, size: 2.6 * s, alpha: 0.8, taperStart: 90, taperEnd: 90 }, 3001);
  const r = rng(3002);
  const reeds = group([0, 1, 2, 3, 4].map(k => {
    const x0 = 70 + k * 34 + r() * 16, top = 700 + r() * 150, lean = 40 + r() * 70;
    return map(catmullRom([[x0, 1110], [x0 + lean * 0.2, (1110 + top) / 2], [x0 + lean, top]], 8));
  }), { ...LINE, size: 4.2 * s, taperStart: 10, taperEnd: 140 }, 3003);
  return {
    P, s, shore, shoreSlots: scheduleWithin(shore, sec(F.shore[0]), sec(F.shore[1]), 0.08), reeds, reedSlots: scheduleWithin(reeds, sec(F.reeds[0]), sec(F.reeds[1]), 0.05),
    sheet: prepareStroke(SHEET, FOLD, 3201),
    toHat: prepareMorph(SHEET, HAT, FOLD, 3202),
    toBoat: prepareMorph(HAT, HULL, FOLD, 3203),
    boat: prepareStroke(HULL, FOLD, 3203),
    crease: prepareStroke([[-44, 4], [44, 4]], { ...FOLD, size: 2.4 }, 3204),
    ripple: [0, 1, 2].map(k => prepareStroke(catmullRom([[-46, 0], [-12, -3 - k], [22, -1], [48, 1]], 5), { ...LINE, size: 3.4, taperStart: 26, taperEnd: 26, dryBrush: 0 }, 3300 + k)),
    ring: prepareStroke(ellipsePoints(0, 0, 150, 20, { n: 60 }), { ...LINE, size: 2.6, taperStart: 40, taperEnd: 40, dryBrush: 0 }, 3400, { closed: true }),
  };
});

/** How far out the boat is: near, then carried away, slowly at first and slowly at the end. */
const depth = track([{ frame: F.away[0], value: 0 }, { frame: F.away[1], value: FAR, ease: 'inOut' }]);
/** The paper's height above the water while it is folded, then set down. */
const lift = track([{ frame: F.down[0], value: 140 }, { frame: F.down[1], value: 0, ease: 'inOut' }]);

export const paperBoatScene: Scene = {
  name: 'paper-boat',
  duration: (F.loopFrom + LOOP) / 12,
  loopFrom: F.loopFrom / 12,
  poster: (F.loopFrom + 12) / 12,
  draw(f) {
    const { ctx, stage } = f;
    const L = layout(stage.w, stage.h), n = nf(f), s = L.s;
    const clock = (((n - F.loopFrom) % LOOP) + LOOP) % LOOP;
    stock(f, M.paper, { seed: 31, vignette: 0.18, vignetteColor: M.ink });
    const [, hy] = L.P(0, HORIZON), [vx] = L.P(VX, 0);

    // first light, low on the horizon, and its path across the water; then the water itself, deeper close by
    const dawn = ease(clip(n, F.dawn[0], F.dawn[1] - F.dawn[0])), water = clip(n, F.water[0], F.water[1] - F.water[0]);
    const light = plate(stage, 'paper-boat:dawn');
    const halo = light.ctx.createRadialGradient(vx, hy, 0, vx, hy, 560 * s);
    halo.addColorStop(0, coverage(0.46 * dawn));
    halo.addColorStop(1, coverage(0));
    light.ctx.fillStyle = halo;
    light.ctx.fillRect(0, 0, stage.w, stage.h);
    printPlate(ctx, stage, light.canvas, { ink: DAWN, cell: 7, angle: 0.62, seed: 3502, alpha: 0.8 });
    if (water > 0) {
      const p = plate(stage, 'paper-boat:water');
      const g = p.ctx.createLinearGradient(0, hy, 0, stage.h);
      g.addColorStop(0, coverage(0.06 * water));
      g.addColorStop(1, coverage(0.44 * water));
      p.ctx.fillStyle = g;
      p.ctx.fillRect(0, hy, stage.w, stage.h - hy);
      // the light's path on the water is paler
      const path = p.ctx.createLinearGradient(vx - 260 * s, 0, vx + 260 * s, 0);
      path.addColorStop(0, 'rgba(255,255,255,0)');
      path.addColorStop(0.5, `rgba(255,255,255,${0.7 * dawn})`);
      path.addColorStop(1, 'rgba(255,255,255,0)');
      p.ctx.fillStyle = path;
      p.ctx.beginPath();
      p.ctx.moveTo(vx - 40 * s, hy); p.ctx.lineTo(vx + 40 * s, hy); p.ctx.lineTo(vx + 300 * s, stage.h); p.ctx.lineTo(vx - 300 * s, stage.h);
      p.ctx.fill();
      printPlate(ctx, stage, p.canvas, { ink: WATER, cell: 7, angle: 0.2, seed: 3501, alpha: 0.85 });
    }

    // ripples drifting out with the current, shrinking with distance
    for (const e of emissions(n - F.loopFrom, LOOP, { every: 2, life: 48 })) {
      const rr = rng(3600 + e.index), x0 = rr() * 2600 - 340, z = rr() * 0.3 + e.u * 0.9;
      const k = scaleAt(z), vis = lifeWindow(e.u, 0.25, 0.3) * water * (0.3 + 0.6 * k);
      if (vis <= 0.01) continue;
      const [x, y] = L.P(...onWater(x0, z));
      ctx.save();
      ctx.globalAlpha *= vis;
      ctx.translate(x, y);
      ctx.scale(s * (0.4 + k), s * (0.4 + k));
      drawStroke(ctx, L.ripple[e.index % 3]!, 1);
      ctx.restore();
    }

    drawGroup(f, L.shore, L.shoreSlots);

    // the paper: a sheet, a hat, a boat; it tilts with each fold, then rocks as it floats away
    if (n >= F.sheet[0]) {
      const z = depth(n), k = scaleAt(z);
      const rock = Math.sin((TAU * clock) / 24) * 0.05 * (n >= F.down[0] ? 1 : 0.3), bob = Math.sin((TAU * clock * 2) / LOOP + 1) * 5 * k;
      const [wx, wy] = onWater(START_X, z);
      const [bx, by] = L.P(wx, wy - 50 * k - lift(n) + bob);
      const hat = ease(clip(n, F.hat[0], F.hat[1] - F.hat[0])), boat = ease(clip(n, F.boat[0], F.boat[1] - F.boat[0]));
      const outline = boat >= 1 ? L.boat : boat > 0 ? L.toBoat(boat) : hat > 0 ? L.toHat(hat) : L.sheet;
      const fold = Math.sin(Math.PI * hat) * 0.08 + Math.sin(Math.PI * boat) * 0.08;

      // where it is set down, two rings go out on the water
      const landed = clip(n, F.down[1] - 2, 18);
      if (landed > 0 && landed < 1) {
        for (const d of [0, 0.35]) {
          const u = clamp((landed - d) / (1 - d), 0, 1);
          if (u <= 0) continue;
          ctx.save();
          ctx.globalAlpha *= (1 - u) * 0.8;
          ctx.translate(bx, L.P(0, wy)[1]);
          ctx.scale(s * (0.6 + u * 0.9), s * (0.6 + u * 0.9));
          drawStroke(ctx, L.ring, 1);
          ctx.restore();
        }
      }

      ctx.save();
      ctx.translate(bx, by);
      ctx.rotate(rock + fold);
      ctx.scale(s * k * (1 + fold), s * k * (1 - fold * 0.5));
      if (n >= F.down[1]) fillPoly(ctx, [[-84, 54], [84, 54], [60, 72], [-60, 72]], WATER, 0.3);
      fillPoly(ctx, outline.points, BOAT, 0.96);
      // far away the pen would vanish; keep the boat's line a hair's breadth at least
      const line = { ...outline, style: { ...outline.style, size: outline.style.size / Math.sqrt(k) } };
      drawStroke(ctx, line, ease(clip(n, F.sheet[0], F.sheet[1] - F.sheet[0])));
      const crease = clip(n, F.crease[0], F.crease[1] - F.crease[0]);
      if (crease > 0) drawStrokeRange(ctx, { ...L.crease, style: { ...L.crease.style, size: L.crease.style.size / Math.sqrt(k) } }, 0, crease);
      ctx.restore();
    }

    drawGroup(f, L.reeds, L.reedSlots);
  },
};
