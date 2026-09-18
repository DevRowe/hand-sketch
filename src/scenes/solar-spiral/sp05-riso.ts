/**
 * SP05 "Riso" (the moving solar system at an angle; risograph poster). Three drum inks, medium blue, fluorescent pink
 * and yellow, overprinting on warm stock inside a paper margin, whole from the start. Each ink is its own plate with
 * its own halftone angle, misregistration and starved coverage; every other colour is two of them over each other.
 *
 * The wakes are halftone bands: each planet's recipe of inks, solid at the planet and screened thinner and thinner back
 * along its helix, stepping down in bands as a cheap screen does, printed at half strength where the coil passes
 * behind the Sun's line. The screens stay fixed to the page while the bands move through them, as a printed tone
 * would. The sky's blue screen deepens away from the Sun; the dust the system flies through is flecks of yellow.
 */
import { TAU, type Vec2 } from '../../core/math';
import { rng } from '../../core/random';
import type { Scene, SceneFrame } from '../../core/scene';
import { cached, ground, ink, polyPath, screen, type InkOptions } from '../gallery/common';
import { SOLAR } from '../solar/palettes';
import { bodyBand, bodyRing, BOX, disc, dust, E1, E2, enter, frameFit, INTRO, litShape, LOOP, MOTION, orbitRing, PLANETS, POSTER_M, project, ribbon, RINGS, runs, snapshot, spiralClock, SUN_R, trace, URANUS_RING, type Body, type Frame, type PlanetName, type Sample, type Snapshot } from './common';

const PAL = SOLAR.riso;
const [BLUE, PINK, YELLOW] = PAL.inks as [string, string, string];
const STOCK = PAL.paper;
const MARGIN = 34;
const ANGLE = { blue: 0.26, pink: 1.31, yellow: 0 } as const;
const CELL = 6.5;
const AREA = [MARGIN, MARGIN, BOX - 2 * MARGIN, BOX - 2 * MARGIN] as const;

type Plate = 'blue' | 'pink' | 'yellow';
const INK: Record<Plate, string> = { blue: BLUE, pink: PINK, yellow: YELLOW };
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
/** The wakes' recipes: the planet's, pushed a little towards pink so the bands read against the blue sky. */
const WAKE: Record<PlanetName, Partial<Record<Plate, number>>> = {
  mercury: { pink: 0.7, blue: 0.3 },
  venus: { yellow: 1, pink: 0.45 },
  earth: { blue: 0.8, yellow: 0.6 },
  mars: { pink: 1, yellow: 0.7 },
  jupiter: { yellow: 1, pink: 0.35 },
  saturn: { yellow: 0.9, pink: 0.15 },
  uranus: { yellow: 0.8, blue: 0.35 },
  neptune: { pink: 0.85, blue: 0.5 },
};
const WIDTH = [4.4, 5.6, 6, 5.2, 9.5, 8.2, 7, 7];

const plateOpts = (seed: number, offset: Vec2): InkOptions => ({ offset, tooth: { seed, density: 55, size: 1.4, alpha: 0.4 } });

/** Fill `path` on a plate at `cover`: solid at 1, a page-locked screen below it. */
function tone(c: CanvasRenderingContext2D, path: Path2D, box: readonly [number, number, number, number], cover: number, plate: Plate): void {
  if (cover >= 0.99) {
    c.fillStyle = INK[plate];
    c.fill(path);
  } else if (cover > 0.02) {
    screen(c, box, { cell: CELL, angle: ANGLE[plate], color: INK[plate], density: cover, clip: path });
  }
}

const STARS: readonly [number, number, number][] = (() => {
  const r = rng(2501), out: [number, number, number][] = [];
  const S = project([0, 0, 0]);
  while (out.length < 46) {
    const x = MARGIN + 10 + r() * (BOX - 2 * MARGIN - 20), y = MARGIN + 10 + r() * (BOX - 2 * MARGIN - 20), s = 1.2 + Math.pow(r(), 2) * 3.4;
    if (Math.hypot(x - S.x, y - S.y) < 330) continue;
    out.push([x, y, s]);
  }
  return out;
})();

