/**
 * SP08 "Cut Paper" (the moving solar system at an angle; layered cut paper). A paper diorama, whole from the start,
 * on a night-navy ground scattered with punched stars. Each wake is a string of scissor-cut paper strips laid along
 * the helix, every strip lifted a little and casting a soft shadow on whatever lies under it: the planet's own paper
 * at the head, then darker and darker stock back along the spiral, narrower as they go, the strips behind the Sun's
 * line cut from shadowed paper. The Sun is three layers (an orange star turning once a loop, a yellow disc, a pale
 * heart); the planets are paper discs with pasted-on bands and land, a navy piece pasted over the part the Sun does
 * not reach; dust drifts past as tiny punchings.
 *
 * A strip is cut at fixed moments of the wake's own time, so each one rides the helix as a single piece of paper.
 */
import { mix } from '../../art/color';
import { TAU, type Vec2 } from '../../core/math';
import { rng } from '../../core/random';
import type { Scene, SceneFrame } from '../../core/scene';
import { circle, composite, ground, polyPath, scissor, still, toothMask } from '../gallery/common';
import { SOLAR } from '../solar/palettes';
import { angleAt, bodyBand, bodyRing, BOX, dust, E1, E2, enter, frameFit, hash01, INTRO, inWake, litShape, LOOP, MOTION, once, orbitRings, paint, PLANETS, POSTER_M, RINGS, snapshot, spiralSky, SUB, SUN_R, tangent, URANUS_RING, type Body, type Frame, type PlanetName, type Sample, type Snapshot } from './common';

const PAL = SOLAR.cutPaper;
const GROUND = PAL.paper;
const [SUN_Y, SUN_O, SUN_PALE] = PAL.fills.slice(8) as [string, string, string];
const [GREY, CREAM, BLUE, LEAF, RED, ORANGE, SAND, TEAL, COBALT] = PAL.accents as [string, string, string, string, string, string, string, string, string];
const COLOR: Record<PlanetName, string> = { mercury: GREY, venus: CREAM, earth: BLUE, mars: RED, jupiter: ORANGE, saturn: SAND, uranus: TEAL, neptune: COBALT };
const NIGHT = PAL.fills[1]!;
const SHADOW = 'rgba(4,8,24,0.55)';
const WIDTH = [3, 3.8, 4, 3.6, 6.6, 5.8, 5, 5];
/** Samples of the wake's own time per strip (divides `SUB * LOOP`), and how far each reaches under the next. */
const STRIP = 16, OVER = 3;

/** Shadow of paper lifted `lift` design units off what is below; offsets and blur are in output pixels. */
function lifted(c: CanvasRenderingContext2D, k: number, lift: number): void {
  c.shadowColor = SHADOW;
  c.shadowBlur = lift * 2.2 * k;
  c.shadowOffsetX = lift * 0.8 * k;
  c.shadowOffsetY = lift * 1.2 * k;
}

interface Cut { planets: Vec2[][]; star: Vec2[]; sunDisc: Vec2[]; sunHeart: Vec2[]; moon: Vec2[] }

const cut = once((): Cut => {
  const star = Array.from({ length: 30 }, (_, k): Vec2 => {
    const a = (k / 30) * TAU, r = k % 2 ? SUN_R + 5 : SUN_R + 18;
    return [Math.cos(a) * r, Math.sin(a) * r];
  });
  return {
    planets: PLANETS.map(p => scissor(circle(0, 0, p.r, 40), 2820 + p.k, Math.max(3.4, p.r * 0.45), 0.4)),
    star: scissor(star, 2831, 10, 0.8),
    sunDisc: scissor(circle(0, 0, SUN_R, 40), 2832, 12, 0.8),
    sunHeart: scissor(circle(-3, -3, SUN_R * 0.55, 24), 2833, 9, 0.6),
    moon: scissor(circle(0, 0, 1, 10), 2840, 0.3, 0.03),
  };
});

/** The ground: punched stars. */
function stars(g: SceneFrame, fr: Frame): void {
  const c = g.ctx, k = g.stage.scale * fr.s, r = rng(2841);
  enter(c, fr);
  c.save();
  lifted(c, k, 1.2);
  for (let j = 0; j < 90; j++) {
    const x = r() * BOX, y = r() * BOX, s = 1.4 + Math.pow(r(), 3) * 3;
    c.fillStyle = r() < 0.3 ? SUN_PALE : CREAM;
    c.fill(polyPath(circle(x, y, s, 10, r())));
  }
  c.restore();
}

