/**
 * S10 "Art Deco" (the solar system from above; art deco). Gold line on black lacquer, symmetric and radiant. It opens
 * like a fan: the Sun's spikes and a ring of fine rays burst out, the double-ruled orbits sweep on from the inside out,
 * the stepped frame and its corner fans draw in, and the planets take their places. Then it runs, under a sheen of
 * light that crosses all the gold once a loop.
 *
 * Behind the gold, peacock-teal wedges radiate from the Sun to the frame. Each planet is a gold ring engraved with
 * fine horizontal lines on its sunward half, bare lacquer on the other; gold diamonds mark the quarters of the outer
 * orbits; stars are four-point sparkles that flash in turn.
 */
import { alpha } from '../../art/color';
import { clamp, TAU, type Vec2 } from '../../core/math';
import { rng } from '../../core/random';
import type { Scene, SceneFrame } from '../../core/scene';
import { composite, ground, knockOut, polyPath, scratch, still, toothMask } from '../gallery/common';
import { BOX, C, cyclePhase, dayHalf, disc, drawnFrame, enter, frameFit, LOOP, MOON, moonOffset, once, PLANETS, planetAt, POSTER_M, RINGS, ROCKS, rockAt, SUN_R, sunward, URANUS_RING, type Frame, type Planet } from './common';
import { skyOf, type Sky } from './sky';
import { orbitTrail } from './trails';
import { SOLAR } from './palettes';

const PAL = SOLAR.deco;
const LACQUER = PAL.paper, GOLD = PAL.ink, PALE_GOLD = PAL.accents[1]!;
const [TEAL, DEEP_TEAL] = PAL.fills as [string, string, string];

/** Storyboard in drawn frames. */
const F = { burst: [0, 16], orbits: 6, every: 3, sweep: 8, frame: [18, 36], start: 40 } as const;
const LOOP_FROM = F.start;
const WEDGES = 32;
const INSET = 22;

const at = (x: number, y: number, pts: readonly Vec2[]): Vec2[] => pts.map(([u, v]): Vec2 => [x + u, y + v]);

interface Sparkle { x: number; y: number; s: number; cycles: number; off: number }
const SPARKLES = once((): Sparkle[] => {
  const r = rng(2001), out: Sparkle[] = [];
  while (out.length < 34) {
    const x = INSET + 30 + r() * (BOX - 2 * INSET - 60), y = INSET + 30 + r() * (BOX - 2 * INSET - 60), d = Math.hypot(x - C[0], y - C[1]);
    if (d < PLANETS[7]!.a + 30 || Math.min(x, y, BOX - x, BOX - y) < 110 && Math.min(Math.hypot(x, y), Math.hypot(BOX - x, y), Math.hypot(x, BOX - y), Math.hypot(BOX - x, BOX - y)) < 150) continue;
    out.push({ x, y, s: 3 + r() * 6, cycles: 2 + Math.floor(r() * 5), off: r() });
  }
  return out;
});

/** The stepped frame: an outer rule, and an inner rule with three steps cut into each corner. */
function steppedFrame(): Vec2[] {
  const a = INSET + 10, b = BOX - a, s = 14, pts: Vec2[] = [];
  const corner = (cx: number, cy: number, dx: number, dy: number): Vec2[] => [
    [cx, cy + dy * 3 * s], [cx + dx * s, cy + dy * 3 * s], [cx + dx * s, cy + dy * 2 * s], [cx + dx * 2 * s, cy + dy * 2 * s], [cx + dx * 2 * s, cy + dy * s], [cx + dx * 3 * s, cy + dy * s], [cx + dx * 3 * s, cy],
  ];
  pts.push(...corner(a, a, 1, 1));
  pts.push(...corner(b, a, -1, 1).reverse());
  pts.push(...corner(b, b, -1, -1));
  pts.push(...corner(a, b, 1, -1).reverse());
  pts.push(pts[0]!);
  return pts;
}