/** The sky on the blue plate: a screen deepening away from the Sun, stars punched out of it. */
function blueSky(g: SceneFrame, fr: Frame): void {
  const c = g.ctx, S = project([0, 0, 0]);
  enter(c, fr);
  const area = new Path2D();
  area.rect(...AREA);
  screen(c, AREA, {
    cell: CELL, angle: ANGLE.blue, color: BLUE, clip: area,
    density: (x, y) => 0.14 + 0.72 * Math.min(1, Math.max(0, (Math.hypot(x - S.x, y - S.y) - 120) / 620)) ** 1.1,
  });
  c.save();
  c.globalCompositeOperation = 'destination-out';
  for (const [x, y, s] of STARS) c.fill(disc(x, y, s + 3.5));
  c.restore();
}

const bbox = (pts: readonly Vec2[]): readonly [number, number, number, number] => {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  return [x0 - CELL, y0 - CELL, x1 - x0 + 2 * CELL, y1 - y0 + 2 * CELL];
};

/** Samples per band of a wake's stepped screen. */
const BAND = 14;

/** One wake on one plate: bands of stepped coverage, solid near the planet, thinning back; half strength behind. */
function wakeOn(c: CanvasRenderingContext2D, plate: Plate, samples: readonly Sample[], half0: number, cover: number): void {
  if (cover <= 0) return;
  for (const { near, run } of runs(samples)) {
    for (let i = 0; i < run.length - 1; i += BAND) {
      const piece = run.slice(i, Math.min(run.length, i + BAND + 1)), mid = piece[piece.length >> 1]!;
      const band = ribbon(piece, s => half0 * s.s * Math.pow(Math.max(0, 1 - s.age), 0.5) + 0.5);
      const cv = cover * Math.pow(Math.max(0, 1 - mid.age), 0.9) * (near ? 1 : 0.45);
      tone(c, polyPath(band), bbox(band), cv >= 0.8 ? 1 : cv, plate);
    }
  }
}

/** Everything a body lays on one plate. */
function bodyOn(c: CanvasRenderingContext2D, plate: Plate, S: Snapshot, b: Body): void {
  const name = b.planet.name, R = b.R, body = disc(b.x, b.y, R), box = bbox([[b.x - R, b.y - R], [b.x + R, b.y + R]]);
  if (name === 'saturn') {
    const band = bodyBand(b.p, RINGS.inner, RINGS.outer, E1, E2), all = [...band.back, ...band.front], p = new Path2D();
    p.addPath(polyPath(band.back));
    p.addPath(polyPath(band.front));
    tone(c, p, bbox(all), plate === 'pink' ? 0.55 : plate === 'yellow' ? 0.6 : 0, plate);
  }
  if (name === 'uranus' && plate === 'blue') {
    const ring = bodyRing(b.p, URANUS_RING, MOTION, E1);
    c.strokeStyle = BLUE;
    c.lineWidth = 1.6;
    c.beginPath();
    trace(c, [...ring.back, ...ring.front]);
    c.stroke();
  }
  tone(c, body, box, RECIPE[name][plate] ?? 0, plate);
  if (name === 'jupiter' && plate === 'pink') {
    c.save();
    c.clip(body);
    c.fillStyle = PINK;
    for (const [y0, h] of [[-0.68, 0.18], [-0.25, 0.22], [0.2, 0.14], [0.5, 0.22]] as const) c.fillRect(b.x - R, b.y + y0 * R, R * 2, h * R);
    c.restore();
  }
  if (name === 'earth') {
    const mo = S.moon, cover = plate === 'blue' ? 0.35 : plate === 'pink' ? 0.3 : 0;
    tone(c, disc(mo.x, mo.y, mo.R + 0.8), bbox([[mo.x - mo.R, mo.y - mo.R], [mo.x + mo.R, mo.y + mo.R]]), cover, plate);
  }
  // the unlit part, screened in blue
  if (plate === 'blue') {
    const shade = new Path2D(), lit = litShape(R, b.toSun, b.phase).map(([u, v]): Vec2 => [b.x + u, b.y + v]);
    shade.addPath(body);
    shade.addPath(polyPath(lit));
    c.save();
    c.clip(shade, 'evenodd');
    tone(c, body, box, 0.62, 'blue');
    c.restore();
  }
}

