/**
 * Sara: a woman with a cloud of red curls and big round glasses, eyes lowered to the pills on her table, in a dark
 * room. Designed to sit in the top half of the opening split screen (the band y 225..675 of the design box), and to
 * crop in on her curls alone for the red flashes later in the montage.
 */
import { catmullRom } from '../../../core/geometry';
import { TAU, type Vec2 } from '../../../core/math';
import { rng } from '../../../core/random';
import { blob, dense, engraveCurves, erase, FULL, INK, lines, once, PEN, pen, pool, region, scratchLines, shade, shadeLinear, shadeRadial, WARM, type Etch, type Shot } from '../etch';

const smooth = (pts: readonly Vec2[], steps = 6, closed = false): Vec2[] => catmullRom(pts, steps, closed);

const FACE = smooth([[800, 262], [880, 272], [944, 320], [966, 400], [958, 480], [930, 560], [880, 624], [800, 656], [720, 624], [670, 560], [642, 480], [634, 400], [656, 320], [720, 272]], 6, true);
const HAIR = smooth([[800, 150], [930, 160], [1050, 220], [1130, 330], [1150, 460], [1120, 600], [1060, 700], [980, 720], [950, 600], [960, 440], [930, 300], [800, 262], [670, 300], [640, 440], [650, 600], [620, 720], [540, 700], [480, 600], [450, 460], [470, 330], [550, 220], [670, 160]], 6, true);
const LENS: [Vec2, Vec2] = [[712, 408], [890, 408]];
const LR = 84;

const ring = (c: Vec2, rx: number, ry = rx, n = 64): Vec2[] => Array.from({ length: n + 1 }, (_, k): Vec2 => [c[0] + Math.cos((k / n) * TAU) * rx, c[1] + Math.sin((k / n) * TAU) * ry]);

const art = once(() => {
  const r = rng(7900), curls: Vec2[][] = [];
  // ringlets: coiled strands springing out from the scalp and falling, each a loop-the-loop along its path
  for (let i = 0; i < 150; i++) {
    const a = -Math.PI + r() * Math.PI * 2, x0 = 800 + Math.cos(a) * 190, y0 = 430 + Math.sin(a) * 200 - 40;
    const len = 110 + r() * 170, coil = 10 + r() * 9, turns = len / (18 + r() * 8), dir = r() < 0.5 ? 1 : -1, pts: Vec2[] = [];
    for (let s = 0; s <= 1; s += 0.012) {
      const out = a + (Math.sin(a) > 0 ? 0 : 0.35 * Math.sign(Math.cos(a)) * s), ph = dir * s * turns * TAU;
      const cx = x0 + Math.cos(out) * len * s, cy = y0 + Math.sin(out) * len * s + 60 * s * s;
      pts.push([cx + Math.cos(ph) * coil, cy + Math.sin(ph) * coil * 0.8]);
    }
    curls.push(pts);
  }
  return {
    curls,
    face: lines([FACE], PEN, 7910, true),
    features: lines([
      smooth([[680, 380], [720, 366], [764, 376]]), smooth([[838, 376], [880, 366], [922, 380]]),
      smooth([[690, 414], [722, 424], [756, 414]]), smooth([[846, 414], [880, 424], [912, 414]]),
      smooth([[800, 420], [792, 470], [784, 500], [800, 510], [818, 502]]),
      smooth([[748, 566], [776, 560], [800, 564], [826, 560], [852, 566]]), smooth([[760, 580], [800, 590], [842, 580]]),
    ], PEN, 7920),
    brows: lines([smooth([[670, 340], [720, 326], [770, 334]]), smooth([[832, 334], [880, 326], [930, 340]])], { ...PEN, size: 4.2 }, 7930),
    frames: lines([ring(LENS[0], LR, LR * 0.94), ring(LENS[1], LR, LR * 0.94), smooth([[814, 396], [801, 388], [788, 396]]), [[626, 400], [560, 390]], [[976, 400], [1040, 390]]], { ...PEN, size: 4.4, thinning: 0.2 }, 7940),
  };
});

