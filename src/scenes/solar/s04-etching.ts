/**
 * S04 "Etching" (the solar system from above; two-plate etching). An intaglio print on warm plate paper, whole from
 * the start, inside the bevelled platemark. The cold plate carries the sky: page-locked hatching that deepens outward
 * in three passes, burnished back to clean paper along every orbit and around the Sun. The warm plate carries the Sun
 * (a pale disc engraved in rings, ringed by a burst of bitten rays) and the planets, each modelled by line alone:
 * sparse contour lines on the day side, close cross-hatching on the night side, turned to face the Sun as it goes.
 *
 * Tone is only ever the density of lines, and the sky's lines never move.
 */
import { cursive } from '../../art/glyphs';
import { TAU, type Vec2 } from '../../core/math';
import { rng } from '../../core/random';
import type { Scene, SceneFrame } from '../../core/scene';
import { cached, ground, hatchLines, ink, still } from '../gallery/common';
import { annulus, BELT, BOX, C, disc, enter, frameFit, LOOP, MOON, moonOffset, PLANETS, planetAt, POSTER_M, RINGS, ROCKS, rockAt, SUN_R, sunward, URANUS_RING, type Frame, type Planet } from './common';
import { skyOf, type Sky } from './sky';
import { orbitTrail } from './trails';
import { SOLAR } from './palettes';

const PAL = SOLAR.etching;
const COLD = PAL.inks[0]!, WARM = PAL.inks[1]!, PAPER = PAL.paper;
const [PLATE_TONE, MARK] = PAL.fills as [string, string];
/** The plate's edge in design units: a narrow margin of paper outside it, the lettering in its lower corners. */
const PLATE = { x: 18, y: 18, w: BOX - 36, h: BOX - 36 } as const;
const BOX_ALL = [0, 0, BOX, BOX] as const;

/** A path of the plate area less clean channels round each orbit and a clearing round the Sun, for the sky's hatching. */
function skyClip(outerFrom: number): Path2D {
  const p = new Path2D();
  p.rect(PLATE.x + 6, PLATE.y + 6, PLATE.w - 12, PLATE.h - 12);
  p.moveTo(C[0] + outerFrom, C[1]);
  p.arc(C[0], C[1], outerFrom, 0, TAU, true);
  return p;
}

/** Thin burnished channels either side of each orbit line, and the belt's band. */
function channels(): Path2D {
  const p = new Path2D();
  for (const pl of PLANETS) {
    p.moveTo(C[0] + pl.a + 5, C[1]);
    p.arc(C[0], C[1], pl.a + 5, 0, TAU);
    p.moveTo(C[0] + pl.a - 5, C[1]);
    p.arc(C[0], C[1], pl.a - 5, 0, TAU, true);
  }
  return p;
}