export const risoSpiral: Scene = {
  name: 'spiral-riso',
  duration: (INTRO + LOOP) / 12,
  loopFrom: INTRO / 12,
  poster: (INTRO + POSTER_M) / 12,
  draw(f) {
    const { stage } = f;
    const fr = frameFit(stage.w, stage.h), m = spiralClock(f), S = snapshot(m);
    ground(f, STOCK, { seed: 2500, texture: 0.8 });
    const clipArea = (c: CanvasRenderingContext2D): void => { c.beginPath(); c.rect(...AREA); c.clip(); };
    const wakes = (c: CanvasRenderingContext2D, plate: Plate): void => {
      for (const t of S.trails) {
        if (t.k === 8) wakeOn(c, plate, t.samples, 1.4, plate === 'yellow' ? 0.5 : 0);
        else { const n = PLANETS[t.k]!.name; wakeOn(c, plate, t.samples, WIDTH[t.k]!, WAKE[n][plate] ?? 0); }
      }
    };

    // blue: the sky (wiped clean under the Sun and planets), the orbits, the planets' blue
    const sky = cached(f, 'sp05-sky', g => blueSky(g, fr));
    ink(f, 'sp05-blue', g => {
      const c = g.ctx;
      g.stage.blit(c, sky);
      enter(c, fr);
      c.save();
      c.globalCompositeOperation = 'destination-out';
      for (const b of S.bodies) c.fill(disc(b.x, b.y, (b.planet.name === 'saturn' ? RINGS.outer * b.s : b.R) + 3));
      c.fill(disc(S.sun.x, S.sun.y, SUN_R + 8));
      c.restore();
      clipArea(c);
      c.strokeStyle = BLUE;
      c.lineWidth = 1.4;
      c.globalAlpha = 0.8;
      c.beginPath();
      for (const pl of PLANETS) { const o = orbitRing(pl.k); trace(c, o.near); trace(c, o.far); }
      c.stroke();
      c.globalAlpha = 1;
      wakes(c, 'blue');
      c.fillStyle = BLUE;
      c.beginPath();
      for (const r of S.rocks) { const s = (0.6 + r.rock.size * 0.7) * r.s; c.moveTo(r.x + s, r.y); c.arc(r.x, r.y, s, 0, TAU); }
      c.fill();
      for (const b of S.bodies) bodyOn(c, 'blue', S, b);
    }, plateOpts(2502, [0, 0]));

    // pink: the Sun's heart and corona, the wakes, the planets' pink
    ink(f, 'sp05-pink', g => {
      const c = g.ctx;
      enter(c, fr);
      clipArea(c);
      const X = S.sun.x, Y = S.sun.y;
      screen(c, [X - 110, Y - 110, 220, 220], {
        cell: CELL, angle: ANGLE.pink, color: PINK,
        density: (x, y) => { const d = Math.hypot(x - X, y - Y); return d < SUN_R ? 1 : Math.max(0, 0.8 - (d - SUN_R) / 60); },
      });
      wakes(c, 'pink');
      for (const b of S.bodies) bodyOn(c, 'pink', S, b);
    }, plateOpts(2503, [2.6, -1.8]));

    // yellow: the Sun, the Sun's wake, stars and dust, the wakes, the planets' yellow
    ink(f, 'sp05-yellow', g => {
      const c = g.ctx;
      enter(c, fr);
      clipArea(c);
      const X = S.sun.x, Y = S.sun.y;
      c.fillStyle = YELLOW;
      c.fill(disc(X, Y, SUN_R + 6));
      screen(c, [X - 80, Y - 80, 160, 160], {
        cell: CELL, angle: ANGLE.yellow, color: YELLOW,
        density: (x, y) => Math.max(0, 0.9 - (Math.hypot(x - X, y - Y) - SUN_R - 6) / 34),
      });
      wakeOn(c, 'yellow', S.sunTrail, 7, 0.75);
      c.fillStyle = YELLOW;
      c.beginPath();
      for (const [x, y, s] of STARS) { c.moveTo(x + s, y); c.arc(x, y, s, 0, TAU); }
      c.fill();
      for (const d of dust(m)) {
        const s = (1 + d.tone * 1.8) * d.s;
        c.globalAlpha = d.alpha;
        c.fill(disc(d.x, d.y, s));
      }
      c.globalAlpha = 1;
      wakes(c, 'yellow');
      for (const b of S.bodies) bodyOn(c, 'yellow', S, b);
    }, plateOpts(2504, [-2, 2.2]));
  },
};
