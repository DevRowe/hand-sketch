/**
 * G17 "Moon Tides" (the moon and the sea; art deco). Gold on black lacquer, whole from the start: a stepped deco
 * frame, a fan of rays, a moon engraved in fine gold lines, and below it a sea of scalloped rows. Over one loop the moon
 * goes through a whole month, new to full to new; the sea's rows breathe up and down with it and slide past each other,
 * stars flash, and a sheen of light travels across all the gold once.
 *
 * All the gold is laid on one layer so the sheen can be run through it alone (source-atop); the terminator is the
 * classic two-arc construction of a lit disc.
 */
import { lerp, TAU, type Vec2 } from '../../core/math';
import { rng } from '../../core/random';
import type { Scene, SceneFrame } from '../../core/scene';
import { composite, fit, ground, knockOut, nf, perSize, phase, polyPath, scratch, still, swell, toothMask, wrap, type Fit } from './common';
import { GALLERY } from './palettes';

const PAL = GALLERY.deco;
const GOLD = PAL.accents[0]!, TEAL = PAL.fills[0]!, DEEP = PAL.fills[1]!;
const W = 1080, H = 1350, LOOP = 192;
const MOON: Vec2 = [540, 500], R = 170, SEA = 930;

const layout = perSize((w, h): { F: Fit } => ({ F: fit(w, h, W, H) }));

/** The lit part of the disc at month phase m (0 new, 0.5 full): a half-disc plus or minus a terminator half-ellipse. */
function litPath(m: number): Path2D {
  const k = Math.cos(TAU * m), limb = m < 0.5 ? 1 : -1, pts: Vec2[] = [];
  // the bright limb: the right half while waxing, the left half while waning, walked clockwise
  const a0 = limb > 0 ? -Math.PI / 2 : Math.PI / 2;
  for (let j = 0; j <= 48; j++) {
    const a = a0 + (j / 48) * Math.PI;
    pts.push([MOON[0] + Math.cos(a) * R, MOON[1] + Math.sin(a) * R]);
  }
  // back along the terminator: bulging towards the limb for a crescent (k > 0), away from it when gibbous
  const side = k > 0 ? limb : -limb, y0 = pts[pts.length - 1]![1] - MOON[1];
  for (let j = 1; j < 48; j++) {
    const y = y0 - (Math.sign(y0) * 2 * R * j) / 48;
    pts.push([MOON[0] + side * R * Math.abs(k) * Math.sqrt(Math.max(0, 1 - (y / R) ** 2)), MOON[1] + y]);
  }
  return polyPath(pts);
}

function gold(g: SceneFrame, p: number, stars: { x: number; y: number; s: number; k: number; o: number }[]): void {
  const c = g.ctx;
  c.strokeStyle = GOLD;
  c.fillStyle = GOLD;
  c.lineJoin = 'miter';
  // stepped frame
  c.lineWidth = 4;
  const step = (inset: number, notch: number): Vec2[] => [
    [inset + notch, inset], [W - inset - notch, inset], [W - inset - notch, inset + notch], [W - inset, inset + notch], [W - inset, H - inset - notch], [W - inset - notch, H - inset - notch],
    [W - inset - notch, H - inset], [inset + notch, H - inset], [inset + notch, H - inset - notch], [inset, H - inset - notch], [inset, inset + notch], [inset + notch, inset + notch],
  ];
  c.stroke(polyPath(step(40, 40)));
  c.lineWidth = 1.6;
  c.stroke(polyPath(step(56, 48)));
  // corner fans
  for (const [cx, cy, a] of [[56, 56, 0], [W - 56, 56, Math.PI / 2], [W - 56, H - 56, Math.PI], [56, H - 56, -Math.PI / 2]] as const) {
    for (let k = 0; k < 5; k++) {
      c.beginPath();
      c.arc(cx, cy, 40 + k * 16, a, a + Math.PI / 2);
      c.stroke();
    }
  }
  // the fan of rays behind the moon, breathing
  c.save();
  const beyond = new Path2D();
  beyond.rect(0, 0, W, H);
  beyond.arc(MOON[0], MOON[1], R + 18, 0, TAU);
  c.clip(beyond, 'evenodd');
  c.lineWidth = 2;
  for (let k = 0; k <= 30; k++) {
    const a = Math.PI + (k / 30) * Math.PI, long = k % 2 === 0, len = (long ? 440 : 330) * (0.94 + 0.06 * swell(p, 2, k * 0.03));
    c.globalAlpha = long ? 0.55 : 0.3;
    c.beginPath();
    c.moveTo(MOON[0] + Math.cos(a) * (R + 30), MOON[1] + Math.sin(a) * (R + 30) + 200);
    c.lineTo(MOON[0] + Math.cos(a) * (R + 30 + len), MOON[1] + Math.sin(a) * (R + 30 + len) + 200);
    c.stroke();
  }
  c.restore();
  c.globalAlpha = 1;
  // the moon: a gold rim, the lit part engraved in horizontal lines, a pale core
  const m = wrap(p, 1);
  c.lineWidth = 3;
  c.beginPath(); c.arc(MOON[0], MOON[1], R, 0, TAU); c.stroke();
  c.beginPath(); c.arc(MOON[0], MOON[1], R + 18, 0, TAU); c.lineWidth = 1.2; c.stroke();
  c.save();
  c.clip(litPath(m));
  c.fillStyle = GOLD;
  c.fillRect(MOON[0] - R, MOON[1] - R, R * 2, R * 2);
  c.strokeStyle = PAL.paper;
  c.lineWidth = 2.2;
  for (let y = MOON[1] - R + 6; y < MOON[1] + R; y += 11) { c.beginPath(); c.moveTo(MOON[0] - R, y); c.lineTo(MOON[0] + R, y); c.stroke(); }
  c.restore();
  // stars: four-point sparkles
  for (const st of stars) {
    const sz = st.s * (0.35 + 0.65 * swell(p, st.k, st.o));
    c.beginPath();
    c.moveTo(st.x, st.y - sz); c.lineTo(st.x + sz * 0.18, st.y - sz * 0.18); c.lineTo(st.x + sz, st.y); c.lineTo(st.x + sz * 0.18, st.y + sz * 0.18);
    c.lineTo(st.x, st.y + sz); c.lineTo(st.x - sz * 0.18, st.y + sz * 0.18); c.lineTo(st.x - sz, st.y); c.lineTo(st.x - sz * 0.18, st.y - sz * 0.18);
    c.closePath();
    c.fill();
  }
}