/** The cold plate: sky hatching in three bites, deepening outward, burnished along the orbits. */
function coldPlate(g: SceneFrame, fr: Frame): void {
  const c = g.ctx;
  enter(c, fr);
  c.save();
  // burnish the channels: clip to everything except them (even-odd with the plate)
  const clip = new Path2D();
  clip.rect(0, 0, BOX, BOX);
  clip.addPath(channels());
  c.clip(clip, 'evenodd');
  hatchLines(c, skyClip(SUN_R + 70), BOX_ALL, { angle: 0.42, gap: 5.2, color: COLD, width: 0.85, alpha: 0.75, waver: 0.6, seed: 1401 });
  hatchLines(c, skyClip(BELT.outer + 30), BOX_ALL, { angle: -0.5, gap: 5.6, color: COLD, width: 0.8, alpha: 0.7, waver: 0.6, seed: 1402 });
  hatchLines(c, skyClip(PLANETS[6]!.a + 12), BOX_ALL, { angle: 1.25, gap: 4.6, color: COLD, width: 0.8, alpha: 0.75, waver: 0.5, seed: 1403, breakup: 0.1 });
  c.restore();
  // stars: bright points burnished out of the hatching, each with a tiny bitten cross
  const r = rng(1404);
  for (let k = 0; k < 70; k++) {
    const x = PLATE.x + 20 + r() * (PLATE.w - 40), y = PLATE.y + 20 + r() * (PLATE.h - 40), d = Math.hypot(x - C[0], y - C[1]);
    if (d < BELT.outer + 40 || PLANETS.some(p => Math.abs(d - p.a) < 12)) continue;
    const s = 2 + r() * 3.5;
    c.fillStyle = PAPER;
    c.beginPath();
    c.arc(x, y, s, 0, TAU);
    c.fill();
    c.strokeStyle = COLD;
    c.lineWidth = 0.8;
    c.beginPath();
    c.moveTo(x - s * 1.6, y); c.lineTo(x + s * 1.6, y);
    c.moveTo(x, y - s * 1.6); c.lineTo(x, y + s * 1.6);
    c.stroke();
  }
  // the orbits themselves: one fine bitten line down each channel, and a dotted pair for the belt
  c.strokeStyle = COLD;
  c.lineWidth = 1.1;
  c.save();
  c.beginPath();
  c.rect(PLATE.x, PLATE.y, PLATE.w, PLATE.h);
  c.clip();
  c.beginPath();
  for (const pl of PLANETS) { c.moveTo(C[0] + pl.a, C[1]); c.arc(C[0], C[1], pl.a, 0, TAU); }
  c.stroke();
  c.lineWidth = 0.8;
  c.setLineDash([1.5, 5]);
  c.beginPath();
  for (const r0 of [BELT.inner, BELT.outer]) { c.moveTo(C[0] + r0, C[1]); c.arc(C[0], C[1], r0, 0, TAU); }
  c.stroke();
  c.setLineDash([]);
  c.restore();
  // the sky ends in a clean circle; the lettering sits in the plate's lower corners, in a copperplate hand: the title
  // right, the engraver left
  c.save();
  c.globalCompositeOperation = 'destination-out';
  c.fill(annulus(C[0], C[1], PLANETS[7]!.a + 16, 900));
  c.restore();
  c.lineWidth = 1.6;
  c.beginPath();
  c.arc(C[0], C[1], PLANETS[7]!.a + 16, 0, TAU);
  c.stroke();
  // a ruled double border inside the plate, and the two upper spandrels engraved as fans of rays
  const i0 = PLATE.x + 12, i1 = PLATE.x + PLATE.w - 12;
  c.lineWidth = 1.3;
  c.strokeRect(i0, i0, i1 - i0, i1 - i0);
  c.lineWidth = 0.7;
  c.strokeRect(i0 + 5, i0 + 5, i1 - i0 - 10, i1 - i0 - 10);
  c.lineWidth = 0.75;
  c.save();
  const corners = new Path2D();
  corners.rect(i0 + 5, i0 + 5, i1 - i0 - 10, i1 - i0 - 10);
  corners.moveTo(C[0] + PLANETS[7]!.a + 24, C[1]);
  corners.arc(C[0], C[1], PLANETS[7]!.a + 24, 0, TAU);
  c.clip(corners, 'evenodd');
  c.beginPath();
  for (const [cx, sx] of [[i0 + 5, 1], [i1 - 5, -1]] as const) {
    for (let k = 0; k <= 36; k++) {
      const a = (k / 36) * (Math.PI / 2), len = k % 6 === 0 ? 210 : k % 2 === 0 ? 150 : 110;
      c.moveTo(cx, i0 + 5);
      c.lineTo(cx + sx * Math.cos(a) * len, i0 + 5 + Math.sin(a) * len);
    }
  }
  c.stroke();
  c.restore();
  c.strokeStyle = COLD;
  c.lineWidth = 1.1;
  c.lineJoin = 'round';
  for (const [x0, x1, y, seed] of [[892, 1030, 1012, 1405], [936, 1030, 1036, 1406], [50, 150, 1036, 1407]] as const) {
    const pts = cursive(x0, x1, y, seed, { height: 7, step: 8 });
    c.beginPath();
    pts.forEach(([x, y], k) => (k ? c.lineTo(x, y) : c.moveTo(x, y)));
    c.stroke();
  }
}

/** The Sun on the warm plate: a disc engraved in rings, a burst of bitten rays round it. */
function sunPlate(c: CanvasRenderingContext2D): void {
  c.strokeStyle = WARM;
  c.lineCap = 'round';
  const r = rng(1410);
  c.lineWidth = 0.9;
  c.beginPath();
  for (let k = 0; k < 180; k++) {
    const a = (k / 180) * TAU + (r() - 0.5) * 0.01, r0 = SUN_R + 5 + r() * 3, r1 = SUN_R + 22 + (k % 3 === 0 ? 38 : k % 3 === 1 ? 18 : 8) + r() * 10;
    c.moveTo(C[0] + Math.cos(a) * r0, C[1] + Math.sin(a) * r0);
    c.lineTo(C[0] + Math.cos(a) * r1, C[1] + Math.sin(a) * r1);
  }
  c.stroke();
  c.lineWidth = 0.8;
  c.beginPath();
  for (let rr = 6; rr < SUN_R; rr += 5) { c.moveTo(C[0] + rr, C[1]); c.arc(C[0], C[1], rr, 0, TAU); }
  c.stroke();
  // limb darkening: a band of short strokes round the inside of the rim
  c.save();
  c.clip(disc(C[0], C[1], SUN_R));
  hatchLines(c, annulus(C[0], C[1], SUN_R - 12, SUN_R + 2), [C[0] - SUN_R, C[1] - SUN_R, SUN_R * 2, SUN_R * 2], { angle: 0.8, gap: 2.6, color: WARM, width: 0.7, alpha: 0.9, waver: 0.2, seed: 1411 });
  c.restore();
  c.lineWidth = 1.8;
  c.beginPath();
  c.arc(C[0], C[1], SUN_R, 0, TAU);
  c.stroke();
}

