/**
 * SP02 "Woodblock" (the moving solar system at an angle; ukiyo-e woodblock). A print on washi, whole from the start:
 * an ichimonji bokashi of Prussian blue wiped down from the top edge and up from the bottom, stars carved out of it,
 * and the wakes cut as flat bands of block colour, the way a print cuts a stream: each tapers from the planet back to
 * a point, outlined by the key block on both edges, paler where it passes behind the Sun's line. The dust the Sun
 * flies through falls as fine carved rain lines along its path. A cartouche and a seal sit in the empty corner.
 *
 * Colour and key are cut together here so near bands can cover far ones; the key is still a hair out of register,
 * and woodgrain shows through everything.
 */
import { catmullRom } from '../../core/geometry';
import { TAU, type Vec2 } from '../../core/math';
import { noise1, rng } from '../../core/random';
import type { Scene, SceneFrame } from '../../core/scene';
import { drawStroke, prepareStroke, type PreparedStroke, type StrokeStyle } from '../../core/stroke';
import { circle, composite, ground, knockOut, polyPath, scratch, still, toothMask } from '../gallery/common';
import { mix } from '../../art/color';
import { SOLAR } from '../solar/palettes';
import { bodyBand, bodyRing, disc, dust, E1, E2, enter, frameFit, INTRO, inWake, litShape, LOOP, MOTION, once, orbitRings, paint, POSTER_M, project, ribbon, RINGS, snapshot, spiralSky, SUN_R, URANUS_RING, type Body, type Frame, type PlanetName, type Sample, type Snapshot } from './common';
import { brushChar } from '../solar/common';

const PAL = SOLAR.woodblock;
const KEY = PAL.ink, WASHI = PAL.paper;
const [DEEP, MID, PALE, VERMILION, OCHRE, PINE, ASH, JADE] = PAL.fills as [string, string, string, string, string, string, string, string];
const HALO = PAL.accents[1]!;
const COLOR: Record<PlanetName, string> = { mercury: ASH, venus: OCHRE, earth: MID, mars: VERMILION, jupiter: HALO, saturn: OCHRE, uranus: JADE, neptune: DEEP };
/** Wake colours: the planet's block, lightened where it would sink into the sky. */
const WAKE: Record<PlanetName, string> = { mercury: ASH, venus: OCHRE, earth: '#5b82ab', mars: VERMILION, jupiter: HALO, saturn: '#cdb98a', uranus: JADE, neptune: '#7d9fc2' };
/** Half width of each wake at its head, at the Sun's depth. */
const WIDTH: Record<PlanetName, number> = { mercury: 2.6, venus: 3.6, earth: 3.8, mars: 3.2, jupiter: 6.5, saturn: 5.5, uranus: 4.6, neptune: 4.6 };

const CUT: StrokeStyle = { color: KEY, size: 2.4, thinning: 0.25, smoothing: 0.6, wobble: 0.45, wobbleWavelength: 300, tremor: 0.08, pressureVariation: 0.3, pressureWavelength: 180, taperStart: 3, taperEnd: 3 };
const REG_KEY: Vec2 = [1.6, -1.2];
const BORDER = 26;

interface Layout {
  frame: PreparedStroke[];
  title: PreparedStroke[];
  sun: PreparedStroke[];
  rays: Vec2[][];
}

