/**
 * Rolling up: a booklet of papers with a leaf drawn out, herb crumbled from the fingertips onto the paper, the pile
 * on its leaf, the paper rolled round it between the fingers, a dark wrapper leaf peeled away, and the zip bag with
 * its two coloured stripes pressed shut.
 */
import { catmullRom } from '../../../core/geometry';
import { lerp, TAU, type Vec2 } from '../../../core/math';
import { noise1, rng } from '../../../core/random';
import { blob, COLD, dense, easeInOut, easeOut, engraveCurves, erase, flood, FULL, INK, pool, pushIn, rectPts, region, scratchLines, shade, shadeLinear, WARM, type Etch, type Shot } from '../etch';
import { engraveFinger, toneFinger, type Finger } from './hands';

export type HerbAct = 'pack' | 'crumble' | 'pile' | 'roll' | 'peel';

/** Flakes of herb: small torn shapes, dark with a lit edge. */
interface Flake { x: number; y: number; s: number; a: number; v: number }
function flakes(n: number, seed: number, box: readonly [number, number, number, number]): Flake[] {
  const r = rng(seed);
  return Array.from({ length: n }, () => ({ x: box[0] + r() * box[2], y: box[1] + r() * box[3], s: 5 + r() * 16, a: r() * TAU, v: 0.5 + r() }));
}
function toneFlakes(e: Etch, fl: readonly Flake[], at: (f: Flake) => Vec2): void {
  for (const f of fl) {
    const [x, y] = at(f);
    shade(e, region(blob(x, y, f.s, f.s * 0.55, Math.floor(f.a * 100), 0.45, f.a, 9)), 0.82, { max: true });
  }
}

