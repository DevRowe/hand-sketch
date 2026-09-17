/**
 * The vertical slice: a house on a hill, sketched the way a person would draw it.
 * Pencil guides, then ink outlines with pressure and taper, hachure fills, riso colour plates stamping in,
 * then an idle loop (boiling outlines, flapping birds, chimney smoke) that repeats seamlessly.
 */
import { PALETTES } from '../art/palette';
import { drawPaper } from '../art/paper';
import { plate, printPlate } from '../art/print';
import { drawGroup, scheduleWithin, type Slot, type StrokeGroup } from '../core/ink';
import { ellipsePoints } from '../core/geometry';
import { clamp, TAU, window01, type Vec2 } from '../core/math';
import { loopNoise } from '../core/random';
import type { Scene, SceneFrame } from '../core/scene';
import { sketch, type SketchGeometry } from '../core/sketch';
import { drawStroke, prepareStroke, type StrokeStyle } from '../core/stroke';

const PAL = PALETTES.risoPop;
const [BLUE, PINK, YELLOW] = PAL.inks as [string, string, string];

const INK: StrokeStyle = { color: PAL.ink, size: 5.2, thinning: 0.65, wobble: 2.2, wobbleWavelength: 160, tremor: 0.45, pressureVariation: 0.55, dryBrush: 0.35, paper: PAL.paper };
const FINE: StrokeStyle = { ...INK, size: 2.4, thinning: 0.5, wobble: 1.2, tremor: 0.3, dryBrush: 0, alpha: 0.75 };
const PENCIL: StrokeStyle = { color: '#5d5b6b', size: 2.3, thinning: 0.3, wobble: 3, tremor: 0.8, pressureVariation: 0.7, alpha: 0.55, taperStart: 30, taperEnd: 30 };

interface Layout {
  guides: StrokeGroup;
  house: StrokeGroup;
  ground: StrokeGroup;
  tree: StrokeGroup;
  sun: StrokeGroup;
  groundHatch: StrokeGroup;
  roofHatch: StrokeGroup;
  shapes: {
    body: Vec2[]; roof: Vec2[]; door: Vec2[]; window: Vec2[]; hill: Vec2[];
    canopy: [number, number, number, number]; sun: [number, number, number];
    chimneyTop: Vec2; birds: Vec2[];
  };
  slots: Record<'guides' | 'house' | 'ground' | 'tree' | 'sun' | 'groundHatch' | 'roofHatch', Slot[]>;
}

const rect = (x: number, y: number, w: number, h: number): Vec2[] => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
const all = (...g: SketchGeometry[]): Vec2[][] => g.flatMap(x => x.outline);

const layouts = new Map<string, Layout>();