const layout = once((): Layout => {
  const S = project([0, 0, 0]);
  const b = BORDER, e = 1080 - BORDER;
  const frame = ([
    [[b, b], [e, b], [e, e], [b, e], [b, b]],
    [[980, 34], [1042, 34], [1042, 238], [980, 238], [980, 34]],
    [[986, 40], [1036, 40], [1036, 232], [986, 232], [986, 40]],
    [[b - 4, e + 16], [b + 44, e + 16]], [[b - 4, e + 16], [b - 4, e - 22]],
  ] as Vec2[][]).map((pts, k) => prepareStroke(pts, { ...CUT, size: k === 0 ? 3.2 : 2, wobble: 0.3, taperStart: 2, taperEnd: 2 }, 2260 + k));
  const title = [0, 1, 2, 3].flatMap(k => brushChar(1011, 66 + k * 46, 30, 2270 + k)).map((pts, k) => prepareStroke(catmullRom(pts, 4), { ...CUT, size: 3.6, thinning: 0.6, taperStart: 4, taperEnd: 6 }, 2280 + k));
  const sun = [SUN_R, SUN_R + 22].map((r, k) => prepareStroke(circle(S.x, S.y, r, 60), { ...CUT, size: k ? 2 : 2.8 }, 2230 + k, { closed: true }));
  const rays = Array.from({ length: 28 }, (_, k): Vec2[] => {
    const a = (k / 28) * TAU + 0.05, r0 = SUN_R + 5, r1 = SUN_R + (k % 2 ? 14 : 19);
    return [[S.x + Math.cos(a) * r0, S.y + Math.sin(a) * r0], [S.x + Math.cos(a) * r1, S.y + Math.sin(a) * r1]];
  });
  return { frame, title, sun, rays };
});

/** The seal's character, cut in square seal script. */
const SEAL_CUT: Vec2[][] = [
  [[994, 252], [1030, 252], [1030, 288], [994, 288], [994, 252]],
  [[1000, 259], [1024, 259], [1024, 268], [1004, 268], [1004, 281], [1024, 281]],
  [[1012, 268], [1012, 276]],
];