export function herbShot(o: { act: HerbAct; seed: number }): Shot {
  const { act, seed } = o;
  if (act === 'pack') {
    const fingers: Finger[] = [{ tip: [560, 560], angle: -0.2, w: 260, len: 900, nail: 'bare' }];
    const leaf = (u: number): Vec2[] => { const d = 160 * easeInOut(u); return [[700 + d, 250 - d * 0.3], [1260 + d, 250 - d * 0.3], [1260 + d, 330 - d * 0.3], [700 + d, 330 - d * 0.3]]; };
    const book = [[620, 300], [1300, 280], [1320, 700], [640, 720]] as Vec2[];
    return {
      view: c => pushIn(c, 0.05, [900, 480]),
      tint(e) { pool(e, 900, 480, 800, WARM, 0.3); },
      tone(e) {
        shade(e, FULL, 0.93);
        shade(e, region(book), 0.14);
        shadeLinear(e, [620, 0], [1320, 0], 0.1, 0.4, { clip: region(book), max: true });
        shade(e, region(leaf(e.u)), 0.03);
        toneFinger(e, fingers[0]!, 0.3);
      },
      line(e) {
        const print: Vec2[][] = [];
        for (let k = 0; k < 9; k++) print.push(dense([[700, 400 + k * 30], [1000 + 180 * noise1(k, seed), 398 + k * 30]], 8));
        scratchLines(e, print, 3, INK, 0.7);
        scratchLines(e, [[...book, book[0]!], [...leaf(e.u), leaf(e.u)[0]!], [[640, 370], [1305, 350]]], 2.8, INK, 0.9);
        engraveFinger(e, fingers[0]!, seed);
      },
    };
  }
  if (act === 'peel') {
    const sheet = (u: number): Vec2[] => {
      const lift = 0.4 + 0.6 * easeOut(u), top: Vec2[] = [], bottom: Vec2[] = [];
      for (let k = 0; k <= 24; k++) {
        // a tapering leaf, its far end lifting and rolling back as it is peeled
        const x = 160 + k * 50, curlUp = Math.max(0, (k - 10) / 14) ** 2 * 380 * lift, half = 180 * (0.3 + 0.7 * Math.min(1, k / 7) ** 0.6);
        top.push([x - curlUp * 0.2, 480 - half - curlUp + 16 * Math.sin(k * 0.8)]);
        bottom.push([x + curlUp * 0.35, 480 + half - curlUp * 1.5 + 14 * Math.sin(k * 0.7 + 1)]);
      }
      return [...top, ...bottom.reverse()];
    };
    const fingers = (u: number): Finger[] => [{ tip: [1250 - 60 * easeOut(u), 330 - 120 * easeOut(u)], angle: Math.PI + 0.5, w: 250, len: 900, nail: 'bare' }];
    return {
      view: c => pushIn(c, 0.05, [800, 460]),
      tint(e) { flood(e, region(sheet(e.u)), WARM, 0.7); },
      tone(e) {
        shade(e, FULL, 0.96);
        shade(e, region(sheet(e.u)), 0.8, { form: true });
        shadeLinear(e, [160, 0], [1400, 0], 0.88, 0.42, { clip: region(sheet(e.u)), max: false, form: true });
        for (const f of fingers(e.u)) toneFinger(e, f, 0.3);
      },
      line(e) {
        const sh = sheet(e.u), n = (sh.length - 1) / 2, veins: Vec2[][] = [], grain: Vec2[][] = [];
        // the leaf's grain runs along it; lit veins cross it
        for (let j = 1; j < 56; j++) grain.push(dense(Array.from({ length: Math.floor(n) + 1 }, (_, k): Vec2 => { const a = sh[k]!, b = sh[sh.length - 1 - k]!; return [a[0] + (b[0] - a[0]) * (j / 56), a[1] + (b[1] - a[1]) * (j / 56)]; }), 6));
        const across: Vec2[][] = [];
        const L = sh.length, mix = (p: Vec2, q: Vec2, f: number): Vec2 => [lerp(p[0], q[0], f), lerp(p[1], q[1], f)];
        for (let k = 0; k < Math.floor(n) - 1; k += 0.25) {
          const i = Math.floor(k), f = k - i;
          across.push(dense([mix(sh[i]!, sh[i + 1]!, f), mix(sh[L - 1 - i]!, sh[L - 2 - i]!, f)], 6));
        }
        for (let k = 2; k < n; k += 3) veins.push([sh[k]!, sh[sh.length - 1 - k]!]);
        e.ctx.save();
        e.ctx.clip(region(sh));
        engraveCurves(e, grain, { width: 3.4 });
        engraveCurves(e, across, { width: 2.4, at: 0.55 });
        e.ctx.restore();
        scratchLines(e, [[...sh, sh[0]!]], 2.6, INK, 0.9);
        e.ctx.save();
        e.ctx.globalCompositeOperation = 'destination-out';
        scratchLines(e, veins, 2, '#000', 0.6);
        e.ctx.restore();
        for (const f of fingers(e.u)) engraveFinger(e, f, seed);
      },
    };
  }
  if (act === 'roll') {
    const turn = (t: number): number => t * 4;
    const fingers: Finger[] = [
      { tip: [520, 380], angle: 0.35, w: 250, len: 900, nail: 'bare' },
      { tip: [1080, 380], angle: Math.PI - 0.35, w: 250, len: 900, nail: 'bare' },
      { tip: [560, 610], angle: -0.3, w: 270, len: 900, nail: 'bare' },
      { tip: [1040, 610], angle: Math.PI + 0.3, w: 270, len: 900, nail: 'bare' },
    ];
    const tube = rectPts(360, 440, 880, 110);
    const fl = flakes(60, seed, [1180, 450, 120, 90]);
    return {
      view: c => pushIn(c, 0.05, [800, 490]),
      tint(e) { pool(e, 800, 490, 900, WARM, 0.35); },
      tone(e) {
        shade(e, FULL, 0.93);
        shade(e, region(tube), 0.08, { form: true });
        shadeLinear(e, [0, 440], [0, 550], 0.04, 0.55, { clip: region(tube), max: true, form: true });
        shade(e, region(blob(1240, 495, 22, 54, 3, 0.1)), 0.9);
        toneFlakes(e, fl, f => [f.x, f.y]);
        for (const f of fingers) toneFinger(e, f, 0.3);
      },
      line(e) {
        const lap: Vec2[][] = [];
        for (let x = 380; x < 1230; x += 36) {
          const ph = (x / 36 + turn(e.t)) % 1;
          lap.push([[x + ph * 30, 440], [x + ph * 30 + 10, 550]]);
        }
        e.ctx.save();
        e.ctx.clip(region(tube));
        engraveCurves(e, Array.from({ length: 16 }, (_, k) => dense([[360, 442 + k * 7], [1240, 442 + k * 7]], 8)), { width: 2.4 });
        scratchLines(e, lap, 1.2, INK, 0.5);
        e.ctx.restore();
        scratchLines(e, [[[360, 440], [1240, 440]], [[360, 550], [1240, 550]], catmullRom([[1240, 440], [1262, 495], [1240, 550]], 6)], 2.8, INK, 0.9);
        fingers.forEach((f, k) => engraveFinger(e, f, seed + k));
      },
    };
  }
  // crumble and pile: flakes falling from the fingertips onto a paper leaf, and the heap they make
  const paper = [[160, 610], [1480, 560], [1540, 1000], [100, 1000]] as Vec2[];
  const heap = (u: number): Vec2[] => blob(800, 640, 300 + 60 * u, 90 + 20 * u, seed, 0.18);
  const falling = flakes(80, seed + 1, [600, -200, 400, 800]);
  const lying = flakes(260, seed + 2, [480, 560, 640, 170]);
  const pinch: Finger[] = [
    { tip: [740, 300], angle: Math.PI / 2 + 0.35, w: 300, len: 900, nail: 'bare' },
    { tip: [880, 312], angle: Math.PI / 2 - 0.35, w: 290, len: 900, nail: 'bare' },
  ];
  const fall = (f: Flake, t: number): Vec2 => [f.x + 30 * Math.sin(f.a + t * 3), 330 + ((f.y + 200 + 420 * f.v * t) % 300)];
  return {
    view: c => pushIn(c, act === 'pile' ? 0.08 : 0.04, [800, act === 'pile' ? 620 : 450]),
    tint(e) {
      pool(e, 800, 640, 700, WARM, 0.45);
      pool(e, 800, 640, 360, COLD, 0.25);
    },
    tone(e) {
      shade(e, FULL, 0.94);
      shade(e, region(paper), 0.08);
      shadeLinear(e, [0, 560], [0, 1000], 0.04, 0.3, { clip: region(paper), max: true });
      shade(e, region(heap(e.u).map(([x, y]): Vec2 => [x + 20, y + 30])), 0.7, { blur: 20, max: true });
      shade(e, region(heap(e.u)), 0.5, { blur: 6 });
      toneFlakes(e, lying, f => [f.x, f.y]);
      if (act === 'crumble') {
        toneFlakes(e, falling, f => fall(f, e.t));
        for (const f of pinch) toneFinger(e, f, 0.3);
      }
    },
    line(e) {
      scratchLines(e, [[...paper, paper[0]!]], 2.6, INK, 0.9);
      const crumbs = new Path2D();
      const r = rng(seed + 3);
      for (let i = 0; i < 300; i++) {
        const a = r() * TAU, d = Math.sqrt(r()), x = 800 + Math.cos(a) * 330 * d, y = 640 + Math.sin(a) * 100 * d, s = 1 + r() * 2.5;
        crumbs.moveTo(x + s, y);
        crumbs.arc(x, y, s, 0, TAU);
      }
      erase(e, crumbs, 0.8);
      const stems: Vec2[][] = [];
      for (let i = 0; i < 40; i++) {
        const x = 560 + r() * 480, y = 600 + r() * 90, a = r() * TAU, l = 20 + r() * 30;
        stems.push([[x, y], [x + Math.cos(a) * l, y + Math.sin(a) * l * 0.4]]);
      }
      scratchLines(e, stems, 2.2, INK, 0.85);
      if (act === 'crumble') pinch.forEach((f, k) => engraveFinger(e, f, seed + k));
    },
  };
}

