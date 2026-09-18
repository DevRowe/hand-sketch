/**
 * S09 "Bauhaus" (the solar system from above; Bauhaus geometry). Primary colours and pure geometry on bone paper,
 * whole from the start, screen-printed: a black band and a red square head the sheet, a blue quarter-disc anchors the
 * lower left, and over them the plan in hard black circles of two weights. The Sun is a red disc in a yellow one; each
 * planet is a flat circle split exactly in two, its colour on the sunward half and black on the other, turning as it
 * goes; the belt is a ring of small black squares, each squared to its orbit.
 *
 * The colours print on one screen and the black on another, a hair out of register; both show the mesh's tooth.
 */
import { TAU, type Vec2 } from '../../core/math';
import type { Scene } from '../../core/scene';
import { ground, ink, polyPath } from '../gallery/common';
import { annulus, BELT, BOX, C, dayHalf, disc, enter, frameFit, LOOP, MOON, moonOffset, PLANETS, planetAt, POSTER_M, RINGS, ROCKS, rockAt, SUN_R, sunward, URANUS_RING, type PlanetName } from './common';
import { skyOf } from './sky';
import { orbitTrail } from './trails';
import { SOLAR } from './palettes';

const PAL = SOLAR.bauhaus;
const [RED, YELLOW, BLUE] = PAL.fills as [string, string, string, string];
const BLACK = PAL.ink, BONE = PAL.paper;
const COLOR: Record<PlanetName, string> = { mercury: BONE, venus: YELLOW, earth: BLUE, mars: RED, jupiter: YELLOW, saturn: YELLOW, uranus: BLUE, neptune: BLUE };
/** Heavy rings mark the belt's edges and the outermost orbit; the rest are fine. */
const HEAVY = new Set<PlanetName>(['neptune']);

const at = (x: number, y: number, pts: readonly Vec2[]): Vec2[] => pts.map(([u, v]): Vec2 => [x + u, y + v]);