/** The sea: scalloped rows rising with the full moon, sliding one scallop per loop in turn (whole frames, exact). */
function sea(g: SceneFrame, p: number, n: number): void {
  const c = g.ctx;
  c.strokeStyle = GOLD;
  const tide = 46 * Math.cos(TAU * p);
  for (let row = 0; row < 8; row++) {
    const y = SEA + row * 52 - tide * (1 - row / 10), r = 34 + row * 4, width = r * 2, dir = row % 2 ? 1 : -1;
    const off = wrap((dir * n * width) / LOOP + row * r, width);
    c.lineWidth = 2.4;
    c.fillStyle = row % 2 ? TEAL : DEEP;
    for (let x = -width + off; x < W + width; x += width) {
      c.beginPath();
      c.arc(x, y, r, Math.PI, TAU);
      c.lineTo(x + r, y + 60);
      c.lineTo(x - r, y + 60);
      c.closePath();
      c.fill();
      c.beginPath();
      c.arc(x, y, r, Math.PI, TAU);
      c.stroke();
      c.beginPath();
      c.arc(x, y, r * 0.55, Math.PI, TAU);
      c.lineWidth = 1.2;
      c.stroke();
      c.lineWidth = 2.4;
    }
  }
}

export const moonTidesScene: Scene = {
  name: 'moon-tides',
  duration: LOOP / 12,
  loopFrom: 0,
  poster: 96 / 12,
  draw(f) {
    const { stage } = f;
    const { F } = layout(stage.w, stage.h), p = phase(f), [ox, oy] = F.P(0, 0), s = F.s;
    ground(f, PAL.paper, { seed: 1700, texture: 0.6 });
    // lacquer: long soft vertical sheen and the moon's dark disc in deep teal
    still(f, 'g17-lacquer', g => {
      const c = g.ctx;
      c.translate(ox, oy);
      c.scale(s, s);
      const sheen = c.createLinearGradient(0, 0, W, 0);
      sheen.addColorStop(0, 'rgba(255,255,255,0)');
      sheen.addColorStop(0.35, 'rgba(255,255,255,0.035)');
      sheen.addColorStop(0.5, 'rgba(255,255,255,0.06)');
      sheen.addColorStop(0.65, 'rgba(255,255,255,0.035)');
      sheen.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = sheen;
      c.fillRect(0, 0, W, H);
      c.fillStyle = '#122524';
      c.beginPath(); c.arc(MOON[0], MOON[1], R, 0, TAU); c.fill();
    });
    const r = rng(1710);
    const stars = Array.from({ length: 16 }, () => ({ x: 110 + r() * 860, y: 110 + r() * 560, s: 10 + r() * 16, k: 1 + Math.floor(r() * 3), o: r() }))
      .filter(st => Math.hypot(st.x - MOON[0], st.y - MOON[1]) > R + 60);
    const layer = scratch(f, 'g17-gold', g => {
      g.ctx.translate(ox, oy);
      g.ctx.scale(s, s);
      sea(g, p, Math.round(nf(f)));
      gold(g, p, stars);
      // a sheen travels once across the gold while the moon is dark; it wraps while wholly off the plate (at full moon)
      const c = g.ctx, x = lerp(-700, W + 1400, wrap(p + 0.5, 1));
      c.globalCompositeOperation = 'source-atop';
      const band = c.createLinearGradient(x - 220, 0, x + 220, 160);
      band.addColorStop(0, 'rgba(255,248,220,0)');
      band.addColorStop(0.5, 'rgba(255,248,220,0.6)');
      band.addColorStop(1, 'rgba(255,248,220,0)');
      c.fillStyle = band;
      c.fillRect(-100, -100, W + 200, H + 200);
      c.globalCompositeOperation = 'source-over';
      knockOut(g, c, toothMask(g, { seed: 1720, density: 20, size: 1.2 }), 0.3);
    });
    composite(f, layer);
  },
};
