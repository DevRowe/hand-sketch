/**
 * SP04 "Etching" (the moving solar system at an angle; two-plate etching). An intaglio print on warm plate paper inside
 * its platemark, whole from the start. The cold plate hatches the sky, deepening away from the Sun in three bites and
 * burnished clean wherever a wake or a planet passes. The warm plate engraves each wake as a ribbon between two fine
 * contours, hatched across: open where the coil swings in front of the Sun's line and in the light, closed up and
 * cross-hatched where it passes behind; the hatching thins out towards the tail until only the contours are left. The
 * Sun is engraved in rings inside a burst of rays; each planet is modelled by line, contour lines on its lit part and
 * cross-hatching on the rest, its phase turning as it swings round.
 *
 * Tone is only ever the density of lines. The sky's lines never move; a wake's hatching travels with the wake.
 */
import { cursive } from '../../art/glyphs';
import { TAU, type Vec2 } from '../../core/math';
import { rng } from '../../core/random';
import type { Scene, SceneFrame } from '../../core/scene';
import { cached, ground, hatchLines, ink, still } from '../gallery/common';
import { SOLAR } from '../solar/palettes';
import { along, bodyBand, bodyRing, BOX, disc, dust, E1, E2, enter, frameFit, INTRO, litShape, LOOP, MOTION, paint, POSTER_M, project, RINGS, snapshot, spiralClock, SUN_R, tangent, trace, URANUS_RING, type Body, type Frame, type Sample, type Snapshot } from './common';

const PAL = SOLAR.etching;
const COLD = PAL.inks[0]!, WARM = PAL.inks[1]!, PAPER = PAL.paper;
const [PLATE_TONE, MARK] = PAL.fills as [string, string];
const PLATE = { x: 18, y: 18, w: BOX - 36, h: BOX - 36 } as const;
const BOX_ALL = [0, 0, BOX, BOX] as const;
/** Half width of each wake's ribbon at the planet, at the Sun's depth. */
const WIDTH = [2.8, 3.6, 3.8, 3.4, 6, 5.2, 4.4, 4.4];

/** Everything outside a clearing of radius `clear` round the Sun, for one bite of the sky. */
function skyClip(clear: number): Path2D {
  const S = project([0, 0, 0]), p = new Path2D();
  p.rect(-2000, -2000, 5000, 5000);
  p.moveTo(S.x + clear, S.y);
  p.arc(S.x, S.y, clear, 0, TAU, true);
  return p;
}

const plateInside = (inset: number): Path2D => {
  const p = new Path2D();
  p.rect(PLATE.x + inset, PLATE.y + inset, PLATE.w - inset * 2, PLATE.h - inset * 2);
  return p;
};

