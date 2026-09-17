/**
 * P06 "The Lighthouse" (endurance). A storm at night: rain, a choppy sea, waves breaking on a rock. A lighthouse is
 * drawn into it. Its lamp stutters (on, off, on, off) and then holds, and the beam begins to turn, slowly finding its
 * pace. The loop is the storm going on and the light going round, steady, whatever the sea does.
 */
import { MOODS } from '../../art/moods';
import { dotScreen } from '../../art/finishes';
import { emissions, lifeWindow } from '../../core/emitter';
import { catmullRom, ellipsePoints } from '../../core/geometry';
import { drawGroup, scheduleWithin, type Slot, type StrokeGroup } from '../../core/ink';
import { boilStep } from '../../core/loop';
import { clamp, TAU, type Vec2 } from '../../core/math';
import { hashSeed, rng } from '../../core/random';
import type { Scene } from '../../core/scene';
import { sketch } from '../../core/sketch';
import { drawStrokeRange, prepareStroke, type PreparedStroke, type StrokeStyle } from '../../core/stroke';
import { clip, rampToConstant } from '../../core/track';
import { fillPoly, fit, glow, group, nf, perSize, sec, stock } from './common';

const M = MOODS.vigil;
const LAMP = M.inks[0]!;
const CHALK: StrokeStyle = { color: M.chalk, size: 4.2, thinning: 0.55, wobble: 1.6, wobbleWavelength: 180, tremor: 0.4, pressureVariation: 0.55, dryBrush: 0.4, paper: M.paper, taperStart: 20, taperEnd: 28 };
const SEA: StrokeStyle = { ...CHALK, color: M.chalkDim, size: 3, dryBrush: 0.25, taperStart: 14, taperEnd: 14 };

/** Storyboard in drawn frames (12 fps). */
const F = { horizon: [0, 22], rock: [8, 30], tower: [18, 54], lamp: [58, 72], turn: 70, ramp: 20, loopFrom: 96 } as const;
const LOOP = 72;
/** One turn of the light per loop; a wave breaks on the rock twice. */
const SPEED = TAU / LOOP, CRASH = 36;
/** The lamp catching: stutters, then holds. */
const STUTTER: readonly [number, number][] = [[58, 60], [63, 64], [67, 999]];

const LANTERN: Vec2 = [640, 492];
const HORIZON = 858;

interface Layout {
  P(x: number, y: number): Vec2; s: number;
  horizon: StrokeGroup; rock: StrokeGroup; tower: StrokeGroup; lantern: StrokeGroup;
  slots: { horizon: Slot[]; rock: Slot[]; tower: Slot[]; lantern: Slot[] };
  towerBody: Vec2[]; rockBody: Vec2[];
  crest: PreparedStroke[]; spray: PreparedStroke[];
  rain: { x: number; y: number; len: number; phase: number }[];
}

