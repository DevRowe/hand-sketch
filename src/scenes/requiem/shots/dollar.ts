/**
 * The note: a founding father's portrait engraved the way a banknote is, and the camera pushing in on his eye.
 * An original portrait in the manner of currency engraving, not a copy of any note: burin curves wrap the face and
 * swell in its shadows, the oval ground behind him is close-ruled almost to black, lathe-work rings the oval, and the
 * powdered hair rolls into curls over the ear. Everything is form tone, so no page hatching crosses the engraving.
 */
import { catmullRom } from '../../../core/geometry';
import { lerp, TAU, type Vec2 } from '../../../core/math';
import { noise1, rng } from '../../../core/random';
import { blob, BOLD, COLD, dense, easeOut, engraveCurves, FINE, FULL, INK, lines, once, PEN, pen, pool, region, scratchLines, shade, shadeLinear, shadeRadial, type Etch, type Shot } from '../etch';

const smooth = (pts: readonly Vec2[], steps = 6): Vec2[] => catmullRom(pts, steps);

const PROFILE = smooth([[692, 170], [655, 196], [634, 236], [626, 276], [622, 302], [628, 320], [620, 340], [606, 372], [594, 404], [582, 436], [590, 450], [606, 456], [610, 470], [604, 486], [607, 500], [613, 516], [616, 532], [612, 560], [616, 590], [632, 612]]);
const JAW = smooth([[632, 612], [668, 636], [720, 652], [790, 646], [850, 618], [892, 570], [906, 520]]);
const HAIRLINE = smooth([[692, 170], [740, 176], [800, 196], [850, 236], [880, 290], [896, 350], [906, 420], [906, 520]]);
const HAIR = smooth([[692, 170], [700, 140], [760, 118], [850, 118], [940, 146], [1010, 196], [1050, 262], [1066, 338], [1060, 420], [1044, 490], [1020, 540], [980, 580], [930, 600], [906, 520]]);
const NECK: Vec2[] = [[700, 640], [706, 730], [890, 730], [880, 600]];
const JABOT = smooth([[660, 700], [720, 690], [800, 706], [880, 690], [930, 720], [900, 800], [800, 836], [700, 812], [660, 700]]);
const COAT = smooth([[380, 960], [470, 790], [600, 722], [680, 705], [706, 770], [800, 846], [916, 772], [940, 716], [1040, 740], [1160, 810], [1230, 960]]);
const EYE_UP = smooth([[694, 332], [712, 318], [736, 314], [758, 322], [768, 332]]);
const EYE_LO = smooth([[694, 332], [716, 342], [742, 344], [768, 332]]);
const IRIS: Vec2 = [722, 330];
const CURLS: Vec2[] = [[985, 420], [992, 492]];
const OVAL: Vec2 = [800, 450];
const OR = [380, 440] as const;

const face = [...PROFILE, ...JAW, ...HAIRLINE.slice().reverse()];
const hair = [...HAIR, ...HAIRLINE.slice().reverse()];
const oval = (k = 1): Vec2[] => blob(OVAL[0], OVAL[1], OR[0] * k, OR[1] * k, 1, 0, 0, 120);

/** A scrolled curl: a spiral rolled from its outer edge in towards its core. */
function curl([cx, cy]: Vec2, rx: number, ry: number): Vec2[] {
  const out: Vec2[] = [];
  for (let a = 0; a < TAU * 1.7; a += 0.12) {
    const k = 1 - a / (TAU * 2.1);
    out.push([cx + Math.cos(a + Math.PI) * rx * k, cy + Math.sin(a + Math.PI) * ry * k]);
  }
  return out;
}