/** The cold plate: sky hatching in three bites, stars burnished out, the ruled border, fans and lettering. */
function coldPlate(g: SceneFrame, fr: Frame): void {
  const c = g.ctx;
  enter(c, fr);
  c.save();
  c.clip(plateInside(6));
  hatchLines(c, skyClip(SUN_R + 60), BOX_ALL, { angle: 0.42, gap: 5.4, color: COLD, width: 0.8, alpha: 0.7, waver: 0.6, seed: 2401 });
  hatchLines(c, skyClip(360), BOX_ALL, { angle: -0.5, gap: 5.8, color: COLD, width: 0.75, alpha: 0.65, waver: 0.6, seed: 2402 });
  hatchLines(c, skyClip(560), BOX_ALL, { angle: 1.25, gap: 4.8, color: COLD, width: 0.75, alpha: 0.7, waver: 0.5, seed: 2403, breakup: 0.1 });
  c.restore();
  const r = rng(2404);
  for (let k = 0; k < 80; k++) {
    const x = PLATE.x + 20 + r() * (PLATE.w - 40), y = PLATE.y + 20 + r() * (PLATE.h - 40), s = 1.8 + r() * 3.2;
    c.fillStyle = PAPER;
    c.beginPath();
    c.arc(x, y, s, 0, TAU);
    c.fill();
    c.strokeStyle = COLD;
    c.lineWidth = 0.8;
    c.beginPath();
    c.moveTo(x - s * 1.6, y); c.lineTo(x + s * 1.6, y);
    c.moveTo(x, y - s * 1.6); c.lineTo(x, y + s * 1.6);
    c.stroke();
  }
  const i0 = PLATE.x + 12, i1 = PLATE.x + PLATE.w - 12;
  c.strokeStyle = COLD;
  c.lineWidth = 1.3;
  c.strokeRect(i0, i0, i1 - i0, i1 - i0);
  c.lineWidth = 0.7;
  c.strokeRect(i0 + 5, i0 + 5, i1 - i0 - 10, i1 - i0 - 10);
  // the lower left spandrel engraved as a fan of rays, where the wake leaves the plate open
  c.save();
  c.beginPath();
  c.rect(i0 + 5, i0 + 5, i1 - i0 - 10, i1 - i0 - 10);
  c.clip();
  c.globalCompositeOperation = 'destination-out';
  c.beginPath();
  c.moveTo(i0 + 5, i1 - 5);
  c.arc(i0 + 5, i1 - 5, 232, -Math.PI / 2, 0);
  c.closePath();
  c.fill();
  c.globalCompositeOperation = 'source-over';
  c.lineWidth = 0.75;
  c.beginPath();
  for (let k = 0; k <= 36; k++) {
    const a = -(k / 36) * (Math.PI / 2), len = k % 6 === 0 ? 220 : k % 2 === 0 ? 160 : 118;
    c.moveTo(i0 + 5, i1 - 5);
    c.lineTo(i0 + 5 + Math.cos(a) * len, i1 - 5 + Math.sin(a) * len);
  }
  c.stroke();
  c.lineWidth = 1;
  c.beginPath();
  c.arc(i0 + 5, i1 - 5, 232, -Math.PI / 2, 0);
  c.stroke();
  c.restore();
  c.lineWidth = 1.1;
  c.lineJoin = 'round';
  for (const [x0, x1, y, seed] of [[860, 1030, 1012, 2405], [910, 1030, 1036, 2406], [270, 380, 1036, 2407]] as const) {
    c.beginPath();
    cursive(x0, x1, y, seed, { height: 7, step: 8 }).forEach(([x, yy], k) => (k ? c.lineTo(x, yy) : c.moveTo(x, yy)));
    c.stroke();
  }
}

/** Edges of a ribbon of half width `half` along a run. */
function ribbonEdges(run: readonly Sample[], half: (s: Sample) => number): { l: Vec2[]; r: Vec2[] } {
  const l: Vec2[] = [], r: Vec2[] = [];
  run.forEach((s, i) => {
    const [tx, ty] = tangent(run, i), h = half(s);
    l.push([s.x - ty * h, s.y + tx * h]);
    r.push([s.x + ty * h, s.y - tx * h]);
  });
  return { l, r };
}

const wakeHalf = (k: number) => (s: Sample): number => (k === 8 ? 1.4 : k === -1 ? 3.2 : WIDTH[k]!) * s.s * Math.pow(Math.max(0, 1 - s.age), 0.8) + 0.4;

/** Burnish the cold plate along a wake: its ribbon, a little wider. */
function burnish(c: CanvasRenderingContext2D, run: readonly Sample[], k: number): void {
  const { l, r } = ribbonEdges(run, s => wakeHalf(k)(s) + 3);
  c.beginPath();
  l.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
  for (let i = r.length - 1; i >= 0; i--) c.lineTo(r[i]![0], r[i]![1]);
  c.closePath();
  c.fill();
}

