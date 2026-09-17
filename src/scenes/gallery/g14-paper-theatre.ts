/**
 * G14 "Paper Theatre" (dreams; cut paper). A toy theatre of layered card, whole from the start, playing a night at sea
 * that everyone agrees to believe: four wave flats rock on their sticks in counter-time, a paper boat rides between
 * them, a gold moon swings on its thread, stars on threads twirl to show their gilded backs, clouds slide along a wire,
 * and the footlights breathe under the crimson curtains.
 *
 * Every piece is a flat card with a flat shadow a little behind it; nothing is drawn with a line except threads and
 * wire, as in a real paper stage. All motions are whole cycles per loop.
 */
import { catmullRom } from '../../core/geometry';
import { lerp, TAU, type Vec2 } from '../../core/math';
import { rng } from '../../core/random';
import type { Scene } from '../../core/scene';
import { fit, ground, perSize, phase, polyPath, still, swell, wave, type Fit } from './common';
import { GALLERY } from './palettes';

const PAL = GALLERY.theatre;
const BACKDROP = PAL.paper, CRIMSON = PAL.fills[3]!, GOLD = PAL.fills[4]!, CREAM = PAL.fills[5]!;
const SEAS = ['#7fb3b3', '#4f9699', '#2f7f86', '#1f5f6e'];
const W = 1440, H = 1080, LOOP = 144;
const SHADOW = 'rgba(8,10,24,0.38)';

function cardShadow(c: CanvasRenderingContext2D, path: Path2D, color: string, lift = 1): void {
  c.save();
  c.translate(7 * lift, 9 * lift);
  c.fillStyle = SHADOW;
  c.fill(path);
  c.restore();
  c.fillStyle = color;
  c.fill(path);
}

/** A wave flat: a strip whose top edge is a row of curling crests, `period` wide, from x0 to x1, standing on `base`. */
function waveFlat(x0: number, x1: number, top: number, base: number, period: number, amp: number): Vec2[] {
  const pts: Vec2[] = [[x0, base]];
  for (let x = x0; x <= x1; x += period) {
    const crest = catmullRom([[x, top], [x + period * 0.35, top - amp * 0.55], [x + period * 0.62, top - amp], [x + period * 0.78, top - amp * 0.7], [x + period * 0.72, top - amp * 0.35], [x + period, top]], 5);
    pts.push(...crest);
  }
  pts.push([x1 + period, base]);
  return pts;
}

function star(r: number): Vec2[] {
  return Array.from({ length: 10 }, (_, k): Vec2 => {
    const a = -Math.PI / 2 + (k / 10) * TAU, rr = k % 2 ? r * 0.44 : r;
    return [Math.cos(a) * rr, Math.sin(a) * rr];
  });
}

/** A crescent: the disc (c, R) with the disc (b, r) cut out of it, as one outline. */
function crescent(c: Vec2, R: number, b: Vec2, r: number): Vec2[] {
  const inside = (q: Vec2, o: Vec2, rad: number) => Math.hypot(q[0] - o[0], q[1] - o[1]) < rad;
  const outer: Vec2[] = [], inner: Vec2[] = [];
  const dir = Math.atan2(b[1] - c[1], b[0] - c[0]);
  // walk the outer rim starting opposite the cut, keep what the cut does not reach
  for (let k = 0; k <= 180; k++) {
    const a = dir + Math.PI + ((k / 180) - 0.5) * TAU, q: Vec2 = [c[0] + Math.cos(a) * R, c[1] + Math.sin(a) * R];
    if (!inside(q, b, r)) outer.push(q);
  }
  // then back along the cut's rim inside the disc, from the outer walk's end to its start
  const back = Math.atan2(c[1] - b[1], c[0] - b[0]);
  for (let k = 0; k <= 180; k++) {
    const a = back - ((k / 180) - 0.5) * TAU, q: Vec2 = [b[0] + Math.cos(a) * r, b[1] + Math.sin(a) * r];
    if (inside(q, c, R)) inner.push(q);
  }
  return [...outer, ...inner];
}

const MOON = crescent([0, 280], 92, [44, 250], 80);

const CLOUD = (w: number): Vec2[] => {
  const pts: Vec2[] = [];
  for (let k = 0; k <= 60; k++) {
    const u = k / 60, x = lerp(-w / 2, w / 2, u);
    pts.push([x, -Math.abs(Math.sin(u * Math.PI * 3)) * w * 0.12 - Math.sin(u * Math.PI) * w * 0.14]);
  }
  pts.push([w / 2, 8], [-w / 2, 8]);
  return pts;
};

