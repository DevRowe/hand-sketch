/**
 * G03 "Orrery" (the cosmos, machines; blueprint). A draughtsman's blueprint of a planetary machine. It draws on: the
 * construction cross and the orbit ellipses are swung like a compass, then the column, arms and planets, the gear
 * train and the dimensions. Then the drawing starts to run: it accelerates evenly from rest (`rampToConstant`) into
 * a steady mechanism, planets and gears turning a whole number of times per loop so the seam is exact.
 *
 * Depth is kept honest: arms and rods sit under the orbit plane, planets on the far side pass behind the sun.
 */
import { squiggle } from '../../art/glyphs';
import { catmullRom, ellipsePoints } from '../../core/geometry';
import { drawGroup, scheduleWithin, type Slot, type StrokeGroup } from '../../core/ink';
import { clamp, TAU, type Vec2 } from '../../core/math';
import type { Scene } from '../../core/scene';
import { drawStroke, drawStrokeRange, prepareStroke, type PreparedStroke, type StrokeStyle } from '../../core/stroke';
import { rampToConstant } from '../../core/track';
import { circle, fit, ground, group, nf, perSize, polyPath, sec, still, type Fit } from './common';
import { GALLERY } from './palettes';

const PAL = GALLERY.blueprint;
const CHALK = PAL.ink, DIM = PAL.accents[1]!, PENCIL = PAL.accents[0]!;
const LINE: StrokeStyle = { color: CHALK, size: 2.6, thinning: 0.35, smoothing: 0.5, wobble: 0.7, wobbleWavelength: 220, tremor: 0.2, pressureVariation: 0.45, dryBrush: 0.25, paper: PAL.paper, taperStart: 8, taperEnd: 10 };
const FINE: StrokeStyle = { ...LINE, color: DIM, size: 1.5, dryBrush: 0, alpha: 0.85 };

/** Storyboard in drawn frames. */
const F = { cross: [0, 10], orbits: [6, 34], frame: [26, 50], planets: [44, 58], gears: [48, 62], dims: [54, 64], start: 60 } as const;
const RAMP = 18, LOOP = 120, LOOP_FROM = F.start + RAMP;

const C: Vec2 = [560, 470];
const TILT = 0.36;
const CALLOUT: Vec2 = [930, 700];
const ORBITS = [
  { rx: 150, r: 15, turns: 4, arm: 70, trail: 0.3 },
  { rx: 240, r: 23, turns: 3, arm: 115, trail: 0.24 },
  { rx: 335, r: 30, turns: 2, arm: 160, trail: 0.2, ring: true },
  { rx: 440, r: 21, turns: 1, arm: 205, trail: 0.16, moon: true },
] as const;
const BASE_ANGLE = [0.6, 2.4, 4.1, 5.3];
const GEARS = [
  { at: [810, 950] as Vec2, r: 66, teeth: 30, dir: 1 },
  { at: [810 + 66 + 33 + 6, 950] as Vec2, r: 33, teeth: 15, dir: -2 },
  { at: [915 + Math.cos(-1.05) * 61, 950 + Math.sin(-1.05) * 61] as Vec2, r: 22, teeth: 10, dir: 3 },
] as const;

function gearPath(r: number, teeth: number): Vec2[] {
  const pts: Vec2[] = [], depth = Math.max(4, r * 0.14), pitch = TAU / teeth;
  for (let k = 0; k < teeth; k++) {
    const a = k * pitch;
    for (const [f, rr] of [[0, r], [0.18, r + depth], [0.5, r + depth], [0.68, r]] as const) pts.push([Math.cos(a + f * pitch) * rr, Math.sin(a + f * pitch) * rr]);
  }
  pts.push(pts[0]!);
  return pts;
}

interface Layout {
  F: Fit;
  cross: StrokeGroup; crossSlots: Slot[];
  orbits: PreparedStroke[];
  /** Arc-length fraction of each orbit at 720 angle steps, to place trails under the planets. */
  arcAt: Float32Array[];
  frame: StrokeGroup; frameSlots: Slot[];
  planets: PreparedStroke[]; rings: PreparedStroke; moon: PreparedStroke; moonOrbit: PreparedStroke;
  sun: StrokeGroup; sunSlots: Slot[];
  gears: PreparedStroke[]; hubs: PreparedStroke[];
  dims: StrokeGroup; dimSlots: Slot[];
  callout: PreparedStroke;
}