function blueBlock(g: SceneFrame, fr: Frame): void {
  const c = g.ctx;
  enter(c, fr);
  // ichimonji bokashi: Prussian wiped down from the top edge, a lighter wipe up from the bottom
  const top = c.createLinearGradient(0, 0, 0, 1080);
  top.addColorStop(0, DEEP);
  top.addColorStop(0.14, DEEP);
  top.addColorStop(0.3, MID);
  top.addColorStop(0.5, 'rgba(183,200,207,0.6)');
  top.addColorStop(0.76, 'rgba(183,200,207,0.4)');
  top.addColorStop(0.94, MID);
  top.addColorStop(1, MID);
  c.fillStyle = top;
  c.fillRect(-540, -540, 2160, 2160);
  // the wipe is by hand: the band's lower edge wanders, a little more pigment left in some places than others
  c.globalCompositeOperation = 'destination-out';
  for (let x = -40; x < 1120; x += 8) {
    const y = 250 + noise1(x / 160, 2290) * 26 + noise1(x / 40, 2289) * 6;
    const g = c.createLinearGradient(0, y - 80, 0, y + 160);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(0.35, 'rgba(0,0,0,0.3)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g;
    c.fillRect(x, y - 80, 8, 240);
  }
  // a pale glow wiped round where the Sun rides
  const S = project([0, 0, 0]);
  const glow = c.createRadialGradient(S.x, S.y, 20, S.x, S.y, 260);
  glow.addColorStop(0, 'rgba(0,0,0,0.85)');
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = glow;
  c.fillRect(S.x - 260, S.y - 260, 520, 520);
  // stars carved out of the deep blue: short gouges and round punches
  const r = rng(2291);
  c.beginPath();
  for (let k = 0; k < 170; k++) {
    const x = r() * 1180 - 50, y = r() * 1180 - 50, band = y < 300 || y > 900;
    if (!band && r() < 0.8) continue;
    const s = 1.1 + Math.pow(r(), 3) * 3.2, a = r() * TAU;
    c.moveTo(x + Math.cos(a) * s * 1.6, y + Math.sin(a) * s * 1.6);
    c.ellipse(x, y, s * 1.6, s * 0.7, a, 0, TAU);
  }
  c.fill();
  c.globalCompositeOperation = 'source-over';
  c.setTransform(1, 0, 0, 1, 0, 0);
  knockOut(g, c, toothMask(g, { seed: 2292, kind: 'grain', density: 1.2, size: 1, length: 900 }), 0.22);
  knockOut(g, c, toothMask(g, { seed: 2293, density: 25, size: 1.3 }), 0.3);
}

/** The two edges of a band, head to tail. */
function edges(band: Vec2[]): [Vec2[], Vec2[]] {
  const n = band.length / 2;
  return [band.slice(0, n), band.slice(n).reverse()];
}

function keyLine(c: CanvasRenderingContext2D, pts: readonly Vec2[], width: number): void {
  c.lineWidth = width;
  c.beginPath();
  pts.forEach(([x, y], i) => (i ? c.lineTo(x + REG_KEY[0], y + REG_KEY[1]) : c.moveTo(x + REG_KEY[0], y + REG_KEY[1])));
  c.stroke();
}

function wakeBand(c: CanvasRenderingContext2D, run: Sample[], color: string, half: number, near: boolean): void {
  if (run.length < 2) return;
  const band = ribbon(run, s => half * s.s * Math.pow(Math.max(0, 1 - s.age), 0.85));
  c.fillStyle = near ? color : mix(color, PALE, 0.42);
  c.fill(polyPath(band));
  const [l, r] = edges(band);
  c.strokeStyle = KEY;
  const base = c.globalAlpha;
  c.globalAlpha = base * (near ? 1 : 0.7);
  keyLine(c, l, 1.3);
  keyLine(c, r, 1.3);
  c.globalAlpha = base;
}

function drawBody(c: CanvasRenderingContext2D, S: Snapshot, b: Body): void {
  const name = b.planet.name, sat = name === 'saturn' ? bodyBand(b.p, RINGS.inner, RINGS.outer, E1, E2) : null;
  const ur = name === 'uranus' ? bodyRing(b.p, URANUS_RING, MOTION, E1) : null;
  c.strokeStyle = KEY;
  if (sat) { c.fillStyle = ASH; c.fill(polyPath(sat.back)); keyLine(c, sat.back.concat([sat.back[0]!]), 1.2); }
  if (ur) { c.lineWidth = 1.2; c.beginPath(); ur.back.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y))); c.stroke(); }
  if (name === 'earth' && !S.moon.front) moon(c, S);
  c.save();
  c.translate(b.x, b.y);
  const R = b.R;
  c.fillStyle = COLOR[name];
  c.fill(disc(0, 0, R));
  if (name === 'jupiter') {
    c.save();
    c.clip(disc(0, 0, R));
    c.fillStyle = VERMILION;
    for (const [y0, h] of [[-0.65, 0.18], [-0.22, 0.24], [0.28, 0.14], [0.56, 0.18]] as const) c.fillRect(-R, y0 * R, R * 2, h * R);
    c.restore();
  }
  if (name === 'earth') {
    c.save();
    c.clip(disc(0, 0, R));
    c.fillStyle = PINE;
    c.fill(polyPath([[-0.7 * R, -0.5 * R], [-0.1 * R, -0.8 * R], [0.25 * R, -0.25 * R], [-0.2 * R, 0.2 * R], [-0.5 * R, 0.1 * R]]));
    c.restore();
  }
  // the shadow block: indigo over the part the Sun does not reach
  const shade = new Path2D();
  shade.addPath(disc(0, 0, R));
  shade.addPath(polyPath(litShape(R, b.toSun, b.phase)));
  c.globalAlpha = 0.72;
  c.fillStyle = DEEP;
  c.fill(shade, 'evenodd');
  c.globalAlpha = 1;
  c.lineWidth = 1.5;
  c.beginPath();
  c.arc(REG_KEY[0], REG_KEY[1], R, 0, TAU);
  c.stroke();
  c.restore();
  if (sat) { c.fillStyle = ASH; c.fill(polyPath(sat.front)); keyLine(c, sat.front.concat([sat.front[0]!]), 1.2); }
  if (ur) { c.lineWidth = 1.2; c.beginPath(); ur.front.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y))); c.stroke(); }
  if (name === 'earth' && S.moon.front) moon(c, S);
}

function moon(c: CanvasRenderingContext2D, S: Snapshot): void {
  const mo = S.moon;
  c.fillStyle = WASHI;
  c.fill(disc(mo.x, mo.y, mo.R));
  c.strokeStyle = KEY;
  c.lineWidth = 1;
  c.beginPath();
  c.arc(mo.x + REG_KEY[0], mo.y + REG_KEY[1], mo.R, 0, TAU);
  c.stroke();
}

