/**
 * G04 "Night City" (cities; riso poster). A three-ink risograph poster that starts whole: blue, fluorescent pink and
 * yellow drums, each printed a hair out of register, overprinting into purples, oranges and greens. A city under a big
 * moon: windows go on and off, a lit train crosses the elevated line, clouds drift, the mast light blinks, and the
 * river below carries the whole skyline back upside down in shivering strips.
 *
 * Each ink is drawn as its own plate (solids and page-locked halftone tones at its own screen angle), knocked out
 * where another ink must print clean, textured, then multiplied onto the stock. Window changes are paired on/off
 * within the loop and the train and clouds travel exactly one lap, so the loop is seamless.
 */
import { clamp, TAU, type Vec2 } from '../../core/math';
import { hashSeed, rng } from '../../core/random';
import type { Scene, SceneFrame } from '../../core/scene';
import { cached, composite, fit, ground, ink, perSize, phase, screen, smooth, wrap, type Fit } from './common';
import { GALLERY } from './palettes';

const PAL = GALLERY.risoCity;
const [BLUE, PINK, YELLOW] = PAL.inks as [string, string, string];
const W = 1080, H = 1350, WATER = 1030;
const MOON: Vec2 = [770, 300], MOON_R = 150;
const LAP = W + 900;

interface Building { x: number; w: number; top: number; spire: number; windows: { x: number; y: number; w: number; h: number; lit: boolean; flip: number; span: number }[] }

function skyline(seed: number, near: boolean): Building[] {
  const r = rng(seed), out: Building[] = [];
  for (let x = -30; x < W + 30;) {
    const w = near ? 70 + r() * 110 : 44 + r() * 80;
    const top = near ? 560 + r() * 330 : 660 + r() * 200;
    const b: Building = { x, w, top, spire: near && r() < 0.18 ? 40 + r() * 90 : 0, windows: [] };
    if (near) {
      const cols = Math.max(1, Math.floor((w - 18) / 26)), gapX = (w - cols * 14) / (cols + 1);
      for (let y = top + 22; y < WATER - 40; y += 36) {
        for (let c = 0; c < cols; c++) {
          const k = out.length * 1000 + Math.round(y) * 10 + c, h = hashSeed(seed, k);
          b.windows.push({ x: x + gapX + c * (14 + gapX), y, w: 14, h: 20, lit: (h % 100) < 58, flip: (h % 1000) / 1000, span: (h % 7) < 2 ? 0.15 + ((h >> 4) % 30) / 100 : 0 });
        }
      }
    } else {
      for (let y = top + 18; y < WATER - 30; y += 30) {
        const h = hashSeed(seed, Math.round(x), Math.round(y));
        if (h % 100 < 30) b.windows.push({ x: x + 8 + (h % 3) * (w - 22) / 2, y, w: 7, h: 10, lit: true, flip: 0, span: 0 });
      }
    }
    out.push(b);
    x += w + (near ? 4 + r() * 16 : -8 + r() * 10);
  }
  return out;
}

const FAR = skyline(4041, false), NEAR = skyline(4042, true);
const TOWER = NEAR.reduce((a, b) => (b.top < a.top ? b : a));
const STARS = (() => {
  const r = rng(4043);
  return Array.from({ length: 60 }, () => ({ x: r() * W, y: r() * 540, s: 2.5 + r() * 3.5 }))
    .filter(st => Math.hypot(st.x - MOON[0], st.y - MOON[1]) > MOON_R + 30);
})();
const CLOUDS = [{ y: 430, len: 420, th: 34, x0: 100 }, { y: 520, len: 300, th: 26, x0: 820 }, { y: 180, len: 260, th: 22, x0: 420 }];

const layout = perSize((w, h): { F: Fit } => ({ F: fit(w, h, W, H) }));

/** Whether window `win` is lit at loop phase p: a few flip for a while and come back within the loop. */
const litAt = (win: Building['windows'][number], p: number): boolean => {
  if (win.span <= 0) return win.lit;
  const into = wrap(p - win.flip, 1);
  return into < win.span ? !win.lit : win.lit;
};

function trainX(p: number): number {
  return wrap(p * LAP, LAP) - 760;
}

function rect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  c.rect(x, y, w, h);
}

/** Design-space transform onto the plate. */
function design(g: SceneFrame, F: Fit): CanvasRenderingContext2D {
  const [ox, oy] = F.P(0, 0);
  g.ctx.translate(ox, oy);
  g.ctx.scale(F.s, F.s);
  return g.ctx;
}

