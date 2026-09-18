/**
 * SP01 "Blueprint" (the moving solar system at an angle; blueprint). Drawn as an engineer draws a coil spring: chalk
 * line on diazo blue over the drafting grid, the Sun's path a chain line (the spring's axis), every helix solid where
 * it passes in front of the axis and dashed where it is hidden behind it, the current orbits as fine ellipses, the
 * newest stretch of each wake in the pencil yellow of the top-down plan. A pitch dimension along the axis gives one
 * Earth year of travel; an arrow gives the heading; the title block sits in the corner the wake leaves empty.
 *
 * The dashes are keyed to each sample's own time, so they ride along the helix rather than crawling over it.
 */
import { squiggle } from '../../art/glyphs';
import { drawGroup, scheduleWithin, type Slot, type StrokeGroup } from '../../core/ink';
import { clamp, TAU, type Vec2 } from '../../core/math';
import type { Scene } from '../../core/scene';
import { drawStroke, prepareStroke, type PreparedStroke, type StrokeStyle } from '../../core/stroke';
import { circle, composite, ground, group, knockOut, scratch, sec, still, toothMask } from '../gallery/common';
import { SOLAR } from '../solar/palettes';
import { behind, bodyRing, disc, drawnFrame, dust, E1, E2, enter, frameFit, INTRO, inWake, litShape, LOOP, MOON, MOTION, once, paint, planet, PLANETS, POSTER_M, project, RINGS, snapshot, spiralSky, strokeRun, SUB, SUN_R, trace, URANUS_RING, type Body, type Snapshot } from './common';

const PAL = SOLAR.blueprint;
const CHALK = PAL.ink, DIM = PAL.accents[1]!, PENCIL = PAL.accents[0]!, BLUE = PAL.paper;
const LINE: StrokeStyle = { color: CHALK, size: 2.2, thinning: 0.35, smoothing: 0.5, wobble: 0.5, wobbleWavelength: 260, tremor: 0.15, pressureVariation: 0.4, dryBrush: 0.2, paper: BLUE, taperStart: 3, taperEnd: 3 };
const FINE: StrokeStyle = { ...LINE, color: DIM, size: 1.3, dryBrush: 0, alpha: 0.9 };

/** Intro storyboard, drawn frames from the start. */
const F = { notes: [6, 40] } as const;
/** Dash length along a hidden helix, in samples of its own time (divides `SUB * LOOP`). */
const DASH = 8;

interface Layout {
  sun: StrokeGroup; sunSlots: Slot[];
  notes: StrokeGroup; noteSlots: Slot[];
  rims: PreparedStroke[];
}

const arrow = (tip: Vec2, dir: number, size = 12): Vec2[] => [[tip[0] + Math.cos(dir + 2.7) * size, tip[1] + Math.sin(dir + 2.7) * size], tip, [tip[0] + Math.cos(dir - 2.7) * size, tip[1] + Math.sin(dir - 2.7) * size]];

const layout = once((): Layout => {
  const S = project([0, 0, 0]);
  const rays = Array.from({ length: 20 }, (_, k): Vec2[] => {
    const a = (k / 20) * TAU, r0 = SUN_R + 6, r1 = SUN_R + (k % 2 ? 12 : 20);
    return [[S.x + Math.cos(a) * r0, S.y + Math.sin(a) * r0], [S.x + Math.cos(a) * r1, S.y + Math.sin(a) * r1]];
  });
  const sun = group([circle(S.x, S.y, SUN_R, 48, -1.2).concat([[S.x + Math.cos(-1.2) * SUN_R + 5, S.y + Math.sin(-1.2) * SUN_R - 2]]), circle(S.x, S.y, SUN_R * 0.55, 32, 0.8), ...rays], { ...LINE, color: PENCIL, size: 2.2 }, 2130);

  // pitch dimension: one Earth year of travel, laid off parallel to the axis below the coils (extension lines broken)
  const year = LOOP / planet('earth').turns, a0 = project(behind([0, 0, 0], 0)), a1 = project(behind([0, 0, 0], year));
  const ax = Math.atan2(a1.y - a0.y, a1.x - a0.x), px = Math.cos(ax - Math.PI / 2), py = Math.sin(ax - Math.PI / 2), off = 330;
  const d0: Vec2 = [a0.x + px * off, a0.y + py * off], d1: Vec2 = [a1.x + px * off, a1.y + py * off];
  const notes: Vec2[][] = [
    [d0, d1], arrow(d0, ax + Math.PI), arrow(d1, ax),
    [[d0[0] - px * 16, d0[1] - py * 16], [d0[0] + px * 10, d0[1] + py * 10]],
    [[d1[0] - px * 16, d1[1] - py * 16], [d1[0] + px * 10, d1[1] + py * 10]],
  ];
  const mid: Vec2 = [(d0[0] + d1[0]) / 2 + px * 16, (d0[1] + d1[1]) / 2 + py * 16];
  notes.push(squiggle(mid[0] - 16, mid[0] + 16, mid[1], 2181, { height: 5, step: 6 }));
  // heading: an arrow out ahead of the Sun
  const h0: Vec2 = [S.x + MOTION[0] * 70, S.y + MOTION[1] * 70], hd = Math.atan2(MOTION[1], MOTION[0]);
  const h1: Vec2 = [h0[0] + Math.cos(hd) * 120, h0[1] + Math.sin(hd) * 120];
  notes.push([h0, h1], arrow(h1, hd, 16), squiggle(h1[0] - 34, h1[0] + 20, h1[1] + 30, 2182, { height: 5, step: 7 }));
  // title block, lower left
  notes.push([[40, 930], [330, 930], [330, 1044], [40, 1044], [40, 930]], [[40, 966], [330, 966]], [[190, 966], [190, 1044]]);
  notes.push(squiggle(56, 300, 948, 2183, { height: 7, step: 9 }), squiggle(54, 160, 988, 2184), squiggle(54, 140, 1016, 2185), squiggle(204, 316, 1000, 2186));
  const notesGroup = group(notes, { ...FINE, size: 1.3, taperStart: 3, taperEnd: 3 }, 2160);
  // rims at each body's radius at the Sun's depth, scaled by perspective where drawn; the Moon's last
  const rims = [...PLANETS.map(p => p.r), MOON.r].map((r, k) => prepareStroke(circle(0, 0, r, Math.max(16, Math.round(r * 2.4)), -0.6), { ...LINE, size: r > 12 ? 2 : 1.6, taperStart: 1.5, taperEnd: 1.5, dryBrush: 0 }, 2140 + k, { closed: true }));
  return {
    sun, sunSlots: scheduleWithin(sun, 0, sec(4), 0.005),
    notes: notesGroup, noteSlots: scheduleWithin(notesGroup, sec(F.notes[0]), sec(F.notes[1]), 0.01),
    rims,
  };
});

