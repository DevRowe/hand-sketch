/**
 * P08 "Two Cups" (loss). Morning light comes up through a window onto the wall. A table edge, then two cups on
 * saucers, drawn with the same care. Both steam. The right one's steam thins, falters, and stops; the left one keeps
 * rising. The loop is only that: one cup steaming beside one that has gone cold.
 */
import { MOODS } from '../../art/moods';
import { hatch } from '../../art/finishes';
import { plate, printPlate } from '../../art/print';
import { catmullRom, ellipsePoints } from '../../core/geometry';
import { drawGroup, scheduleWithin, type Slot, type StrokeGroup } from '../../core/ink';
import { clamp, type Vec2 } from '../../core/math';
import type { Scene } from '../../core/scene';
import type { StrokeStyle } from '../../core/stroke';
import { clip } from '../../core/track';
import { coverage, drawWisp, fillPoly, fit, group, nf, perSize, sec, stock } from './common';

const M = MOODS.keepsake;
const LINE: StrokeStyle = { color: M.ink, size: 4.2, thinning: 0.62, wobble: 1.6, wobbleWavelength: 190, tremor: 0.35, pressureVariation: 0.55, dryBrush: 0.2, paper: M.paper, taperStart: 22, taperEnd: 30 };
const STEAM: StrokeStyle = { color: M.ink, size: 3.4, thinning: 0.75, wobble: 2.4, wobbleWavelength: 120, tremor: 0.2, pressureVariation: 0.7, alpha: 0.55 };

/** Storyboard in drawn frames (12 fps). */
const F = { light: [0, 48], table: [6, 30], cupA: [26, 58], cupB: [56, 88], steam: 60, loopFrom: 192 } as const;
const LOOP = 72;
/**
 * Steam: a wisp every 24 frames from each cup, each rising for 60. The right cup joins on the second beat, and its
 * wisps are born weaker each time (COLD by birth index) until there are none; its last one is gone before the loop.
 */
const EVERY = 24, LIFE = 60;
const COLD = [0, 0.85, 0.45, 0.15] as const;

const TABLE_Y = 930;
/** Cup drawing scale: offsets below are for a unit cup. */
const K = 1.32;
interface Cup { cx: number; dir: 1 | -1 }
const CUPS: readonly Cup[] = [{ cx: 336, dir: 1 }, { cx: 744, dir: -1 }];

interface CupShapes { group: StrokeGroup; slots: Slot[]; body: Vec2[]; tea: Vec2[]; saucer: Vec2[]; rim: Vec2 }

const layout = perSize((w, h) => {
  const { P, s } = fit(w, h, 1080, 1350);
  const cup = (c: Cup, k: number): CupShapes => {
    const { cx, dir } = c, T = TABLE_Y;
    const Q = (dx: number, dy: number): Vec2 => P(cx + dx * dir * K, T + dy * K);
    const ell = (dy: number, rx: number, ry: number, o: Parameters<typeof ellipsePoints>[4] = {}) => ellipsePoints(0, dy, rx, ry, o).map(([x, y]) => Q(x * dir, y));
    const saucer = ell(-12, 136, 20, { turns: 1.04, start: dir > 0 ? Math.PI * 0.85 : Math.PI * 0.15, n: 90 });
    const rimY = -176;
    const rim = ell(rimY, 96, 15, { turns: 1.06, start: Math.PI, n: 80 });
    const sidePts: Vec2[] = [[-96, rimY + 2], [-90, -110], [-70, -56], [-40, -34], [0, -30], [40, -34], [70, -56], [90, -110], [96, rimY + 2]];
    const side = catmullRom(sidePts, 8).map(([x, y]) => Q(x, y));
    const handle = catmullRom([[-92, -150], [-132, -156], [-150, -122], [-128, -86], [-78, -70]], 8).map(([x, y]) => Q(x, y));
    const foot = ([[-44, -30], [-50, -20], [50, -20], [44, -30]] as Vec2[]).map(([x, y]) => Q(x, y));
    const g = group([saucer, side, rim, handle, foot], { ...LINE, size: LINE.size * s }, 8100 + k * 17);
    const body = [...ell(rimY, 96, 15, { start: Math.PI, turns: 0.5, n: 30 }), ...side.slice().reverse()];
    const [a, b] = k === 0 ? F.cupA : F.cupB;
    return { group: g, slots: scheduleWithin(g, sec(a), sec(b), 0.08), body, tea: ell(rimY + 4, 83, 10, { n: 40 }), saucer: ell(-12, 136, 20, { n: 48 }), rim: Q(0, rimY - 10) };
  };
  const table = group([[P(-40, TABLE_Y + 4), P(300, TABLE_Y), P(760, TABLE_Y + 3), P(1120, TABLE_Y - 1)]], { ...LINE, size: 3.6 * s, taperStart: 60, taperEnd: 60 }, 8001);
  // the window's light cast on the wall: a slanted patch of four panes, low enough to sit behind the right cup
  const c00: Vec2 = [586, 250], c10: Vec2 = [936, 312], c11: Vec2 = [906, 790], c01: Vec2 = [556, 728];
  const at = (u: number, v: number): Vec2 => {
    const top: Vec2 = [c00[0] + (c10[0] - c00[0]) * u, c00[1] + (c10[1] - c00[1]) * u];
    const bottom: Vec2 = [c01[0] + (c11[0] - c01[0]) * u, c01[1] + (c11[1] - c01[1]) * u];
    return P(top[0] + (bottom[0] - top[0]) * v, top[1] + (bottom[1] - top[1]) * v);
  };
  const bar = 0.035;
  const pane = (u0: number, u1: number, v0: number, v1: number): Vec2[] => [at(u0, v0), at(u1, v0), at(u1, v1), at(u0, v1)];
  return {
    P, s, table, cups: CUPS.map(cup),
    tableSlots: scheduleWithin(table, sec(F.table[0]), sec(F.table[1])),
    panes: [pane(0, 0.5 - bar, 0, 0.5 - bar), pane(0.5 + bar, 1, 0, 0.5 - bar), pane(0, 0.5 - bar, 0.5 + bar, 1), pane(0.5 + bar, 1, 0.5 + bar, 1)],
    window: [at(0, 0)[1], at(1, 1)[1]] as const,
    tableTop: [P(-40, TABLE_Y + 2), P(1120, TABLE_Y), P(1120, 1400), P(-40, 1400)] as Vec2[],
  };
});