/**
 * A wake as paper strips. Strips start where the wake's own time is a multiple of `STRIP`, so each keeps its place on
 * the helix as one piece of paper; each is cut with its edges nudged by a hash of that time, from darker stock the
 * further back it lies, and lifted with its shadow onto whatever is under it. Older strips are laid first.
 */
function strips(c: CanvasRenderingContext2D, k: number, run: readonly Sample[], id: number, color: string, half0: number, near: boolean): void {
  const base = near ? color : mix(color, GROUND, 0.35), pieces: { poly: Vec2[]; age: number }[] = [];
  // group the samples strip by strip; each strip reaches `OVER` samples under the next one back, so they overlap
  const groups: Sample[][] = [];
  let key = NaN;
  for (const s of run) {
    const kk = Math.floor(s.q / STRIP);
    if (kk !== key) { groups.push([]); key = kk; }
    groups[groups.length - 1]!.push(s);
  }
  groups.forEach((g, i) => {
    const piece = g.concat((groups[i + 1] ?? []).slice(0, OVER)), mid = piece[piece.length >> 1]!;
    if (piece.length < 2 || mid.age > 0.97) return;
    const id2 = Math.floor(piece[0]!.q / STRIP), nudge = (j: number): number => (hash01(id2, id, j) - 0.5) * 1.4;
    const left: Vec2[] = [], right: Vec2[] = [];
    piece.forEach((s, j) => {
      const [tx, ty] = tangent(piece, j), h = half0 * s.s * (1 - s.age * 0.75);
      left.push([s.x - ty * (h + nudge(1)), s.y + tx * (h + nudge(1))]);
      right.push([s.x + ty * (h + nudge(2)), s.y - tx * (h + nudge(2))]);
    });
    // the scissors cut the ends on a slant
    left[0] = [left[0]![0] + (hash01(id2, id, 3) - 0.5) * 3, left[0]![1] + (hash01(id2, id, 4) - 0.5) * 3];
    pieces.push({ poly: left.concat(right.reverse()), age: mid.age });
  });
  c.save();
  lifted(c, k, near ? 2.2 : 1.4);
  for (let j = pieces.length - 1; j >= 0; j--) {
    c.fillStyle = mix(base, GROUND, Math.min(0.85, pieces[j]!.age * 0.9));
    c.fill(polyPath(pieces[j]!.poly));
  }
  c.restore();
}

function drawBody(c: CanvasRenderingContext2D, k: number, S: Snapshot, b: Body): void {
  const name = b.planet.name, L = cut();
  const band = name === 'saturn' ? bodyBand(b.p, RINGS.inner, RINGS.outer, E1, E2) : null;
  const ur = name === 'uranus' ? bodyRing(b.p, URANUS_RING, MOTION, E1) : null;
  const ringLine = (pts: { x: number; y: number }[]): void => {
    c.save();
    lifted(c, k, 1.5);
    c.strokeStyle = CREAM;
    c.lineWidth = 2 * b.s;
    c.beginPath();
    pts.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)));
    c.stroke();
    c.restore();
  };
  if (band) { c.save(); lifted(c, k, 2.5); c.fillStyle = CREAM; c.fill(polyPath(band.back)); c.restore(); }
  if (ur) ringLine(ur.back);
  const mo = S.moon;
  const moon = (): void => {
    c.save();
    c.translate(mo.x, mo.y);
    c.scale(mo.R, mo.R);
    lifted(c, k, 1.6);
    c.fillStyle = GREY;
    c.fill(polyPath(L.moon));
    c.restore();
  };
  if (name === 'earth' && !mo.front) moon();
  c.save();
  c.translate(b.x, b.y);
  c.scale(b.s, b.s);
  const disc = polyPath(L.planets[b.planet.k]!), r = b.planet.r;
  c.save();
  lifted(c, k, r > 14 ? 3.4 : 2.6);
  c.fillStyle = COLOR[name];
  c.fill(disc);
  c.restore();
  c.save();
  c.clip(disc);
  lifted(c, k, 0.7);
  if (name === 'jupiter') {
    [[-0.72, -0.5], [-0.26, -0.08], [0.2, 0.34], [0.56, 0.74]].forEach(([y0, y1], i) => {
      c.fillStyle = i % 2 ? CREAM : RED;
      c.fill(polyPath(scissor([[-r * 1.2, y0! * r], [r * 1.2, y0! * r + 0.5], [r * 1.2, y1! * r], [-r * 1.2, y1! * r - 0.5]], 2835 + i, 8, 0.4)));
    });
  }
  if (name === 'earth') {
    c.fillStyle = LEAF;
    c.fill(polyPath([[-0.8 * r, -0.4 * r], [-0.25 * r, -0.85 * r], [0.3 * r, -0.5 * r], [0, 0], [-0.5 * r, 0.2 * r]]));
    c.fill(polyPath([[0.2 * r, 0.25 * r], [0.7 * r, 0], [0.8 * r, 0.5 * r], [0.35 * r, 0.8 * r]]));
  }
  // the part the Sun does not reach: a piece of night-blue paper pasted over it
  const shade = new Path2D();
  shade.addPath(polyPath(circle(0, 0, r * 1.2, 24)));
  shade.addPath(polyPath(litShape(r, b.toSun, b.phase)));
  c.fillStyle = NIGHT;
  c.globalAlpha = 0.86;
  c.fill(shade, 'evenodd');
  c.restore();
  c.restore();
  if (band) { c.save(); lifted(c, k, 2.5); c.fillStyle = CREAM; c.fill(polyPath(band.front)); c.restore(); }
  if (ur) ringLine(ur.front);
  if (name === 'earth' && mo.front) moon();
}

