/**
 * The mouth, face on and close: opening wide with a pill on the tongue ("ahh"), a grin of teeth, lips closed on a
 * joint, sipping at a glass or a coffee cup, a tongue licking a paper's gummed edge, and smoke let out slowly.
 * Skin and lips are engraved: contour rings ripple out from the lips, the lips' own furrows run across them.
 */
import { catmullRom } from '../../../core/geometry';
import { clamp, lerp, TAU, type Vec2 } from '../../../core/math';
import { noise1, rng } from '../../../core/random';
import { blob, COLD, dense, easeInOut, easeOut, engraveCurves, flood, FULL, INK, pool, pushIn, rectPts, region, scratchLines, shade, shadeLinear, WARM, type Shot } from '../etch';

export type MouthAct = 'ahh' | 'grin' | 'joint' | 'sip' | 'cup' | 'lick' | 'exhale';

interface Lips { upperOuter: Vec2[]; upperInner: Vec2[]; lowerInner: Vec2[]; lowerOuter: Vec2[] }

const X = 800, W = 360;

/** The lips' four edges, left corner to right corner, for an opening `open` and a smile `smile` (both 0..1). */
function lips(open: number, smile: number): Lips {
  const cy = 482 - 34 * smile, w = W + 36 * smile, L: Vec2 = [X - w, cy], R: Vec2 = [X + w, cy];
  const c = (pts: Vec2[]): Vec2[] => catmullRom([L, ...pts, R], 8);
  return {
    upperOuter: c([[X - 250, 438 - 8 * smile], [X - 150, 398], [X - 70, 380], [X, 398], [X + 70, 380], [X + 150, 398], [X + 250, 438 - 8 * smile]]),
    upperInner: c([[X - 220, 476 - 34 * open - 24 * smile], [X, 482 - 66 * open - 6 * smile], [X + 220, 476 - 34 * open - 24 * smile]]),
    lowerInner: c([[X - 220, 488 + 120 * open - 10 * smile], [X, 490 + 176 * open], [X + 220, 488 + 120 * open - 10 * smile]]),
    lowerOuter: c([[X - 240, 540 + 110 * open - 20 * smile], [X - 120, 590 + 156 * open], [X, 600 + 166 * open], [X + 120, 590 + 156 * open], [X + 240, 540 + 110 * open - 20 * smile]]),
  };
}

const rev = (p: readonly Vec2[]): Vec2[] => p.slice().reverse();