/** A polyline's prefix of fraction `t` of its length. */
function prefix(pts: readonly Vec2[], t: number): Vec2[] {
  if (t >= 1) return [...pts];
  let total = 0;
  for (let k = 1; k < pts.length; k++) total += Math.hypot(pts[k]![0] - pts[k - 1]![0], pts[k]![1] - pts[k - 1]![1]);
  let left = total * t;
  const out: Vec2[] = [pts[0]!];
  for (let k = 1; k < pts.length && left > 0; k++) {
    const [x0, y0] = pts[k - 1]!, [x1, y1] = pts[k]!, d = Math.hypot(x1 - x0, y1 - y0);
    if (d <= left) { out.push(pts[k]!); left -= d; } else { out.push([x0 + ((x1 - x0) * left) / d, y0 + ((y1 - y0) * left) / d]); left = 0; }
  }
  return out;
}

function background(g: SceneFrame, fr: Frame): void {
  const c = g.ctx;
  enter(c, fr);
  // teal wedges radiating from the Sun to the frame, alternate ones only
  for (let k = 0; k < WEDGES; k += 2) {
    const a0 = (k / WEDGES) * TAU, a1 = ((k + 1) / WEDGES) * TAU;
    const grad = c.createRadialGradient(C[0], C[1], SUN_R, C[0], C[1], 780);
    grad.addColorStop(0, alpha(TEAL, 0.5));
    grad.addColorStop(0.5, alpha(DEEP_TEAL, 0.4));
    grad.addColorStop(1, alpha(DEEP_TEAL, 0.16));
    c.fillStyle = grad;
    c.beginPath();
    c.moveTo(C[0], C[1]);
    c.arc(C[0], C[1], 800, a0, a1);
    c.closePath();
    c.fill();
  }
  // a quiet lacquer band just inside the frame
  c.fillStyle = 'rgba(15,14,16,0.9)';
  c.beginPath();
  c.rect(0, 0, BOX, BOX);
  c.rect(INSET + 10, INSET + 10, BOX - 2 * (INSET + 10), BOX - 2 * (INSET + 10));
  c.fill('evenodd');
}

function drawPlanet(c: CanvasRenderingContext2D, p: Planet, sky: Sky): void {
  const [x, y] = planetAt(p, sky), toSun = sunward([x, y]), r = p.r;
  if (p.name === 'saturn') {
    c.lineWidth = 1;
    c.beginPath();
    for (const rr of [RINGS.inner, RINGS.inner + 3, RINGS.outer - 5, RINGS.outer]) {
      c.moveTo(x + Math.cos(RINGS.angle) * rr, y + Math.sin(RINGS.angle) * rr);
      c.ellipse(x, y, rr, rr * RINGS.squash, RINGS.angle, 0, TAU);
    }
    c.stroke();
  }
  if (p.name === 'uranus') {
    c.lineWidth = 1;
    c.beginPath();
    c.ellipse(x, y, URANUS_RING.rx, URANUS_RING.ry, URANUS_RING.angle, 0, TAU);
    c.stroke();
  }
  // clear the lacquer under the disc so orbit rules stop at the rim
  c.save();
  c.globalCompositeOperation = 'destination-out';
  c.fill(disc(x, y, r + 2.5));
  c.restore();
  c.save();
  c.clip(polyPath(at(x, y, dayHalf(r, toSun))));
  c.lineWidth = p.name === 'jupiter' ? 1.3 : 1;
  c.beginPath();
  const gap = r > 20 ? 2.6 : 2.2;
  for (let yy = -r; yy <= r; yy += gap) {
    if (p.name === 'jupiter' && Math.abs(Math.sin(yy * 0.34)) < 0.35) continue;
    c.moveTo(x - r, y + yy);
    c.lineTo(x + r, y + yy);
  }
  c.stroke();
  c.restore();
  c.lineWidth = r > 20 ? 2 : 1.6;
  c.beginPath();
  c.arc(x, y, r, 0, TAU);
  c.stroke();
  if (p.name === 'earth') {
    const [mx, my] = moonOffset(sky);
    c.fill(disc(x + mx, y + my, MOON.r));
  }
}

