/**
 * G05 "Fiddlehead" (plants growing; cyanotype). A sun print: Prussian blue brushed onto rag paper, a fern laid on it
 * as a pale photogram shadow. The growth is the drawing: the crozier unrolls into a frond, its leaflets unfolding
 * behind the uncurling front, while a younger crozier waits beside it. Then the loop: the frond breathes in a draught,
 * a band of sunlight passes over the print, and dust turns in it.
 *
 * The frond is grown, not revealed: its midrib is integrated from a curvature that loosens as it unrolls (a tight
 * spiral at the tip easing to an arch), and every leaflet's openness follows the unrolling front.
 */
import { squiggle } from '../../art/glyphs';
import { clamp, lerp, TAU, type Vec2 } from '../../core/math';
import { noise2, rng } from '../../core/random';
import type { Scene, SceneFrame } from '../../core/scene';
import { drawStroke, prepareStroke } from '../../core/stroke';
import { ease, fit, ground, nf, perSize, polyPath, scratch, smooth, still, swell, wave, type Fit } from './common';
import { GALLERY } from './palettes';

const PAL = GALLERY.cyanotype;
const DEEP = PAL.fills[1]!, COAT = PAL.fills[0]!, LIGHT = PAL.accents[0]!;
const W = 1080, H = 1350;
const GROW = [10, 96] as const, LOOP = 96, LOOP_FROM = GROW[1];

interface Frond { base: Vec2; lean: number; minL: number; maxL: number; leaf: number; turns: number; seed: number }
const FRONDS: Frond[] = [
  { base: [400, 1320], lean: 0.5, minL: 420, maxL: 1250, leaf: 230, turns: 2.4, seed: 1 },
  { base: [800, 1270], lean: -0.3, minL: 280, maxL: 520, leaf: 110, turns: 2.6, seed: 2 },
  { base: [330, 1300], lean: -0.62, minL: 900, maxL: 900, leaf: 150, turns: 0, seed: 3 },
];

/** Midrib points of a frond at unroll `e` (0 = tight crozier, 1 = open arch), from base to tip. */
function midrib(fr: Frond, e: number, sway: number): { pts: Vec2[]; heads: number[] } {
  const L = lerp(fr.minL, fr.maxL, e), coil = lerp(0.72, 0.04, e), turns = fr.turns * (1 - e) + 0.08;
  const n = 220, ds = L / n, pts: Vec2[] = [fr.base], heads: number[] = [];
  let [x, y] = fr.base;
  for (let k = 0; k <= n; k++) {
    const u = k / n;
    const curl = u > 1 - coil ? turns * TAU * Math.pow((u - (1 - coil)) / coil, 1.9) : 0;
    const th = -Math.PI / 2 + (fr.lean + sway) * u + curl * Math.sign(fr.lean || 1);
    heads.push(th);
    if (k > 0) { x += Math.cos(th) * ds; y += Math.sin(th) * ds; pts.push([x, y]); }
  }
  return { pts, heads };
}

/** A leaflet along +x of length `len`: lance-shaped with scalloped lobes, tip curving towards the frond tip. */
function leaflet(len: number, side: number, lobes: number): Vec2[] {
  const top: Vec2[] = [], bottom: Vec2[] = [], n = 40;
  for (let k = 0; k <= n; k++) {
    const u = k / n, x = u * len, bow = -side * u * u * len * 0.12;
    const half = len * 0.1 * Math.pow(Math.sin(Math.PI * Math.min(1, u * 1.08)), 0.75) * (0.72 + 0.28 * Math.abs(Math.sin(u * Math.PI * lobes)));
    top.push([x, bow - half]);
    bottom.push([x, bow + half]);
  }
  return [...top, ...bottom.reverse()];
}

function drawFrond(c: CanvasRenderingContext2D, fr: Frond, e: number, p: number, alive: number, fade = 1): void {
  const sway = alive * 0.035 * wave(p, 1, fr.seed * 0.3);
  const { pts, heads } = midrib(fr, e, sway), n = pts.length - 1;
  const coil = lerp(0.72, 0.04, e);
  // the midrib: a tapering band
  const left: Vec2[] = [], right: Vec2[] = [];
  pts.forEach(([x, y], k) => {
    const th = heads[k]!, wdt = lerp(fr.leaf * 0.09, 2.5, Math.pow(k / n, 0.8));
    left.push([x + Math.cos(th - Math.PI / 2) * wdt, y + Math.sin(th - Math.PI / 2) * wdt]);
    right.push([x + Math.cos(th + Math.PI / 2) * wdt, y + Math.sin(th + Math.PI / 2) * wdt]);
  });
  c.globalAlpha = 0.95 * fade;
  c.fill(polyPath([...left, ...right.reverse()]));
  // leaflets: open behind the unrolling front, furled and small inside the coil
  for (let j = 0, u = 0.26; u < 0.985; j++, u += 0.043) {
    const k = Math.round(u * n), [x, y] = pts[k]!, th = heads[k]!;
    const open = smooth(0, 0.18, 1 - coil - u), size = fr.leaf * Math.pow(Math.sin(Math.PI * Math.min(1, u * 1.02)), 0.6) * (1 - 0.45 * u) * lerp(0.22, 1, open);
    if (size < 4) continue;
    for (const side of [-1, 1]) {
      const flutter = alive * 0.05 * wave(p, 2, j * 0.07 + side * 0.2);
      const ang = th + side * lerp(0.28, 1.15 - u * 0.35, open) + flutter;
      c.save();
      c.translate(x, y);
      c.rotate(ang);
      c.globalAlpha = lerp(0.95, 0.78, open) * fade;
      c.fill(polyPath(leaflet(size, side, 5 + Math.round(size / 30))));
      c.restore();
    }
  }
  c.globalAlpha = 1;
}

