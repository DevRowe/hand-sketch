/**
 * K02 "The line keeps going" (alternate hero). The accent line is drawn by hand around a flattened racetrack past
 * four stations; where the pen would lift, the tail starts to follow the head at exactly the pen's speed, and the
 * segment keeps circulating at machine pace. Each station presses and ticks on the frame the head reaches it.
 */
import { checkbox, envelope, grid, paperPlane, sheet, tick } from '../../art/glyphs';
import { prepared, scheduleWithin, type Slot, type StrokeGroup } from '../../core/ink';
import { boilStep } from '../../core/loop';
import type { Vec2 } from '../../core/math';
import { drawPuppet, type Puppet } from '../../core/puppet';
import type { Scene } from '../../core/scene';
import { drawStroke, drawStrokeRange, type PreparedStroke } from '../../core/stroke';
import { clip } from '../../core/track';
import { accentPlate, coverage, DURATION, fillPoly, fit, group, LOOP, LOOP_FROM, nf, paper, perSize, place, R, S, withAlpha } from './common';

/** Storyboard in drawn frames (12 fps). */
const F = { stations: [0, 14], hand: [12, 41], rail: [38, 5], beat: [41, 48] } as const;
/** Laps per drawn frame once the machine runs: one lap per loop period. */
const V = 1 / LOOP;
/** The hand closes the loop 40 design units past its start. */
const OVERSHOOT = 40;
const SEGMENT = 0.3;
/** Ticks stay 12 frames, then fade over 12: short enough that none is pending when the loop section starts. */
const TICK_HOLD = 12, TICK_FADE = 12;

const TOP = 490, BOTTOM = 820, X0 = 370, X1 = 1550;
const STATION_X = [580, 860, 1140, 1420] as const, STATION_Y = 330, GLYPH = 1.45;

function racetrack(P: (x: number, y: number) => Vec2): Vec2[] {
  const r = (BOTTOM - TOP) / 2, pts: Vec2[] = [];
  for (let x = X0; x < X1; x += 20) pts.push(P(x, TOP));
  for (let k = 0; k < 24; k++) { const a = -Math.PI / 2 + (k / 24) * Math.PI; pts.push(P(X1 + Math.cos(a) * r, TOP + r + Math.sin(a) * r)); }
  for (let x = X1; x > X0; x -= 20) pts.push(P(x, BOTTOM));
  for (let k = 0; k < 24; k++) { const a = Math.PI / 2 + (k / 24) * Math.PI; pts.push(P(X0 + Math.cos(a) * r, TOP + r + Math.sin(a) * r)); }
  return pts;
}

/** A station glyph as a puppet (it presses), inking in on its own clock. */
interface Station { puppet: Puppet; slots: Slot[][]; body: Vec2[] }
function station(outline: Vec2[][], detail: Vec2[][], body: Vec2[], seed: number): Station {
  const groups = [group(outline, S.INK, seed), group(detail, S.FINE, seed + 1)];
  return { puppet: { fills: [{ pts: body, color: R.stock }], groups }, slots: [scheduleWithin(groups[0]!, 0, 0.5), scheduleWithin(groups[1]!, 0.35, 0.6, 0.01)], body };
}
const env = envelope(130, 88, 201), form = sheet(96, 120, 211, { lines: 2 }), box = checkbox(26, 215), table = grid(130, 96, 3, 3, 221), plane = paperPlane(130, 231);
const STATIONS: Station[] = [
  station(env.outline, env.detail, env.body, 201),
  station([...form.outline, ...place(box.outline, -20, 34)], [...form.detail, ...place([tick(20)], -20, 34)], form.body, 211),
  station(table.outline, table.detail, table.body, 221),
  station(plane.outline, plane.detail, plane.body, 231),
];

interface Layout {
  s: number;
  flow: StrokeGroup;
  rail: StrokeGroup;
  stations: Vec2[];
  /** Lap fraction of the point on the line under each station. */
  at: number[];
  ticks: StrokeGroup;
  /** Head position (laps) at the hand-off frame. */
  handEnd: number;
}

