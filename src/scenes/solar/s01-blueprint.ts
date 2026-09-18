/**
 * S01 "Blueprint" (the solar system from above; blueprint). The classic orrery plan: chalk-white line on diazo blue,
 * over a drafting grid. It draws on as a draughtsman would lay it out: the construction cross through the Sun, each
 * orbit swung like a compass, the degree ring, then the Sun and planets, the dimension and the title block. Then it
 * runs, each planet leaving a pencil-yellow arc of its path behind it.
 *
 * Every disc is filled with paper blue so the orbit line stops at its rim; the night half of each is hatched.
 */
import { squiggle } from '../../art/glyphs';
import { ellipsePoints } from '../../core/geometry';
import { drawGroup, scheduleWithin, type Slot, type StrokeGroup } from '../../core/ink';
import { clamp, TAU, type Vec2 } from '../../core/math';
import type { Scene } from '../../core/scene';
import { drawStroke, drawStrokeRange, prepareStroke, type PreparedStroke, type StrokeStyle } from '../../core/stroke';
import { circle, ground, group, polyPath, sec, still } from '../gallery/common';
import { SOLAR } from './palettes';
import { BELT, C, disc, drawnFrame, enter, frameFit, LOOP, MOON, moonOffset, once, PLANETS, planetAngle, planetAt, POSTER_M, RINGS, ROCKS, rockAt, SUN_R, sunward, URANUS_RING, type Planet } from './common';
import { skyOf, type Sky } from './sky';

const PAL = SOLAR.blueprint;
const CHALK = PAL.ink, DIM = PAL.accents[1]!, PENCIL = PAL.accents[0]!, BLUE = PAL.paper;
const LINE: StrokeStyle = { color: CHALK, size: 2.4, thinning: 0.35, smoothing: 0.5, wobble: 0.5, wobbleWavelength: 260, tremor: 0.15, pressureVariation: 0.4, dryBrush: 0.2, paper: BLUE, taperStart: 8, taperEnd: 10 };
const FINE: StrokeStyle = { ...LINE, color: DIM, size: 1.4, dryBrush: 0, alpha: 0.85 };

/** Storyboard in drawn frames. */
const F = { cross: [0, 10], orbits: 6, orbitEvery: 4, orbitSwing: 8, scale: [30, 46], sun: [36, 46], notes: [44, 58], start: 60 } as const;
const LOOP_FROM = F.start;
/** Where each compass swing starts, radians. */
const SWING = PLANETS.map((_, k) => -2.1 + k * 0.83);
/** Length of each planet's pencil trail, design units. */
const TRAIL = 150;
const SCALE_R = 516;

interface Layout {
  cross: StrokeGroup; crossSlots: Slot[];
  orbits: PreparedStroke[];
  scale: StrokeGroup; scaleSlots: Slot[];
  sun: StrokeGroup; sunSlots: Slot[];
  rims: PreparedStroke[];
  rings: PreparedStroke[]; uranusRing: PreparedStroke;
  moonOrbit: PreparedStroke; moon: PreparedStroke;
  notes: StrokeGroup; noteSlots: Slot[];
}

const arrow = (tip: Vec2, dir: number, size = 14): Vec2[] => [[tip[0] + Math.cos(dir + 2.7) * size, tip[1] + Math.sin(dir + 2.7) * size], tip, [tip[0] + Math.cos(dir - 2.7) * size, tip[1] + Math.sin(dir - 2.7) * size]];