/** A planet modelled by line: day-side contours, night-side cross-hatching turned to the Sun. */
function planetPlate(c: CanvasRenderingContext2D, p: Planet, sky: Sky): void {
  const [x, y] = planetAt(p, sky), toSun = sunward([x, y]), r = p.r;
  c.save();
  c.translate(x, y);
  if (p.name === 'saturn') {
    // the ring: engraved in concentric lines, the planet's shadow falling across it away from the Sun
    c.fillStyle = PAPER;
    c.fill(annulus(0, 0, RINGS.inner - 2, RINGS.outer + 2, RINGS.squash, RINGS.angle));
    c.strokeStyle = WARM;
    c.lineWidth = 0.7;
    c.beginPath();
    for (let rr = RINGS.inner; rr <= RINGS.outer; rr += 2.4) {
      if (Math.abs(rr - 34) < 1.3) continue;
      c.moveTo(Math.cos(RINGS.angle) * rr, Math.sin(RINGS.angle) * rr);
      c.ellipse(0, 0, rr, rr * RINGS.squash, RINGS.angle, 0, TAU);
    }
    c.stroke();
    c.save();
    c.rotate(toSun + Math.PI);
    c.beginPath();
    c.rect(0, -r, RINGS.outer + 4, r * 2);
    c.restore();
    c.save();
    c.clip();
    c.clip(annulus(0, 0, RINGS.inner - 1, RINGS.outer + 1, RINGS.squash, RINGS.angle));
    c.fillStyle = WARM;
    c.globalAlpha *= 0.55;
    c.fillRect(-60, -60, 120, 120);
    c.restore();
  }
  c.fillStyle = PAPER;
  c.fill(disc(0, 0, r + 1.5));
  c.save();
  c.clip(disc(0, 0, r));
  c.rotate(toSun);
  c.strokeStyle = WARM;
  c.lineCap = 'round';
  // contour lines of the sphere, closer together towards the terminator
  c.lineWidth = r > 20 ? 0.8 : 0.65;
  c.beginPath();
  const lines = Math.max(3, Math.round(r / 2.6));
  for (let j = 1; j < lines; j++) {
    const u = -1 + (2 * j) / lines, yy = u * r, half = Math.sqrt(1 - u * u) * r;
    c.moveTo(-half * 0.2, yy);
    c.quadraticCurveTo(half * 0.5, yy + u * r * 0.18, half, yy);
  }
  c.stroke();
  if (p.name === 'jupiter' || p.name === 'saturn') {
    // cloud belts engraved across, fixed in space
    c.rotate(-toSun);
    c.lineWidth = 0.75;
    c.beginPath();
    for (const [y0, y1] of (p.name === 'jupiter' ? [[-18, -12], [-5, 1], [8, 12], [17, 20]] : [[-8, -4], [5, 8]]) as [number, number][]) {
      for (let yy = y0; yy <= y1; yy += 1.6) { c.moveTo(-r, yy); c.lineTo(r, yy + 0.8); }
    }
    c.stroke();
    if (p.name === 'jupiter') {
      c.fillStyle = PAPER;
      c.beginPath();
      c.ellipse(7, 4.5, 5.5, 3, 0, 0, TAU);
      c.fill();
      c.lineWidth = 0.8;
      c.stroke();
    }
    c.rotate(toSun);
  }
  // the night side: two crossing passes, a third in the deepest part
  c.beginPath();
  c.rect(-r - 2, -r - 2, r * 1.05 + 2, r * 2 + 4);
  c.clip();
  c.lineWidth = 0.7;
  c.beginPath();
  for (let u = -r * 2; u < r * 2; u += 1.9) { c.moveTo(u, -r - 2); c.lineTo(u + r * 0.35, r + 2); }
  c.stroke();
  c.beginPath();
  for (let u = -r * 2; u < r * 2; u += 2.2) { c.moveTo(-r - 2, u); c.lineTo(r + 2, u + r * 0.3); }
  c.stroke();
  c.beginPath();
  c.rect(-r - 2, -r - 2, r * 0.7, r * 2 + 4);
  c.clip();
  c.beginPath();
  for (let u = -r * 2; u < r * 2; u += 2) { c.moveTo(u, -r - 2); c.lineTo(u - r * 0.6, r + 2); }
  c.stroke();
  c.restore();
  c.strokeStyle = WARM;
  c.lineWidth = r > 20 ? 1.5 : 1.2;
  c.beginPath();
  c.arc(0, 0, r, 0, TAU);
  c.stroke();
  if (p.name === 'uranus') {
    c.lineWidth = 0.8;
    c.beginPath();
    c.ellipse(0, 0, URANUS_RING.rx, URANUS_RING.ry, URANUS_RING.angle, 0, TAU);
    c.stroke();
  }
  if (p.name === 'earth') {
    const [mx, my] = moonOffset(sky);
    c.setLineDash([1.2, 3]);
    c.lineWidth = 0.7;
    c.beginPath();
    c.arc(0, 0, MOON.a, 0, TAU);
    c.stroke();
    c.setLineDash([]);
    c.fillStyle = PAPER;
    c.fill(disc(mx, my, MOON.r + 1));
    c.lineWidth = 0.9;
    c.beginPath();
    c.arc(mx, my, MOON.r, 0, TAU);
    c.stroke();
    c.save();
    c.clip(disc(mx, my, MOON.r));
    c.translate(mx, my);
    c.rotate(sunward([x + mx, y + my]));
    c.beginPath();
    for (let u = -MOON.r; u < 0; u += 1.4) { c.moveTo(u, -MOON.r); c.lineTo(u, MOON.r); }
    c.stroke();
    c.restore();
  }
  c.restore();
}

