/**
 * S02 "Woodblock" (the solar system from above; ukiyo-e woodblock). A multi-block print on washi, whole from the
 * start: a Prussian-blue block wiped into a bokashi from the pale centre to the deep corners, stars carved out of it,
 * flat colour blocks for the Sun and planets, and the key block (orbits, rims, cartouche, border) printed a hair out of
 * register over them all. Woodgrain shows through every block.
 *
 * Each planet is two impressions: its colour, and an indigo overprint on the half turned from the Sun.
 */
import { catmullRom, ellipsePoints } from '../../core/geometry';
import { TAU, type Vec2 } from '../../core/math';
import { noise1, rng } from '../../core/random';
import type { Scene, SceneFrame } from '../../core/scene';
import { drawStroke, prepareStroke, type PreparedStroke, type StrokeStyle } from '../../core/stroke';
import { circle, composite, ground, ink, knockOut, polyPath, still, toothMask } from '../gallery/common';
import { annulus, brushChar, C, dayHalf, disc, enter, frameFit, LOOP, MOON, moonOffset, once, PLANETS, planetAt, POSTER_M, RINGS, ROCKS, rockAt, SUN_R, sunward, URANUS_RING, type Frame, type PlanetName } from './common';
import { skyOf } from './sky';
import { orbitTrail } from './trails';
import { SOLAR } from './palettes';

const PAL = SOLAR.woodblock;
const KEY = PAL.ink, WASHI = PAL.paper;
const [DEEP, MID, PALE, VERMILION, OCHRE, PINE, ASH, JADE] = PAL.fills as [string, string, string, string, string, string, string, string];
const HALO = PAL.accents[1]!;
const COLOR: Record<PlanetName, string> = { mercury: ASH, venus: OCHRE, earth: MID, mars: VERMILION, jupiter: HALO, saturn: OCHRE, uranus: JADE, neptune: DEEP };

/** The key block's line: a knife-cut edge, steady, a little heavier where the cutter leaned. */
const CUT: StrokeStyle = { color: KEY, size: 2.6, thinning: 0.25, smoothing: 0.6, wobble: 0.45, wobbleWavelength: 300, tremor: 0.08, pressureVariation: 0.3, pressureWavelength: 180, taperStart: 3, taperEnd: 3 };
const REG_KEY: Vec2 = [2.2, -1.6], REG_BLUE: Vec2 = [-1.4, 1.1];
const BORDER = 26;

interface Layout {
  orbits: PreparedStroke[];
  rims: PreparedStroke[];
  sun: PreparedStroke[];
  rings: PreparedStroke[]; uranusRing: PreparedStroke; moon: PreparedStroke;
  frame: PreparedStroke[];
  rays: Vec2[][];
}

/** The Sun's halo, cut as a ring of rays: paper-coloured gouges radiating through the ochre block. */
function haloRays(): Vec2[][] {
  return Array.from({ length: 32 }, (_, k): Vec2[] => {
    const a = (k / 32) * TAU + 0.05, r0 = SUN_R + 7, r1 = SUN_R + (k % 2 ? 20 : 28);
    return [[C[0] + Math.cos(a) * r0, C[1] + Math.sin(a) * r0], [C[0] + Math.cos(a) * r1, C[1] + Math.sin(a) * r1]];
  });
}

const layout = once((): Layout => {
  const orbits = PLANETS.map((p, k) => prepareStroke(ellipsePoints(C[0], C[1], p.a, p.a, { start: k * 0.9, n: Math.round(48 + p.a / 4) }), { ...CUT, size: 2.2 + (p.a > 400 ? 0.3 : 0) }, 1210 + k, { closed: true }));
  const rims = PLANETS.map((p, k) => prepareStroke(circle(0, 0, p.r, Math.max(20, Math.round(p.r * 2.4))), { ...CUT, size: p.r > 20 ? 2.6 : 2, taperStart: 1, taperEnd: 1 }, 1220 + k, { closed: true }));
  const sun = [SUN_R, SUN_R + 34].map((r, k) => prepareStroke(circle(C[0], C[1], r, 72), { ...CUT, size: k ? 2.2 : 3 }, 1230 + k, { closed: true }));
  const rings = [RINGS.inner, RINGS.outer].map((r, k) => prepareStroke(ellipsePoints(0, 0, r, r * RINGS.squash, { rotation: RINGS.angle, start: 0, n: 60 }), { ...CUT, size: 1.9, taperStart: 1, taperEnd: 1 }, 1250 + k, { closed: true }));
  const uranusRing = prepareStroke(ellipsePoints(0, 0, URANUS_RING.rx, URANUS_RING.ry, { rotation: URANUS_RING.angle, start: 0, n: 40 }), { ...CUT, size: 1.5, taperStart: 1, taperEnd: 1 }, 1255, { closed: true });
  const moon = prepareStroke(circle(0, 0, MOON.r, 14), { ...CUT, size: 1.4, taperStart: 1, taperEnd: 1 }, 1256, { closed: true });
  // the border rule, the cartouche (upper right) and a kento registration mark in the lower-left margin
  const b = BORDER, e = 1080 - BORDER;
  const frame = ([
    [[b, b], [e, b], [e, e], [b, e], [b, b]],
    [[980, 34], [1042, 34], [1042, 238], [980, 238], [980, 34]],
    [[986, 40], [1036, 40], [1036, 232], [986, 232], [986, 40]],
    [[b - 4, e + 16], [b + 44, e + 16]], [[b - 4, e + 16], [b - 4, e - 22]],
  ] as Vec2[][]).map((pts, k) => prepareStroke(pts, { ...CUT, size: k === 0 ? 3.2 : 2, wobble: 0.3, taperStart: 2, taperEnd: 2 }, 1260 + k));
  return { orbits, rims, sun, rings, uranusRing, moon, frame, rays: haloRays() };
});