const layout = perSize((w, h): Layout => {
  const { P, s } = fit(w, h, 1920, 1080);
  const path = racetrack(P);
  const flow: StrokeGroup = { ...group([path], S.FLOW, 301), closed: true };
  const line = prepared(flow)[0]!;
  const at = STATION_X.map(x => {
    const [tx, ty] = P(x, TOP);
    let best = 0, bd = Infinity;
    line.points.forEach(([px, py], k) => { const d = Math.hypot(px - tx, py - ty); if (d < bd) { bd = d; best = k; } });
    return line.lengths[best]! / line.length;
  });
  return {
    s, flow, at,
    stations: STATION_X.map(x => P(x, STATION_Y)),
    rail: { ...group([path], { ...S.FINE, alpha: 0.4, size: 2.2 }, 311), closed: true },
    ticks: group(STATION_X.map(x => place([tick(56)], ...P(x + 92, STATION_Y - 74), s)[0]!), S.TICK, 321),
    handEnd: 1 + (OVERSHOOT * s) / line.length,
  };
});

/**
 * Head position in laps at (fractional) drawn frame n. The hand is a cubic that starts at rest and arrives at the
 * overshoot moving at exactly the machine's speed, plus a little irregularity that leaves both ends intact.
 * After the hand-off it is the machine: constant speed, one lap per loop period.
 */
export function head(n: number, handEnd: number): number {
  const [a, b] = F.hand, T = b - a;
  if (n <= a) return 0;
  if (n >= b) return handEnd + (n - b) * V;
  const u = (n - a) / T;
  const h01 = -2 * u ** 3 + 3 * u ** 2, h11 = u ** 3 - u ** 2;
  return h01 * handEnd + h11 * V * T + 0.03 * u * (1 - u) * Math.sin(u * Math.PI * 8);
}

/** Tail position in laps: at the start until the hand-off, then easing up to a 30% segment by the loop start. */
export function tail(n: number, handEnd: number): number {
  const [a, b] = F.beat;
  if (n <= a) return 0;
  const target = head(n, handEnd) - SEGMENT;
  if (n >= b) return target;
  const u = (n - a) / (b - a);
  return u * u * (3 - 2 * u) * target;
}

/** Draw the closed line between lap positions from < to, even across more than one lap (the hand's overshoot). */
function drawLaps(ctx: CanvasRenderingContext2D, line: PreparedStroke, from: number, to: number): void {
  if (to <= from) return;
  if (to - from > 1) {
    drawStrokeRange(ctx, line, 0, 1);
    drawStrokeRange(ctx, line, from, to - 1);
  } else {
    drawStrokeRange(ctx, line, from, to);
  }
}

export const runsItselfScene: Scene = {
  name: 'runs-itself',
  duration: DURATION,
  loopFrom: LOOP_FROM,
  poster: 4 + 3 / 12,
  draw(f) {
    const { ctx, stage } = f;
    const L = layout(stage.w, stage.h), n = nf(f), boil = boilStep(f);
    paper(f);

    withAlpha(ctx, clip(n, F.rail[0], F.rail[1]), () => drawStroke(ctx, prepared(L.rail)[0]!, 1));
    const hd = head(n, L.handEnd);
    drawLaps(ctx, prepared(L.flow, boil)[0]!, tail(n, L.handEnd), hd);

    // light accent plate inside the envelope and the plane
    accentPlate(f, 'runs-itself', g => {
      const cov = coverage(0.22 * clip(n, 10, 6));
      fillPoly(g, place([env.body], ...L.stations[0]!, L.s * GLYPH)[0]!, cov);
      fillPoly(g, place([plane.body], ...L.stations[3]!, L.s * GLYPH)[0]!, cov);
    });

    L.stations.forEach(([x, y], k) => {
      // frames since the head last passed this station; in the intro only passes by the machine count
      const since = ((((hd - L.at[k]!) % 1) + 1) % 1) / V;
      const passed = n >= F.hand[1] && (f.loopPhase !== null || n - since >= F.hand[1] - 1e-6);
      const age = passed ? since : Infinity;
      const st = STATIONS[k]!;
      drawPuppet(f, st.puppet, { x, y: y + (age < 1 ? 4 * L.s : 0), scale: L.s * GLYPH }, { boil, t: f.t - (F.stations[0] + k * 3) / 12, slots: st.slots });
      withAlpha(ctx, 1 - clip(age, TICK_HOLD, TICK_FADE), () => drawStroke(ctx, prepared(L.ticks)[k]!, 1));
    });
  },
};
