/**
 * SP09 "Bauhaus" (the moving solar system at an angle; Bauhaus geometry). Primary colours and pure geometry on bone
 * paper, screen-printed, whole from the start: a black band and a red square head the sheet, a blue quarter-disc
 * anchors the lower left, where the wake leaves the sheet open.
 *
 * Each wake is a hard-edged band of flat colour where the coil swings in front of the Sun's line, stepping down in
 * width as it goes back, and a fine black line where it passes behind; its oldest stretch breaks into a row of black
 * circles. The Sun is a red disc in a yellow one, its path a heavy black rule marked with a circle for every year of
 * Mercury's; each planet is a flat circle, colour where the Sun reaches and black where it does not. Dust drifts past
 * as small black squares, the belt is a ring of them.
 *
 * The colours print on one screen and the black on another, a hair out of register; a shape laid in front clears
 * both screens beneath it, so nothing is threaded through anything.
 */
import { TAU, type Vec2 } from '../../core/math';
import type { Scene } from '../../core/scene';
import { composite, ground, knockOut, polyPath, scratch, toothMask } from '../gallery/common';
import { SOLAR } from '../solar/palettes';
import { bodyBand, bodyRing, disc, dust, E1, E2, enter, frameFit, INTRO, litShape, LOOP, MOTION, paint, PLANETS, POSTER_M, ribbon, RINGS, snapshot, spiralSky, SUN_R, SUN_W, trace, URANUS_RING, type Body, type Frame, type PlanetName, type Sample, type Snapshot } from './common';
import { sheetOf, type DesignBox } from '../solar/common';

const PAL = SOLAR.bauhaus;
const [RED, YELLOW, BLUE] = PAL.fills as [string, string, string, string];
const BLACK = PAL.ink, BONE = PAL.paper;
const COLOR: Record<PlanetName, string> = { mercury: BONE, venus: YELLOW, earth: BLUE, mars: RED, jupiter: YELLOW, saturn: YELLOW, uranus: BLUE, neptune: BLUE };
const WAKE: Record<PlanetName, string> = { mercury: BLACK, venus: YELLOW, earth: BLUE, mars: RED, jupiter: YELLOW, saturn: RED, uranus: BLUE, neptune: BLACK };
const WIDTH = [2.4, 3.2, 3.4, 3, 5.4, 4.6, 3.8, 3.8];
const REG: Vec2 = [1.4, -1];

/** A band's width steps down in three: whole, then three fifths, then a third. */
const step = (age: number): number => (age < 0.3 ? 1 : age < 0.6 ? 0.6 : 0.33);

interface Screens { col: CanvasRenderingContext2D; blk: CanvasRenderingContext2D }

/** Lay a shape in colour, clearing the black beneath it. */
function colour(sc: Screens, path: Path2D, color: string): void {
  sc.col.fillStyle = color;
  sc.col.fill(path);
  sc.blk.save();
  sc.blk.globalCompositeOperation = 'destination-out';
  sc.blk.fill(path);
  sc.blk.restore();
}

/** Lay a shape in black, clearing the colour beneath it. */
function black(sc: Screens, path: Path2D): void {
  sc.blk.fillStyle = BLACK;
  sc.blk.fill(path);
  sc.col.save();
  sc.col.globalCompositeOperation = 'destination-out';
  sc.col.fill(path);
  sc.col.restore();
}

function lineOf(pts: readonly { x: number; y: number }[], width: number): Path2D {
  // a stroke as a fillable outline: canvas cannot fill a stroke, so build a ribbon of constant width
  const run = pts.map(p => ({ x: p.x, y: p.y, z: 0, s: 1, age: 0, q: 0, near: true, side: 0 }));
  return polyPath(ribbon(run, () => width / 2));
}

function wake(sc: Screens, run: readonly Sample[], color: string, half0: number, near: boolean): void {
  if (run.length < 2) return;
  if (near) {
    // the band, in three widths; its oldest stretch as circles
    const young = run.filter(s => s.age < 0.85);
    if (young.length > 1) colour(sc, polyPath(ribbon(young, s => half0 * s.s * step(s.age))), color);
  } else {
    const young = run.filter(s => s.age < 0.85);
    if (young.length > 1) black(sc, lineOf(young, 1.3 * young[0]!.s));
  }
  const dots = new Path2D();
  for (const s of run) {
    if (s.age < 0.62 || s.q % 12 !== 0) continue;
    const r = Math.max(0.6, (near ? 2.4 : 1.5) * s.s * (1 - s.age) * 2.2);
    dots.moveTo(s.x + r, s.y);
    dots.arc(s.x, s.y, r, 0, TAU);
  }
  black(sc, dots);
}