/** Invented characters in the cartouche, top to bottom, and the publisher's seal below it. */
const TITLE = once(() => [0, 1, 2, 3].flatMap(k => brushChar(1011, 66 + k * 46, 30, 1270 + k)).map((pts, k) => prepareStroke(catmullRom(pts, 4), { ...CUT, size: 3.6, thinning: 0.6, taperStart: 4, taperEnd: 6 }, 1280 + k)));

/** The seal's character, cut in square seal script: a frame and a meander. */
const SEAL_CUT: Vec2[][] = [
  [[994, 252], [1030, 252], [1030, 288], [994, 288], [994, 252]],
  [[1000, 259], [1024, 259], [1024, 268], [1004, 268], [1004, 281], [1024, 281]],
  [[1012, 268], [1012, 276]],
];

function blueBlock(g: SceneFrame, fr: Frame): void {
  const c = g.ctx;
  enter(c, fr);
  // bokashi: the block wiped from bare paper at the Sun through sky blue to Prussian in the corners
  const R = 780, grad = c.createRadialGradient(C[0], C[1], 60, C[0], C[1], R);
  grad.addColorStop(0, 'rgba(183,200,207,0)');
  grad.addColorStop(0.22, 'rgba(183,200,207,0.3)');
  grad.addColorStop(0.46, PALE);
  grad.addColorStop(0.6, MID);
  grad.addColorStop(0.68, DEEP);
  grad.addColorStop(1, DEEP);
  c.fillStyle = grad;
  c.fillRect(-540, -540, 2160, 2160);
  // the wipe is by hand: a soft uneven edge where the pigment was cut back
  c.globalCompositeOperation = 'destination-out';
  c.fillStyle = WASHI;
  for (let k = 0; k < 90; k++) {
    const a = (k / 90) * TAU, r0 = 150 + noise1(k * 0.4, 1290) * 26;
    c.globalAlpha = 0.16;
    c.beginPath();
    c.ellipse(C[0] + Math.cos(a) * r0 * 0.5, C[1] + Math.sin(a) * r0 * 0.5, r0 * 0.7, r0 * 0.5, a, 0, TAU);
    c.fill();
  }
  // stars carved out of the deep blue: short gouges and round punches
  const r = rng(1291);
  c.globalAlpha = 1;
  c.beginPath();
  for (let k = 0; k < 150; k++) {
    const x = r() * 1180 - 50, y = r() * 1180 - 50, d = Math.hypot(x - C[0], y - C[1]);
    if (d < 505) continue;
    const s = 1.2 + Math.pow(r(), 3) * 3.6, a = r() * TAU;
    c.moveTo(x + Math.cos(a) * s * 1.6, y + Math.sin(a) * s * 1.6);
    c.ellipse(x, y, s * 1.6, s * 0.7, a, 0, TAU);
  }
  c.fill();
  c.globalCompositeOperation = 'source-over';
  c.setTransform(1, 0, 0, 1, 0, 0);
  knockOut(g, c, toothMask(g, { seed: 1292, kind: 'grain', density: 1.2, size: 1, length: 900 }), 0.22);
  knockOut(g, c, toothMask(g, { seed: 1293, density: 25, size: 1.3 }), 0.3);
}

