/**
 * SP10 "Art Deco" (the moving solar system at an angle; art deco). Gold line on black lacquer, radiant and ruled,
 * whole from the start, inside a stepped frame with fans in its corners. Peacock-teal wedges radiate from the Sun.
 *
 * Each wake is a gold pinstripe of three parallel rules where the coil swings in front of the Sun's line, the outer two
 * closing in on the middle one as the helix runs back until one rule is left, and a single fine pale-gold rule where
 * it passes behind. The Sun's path is a double rule set with a gold diamond for every year of Mercury's. The Sun is a
 * gold disc engraved in rings inside a burst of spikes; each planet is a gold ring engraved with fine horizontal lines
 * on the part the Sun reaches, bare lacquer on the rest. Four-point sparkles flash in turn, and a sheen of light
 * crosses all the gold once a loop.
 */
import { alpha } from '../../art/color';
import { TAU, type Vec2 } from '../../core/math';
import { rng } from '../../core/random';
import type { Scene, SceneFrame } from '../../core/scene';
import { cached, composite, ground, knockOut, polyPath, scratch, still, toothMask } from '../gallery/common';
import { SOLAR } from '../solar/palettes';
import { bodyRing, BOX, cyclePhase, disc, dust, E1, E2, enter, frameFit, INTRO, inWake, litShape, LOOP, MOTION, once, paint, POSTER_M, project, RINGS, snapshot, spiralSky, strokeRun, SUN_R, SUN_W, tangent, trace, URANUS_RING, type Body, type Frame, type Sample, type Snapshot } from './common';

const PAL = SOLAR.deco;
const LACQUER = PAL.paper, GOLD = PAL.ink, PALE_GOLD = PAL.accents[1]!;
const [TEAL, DEEP_TEAL] = PAL.fills as [string, string, string];
const WEDGES = 32;
const INSET = 22;
/** Half the spread of each pinstripe at the planet, at the Sun's depth. */
const SPREAD = [2.6, 3.2, 3.4, 3, 5.2, 4.6, 3.8, 3.8];

interface Sparkle { x: number; y: number; s: number; cycles: number; off: number }

const SPARKLES = once((): Sparkle[] => {
  const r = rng(3001), out: Sparkle[] = [], S = project([0, 0, 0]);
  while (out.length < 34) {
    const x = INSET + 40 + r() * (BOX - 2 * INSET - 80), y = INSET + 40 + r() * (BOX - 2 * INSET - 80);
    if (Math.hypot(x - S.x, y - S.y) < 330) continue;
    if (Math.min(Math.hypot(x, y), Math.hypot(BOX - x, y), Math.hypot(x, BOX - y), Math.hypot(BOX - x, BOX - y)) < 160) continue;
    out.push({ x, y, s: 3 + r() * 6, cycles: 2 + Math.floor(r() * 5), off: r() });
  }
  return out;
});

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

/** Teal wedges radiating from the Sun, and the lacquer band inside the frame. */
function background(g: SceneFrame, fr: Frame): void {
  const c = g.ctx, S = project([0, 0, 0]);
  enter(c, fr);
  for (let k = 0; k < WEDGES; k += 2) {
    const a0 = (k / WEDGES) * TAU, a1 = ((k + 1) / WEDGES) * TAU;
    const grad = c.createRadialGradient(S.x, S.y, SUN_R, S.x, S.y, 1000);
    grad.addColorStop(0, alpha(TEAL, 0.5));
    grad.addColorStop(0.45, alpha(DEEP_TEAL, 0.4));
    grad.addColorStop(1, alpha(DEEP_TEAL, 0.16));
    c.fillStyle = grad;
    c.beginPath();
    c.moveTo(S.x, S.y);
    c.arc(S.x, S.y, 1100, a0, a1);
    c.closePath();
    c.fill();
  }
  c.fillStyle = 'rgba(15,14,16,0.9)';
  c.beginPath();
  c.rect(0, 0, BOX, BOX);
  c.rect(INSET + 10, INSET + 10, BOX - 2 * (INSET + 10), BOX - 2 * (INSET + 10));
  c.fill('evenodd');
}