export const twoCupsScene: Scene = {
  name: 'two-cups',
  duration: (F.loopFrom + LOOP) / 12,
  loopFrom: F.loopFrom / 12,
  poster: (F.loopFrom + 30) / 12,
  draw(f) {
    const { ctx, stage } = f;
    const L = layout(stage.w, stage.h), n = nf(f);
    stock(f, M.paper, { seed: 81, vignette: 0.28, vignetteColor: M.ink });

    // the morning comes up: a window's light on the wall, the cups in front of it, tea in the cups
    const light = clip(n, F.light[0], F.light[1] - F.light[0]);
    const p = plate(stage, 'two-cups');
    const wall = p.ctx.createLinearGradient(0, L.window[0], 0, L.window[1]);
    wall.addColorStop(0, coverage(0.14 * light * light));
    wall.addColorStop(1, coverage(0.3 * light * light));
    p.ctx.save();
    p.ctx.fillStyle = wall;
    for (const pane of L.panes) {
      p.ctx.beginPath();
      pane.forEach(([x, y], k) => (k ? p.ctx.lineTo(x, y) : p.ctx.moveTo(x, y)));
      p.ctx.fill();
    }
    p.ctx.restore();
    // each cup shades the light as it is drawn, and fills with tea once it is whole
    L.cups.forEach((c, k) => {
      const [a, b] = k ? F.cupB : F.cupA;
      fillPoly(p.ctx, c.body, '#fff', clip(n, a, b - a));
      fillPoly(p.ctx, c.saucer, '#fff', clip(n, a, 10));
      fillPoly(p.ctx, c.tea, coverage(0.5), clip(n, b - 6, 10));
    });
    printPlate(ctx, stage, p.canvas, { ink: M.inks[0]!, cell: 7, angle: 0.3, seed: 83, alpha: 0.85 });

    // the table: a pencil tone under the edge, and soft shadows where the saucers sit
    const tone = clip(n, F.table[0] + 10, 30);
    if (tone > 0) {
      const top = new Path2D();
      L.tableTop.forEach(([x, y], k) => (k ? top.lineTo(x, y) : top.moveTo(x, y)));
      top.closePath();
      hatch(ctx, top, [0, L.P(0, TABLE_Y)[1], stage.w, stage.h], { color: M.ink, alpha: 0.1 * tone, angle: 2.6, gap: 8, len: 34, jitter: 5, width: 1, seed: 87 });
    }
    drawGroup(f, L.table, L.tableSlots);

    L.cups.forEach(c => drawGroup(f, c.group, c.slots));

    // steam: wisps born every EVERY frames from F.steam on; the loop keeps only the left cup's
    L.cups.forEach((c, k) => {
      for (let j = Math.max(0, Math.floor((n - LIFE - F.steam) / EVERY)); F.steam + j * EVERY < n; j++) {
        const born = F.steam + j * EVERY, age = n - born;
        const strength = k === 0 ? 1 : (COLD[j] ?? 0);
        if (age <= 0 || age >= LIFE || strength <= 0) continue;
        const variant = j % (LOOP / EVERY);
        const [bx, by] = c.rim;
        const height = (400 + variant * 50) * L.s * clamp(0.5 + strength * 0.5, 0, 1), style = { ...STEAM, size: STEAM.size * L.s };
        // two strands that part a little as they climb
        drawWisp(f, [bx + (variant - 1) * 34 * L.s, by], height, 8200 + k * 10 + variant, style, age / LIFE, { alpha: strength, length: 0.55, sway: L.s * (1.1 + variant * 0.2) });
        drawWisp(f, [bx + (variant - 1) * 34 * L.s + 22 * L.s, by + 6 * L.s], height * 0.8, 8300 + k * 10 + variant, style, age / LIFE, { alpha: strength * 0.7, length: 0.42, sway: L.s * (0.9 + variant * 0.2) });
      }
    });
  },
};
