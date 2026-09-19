/**
 * S05 "Riso" (the solar system from above; risograph poster). Three drum inks, medium blue, fluorescent pink and
 * yellow, overprinting on warm stock inside a paper margin, whole from the start. Each ink is its own plate with its
 * own halftone screen angle, its own misregistration and its own starved, uneven coverage; every colour that is not
 * one of the three is two of them printed over each other (the Sun's orange, the Earth's green, Neptune's violet).
 *
 * The sky's halftone deepens outward and stays fixed to the page; the planets carry their plates with them, the
 * night half of each screened in blue, and a pink screen of their recent path fades out behind them.
 */
import { TAU, type Vec2 } from '../../core/math';
import { rng } from '../../core/random';
import type { Scene, SceneFrame } from '../../core/scene';
import { cached, ground, ink, polyPath, screen, type InkOptions } from '../gallery/common';
import { annulus, BOX, C, dayHalf, disc, enter, frameFit, LOOP, MOON, moonOffset, pageOf, planetAngle, planetAt, PLANETS, POSTER_M, RINGS, rockAt, ROCKS, roomOf, starsBeyond, SUN_R, sunward, URANUS_RING, type Frame, type Planet, type PlanetName } from './common';
import { skyOf, trailSweep, type Sky } from './sky';
import { SOLAR } from './palettes';

const PAL = SOLAR.riso;
const [BLUE, PINK, YELLOW] = PAL.inks as [string, string, string];
const STOCK = PAL.paper;
const MARGIN = 34;
const ANGLE = { blue: 0.26, pink: 1.31, yellow: 0 } as const;
const CELL = 6.5;
const AREA = [MARGIN, MARGIN, BOX - 2 * MARGIN, BOX - 2 * MARGIN] as const;

type Plate = 'blue' | 'pink' | 'yellow';
/** Each planet's recipe: coverage per plate (1 is solid). */
const RECIPE: Record<PlanetName, Partial<Record<Plate, number>>> = {
  mercury: { blue: 0.4, pink: 0.35 },
  venus: { yellow: 1, pink: 0.3 },
  earth: { blue: 1 },
  mars: { pink: 1, yellow: 0.8 },
  jupiter: { yellow: 1, pink: 0.25 },
  saturn: { yellow: 1, pink: 0.12 },
  uranus: { blue: 0.45, yellow: 0.7 },
  neptune: { blue: 1, pink: 0.3 },
};
/** How far each planet's pink wake reaches behind it, in design units of its orbit. */
const WAKE = 120;

const plateOpts = (seed: number, offset: Vec2): InkOptions => ({
  offset,
  tooth: { seed, density: 55, size: 1.4, alpha: 0.4 },
});

/** Fill `path` on plate `color` at `cover`: solid at 1, a page-locked screen below it. */
function tone(c: CanvasRenderingContext2D, path: Path2D, box: readonly [number, number, number, number], cover: number, color: string, angle: number): void {
  if (cover >= 0.99) {
    c.fillStyle = color;
    c.fill(path);
  } else if (cover > 0) {
    screen(c, box, { cell: CELL, angle, color, density: cover, clip: path });
  }
}

/** The sky on the blue plate: a screen deepening outward, stars left as paper, and the orbit lines. */

/**
 * The blue field and its stars: in a render, the design box inside its margin; live, the whole page, so the plate
 * runs on under the explorer's controls instead of leaving a bare margin round a square.
 */
function fieldOf(f: SceneFrame, fr: Frame): { area: readonly [number, number, number, number]; stars: readonly [number, number, number][]; key: string } {
  if (!roomOf(f)) return { area: AREA, stars: STARS, key: '' };
  const p = pageOf(fr, f.stage.w, f.stage.h);
  return { area: [p[0], p[1], p[2] - p[0], p[3] - p[1]], stars: [...STARS, ...starsBeyond(p, STARS.length, 1509)], key: ':page' };
}

function blueSky(g: SceneFrame, fr: Frame): void {
  const c = g.ctx, field = fieldOf(g, fr);
  enter(c, fr);
  const area = new Path2D();
  area.rect(...field.area);
  screen(c, field.area, {
    cell: CELL, angle: ANGLE.blue, color: BLUE, clip: area,
    density: (x, y) => {
      const d = Math.hypot(x - C[0], y - C[1]);
      return 0.12 + 0.78 * Math.min(1, Math.max(0, (d - 110) / 520)) ** 1.2;
    },
  });
  // stars: paper punched out of the screen (the yellow plate prints into them)
  c.save();
  c.globalCompositeOperation = 'destination-out';
  for (const [x, y, s] of field.stars) {
    c.beginPath();
    c.arc(x, y, s + 3.5, 0, TAU);
    c.fill();
  }
  c.restore();
  c.save();
  c.clip(area);
  c.strokeStyle = BLUE;
  c.lineWidth = 2;
  c.beginPath();
  for (const p of PLANETS) { c.moveTo(C[0] + p.a, C[1]); c.arc(C[0], C[1], p.a, 0, TAU); }
  c.stroke();
  c.restore();
}