const art = once(() => {
  const r = rng(7700), strands: Vec2[][] = [];
  for (let i = 0; i < 160; i++) {
    const a = -2.9 + r() * 2.6, d0 = 40 + r() * 60, d1 = d0 + 90 + r() * 110, cx = 860, cy = 360;
    strands.push(smooth([[cx + Math.cos(a) * d0, cy + Math.sin(a) * d0 * 0.9], [cx + Math.cos(a + 0.15) * (d0 + d1) / 2, cy + Math.sin(a + 0.15) * (d0 + d1) / 2 * 0.9], [cx + Math.cos(a + 0.35) * d1, cy + Math.sin(a + 0.35) * d1 * 0.9]], 5));
  }
  return {
    bold: lines([HAIR, COAT], BOLD, 7710),
    pen: lines([PROFILE, JAW, EYE_UP, EYE_LO, smooth([[654, 338], [650, 380], [640, 420], [628, 444]]), smooth([[612, 452], [628, 440], [646, 446], [650, 458], [636, 466]]),
      smooth([[606, 494], [640, 492], [676, 498], [690, 504]]), smooth([[688, 300], [720, 288], [760, 292], [780, 302]]), JABOT, ...CURLS.map(c => curl(c, 64, 32))], PEN, 7730),
    fine: lines([smooth([[700, 316], [730, 300], [764, 310]]), smooth([[632, 330], [642, 324], [654, 326]]), smooth([[626, 300], [646, 294], [660, 298]]),
      smooth([[650, 462], [660, 490], [664, 520]]), smooth([[610, 478], [640, 474], [670, 484]]), smooth([[614, 512], [650, 516], [680, 510]]), smooth([[616, 540], [640, 544], [660, 540]]), HAIRLINE], FINE, 7760),
    strands,
  };
});

/** Clip to `inside` minus every `holes` polygon. */
function clipTo(e: Etch, inside: readonly Vec2[], ...holes: (readonly Vec2[])[]): void {
  e.ctx.clip(region(inside));
  if (holes.length) e.ctx.clip(region([[-4000, -4000], [6000, -4000], [6000, 6000], [-4000, 6000]], ...holes), 'evenodd');
}