/** A wake engraved: paper inside two contours, hatched across, denser and crossed where it runs behind. */
function engrave(c: CanvasRenderingContext2D, run: readonly Sample[], k: number, near: boolean): void {
  if (run.length < 2) return;
  const { l, r } = ribbonEdges(run, wakeHalf(k));
  c.fillStyle = PAPER;
  c.beginPath();
  l.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
  for (let i = r.length - 1; i >= 0; i--) c.lineTo(r[i]![0], r[i]![1]);
  c.closePath();
  c.fill();
  c.strokeStyle = WARM;
  c.lineCap = 'round';
  c.lineWidth = 0.75;
  // hatching across: a line every `step` samples of the wake's own time, dropping out towards the tail
  const step = near ? 4 : 2, seed = 2450 + k * 7;
  c.beginPath();
  run.forEach((s, i) => {
    if (s.q % step !== 0) return;
    const keep = along(s.q, seed, 90) * 0.5 + 0.5, lit = near ? 0.35 + 0.3 * s.side : 0.9;
    if (keep > (1 - s.age * 1.1) * (0.55 + lit)) return;
    c.moveTo(l[i]![0], l[i]![1]);
    c.lineTo(r[i]![0], r[i]![1]);
  });
  c.stroke();
  if (!near) {
    // behind the Sun's line: a second pass crossing the first
    c.beginPath();
    run.forEach((s, i) => {
      if (s.q % 3 !== 0 || i + 3 >= run.length || s.age > 0.75) return;
      c.moveTo(l[i]![0], l[i]![1]);
      c.lineTo(r[i + 3]![0], r[i + 3]![1]);
    });
    c.stroke();
  }
  c.lineWidth = near ? 1 : 0.8;
  c.beginPath();
  l.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
  r.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
  c.stroke();
}

/** The Sun: a disc engraved in rings inside a burst of bitten rays. */
function sunPlate(c: CanvasRenderingContext2D, S: Snapshot): void {
  const X = S.sun.x, Y = S.sun.y;
  c.fillStyle = PAPER;
  c.fill(disc(X, Y, SUN_R + 44));
  c.strokeStyle = WARM;
  c.lineCap = 'round';
  const r = rng(2410);
  c.lineWidth = 0.8;
  c.beginPath();
  for (let k = 0; k < 150; k++) {
    const a = (k / 150) * TAU + (r() - 0.5) * 0.01, r0 = SUN_R + 4 + r() * 3, r1 = SUN_R + 14 + (k % 3 === 0 ? 26 : k % 3 === 1 ? 12 : 5) + r() * 6;
    c.moveTo(X + Math.cos(a) * r0, Y + Math.sin(a) * r0);
    c.lineTo(X + Math.cos(a) * r1, Y + Math.sin(a) * r1);
  }
  c.stroke();
  c.lineWidth = 0.75;
  c.beginPath();
  for (let rr = 5; rr < SUN_R; rr += 4.2) { c.moveTo(X + rr, Y); c.arc(X, Y, rr, 0, TAU); }
  c.stroke();
  c.lineWidth = 1.6;
  c.beginPath();
  c.arc(X, Y, SUN_R, 0, TAU);
  c.stroke();
}

