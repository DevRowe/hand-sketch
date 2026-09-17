/**
 * G10 "Snow Fox" (winter; woodcut). A two-block linocut, black and vermilion on cream, that starts whole: a fox asleep
 * in the snow below pines and a full moon. Snow falls; it shows only where it crosses the black of the sky and the red
 * of the fox, as carved flecks do. The fox breathes, flicks an ear twice and its tail tip once.
 *
 * Everything white is "carved": gouge marks are lens-shaped cuts in paper colour, clustered where a cutter would work
 * the block (around the moon, along drifts). Both blocks print with woodgrain and uneven ink.
 */
import { catmullRom } from '../../core/geometry';
import { clamp, lerp, TAU, type Vec2 } from '../../core/math';
import { noise1, rng } from '../../core/random';
import type { Scene } from '../../core/scene';
import { composite, fit, ground, ink, perSize, phase, polyPath, swell, toothMask, wave, wrap, type Fit } from './common';
import { GALLERY } from './palettes';

const PAL = GALLERY.snowblock;
const BLACK = PAL.ink, RED = PAL.fills[0]!, CREAM = PAL.paper;
const W = 1080, H = 1080, LOOP = 144;
const MOON: Vec2 = [770, 210];
const FOX: Vec2 = [560, 880];

const hill = (x: number): number => 560 + 50 * Math.sin(x / 260 + 0.6) + noise1(x / 90, 1010) * 26;

/** A gouge: a lens-shaped cut of length `len` and half-width `wd` at angle `a`. */
function gouge(c: CanvasRenderingContext2D, x: number, y: number, len: number, wd: number, a: number): void {
  const ca = Math.cos(a), sa = Math.sin(a), ex = x + ca * len, ey = y + sa * len, mx = (x + ex) / 2, my = (y + ey) / 2;
  c.moveTo(x, y);
  c.quadraticCurveTo(mx - sa * wd, my + ca * wd, ex, ey);
  c.quadraticCurveTo(mx + sa * wd, my - ca * wd, x, y);
}

// the fox, in its own units around the middle of its curl
const BODY = catmullRom([[-60, -70], [60, -100], [160, -70], [205, 10], [170, 80], [40, 100], [-80, 90], [-120, 20]], 8, true);
const TAIL = catmullRom([[150, -40], [215, 30], [175, 110], [40, 150], [-110, 140], [-215, 110], [-262, 84], [-230, 70], [-140, 96], [0, 104], [120, 84], [168, 30]], 8, true);
const HEAD = catmullRom([[-70, 60], [-60, -10], [-100, -48], [-150, -40], [-200, 20], [-238, 62], [-200, 78], [-130, 80]], 8, true);
const earPts = (base: Vec2, tip: Vec2, back: Vec2): Vec2[] => [base, tip, back];

interface Layout { F: Fit; flakes: { x: number; y: number; r: number; k: number; o: number }[] }
const layout = perSize((w, h): Layout => {
  const r = rng(1020);
  const flakes = [1, 2, 3].flatMap(k => Array.from({ length: [0, 150, 80, 36][k]! }, () => ({ x: r() * 1120 - 20, y: r() * 1100, r: [0, 2.4, 4, 6.5][k]!, k, o: r() })));
  return { F: fit(w, h, W, H), flakes };
});