interface Layout { F: Fit; stars: { x: number; len: number; r: number; k: number; o: number }[] }
const layout = perSize((w, h): Layout => {
  const r = rng(1400);
  const stars = [230, 380, 540, 700, 860, 1180, 1290].map((x, i) => ({ x, len: 150 + r() * 260, r: 20 + r() * 16, k: 1 + (i % 3), o: r() }));
  return { F: fit(w, h, W, H), stars };
});

export const paperTheatreScene: Scene = {
  name: 'paper-theatre',
  duration: LOOP / 12,
  loopFrom: 0,
  poster: 30 / 12,
  draw(f) {
    const { ctx, stage } = f;
    const L = layout(stage.w, stage.h), p = phase(f), { P, s } = L.F, [ox, oy] = P(0, 0);
    ground(f, BACKDROP, { seed: 1400, texture: 0.9, vignette: 0.35 });
    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(s, s);
    // painted backdrop glow over the horizon
    still(f, 'g14-backdrop', g => {
      const c = g.ctx;
      c.translate(ox, oy);
      c.scale(s, s);
      const glow = c.createRadialGradient(720, 780, 40, 720, 780, 700);
      glow.addColorStop(0, 'rgba(232,195,90,0.28)');
      glow.addColorStop(1, 'rgba(232,195,90,0)');
      c.fillStyle = glow;
      c.fillRect(0, 0, W, H);
      const r = rng(1401);
      c.fillStyle = CREAM;
      for (let k = 0; k < 90; k++) {
        c.globalAlpha = 0.25 + r() * 0.5;
        c.beginPath();
        c.arc(160 + r() * 1120, 130 + r() * 560, 1 + r() * 2, 0, TAU);
        c.fill();
      }
    });

    // threads, the wire and what hangs from them
    ctx.strokeStyle = 'rgba(241,230,207,0.55)';
    ctx.lineWidth = 1.4;
    for (const st of L.stars) {
      ctx.beginPath();
      ctx.moveTo(st.x, 120);
      ctx.lineTo(st.x, 120 + st.len);
      ctx.stroke();
    }
    for (const st of L.stars) {
      const turn = Math.cos(TAU * (p * st.k + st.o));
      ctx.save();
      ctx.translate(st.x, 120 + st.len + st.r);
      ctx.scale(Math.max(0.06, Math.abs(turn)), 1);
      cardShadow(ctx, polyPath(star(st.r)), turn >= 0 ? GOLD : CREAM, 0.5);
      ctx.restore();
    }
    const swing = 0.09 * wave(p, 2);
    ctx.save();
    ctx.translate(1040, 110);
    ctx.rotate(swing);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, 190);
    ctx.stroke();
    cardShadow(ctx, polyPath(MOON), GOLD, 1.2);
    ctx.restore();
    ctx.beginPath();
    ctx.moveTo(100, 300);
    ctx.lineTo(1340, 290);
    ctx.stroke();
    for (const [x0, wdt, k] of [[430, 230, 0], [930, 170, 1]] as const) {
      const x = x0 + 110 * wave(p, 1, k * 0.5);
      ctx.beginPath();
      ctx.moveTo(x, 298);
      ctx.lineTo(x, 330);
      ctx.stroke();
      ctx.save();
      ctx.translate(x, 380);
      cardShadow(ctx, polyPath(CLOUD(wdt)), CREAM, 0.8);
      ctx.restore();
    }

    // the sea: four flats rocking on their sticks, the boat riding between the second and third
    const flats = [
      { top: 700, amp: 60, period: 180, color: SEAS[0]! },
      { top: 760, amp: 70, period: 210, color: SEAS[1]! },
      { top: 830, amp: 80, period: 240, color: SEAS[2]! },
      { top: 900, amp: 90, period: 280, color: SEAS[3]! },
    ];
    flats.forEach((fl, k) => {
      const rock = wave(p, 2, k * 0.5), dx = 60 * rock, lift = 10 * wave(p, 4, k * 0.25);
      ctx.save();
      ctx.translate(dx, lift);
      ctx.rotate(0.012 * rock);
      cardShadow(ctx, polyPath(waveFlat(-340 - k * 60, W + 200, fl.top, H + 40, fl.period, fl.amp)), fl.color, 0.9);
      ctx.restore();
      if (k === 1) {
        const bob = 18 * wave(p, 2, 0.3), roll = 0.12 * wave(p, 2, 0.05);
        ctx.save();
        ctx.translate(720 + 30 * wave(p, 1), 790 + bob);
        ctx.rotate(roll);
        const hull = polyPath([[-120, -10], [120, -10], [80, 40], [-80, 40]]);
        const sail = polyPath([[-10, -10], [-10, -140], [80, -10]]);
        const sail2 = polyPath([[-24, -10], [-24, -110], [-90, -10]]);
        cardShadow(ctx, sail2, '#e6d8bb');
        cardShadow(ctx, sail, CREAM);
        cardShadow(ctx, hull, CREAM);
        ctx.strokeStyle = 'rgba(26,26,36,0.25)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-80, 40); ctx.lineTo(-40, -10); ctx.moveTo(80, 40); ctx.lineTo(40, -10);
        ctx.stroke();
        ctx.restore();
      }
    });

    // the stage floor, footlights and the proscenium
    still(f, 'g14-proscenium', g => {
      const c = g.ctx;
      c.translate(ox, oy);
      c.scale(s, s);
      const floor = polyPath([[-20, 985], [W + 20, 985], [W + 20, H + 20], [-20, H + 20]]);
      cardShadow(c, floor, '#7a4f33', 1.2);
      c.strokeStyle = 'rgba(40,20,10,0.35)';
      c.lineWidth = 2;
      for (let x = 60; x < W; x += 120) { c.beginPath(); c.moveTo(x, 988); c.lineTo(x - 30, H); c.stroke(); }
      for (const side of [0, 1]) {
        const sx = side ? W : 0, dir = side ? -1 : 1;
        const curtain = polyPath([[sx, 0], [sx + dir * 250, 0], ...catmullRom([[sx + dir * 250, 0], [sx + dir * 170, 420], [sx + dir * 210, 760], [sx + dir * 120, 1000]], 10).slice(1), [sx, 1000]]);
        cardShadow(c, curtain, CRIMSON, 1.6);
        c.save();
        c.clip(curtain);
        c.fillStyle = '#8e2530';
        for (let k = 1; k < 5; k++) {
          const fx = sx + dir * k * 52;
          c.fill(polyPath(catmullRom([[fx - 8, 0], [fx + dir * 10, 500], [fx - dir * 14, 1000], [fx + 12, 1000], [fx + dir * 24, 500], [fx + 8, 0]], 6)));
        }
        c.restore();
        // tie-back cord and tassel
        c.fillStyle = GOLD;
        c.beginPath();
        c.ellipse(sx + dir * 200, 690, 20, 14, 0, 0, TAU);
        c.fill();
        c.fill(polyPath([[sx + dir * 190, 700], [sx + dir * 210, 700], [sx + dir * 222, 780], [sx + dir * 178, 780]]));
      }
      const valance: Vec2[] = [[-20, -20], [W + 20, -20], [W + 20, 120]];
      for (let x = W; x >= 0; x -= 90) valance.push(...catmullRom([[x, 120], [x - 45, 158], [x - 90, 120]], 6));
      valance.push([-20, 120]);
      cardShadow(c, polyPath(valance), CRIMSON, 1.8);
      c.strokeStyle = GOLD;
      c.lineWidth = 6;
      c.beginPath();
      for (let x = W; x >= 0; x -= 90) { c.moveTo(x, 104); c.quadraticCurveTo(x - 45, 142, x - 90, 104); }
      c.stroke();
      c.fillStyle = GOLD;
      for (let x = 45; x < W; x += 90) { c.beginPath(); c.arc(x, 160, 7, 0, TAU); c.fill(); c.fillRect(x - 3, 160, 6, 22); }
    });

    // footlights
    for (let k = 0; k < 9; k++) {
      const x = 180 + k * 135, heat = 0.75 + 0.25 * swell(p, 3, k * 0.13);
      const glow = ctx.createRadialGradient(x, 985, 0, x, 985, 190);
      glow.addColorStop(0, `rgba(255,220,140,${0.34 * heat})`);
      glow.addColorStop(1, 'rgba(255,220,140,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(x - 190, 795, 380, 190);
      ctx.fillStyle = GOLD;
      ctx.beginPath();
      ctx.arc(x, 990, 13, Math.PI, TAU);
      ctx.fill();
    }
    ctx.restore();
  },
};