// design-unit geometry only, so one build serves every frame size
const layout = once((): Layout => {
  const cross = group([
    [[C[0] - 530, C[1]], [C[0] + 530, C[1]]], [[C[0], C[1] - 530], [C[0], C[1] + 530]],
  ], { ...FINE, size: 1.2, alpha: 0.7, taperStart: 40, taperEnd: 40 }, 1101);
  const orbits = PLANETS.map((p, k) => prepareStroke(ellipsePoints(C[0], C[1], p.a, p.a, { start: SWING[k]!, n: Math.round(40 + p.a / 4) }), { ...LINE, size: 1.6 + (k < 4 ? 0 : 0.3), alpha: 0.92 }, 1110 + k, { closed: true }));
  // the degree ring: a circle, a tick every 5 degrees, longer every 30
  const ticks: Vec2[][] = [ellipsePoints(C[0], C[1], SCALE_R, SCALE_R, { start: -Math.PI / 2, n: 180 })];
  for (let d = 0; d < 360; d += 5) {
    const a = (d / 180) * Math.PI, len = d % 30 === 0 ? 16 : d % 15 === 0 ? 10 : 6;
    ticks.push([[C[0] + Math.cos(a) * SCALE_R, C[1] + Math.sin(a) * SCALE_R], [C[0] + Math.cos(a) * (SCALE_R - len), C[1] + Math.sin(a) * (SCALE_R - len)]]);
  }
  const scale = group(ticks, { ...FINE, size: 1.3, taperStart: 1, taperEnd: 1 }, 1120);
  const rays = Array.from({ length: 24 }, (_, k): Vec2[] => {
    const a = (k / 24) * TAU, r0 = SUN_R + 8, r1 = SUN_R + (k % 2 ? 16 : 26);
    return [[C[0] + Math.cos(a) * r0, C[1] + Math.sin(a) * r0], [C[0] + Math.cos(a) * r1, C[1] + Math.sin(a) * r1]];
  });
  const sun = group([circle(C[0], C[1], SUN_R, 64, -1.2).concat([[C[0] + Math.cos(-1.2) * SUN_R + 6, C[1] + Math.sin(-1.2) * SUN_R - 2]]), circle(C[0], C[1], SUN_R * 0.55, 40, 0.8), ...rays], { ...LINE, color: PENCIL, size: 2.6, taperStart: 3, taperEnd: 3 }, 1130);
  const rims = PLANETS.map((p, k) => prepareStroke(circle(0, 0, p.r, Math.max(20, Math.round(p.r * 2.4)), -0.6), { ...LINE, size: p.r > 20 ? 2.4 : 1.9, taperStart: 2, taperEnd: 2 }, 1140 + k, { closed: true }));
  const rings = [RINGS.inner, RINGS.outer, (RINGS.inner + RINGS.outer) / 2 + 2].map((r, k) => prepareStroke(ellipsePoints(0, 0, r, r * RINGS.squash, { rotation: RINGS.angle, start: 0, n: 64 }), { ...LINE, size: k === 2 ? 1 : 1.7, color: k === 2 ? DIM : CHALK, taperStart: 2, taperEnd: 2 }, 1150 + k, { closed: true }));
  const uranusRing = prepareStroke(ellipsePoints(0, 0, URANUS_RING.rx, URANUS_RING.ry, { rotation: URANUS_RING.angle, start: 0, n: 40 }), { ...LINE, size: 1.3, taperStart: 2, taperEnd: 2 }, 1155, { closed: true });
  const moonOrbit = prepareStroke(ellipsePoints(0, 0, MOON.a, MOON.a, { start: 0, n: 40 }), { ...FINE, size: 1 }, 1156, { closed: true });
  const moon = prepareStroke(circle(0, 0, MOON.r, 16), { ...LINE, size: 1.4, taperStart: 1, taperEnd: 1 }, 1157, { closed: true });

  // dimension: Sun to Neptune's orbit along the upper-left diagonal; orbit numbers along the east axis; north arrow;
  // title block
  const nep = PLANETS[7]!.a, da = -2.36, perp = da + Math.PI / 2, off = 22;
  const dimFrom: Vec2 = [C[0] + Math.cos(perp) * off, C[1] + Math.sin(perp) * off];
  const dimTo: Vec2 = [C[0] + Math.cos(da) * nep + Math.cos(perp) * off, C[1] + Math.sin(da) * nep + Math.sin(perp) * off];
  const notes: Vec2[][] = [
    [dimFrom, dimTo], arrow(dimFrom, da + Math.PI), arrow(dimTo, da),
    [[C[0] + Math.cos(da) * nep, C[1] + Math.sin(da) * nep], [dimTo[0] + Math.cos(perp) * 10, dimTo[1] + Math.sin(perp) * 10]],
  ];
  PLANETS.forEach((p, k) => {
    const x = C[0] + p.a, y = C[1] + (k % 2 ? 26 : -26);
    notes.push([[x, C[1] - 6], [x, C[1] + 6]]);
    notes.push(squiggle(x - 7, x + 7, y, 1170 + k, { height: 4, step: 5 }));
  });
  // north arrow, top left
  notes.push(circle(96, 110, 34, 40, -1.4), [[96, 150], [96, 62]], arrow([96, 62], -Math.PI / 2, 16), [[86, 46], [86, 30], [106, 46], [106, 30]]);
  // title block, bottom right
  notes.push([[790, 950], [1040, 950], [1040, 1046], [790, 1046], [790, 950]], [[790, 984], [1040, 984]], [[920, 984], [920, 1046]]);
  notes.push(squiggle(806, 1022, 967, 1181, { height: 7, step: 9 }), squiggle(804, 900, 1004, 1182), squiggle(804, 880, 1028, 1183), squiggle(934, 1024, 1016, 1184));
  const notesGroup = group(notes, { ...FINE, size: 1.4, alpha: 0.95, taperStart: 3, taperEnd: 3 }, 1160);

  return {
    cross, crossSlots: scheduleWithin(cross, sec(F.cross[0]), sec(F.cross[1])),
    orbits, scale, scaleSlots: scheduleWithin(scale, sec(F.scale[0]), sec(F.scale[1]), 0.004),
    sun, sunSlots: scheduleWithin(sun, sec(F.sun[0]), sec(F.sun[1]), 0.005), rims, rings, uranusRing, moonOrbit, moon,
    notes: notesGroup, noteSlots: scheduleWithin(notesGroup, sec(F.notes[0]), sec(F.notes[1]), 0.01),
  };
});