export function mouthShot(o: { act: MouthAct; seed: number; fade?: boolean }): Shot {
  const { act } = o;
  /** The closing fade: the plate bitten to black over the shot's second half. */
  const fadeAt = (u: number): number => (o.fade ? clamp((u - 0.35) / 0.55, 0, 1) : 0);
  const openAt = (u: number): number => {
    switch (act) {
      case 'ahh': return lerp(0.3, 1, easeOut(u));
      case 'grin': return 0.3;
      case 'lick': return 0.34;
      case 'exhale': return 0.14 + 0.04 * Math.sin(u * 3);
      case 'sip': case 'cup': return 0.06;
      default: return 0.03;
    }
  };
  const smileAt = (u: number): number => (act === 'grin' ? lerp(0.15, 0.95, easeOut(u)) : act === 'exhale' ? 0.1 : 0);
  const shape = (u: number): Lips => lips(openAt(u), smileAt(u));
  const r = rng(o.seed);
  const smoke = Array.from({ length: 22 }, () => ({ a: -0.3 + r() * 1.3, v: 200 + r() * 500, s: 40 + r() * 80, k: r() }));
  const tongueX = (u: number): number => (act === 'lick' ? lerp(700, 940, easeInOut(u)) : 800);
  /** Licking: a rolling paper held across the lips, the tongue's tip running along its gummed top edge. */
  const PAPER = [[-100, 492], [1700, 500], [1700, 560], [-100, 552]] as Vec2[];
  const TIP = (u: number): Vec2[] => blob(tongueX(u), 470, 150, 62, 9, 0.04, 0.02);
  const joint = (t: number): Vec2[] => { const d = 8 * Math.sin(t * 5); return [[X - 20 + d, 448], [1700 + d, 502], [1700 + d, 592], [X - 20 + d, 532]]; };
  // the cup: rim ellipse under the lips, coffee inside, the white wall in front
  const RIM = { cx: 800, cy: 760, rx: 720, ry: 112 };
  /** The glass's rim: an ellipse whose far side meets the lower lip, tipping up a little as it is drunk from. */
  const glassRim = (t: number): Vec2[] => blob(800, 706 - 20 * Math.min(1, t * 2), 780, 118, 1, 0, 0, 96);
  // smoke is let out in a dark room: the face half lost in shadow so the smoke can show pale against it
  const dark = act === 'exhale' ? 0.56 : 0;
  return {
    view: c => pushIn(c, act === 'ahh' ? 0.08 : 0.05, [800, 500]),
    tint(e) {
      const L = shape(e.u);
      pool(e, 800, 480, 1100, WARM, 0.3);
      flood(e, region([...L.upperOuter, ...rev(L.upperInner)]), WARM, 0.62);
      flood(e, region([...L.lowerInner, ...rev(L.lowerOuter)]), WARM, 0.62);
      if (act === 'ahh') flood(e, region(blob(tongueX(e.u), 560 + 150 * openAt(e.u), 190, 90, 3, 0.05)), WARM, 0.7);
      if (act === 'lick') flood(e, region(TIP(e.u)), WARM, 0.75);
      if (act === 'ahh') flood(e, region(blob(800, 560 + 150 * openAt(e.u) - 30, 64, 40, 4, 0.02)), COLD, 0.85);
      if (act === 'sip') {
        flood(e, region(glassRim(e.t)), COLD, 0.4);
        flood(e, region([...glassRim(e.t).slice(0, 49), [-100, 1000], [1700, 1000]]), COLD, 0.25);
      }
      if (act === 'cup') flood(e, region(blob(RIM.cx, RIM.cy, RIM.rx * 0.96, RIM.ry * 0.9, 1, 0, 0, 96)), WARM, 0.5);
    },
    tone(e) {
      const L = shape(e.u), open = openAt(e.u);
      // skin: the nose's shadow at the top, the philtrum's groove, the fold under the lower lip, dark at the sides
      shade(e, FULL, 0.2 + dark, { form: true });
      shadeLinear(e, [0, 0], [800, 0], 0.5 + dark, 0.2 + dark, { max: true, form: true });
      shadeLinear(e, [1600, 0], [800, 0], 0.55 + dark, 0.2 + dark, { max: true, form: true });
      shade(e, region(blob(680, 90, 90, 50, 2, 0.2), blob(930, 90, 90, 50, 3, 0.2)), 0.95, { blur: 16 });
      shade(e, region([[770, 150], [830, 150], [820, 386], [780, 386]]), 0.42, { blur: 18, max: true, form: true });
      shade(e, region(L.lowerOuter.map(([x, y]): Vec2 => [x, y + 40]).concat(rev(L.lowerOuter.map(([x, y]): Vec2 => [x, y + 110])))), 0.62, { blur: 26, max: true, form: true });
      for (const s of [-1, 1]) shade(e, region(blob(X + s * (W + 60), 486 - 30 * smileAt(e.u), 50, 80, 4 + s, 0.2)), 0.6, { blur: 20, max: true, form: true });
      if (act === 'joint') {
        const j = joint(e.t);
        shade(e, region(j), 0.05);
        shadeLinear(e, [0, 470], [0, 560], 0.02, 0.45, { clip: region(j), max: true });
      }
      // the lips: the upper turned down into shadow, the lower full and lit, a wet highlight
      const upper = region([...L.upperOuter, ...rev(L.upperInner)]), lower = region([...L.lowerInner, ...rev(L.lowerOuter)]);
      shade(e, upper, 0.46, { form: true });
      shade(e, lower, 0.26, { form: true });
      shade(e, region(blob(X - 40, 540 + 150 * open, 110, 18, 5, 0.3)), 0.02, { blur: 10, form: true });
      // inside: black, teeth, tongue, the pill
      if (open > 0.05) {
        const inside = region([...L.upperInner, ...rev(L.lowerInner)]);
        shade(e, inside, 1);
        e.ctx.save();
        e.ctx.clip(inside);
        if (act === 'grin' || act === 'ahh' || act === 'lick') {
          for (let k = -4; k < 4; k++) {
            const x = X + k * 58 + 29, h = 64 - Math.abs(k + 0.5) * 6;
            shade(e, region(blob(x, 470 - 60 * open + h / 2, 26, h / 2, 6 + k, 0.05, 0, 20)), 0.08);
          }
        }
        if (act === 'ahh') {
          const ty = 560 + 150 * open;
          shade(e, region(blob(tongueX(e.u), ty, 190, 90, 3, 0.05)), 0.4, { blur: 3 });
          shade(e, region(blob(tongueX(e.u) - 30, ty - 30, 70, 20, 4, 0.2)), 0.16, { blur: 10 });
        }
        if (act === 'ahh') {
          const ty = 560 + 150 * open - 30;
          shade(e, region(blob(800 + 8, ty + 14, 70, 40, 5, 0.02)), 0.8, { blur: 8, max: true });
          shade(e, region(blob(800, ty, 64, 40, 4, 0.02)), 0.08);
        }
        e.ctx.restore();
      }
      if (act === 'lick') {
        shade(e, region(PAPER), 0.04);
        shadeLinear(e, [0, 492], [0, 560], 0, 0.3, { clip: region(PAPER), max: true });
        shade(e, region(TIP(e.u)), 0.36, { blur: 2 });
        shade(e, region(blob(tongueX(e.u) - 20, 474, 50, 12, 4, 0.2)), 0.06, { blur: 6 });
      }
      if (act === 'sip') {
        // the glass at the lip: water seen through its mouth, the chin softened behind its wall
        const rim = glassRim(e.t), wall = region([...rim.slice(0, 49), [-100, 1000], [1700, 1000]]);
        shadeLinear(e, [0, 700], [0, 1000], 0.12, 0.36, { clip: wall, min: true });
        shadeLinear(e, [0, 600], [0, 820], 0.4, 0.2, { clip: region(rim), min: true, form: true });
      }
      if (act === 'cup') {
        const rim = region(blob(RIM.cx, RIM.cy, RIM.rx, RIM.ry, 1, 0, 0, 96)), coffee = region(blob(RIM.cx, RIM.cy + 6, RIM.rx * 0.95, RIM.ry * 0.86, 1, 0, 0, 96));
        shade(e, region([[RIM.cx - RIM.rx, RIM.cy], [RIM.cx + RIM.rx, RIM.cy], [RIM.cx + RIM.rx, 1000], [RIM.cx - RIM.rx, 1000]]), 0.12);
        shadeLinear(e, [RIM.cx - RIM.rx, 0], [RIM.cx + RIM.rx, 0], 0.5, 0.1, { clip: region(rectPts(0, RIM.cy, 1600, 400)), max: true });
        shade(e, rim, 0.06);
        shade(e, coffee, 0.92);
        shade(e, region(blob(RIM.cx - 200, RIM.cy + 30, 200, 16, 3, 0.2)), 0.4, { blur: 10, min: true });
      }
      if (act === 'exhale') {
        for (const s of smoke) {
          const d = s.v * (0.5 + e.t), x = X + Math.cos(s.a) * d, y = 500 + Math.sin(s.a) * d * 0.5;
          const veil = region(blob(x, y, s.s * (1 + e.t), s.s * 0.7 * (1 + e.t), 5 + s.k * 9, 0.35));
          shade(e, veil, 0.36 + 0.2 * s.k, { blur: 36, min: true });
          shade(e, veil, 0.36 + 0.2 * s.k, { blur: 36, min: true, form: true });
        }
      }
      const fade = fadeAt(e.u);
      if (fade > 0) {
        shade(e, FULL, 0.2 + 0.8 * fade, { max: true });
        shade(e, FULL, 0.2 + 0.8 * fade, { max: true, form: true });
      }
    },
    line(e) {
      const L = shape(e.u), open = openAt(e.u), lipsAll = region([...L.upperOuter, ...rev(L.lowerOuter)]);
      // skin: contour rings rippling out from the lips, crossed in the shadows
      e.ctx.save();
      e.ctx.clip(region([[-4000, -4000], [6000, -4000], [6000, 6000], [-4000, 6000]], [...L.upperOuter, ...rev(L.lowerOuter)]), 'evenodd');
      if (act === 'joint') e.ctx.clip(region([[-4000, -4000], [6000, -4000], [6000, 6000], [-4000, 6000]], joint(e.t)), 'evenodd');
      const rings: Vec2[][] = [];
      const outline = [...L.upperOuter, ...rev(L.lowerOuter)];
      for (let k = 1; k < 90; k++) {
        const g = 1 + k * 0.045;
        rings.push(dense([...outline, outline[0]!].map(([x, y]): Vec2 => [X + (x - X) * g, 490 + (y - 490) * g * 1.25 + 6 * noise1(k * 0.7, o.seed)]), 8));
      }
      engraveCurves(e, rings, { width: 2.6 });
      const cross: Vec2[][] = [];
      for (let k = -40; k < 140; k++) cross.push(dense([[-100, k * 9 - 400], [1700, k * 9 + 100]], 8));
      engraveCurves(e, cross, { width: 2, at: 0.4 });
      e.ctx.restore();
      // the lips: furrows across them, and lines along their curve where they turn into shadow
      e.ctx.save();
      e.ctx.clip(lipsAll);
      const furrows: Vec2[][] = [], along: Vec2[][] = [];
      const pair = (a: Vec2[], b: Vec2[]): void => {
        const n = Math.min(a.length, b.length);
        for (let i = 1; i < n - 1; i += 2) furrows.push(dense([a[i]!, [lerp(a[i]![0], b[i]![0], 0.5) + 3 * noise1(i, o.seed), lerp(a[i]![1], b[i]![1], 0.5)], b[i]!], 5));
        for (let k = 1; k < 10; k++) along.push(dense(a.map((p, i): Vec2 => [lerp(p[0], b[Math.min(i, n - 1)]![0], k / 10), lerp(p[1], b[Math.min(i, n - 1)]![1], k / 10)]), 6));
      };
      pair(L.upperOuter, L.upperInner);
      pair(L.lowerInner, L.lowerOuter);
      engraveCurves(e, furrows, { width: 2.4 });
      engraveCurves(e, along, { width: 2, at: 0.36 });
      e.ctx.restore();
      scratchLines(e, [L.upperOuter, L.lowerOuter], 2.8, INK, 0.9);
      scratchLines(e, [L.upperInner, L.lowerInner], 3.4, INK, 0.95);
      if (act === 'ahh') {
        const ty = 560 + 150 * open - 30, p = blob(800, ty, 64, 40, 4, 0.02);
        scratchLines(e, [[...p, p[0]!], [[746, ty + 8], [854, ty - 8]]], 2.4, INK, 0.9);
      }
      if (act === 'joint') {
        const j = joint(e.t);
        e.ctx.save();
        e.ctx.clip(region([[-4000, -4000], [6000, -4000], [6000, 6000], [-4000, 6000]], [...L.upperOuter, ...rev(L.lowerOuter)]), 'evenodd');
        const twist: Vec2[][] = [];
        for (let x = j[0]![0] + 40; x < 1700; x += 40) twist.push(catmullRom([[x, 450 + (x - 780) * 0.06], [x + 12, 490 + (x - 780) * 0.06], [x + 20, 530 + (x - 780) * 0.06]], 4));
        scratchLines(e, [[j[0]!, j[1]!], [j[3]!, j[2]!], ...twist], 2.4, INK, 0.85);
        e.ctx.restore();
      }
      if (act === 'sip') {
        const rim = glassRim(e.t), inner = rim.map(([x, y]): Vec2 => [800 + (x - 800) * 0.97, 700 + (y - 700) * 0.86 + 6]);
        scratchLines(e, [[...rim, rim[0]!], [...inner, inner[0]!]], 2.6, INK, 0.9);
        e.ctx.save();
        e.ctx.globalCompositeOperation = 'destination-out';
        scratchLines(e, [rim.slice(52, 70), rim.slice(8, 22)], 6, '#000', 0.9);
        e.ctx.restore();
      }
      if (act === 'cup') {
        const rim = blob(RIM.cx, RIM.cy, RIM.rx, RIM.ry, 1, 0, 0, 96), inner = blob(RIM.cx, RIM.cy + 6, RIM.rx * 0.95, RIM.ry * 0.86, 1, 0, 0, 96);
        scratchLines(e, [[...rim, rim[0]!], [...inner, inner[0]!], [[RIM.cx - RIM.rx, RIM.cy], [RIM.cx - RIM.rx + 30, 1000]], [[RIM.cx + RIM.rx, RIM.cy], [RIM.cx + RIM.rx - 30, 1000]]], 3, INK, 0.9);
        const steam: Vec2[][] = [];
        for (let k = 0; k < 5; k++) {
          const pts: Vec2[] = [];
          for (let s = 0; s < 40; s++) pts.push([RIM.cx - 300 + k * 150 + 30 * Math.sin(s * 0.3 + e.t * 4 + k), RIM.cy - s * 12]);
          steam.push(pts);
        }
        e.ctx.save();
        e.ctx.globalCompositeOperation = 'destination-out';
        scratchLines(e, steam, 5, '#000', 0.55);
        e.ctx.restore();
      }
      if (act === 'lick') {
        const tip = TIP(e.u);
        scratchLines(e, [[PAPER[0]!, PAPER[1]!], [PAPER[3]!, PAPER[2]!], [...tip, tip[0]!], [[tongueX(e.u) - 60, 486], [tongueX(e.u) + 50, 488]]], 2.6, INK, 0.9);
      }
      if (act === 'exhale') {
        // the smoke: pale curling threads burnished out of the dark, drifting and unrolling as they go
        const wisps: Vec2[][] = [];
        for (const s of smoke) {
          const pts: Vec2[] = [];
          for (let k = 0; k < 40; k++) {
            const d = s.v * (0.5 + e.t) * (k / 40), a = s.a + 0.5 * Math.sin(k * 0.35 + s.k * TAU + e.t * 2);
            pts.push([X + Math.cos(a) * d + 18 * Math.sin(k * 0.6 + s.k * 9), 500 + Math.sin(a) * d * 0.5 - k * 2]);
          }
          wisps.push(pts);
        }
        e.ctx.save();
        e.ctx.globalCompositeOperation = 'destination-out';
        scratchLines(e, wisps, 7, '#000', 0.35 * (1 - fadeAt(e.u)));
        scratchLines(e, wisps, 2.5, '#000', 0.7 * (1 - fadeAt(e.u)));
        e.ctx.restore();
      }
    },
  };
}