export const cutPaperSpiral: Scene = {
  name: 'spiral-cut-paper',
  duration: (INTRO + LOOP) / 12,
  loopFrom: INTRO / 12,
  poster: (INTRO + POSTER_M) / 12,
  draw(f) {
    const { ctx, stage } = f;
    const fr = frameFit(stage.w, stage.h), k = stage.scale * fr.s, S = snapshot(spiralSky(f)), L = cut();
    ground(f, GROUND, { seed: 2800, texture: 1.2, vignette: 0.35 });
    still(f, 'sp08-stars', g => stars(g, fr));
    ctx.save();
    enter(ctx, fr);
    // dust: tiny punchings drifting past, one shadow for them all
    ctx.save();
    lifted(ctx, k, 0.8);
    ctx.fillStyle = CREAM;
    ctx.beginPath();
    for (const d of dust(S)) {
      if (d.alpha < 0.35 || d.tone > 0.5) continue;
      const s = (0.8 + d.tone * 1.4) * d.s;
      ctx.moveTo(d.x + s, d.y);
      ctx.arc(d.x, d.y, s, 0, TAU);
    }
    ctx.fill();
    ctx.restore();
    paint(S, {
      run: (t, run, near) => inWake(ctx, S, () => {
        if (t.k === 8) strips(ctx, k, run, 8, GREY, 1.5, near);
        else strips(ctx, k, run, t.k, COLOR[PLANETS[t.k]!.name], WIDTH[t.k]!, near);
      }),
      orbit: (_pl, half, near) => orbitRings(ctx, S, half, near, CREAM, 1.6),
      rocks(rocks) {
        ctx.save();
        lifted(ctx, k, 0.8);
        for (const r of rocks) {
          if (r.rock.tone > 0.6) continue;
          const s = (1 + r.rock.size * 0.7) * r.s;
          ctx.fillStyle = r.rock.tone < 0.3 ? SAND : GREY;
          ctx.beginPath();
          ctx.arc(r.x, r.y, s, 0, TAU);
          ctx.fill();
        }
        ctx.restore();
      },
      sunTrail: st => inWake(ctx, S, () => strips(ctx, k, st, 9, SUN_O, 5, true)),
      sun() {
        ctx.save();
        ctx.translate(S.sun.x, S.sun.y);
        ctx.save();
        ctx.rotate(angleAt(1, 0, SUB * S.beat));
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
      },
      body: b => drawBody(ctx, k, S, b),
    });
    ctx.restore();
    composite(f, toothMask(f, { seed: 2850, kind: 'streak', angle: 0.3, density: 30, size: 0.7, length: 14, color: '#ffffff' }), { alpha: 0.05 });
    composite(f, toothMask(f, { seed: 2851, density: 40, size: 0.9, color: '#000000' }), { alpha: 0.08 });
  },
};
