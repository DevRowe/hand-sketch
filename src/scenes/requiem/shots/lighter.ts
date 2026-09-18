/**
 * The lighter: a thumb rolling the knurled wheel, the strike (a spray of sparks), and the flame standing up and
 * flickering, burnished out of the black with a warm glow around it and a cold blue root.
 */
import { catmullRom } from '../../../core/geometry';
import { lerp, TAU, type Vec2 } from '../../../core/math';
import { noise1, rng } from '../../../core/random';
import { blob, COLD, dense, easeOut, engraveCurves, erase, flood, FULL, INK, pool, pushIn, rectPts, region, scratchLines, shade, shadeLinear, shadeRadial, WARM, type Etch, type Shot } from '../etch';
import { engraveFinger, toneFinger, type Finger } from './hands';

export type LighterAct = 'thumb' | 'strike' | 'flame';

const BODY = rectPts(580, 520, 500, 700);
const HOOD = rectPts(640, 250, 380, 290);
const WHEEL: Vec2 = [600, 430];
const NOZZLE: Vec2 = [850, 250];

/** The flame's outline: a teardrop from the nozzle, its tip licking sideways as it flickers. */
function flame(t: number, size: number, seed: number): Vec2[] {
  const h = 380 * size, w = 78 * size, out: Vec2[] = [];
  for (let k = 0; k <= 48; k++) {
    const a = (k / 48) * TAU, s = Math.sin(a), c = Math.cos(a);
    const up = c > 0 ? c : c * 0.28, flick = (1 - Math.abs(s)) * 0 + 26 * size * noise1(t * 7 + up * 2, seed) * up;
    const bulge = c > 0 ? Math.pow(1 - c, 0.7) : 1;
    out.push([NOZZLE[0] + s * w * bulge + flick * up, NOZZLE[1] - 20 - up * h + (c < 0 ? -c * 40 * size : 0)]);
  }
  return out;
}

export function lighterShot(o: { act: LighterAct; seed: number }): Shot {
  const thumb = (u: number): Finger => ({ tip: [WHEEL[0] + 20, WHEEL[1] + 10 + (o.act === 'flame' ? 0 : 40 * (1 - easeOut(u)))], angle: -0.95, w: 320, len: 1100, nail: 'bare' });
  const size = (u: number): number => (o.act === 'flame' ? 1 : o.act === 'strike' ? easeOut(u) * 0.9 : 0);
  const r = rng(o.seed);
  const sparks = Array.from({ length: 40 }, () => ({ a: -1.9 + r() * 1.6, v: 200 + r() * 520, l: 16 + r() * 40 }));
  return {
    view: c => pushIn(c, 0.05, [820, 400]),
    tint(e) {
      const s = size(e.u);
      if (s > 0) {
        pool(e, NOZZLE[0], NOZZLE[1] - 160 * s, 520 * s + 60, WARM, 0.85);
        flood(e, region(blob(NOZZLE[0], NOZZLE[1] - 16, 44 * s, 20 * s, 2, 0.1)), COLD, 0.75);
      }
      pool(e, 640, 700, 600, WARM, 0.25);
    },
    tone(e) {
      const s = size(e.u);
      shade(e, FULL, 0.96);
      if (s > 0) shadeRadial(e, NOZZLE[0], NOZZLE[1] - 150 * s, 520 * s + 80, 0.1, 0.96, { min: true, sy: 1.15 });
      // the hood: perforated steel, lit from the flame above
      const hood = region(HOOD);
      shade(e, hood, 0.4, { form: true });
      shadeLinear(e, [640, 0], [1020, 0], 0.15, 0.75, { clip: hood, max: true, form: true });
      for (let row = 0; row < 3; row++) for (let col = 0; col < 5; col++) shade(e, region(blob(700 + col * 64 + (row % 2) * 32, 320 + row * 64, 17, 17, 3, 0.02, 0, 16)), 0.98);
      // the body: plastic below the hood, a highlight down its lit edge
      const body = region(BODY);
      shade(e, body, 0.6, { form: true });
      shadeLinear(e, [580, 0], [1080, 0], 0.3, 0.92, { clip: body, max: true, form: true });
      shade(e, region(rectPts(640, 540, 30, 700)), 0.08, { blur: 10, min: true, form: true });
      // the wheel
      shade(e, region(blob(WHEEL[0], WHEEL[1], 84, 84, 4, 0.02)), 0.55);
      toneFinger(e, thumb(e.u), 0.3);
      if (s > 0) {
        shade(e, region(flame(e.t, s * 1.3, o.seed)), 0.35, { blur: 40, min: true });
        shade(e, region(flame(e.t, s, o.seed)), 0, { blur: 4 });
        shade(e, region(blob(NOZZLE[0], NOZZLE[1] - 14, 36 * s, 16 * s, 2, 0.1)), 0.14, { blur: 6 });
      }
    },
    line(e: Etch) {
      const s = size(e.u), hoodRules: Vec2[][] = [], bodyRules: Vec2[][] = [];
      for (let x = 644; x < 1020; x += 7) hoodRules.push(dense([[x, 250], [x, 540]], 8));
      for (let x = 584; x < 1080; x += 7) bodyRules.push(dense([[x, 530], [x + 6, 1000]], 8));
      e.ctx.save();
      e.ctx.clip(region(HOOD));
      engraveCurves(e, hoodRules, { width: 2.8 });
      e.ctx.restore();
      e.ctx.save();
      e.ctx.clip(region(BODY));
      engraveCurves(e, bodyRules, { width: 3 });
      e.ctx.restore();
      // the knurled wheel turning
      const knurl: Vec2[][] = [], turn = e.t * (o.act === 'flame' ? 1 : 9);
      for (let k = 0; k < 28; k++) {
        const a = (k / 28) * TAU + turn;
        if (Math.cos(a) < 0) continue;
        knurl.push([[WHEEL[0] - 78, WHEEL[1] + Math.sin(a) * 82], [WHEEL[0] + 78, WHEEL[1] + Math.sin(a) * 82 + 12]]);
      }
      scratchLines(e, knurl, 3, INK, 0.9);
      scratchLines(e, [[...HOOD, HOOD[0]!], [...BODY.slice(0, 2), BODY[2]!]], 3.4, INK, 0.95);
      engraveFinger(e, thumb(e.u), o.seed);
      if (o.act === 'strike') {
        const k = easeOut(e.u), sp: Vec2[][] = [];
        for (const p of sparks) {
          const d = p.v * k, x = WHEEL[0] + 40 + Math.cos(p.a) * d, y = WHEEL[1] - 40 + Math.sin(p.a) * d;
          sp.push([[x, y], [x - Math.cos(p.a) * p.l, y - Math.sin(p.a) * p.l]]);
        }
        e.ctx.save();
        e.ctx.globalCompositeOperation = 'destination-out';
        scratchLines(e, sp, 4, '#000', 1);
        e.ctx.restore();
      }
      if (s > 0) {
        const fl = flame(e.t, s, o.seed);
        erase(e, region(fl));
        scratchLines(e, [catmullRom(fl, 2, true).slice(20, 80)], 1.6, INK, 0.5);
        const inner = flame(e.t + 0.3, s * 0.55, o.seed + 1).map(([x, y]): Vec2 => [x, lerp(y, NOZZLE[1], 0.1)]);
        scratchLines(e, [inner], 1.4, INK, 0.4);
      }
    },
  };
}