const layout = perSize((w, h): Layout => {
  const Fi = fit(w, h, 1080, 1080);
  const cross = group([[[C[0] - 500, C[1]], [C[0] + 500, C[1]]], [[C[0], C[1] - 240], [C[0], C[1] + 560]]], { ...FINE, taperStart: 30, taperEnd: 30 }, 301);
  const orbits = ORBITS.map((o, k) => prepareStroke(ellipsePoints(C[0], C[1], o.rx, o.rx * TILT, { start: 0, n: 160 }), { ...FINE, size: 1.7, alpha: 0.9 }, 310 + k, { closed: true }));
  const arcAt = ORBITS.map((o, k) => {
    const st = orbits[k]!, table = new Float32Array(720);
    // nearest wobbled vertex to each clean angle
    for (let i = 0; i < 720; i++) {
      const a = (i / 720) * TAU, x = C[0] + Math.cos(a) * o.rx, y = C[1] + Math.sin(a) * o.rx * TILT;
      let best = 0, bd = Infinity;
      for (let j = 0; j < st.points.length; j += 2) {
        const d = (st.points[j]![0] - x) ** 2 + (st.points[j]![1] - y) ** 2;
        if (d < bd) { bd = d; best = j; }
      }
      table[i] = st.lengths[best]! / st.length;
    }
    return table;
  });
  const legs: Vec2[][] = [[[C[0], 880], [C[0] - 190, 1030]], [[C[0], 880], [C[0] + 170, 1020]], [[C[0], 880], [C[0] - 20, 1060]]];
  const drum = ellipsePoints(C[0], 840, 70, 22, { start: 0, n: 60 });
  const frame = group([
    [[C[0] - 7, C[1] + 30], [C[0] - 7, 840]], [[C[0] + 7, C[1] + 30], [C[0] + 7, 840]],
    ...legs, drum, [[C[0] - 70, 840], [C[0] - 70, 880]], [[C[0] + 70, 840], [C[0] + 70, 880]],
    ellipsePoints(C[0], 880, 70, 22, { start: 0, turns: 0.5, n: 30 }),
    ...ORBITS.map(o => ellipsePoints(C[0], C[1] + o.arm, 16, 6, { start: 0, n: 24 })),
    [[C[0] + 70, 870], [GEARS[0].at[0] - 66, 930]],
  ], LINE, 320);
  const planets = ORBITS.map((o, k) => prepareStroke(circle(0, 0, o.r, 40, -0.4), { ...LINE, size: 2.4, taperStart: 3, taperEnd: 3 }, 330 + k, { closed: true }));
  const rings = prepareStroke(ellipsePoints(0, 0, 50, 13, { start: 0, n: 60, rotation: -0.25 }), { ...LINE, size: 1.8 }, 340, { closed: true });
  const moon = prepareStroke(circle(0, 0, 6, 20), { ...LINE, size: 1.8, taperStart: 1, taperEnd: 1 }, 341, { closed: true });
  const moonOrbit = prepareStroke(ellipsePoints(0, 0, 42, 42 * TILT, { start: 0, n: 48 }), { ...FINE, size: 1.1 }, 342, { closed: true });
  const rays = Array.from({ length: 16 }, (_, k): Vec2[] => {
    const a = (k / 16) * TAU, r0 = 58, r1 = k % 2 ? 76 : 92;
    return [[C[0] + Math.cos(a) * r0, C[1] + Math.sin(a) * r0], [C[0] + Math.cos(a) * r1, C[1] + Math.sin(a) * r1]];
  });
  const sun = group([circle(C[0], C[1], 44, 48, -1.2).concat([[C[0] + Math.cos(-1.2) * 44 + 6, C[1] + Math.sin(-1.2) * 44 - 2]]), ...rays], { ...LINE, color: PENCIL, size: 2.8 }, 350);
  const gears = GEARS.map((g, k) => prepareStroke(gearPath(g.r, g.teeth), { ...LINE, size: 2.2, taperStart: 2, taperEnd: 2 }, 360 + k, { closed: true }));
  const hubs = GEARS.map((g, k) => prepareStroke(circle(0, 0, g.r * 0.3, 28), { ...FINE, size: 1.6 }, 370 + k, { closed: true }));
  const outer = ORBITS[3]!.rx;
  const arrow = (tip: Vec2, dir: number): Vec2[] => [[tip[0] + Math.cos(dir + 2.7) * 16, tip[1] + Math.sin(dir + 2.7) * 16], tip, [tip[0] + Math.cos(dir - 2.7) * 16, tip[1] + Math.sin(dir - 2.7) * 16]];
  const dy = C[1] - outer * TILT - 70;
  const dims = group([
    [[C[0], dy - 18], [C[0], dy + 18]], [[C[0] + outer, dy - 18], [C[0] + outer, C[1] - 20]],
    [[C[0] + 4, dy], [C[0] + outer - 4, dy]], arrow([C[0] + 3, dy], Math.PI), arrow([C[0] + outer - 3, dy], 0),
    squiggle(C[0] + outer / 2 - 50, C[0] + outer / 2 + 40, dy - 16, 380, { height: 6, step: 8 }),
    // title block
    [[60, 900], [330, 900], [330, 1030], [60, 1030], [60, 900]], [[60, 945], [330, 945]], [[200, 945], [200, 1030]],
    squiggle(80, 300, 925, 381, { height: 8, step: 10 }), squiggle(76, 180, 972, 382), squiggle(76, 160, 1004, 383), squiggle(214, 314, 988, 384),
    catmullRom([[C[0] - 250, C[1] + 260], [C[0] - 150, C[1] + 250], [C[0] - 40, C[1] + 190]], 6), arrow([C[0] - 40, C[1] + 190], -0.55),
    squiggle(C[0] - 390, C[0] - 262, C[1] + 262, 385),
  ], { ...FINE, size: 1.5, alpha: 0.95, taperStart: 4, taperEnd: 4 }, 380);
  return {
    F: Fi, cross, crossSlots: scheduleWithin(cross, sec(F.cross[0]), sec(F.cross[1])), orbits, arcAt,
    frame, frameSlots: scheduleWithin(frame, sec(F.frame[0]), sec(F.frame[1])), planets, rings, moon, moonOrbit,
    sun, sunSlots: scheduleWithin(sun, sec(F.planets[0]), sec(F.planets[1])), gears, hubs,
    dims, dimSlots: scheduleWithin(dims, sec(F.dims[0]), sec(F.dims[1])),
    callout: prepareStroke(circle(CALLOUT[0], CALLOUT[1], 118, 72, -2).concat([[CALLOUT[0] + Math.cos(-2) * 118 + 8, CALLOUT[1] + Math.sin(-2) * 118 - 6]]), LINE, 390),
  };
});