export function saraShot(o: { seed: number; closeup?: boolean }): Shot {
  const nod = (t: number): number => 5 * Math.sin(t * 2.4);
  return {
    view: c => (o.closeup ? { zoom: 3 + 0.2 * c.u, focus: [540, 460] } : { zoom: 1.18 + 0.02 * c.u, focus: [800, 440 + nod(c.t) * 0.2] }),
    tint(e) {
      pool(e, 800, 440, 520, WARM, 0.22);
      e.ctx.save();
      e.ctx.clip(region(HAIR));
      e.ctx.clip(region([[-4000, -4000], [6000, -4000], [6000, 6000], [-4000, 6000]], FACE), 'evenodd');
      pool(e, 800, 430, 520, WARM, 1);
      pool(e, 800, 430, 360, WARM, 0.9);
      e.ctx.restore();
    },
    tone(e: Etch) {
      shade(e, FULL, 0.88);
      shadeRadial(e, 1300, 250, 500, 0.62, 0.88, { min: true });
      // the curls: a dark mass lit on its crown and the right, the face set into it
      const hair = region(HAIR);
      shade(e, hair, 0.55, { form: true });
      shadeRadial(e, 900, 230, 420, 0.22, 0.62, { clip: hair, form: true });
      const face = region(FACE);
      shade(e, face, 0.16, { form: true });
      shadeLinear(e, [640, 0], [960, 0], 0.46, 0.12, { clip: face, max: true, form: true });
      shade(e, region(blob(800, 505, 36, 16, 3, 0.2)), 0.5, { blur: 8, max: true, form: true });
      shade(e, region(blob(800, 606, 50, 14, 4, 0.2)), 0.42, { blur: 10, max: true, form: true });
      // behind the glasses: lowered lids, lashes, the lenses a shade lighter than the room
      for (const c of LENS) shade(e, region(blob(c[0], c[1] + 12, 44, 12, 2, 0.1)), 0.7, { blur: 4, max: true, form: true });
    },
    line(e) {
      const A = art();
      e.ctx.save();
      e.ctx.clip(region(HAIR));
      e.ctx.clip(region([[-4000, -4000], [6000, -4000], [6000, 6000], [-4000, 6000]], FACE), 'evenodd');
      const sweep: Vec2[][] = [];
      for (let k = 0; k < 90; k++) {
        const R = 170 + k * 5;
        sweep.push(dense(ring([800, 460], R * 1.15, R).slice(0, 65), 8));
      }
      engraveCurves(e, sweep, { width: 2.6 });
      scratchLines(e, A.curls, 2.2, INK, 0.85);
      e.ctx.restore();
      e.ctx.save();
      e.ctx.clip(region(FACE));
      const wrap: Vec2[][] = [];
      for (let y = 250; y < 680; y += 7) wrap.push(dense([[600, y + 20], [800, y], [1000, y + 20]], 6));
      engraveCurves(e, wrap, { width: 2.2 });
      e.ctx.restore();
      pen(e, A.face);
      pen(e, A.brows);
      pen(e, A.features);
      const lashes: Vec2[][] = [];
      for (const c of LENS) for (let k = 0; k < 14; k++) {
        const x = c[0] - 32 + k * 5, y = c[1] + 16 - Math.abs(k - 6.5) * 0.9;
        lashes.push([[x, y], [x + (k - 6.5) * 0.8, y + 18]]);
      }
      scratchLines(e, lashes, 1.8, INK, 0.9);
      pen(e, A.frames);
      // reflections on the lenses
      for (const c of LENS) erase(e, region(smooth([[c[0] - 60, c[1] - 58], [c[0] - 20, c[1] - 76], [c[0] - 30, c[1] - 62], [c[0] - 66, c[1] - 36]], 4, true)), 0.9);
    },
  };
}