function drawBody(sc: Screens, S: Snapshot, b: Body): void {
  const name = b.planet.name, R = b.R;
  const band = name === 'saturn' ? bodyBand(b.p, RINGS.inner + 3, RINGS.outer - 3, E1, E2) : null;
  const ur = name === 'uranus' ? bodyRing(b.p, URANUS_RING, MOTION, E1) : null;
  if (band) colour(sc, polyPath(band.back), RED);
  if (ur) black(sc, lineOf(ur.back, 2 * b.s));
  const mo = S.moon;
  const moon = (): void => {
    colour(sc, disc(mo.x, mo.y, mo.R + 0.4), YELLOW);
    const shade = new Path2D();
    shade.addPath(disc(mo.x, mo.y, mo.R + 0.4));
    shade.addPath(polyPath(litShape(mo.R + 0.4, mo.toSun, mo.phase).map(([u, v]): Vec2 => [mo.x + u, mo.y + v])));
    sc.blk.fillStyle = BLACK;
    sc.blk.fill(shade, 'evenodd');
  };
  if (name === 'earth' && !mo.front) moon();
  // the disc: colour, then black over the part the Sun does not reach, then a black rim
  const body = disc(b.x, b.y, R);
  colour(sc, body, COLOR[name]);
  if (name === 'jupiter') {
    sc.col.save();
    sc.col.clip(body);
    sc.col.fillStyle = RED;
    for (const [y0, h] of [[-0.62, 0.22], [-0.14, 0.26], [0.34, 0.2]] as const) sc.col.fillRect(b.x - R, b.y + y0 * R, R * 2, h * R);
    sc.col.restore();
  }
  const shade = new Path2D();
  shade.addPath(body);
  shade.addPath(polyPath(litShape(R, b.toSun, b.phase).map(([u, v]): Vec2 => [b.x + u, b.y + v])));
  sc.blk.fillStyle = BLACK;
  sc.blk.fill(shade, 'evenodd');
  sc.blk.strokeStyle = BLACK;
  sc.blk.lineWidth = 2;
  sc.blk.beginPath();
  sc.blk.arc(b.x, b.y, R, 0, TAU);
  sc.blk.stroke();
  if (band) {
    colour(sc, polyPath(band.front), RED);
    sc.blk.lineWidth = 1.6;
    sc.blk.beginPath();
    trace(sc.blk, bodyRing(b.p, RINGS.outer - 3, E1, E2, 40).front);
    sc.blk.stroke();
  }
  if (ur) black(sc, lineOf(ur.front, 2 * b.s));
  if (name === 'earth' && mo.front) moon();
}

/** The sheet's fixed geometry: band, square, quarter-disc, round the sheet's edges (the design box, or a live room). */
function sheet(sc: Screens, [x0, y0, x1, y1]: DesignBox): void {
  const q = new Path2D();
  q.moveTo(x0, y1);
  q.arc(x0, y1, 250, -Math.PI / 2, 0);
  q.closePath();
  colour(sc, q, BLUE);
  const sq = new Path2D();
  sq.rect(x1 - 96, y0, 96, 96);
  colour(sc, sq, RED);
  const bands = new Path2D();
  bands.rect(x0, y0, x1 - 96 - x0, 22);
  bands.rect(x1 - 22, y0 + 96, 22, y1 - y0 - 96);
  black(sc, bands);
}