/** The fixed gold: the Sun's burst and engraved disc, the frame and its corner fans. */
function fixedGold(g: SceneFrame, fr: Frame): void {
  const c = g.ctx;
  enter(c, fr);
  c.strokeStyle = GOLD;
  c.fillStyle = GOLD;
  c.lineWidth = 2;
  c.strokeRect(INSET, INSET, BOX - 2 * INSET, BOX - 2 * INSET);
  c.lineWidth = 1.1;
  c.beginPath();
  steppedFrame().forEach(([x, y], k) => (k ? c.lineTo(x, y) : c.moveTo(x, y)));
  c.stroke();
  c.lineWidth = 1;
  c.beginPath();
  const a = INSET + 10;
  for (const [cx, cy, a0] of [[a, a, 0], [BOX - a, a, Math.PI / 2], [BOX - a, BOX - a, Math.PI], [a, BOX - a, -Math.PI / 2]] as const) {
    for (const rr of [70, 96]) { c.moveTo(cx + Math.cos(a0) * rr, cy + Math.sin(a0) * rr); c.arc(cx, cy, rr, a0, a0 + Math.PI / 2); }
    for (let j = 1; j < 8; j++) {
      const b = a0 + (j / 8) * (Math.PI / 2);
      c.moveTo(cx + Math.cos(b) * 50, cy + Math.sin(b) * 50);
      c.lineTo(cx + Math.cos(b) * 96, cy + Math.sin(b) * 96);
    }
  }
  c.stroke();
}

/** The Sun: spikes, a disc engraved in rings, a ring of fine rays. */
function sunGold(c: CanvasRenderingContext2D, X: number, Y: number): void {
  c.save();
  c.fillStyle = GOLD;
  c.strokeStyle = GOLD;
  c.beginPath();
  for (let k = 0; k < 32; k++) {
    const a = (k / 32) * TAU, len = k % 2 ? 12 : 26, w = k % 2 ? 0.07 : 0.09;
    c.moveTo(X + Math.cos(a - w) * (SUN_R + 2), Y + Math.sin(a - w) * (SUN_R + 2));
    c.lineTo(X + Math.cos(a) * (SUN_R + len), Y + Math.sin(a) * (SUN_R + len));
    c.lineTo(X + Math.cos(a + w) * (SUN_R + 2), Y + Math.sin(a + w) * (SUN_R + 2));
  }
  c.fill();
  c.fill(disc(X, Y, SUN_R));
  c.globalCompositeOperation = 'destination-out';
  c.lineWidth = 1.3;
  c.beginPath();
  for (let rr = 6; rr < SUN_R - 3; rr += 5) { c.moveTo(X + rr, Y); c.arc(X, Y, rr, 0, TAU); }
  c.stroke();
  c.globalCompositeOperation = 'source-over';
  c.lineWidth = 0.8;
  c.beginPath();
  for (let k = 0; k < 72; k++) {
    const a = ((k + 0.5) / 72) * TAU, r0 = SUN_R + 32, r1 = r0 + (k % 3 === 0 ? 20 : 10);
    c.moveTo(X + Math.cos(a) * r0, Y + Math.sin(a) * r0);
    c.lineTo(X + Math.cos(a) * r1, Y + Math.sin(a) * r1);
  }
  c.stroke();
  c.restore();
}

/** A pinstripe: three rules closing on the middle one as the wake runs back; one pale rule behind the Sun's line. */
function pinstripe(c: CanvasRenderingContext2D, run: readonly Sample[], spread: number, near: boolean): void {
  if (run.length < 2) return;
  const life = (s: Sample): number => Math.pow(Math.max(0, 1 - s.age), 0.9);
  if (!near) {
    c.strokeStyle = PALE_GOLD;
    strokeRun(c, run, 4, s => ({ width: 1.1 * s.s, alpha: 0.7 * life(s) }));
    return;
  }
  c.strokeStyle = GOLD;
  strokeRun(c, run, 4, s => ({ width: 2.1 * s.s, alpha: life(s) }));
  for (const side of [-1, 1]) {
    const line = run.map((s, i): Sample => {
      const [tx, ty] = tangent(run, i), h = side * spread * s.s * Math.max(0, 1 - s.age * 1.6);
      return { ...s, x: s.x - ty * h, y: s.y + tx * h };
    });
    strokeRun(c, line, 4, s => (s.age < 0.6 ? { width: 1.1 * s.s, alpha: life(s) } : null));
  }
}

