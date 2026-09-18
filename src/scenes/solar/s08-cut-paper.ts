/**
 * S08 "Cut Paper" (the solar system from above; layered cut paper). A paper diorama seen from overhead, whole from the
 * start: the orbits are the scissor-cut rims of eight stacked sheets of blue, darkest at the bottom of the pile and
 * lightening towards the Sun, each lifting a soft shadow onto the one below. The Sun is three layers (an orange star, a
 * yellow disc, a pale heart) and turns once a loop; the planets are paper discs with pasted-on bands, rings and land,
 * riding round the rims of their sheets with their shadows under them; the belt is a scatter of paper punchings.
 *
 * The light comes from the upper left, so every shadow falls down and to the right.
 */
import { TAU, type Vec2 } from '../../core/math';
import { rng } from '../../core/random';
import type { Scene, SceneFrame } from '../../core/scene';
import { circle, composite, ground, polyPath, scissor, still, toothMask } from '../gallery/common';
import { BOX, C, enter, frameFit, LOOP, MOON, moonOffset, once, orbitAngle, orbitClock, PLANETS, planetAt, POSTER_M, RINGS, ROCKS, rockAt, SUN_R, URANUS_RING, type Frame, type PlanetName } from './common';
import { SOLAR } from './palettes';

const PAL = SOLAR.cutPaper;
const GROUND = PAL.paper;
const SHEETS = PAL.fills.slice(0, 8);
const [SUN_Y, SUN_O, SUN_PALE] = PAL.fills.slice(8) as [string, string, string];
const [GREY, CREAM, BLUE, LEAF, RED, ORANGE, SAND, TEAL, COBALT] = PAL.accents as [string, string, string, string, string, string, string, string, string];
const COLOR: Record<PlanetName, string> = { mercury: GREY, venus: CREAM, earth: BLUE, mars: RED, jupiter: ORANGE, saturn: SAND, uranus: TEAL, neptune: COBALT };
const SHADOW = 'rgba(4,8,24,0.55)';

/** Shadow of paper lifted `lift` design units off the sheet below; offsets and blur are in output pixels. */
function lifted(c: CanvasRenderingContext2D, k: number, lift: number): void {
  c.shadowColor = SHADOW;
  c.shadowBlur = lift * 2.2 * k;
  c.shadowOffsetX = lift * 0.8 * k;
  c.shadowOffsetY = lift * 1.2 * k;
}

interface Cut { sheets: Vec2[][]; planets: Vec2[][]; star: Vec2[]; sunDisc: Vec2[]; sunHeart: Vec2[]; ring: [Vec2[], Vec2[]]; bands: Vec2[][]; land: Vec2[][]; moon: Vec2[] }

const cut = once((): Cut => {
  const sheets = PLANETS.map((p, k) => scissor(circle(C[0], C[1], p.a, Math.round(p.a * 0.9)), 1810 + k, 30, 1.4));
  const planets = PLANETS.map((p, k) => scissor(circle(0, 0, p.r, 40), 1820 + k, Math.max(4, p.r * 0.45), 0.5));
  const star = Array.from({ length: 36 }, (_, k): Vec2 => {
    const a = (k / 36) * TAU, r = k % 2 ? SUN_R + 8 : SUN_R + 30;
    return [Math.cos(a) * r, Math.sin(a) * r];
  });
  const ellipse = (rx: number, n: number): Vec2[] => Array.from({ length: n }, (_, j): Vec2 => {
    const b = (j / n) * TAU, u = Math.cos(b) * rx, v = Math.sin(b) * rx * RINGS.squash;
    return [u * Math.cos(RINGS.angle) - v * Math.sin(RINGS.angle), u * Math.sin(RINGS.angle) + v * Math.cos(RINGS.angle)];
  });
  const r = rng(1830);
  const land = [[[-9, -5], [-3, -10], [3, -6], [0, 0], [-6, 2]], [[2, 3], [8, 0], [9, 6], [4, 9]]].map(pts => pts.map(([x, y]): Vec2 => [x! + (r() - 0.5), y! + (r() - 0.5)]));
  return {
    sheets, planets, star: scissor(star, 1831, 12, 1), sunDisc: scissor(circle(0, 0, SUN_R, 48), 1832, 16, 1), sunHeart: scissor(circle(-5, -5, SUN_R * 0.55, 30), 1833, 12, 0.8),
    ring: [scissor(ellipse(RINGS.outer, 60), 1834, 8, 0.5), ellipse(RINGS.inner, 48)],
    bands: [[-20, -14], [-7, -2], [5, 9], [15, 19]].map(([y0, y1], k) => scissor([[-30, y0!], [30, y0! + 1], [30, y1!], [-30, y1! - 1]], 1835 + k, 10, 0.6)),
    land, moon: scissor(circle(0, 0, MOON.r + 0.5, 12), 1840, 3, 0.3),
  };
});