export const bauhausSpiral: Scene = {
  name: 'spiral-bauhaus',
  duration: (INTRO + LOOP) / 12,
  loopFrom: INTRO / 12,
  poster: (INTRO + POSTER_M) / 12,
  draw(f) {
    const { stage } = f;
    const fr: Frame = frameFit(stage.w, stage.h), S = snapshot(spiralSky(f));
    ground(f, BONE, { seed: 2900, texture: 0.9 });
    let blkLayer: HTMLCanvasElement | null = null;
    const colLayer = scratch(f, 'sp09-colour', gc => {
      blkLayer = scratch(f, 'sp09-black', gb => {
        const sc: Screens = { col: gc.ctx, blk: gb.ctx };
        // both screens fade together at the wakes' strength
        const faded = (draw: () => void): void => {
          const a = S.plan.alpha;
          if (a >= 1) return draw();
          if (a <= 0) return;
          for (const c of [sc.col, sc.blk]) { c.save(); c.globalAlpha *= a; }
          draw();
          for (const c of [sc.col, sc.blk]) c.restore();
        };
        enter(sc.col, fr);
        enter(sc.blk, fr);
        sheet(sc, sheetOf(f));
        // dust: small black squares drifting past, squared to the path
        const a = Math.atan2(MOTION[1], MOTION[0]);
        for (const d of dust(S)) {
          if (d.alpha < 0.3 || d.tone > 0.55) continue;
          const s = (1.4 + d.tone * 2.4) * d.s, p = new Path2D();
          const c = Math.cos(a), n = Math.sin(a);
          p.moveTo(d.x + (-s * c + s * n) / 2, d.y + (-s * n - s * c) / 2);
          p.lineTo(d.x + (s * c + s * n) / 2, d.y + (s * n - s * c) / 2);
          p.lineTo(d.x + (s * c - s * n) / 2, d.y + (s * n + s * c) / 2);
          p.lineTo(d.x + (-s * c - s * n) / 2, d.y + (-s * n + s * c) / 2);
          p.closePath();
          black(sc, p);
        }
        paint(S, {
          run: (t, run, near) => faded(() => {
            if (t.k === 8) { if (near) wake(sc, run, BLACK, 0.9, near); return; }
            wake(sc, run, WAKE[PLANETS[t.k]!.name], WIDTH[t.k]!, near);
          }),
          orbit(pl, half, near) {
            black(sc, lineOf(half, pl.name === 'neptune' ? (near ? 4 : 2.5) : near ? 1.4 : 0.9));
          },
          rocks(rocks) {
            const p = new Path2D();
            for (const r of rocks) {
              const s = (1.2 + r.rock.size * 0.9) * r.s, a = r.angle;
              const c = Math.cos(a), n = Math.sin(a);
              p.moveTo(r.x + (-s * c + s * n) / 2, r.y + (-s * n - s * c) / 2);
              p.lineTo(r.x + (s * c + s * n) / 2, r.y + (s * n - s * c) / 2);
              p.lineTo(r.x + (s * c - s * n) / 2, r.y + (s * n + s * c) / 2);
              p.lineTo(r.x + (-s * c - s * n) / 2, r.y + (-s * n + s * c) / 2);
              p.closePath();
            }
            black(sc, p);
          },
          sunTrail: st => faded(() => {
            const young = st.filter(s => s.age < 0.8);
            if (young.length > 1) black(sc, polyPath(ribbon(young, s => 2.6 * s.s * step(s.age))));
            // a circle at every tick of the ruler (a year of Mercury's in the loop) along the Sun's path
            for (const s of st) {
              if (s.q % S.plan.tick[SUN_W]! !== 0 || s.age < 0.02 || s.age > 0.8) continue;
              const r = 7 * s.s;
              colour(sc, disc(s.x, s.y, r), YELLOW);
              sc.blk.strokeStyle = BLACK;
              sc.blk.lineWidth = 1.6;
              sc.blk.beginPath();
              sc.blk.arc(s.x, s.y, r, 0, TAU);
              sc.blk.stroke();
            }
          }),
          sun() {
            colour(sc, disc(S.sun.x, S.sun.y, SUN_R + 16), YELLOW);
            colour(sc, disc(S.sun.x, S.sun.y, SUN_R), RED);
            sc.blk.strokeStyle = BLACK;
            sc.blk.lineWidth = 2.4;
            sc.blk.beginPath();
            sc.blk.arc(S.sun.x, S.sun.y, SUN_R + 16, 0, TAU);
            sc.blk.stroke();
          },
          body: b => drawBody(sc, S, b),
        });
        knockOut(f, gb.ctx, toothMask(f, { seed: 2902, density: 45, size: 1.2 }), 0.28);
      });
      knockOut(f, gc.ctx, toothMask(f, { seed: 2901, density: 45, size: 1.2 }), 0.28);
    });
    composite(f, colLayer);
    composite(f, blkLayer!, { offset: REG });
  },
};