/** A ring half round a body, as a fine chalk line. */
function ringLine(ctx: CanvasRenderingContext2D, pts: readonly { x: number; y: number }[], width: number, dashed = false): void {
  ctx.save();
  ctx.strokeStyle = CHALK;
  ctx.lineWidth = width;
  if (dashed) ctx.setLineDash([3, 3]);
  ctx.beginPath();
  trace(ctx, pts);
  ctx.stroke();
  ctx.restore();
}

function drawBody(ctx: CanvasRenderingContext2D, L: Layout, S: Snapshot, b: Body): void {
  const { x, y, R } = b, name = b.planet.name;
  const saturn = name === 'saturn' ? bodyRing(b.p, RINGS.outer, E1, E2) : null, saturnIn = name === 'saturn' ? bodyRing(b.p, RINGS.inner, E1, E2) : null;
  const uranus = name === 'uranus' ? bodyRing(b.p, URANUS_RING, MOTION, E1) : null;
  if (saturn && saturnIn) { ringLine(ctx, saturn.back, 1.4 * b.s); ringLine(ctx, saturnIn.back, 1 * b.s); }
  if (uranus) ringLine(ctx, uranus.back, 1 * b.s);
  const moonBehind = name === 'earth' && !S.moon.front;
  if (moonBehind) drawMoon(ctx, L, S);
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = BLUE;
  ctx.fill(disc(0, 0, R + 1));
  // night side: hatch the disc, then clear the lit part back to paper
  ctx.save();
  ctx.clip(disc(0, 0, R));
  ctx.strokeStyle = DIM;
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  for (let u = -R * 2; u < R * 2; u += 3.6) { ctx.moveTo(u - R, -R); ctx.lineTo(u + R * 0.5, R); }
  ctx.stroke();
  ctx.fillStyle = BLUE;
  ctx.beginPath();
  litShape(R, b.toSun, b.phase).forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
  ctx.fill();
  if (name === 'jupiter') {
    ctx.strokeStyle = CHALK;
    ctx.globalAlpha *= 0.7;
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    for (const f of [-0.6, -0.3, -0.1, 0.22, 0.45, 0.7]) { ctx.moveTo(-R, f * R); ctx.bezierCurveTo(-R / 3, f * R + 1.2, R / 3, f * R - 1.2, R, f * R); }
    ctx.stroke();
  }
  ctx.restore();
  ctx.scale(b.s, b.s);
  drawStroke(ctx, L.rims[b.planet.k]!, 1);
  ctx.restore();
  if (saturn && saturnIn) { ringLine(ctx, saturn.front, 1.4 * b.s); ringLine(ctx, saturnIn.front, 1 * b.s); }
  if (uranus) ringLine(ctx, uranus.front, 1 * b.s);
  if (name === 'earth' && !moonBehind) drawMoon(ctx, L, S);
}