/** The stack of orbit sheets and the punched stars around it: laid once. */
function stack(g: SceneFrame, fr: Frame): void {
  const c = g.ctx, k = g.stage.scale * fr.s, L = cut();
  enter(c, fr);
  // stars: punched paper dots scattered on the ground sheet beyond the stack
  const r = rng(1841);
  c.save();
  lifted(c, k, 1.2);
  for (let j = 0; j < 70; j++) {
    const x = r() * BOX, y = r() * BOX, s = 1.6 + Math.pow(r(), 3) * 3;
    if (Math.hypot(x - C[0], y - C[1]) < PLANETS[7]!.a + 14) continue;
    c.fillStyle = r() < 0.3 ? SUN_PALE : CREAM;
    c.fill(polyPath(circle(x, y, s, 10, r())));
  }
  c.restore();
  // the sheets, largest first, each casting onto the one below
  L.sheets.slice().reverse().forEach((pts, j) => {
    c.save();
    lifted(c, k, 2.4);
    c.fillStyle = SHEETS[j]!;
    c.fill(polyPath(pts));
    c.restore();
  });
}

export const cutPaperScene: Scene = {
  name: 'solar-cut-paper',
  duration: LOOP / 12,
  loopFrom: 0,
  poster: POSTER_M / 12,
  draw(f) {
    const { ctx, stage } = f;
    const fr = frameFit(stage.w, stage.h), m = orbitClock(f, 0), k = stage.scale * fr.s, L = cut();
    ground(f, GROUND, { seed: 1800, texture: 1.2, vignette: 0.35 });
    still(f, 's08-stack', g => stack(g, fr));

    ctx.save();
    enter(ctx, fr);
    // the belt: paper punchings in sand and grey, each with its tiny shadow
    ctx.save();
    lifted(ctx, k, 1);
    ROCKS.forEach((rk, j) => {
      if (j % 2) return;
      const [x, y] = rockAt(rk, m), s = 1.2 + rk.size * 0.9;
      ctx.fillStyle = rk.tone < 0.5 ? SAND : GREY;
      ctx.beginPath();
      ctx.moveTo(x + s, y);
      ctx.arc(x, y, s, 0, TAU);
      ctx.fill();
    });
    ctx.restore();

    // the Sun: an orange star turning once a loop, a yellow disc, a pale heart
    ctx.save();
    ctx.translate(C[0], C[1]);
    ctx.save();
    ctx.rotate(orbitAngle(1, 0, m));
    lifted(ctx, k, 3);
    ctx.fillStyle = SUN_O;
    ctx.fill(polyPath(L.star));
    ctx.restore();
    lifted(ctx, k, 3);
    ctx.fillStyle = SUN_Y;
    ctx.fill(polyPath(L.sunDisc));
    lifted(ctx, k, 2);
    ctx.fillStyle = SUN_PALE;
    ctx.fill(polyPath(L.sunHeart));
    ctx.restore();

    // planets: discs lifted off the stack, pieces pasted on top
    PLANETS.forEach((p, j) => {
      const [x, y] = planetAt(p, m);
      ctx.save();
      ctx.translate(x, y);
      if (p.name === 'saturn') {
        const ring = new Path2D();
        ring.addPath(polyPath(L.ring[0]));
        ring.addPath(polyPath([...L.ring[1]].reverse()));
        ctx.save();
        lifted(ctx, k, 3);
        ctx.fillStyle = CREAM;
        ctx.fill(ring, 'evenodd');
        ctx.restore();
      }
      ctx.save();
      lifted(ctx, k, p.r > 20 ? 4 : 3);
      ctx.fillStyle = COLOR[p.name];
      ctx.fill(polyPath(L.planets[j]!));
      ctx.restore();
      if (p.name === 'jupiter') {
        ctx.save();
        ctx.clip(polyPath(L.planets[j]!));
        lifted(ctx, k, 0.8);
        L.bands.forEach((b, i) => {
          ctx.fillStyle = i % 2 ? CREAM : RED;
          ctx.fill(polyPath(b));
        });
        ctx.fillStyle = RED;
        ctx.beginPath();
        ctx.ellipse(8, 11.5, 5, 3, 0, 0, TAU);
        ctx.fill();
        ctx.restore();
      }
      if (p.name === 'earth') {
        ctx.save();
        lifted(ctx, k, 0.8);
        ctx.fillStyle = LEAF;
        for (const piece of L.land) ctx.fill(polyPath(piece));
        ctx.restore();
        const [mx, my] = moonOffset(m);
        ctx.save();
        ctx.translate(mx, my);
        lifted(ctx, k, 2);
        ctx.fillStyle = GREY;
        ctx.fill(polyPath(L.moon));
        ctx.restore();
      }
      if (p.name === 'uranus') {
        ctx.save();
        lifted(ctx, k, 1.5);
        ctx.strokeStyle = CREAM;
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.ellipse(0, 0, URANUS_RING.rx, URANUS_RING.ry, URANUS_RING.angle, 0, TAU);
        ctx.stroke();
        ctx.restore();
      }
      ctx.restore();
    });
    ctx.restore();
    // the paper's own fibre, over everything
    composite(f, toothMask(f, { seed: 1850, kind: 'streak', angle: 0.3, density: 30, size: 0.7, length: 14, color: '#ffffff' }), { alpha: 0.05 });
    composite(f, toothMask(f, { seed: 1851, density: 40, size: 0.9, color: '#000000' }), { alpha: 0.08 });
  },
};