export const snowFoxScene: Scene = {
  name: 'snow-fox',
  duration: LOOP / 12,
  loopFrom: 0,
  poster: 20 / 12,
  draw(f) {
    const { stage } = f;
    const L = layout(stage.w, stage.h), p = phase(f), { P, s } = L.F, [ox, oy] = P(0, 0);
    ground(f, CREAM, { seed: 1010, texture: 1.1 });
    const breath = 1 + 0.028 * swell(p, 4);
    const twitch = (t: number) => (t < 0.05 ? Math.sin((Math.PI * t) / 0.05) : 0);
    const ear = 0.35 * twitch(wrap(p * 2 - 0.12, 1));
    const flick = 0.5 * twitch(wrap(p - 0.62, 1) * 0.6);

    const foxPose = (c: CanvasRenderingContext2D) => {
      c.translate(FOX[0], FOX[1] + 100);
      c.scale(1, breath);
      c.translate(0, -100);
    };

    // the black key block: sky, moon rings, pines, drift shadows, the fox's dark points; white is what was carved away
    ink(f, 'g10-black', g => {
      const c = g.ctx;
      c.translate(ox, oy);
      c.scale(s, s);
      composite(g, cachedBlack(g), {});
      // falling snow is carved out of the black
      c.save();
      c.setTransform(stage.scale * s, 0, 0, stage.scale * s, ox * stage.scale, oy * stage.scale);
      c.globalCompositeOperation = 'destination-out';
      c.beginPath();
      for (const fl of L.flakes) {
        const y = wrap(fl.y + p * 1100 * fl.k, 1100) - 10, x = fl.x + 24 * wave(p, fl.k, fl.o);
        c.moveTo(x + fl.r, y);
        c.arc(x, y, fl.r, 0, TAU);
      }
      c.fill();
      c.restore();
      // the fox's black points: ear backs, eye, nose, paw, tail band; the drift cuts stop at its outline
      c.save();
      foxPose(c);
      c.globalCompositeOperation = 'destination-out';
      c.fill(polyPath(BODY));
      c.fill(polyPath(HEAD));
      c.fill(polyPath(TAIL));
      c.globalCompositeOperation = 'source-over';
      c.fillStyle = BLACK;
      c.strokeStyle = BLACK;
      c.lineCap = 'round';
      c.lineJoin = 'round';
      for (const [base, tip, back, a] of [[[-140, -38], [-120, -112], [-104, -46], ear], [[-110, -46], [-66, -110], [-72, -54], ear * 0.6]] as const) {
        c.save();
        c.translate(base[0], base[1]);
        c.rotate(-a);
        c.translate(-base[0], -base[1]);
        c.fill(polyPath(earPts(base as Vec2, tip as Vec2, back as Vec2)));
        c.restore();
      }
      c.lineWidth = 4;
      c.beginPath();
      c.moveTo(-172, 14); c.quadraticCurveTo(-160, 24, -146, 16);
      c.stroke();
      c.beginPath();
      c.arc(-236, 64, 9, 0, TAU);
      c.fill();
      c.lineWidth = 3.5;
      c.stroke(polyPath(HEAD));
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(-200, 102); c.quadraticCurveTo(-150, 132, -60, 138);
      c.stroke();
      c.restore();
    }, { tooth: { seed: 1030, density: 30, size: 1.6, alpha: 0.35 } });

    // the vermilion block: the fox, carved with fur lines, the tail's white tip cut away
    ink(f, 'g10-red', g => {
      const c = g.ctx;
      c.translate(ox, oy);
      c.scale(s, s);
      foxPose(c);
      c.fillStyle = RED;
      c.fill(polyPath(BODY));
      c.fill(polyPath(HEAD));
      c.save();
      c.translate(-230, 84);
      c.rotate(flick);
      c.translate(230, -84);
      c.fill(polyPath(TAIL));
      c.restore();
      c.globalCompositeOperation = 'destination-out';
      c.beginPath();
      const r = rng(1040);
      // fur: gouges following the curl
      for (let k = 0; k < 90; k++) {
        const a = -Math.PI + r() * Math.PI * 1.1, rad = 40 + r() * 110, x = 40 + Math.cos(a) * rad * 1.25, y = Math.sin(a) * rad * 0.7;
        gouge(c, x, y, 16 + r() * 22, 1.6 + r() * 1.2, a + Math.PI / 2 + (r() - 0.5) * 0.3);
      }
      for (let k = 0; k < 70; k++) {
        const u = r(), x = lerp(170, -220, u), y = lerp(40, 100, Math.sin(u * Math.PI)) + (r() - 0.5) * 30 + (u > 0.5 ? 20 : 0);
        gouge(c, x, y, 18 + r() * 20, 1.4 + r(), Math.PI - 0.3 + u * 0.5);
      }
      // cheek and chest ruff
      for (let k = 0; k < 16; k++) gouge(c, -210 + r() * 90, 30 + r() * 40, 12 + r() * 10, 1.6, 2.6 + r() * 0.4);
      c.fill();
      // the white tail tip
      c.save();
      c.translate(-230, 84);
      c.rotate(flick);
      c.beginPath();
      c.ellipse(-12, 2, 30, 24, 0.3, 0, TAU);
      c.fill();
      c.restore();
    }, { tooth: { seed: 1031, density: 30, size: 1.6, alpha: 0.3 }, offset: [2, -1] });

    // both blocks' woodgrain
    composite(f, toothMask(f, { seed: 1050, kind: 'grain', density: 1.6, size: 1, length: 700, color: CREAM }), { alpha: 0.22 });
  },
};