export const bauhausScene: Scene = {
  name: 'solar-bauhaus',
  duration: LOOP / 12,
  loopFrom: 0,
  poster: POSTER_M / 12,
  draw(f) {
    const { stage } = f;
    const fr = frameFit(stage.w, stage.h), sky = skyOf(f, 0);
    ground(f, BONE, { seed: 1900, texture: 0.9 });
    const tooth = (seed: number) => ({ seed, density: 45, size: 1.2, alpha: 0.28 });

    // the colour screen
    ink(f, 's09-colour', g => {
      const c = g.ctx;
      enter(c, fr);
      c.fillStyle = BLUE;
      c.beginPath();
      c.moveTo(0, BOX);
      // sized to stay just clear of Neptune's orbit, so no planet crosses it colour on colour
      c.arc(0, BOX, 262, -Math.PI / 2, 0);
      c.closePath();
      c.fill();
      c.fillStyle = RED;
      c.fillRect(BOX - 96, 0, 96, 96);
      c.fillStyle = YELLOW;
      c.fill(disc(C[0], C[1], SUN_R + 30));
      c.fillStyle = RED;
      c.fill(disc(C[0], C[1], SUN_R));
      // a viewer's trails: flat bands of each planet's colour
      for (const p of PLANETS) orbitTrail(c, p, sky, { color: p.name === 'mercury' ? BLACK : COLOR[p.name], width: Math.max(3, p.r * 0.75), tail: 0.2, cap: 'butt' });
      for (const p of PLANETS) {
        const [x, y] = planetAt(p, sky), toSun = sunward([x, y]);
        if (p.name === 'saturn') {
          c.fillStyle = RED;
          c.fill(annulus(x, y, RINGS.inner + 3, RINGS.outer - 3, RINGS.squash, RINGS.angle));
        }
        c.fillStyle = COLOR[p.name];
        c.fill(polyPath(at(x, y, dayHalf(p.r, toSun))));
        if (p.name === 'jupiter') {
          c.save();
          c.clip(polyPath(at(x, y, dayHalf(p.r, toSun))));
          c.fillStyle = RED;
          for (const [y0, h] of [[-17, 6], [-4, 7], [9, 5]] as const) c.fillRect(x - p.r, y + y0, p.r * 2, h);
          c.restore();
        }
        if (p.name === 'earth') {
          const [mx, my] = moonOffset(sky);
          c.fillStyle = YELLOW;
          c.fill(disc(x + mx, y + my, MOON.r + 0.5));
        }
      }
    }, { tooth: tooth(1901), blend: 'source-over' });

    // the black screen
    ink(f, 's09-black', g => {
      const c = g.ctx;
      enter(c, fr);
      c.fillStyle = BLACK;
      c.fillRect(0, 0, BOX - 96, 22);
      c.fillRect(BOX - 22, 96, 22, BOX - 96);
      c.strokeStyle = BLACK;
      c.lineWidth = 1.6;
      c.beginPath();
      for (const p of PLANETS) {
        if (HEAVY.has(p.name)) continue;
        c.moveTo(C[0] + p.a, C[1]);
        c.arc(C[0], C[1], p.a, 0, TAU);
      }
      c.stroke();
      c.lineWidth = 6;
      c.beginPath();
      for (const p of PLANETS) {
        if (!HEAVY.has(p.name)) continue;
        c.moveTo(C[0] + p.a, C[1]);
        c.arc(C[0], C[1], p.a, 0, TAU);
      }
      c.stroke();
      c.lineWidth = 3;
      c.beginPath();
      for (const r of [BELT.inner - 6, BELT.outer + 6]) { c.moveTo(C[0] + r, C[1]); c.arc(C[0], C[1], r, 0, TAU); }
      c.stroke();
      // the Sun's black ring
      c.lineWidth = 2.4;
      c.beginPath();
      c.arc(C[0], C[1], SUN_R + 30, 0, TAU);
      c.stroke();
      // the orbit lines stop at each planet's rim: a planet is a shape laid over the plan, not threaded on it
      c.save();
      c.globalCompositeOperation = 'destination-out';
      for (const p of PLANETS) {
        const [x, y] = planetAt(p, sky);
        c.fill(disc(x, y, p.r));
        if (p.name === 'saturn') c.fill(annulus(x, y, RINGS.inner + 1, RINGS.outer - 1, RINGS.squash, RINGS.angle));
      }
      c.restore();
      // the belt: small squares, each turned square to its orbit
      for (const rk of ROCKS) {
        const [x, y] = rockAt(rk, sky), a = sky.rock(rk.i, sky.now), s = 1.4 + rk.size * 1.1;
        c.save();
        c.translate(x, y);
        c.rotate(a);
        c.fillRect(-s / 2, -s / 2, s, s);
        c.restore();
      }
      for (const p of PLANETS) {
        const [x, y] = planetAt(p, sky), toSun = sunward([x, y]);
        if (p.name === 'saturn') {
          c.lineWidth = 2.4;
          c.beginPath();
          c.ellipse(x, y, RINGS.outer, RINGS.outer * RINGS.squash, RINGS.angle, 0, TAU);
          c.stroke();
          c.lineWidth = 1.4;
          c.beginPath();
          c.ellipse(x, y, RINGS.inner, RINGS.inner * RINGS.squash, RINGS.angle, 0, TAU);
          c.stroke();
        }
        if (p.name === 'uranus') {
          c.lineWidth = 2;
          c.beginPath();
          c.ellipse(x, y, URANUS_RING.rx, URANUS_RING.ry, URANUS_RING.angle, 0, TAU);
          c.stroke();
        }
        c.fill(polyPath(at(x, y, dayHalf(p.r, toSun + Math.PI))));
        c.lineWidth = 2;
        c.beginPath();
        c.arc(x, y, p.r, 0, TAU);
        c.stroke();
        if (p.name === 'earth') {
          const [mx, my] = moonOffset(sky);
          c.lineWidth = 1.2;
          c.beginPath();
          c.arc(x + mx, y + my, MOON.r + 0.5, 0, TAU);
          c.stroke();
        }
      }
    }, { tooth: tooth(1902), offset: [1.4, -1] });
  },
};