/** A sphere modelled by line: contour lines on its lit part, crossing hatches over the rest. */
function sphere(c: CanvasRenderingContext2D, x: number, y: number, R: number, toSun: number, phase: number, bands: readonly [number, number][] = []): void {
  c.save();
  c.translate(x, y);
  c.fillStyle = PAPER;
  c.fill(disc(0, 0, R + 1.2));
  c.save();
  c.clip(disc(0, 0, R));
  c.strokeStyle = WARM;
  c.lineCap = 'round';
  c.lineWidth = R > 14 ? 0.75 : 0.6;
  c.save();
  c.rotate(toSun);
  c.beginPath();
  const lines = Math.max(3, Math.round(R / 2.4));
  for (let j = 1; j < lines; j++) {
    const u = -1 + (2 * j) / lines, yy = u * R, half = Math.sqrt(1 - u * u) * R;
    c.moveTo(-half * 0.2, yy);
    c.quadraticCurveTo(half * 0.5, yy + u * R * 0.18, half, yy);
  }
  c.stroke();
  c.restore();
  if (bands.length) {
    c.lineWidth = 0.7;
    c.beginPath();
    for (const [y0, y1] of bands) for (let yy = y0 * R; yy <= y1 * R; yy += 1.5) { c.moveTo(-R, yy); c.lineTo(R, yy + 0.8); }
    c.stroke();
  }
  // the unlit part: two crossing passes
  const shade = new Path2D();
  shade.addPath(disc(0, 0, R + 1));
  shade.addPath(polyPathOf(litShape(R, toSun, phase)));
  c.clip(shade, 'evenodd');
  c.lineWidth = 0.65;
  c.beginPath();
  for (let u = -R * 2; u < R * 2; u += 1.8) { c.moveTo(u, -R - 2); c.lineTo(u + R * 0.35, R + 2); }
  c.stroke();
  c.beginPath();
  for (let u = -R * 2; u < R * 2; u += 2.1) { c.moveTo(-R - 2, u); c.lineTo(R + 2, u + R * 0.3); }
  c.stroke();
  c.restore();
  c.strokeStyle = WARM;
  c.lineWidth = R > 14 ? 1.4 : 1.1;
  c.beginPath();
  c.arc(0, 0, R, 0, TAU);
  c.stroke();
  c.restore();
}

function polyPathOf(pts: readonly Vec2[]): Path2D {
  const p = new Path2D();
  pts.forEach(([x, y], k) => (k ? p.lineTo(x, y) : p.moveTo(x, y)));
  p.closePath();
  return p;
}

function ringLines(c: CanvasRenderingContext2D, b: Body, back: boolean): void {
  c.strokeStyle = WARM;
  c.lineWidth = 0.65;
  c.beginPath();
  for (let rr = RINGS.inner; rr <= RINGS.outer; rr += 2.2) {
    const ring = bodyRing(b.p, rr, E1, E2, 40);
    trace(c, back ? ring.back : ring.front);
  }
  c.stroke();
}

function drawBody(c: CanvasRenderingContext2D, S: Snapshot, b: Body): void {
  const name = b.planet.name;
  if (name === 'saturn') {
    const band = bodyBand(b.p, RINGS.inner - 1, RINGS.outer + 1, E1, E2);
    c.fillStyle = PAPER;
    c.fill(polyPathOf(band.back));
    ringLines(c, b, true);
  }
  if (name === 'uranus') {
    c.strokeStyle = WARM;
    c.lineWidth = 0.8;
    c.beginPath();
    trace(c, bodyRing(b.p, URANUS_RING, MOTION, E1).back);
    c.stroke();
  }
  const mo = S.moon;
  if (name === 'earth' && !mo.front) sphere(c, mo.x, mo.y, mo.R, mo.toSun, mo.phase);
  sphere(c, b.x, b.y, b.R, b.toSun, b.phase, name === 'jupiter' ? [[-0.72, -0.5], [-0.2, 0.05], [0.36, 0.5], [0.72, 0.85]] : name === 'saturn' ? [[-0.4, -0.2], [0.24, 0.38]] : []);
  if (name === 'saturn') {
    const band = bodyBand(b.p, RINGS.inner - 1, RINGS.outer + 1, E1, E2);
    c.fillStyle = PAPER;
    c.fill(polyPathOf(band.front));
    ringLines(c, b, false);
  }
  if (name === 'uranus') {
    c.strokeStyle = WARM;
    c.lineWidth = 0.8;
    c.beginPath();
    trace(c, bodyRing(b.p, URANUS_RING, MOTION, E1).front);
    c.stroke();
  }
  if (name === 'earth' && mo.front) sphere(c, mo.x, mo.y, mo.R, mo.toSun, mo.phase);
}