/** Whole loops of the mechanism since it started: 0 at rest, then ramping, then one per LOOP frames. */
const run = (n: number): number => rampToConstant(n, F.start, RAMP, 1) / LOOP;

export const orreryScene: Scene = {
  name: 'orrery',
  duration: (LOOP_FROM + LOOP) / 12,
  loopFrom: LOOP_FROM / 12,
  poster: (LOOP_FROM + 20) / 12,
  draw(f) {
    const { ctx, stage } = f;
    const L = layout(stage.w, stage.h), n = nf(f), { P, s } = L.F;
    ground(f, PAL.paper, { seed: 303, texture: 1.4, vignette: 0.45, vignetteColor: '#06182c' });
    const [ox, oy] = P(0, 0);
    still(f, 'g03-grid', g => {
      const c = g.ctx;
      c.translate(ox, oy);
      c.scale(s, s);
      c.strokeStyle = CHALK;
      for (const [step, a, lw] of [[30, 0.07, 0.8], [150, 0.14, 1.2]] as const) {
        c.globalAlpha = a;
        c.lineWidth = lw;
        c.beginPath();
        for (let x = 0; x <= 1080; x += step) { c.moveTo(x, -200); c.lineTo(x, 1280); }
        for (let y = 0; y <= 1080; y += step) { c.moveTo(-200, y); c.lineTo(1280, y); }
        c.stroke();
      }
    });

    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(s, s);
    const fx = { ...f, ctx };
    drawGroup(fx, L.cross, L.crossSlots);
    const turns = run(n);
    const angle = (k: number) => BASE_ANGLE[k]! + ORBITS[k]!.turns * TAU * turns;

    // orbits swung like a compass, one after another; then the trails of light behind each planet
    ORBITS.forEach((o, k) => {
      const t0 = F.orbits[0] + k * 7, prog = clamp((n - t0) / 9, 0, 1);
      if (prog > 0) drawStroke(ctx, L.orbits[k]!, prog);
      if (n > F.start) {
        const a = ((angle(k) % TAU) + TAU) % TAU, head = L.arcAt[k]![Math.floor((a / TAU) * 720) % 720]!;
        const on = clamp((n - F.start) / RAMP, 0, 1);
        for (let j = 0; j < 4; j++) {
          ctx.save();
          ctx.globalAlpha *= on * (0.95 - j * 0.22);
          drawStrokeRange(ctx, { ...L.orbits[k]!, style: { ...L.orbits[k]!.style, color: PENCIL, size: 4.6 - j * 0.8, alpha: 1 } }, head - (o.trail * (j + 1)) / 4, head - (o.trail * j) / 4, { taperStart: 2, taperEnd: 2 });
          ctx.restore();
        }
      }
    });

    const pos = (k: number): Vec2 => {
      const o = ORBITS[k]!, a = angle(k);
      return [C[0] + Math.cos(a) * o.rx, C[1] + Math.sin(a) * o.rx * TILT];
    };
    const planetsIn = clamp((n - F.planets[0]) / 10, 0, 1);
    // arms and rods live under the orbit plane
    if (planetsIn > 0) {
      ctx.save();
      ctx.globalAlpha *= planetsIn;
      ctx.strokeStyle = CHALK;
      ctx.lineCap = 'round';
      ORBITS.forEach((o, k) => {
        const [px, py] = pos(k), ay = C[1] + o.arm;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(C[0], ay);
        ctx.lineTo(px, ay + (py - C[1]));
        ctx.lineTo(px, py + o.r);
        ctx.stroke();
        ctx.globalAlpha *= 0.5;
        ctx.setLineDash([6, 7]);
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px, C[1] + (py - C[1]));
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha /= 0.5;
      });
      ctx.restore();
    }
    drawGroup(fx, L.frame, L.frameSlots);

    const drawPlanet = (k: number) => {
      const o = ORBITS[k]!, [px, py] = pos(k), a = angle(k);
      ctx.save();
      ctx.translate(px, py);
      ctx.globalAlpha *= planetsIn;
      if ('ring' in o) {
        drawStrokeRange(ctx, L.rings, 0.5, 1, { taperStart: 3, taperEnd: 3 });
      }
      // disc in paper blue so orbit lines pass behind; the night side hatched away from the sun
      ctx.fillStyle = PAL.paper;
      ctx.fill(polyPath(circle(0, 0, o.r)));
      ctx.save();
      ctx.clip(polyPath(circle(0, 0, o.r)));
      const away = a;
      ctx.rotate(away);
      ctx.strokeStyle = DIM;
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      for (let x = o.r * 0.1; x < o.r; x += 4.5) { ctx.moveTo(x, -o.r); ctx.lineTo(x + o.r * 0.4, o.r); }
      ctx.stroke();
      ctx.restore();
      drawStroke(ctx, L.planets[k]!, 1);
      if ('ring' in o) drawStrokeRange(ctx, L.rings, 0, 0.5, { taperStart: 3, taperEnd: 3 });
      if ('moon' in o) {
        drawStroke(ctx, L.moonOrbit, 1);
        const m = a * 5 + 1.3, mx = Math.cos(m) * 42, my = Math.sin(m) * 42 * TILT;
        ctx.fillStyle = PAL.paper;
        ctx.translate(mx, my);
        ctx.fill(polyPath(circle(0, 0, 6)));
        drawStroke(ctx, L.moon, 1);
      }
      ctx.restore();
    };
    const order = ORBITS.map((_, k) => k).sort((a, b) => pos(a)[1] - pos(b)[1]);
    for (const k of order) if (pos(k)[1] < C[1]) drawPlanet(k);
    // the sun, with a pencil-yellow glow drawn into the blueprint
    const sunIn = clamp((n - F.planets[0]) / 8, 0, 1);
    if (sunIn > 0) {
      ctx.save();
      ctx.globalAlpha *= sunIn;
      ctx.fillStyle = PAL.paper;
      ctx.fill(polyPath(circle(C[0], C[1], 46)));
      const glow = ctx.createRadialGradient(C[0], C[1], 0, C[0], C[1], 120);
      glow.addColorStop(0, 'rgba(243,214,122,0.35)');
      glow.addColorStop(1, 'rgba(243,214,122,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(C[0] - 120, C[1] - 120, 240, 240);
      ctx.restore();
    }
    drawGroup(fx, L.sun, L.sunSlots);
    for (const k of order) if (pos(k)[1] >= C[1]) drawPlanet(k);

    // the gear train, drawn with the rest, then driven: 1, 2 and 3 turns per loop, meshing
    GEARS.forEach((g, k) => {
      const prog = clamp((n - F.gears[0] - k * 4) / 8, 0, 1);
      if (prog <= 0) return;
      ctx.save();
      ctx.translate(g.at[0], g.at[1]);
      ctx.rotate(g.dir * TAU * turns + (k === 1 ? Math.PI / 15 : k === 2 ? 0.2 : 0));
      ctx.fillStyle = PAL.paper;
      ctx.globalAlpha *= prog;
      ctx.fill(polyPath(circle(0, 0, g.r)));
      ctx.globalAlpha /= prog;
      drawStroke(ctx, L.gears[k]!, prog);
      drawStroke(ctx, L.hubs[k]!, prog);
      ctx.strokeStyle = DIM;
      ctx.lineWidth = 1.4;
      ctx.globalAlpha *= prog;
      ctx.beginPath();
      for (let j = 0; j < 4; j++) {
        const a = (j / 4) * TAU;
        ctx.moveTo(Math.cos(a) * g.r * 0.3, Math.sin(a) * g.r * 0.3);
        ctx.lineTo(Math.cos(a) * g.r * 0.85, Math.sin(a) * g.r * 0.85);
      }
      ctx.stroke();
      ctx.restore();
    });
    drawGroup(fx, L.dims, L.dimSlots);

    // detail callout: the small gear magnified, turning with the train
    const callIn = clamp((n - F.dims[0]) / 10, 0, 1);
    if (callIn > 0) {
      const g = GEARS[2], [cx, cy] = CALLOUT, R = 118;
      ctx.save();
      ctx.globalAlpha *= callIn;
      ctx.strokeStyle = DIM;
      ctx.lineWidth = 1.3;
      ctx.setLineDash([7, 8]);
      ctx.beginPath();
      ctx.moveTo(g.at[0], g.at[1] - 24);
      ctx.lineTo(cx, cy + R);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = PAL.paper;
      ctx.fill(polyPath(circle(cx, cy, R)));
      ctx.save();
      ctx.clip(polyPath(circle(cx, cy, R)));
      ctx.translate(cx, cy);
      ctx.scale(3, 3);
      ctx.rotate(g.dir * TAU * turns + 0.2);
      drawStroke(ctx, { ...L.gears[2]!, style: { ...L.gears[2]!.style, size: 0.9 } }, 1);
      drawStroke(ctx, { ...L.hubs[2]!, style: { ...L.hubs[2]!.style, size: 0.6 } }, 1);
      ctx.restore();
      drawStroke(ctx, L.callout, 1);
      ctx.restore();
    }
    ctx.restore();
  },
};