/** The river: the plate's own skyline copied back upside down in strips that shiver along. */
function reflect(g: SceneFrame, F: Fit, p: number, alpha: number): void {
  const { ctx, stage } = g, layer = ctx.canvas, sc = stage.scale * F.s, [ox, oy] = F.P(0, 0);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = alpha;
  const step = 6, squash = 1.5;
  for (let d = 0; d < H - WATER; d += step) {
    const src = WATER - (d + step) * squash, dx = Math.sin(TAU * (p * 4 + d / 70)) * (1 + d * 0.025);
    if (src < 0) break;
    ctx.drawImage(layer, 0, (oy + src * F.s) * stage.scale, stage.outW, step * squash * sc, (ox + dx * F.s) * stage.scale, (oy + (WATER + d) * F.s) * stage.scale, stage.outW, step * sc + 1);
  }
  ctx.restore();
}

/** Calm water lines knocked out of the river on every plate, drifting one dash period per loop. */
function ripples(g: SceneFrame, p: number): void {
  const c = g.ctx;
  c.save();
  c.globalCompositeOperation = 'destination-out';
  c.lineWidth = 3;
  c.lineCap = 'round';
  c.beginPath();
  for (let k = 0; WATER + 16 + k * 20 < H; k++) {
    const y = WATER + 16 + k * 20, period = 150 + (k % 3) * 40, off = wrap(k * 53 + p * period * (k % 2 ? 1 : -1), period);
    for (let x = off - period; x < W; x += period) { c.moveTo(x, y); c.lineTo(x + period * (0.25 + (k % 4) * 0.1), y); }
  }
  c.stroke();
  c.restore();
}

function stars(c: CanvasRenderingContext2D): void {
  c.beginPath();
  for (const st of STARS) {
    c.moveTo(st.x + st.s, st.y);
    c.arc(st.x, st.y, st.s, 0, TAU);
  }
  c.fill();
}

const TOOTH = { seed: 4050, density: 26, size: 1.8, alpha: 0.35 };