const STARS: readonly [number, number, number][] = (() => {
  const r = rng(1501), out: [number, number, number][] = [];
  while (out.length < 46) {
    const x = MARGIN + 10 + r() * (BOX - 2 * MARGIN - 20), y = MARGIN + 10 + r() * (BOX - 2 * MARGIN - 20), d = Math.hypot(x - C[0], y - C[1]), s = 1.2 + Math.pow(r(), 2) * 3.4;
    if (d < 300 || PLANETS.some(p => Math.abs(d - p.a) < 10)) continue;
    out.push([x, y, s]);
  }
  return out;
})();

const bbox = (x: number, y: number, r: number): readonly [number, number, number, number] => [x - r - CELL, y - r - CELL, 2 * (r + CELL), 2 * (r + CELL)];

/** Everything planet `p` lays on one plate. */
function planetOn(c: CanvasRenderingContext2D, plate: Plate, p: Planet, sky: Sky): void {
  const [x, y] = planetAt(p, sky), toSun = sunward([x, y]), r = p.r, color = plate === 'blue' ? BLUE : plate === 'pink' ? PINK : YELLOW, angle = ANGLE[plate];
  const body = disc(x, y, r), box = bbox(x, y, r);
  if (p.name === 'saturn') {
    const ring = annulus(x, y, RINGS.inner, RINGS.outer, RINGS.squash, RINGS.angle), rbox = bbox(x, y, RINGS.outer);
    if (plate === 'pink') tone(c, ring, rbox, 0.55, color, angle);
    if (plate === 'yellow') tone(c, ring, rbox, 0.6, color, angle);
    if (plate === 'blue') tone(c, annulus(x, y, RINGS.inner + 5, RINGS.inner + 7, RINGS.squash, RINGS.angle), rbox, 1, color, angle);
  }
  if (p.name === 'uranus' && plate === 'blue') {
    c.strokeStyle = BLUE;
    c.lineWidth = 1.6;
    c.beginPath();
    c.ellipse(x, y, URANUS_RING.rx, URANUS_RING.ry, URANUS_RING.angle, 0, TAU);
    c.stroke();
  }
  tone(c, body, box, RECIPE[p.name][plate] ?? 0, color, angle);
  if (p.name === 'jupiter' && plate === 'pink') {
    c.save();
    c.clip(body);
    c.fillStyle = PINK;
    for (const [y0, h] of [[-19, 5], [-7, 6], [6, 4], [14, 6]] as const) c.fillRect(x - r, y + y0, r * 2, h);
    c.restore();
  }
  if (p.name === 'earth' && plate === 'yellow') {
    c.save();
    c.translate(x, y);
    c.fillStyle = YELLOW;
    c.fill(polyPath([[-8, -6], [-1, -9], [3, -3], [-2, 2], [-6, 1]]));
    c.fill(polyPath([[3, 3], [9, 1], [8, 8], [4, 9]]));
    c.restore();
  }
  if (p.name === 'earth') {
    const [mx, my] = moonOffset(sky), cover = plate === 'blue' ? 0.35 : plate === 'pink' ? 0.3 : 0;
    tone(c, disc(x + mx, y + my, MOON.r + 0.8), bbox(x + mx, y + my, MOON.r), cover, color, angle);
  }
  // the night half, screened in blue
  if (plate === 'blue') tone(c, polyPath(dayHalf(r, toSun + Math.PI).map(([u, v]): Vec2 => [x + u, y + v])), box, 0.62, BLUE, angle);
}

