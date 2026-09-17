/**
 * Second demo scene: the same house at night, in chalk on dark stock, with a lit window and twinkling stars.
 * Short, so the sequence proves transitions and scene composition.
 */
import { PALETTES } from '../art/palette';
import { dotScreen } from '../art/finishes';
import { drawPaper } from '../art/paper';
import { drawGroup, scheduleWithin, type Slot, type StrokeGroup } from '../core/ink';
import { ellipsePoints } from '../core/geometry';
import { TAU, window01, type Vec2 } from '../core/math';
import { loopNoise, rng } from '../core/random';
import type { Scene } from '../core/scene';
import { sketch } from '../core/sketch';
import { drawStroke, prepareStroke, type StrokeStyle } from '../core/stroke';
import { houseLayout } from './house';

const PAL = PALETTES.risoPop;
const CHALK: StrokeStyle = { color: PAL.chalk, size: 4.6, thinning: 0.55, wobble: 2.4, tremor: 0.6, pressureVariation: 0.6, dryBrush: 0.55, paper: PAL.night };

interface NightLayout {
  outline: StrokeGroup;
  moon: StrokeGroup;
  slots: { outline: Slot[]; moon: Slot[] };
  stars: { x: number; y: number; r: number; at: number }[];
  window: Vec2[];
}

const layouts = new Map<string, NightLayout>();

function nightLayout(w: number, h: number): NightLayout {
  const key = `${w}x${h}`;
  const hit = layouts.get(key);
  if (hit) return hit;
  const day = houseLayout(w, h), s = day.shapes, cx = w / 2, cy = h / 2;
  const outline: StrokeGroup = {
    style: CHALK, seed: 1201,
    paths: [
      ...sketch.polygon([...s.roof.slice(0, 1), ...s.roof.slice(1, 3)], { seed: 1211, roughness: 1.3 }).outline,
      ...sketch.rectangle(s.body[0]![0], s.body[0]![1], 380, 300, { seed: 1212, roughness: 1.2 }).outline,
      ...sketch.rectangle(s.window[0]![0], s.window[0]![1], 110, 95, { seed: 1213, roughness: 1 }).outline,
      ...sketch.curve([[-40, cy + 262], [w * 0.3, cy + 240], [w * 0.65, cy + 250], [w + 40, cy + 232]], { seed: 1214, roughness: 1.4 }).outline,
    ],
  };
  const mx = cx + Math.min(w * 0.3, 520), my = cy - 290;
  const moon: StrokeGroup = {
    style: { ...CHALK, size: 5.6 }, seed: 1301,
    paths: [
      // a crescent opening to the right: the outer rim from bottom round the left to the top, then the inner rim
      ellipsePoints(mx, my, 80, 80, { turns: 0.56, start: Math.PI / 2 - 0.18, n: 80 }),
      ellipsePoints(mx + 36, my - 2, 60, 70, { turns: 0.47, start: Math.PI / 2 + 0.45, n: 60 }),
    ],
  };
  const r = rng(77);
  const stars = Array.from({ length: 22 }, (_, k) => ({ x: 40 + r() * (w - 80), y: 40 + r() * (cy - 120), r: 5 + r() * 9, at: 0.9 + k * 0.06 }))
    .filter(st => Math.hypot(st.x - mx, st.y - my) > 140);
  const layout: NightLayout = {
    outline, moon, stars, window: s.window,
    slots: { outline: scheduleWithin(outline, 0.1, 1.5), moon: scheduleWithin(moon, 0.5, 1.4) },
  };
  layouts.set(key, layout);
  return layout;
}

export const nightScene: Scene = {
  name: 'night',
  duration: 4.5,
  loopFrom: 2.5,
  draw(f) {
    const { ctx, stage, t } = f;
    const L = nightLayout(stage.w, stage.h);
    drawPaper(ctx, stage, { color: PAL.night, seed: 9 });

    // window glow: a radial halftone in the yellow ink, breathing gently in the loop
    const [x0, y0] = L.window[0]!, [x1, y1] = L.window[2]!;
    const gx = (x0 + x1) / 2, gy = (y0 + y1) / 2;
    const breathe = f.loopPhase === null ? 0 : loopNoise(f.loopPhase, 1401, 1) * 0.3;
    const glow = window01(t, 1.2, 2.0) * (1 + breathe);
    if (glow > 0) {
      const R = 230;
      const box = [gx - R, gy - R, R * 2, R * 2] as const;
      const circle = new Path2D();
      circle.arc(gx, gy, R, 0, TAU);
      dotScreen(ctx, circle, box, { color: PAL.inks[2]!, cell: 9, angle: 0.26, jitter: 0.25, seed: 1402, density: (x, y) => glow * 0.8 * Math.pow(Math.max(0, 1 - Math.hypot(x - gx, y - gy) / R), 2.2) });
    }

    const boil = f.loopPhase === null ? 0 : Math.floor(f.loopPhase * 8) % 4;
    drawGroup(f, L.outline, L.slots.outline, boil);
    drawGroup(f, L.moon, L.slots.moon, boil);

    // stars: four-point sparkles drawn on one by one, twinkling by size in the loop
    L.stars.forEach((st, k) => {
      const p = window01(t, st.at, st.at + 0.25);
      if (p <= 0) return;
      const tw = f.loopPhase === null ? 1 : 0.7 + (loopNoise(f.loopPhase, 1500 + k, 1.5) + 0.5) * 0.6;
      const r = st.r * tw, style: StrokeStyle = { ...CHALK, size: 2.6, dryBrush: 0, taperStart: r, taperEnd: r };
      drawStroke(ctx, prepareStroke([[st.x - r, st.y], [st.x + r, st.y]], style, 1600 + k), p);
      drawStroke(ctx, prepareStroke([[st.x, st.y - r], [st.x, st.y + r]], style, 1700 + k), window01(p, 0.4, 1, x => x));
    });
  },
};