export function houseLayout(w: number, h: number): Layout {
  const key = `${w}x${h}`;
  const cached = layouts.get(key);
  if (cached) return cached;
  const cx = w / 2, cy = h / 2;
  const hx = cx - 150; // house centre, left of middle
  const body = rect(hx - 190, cy - 60, 380, 300);
  const roof: Vec2[] = [[hx - 230, cy - 50], [hx, cy - 260], [hx + 230, cy - 50]];
  const chimney: Vec2[] = [[hx + 95, cy - 140], [hx + 95, cy - 230], [hx + 145, cy - 230], [hx + 145, cy - 95]];
  const door = rect(hx - 130, cy + 95, 85, 145);
  const win = rect(hx + 20, cy + 10, 110, 95);
  const treeX = cx + 300;
  const canopy: [number, number, number, number] = [treeX, cy - 40, 320, 280];
  const sun: [number, number, number] = [cx - Math.min(w * 0.36, 620), cy - 330, 72];
  const groundPts: Vec2[] = [[-40, cy + 262], [w * 0.2, cy + 236], [w * 0.45, cy + 248], [w * 0.7, cy + 224], [w + 40, cy + 254]];
  const hill: Vec2[] = [...groundPts, [w + 40, h + 40], [-40, h + 40]];

  const guides: StrokeGroup = {
    style: PENCIL, seed: 101,
    paths: all(
      sketch.rectangle(body[0]![0] - 6, body[0]![1] + 4, 392, 290, { seed: 11, roughness: 2.2, disableMultiStroke: true }),
      sketch.polygon(roof, { seed: 12, roughness: 2.4, disableMultiStroke: true }),
      sketch.ellipse(canopy[0], canopy[1], canopy[2] + 20, canopy[3] - 10, { seed: 13, roughness: 2.5, disableMultiStroke: true }),
      sketch.line([treeX, cy + 250], [treeX + 4, cy + 80], { seed: 14, roughness: 2, disableMultiStroke: true }),
    ),
  };
  const house: StrokeGroup = {
    style: INK, seed: 202,
    paths: all(
      sketch.rectangle(body[0]![0], body[0]![1], 380, 300, { seed: 21, roughness: 1.1, bowing: 1.5 }),
      sketch.polygon(roof, { seed: 22, roughness: 1.2, bowing: 2 }),
      sketch.linearPath(chimney, { seed: 23, roughness: 1 }),
      sketch.rectangle(door[0]![0], door[0]![1], 85, 145, { seed: 24, roughness: 1 }),
      sketch.rectangle(win[0]![0], win[0]![1], 110, 95, { seed: 25, roughness: 1 }),
      sketch.line([hx + 75, cy + 12], [hx + 75, cy + 103], { seed: 26, roughness: 0.8, disableMultiStroke: true }),
      sketch.line([hx + 22, cy + 57], [hx + 128, cy + 57], { seed: 27, roughness: 0.8, disableMultiStroke: true }),
    ),
  };
  const ground: StrokeGroup = { style: INK, seed: 303, paths: all(sketch.curve(groundPts, { seed: 31, roughness: 1.4, bowing: 3 })) };
  const trunk = sketch.linearPath([[treeX - 14, cy + 246], [treeX - 8, cy + 90]], { seed: 41, roughness: 1.2 });
  const trunk2 = sketch.linearPath([[treeX + 16, cy + 244], [treeX + 12, cy + 92]], { seed: 42, roughness: 1.2 });
  const tree: StrokeGroup = {
    style: INK, seed: 404,
    paths: [...all(trunk, trunk2), ellipsePoints(canopy[0], canopy[1], canopy[2] / 2, canopy[3] / 2, { turns: 1.12, start: 2.4, n: 90 }).map(([x, y], k): Vec2 => [x + Math.sin(k * 0.9) * 9, y + Math.cos(k * 0.7) * 7])],
  };
  const sunGroup: StrokeGroup = {
    style: { ...INK, size: 4.4 }, seed: 505,
    paths: [
      ellipsePoints(sun[0], sun[1], sun[2], sun[2], { turns: 1.15, n: 70 }),
      ...Array.from({ length: 9 }, (_, k): Vec2[] => {
        const a = (k / 9) * TAU + 0.3, r0 = sun[2] + 22, r1 = sun[2] + 50 + (k % 2) * 16;
        return [[sun[0] + Math.cos(a) * r0, sun[1] + Math.sin(a) * r0], [sun[0] + Math.cos(a) * r1, sun[1] + Math.sin(a) * r1]];
      }),
    ],
  };
  const groundHatch: StrokeGroup = {
    style: FINE, seed: 606,
    paths: sketch.polygon(hill, { seed: 61, fill: 'x', fillStyle: 'hachure', hachureAngle: -38, hachureGap: 26, roughness: 1, disableMultiStrokeFill: true }).fill,
  };
  const roofHatch: StrokeGroup = {
    style: { ...FINE, size: 2 }, seed: 707,
    paths: sketch.polygon(roof, { seed: 71, fill: 'x', fillStyle: 'hachure', hachureAngle: 60, hachureGap: 13, roughness: 0.8, disableMultiStrokeFill: true }).fill,
  };

  const layout: Layout = {
    guides, house, ground, tree, sun: sunGroup, groundHatch, roofHatch,
    shapes: { body, roof, door, window: win, hill, canopy, sun, chimneyTop: [hx + 120, cy - 238], birds: [[cx + 40, cy - 360], [cx + 130, cy - 400], [cx + 215, cy - 350]] },
    slots: {
      guides: scheduleWithin(guides, 0.15, 1.25),
      house: scheduleWithin(house, 1.0, 3.3),
      ground: scheduleWithin(ground, 1.2, 2.2),
      tree: scheduleWithin(tree, 2.2, 3.6),
      sun: scheduleWithin(sunGroup, 3.0, 3.9),
      groundHatch: scheduleWithin(groundHatch, 3.9, 5.0, 0.01),
      roofHatch: scheduleWithin(roofHatch, 3.6, 4.5, 0.01),
    },
  };
  layouts.set(key, layout);
  return layout;
}

function poly(ctx: CanvasRenderingContext2D, pts: readonly Vec2[]): void {
  ctx.beginPath();
  pts.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.fill();
}