export function baggieShot(o: { seed: number }): Shot {
  const A = -0.18, rot = ([x, y]: Vec2): Vec2 => [800 + (x - 800) * Math.cos(A) - (y - 450) * Math.sin(A), 450 + (x - 800) * Math.sin(A) + (y - 450) * Math.cos(A)];
  const stripe = (y0: number, h: number): Vec2[] => rectPts(-300, y0, 2200, h).map(rot);
  const press = (u: number): number => lerp(1300, 380, easeInOut(u));
  const finger = (u: number): Finger => ({ tip: rot([press(u), 440]), angle: -Math.PI / 2 - 0.25, w: 280, len: 900, nail: 'bare' });
  const r = rng(o.seed), crinkles = Array.from({ length: 22 }, () => {
    const x = r() * 1600, y = r() * 900, a = r() * TAU, l = 120 + r() * 260, bend = (r() - 0.5) * 0.8;
    return catmullRom([[x, y], [x + Math.cos(a) * l * 0.5, y + Math.sin(a) * l * 0.5], [x + Math.cos(a + bend) * l, y + Math.sin(a + bend) * l]], 8);
  });
  return {
    view: c => pushIn(c, 0.05),
    tint(e) {
      flood(e, region(stripe(380, 26)), WARM, 0.85);
      flood(e, region(stripe(470, 26)), COLD, 0.85);
    },
    tone(e) {
      shade(e, FULL, 0.62);
      shadeLinear(e, [0, 0], [1600, 900], 0.5, 0.8, { max: true });
      // the zip's ridges, the stripes, the plastic's creases catching light
      shade(e, region(stripe(410, 50)), 0.25);
      shade(e, region(stripe(428, 12)), 0.85, { blur: 3 });
      shade(e, region(stripe(380, 26)), 0.35);
      shade(e, region(stripe(470, 26)), 0.35);
      for (const c of crinkles) shade(e, region([...c, ...c.slice().reverse().map(([x, y]): Vec2 => [x + 14, y + 22])]), 0.9, { blur: 10, max: true });
      toneFinger(e, finger(e.u), 0.3);
    },
    line(e) {
      scratchLines(e, [stripe(380, 26), stripe(470, 26), stripe(410, 50)].flatMap(p => [[p[0]!, p[1]!], [p[3]!, p[2]!]]), 2.4, INK, 0.9);
      e.ctx.save();
      e.ctx.globalCompositeOperation = 'destination-out';
      scratchLines(e, crinkles, 4, '#000', 0.8);
      e.ctx.restore();
      engraveFinger(e, finger(e.u), o.seed);
    },
  };
}