const layout = perSize((w, h): Layout => {
  const { P, s } = fit(w, h, 1080, 1350);
  const map = (pts: readonly Vec2[]) => pts.map(([x, y]) => P(x, y));
  const r = (seed: number, roughness = 0.9) => ({ seed, roughness, disableMultiStroke: true });
  const horizon = group([map([[-40, HORIZON + 2], [400, HORIZON - 1], [1120, HORIZON + 1]])], { ...SEA, size: 2.6 * s, taperStart: 120, taperEnd: 120 }, 6001);
  const rockTop: Vec2[] = [[392, 1066], [440, 978], [520, 924], [610, 904], [700, 908], [790, 934], [862, 990], [918, 1068]];
  const rock = group([
    map(catmullRom(rockTop, 6)),
    map(catmullRom([[520, 924], [560, 966], [548, 1016]], 5)),
    map(catmullRom([[790, 934], [770, 976], [800, 1026]], 5)),
    // the waterline, broken by foam
    map(catmullRom([[350, 1070], [420, 1064], [500, 1072], [600, 1066], [700, 1073], [800, 1065], [880, 1072], [960, 1066]], 6)),
  ], { ...CHALK, size: CHALK.size * s }, 6002);
  const towerPaths: Vec2[][] = [
    ...sketch.linearPath([[572, 906], [600, 540]], r(6011, 0.5)).outline,
    ...sketch.linearPath([[708, 906], [680, 540]], r(6012, 0.5)).outline,
    ellipsePoints(640, 780, 58, 8, { start: 0, turns: 0.5, n: 30 }),
    ellipsePoints(640, 660, 50, 7, { start: 0, turns: 0.5, n: 30 }),
    catmullRom([[628, 906], [628, 880], [640, 868], [652, 880], [652, 906]], 4),
    [[578, 542], [702, 540]],
    [[586, 516], [694, 514]],
    ...[590, 612, 668, 690].map((x): Vec2[] => [[x, 516], [x, 540]]),
    catmullRom([[602, 466], [620, 446], [640, 432], [660, 446], [678, 466]], 5),
    [[640, 432], [640, 410]],
  ];
  const tower = group(towerPaths.map(map), { ...CHALK, size: 3.6 * s }, 6003);
  // the lantern's glazing is drawn over the lamp once it is lit
  const mullion: Vec2[] = [[640, 468], [640, 512]];
  const lantern = group([...sketch.rectangle(612, 466, 56, 48, r(6013, 0.4)).outline, mullion].map(map),{ ...CHALK, size: 3.2 * s }, 6004);
  const towerBody = map([[572, 906], [600, 542], [578, 542], [586, 516], [602, 466], [640, 430], [678, 466], [694, 516], [702, 540], [680, 542], [708, 906]]);
  // a small wave crest: a flicked hump, prepared once in local units and posed per item
  const crest = [0, 1, 2, 3].map(k => prepareStroke(catmullRom([[-40, 4], [-16, -6 - k], [6, -10 - k * 2], [22, -2], [40, 6]], 6), { ...SEA, size: 2.8 }, 6100 + k));
  // spray thrown up off each side of the rock: tall arcs leaning outward that fall back at their ends
  const spray = Array.from({ length: 8 }, (_, k) => {
    const dir = k < 4 ? -1 : 1, lean = 0.5 + (k % 4) * 0.45, height = 110 + ((k * 53) % 60);
    return prepareStroke(catmullRom([[0, 0], [dir * lean * 30, -height * 0.55], [dir * (lean * 70 + 20), -height * 0.92], [dir * (lean * 120 + 40), -height], [dir * (lean * 170 + 60), -height * 0.8]], 8), { ...CHALK, size: 3.6, dryBrush: 0.6, taperStart: 40, taperEnd: 50 }, 6200 + k);
  });
  const rnd = rng(6300);
  const rain = Array.from({ length: 140 }, () => ({ x: rnd() * 1300 - 100, y: rnd(), len: 26 + rnd() * 40, phase: rnd() }));
  return {
    P, s, horizon, rock, tower, lantern,
    slots: {
      horizon: scheduleWithin(horizon, sec(F.horizon[0]), sec(F.horizon[1])), rock: scheduleWithin(rock, sec(F.rock[0]), sec(F.rock[1]), 0.1),
      tower: scheduleWithin(tower, sec(F.tower[0]), sec(F.tower[1] - 6), 0.04), lantern: scheduleWithin(lantern, sec(F.tower[1] - 6), sec(F.tower[1])),
    },
    towerBody, rockBody: map([...rockTop, [880, 1070], [440, 1068]]), crest, spray, rain,
  };
});

/** The light's angle: still, then turning up to its pace without a jolt; a whole turn per loop once running. */
const angle = (n: number): number => -0.35 + rampToConstant(n, F.turn, F.ramp, SPEED);