function drawMoon(ctx: CanvasRenderingContext2D, L: Layout, S: Snapshot): void {
  const mo = S.moon;
  ctx.save();
  ctx.translate(mo.x, mo.y);
  ctx.fillStyle = BLUE;
  ctx.fill(disc(0, 0, mo.R + 1));
  ctx.fillStyle = DIM;
  ctx.globalAlpha *= 0.6;
  ctx.fill(disc(0, 0, mo.R));
  ctx.globalAlpha /= 0.6;
  ctx.fillStyle = BLUE;
  ctx.beginPath();
  litShape(mo.R, mo.toSun, mo.phase).forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
  ctx.fill();
  ctx.scale(mo.s, mo.s);
  drawStroke(ctx, L.rims[8]!, 1);
  ctx.restore();
}

export const blueprintSpiral: Scene = {
  name: 'spiral-blueprint',
  duration: (INTRO + LOOP) / 12,
  loopFrom: INTRO / 12,
  poster: (INTRO + POSTER_M) / 12,
  draw(f) {
    const { stage } = f;
    const fr = frameFit(stage.w, stage.h), L = layout(), S = snapshot(spiralSky(f)), n = drawnFrame(f);
    ground(f, BLUE, { seed: 2100, texture: 1.4, vignette: 0.45, vignetteColor: '#06182c' });
    still(f, 'sp01-grid', g => {
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

    // everything chalk goes on one layer so the paper's tooth can break it
    const layer = scratch(f, 'sp01-chalk', g => {
      const c = g.ctx;
      enter(c, fr);
      const fx = { ...g, ctx: c };
      // dust the system flies through: fine specks of chalk
      c.fillStyle = CHALK;
      for (const d of dust(S)) {
        c.globalAlpha = d.alpha * (0.25 + d.tone * 0.45);
        c.fill(disc(d.x, d.y, (0.6 + d.tone * 0.9) * d.s));
      }
      c.globalAlpha = 1;
      const intro = clamp(n / 12, 0, 1);
      paint(S, {
        run: (t, run, near) => inWake(c, S, () => {
          const moon = t.k === 8, w = moon ? 1.2 : t.k < 4 ? 2.2 : 2.7;
          c.strokeStyle = CHALK;
          strokeRun(c, run, near ? 4 : DASH, s => {
            if (!near && Math.floor(s.q / DASH) % 2) return null;
            const life = 1 - s.age;
            return { width: w * s.s * (near ? 1 : 0.7), alpha: Math.pow(life, 1.3) * (near ? 1 : 0.75) };
          });
          // the newest stretch in pencil
          c.strokeStyle = PENCIL;
          strokeRun(c, run, 4, s => (s.age < 0.14 && (near || Math.floor(s.q / DASH) % 2 === 0) ? { width: (w + 1.4) * s.s, alpha: (1 - s.age / 0.14) * 0.95 } : null));
        }),
        orbit(_pl, half, near) {
          c.strokeStyle = DIM;
          c.lineWidth = near ? 1.1 : 0.9;
          c.globalAlpha = intro * (near ? 0.75 : 0.5);
          if (!near) c.setLineDash([3, 6]);
          c.beginPath();
          trace(c, half);
          c.stroke();
          c.setLineDash([]);
          c.globalAlpha = 1;
        },
        rocks(rocks) {
          c.fillStyle = DIM;
          c.globalAlpha = 0.8;
          c.beginPath();
          for (const r of rocks) { const s = r.rock.size * r.s * 0.8; c.moveTo(r.x + s, r.y); c.arc(r.x, r.y, s, 0, TAU); }
          c.fill();
          c.globalAlpha = 1;
        },
        sunTrail: st => inWake(c, S, () => {
          // the axis: a chain line, long dash and short, riding back with the path
          c.strokeStyle = CHALK;
          const period = 24 * SUB;
          strokeRun(c, st, 2, s => {
            const ph = s.q % period;
            if (!(ph < 30 || (ph >= 36 && ph < 40))) return null;
            return { width: 1.2 * s.s, alpha: Math.pow(1 - s.age, 1.2) * 0.8 };
          });
        }),
        sun() {
          const sx = S.sun.x, sy = S.sun.y;
          const glow = c.createRadialGradient(sx, sy, 0, sx, sy, SUN_R * 2.8);
          glow.addColorStop(0, 'rgba(243,214,122,0.42)');
          glow.addColorStop(0.4, 'rgba(243,214,122,0.18)');
          glow.addColorStop(1, 'rgba(243,214,122,0)');
          c.fillStyle = glow;
          c.fillRect(sx - SUN_R * 2.8, sy - SUN_R * 2.8, SUN_R * 5.6, SUN_R * 5.6);
          c.fillStyle = BLUE;
          c.globalAlpha = 0.9;
          c.fill(disc(sx, sy, SUN_R));
          c.globalAlpha = 1;
          drawGroup(fx, L.sun, L.sunSlots);
        },
        body: b => drawBody(c, L, S, b),
      });
      drawGroup(fx, L.notes, L.noteSlots);
      knockOut(f, g.ctx, toothMask(f, { seed: 2190, density: 26, size: 1.1, kind: 'speck' }), 0.35);
    });
    composite(f, layer);
  },
};