function drawBody(c: CanvasRenderingContext2D, S: Snapshot, b: Body): void {
  const name = b.planet.name, R = b.R;
  const rings = name === 'saturn' ? [RINGS.inner, RINGS.inner + 3, RINGS.outer - 4, RINGS.outer].map(r => bodyRing(b.p, r, E1, E2, 48)) : name === 'uranus' ? [bodyRing(b.p, URANUS_RING, MOTION, E1, 36)] : [];
  c.strokeStyle = GOLD;
  c.fillStyle = GOLD;
  c.lineWidth = 0.9;
  c.beginPath();
  for (const r of rings) trace(c, r.back);
  c.stroke();
  const mo = S.moon;
  if (name === 'earth' && !mo.front) c.fill(disc(mo.x, mo.y, mo.R));
  // clear the gold under the disc, engrave the lit part, ring the rim
  c.save();
  c.globalCompositeOperation = 'destination-out';
  c.fill(disc(b.x, b.y, R + 2));
  c.restore();
  c.save();
  c.clip(polyPath(litShape(R, b.toSun, b.phase).map(([u, v]): Vec2 => [b.x + u, b.y + v])));
  c.lineWidth = R > 14 ? 1.2 : 0.95;
  c.beginPath();
  const gap = R > 14 ? 2.5 : 2.1;
  for (let yy = -R; yy <= R; yy += gap) {
    if (name === 'jupiter' && Math.abs(Math.sin(yy * 0.4)) < 0.35) continue;
    c.moveTo(b.x - R, b.y + yy);
    c.lineTo(b.x + R, b.y + yy);
  }
  c.stroke();
  c.restore();
  c.lineWidth = R > 14 ? 1.8 : 1.4;
  c.beginPath();
  c.arc(b.x, b.y, R, 0, TAU);
  c.stroke();
  c.lineWidth = 0.9;
  c.beginPath();
  for (const r of rings) trace(c, r.front);
  c.stroke();
  if (name === 'earth' && mo.front) c.fill(disc(mo.x, mo.y, mo.R));
}