export const lighthouseScene: Scene = {
  name: 'lighthouse',
  duration: (F.loopFrom + LOOP) / 12,
  loopFrom: F.loopFrom / 12,
  // the beam at full reach, swept out across the storm to the left
  poster: (F.loopFrom + 24) / 12,
  draw(f) {
    const { ctx, stage } = f;
    const L = layout(stage.w, stage.h), n = nf(f), s = L.s;
    // every storm clock is the frame modulo the loop, measured from the loop start, so it runs through the intro too
    const m = (((n - F.loopFrom) % LOOP) + LOOP) % LOOP;
    const clock = f.loopPhase === null ? n : F.loopFrom + m;
    stock(f, M.paper, { seed: 61, texture: 0.9, vignette: 0.5, vignetteColor: '#000000' });
    const [lx, ly] = L.P(...LANTERN);

    // the sea: a darker screen below the horizon, and crests that rise, drift left and sink
    const hy = L.P(0, HORIZON)[1];
    const sea = new Path2D();
    sea.rect(0, hy, stage.w, stage.h - hy);
    dotScreen(ctx, sea, [0, hy, stage.w, stage.h - hy], { color: M.fills[2]!, cell: 8, angle: 0.5, jitter: 0.15, seed: 6401, density: (_, y) => 0.25 + 0.45 * clamp((y - hy) / (stage.h - hy), 0, 1) });
    for (let row = 0; row < 7; row++) {
      const depth = row / 6, y = hy + (18 + depth * depth * 470) * s, scale = (0.45 + depth * 1.3) * s;
      for (const e of emissions(n - F.loopFrom + row * 5, LOOP, { every: 6, life: 36, offset: row })) {
        const id = hashSeed(6500, row, e.index), x0 = (rng(id)() * 1240 - 80) * s;
        const vis = lifeWindow(e.u, 0.3, 0.35) * clip(n, 4 + row * 2, 10);
        if (vis <= 0) continue;
        ctx.save();
        ctx.globalAlpha *= vis * (0.45 + depth * 0.5);
        ctx.translate(x0 - e.u * 90 * scale, y - Math.sin(e.u * Math.PI) * 6 * scale);
        ctx.scale(scale, scale);
        drawStrokeRange(ctx, L.crest[id % 4]!, 0, clamp(e.u * 3, 0, 1));
        ctx.restore();
      }
    }

    // the beam: one turn per loop; long when it sweeps sideways, a flare when it faces us
    const lampOn = STUTTER.some(([a, b]) => n >= a && n < b) ? 1 : 0;
    const theta = angle(clock), side = Math.cos(theta), toward = Math.sin(theta);
    const beamIn = clip(n, F.turn - 4, 10);
    if (lampOn && beamIn > 0 && Math.abs(side) > 0.02) {
      const len = 1250 * Math.abs(side) * s, dir = Math.sign(side), spread = len * 0.1 + 14 * s;
      const wedge: Vec2[] = [[lx, ly - 10 * s], [lx + dir * len, ly - spread - 30 * s * Math.abs(side)], [lx + dir * len, ly + spread], [lx, ly + 10 * s]];
      const path = new Path2D();
      wedge.forEach(([x, y], k) => (k ? path.lineTo(x, y) : path.moveTo(x, y)));
      path.closePath();
      const strength = beamIn * Math.pow(Math.abs(side), 0.6) * (0.75 + 0.25 * Math.max(0, toward));
      ctx.save();
      const grad = ctx.createLinearGradient(lx, ly, lx + dir * len, ly);
      grad.addColorStop(0, `rgba(242,195,92,${0.42 * strength})`);
      grad.addColorStop(1, 'rgba(242,195,92,0)');
      ctx.fillStyle = grad;
      ctx.fill(path);
      dotScreen(ctx, path, [Math.min(lx, lx + dir * len), ly - spread - 40 * s, len, spread * 2 + 60 * s], { color: LAMP, cell: 7, angle: 0.26, jitter: 0.2, seed: 6601, density: x => strength * 0.7 * Math.pow(clamp(1 - Math.abs(x - lx) / len, 0, 1), 1.6) });
      ctx.restore();
    }

    // rain: slanted streaks falling through the frame in whole loop fractions, wrapping out of sight
    const rain = clip(n, 0, 12);
    ctx.save();
    ctx.strokeStyle = M.chalkDim;
    ctx.lineWidth = 1.6 * s;
    ctx.lineCap = 'round';
    ctx.globalAlpha = 0.34 * rain;
    ctx.beginPath();
    const fall = 12;
    for (const d of L.rain) {
      const u = ((clock / fall + d.phase) % 1 + 1) % 1, y = (-120 + u * 1600) * s, x = (d.x - u * 260) * s + (d.y * 40 - 20) * s;
      ctx.moveTo(x, y);
      ctx.lineTo(x - d.len * 0.2 * s, y + d.len * s);
    }
    ctx.stroke();
    ctx.restore();

    // rock and tower, filled with the night so the rain passes behind them
    const boil = boilStep(f, { hold: 3, variants: 4 });
    // the fills come in as the outlines close, so nothing dark appears before the hand has drawn it
    fillPoly(ctx, L.rockBody, M.paper, clip(n, F.rock[1] - 10, 10));
    fillPoly(ctx, L.towerBody, M.paper, clip(n, F.tower[1] - 16, 16));
    drawGroup(f, L.horizon, L.slots.horizon, boil);
    drawGroup(f, L.rock, L.slots.rock, boil);
    drawGroup(f, L.tower, L.slots.tower, boil);

    // the lamp, and a flare when the beam faces us
    if (lampOn) {
      glow(f, lx, ly, 110 * s, LAMP, 0.9, { cell: 5, bloom: 0.55, density: 0.8, seed: 6701 });
      const flare = n >= F.turn ? Math.pow(Math.max(0, toward), 6) * beamIn : 0;
      if (flare > 0.01) glow(f, lx, ly, 340 * s, LAMP, flare * 0.8, { cell: 8, bloom: 0.45, falloff: 2.6, seed: 6702 });
      fillPoly(ctx, [[lx - 26 * s, ly - 24 * s], [lx + 26 * s, ly - 24 * s], [lx + 26 * s, ly + 20 * s], [lx - 26 * s, ly + 20 * s]], LAMP, 0.85);
    }
    drawGroup(f, L.lantern, L.slots.lantern, boil);

    // a wave breaks on the rock twice a loop: spray flung up both sides, rising and falling back
    const beat = (((clock - F.loopFrom - 10) % CRASH) + CRASH) % CRASH, sprayIn = clip(n, 26, 12);
    if (beat < 22 && sprayIn > 0) {
      const u = beat / 22;
      [[420, 1050], [890, 1052]].forEach(([bx, by], side) => {
        const [x, y] = L.P(bx!, by!);
        for (let k = 0; k < 4; k++) {
          const st = L.spray[side * 4 + k]!, lag = k * 0.06, v = clamp((u - lag) / (1 - lag), 0, 1);
          if (v <= 0) continue;
          ctx.save();
          ctx.globalAlpha *= sprayIn * Math.pow(1 - v, 0.8) * 0.9;
          ctx.translate(x + (k - 1.5) * 18 * s * (side ? 1 : -1), y);
          ctx.scale(s, s);
          drawStrokeRange(ctx, st, Math.max(0, v * 1.25 - 0.4), Math.min(1, v * 1.7), { taperStart: 30, taperEnd: 36 });
          ctx.restore();
        }
        // droplets thrown in a fan, falling back under their own weight
        const r = rng(6800 + side), out = side ? 1 : -1;
        ctx.save();
        ctx.fillStyle = M.chalk;
        ctx.beginPath();
        for (let k = 0; k < 18; k++) {
          const a = -Math.PI / 2 + out * (0.1 + r() * 0.95), speed = (11 + r() * 15) * s, rad = (2 + r() * 3.2) * s, t = beat * (0.85 + r() * 0.3);
          const px = x + Math.cos(a) * speed * t, py = y + Math.sin(a) * speed * t + 0.9 * s * t * t;
          if (py > y + 10 * s) continue;
          ctx.moveTo(px + rad, py);
          ctx.arc(px, py, rad * (1 - u * 0.5), 0, TAU);
        }
        ctx.globalAlpha *= sprayIn * (1 - u) * 0.85;
        ctx.fill();
        ctx.restore();
      });
    }
  },
};
