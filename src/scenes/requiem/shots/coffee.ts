/**
 * Sara's other ritual, coffee: the white cup from above with a spoon turning in it, the grounds in their heap, the
 * glass carafe's curve, and coffee running into it under its steam. Plus the black plate the montage cuts to.
 */
import { catmullRom } from '../../../core/geometry';
import { TAU, type Vec2 } from '../../../core/math';
import { rng } from '../../../core/random';
import { blob, dense, engraveCurves, erase, flood, FULL, INK, pool, pushIn, region, scratchLines, shade, shadeLinear, shadeRadial, WARM, type Shot } from '../etch';

export type CoffeeAct = 'cup' | 'grounds' | 'carafe' | 'pour';

const ellipse = (cx: number, cy: number, rx: number, ry: number, n = 72): Vec2[] => Array.from({ length: n }, (_, k): Vec2 => [cx + Math.cos((k / n) * TAU) * rx, cy + Math.sin((k / n) * TAU) * ry]);

export function coffeeShot(o: { act: CoffeeAct; seed: number }): Shot {
  const r = rng(o.seed);
  if (o.act === 'cup') {
    const spoon = (t: number): Vec2 => [800 + Math.cos(t * 3) * 130, 470 + Math.sin(t * 3) * 50];
    return {
      view: c => pushIn(c, 0.05, [800, 470]),
      tint(e) { flood(e, region(ellipse(800, 480, 420, 170)), WARM, 0.55); },
      tone(e) {
        shade(e, FULL, 0.95);
        const outer = region([...ellipse(800, 440, 520, 220)]), body = region([...ellipse(800, 440, 520, 220).slice(0, 37), [300, 1000], [1300, 1000]]);
        shade(e, body, 0.1, { form: true });
        shadeLinear(e, [280, 0], [1320, 0], 0.5, 0.06, { clip: body, max: true, form: true });
        shade(e, outer, 0.06);
        shade(e, region(ellipse(800, 480, 440, 176)), 0.35);
        shade(e, region(ellipse(800, 488, 420, 164)), 0.93);
        shade(e, region(blob(700, 440, 160, 20, 3, 0.3)), 0.4, { blur: 12, min: true });
        const [sx, sy] = spoon(e.t);
        shade(e, region([[sx - 14, sy], [sx + 14, sy], [sx + 30, -100], [sx + 2, -100]]), 0.15);
      },
      line(e) {
        e.ctx.save();
        e.ctx.clip(region([...ellipse(800, 440, 520, 220).slice(0, 37), [300, 1000], [1300, 1000]]));
        engraveCurves(e, Array.from({ length: 70 }, (_, k) => dense([[280 + k * 15, 440], [300 + k * 15 * 0.96, 1000]], 8)), { width: 3 });
        e.ctx.restore();
        const [sx, sy] = spoon(e.t);
        scratchLines(e, [ellipse(800, 440, 520, 220).concat([[1320, 440]]), ellipse(800, 488, 420, 164).concat([[1220, 488]]), [[sx - 14, sy], [sx + 2, -100]], [[sx + 14, sy], [sx + 30, -100]]], 3, INK, 0.9);
        const swirl: Vec2[][] = [];
        for (let k = 0; k < 5; k++) swirl.push(ellipse(800, 488, 340 - k * 60, 130 - k * 24, 60).slice(0, 40).map(([x, y]): Vec2 => [x + 20 * Math.sin(e.t * 3 + k), y]));
        e.ctx.save();
        e.ctx.globalCompositeOperation = 'destination-out';
        scratchLines(e, swirl, 3, '#000', 0.4);
        e.ctx.restore();
      },
    };
  }
  if (o.act === 'grounds') {
    const grains = Array.from({ length: 1400 }, () => { const a = r() * TAU, d = Math.sqrt(r()); return [800 + Math.cos(a) * 900 * d, 560 + Math.sin(a) * 420 * d - 200 * (1 - d), 3 + r() * 7, r()] as const; });
    return {
      view: c => ({ zoom: 1.02 + 0.08 * c.u, focus: [800, 470] }),
      tint(e) { pool(e, 800, 500, 1100, WARM, 0.75); },
      tone(e) {
        shade(e, FULL, 0.9);
        shadeRadial(e, 800, 300, 700, 0.5, 0.92, { min: true, sy: 0.6 });
        for (const [x, y, s, k] of grains) if (k < 0.4) shade(e, region(blob(x, y, s * 1.4, s, Math.floor(k * 1000), 0.3, k * 6, 8)), 0.98, { max: true });
      },
      line(e) {
        const p = new Path2D();
        for (const [x, y, s, k] of grains) if (k > 0.55) { const ss = s * 0.45; p.moveTo(x + ss, y - s * 0.3); p.arc(x, y - s * 0.3, ss, 0, TAU); }
        erase(e, p, 0.75);
      },
    };
  }
  if (o.act === 'carafe') {
    const curve = (k: number): Vec2[] => catmullRom([[300 + k, -100], [420 + k, 200], [560 + k * 1.2, 500], [900 + k * 1.3, 760], [1700, 900 + k * 0.3]], 10);
    return {
      view: c => pushIn(c, 0.06, [800, 450]),
      tint(e) { pool(e, 1100, 700, 600, WARM, 0.6); },
      tone(e) {
        shade(e, FULL, 0.95);
        const inside = region([...curve(0), [1700, 1100], [1700, -100]]);
        shade(e, inside, 0.86);
        shade(e, region([...curve(0), ...curve(30).reverse()]), 0.2, { blur: 6 });
        shade(e, region([...curve(90), ...curve(110).reverse()]), 0.35, { blur: 10, min: true });
      },
      line(e) {
        const specks = new Path2D();
        for (let i = 0; i < 160; i++) { const x = 500 + r() * 1100, y = r() * 900, s = 1 + r() * 3; specks.moveTo(x + s, y); specks.arc(x, y, s, 0, TAU); }
        erase(e, specks, 0.8);
        e.ctx.save();
        e.ctx.globalCompositeOperation = 'destination-out';
        scratchLines(e, [curve(8), curve(14)], 4, '#000', 0.9);
        e.ctx.restore();
        scratchLines(e, [curve(0), curve(30)], 2.6, INK, 0.9);
      },
    };
  }
  // pour: a thread of coffee falling into the dark, steam lifting past it
  const wisps = Array.from({ length: 8 }, () => ({ x: 500 + r() * 600, ph: r() * TAU, w: 30 + r() * 50 }));
  return {
    view: c => pushIn(c, 0.04),
    tint(e) { pool(e, 800, 600, 500, WARM, 0.6); },
    tone(e) {
      shade(e, FULL, 0.96);
      shadeRadial(e, 800, 700, 600, 0.6, 0.96, { min: true, sy: 0.5 });
      const x = 800 + 6 * Math.sin(e.t * 9);
      shade(e, region([[x - 16, -100], [x + 16, -100], [x + 10, 760], [x - 10, 760]]), 0.4);
      shade(e, region(ellipse(800, 770, 340, 60)), 0.5, { blur: 10 });
    },
    line(e) {
      const steam: Vec2[][] = wisps.map(w => {
        const pts: Vec2[] = [];
        for (let k = 0; k < 40; k++) pts.push([w.x + w.w * Math.sin(k * 0.25 + w.ph + e.t * 3), 740 - k * 18 - e.t * 60]);
        return pts;
      });
      e.ctx.save();
      e.ctx.globalCompositeOperation = 'destination-out';
      scratchLines(e, steam, 5, '#000', 0.45);
      e.ctx.restore();
      const x = 800 + 6 * Math.sin(e.t * 9);
      scratchLines(e, [[[x - 16, -100], [x - 10, 760]], [[x + 16, -100], [x + 10, 760]]], 2, INK, 0.8);
    },
  };
}

/** The plate bitten all over: black, the faint wiping marks of the printer's hand the only thing in it. */
export function blackShot(): Shot {
  return {
    tone(e) {
      shade(e, FULL, 0.94);
      shadeRadial(e, 800, 450, 900, 0.9, 1, {});
    },
  };
}