export const woodblockScene: Scene = {
  name: 'solar-woodblock',
  duration: LOOP / 12,
  loopFrom: 0,
  poster: POSTER_M / 12,
  draw(f) {
    const { stage } = f;
    const fr = frameFit(stage.w, stage.h), L = layout(), sky = skyOf(f, 0);
    ground(f, WASHI, { seed: 1200, texture: 1.3 });
    still(f, 's02-blue', g => blueBlock(g, fr), { blend: 'multiply', offset: REG_BLUE });

    // colour blocks: the Sun and its halo, the planets, the Saturn ring, the Moon
    ink(f, 's02-colour', g => {
      const c = g.ctx;
      enter(c, fr);
      c.fillStyle = HALO;
      c.fill(disc(C[0], C[1], SUN_R + 34));
      c.save();
      c.strokeStyle = WASHI;
      c.lineWidth = 3.4;
      c.lineCap = 'round';
      c.beginPath();
      for (const [a, b] of L.rays) { c.moveTo(a![0], a![1]); c.lineTo(b![0], b![1]); }
      c.stroke();
      c.restore();
      c.fillStyle = VERMILION;
      c.fill(disc(C[0], C[1], SUN_R));
      // a viewer's trails: bands of each planet's colour, carved back along its orbit
      for (const p of PLANETS) orbitTrail(c, p, sky, { color: COLOR[p.name], width: Math.max(4, p.r * 0.9), tail: 0.35, cap: 'butt' });
      for (const p of PLANETS) {
        const [x, y] = planetAt(p, sky), toSun = sunward([x, y]);
        c.save();
        c.translate(x, y);
        if (p.name === 'saturn') {
          c.fillStyle = ASH;
          c.fill(annulus(0, 0, RINGS.inner, RINGS.outer, RINGS.squash, RINGS.angle));
          c.fillStyle = PALE;
          c.fill(annulus(0, 0, RINGS.inner + 4, RINGS.inner + 7, RINGS.squash, RINGS.angle));
        }
        c.fillStyle = COLOR[p.name];
        c.fill(disc(0, 0, p.r));
        if (p.name === 'jupiter') {
          c.save();
          c.clip(disc(0, 0, p.r));
          c.fillStyle = VERMILION;
          for (const [y0, hgt] of [[-18, 5], [-6, 7], [8, 4], [16, 5]] as const) c.fillRect(-p.r, y0, p.r * 2, hgt);
          c.fillStyle = WASHI;
          c.fillRect(-p.r, 1, p.r * 2, 3);
          c.restore();
        }
        if (p.name === 'earth') {
          c.save();
          c.clip(disc(0, 0, p.r));
          c.fillStyle = PINE;
          c.fill(polyPath([[-8, -6], [-1, -9], [3, -3], [-2, 2], [-6, 1]]));
          c.fill(polyPath([[3, 3], [9, 1], [8, 8], [4, 9]]));
          c.restore();
          const [mx, my] = moonOffset(sky);
          c.fillStyle = WASHI;
          c.fill(disc(mx, my, MOON.r));
        }
        // the shadow block: indigo over the half turned from the Sun
        c.save();
        c.globalAlpha = 0.72;
        c.fillStyle = DEEP;
        c.fill(polyPath(dayHalf(p.r, toSun + Math.PI)));
        c.restore();
        c.restore();
      }
      // cartouche ground and the seal
      c.fillStyle = '#e9d9ae';
      c.fillRect(986, 40, 50, 192);
      c.fillStyle = VERMILION;
      c.fillRect(989, 247, 46, 46);
    }, { tooth: { seed: 1294, density: 30, size: 1.5, alpha: 0.28 }, blend: 'source-over' });

    // the key block, a hair out of register
    ink(f, 's02-key', g => {
      const c = g.ctx;
      enter(c, fr);
      for (const s of L.orbits) drawStroke(c, s, 1);
      for (const s of L.sun) drawStroke(c, s, 1);
      for (const s of L.frame) drawStroke(c, s, 1);
      for (const s of TITLE()) drawStroke(c, s, 1);
      // the belt: a scatter of round punches in the key
      c.fillStyle = KEY;
      c.beginPath();
      for (const rk of ROCKS) {
        const [x, y] = rockAt(rk, sky), s = 0.6 + rk.size * 0.7;
        c.moveTo(x + s, y);
        c.arc(x, y, s, 0, TAU);
      }
      c.fill();
      PLANETS.forEach((p, k) => {
        const [x, y] = planetAt(p, sky);
        c.save();
        c.translate(x, y);
        if (p.name === 'saturn') for (const s of L.rings) drawStroke(c, s, 1);
        if (p.name === 'uranus') drawStroke(c, L.uranusRing, 1);
        drawStroke(c, L.rims[k]!, 1);
        if (p.name === 'earth') {
          const [mx, my] = moonOffset(sky);
          c.translate(mx, my);
          drawStroke(c, L.moon, 1);
        }
        c.restore();
      });
    }, { tooth: { seed: 1295, density: 26, size: 1.4, alpha: 0.3 }, offset: REG_KEY });

    // the seal's character: paper cut out of the vermilion
    still(f, 's02-seal', g => {
      const c = g.ctx;
      enter(c, fr);
      c.strokeStyle = WASHI;
      c.lineWidth = 3.2;
      c.lineCap = 'square';
      c.lineJoin = 'miter';
      c.beginPath();
      for (const pts of SEAL_CUT) pts.forEach(([x, y], k) => (k ? c.lineTo(x, y) : c.moveTo(x, y)));
      c.stroke();
    });
    composite(f, toothMask(f, { seed: 1297, kind: 'grain', density: 1, size: 1, length: 700, color: WASHI }), { alpha: 0.1 });
  },
};