/** The pink wake behind a planet: a band along its orbit, screened thinner the further back it is. */
function wake(c: CanvasRenderingContext2D, p: Planet, sky: Sky): void {
  const a = planetAngle(p, sky), { sweep: span, alpha } = trailSweep(sky, p.k, WAKE / p.a), w = Math.max(3, p.r * 0.6);
  if (span <= 0 || alpha <= 0) return;
  const band = new Path2D();
  band.arc(C[0], C[1], p.a + w, a, a + span);
  band.arc(C[0], C[1], p.a - w, a + span, a, true);
  band.closePath();
  // a viewer's trail may run right round the orbit: screen the whole ring then
  const [x, y] = planetAt(p, sky), reach = WAKE + p.r, R = p.a + w;
  const far = R + CELL, near = Math.max(0, p.a - w - CELL);
  const box: [number, number, number, number] = sky.trails ? [C[0] - R, C[1] - R, 2 * R, 2 * R] : [x - reach, y - reach, 2 * reach, 2 * reach];
  screen(c, box, {
    cell: CELL, angle: ANGLE.pink, color: PINK, clip: band,
    density: (px, py) => {
      // live, where the box is the whole ring: a dot further from the band than it is wide is clipped away whole, so
      // there is no need to ask how far behind it lies (a render keeps every dot in its path, to the last bit)
      if (sky.trails) {
        const d2 = (px - C[0]) ** 2 + (py - C[1]) ** 2;
        if (d2 > far * far || d2 < near * near) return 0;
      }
      const behind = ((((Math.atan2(py - C[1], px - C[0]) - a) % TAU) + TAU) % TAU) / span;
      return behind <= 1 ? 0.85 * (1 - behind) ** 1.4 * alpha : 0;
    },
  });
}

export const risoScene: Scene = {
  name: 'solar-riso',
  duration: LOOP / 12,
  loopFrom: 0,
  poster: POSTER_M / 12,
  draw(f) {
    const { stage } = f;
    const fr = frameFit(stage.w, stage.h), sky = skyOf(f, 0);
    ground(f, STOCK, { seed: 1500, texture: 0.8 });

    // blue: the sky (wiped clean where a planet stands) and each planet's blue
    const field = fieldOf(f, fr), blue = cached(f, `s05-sky${field.key}`, g => blueSky(g, fr));
    ink(f, 's05-blue', g => {
      const c = g.ctx;
      g.stage.blit(c, blue);
      enter(c, fr);
      c.save();
      c.globalCompositeOperation = 'destination-out';
      for (const p of PLANETS) {
        const [x, y] = planetAt(p, sky);
        c.fill(disc(x, y, p.r + 3));
        if (p.name === 'saturn') c.fill(annulus(x, y, RINGS.inner - 2, RINGS.outer + 2, RINGS.squash, RINGS.angle));
      }
      c.restore();
      c.fillStyle = BLUE;
      c.beginPath();
      for (const rk of ROCKS) {
        const [x, y] = rockAt(rk, sky), s = 0.7 + rk.size * 0.8;
        c.moveTo(x + s, y);
        c.arc(x, y, s, 0, TAU);
      }
      c.fill();
      for (const p of PLANETS) planetOn(c, 'blue', p, sky);
    }, plateOpts(1502, [0, 0]));

    // pink: the Sun's heart and its screened corona, the wakes, the planets' pink
    // the corona never moves: screened once, as a still, and laid first
    const corona = cached(f, 's05-corona', g => {
      enter(g.ctx, fr);
      screen(g.ctx, [C[0] - 220, C[1] - 220, 440, 440], {
        cell: CELL, angle: ANGLE.pink, color: PINK,
        density: (x, y) => {
          const d = Math.hypot(x - C[0], y - C[1]);
          return d < SUN_R ? 1 : Math.max(0, 0.95 - (d - SUN_R) / 150);
        },
      });
    });
    ink(f, 's05-pink', g => {
      const c = g.ctx;
      g.stage.blit(c, corona);
      enter(c, fr);
      for (const p of PLANETS) wake(c, p, sky);
      for (const p of PLANETS) planetOn(c, 'pink', p, sky);
    }, plateOpts(1503, [2.6, -1.8]));

    // yellow: the Sun, the stars, the planets' yellow
    // the Sun, its screen and the stars never move either
    const sun = cached(f, 's05-sun', g => {
      const c = g.ctx;
      enter(c, fr);
      c.fillStyle = YELLOW;
      c.fill(disc(C[0], C[1], SUN_R + 16));
      screen(c, [C[0] - 140, C[1] - 140, 280, 280], {
        cell: CELL, angle: ANGLE.yellow, color: YELLOW,
        density: (x, y) => Math.max(0, 0.9 - (Math.hypot(x - C[0], y - C[1]) - SUN_R - 16) / 70),
      });
      c.beginPath();
      for (const [x, y, s] of field.stars) { c.moveTo(x + s, y); c.arc(x, y, s, 0, TAU); }
      c.fill();
    });
    ink(f, 's05-yellow', g => {
      const c = g.ctx;
      g.stage.blit(c, sun);
      enter(c, fr);
      for (const p of PLANETS) planetOn(c, 'yellow', p, sky);
    }, plateOpts(1504, [-2, 2.2]));
  },
};