export function dollarShot(o: { seed: number }): Shot {
  const zoom = (u: number, heat: number): number => 1 + 0.55 * easeOut(u) * (1 + 0.6 * heat);
  return {
    view: c => ({ zoom: zoom(c.u, c.heat), focus: [lerp(800, 730, easeOut(c.u)), lerp(450, 340, easeOut(c.u))] }),
    tint(e) {
      pool(e, 800, 450, 1300, COLD, 0.5);
    },
    tone(e) {
      shade(e, FULL, 0.24, { form: true });
      shade(e, region(oval()), 0.8, { form: true });
      // the face, lit from the left: the shadow side turns towards the ear
      shade(e, region(face), 0.14, { form: true });
      shadeLinear(e, [760, 0], [910, 0], 0.14, 0.56, { clip: region(face), max: true, form: true });
      for (const [x, y, rx, ry, d] of [[735, 322, 64, 30, 0.46], [622, 464, 36, 16, 0.52], [640, 528, 46, 16, 0.42], [612, 330, 26, 40, 0.4], [760, 632, 140, 40, 0.5]] as const) {
        shade(e, region(blob(x, y, rx, ry, 3, 0.1)), d, { blur: 12, max: true, form: true });
      }
      shade(e, region(NECK), 0.6, { form: true });
      // powdered hair, dark only under its rolls and at the back
      shade(e, region(hair), 0.2, { form: true });
      shadeRadial(e, 1080, 440, 300, 0.62, 0.2, { clip: region(hair), max: true, form: true });
      shadeRadial(e, 780, 170, 160, 0.04, 0.2, { clip: region(hair), min: true, form: true });
      for (const c of CURLS) shade(e, region(blob(c[0], c[1] + 20, 64, 16, 5, 0.1)), 0.6, { blur: 8, max: true, form: true });
      shade(e, region([...COAT, [1230, 1000], [380, 1000]]), 0.9, { form: true });
      shade(e, region(JABOT), 0.08, { form: true });
      // the eye
      shade(e, region([...EYE_UP, ...EYE_LO.slice().reverse()]), 0.2, { form: true });
      shade(e, region(blob(IRIS[0], IRIS[1], 8, 8, 4, 0.02)), 0.95);
    },
    line(e) {
      const A = art(), body = [face, hair, NECK, JABOT, [...COAT, [1230, 1000], [380, 1000]] as Vec2[]];
      // the ruled ground inside the oval, crossed where it deepens
      e.ctx.save();
      clipTo(e, oval(), ...body);
      const rules: Vec2[][] = [], cross: Vec2[][] = [];
      for (let y = -20; y < 920; y += 6) rules.push(dense([[380, y], [1220, y]], 8));
      for (let k = -60; k < 160; k++) cross.push(dense([[380, k * 9], [1220, k * 9 + 300]], 8));
      engraveCurves(e, rules, { width: 3.2 });
      engraveCurves(e, cross, { width: 2.2, at: 0.6 });
      e.ctx.restore();
      // lathe-work round the oval: wavy rings interlaced
      e.ctx.save();
      clipTo(e, [[-4000, -4000], [6000, -4000], [6000, 6000], [-4000, 6000]], oval(), [...COAT, [1230, 1000], [380, 1000]]);
      const lathe: Vec2[][] = [];
      for (let k = 0; k < 40; k++) {
        const pts: Vec2[] = [];
        for (let j = 0; j <= 360; j++) {
          const a = (j / 360) * TAU, w = 1.03 + k * 0.022 + 0.012 * Math.sin(a * 36 + k * 0.7) + 0.008 * Math.sin(a * 11 - k);
          pts.push([OVAL[0] + Math.cos(a) * OR[0] * w, OVAL[1] + Math.sin(a) * OR[1] * w]);
        }
        lathe.push(pts);
      }
      engraveCurves(e, lathe, { width: 1.8 });
      e.ctx.restore();
      const ticks: Vec2[][] = [];
      for (let j = 0; j < 220; j++) {
        const a = (j / 220) * TAU;
        ticks.push([[OVAL[0] + Math.cos(a) * OR[0] * 1.0, OVAL[1] + Math.sin(a) * OR[1] * 1.0], [OVAL[0] + Math.cos(a) * OR[0] * 1.022, OVAL[1] + Math.sin(a) * OR[1] * 1.022]]);
      }
      scratchLines(e, [...ticks, oval(0.995), oval(1.03)], 1.4, INK, 0.9);
      // burin curves wrapping the head, crossed in its shadows
      e.ctx.save();
      clipTo(e, face);
      const wrap: Vec2[][] = [], diag: Vec2[][] = [];
      for (let y = 150; y < 700; y += 7) {
        const pts: Vec2[] = [];
        for (let x = 560; x <= 930; x += 6) pts.push([x, y + 34 * ((x - 740) / 190) ** 2 + 3 * noise1(x / 60 + y, o.seed)]);
        wrap.push(pts);
      }
      for (let k = -40; k < 80; k++) diag.push(dense([[540, k * 9], [960, k * 9 + 260]], 7));
      engraveCurves(e, wrap, { width: 2.4 });
      engraveCurves(e, diag, { width: 1.8, at: 0.36 });
      e.ctx.restore();
      e.ctx.save();
      clipTo(e, NECK);
      engraveCurves(e, wrap.map(p => p.map(([x, y]): Vec2 => [x, y + 3])), { width: 2.6 });
      e.ctx.restore();
      // hair: arcs sweeping back round the crown
      e.ctx.save();
      clipTo(e, hair);
      const sweep: Vec2[][] = [];
      for (let R = 80; R < 320; R += 7) {
        const pts: Vec2[] = [];
        for (let a = -3.3; a <= 0.9; a += 0.03) pts.push([880 + Math.cos(a) * R * 1.05, 380 + Math.sin(a) * R * 0.95]);
        sweep.push(pts);
      }
      engraveCurves(e, sweep, { width: 2 });
      e.ctx.restore();
      e.ctx.save();
      clipTo(e, hair);
      scratchLines(e, A.strands, 1.4, INK, 0.7);
      e.ctx.restore();
      // the coat: folds following the shoulders
      e.ctx.save();
      clipTo(e, [...COAT, [1230, 1000], [380, 1000]], JABOT);
      const folds: Vec2[][] = [];
      for (let k = 0; k < 44; k++) folds.push(dense(COAT.map(([x, y]): Vec2 => [x, y + k * 7]), 7));
      engraveCurves(e, folds, { width: 3.2 });
      e.ctx.restore();
      pen(e, A.fine);
      pen(e, A.pen);
      pen(e, A.bold);
    },
  };
}