export const decoScene: Scene = {
  name: 'solar-deco',
  duration: (LOOP_FROM + LOOP) / 12,
  loopFrom: LOOP_FROM / 12,
  poster: (LOOP_FROM + POSTER_M) / 12,
  draw(f) {
    const { stage } = f;
    const fr = frameFit(stage.w, stage.h), sky = skyOf(f, LOOP_FROM), n = drawnFrame(f);
    ground(f, LACQUER, { seed: 2000, texture: 0.7, vignette: 0.5 });
    const burst = clamp((n - F.burst[0]) / (F.burst[1] - F.burst[0]), 0, 1), ease = 1 - (1 - burst) ** 3;
    still(f, 's10-wedges', g => background(g, fr), { alpha: ease });

    const gold = scratch(f, 's10-gold', g => {
      const c = g.ctx;
      enter(c, fr);
      c.strokeStyle = GOLD;
      c.fillStyle = GOLD;
      c.lineCap = 'butt';
      // the Sun: a disc engraved in rings, sixteen long spikes and sixteen short, and a ring of fine rays
      if (burst > 0) {
        c.save();
        c.translate(C[0], C[1]);
        c.scale(ease, ease);
        c.beginPath();
        for (let k = 0; k < 32; k++) {
          const a = (k / 32) * TAU, len = k % 2 ? 18 : 38, w = k % 2 ? 0.07 : 0.09;
          c.moveTo(Math.cos(a - w) * (SUN_R + 3), Math.sin(a - w) * (SUN_R + 3));
          c.lineTo(Math.cos(a) * (SUN_R + len), Math.sin(a) * (SUN_R + len));
          c.lineTo(Math.cos(a + w) * (SUN_R + 3), Math.sin(a + w) * (SUN_R + 3));
        }
        c.fill();
        c.fill(disc(0, 0, SUN_R));
        c.restore();
        c.save();
        c.globalCompositeOperation = 'destination-out';
        c.lineWidth = 1.4;
        c.beginPath();
        for (let rr = 8; rr < SUN_R * ease - 3; rr += 6) { c.moveTo(C[0] + rr, C[1]); c.arc(C[0], C[1], rr, 0, TAU); }
        c.stroke();
        c.restore();
        c.lineWidth = 0.9;
        c.beginPath();
        for (let k = 0; k < 96; k++) {
          const a = ((k + 0.5) / 96) * TAU, r0 = SUN_R + 46, r1 = r0 + (k % 3 === 0 ? 30 : 16) * ease;
          c.moveTo(C[0] + Math.cos(a) * r0, C[1] + Math.sin(a) * r0);
          c.lineTo(C[0] + Math.cos(a) * r1, C[1] + Math.sin(a) * r1);
        }
        c.stroke();
      }
      // the orbits: double rules swept on from the inside out, diamonds at the quarters of the outer ones
      PLANETS.forEach((p, k) => {
        const prog = clamp((n - F.orbits - k * F.every) / F.sweep, 0, 1);
        if (prog <= 0) return;
        const a0 = -Math.PI / 2;
        c.lineWidth = 1;
        c.beginPath();
        for (const dr of [-2, 2]) {
          c.moveTo(C[0] + Math.cos(a0) * (p.a + dr), C[1] + Math.sin(a0) * (p.a + dr));
          c.arc(C[0], C[1], p.a + dr, a0, a0 + prog * TAU);
        }
        c.stroke();
        if (prog >= 1 && k >= 4) {
          for (let q = 0; q < 4; q++) {
            const a = (q / 4) * TAU + (k % 2 ? Math.PI / 4 : 0), x = C[0] + Math.cos(a) * p.a, y = C[1] + Math.sin(a) * p.a, s = 6;
            c.fill(polyPath([[x + Math.cos(a) * s, y + Math.sin(a) * s], [x - Math.sin(a) * s * 0.6, y + Math.cos(a) * s * 0.6], [x - Math.cos(a) * s, y - Math.sin(a) * s], [x + Math.sin(a) * s * 0.6, y - Math.cos(a) * s * 0.6]]));
          }
        }
      });
      // the frame and its corner fans
      const fp = clamp((n - F.frame[0]) / (F.frame[1] - F.frame[0]), 0, 1);
      if (fp > 0) {
        c.lineWidth = 2;
        const outer: Vec2[] = [[INSET, INSET], [BOX - INSET, INSET], [BOX - INSET, BOX - INSET], [INSET, BOX - INSET], [INSET, INSET]];
        for (const [pts, w] of [[outer, 2], [steppedFrame(), 1.1]] as const) {
          c.lineWidth = w;
          c.beginPath();
          prefix(pts, fp).forEach(([x, y], k) => (k ? c.lineTo(x, y) : c.moveTo(x, y)));
          c.stroke();
        }
        c.lineWidth = 1;
        c.beginPath();
        const a = INSET + 10;
        for (const [cx, cy, a0] of [[a, a, 0], [BOX - a, a, Math.PI / 2], [BOX - a, BOX - a, Math.PI], [a, BOX - a, -Math.PI / 2]] as const) {
          for (const rr of [70, 96]) {
            const rp = rr * fp;
            c.moveTo(cx + Math.cos(a0) * rp, cy + Math.sin(a0) * rp);
            c.arc(cx, cy, rp, a0, a0 + Math.PI / 2);
          }
          for (let j = 1; j < 8; j++) {
            const b = a0 + (j / 8) * (Math.PI / 2);
            c.moveTo(cx + Math.cos(b) * 50, cy + Math.sin(b) * 50);
            c.lineTo(cx + Math.cos(b) * (50 + 46 * fp), cy + Math.sin(b) * (50 + 46 * fp));
          }
        }
        c.stroke();
      }
      // the belt, fine gold dust
      if (n >= F.orbits + 4 * F.every) {
        c.beginPath();
        for (const rk of ROCKS) {
          const [x, y] = rockAt(rk, sky), s = 0.5 + rk.size * 0.5;
          c.moveTo(x + s, y);
          c.arc(x, y, s, 0, TAU);
        }
        c.fill();
      }
      // a viewer's trails: a gold rule back along each orbit
      if (n >= F.orbits + 8 * F.every + F.sweep) for (const p of PLANETS) orbitTrail(c, p, sky, { color: GOLD, width: 2.2, tail: 0.3 });
      PLANETS.forEach((p, k) => {
        const on = clamp((n - F.orbits - k * F.every - F.sweep) / 3, 0, 1);
        if (on <= 0) return;
        c.save();
        c.globalAlpha = on;
        drawPlanet(c, p, sky);
        c.restore();
      });
      // sparkles: four-point stars flashing in turn
      for (const s of SPARKLES()) {
        const flash = Math.max(0, Math.sin(TAU * (cyclePhase(s.cycles, sky.beat) + s.off))) ** 3 * ease;
        if (flash < 0.02) continue;
        const L = s.s * (0.4 + 0.6 * flash);
        c.globalAlpha = flash;
        c.fill(polyPath([[s.x, s.y - L], [s.x + L * 0.18, s.y - L * 0.18], [s.x + L, s.y], [s.x + L * 0.18, s.y + L * 0.18], [s.x, s.y + L], [s.x - L * 0.18, s.y + L * 0.18], [s.x - L, s.y], [s.x - L * 0.18, s.y - L * 0.18]]));
      }
      c.globalAlpha = 1;
      // the sheen: a band of pale light crossing the gold once a loop, laid only where there is gold
      const u = cyclePhase(1, sky.beat) * 1.6 - 0.3, sx = u * BOX * 2;
      const sheen = c.createLinearGradient(sx - 160, 0, sx + 160, 0);
      sheen.addColorStop(0, 'rgba(243,226,174,0)');
      sheen.addColorStop(0.5, 'rgba(255,246,214,0.85)');
      sheen.addColorStop(1, 'rgba(243,226,174,0)');
      c.globalCompositeOperation = 'source-atop';
      c.save();
      c.translate(C[0], C[1]);
      c.rotate(-Math.PI / 4);
      c.translate(-BOX, -C[1]);
      c.fillStyle = sheen;
      c.fillRect(0, -BOX, BOX * 2, BOX * 3);
      c.restore();
      c.globalCompositeOperation = 'source-over';
      c.setTransform(1, 0, 0, 1, 0, 0);
      knockOut(g, c, toothMask(g, { seed: 2002, density: 30, size: 1, color: PALE_GOLD }), 0.18);
    });
    // bare lacquer under each planet, so the teal wedges stop at its rim
    f.ctx.save();
    enter(f.ctx, fr);
    f.ctx.fillStyle = LACQUER;
    PLANETS.forEach((p, k) => {
      const on = clamp((n - F.orbits - k * F.every - F.sweep) / 3, 0, 1);
      if (on <= 0) return;
      const [x, y] = planetAt(p, sky);
      f.ctx.globalAlpha = on;
      f.ctx.fill(disc(x, y, p.r));
    });
    f.ctx.restore();
    composite(f, gold);
  },
};