/** Riso plates: grey level on each plate is ink coverage; they stamp in one after another. */
function printColour(f: SceneFrame, L: Layout): void {
  const { ctx, stage, t } = f, s = L.shapes;
  const k = (a: number) => window01(t, a, a + 0.5);
  const inks: [string, number, (g: CanvasRenderingContext2D, c: (x: number) => string) => void][] = [
    [YELLOW, 0.26, (g, c) => {
      g.fillStyle = c(0.75 * k(3.7)); g.beginPath(); g.arc(s.sun[0], s.sun[1], s.sun[2] - 4, 0, TAU); g.fill();
      g.fillStyle = c(0.6 * k(4.1)); g.beginPath(); g.ellipse(s.canopy[0], s.canopy[1], s.canopy[2] / 2 - 10, s.canopy[3] / 2 - 10, 0, 0, TAU); g.fill();
      g.fillStyle = c(0.7 * k(4.3)); poly(g, s.window);
      g.fillStyle = c(0.28 * k(4.5)); poly(g, s.hill);
    }],
    [PINK, 1.31, (g, c) => {
      g.fillStyle = c(0.35 * k(3.9)); g.beginPath(); g.arc(s.sun[0], s.sun[1], s.sun[2] - 4, 0, TAU); g.fill();
      g.fillStyle = c(0.62 * k(4.0)); poly(g, s.roof);
      g.fillStyle = c(0.16 * k(4.4)); poly(g, s.body);
    }],
    [BLUE, 0, (g, c) => {
      g.fillStyle = c(0.5 * k(4.2)); g.beginPath(); g.ellipse(s.canopy[0] + 12, s.canopy[1] + 10, s.canopy[2] / 2 - 16, s.canopy[3] / 2 - 16, 0, 0, TAU); g.fill();
      g.fillStyle = c(0.66 * k(4.35)); poly(g, s.door);
      g.fillStyle = c(0.22 * k(4.6)); poly(g, s.hill);
    }],
  ];
  const grey = (coverage: number): string => { const v = Math.round(255 * (1 - clamp(coverage, 0, 1))); return `rgb(${v},${v},${v})`; };
  inks.forEach(([ink, angle, paint], n) => {
    const p = plate(stage, `house:${n}`);
    paint(p.ctx, grey);
    printPlate(ctx, stage, p.canvas, { ink, angle, cell: 8, seed: 900 + n, alpha: 0.92 });
  });
}

/** Idle motion, periodic in loopPhase so the loop has no seam. */
function drawIdle(f: SceneFrame, L: Layout, phase: number, appear: number): void {
  const { ctx } = f;
  // birds: two-segment gull shapes flapping, each with its own phase offset
  L.shapes.birds.forEach(([bx, by], k) => {
    const flap = Math.sin((phase * 4 + k * 0.3) * TAU) * 0.5 + 0.5;
    const drift = loopNoise(phase, 800 + k, 0.6) * 24;
    const span = 26 + k * 4, lift = 6 + flap * 16;
    const path: Vec2[] = [[bx - span + drift, by - lift], [bx - span * 0.45 + drift, by - lift * 0.35], [bx + drift, by + 4], [bx + span * 0.45 + drift, by - lift * 0.35], [bx + span + drift, by - lift]];
    drawStroke(ctx, prepareStroke(path, { ...INK, size: 3.4, dryBrush: 0, taperStart: 14, taperEnd: 14 }, 810 + k), window01(appear, k * 0.2, 0.5 + k * 0.2));
  });
  // smoke: puffs rise from the chimney and fade; three puffs evenly spaced in phase
  const [sx, sy] = L.shapes.chimneyTop;
  for (let k = 0; k < 3; k++) {
    const u = (phase + k / 3) % 1;
    const x = sx + loopNoise(u, 850 + k, 0.8) * 30 + u * 60, y = sy - 20 - u * 150, r = 14 + u * 26;
    ctx.save();
    ctx.globalAlpha = Math.sin(u * Math.PI) * 0.9 * clamp(appear, 0, 1);
    drawStroke(ctx, prepareStroke(ellipsePoints(x, y, r, r * 0.75, { turns: 1.3, start: 2 + k, n: 36 }), { ...FINE, size: 2.2, alpha: 0.6, taperStart: 20, taperEnd: 30 }, 860 + k), 1);
    ctx.restore();
  }
}

export const houseScene: Scene = {
  name: 'house',
  duration: 7.5,
  loopFrom: 5.5,
  draw(f) {
    const { ctx, stage, t } = f;
    const L = houseLayout(stage.w, stage.h);
    drawPaper(ctx, stage, { color: PAL.paper, seed: 5 });

    // pencil guides fade back once the ink is down
    ctx.save();
    ctx.globalAlpha = 1 - 0.65 * window01(t, 3.0, 4.2);
    drawGroup(f, L.guides, L.slots.guides);
    ctx.restore();

    if (t >= 3.6) printColour(f, L);

    const idle = f.loopPhase !== null;
    // boil only in the idle loop: 8 steps over the 2 s loop, cycling 4 variants, starting at the canonical shape
    const boil = idle ? Math.floor((f.frame - Math.round((houseScene.loopFrom ?? 0) * f.fps)) / 3) % 4 : 0;
    drawGroup(f, L.ground, L.slots.ground, boil);
    drawGroup(f, L.groundHatch, L.slots.groundHatch);
    drawGroup(f, L.roofHatch, L.slots.roofHatch);
    drawGroup(f, L.house, L.slots.house, boil);
    drawGroup(f, L.tree, L.slots.tree, boil);
    drawGroup(f, L.sun, L.slots.sun, boil);

    // birds and smoke arrive just before the loop section, holding phase 0 until it starts
    if (t >= 4.8) drawIdle(f, L, f.loopPhase ?? 0, window01(t, 4.8, 5.5, x => x));
  },
};