/** The static part of the black block, cut once. */
function cachedBlack(g: Parameters<Scene['draw']>[0]): HTMLCanvasElement {
  const key = 'gallery-still:g10-black-static', fresh = !g.stage.hasLayer(key), layer = g.stage.layer(key);
  if (!fresh) return layer;
  const c = g.stage.context(layer), F = fit(g.stage.w, g.stage.h, W, H), [ox, oy] = F.P(0, 0);
  g.stage.reset(c);
  c.translate(ox, oy);
  c.scale(F.s, F.s);
  const r = rng(1060);
  // night sky down to the snowy hill
  c.fillStyle = BLACK;
  c.beginPath();
  c.moveTo(-40, -40);
  c.lineTo(1120, -40);
  for (let x = 1120; x >= -40; x -= 10) c.lineTo(x, hill(x));
  c.closePath();
  c.fill();
  // pines on the slope, outlined by a carved line where they meet the sky
  const pines: [number, number, number][] = [[90, 640, 1.2], [210, 610, 0.8], [300, 660, 1.4], [880, 640, 1.3], [990, 600, 0.9], [760, 690, 0.7], [1040, 700, 1.1]];
  for (const [x, base, sc] of pines) {
    const tiers = 5, hgt = 330 * sc, wid = 120 * sc;
    const tree = new Path2D();
    for (let t = 0; t < tiers; t++) {
      const top = base - hgt + (t * hgt) / tiers - 20 * sc, bot = base - hgt + ((t + 1.5) * hgt) / tiers, half = wid * (0.3 + (t / tiers) * 0.7);
      tree.moveTo(x, top);
      tree.lineTo(x + half, bot);
      tree.quadraticCurveTo(x, bot - 16 * sc, x - half, bot);
      tree.closePath();
    }
    tree.rect(x - 7 * sc, base - 20, 14 * sc, 40);
    c.save();
    c.strokeStyle = CREAM;
    c.lineWidth = 7;
    c.lineJoin = 'round';
    c.stroke(tree);
    c.restore();
    c.fillStyle = BLACK;
    c.fill(tree);
    // snow lying on each tier
    c.save();
    c.globalCompositeOperation = 'destination-out';
    c.beginPath();
    for (let t = 1; t < tiers; t++) {
      const bot = base - hgt + ((t + 1.5) * hgt) / tiers, half = wid * (0.3 + (t / tiers) * 0.7);
      gouge(c, x - half * 0.85, bot - 6, half * 0.8, 3, -0.35);
      gouge(c, x + half * 0.05, bot - 12, half * 0.8, 3, 0.35);
    }
    c.fill();
    c.restore();
  }
  // the moon: cut clean, ringed by carved halos
  c.globalCompositeOperation = 'destination-out';
  c.beginPath();
  c.arc(MOON[0], MOON[1], 92, 0, TAU);
  c.fill();
  c.lineWidth = 4;
  for (const [R, dash] of [[122, 0], [156, 18], [196, 10]] as const) {
    c.setLineDash(dash ? [dash, dash * 0.8] : []);
    c.beginPath();
    c.arc(MOON[0], MOON[1], R, 0, TAU);
    c.stroke();
  }
  c.setLineDash([]);
  // sky gouges, crowding towards the moon, and rays
  c.beginPath();
  for (let k = 0; k < 420; k++) {
    const x = r() * 1080, y = r() * 600, d = Math.hypot(x - MOON[0], y - MOON[1]);
    if (y > hill(x) - 20 || d < 210 || r() > clamp(1.1 - d / 700, 0.12, 1)) continue;
    gouge(c, x, y, 14 + r() * 30, 1.4 + r() * 1.4, (r() - 0.5) * 0.25);
  }
  for (let k = 0; k < 44; k++) {
    const a = (k / 44) * TAU + r() * 0.05, r0 = 212 + r() * 20;
    gouge(c, MOON[0] + Math.cos(a) * r0, MOON[1] + Math.sin(a) * r0, 30 + r() * 50, 2.2, a);
  }
  c.fill();
  c.globalCompositeOperation = 'source-over';
  // drift shadows on the snow: black cuts left standing, heavier low down and under the fox
  c.fillStyle = BLACK;
  c.beginPath();
  for (let k = 0; k < 260; k++) {
    const x = r() * 1180 - 60, y = lerp(620, 1080, Math.pow(r(), 0.7));
    const under = Math.max(0, 1 - Math.hypot((x - FOX[0]) / 320, (y - FOX[1] - 130) / 70));
    if (r() > clamp((y - 600) / 600 + under, 0.08, 1)) continue;
    gouge(c, x, y, 30 + r() * 110 + under * 90, 1.6 + r() * 2 + under * 2, -0.05 + noise1(x / 200, 1070) * 0.25);
  }
  c.fill();
  return layer;
}