export const nightCityScene: Scene = {
  name: 'night-city',
  duration: 144 / 12,
  loopFrom: 0,
  poster: 64 / 12,
  draw(f) {
    const { stage } = f;
    const { F } = layout(stage.w, stage.h), p = phase(f), tx = trainX(p);
    ground(f, PAL.paper, { seed: 404, texture: 0.8 });

    const moon = (c: CanvasRenderingContext2D) => { c.beginPath(); c.arc(MOON[0], MOON[1], MOON_R, 0, TAU); c.fill(); };
    const nearWindows = (c: CanvasRenderingContext2D, lit: boolean) => {
      c.beginPath();
      for (const b of NEAR) for (const win of b.windows) if (litAt(win, p) === lit) rect(c, win.x, win.y, win.w, win.h);
      c.fill();
    };
    const farWindows = (c: CanvasRenderingContext2D) => {
      c.beginPath();
      for (const b of FAR) for (const win of b.windows) rect(c, win.x, win.y, win.w, win.h);
      c.fill();
    };
    const buildings = (c: CanvasRenderingContext2D, list: Building[]) => {
      c.beginPath();
      for (const b of list) {
        rect(c, b.x, b.top, b.w, WATER - b.top);
        if (b.spire) { c.moveTo(b.x + b.w * 0.35, b.top); c.lineTo(b.x + b.w / 2, b.top - b.spire); c.lineTo(b.x + b.w * 0.65, b.top); c.closePath(); }
      }
      c.fill();
    };
    const train = (c: CanvasRenderingContext2D, part: 'body' | 'windows') => {
      c.beginPath();
      for (let k = 0; k < 4; k++) {
        const x = tx + k * 190;
        if (part === 'body') c.roundRect(x, 884, 182, 50, [18, 18, 4, 4]);
        else for (let j = 0; j < 5; j++) rect(c, x + 16 + j * 33, 898, 20, 16);
      }
      c.fill();
    };
    const deck = (c: CanvasRenderingContext2D) => {
      c.beginPath();
      rect(c, -40, 934, W + 80, 16);
      for (let x = 60; x < W; x += 240) { rect(c, x, 950, 14, WATER - 950); c.moveTo(x - 30, 950); c.lineTo(x + 44, 950); c.lineTo(x + 7, 986); c.closePath(); }
      c.fill();
    };
    const clouds = () => {
      const path = new Path2D();
      CLOUDS.forEach((cl, k) => {
        const x = wrap(cl.x0 + p * (W + cl.len + 200) * (k === 1 ? -1 : 1), W + cl.len + 200) - cl.len - 100;
        path.roundRect(x, cl.y, cl.len, cl.th, cl.th / 2);
        path.roundRect(x + cl.len * 0.2, cl.y - cl.th * 0.6, cl.len * 0.45, cl.th, cl.th / 2);
      });
      return path;
    };

    ink(f, 'g04-blue', g => {
      composite(g, cached(f, 'g04-blue-static', s => {
        const c = design(s, F);
        screen(c, [0, 0, W, WATER], { color: BLUE, cell: 7, angle: 0.26, density: (_x, y) => 0.92 - 0.72 * (y / WATER) });
        c.fillStyle = BLUE;
        buildings(c, NEAR);
        c.globalCompositeOperation = 'destination-out';
        moon(c);
        deck(c);
        c.globalCompositeOperation = 'source-over';
        screen(c, [0, WATER, W, H - WATER], { color: BLUE, cell: 7, angle: 0.26, density: 0.55 });
      }));
      const c = design(g, F);
      c.globalCompositeOperation = 'destination-out';
      nearWindows(c, true);
      train(c, 'body');
      stars(c);
      c.globalCompositeOperation = 'source-over';
      reflect(g, F, p, 0.55);
      ripples(g, p);
    }, { tooth: TOOTH, alpha: 0.95 });

    ink(f, 'g04-pink', g => {
      composite(g, cached(f, 'g04-pink-static', s => {
        const c = design(s, F);
        screen(c, [0, 300, W, WATER - 300], { color: PINK, cell: 7, angle: 1.31, density: (_x, y) => smooth(360, WATER, y) * 0.75 });
        c.fillStyle = PINK;
        buildings(c, FAR);
        deck(c);
        screen(c, [0, 380, W, WATER - 380], { color: PINK, cell: 7, angle: 1.31, density: 0.4, clip: (() => { const q = new Path2D(); for (const b of NEAR) q.rect(b.x, b.top - b.spire, b.w, WATER - b.top + b.spire); return q; })() });
        c.globalCompositeOperation = 'destination-out';
        moon(c);
        farWindows(c);
        c.globalCompositeOperation = 'source-over';
        screen(c, [0, WATER, W, H - WATER], { color: PINK, cell: 7, angle: 1.31, density: (_x, y) => 0.3 * (1 - (y - WATER) / (H - WATER)) });
      }));
      const c = design(g, F);
      screen(c, [-100, 0, W + 200, 600], { color: PINK, cell: 7, angle: 1.31, density: 0.55, clip: clouds() });
      c.globalCompositeOperation = 'destination-out';
      nearWindows(c, true);
      c.globalCompositeOperation = 'source-over';
      c.fillStyle = PINK;
      train(c, 'body');
      c.globalCompositeOperation = 'destination-out';
      train(c, 'windows');
      c.globalCompositeOperation = 'source-over';
      // the mast light: two quick blinks every second
      if (wrap(p * 12, 1) < 0.18 || (wrap(p * 12, 1) > 0.3 && wrap(p * 12, 1) < 0.42)) {
        c.fillStyle = PINK;
        c.beginPath();
        c.arc(TOWER.x + TOWER.w / 2, TOWER.top - TOWER.spire - 12, 9, 0, TAU);
        c.fill();
      }
      reflect(g, F, p, 0.5);
      ripples(g, p);
    }, { tooth: { ...TOOTH, seed: 4051 }, offset: [4, -3], alpha: 0.9 });

    ink(f, 'g04-yellow', g => {
      composite(g, cached(f, 'g04-yellow-static', s => {
        const c = design(s, F);
        c.fillStyle = YELLOW;
        moon(c);
        farWindows(c);
        deck(c);
        // lamps along the deck, each with a small halo tone
        for (let x = 30; x < W; x += 120) {
          screen(c, [x - 40, 900, 80, 80], { color: YELLOW, cell: 6, angle: 0, density: (px, py) => clamp(0.7 - Math.hypot(px - x, py - 942) / 44, 0, 1) });
          c.beginPath();
          c.arc(x, 942, 5, 0, TAU);
          c.fill();
        }
        screen(c, [MOON[0] - 260, MOON[1] - 260, 520, 520], { color: YELLOW, cell: 7, angle: 0, density: (px, py) => clamp(0.55 - (Math.hypot(px - MOON[0], py - MOON[1]) - MOON_R) / 200, 0, 0.55) });
      }));
      const c = design(g, F);
      c.fillStyle = YELLOW;
      nearWindows(c, true);
      train(c, 'windows');
      stars(c);
      reflect(g, F, p, 0.75);
      ripples(g, p);
    }, { tooth: { ...TOOTH, seed: 4052 }, offset: [-3, 3] });
  },
};