/** Frame at which orbit k has been swung and its planet appears. */
const orbitDone = (k: number): number => F.orbits + k * F.orbitEvery + F.orbitSwing;

function drawPlanet(ctx: CanvasRenderingContext2D, L: Layout, p: Planet, k: number, sky: Sky): void {
  const [x, y] = planetAt(p, sky), toSun = sunward([x, y]);
  ctx.save();
  ctx.translate(x, y);
  if (p.name === 'saturn') {
    ctx.fillStyle = BLUE;
    ctx.fill(polyPath(ellipsePoints(0, 0, RINGS.outer + 1, (RINGS.outer + 1) * RINGS.squash, { rotation: RINGS.angle, start: 0, n: 64 })));
    for (const r of L.rings) drawStroke(ctx, r, 1);
  }
  ctx.fillStyle = BLUE;
  ctx.fill(disc(0, 0, p.r + 1));
  // night side: hatching away from the Sun, clipped to the far half of the disc
  ctx.save();
  ctx.clip(disc(0, 0, p.r));
  ctx.rotate(toSun + Math.PI);
  ctx.beginPath();
  ctx.rect(0, -p.r, p.r, p.r * 2);
  ctx.clip();
  ctx.strokeStyle = DIM;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  for (let u = -p.r * 1.5; u < p.r * 1.5; u += 4.2) { ctx.moveTo(u, -p.r); ctx.lineTo(u + p.r * 0.5, p.r); }
  ctx.stroke();
  ctx.restore();
  if (p.name === 'jupiter') {
    // cloud bands, fixed in space, and the red spot sliding along one of them
    ctx.save();
    ctx.clip(disc(0, 0, p.r));
    ctx.strokeStyle = CHALK;
    ctx.globalAlpha *= 0.75;
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    for (const b of [-17, -9, -3, 6, 13, 20]) { ctx.moveTo(-p.r, b); ctx.bezierCurveTo(-p.r / 3, b + 1.5, p.r / 3, b - 1.5, p.r, b); }
    ctx.stroke();
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.ellipse(6, 9.5, 5, 2.6, 0, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }
  drawStroke(ctx, L.rims[k]!, 1);
  if (p.name === 'uranus') drawStroke(ctx, L.uranusRing, 1);
  if (p.name === 'earth') {
    drawStroke(ctx, L.moonOrbit, 1);
    const [mx, my] = moonOffset(sky);
    ctx.translate(mx, my);
    ctx.fillStyle = BLUE;
    ctx.fill(disc(0, 0, MOON.r + 1));
    drawStroke(ctx, L.moon, 1);
  }
  ctx.restore();
}

export const blueprintScene: Scene = {
  name: 'solar-blueprint',
  duration: (LOOP_FROM + LOOP) / 12,
  loopFrom: LOOP_FROM / 12,
  poster: (LOOP_FROM + POSTER_M) / 12,
  draw(f) {
    const { ctx, stage } = f;
    const fr = frameFit(stage.w, stage.h), L = layout(), sky = skyOf(f, LOOP_FROM), n = drawnFrame(f);
    ground(f, BLUE, { seed: 1100, texture: 1.4, vignette: 0.45, vignetteColor: '#06182c' });
    still(f, 's01-grid', g => {
      const c = g.ctx;
      enter(c, fr);
      c.strokeStyle = CHALK;
      for (const [step, a, lw] of [[27, 0.07, 0.8], [135, 0.14, 1.2]] as const) {
        c.globalAlpha = a;
        c.lineWidth = lw;
        c.beginPath();
        for (let x = -540; x <= 1620; x += step) { c.moveTo(x, -600); c.lineTo(x, 1680); }
        for (let y = -540; y <= 1620; y += step) { c.moveTo(-600, y); c.lineTo(1680, y); }
        c.stroke();
      }
    });

    ctx.save();
    enter(ctx, fr);
    const fx = { ...f, ctx };
    drawGroup(fx, L.cross, L.crossSlots);
    drawGroup(fx, L.scale, L.scaleSlots);

    // the belt, a scatter of fine specks that shears as it turns
    const beltIn = clamp((n - F.scale[0]) / 10, 0, 1);
    if (beltIn > 0) {
      ctx.save();
      ctx.globalAlpha *= beltIn * 0.8;
      ctx.fillStyle = DIM;
      ctx.beginPath();
      for (const rk of ROCKS) {
        const [x, y] = rockAt(rk, sky);
        ctx.moveTo(x + rk.size, y);
        ctx.arc(x, y, rk.size, 0, TAU);
      }
      ctx.fill();
      ctx.globalAlpha /= 0.8;
      ctx.strokeStyle = DIM;
      ctx.lineWidth = 0.8;
      ctx.setLineDash([3, 9]);
      ctx.beginPath();
      ctx.arc(C[0], C[1], BELT.inner - 4, 0, TAU);
      ctx.moveTo(C[0] + BELT.outer + 4, C[1]);
      ctx.arc(C[0], C[1], BELT.outer + 4, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }

    // orbits swung like a compass, then the pencil trail behind each planet
    PLANETS.forEach((p, k) => {
      const t0 = F.orbits + k * F.orbitEvery, prog = clamp((n - t0) / F.orbitSwing, 0, 1);
      if (prog <= 0) return;
      const orbit = L.orbits[k]!;
      drawStroke(ctx, orbit, prog);
      const on = clamp((n - orbitDone(k)) / 6, 0, 1);
      if (on <= 0) return;
      const head = (((planetAngle(p, sky) - SWING[k]!) / TAU) % 1 + 1) % 1, trail = Math.min(0.22, TRAIL / (TAU * p.a));
      for (let j = 0; j < 4; j++) {
        ctx.save();
        ctx.globalAlpha *= on * (0.95 - j * 0.22);
        drawStrokeRange(ctx, { ...orbit, style: { ...orbit.style, color: PENCIL, size: 4 - j * 0.7, alpha: 1 } }, head + (trail * j) / 4, head + (trail * (j + 1)) / 4, { taperStart: 2, taperEnd: 2 });
        ctx.restore();
      }
    });

    // the Sun: a pencil-yellow glow drawn into the blueprint, then its rim and rays
    const sunIn = clamp((n - F.sun[0]) / 8, 0, 1);
    if (sunIn > 0) {
      ctx.save();
      ctx.globalAlpha *= sunIn;
      const glow = ctx.createRadialGradient(C[0], C[1], 0, C[0], C[1], SUN_R * 2.6);
      glow.addColorStop(0, 'rgba(243,214,122,0.4)');
      glow.addColorStop(0.4, 'rgba(243,214,122,0.18)');
      glow.addColorStop(1, 'rgba(243,214,122,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(C[0] - SUN_R * 2.6, C[1] - SUN_R * 2.6, SUN_R * 5.2, SUN_R * 5.2);
      ctx.restore();
    }
    drawGroup(fx, L.sun, L.sunSlots);

    PLANETS.forEach((p, k) => {
      const on = clamp((n - orbitDone(k)) / 4, 0, 1);
      if (on <= 0) return;
      ctx.save();
      ctx.globalAlpha *= on;
      drawPlanet(ctx, L, p, k, sky);
      ctx.restore();
    });
    drawGroup(fx, L.notes, L.noteSlots);
    ctx.restore();
  },
};