interface Hair { x: number; y: number; len: number; w: number; a: number }
interface Layout { F: Fit; coat: Vec2[]; hairs: Hair[]; label: ReturnType<typeof prepareStroke>[] }

const layout = perSize((w, h): Layout => {
  const F = fit(w, h, W, H), r = rng(505);
  // the emulsion went on in eight wide horizontal passes; each pass ends where the brush lifted
  const passes = 8, top = 64, bottom = 1256, band = (bottom - top) / passes;
  const ends = Array.from({ length: passes }, (_, j) => ({ y0: top + j * band, y1: top + (j + 1) * band, l: 58 + noise2(j * 0.9, 1, 505) * 60, r: 1022 + noise2(j * 0.9, 2, 505) * 60 }));
  const coat: Vec2[] = [];
  const wavy = (x0: number, x1: number, y: number, seed: number) => {
    for (let k = 0; k <= 40; k++) { const x = lerp(x0, x1, k / 40); coat.push([x, y + noise2(x / 90, seed, 506) * 16]); }
  };
  wavy(ends[0]!.l + 30, ends[0]!.r - 30, top, 1);
  for (const e of ends) coat.push([e.r, e.y0 + 10], [e.r + 10, (e.y0 + e.y1) / 2], [e.r, e.y1 - 10]);
  wavy(ends[passes - 1]!.r - 30, ends[passes - 1]!.l + 30, bottom, 2);
  for (const e of [...ends].reverse()) coat.push([e.l, e.y1 - 10], [e.l - 10, (e.y0 + e.y1) / 2], [e.l, e.y0 + 10]);
  // bristle drags past each end of each pass
  const hairs: Hair[] = [];
  for (const e of ends) {
    for (const [x, dir] of [[e.r, 1], [e.l, -1]] as const) {
      for (let k = 0; k < 8; k++) {
        const y = lerp(e.y0 + 12, e.y1 - 12, r()), len = 10 + Math.pow(r(), 2.5) * 80;
        hairs.push({ x: x - dir * 14, y, len: len * dir, w: 1.5 + Math.pow(r(), 2) * 7, a: 0.4 + r() * 0.6 });
      }
    }
  }
  const label = [squiggle(620, 900, 1300, 520, { height: 7, step: 10 }), squiggle(660, 820, 1326, 521, { height: 5, step: 8 })]
    .map((pts, k) => prepareStroke(pts, { color: '#6b6f78', size: 1.6, thinning: 0.3, wobble: 0.5, taperStart: 4, taperEnd: 6, alpha: 0.85 }, 5200 + k));
  return { F, coat, hairs, label };
});