export const woodblockSpiral: Scene = {
  name: 'spiral-woodblock',
  duration: (INTRO + LOOP) / 12,
  loopFrom: INTRO / 12,
  poster: (INTRO + POSTER_M) / 12,
  draw(f) {
    const { stage } = f;
    const fr = frameFit(stage.w, stage.h), L = layout(), S = snapshot(spiralSky(f));
    ground(f, WASHI, { seed: 2200, texture: 1.3 });
    still(f, 'sp02-blue', g => blueBlock(g, fr), { blend: 'multiply' });

    const print = scratch(f, 'sp02-print', g => {
      const c = g.ctx;
      enter(c, fr);
      c.lineCap = 'round';
      c.lineJoin = 'round';
      // rain lines: the dust the system flies through, carved as fine strokes along its path
      c.strokeStyle = WASHI;
      const dx = MOTION[0], dy = MOTION[1];
      for (const d of dust(S)) {
        const len = (10 + d.tone * 22) * d.s;
        c.globalAlpha = d.alpha * 0.8;
        c.lineWidth = (0.8 + d.tone * 0.8) * d.s;
        c.beginPath();
        c.moveTo(d.x - dx * len, d.y - dy * len);
        c.lineTo(d.x + dx * len * 0.2, d.y + dy * len * 0.2);
        c.stroke();
      }
      c.globalAlpha = 1;
      paint(S, {
        run: (t, run, near) => inWake(c, S, () => {
          if (t.k === 8) wakeBand(c, run, WASHI, 1.4, near);
          else { const n = S.bodies[t.k]!.planet.name; wakeBand(c, run, WAKE[n], WIDTH[n], near); }
        }),
        orbit: (_pl, half, near) => orbitRings(c, S, half, near, KEY, 1.4),
        rocks(rocks) {
          c.fillStyle = KEY;
          c.beginPath();
          for (const r of rocks) { const s = (0.5 + r.rock.size * 0.6) * r.s; c.moveTo(r.x + s, r.y); c.arc(r.x, r.y, s, 0, TAU); }
          c.fill();
        },
        sunTrail: st => inWake(c, S, () => wakeBand(c, st, HALO, 5, false)),
        sun() {
          const sx = S.sun.x, sy = S.sun.y;
          c.fillStyle = HALO;
          c.fill(disc(sx, sy, SUN_R + 22));
          c.save();
          c.strokeStyle = WASHI;
          c.lineWidth = 3;
          c.beginPath();
          for (const [a, b] of L.rays) { c.moveTo(a![0], a![1]); c.lineTo(b![0], b![1]); }
          c.stroke();
          c.restore();
          c.fillStyle = VERMILION;
          c.fill(disc(sx, sy, SUN_R));
          c.save();
          c.translate(REG_KEY[0], REG_KEY[1]);
          for (const s of L.sun) drawStroke(c, s, 1);
          c.restore();
        },
        body: b => drawBody(c, S, b),
      });
      // cartouche ground and the seal, then the key's frame and title
      c.fillStyle = '#e9d9ae';
      c.fillRect(986, 40, 50, 192);
      c.fillStyle = VERMILION;
      c.fillRect(989, 247, 46, 46);
      c.save();
      c.translate(REG_KEY[0], REG_KEY[1]);
      for (const s of L.frame) drawStroke(c, s, 1);
      for (const s of L.title) drawStroke(c, s, 1);
      c.restore();
      c.strokeStyle = WASHI;
      c.lineWidth = 3.2;
      c.lineCap = 'square';
      c.lineJoin = 'miter';
      c.beginPath();
      for (const pts of SEAL_CUT) pts.forEach(([x, y], k) => (k ? c.lineTo(x, y) : c.moveTo(x, y)));
      c.stroke();
      knockOut(f, c, toothMask(f, { seed: 2294, density: 30, size: 1.5 }), 0.26);
    });
    composite(f, print);
    composite(f, toothMask(f, { seed: 2297, kind: 'grain', density: 1, size: 1, length: 700, color: WASHI }), { alpha: 0.1 });
  },
};