export const etchingScene: Scene = {
  name: 'solar-etching',
  duration: LOOP / 12,
  loopFrom: 0,
  poster: POSTER_M / 12,
  draw(f) {
    const { stage } = f;
    const fr = frameFit(stage.w, stage.h), sky = skyOf(f, 0);
    ground(f, PAPER, { seed: 1400, texture: 0.9 });
    // the platemark: a film of plate tone inside, the bevel pressed into the paper
    still(f, 's04-platemark', g => {
      const c = g.ctx;
      enter(c, fr);
      c.fillStyle = PLATE_TONE;
      c.globalAlpha = 0.55;
      c.fillRect(PLATE.x, PLATE.y, PLATE.w, PLATE.h);
      c.globalAlpha = 1;
      c.lineWidth = 2.2;
      c.strokeStyle = MARK;
      c.beginPath();
      c.moveTo(PLATE.x, PLATE.y + PLATE.h); c.lineTo(PLATE.x, PLATE.y); c.lineTo(PLATE.x + PLATE.w, PLATE.y);
      c.stroke();
      c.strokeStyle = 'rgba(255,255,255,0.7)';
      c.beginPath();
      c.moveTo(PLATE.x + PLATE.w + 1.5, PLATE.y); c.lineTo(PLATE.x + PLATE.w + 1.5, PLATE.y + PLATE.h + 1.5); c.lineTo(PLATE.x, PLATE.y + PLATE.h + 1.5);
      c.stroke();
    }, { blend: 'multiply' });
    // the cold plate, wiped clean where a planet stands (its sky lines must not show through the sphere)
    const cold = cached(f, 's04-cold', g => coldPlate(g, fr));
    ink(f, 's04-cold', g => {
      const c = g.ctx;
      g.stage.blit(c, cold);
      enter(c, fr);
      c.globalCompositeOperation = 'destination-out';
      for (const p of PLANETS) {
        const [x, y] = planetAt(p, sky);
        c.fill(disc(x, y, p.r + 1.5));
        if (p.name === 'saturn') c.fill(annulus(x, y, RINGS.inner - 2, RINGS.outer + 2, RINGS.squash, RINGS.angle));
        if (p.name === 'earth') {
          const [mx, my] = moonOffset(sky);
          c.fill(disc(x + mx, y + my, MOON.r + 1));
        }
      }
    });
    // the warm plate, printed second and a hair off
    ink(f, 's04-warm', g => {
      const c = g.ctx;
      enter(c, fr);
      sunPlate(c);
      c.fillStyle = WARM;
      c.beginPath();
      for (const rk of ROCKS) {
        const [x, y] = rockAt(rk, sky), s = 0.5 + rk.size * 0.55;
        c.moveTo(x + s, y);
        c.arc(x, y, s, 0, TAU);
      }
      c.fill();
      // a viewer's trails: a fine engraved line back along each orbit
      for (const p of PLANETS) orbitTrail(c, p, sky, { color: WARM, width: 1.6, tail: 0.4 });
      for (const p of PLANETS) planetPlate(c, p, sky);
    }, { offset: [0.8, 0.6] satisfies Vec2 });
  },
};