export const fiddleheadScene: Scene = {
  name: 'fiddlehead',
  duration: (LOOP_FROM + LOOP) / 12,
  loopFrom: LOOP_FROM / 12,
  poster: (LOOP_FROM + 30) / 12,
  draw(f) {
    const { ctx, stage } = f;
    const L = layout(stage.w, stage.h), n = nf(f), { P, s } = L.F, [ox, oy] = P(0, 0);
    const p = f.loopPhase ?? 0, alive = f.loopPhase === null ? 0 : 1;
    ground(f, PAL.paper, { seed: 505, texture: 1.2 });

    // the coating: a brushed field of Prussian blue, mottled where it pooled and thinned
    still(f, 'g05-coat', g => {
      const c = g.ctx;
      c.translate(ox, oy);
      c.scale(s, s);
      const coat = polyPath(L.coat);
      c.fillStyle = COAT;
      c.fill(coat);
      c.strokeStyle = COAT;
      c.lineCap = 'round';
      for (const hr of L.hairs) {
        c.globalAlpha = hr.a;
        c.lineWidth = hr.w;
        c.beginPath();
        c.moveTo(hr.x, hr.y);
        c.lineTo(hr.x + hr.len, hr.y + hr.len * 0.03);
        c.stroke();
      }
      c.globalAlpha = 1;
      c.save();
      c.clip(coat);
      const r = rng(5050);
      for (let k = 0; k < 40; k++) {
        const x = r() * W, y = r() * H, rad = 80 + r() * 260, dark = r() < 0.6;
        const grad = c.createRadialGradient(x, y, 0, x, y, rad);
        grad.addColorStop(0, dark ? 'rgba(10,30,70,0.28)' : 'rgba(90,140,190,0.2)');
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = grad;
        c.fillRect(x - rad, y - rad, rad * 2, rad * 2);
      }
      // brush drag streaks
      c.strokeStyle = DEEP;
      c.lineWidth = 3;
      for (let k = 0; k < 90; k++) {
        const y = r() * H, x = r() * W, len = 100 + r() * 400;
        c.globalAlpha = 0.05 + r() * 0.08;
        c.beginPath();
        c.moveTo(x, y);
        c.bezierCurveTo(x + len * 0.3, y + 6, x + len * 0.7, y - 6, x + len, y + r() * 10);
        c.stroke();
      }
      c.restore();
      for (const st of L.label) drawStroke(c, st, 1);
    });

    // the photogram: the plants' shadow, softened where they lifted off the paper
    const e = ease(clamp((n - GROW[0]) / (GROW[1] - GROW[0]), 0, 1));
    const shadow = scratch(f, 'g05-shadow', (g: SceneFrame) => {
      const c = g.ctx;
      c.translate(ox, oy);
      c.scale(s, s);
      c.fillStyle = LIGHT;
      // grass stems at the edge of the print
      for (const [x, lean, len] of [[180, 0.18, 760], [230, 0.05, 560], [930, -0.22, 680]] as const) {
        const sway = alive * 0.02 * wave(p, 1, x / 1000);
        const tip: Vec2 = [x + Math.sin(lean + sway) * len, 1300 - Math.cos(lean + sway) * len];
        c.globalAlpha = 0.85;
        c.beginPath();
        c.moveTo(x - 4, 1300);
        c.quadraticCurveTo(x + (tip[0] - x) * 0.4, 1300 - len * 0.55, tip[0], tip[1]);
        c.quadraticCurveTo(x + (tip[0] - x) * 0.4 + 5, 1300 - len * 0.55, x + 5, 1300);
        c.fill();
        // seed head
        for (let k = 0; k < 9; k++) {
          const u = k / 9, bx = lerp(x + (tip[0] - x) * 0.8, tip[0], u), by = lerp(1300 - len * 0.8, tip[1], u);
          c.beginPath();
          c.ellipse(bx + (k % 2 ? 9 : -9), by, 5, 13, lean + (k % 2 ? 0.5 : -0.5), 0, TAU);
          c.fill();
        }
      }
      // an old frond pressed flat under the glass, thinner, so more light came through it
      drawFrond(c, FRONDS[2]!, 1, p, 0, 0.42);
      drawFrond(c, FRONDS[0]!, e, p, alive);
      drawFrond(c, FRONDS[1]!, 0.22 * e, p, alive);
    });
    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(s, s);
    ctx.clip(polyPath(L.coat));
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    // soft halo from a blurred half-size copy, crisp core on top: where the leaves lifted, light crept under
    const hw = Math.round(stage.outW / 2), hh = Math.round(stage.outH / 2), soft = stage.layer('g05-soft', hw, hh), sg = stage.context(soft);
    sg.setTransform(1, 0, 0, 1, 0, 0);
    sg.clearRect(0, 0, hw, hh);
    sg.filter = `blur(${(3 * stage.scale * s).toFixed(2)}px)`;
    sg.drawImage(shadow, 0, 0, hw, hh);
    sg.filter = 'none';
    ctx.globalAlpha = 0.9;
    ctx.drawImage(soft, 0, 0, stage.outW, stage.outH);
    ctx.globalAlpha = 0.55;
    ctx.drawImage(shadow, 0, 0);
    ctx.restore();

    // loop: a band of sun passes over the print, and dust turns in it
    if (alive) {
      // the band is wholly off the print at both ends of the loop
      const at = lerp(-0.2, 1.6, p);
      ctx.save();
      ctx.translate(ox, oy);
      ctx.scale(s, s);
      const x0 = at * (W + H) - H;
      const band = ctx.createLinearGradient(x0, 0, x0 + H * 0.6, H * 0.6);
      band.addColorStop(0, 'rgba(255,250,235,0)');
      band.addColorStop(0.5, 'rgba(255,250,235,0.1)');
      band.addColorStop(1, 'rgba(255,250,235,0)');
      ctx.fillStyle = band;
      ctx.fillRect(0, 0, W, H);
      const r = rng(5055);
      ctx.fillStyle = '#fffbee';
      for (let k = 0; k < 40; k++) {
        const bx = r() * W, by = r() * H, cyc = 1 + Math.floor(r() * 2), ph = r();
        const x = bx + 24 * wave(p, cyc, ph), y = by + 40 * wave(p, cyc, ph + 0.25);
        const inBand = clamp(1 - Math.abs((x + y * 0.6 - x0 - H * 0.3) / 260), 0, 1);
        ctx.globalAlpha = inBand * 0.7 * swell(p, cyc, ph);
        ctx.beginPath();
        ctx.arc(x, y, 1.5 + (k % 3), 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    }
  },
};