export const etchingSpiral: Scene = {
  name: 'spiral-etching',
  duration: (INTRO + LOOP) / 12,
  loopFrom: INTRO / 12,
  poster: (INTRO + POSTER_M) / 12,
  draw(f) {
    const { stage } = f;
    const fr = frameFit(stage.w, stage.h), m = spiralClock(f), S = snapshot(m);
    ground(f, PAPER, { seed: 2400, texture: 0.9 });
    still(f, 'sp04-platemark', g => {
      const c = g.ctx;
      enter(c, fr);
      c.fillStyle = PLATE_TONE;
      c.globalAlpha = 0.55;
      c.fillRect(PLATE.x, PLATE.y, PLATE.w, PLATE.h);
      c.globalAlpha = 1;
      c.lineWidth = 2.2;
      c.strokeStyle = MARK;
      c.beginPath();
      c.moveTo(PLATE.x, PLATE.y + PLATE.h); c.lineTo(PLATE.x, PLATE.y); c.lineTo(PLATE.x + PLATE.w, PLATE.y);
      c.stroke();
      c.strokeStyle = 'rgba(255,255,255,0.7)';
      c.beginPath();
      c.moveTo(PLATE.x + PLATE.w + 1.5, PLATE.y); c.lineTo(PLATE.x + PLATE.w + 1.5, PLATE.y + PLATE.h + 1.5); c.lineTo(PLATE.x, PLATE.y + PLATE.h + 1.5);
      c.stroke();
    }, { blend: 'multiply' });

    // the cold plate, burnished clean along every wake and under every body
    const sky = cached(f, 'sp04-cold', g => coldPlate(g, fr));
    ink(f, 'sp04-cold', g => {
      const c = g.ctx;
      g.stage.blit(c, sky);
      enter(c, fr);
      c.globalCompositeOperation = 'destination-out';
      c.fillStyle = '#000';
      for (const t of S.trails) burnish(c, t.samples, t.k);
      burnish(c, S.sunTrail, -1);
      c.fill(disc(S.sun.x, S.sun.y, SUN_R + 44));
      for (const b of S.bodies) {
        c.fill(disc(b.x, b.y, b.R + 2));
        if (b.planet.name === 'saturn') c.fill(disc(b.x, b.y, RINGS.outer * b.s + 3));
      }
      c.fill(disc(S.moon.x, S.moon.y, S.moon.R + 1.5));
      // the dust, bitten into the cold plate as tiny crosses
      c.globalCompositeOperation = 'source-over';
      c.strokeStyle = COLD;
      c.lineWidth = 0.7;
      for (const d of dust(m)) {
        if (d.tone < 0.45) continue;
        c.globalAlpha = d.alpha;
        const s = (1.2 + d.tone * 2) * d.s;
        c.beginPath();
        c.moveTo(d.x - s, d.y); c.lineTo(d.x + s, d.y);
        c.moveTo(d.x, d.y - s); c.lineTo(d.x, d.y + s);
        c.stroke();
      }
    });

    // the warm plate, printed second and a hair off
    ink(f, 'sp04-warm', g => {
      const c = g.ctx;
      enter(c, fr);
      c.clip(plateInside(12));
      paint(S, {
        run: (t, run, near) => engrave(c, run, t.k, near),
        orbit(_pl, half, near) {
          c.strokeStyle = COLD;
          c.lineWidth = 0.7;
          c.globalAlpha = near ? 0.7 : 0.5;
          c.setLineDash(near ? [] : [1.2, 4]);
          c.beginPath();
          trace(c, half);
          c.stroke();
          c.setLineDash([]);
          c.globalAlpha = 1;
        },
        rocks(rocks) {
          c.fillStyle = WARM;
          c.beginPath();
          for (const rk of rocks) { const s = (0.4 + rk.rock.size * 0.5) * rk.s; c.moveTo(rk.x + s, rk.y); c.arc(rk.x, rk.y, s, 0, TAU); }
          c.fill();
        },
        sunTrail: st => engrave(c, st, -1, false),
        sun: () => sunPlate(c, S),
        body: b => drawBody(c, S, b),
      });
    }, { offset: [0.8, 0.6] satisfies Vec2 });
  },
};