export const decoSpiral: Scene = {
  name: 'spiral-deco',
  duration: (INTRO + LOOP) / 12,
  loopFrom: INTRO / 12,
  poster: (INTRO + POSTER_M) / 12,
  draw(f) {
    const { stage } = f;
    const fr = frameFit(stage.w, stage.h), S = snapshot(spiralSky(f));
    ground(f, LACQUER, { seed: 3000, texture: 0.7, vignette: 0.5 });
    still(f, 'sp10-wedges', g => background(g, fr));
    // bare lacquer under the Sun and each planet, so the wedges stop at their rims
    f.ctx.save();
    enter(f.ctx, fr);
    f.ctx.fillStyle = LACQUER;
    for (const b of S.bodies) f.ctx.fill(disc(b.x, b.y, b.R));
    f.ctx.restore();

    const gold = scratch(f, 'sp10-gold', g => {
      const c = g.ctx;
      g.stage.blit(c, cached(f, 'sp10-fixed', gg => fixedGold(gg, fr)));
      enter(c, fr);
      c.save();
      c.beginPath();
      c.rect(INSET + 12, INSET + 12, BOX - 2 * (INSET + 12), BOX - 2 * (INSET + 12));
      c.clip();
      c.lineCap = 'butt';
      c.fillStyle = GOLD;
      c.beginPath();
      for (const d of dust(S)) {
        if (d.tone > 0.5 || d.alpha < 0.3) continue;
        const s = (0.5 + d.tone) * d.s;
        c.moveTo(d.x + s, d.y);
        c.arc(d.x, d.y, s, 0, TAU);
      }
      c.fill();
      paint(S, {
        run: (t, run, near) => inWake(c, S, () => pinstripe(c, run, t.k === 8 ? 1 : SPREAD[t.k]!, near)),
        orbit(_pl, half, near) {
          c.strokeStyle = GOLD;
          c.globalAlpha = near ? 0.34 : 0.2;
          c.lineWidth = 0.8;
          c.beginPath();
          trace(c, half);
          c.stroke();
          c.globalAlpha = 1;
        },
        rocks(rocks) {
          c.fillStyle = GOLD;
          c.beginPath();
          for (const r of rocks) { const s = (0.45 + r.rock.size * 0.45) * r.s; c.moveTo(r.x + s, r.y); c.arc(r.x, r.y, s, 0, TAU); }
          c.fill();
        },
        sunTrail: st => inWake(c, S, () => {
          // a double rule back along the Sun's path, a diamond at every tick of the ruler (a year of Mercury's in the loop)
          for (const side of [-1, 1]) {
            const line = st.map((s, i): Sample => {
              const [tx, ty] = tangent(st, i), h = side * 3.2 * s.s;
              return { ...s, x: s.x - ty * h, y: s.y + tx * h };
            });
            c.strokeStyle = GOLD;
            strokeRun(c, line, 4, s => ({ width: 1 * s.s, alpha: Math.pow(1 - s.age, 1.3) }));
          }
          c.fillStyle = GOLD;
          const tick = S.plan.tick[SUN_W]!, [dx, dy] = [MOTION[0], MOTION[1]], base = c.globalAlpha;
          for (const s of st) {
            if (s.q % tick !== 0 || s.age < 0.03 || s.age > 0.85) continue;
            const L = 8 * s.s, W = 4.5 * s.s;
            c.globalAlpha = base * Math.pow(1 - s.age, 1.1);
            c.fill(polyPath([[s.x + dx * L, s.y + dy * L], [s.x - dy * W, s.y + dx * W], [s.x - dx * L, s.y - dy * L], [s.x + dy * W, s.y - dx * W]]));
          }
          c.globalAlpha = base;
        }),
        sun: () => sunGold(c, S.sun.x, S.sun.y),
        body: b => drawBody(c, S, b),
      });
      c.restore();
      // sparkles: four-point stars flashing in turn
      c.fillStyle = GOLD;
      for (const s of SPARKLES()) {
        const flash = Math.max(0, Math.sin(TAU * (cyclePhase(s.cycles, S.beat) + s.off))) ** 3;
        if (flash < 0.02) continue;
        const L = s.s * (0.4 + 0.6 * flash);
        c.globalAlpha = flash;
        c.fill(polyPath([[s.x, s.y - L], [s.x + L * 0.18, s.y - L * 0.18], [s.x + L, s.y], [s.x + L * 0.18, s.y + L * 0.18], [s.x, s.y + L], [s.x - L * 0.18, s.y + L * 0.18], [s.x - L, s.y], [s.x - L * 0.18, s.y - L * 0.18]]));
      }
      c.globalAlpha = 1;
      // the sheen: a band of pale light crossing the gold once a loop, laid only where there is gold
      const u = cyclePhase(1, S.beat) * 1.6 - 0.3, sx = u * BOX * 2;
      const sheen = c.createLinearGradient(sx - 160, 0, sx + 160, 0);
      sheen.addColorStop(0, 'rgba(243,226,174,0)');
      sheen.addColorStop(0.5, 'rgba(255,246,214,0.85)');
      sheen.addColorStop(1, 'rgba(243,226,174,0)');
      c.globalCompositeOperation = 'source-atop';
      c.save();
      c.translate(BOX / 2, BOX / 2);
      c.rotate(-Math.PI / 4);
      c.translate(-BOX, -BOX / 2);
      c.fillStyle = sheen;
      c.fillRect(0, -BOX, BOX * 2, BOX * 3);
      c.restore();
      c.globalCompositeOperation = 'source-over';
      c.setTransform(1, 0, 0, 1, 0, 0);
      knockOut(g, c, toothMask(g, { seed: 3002, density: 30, size: 1, color: PALE_GOLD }), 0.18);
    });
    composite(f, gold);
  },
};
