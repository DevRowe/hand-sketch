/**
 * G08 "Sea Chart" (maps and journeys; sepia cartography). An old chart on foxed vellum inks itself in: the border
 * and its degree scale, coastlines with their ripple lines, the compass rose and its rhumb lines, a sea serpent, a
 * cartouche. A small ship has already cast off and sails its voyage around the islands; the dotted route is the wake
 * it leaves, fading behind it. The loop is one whole voyage, the serpent's coils rising and sinking twice.
 *
 * The chart is drawn on with one hand's schedule; the wake's dashes are fixed to the route (so they never crawl), and
 * only those within the last stretch behind the ship are shown.
 */
import { squiggle } from '../../art/glyphs';
import { catmullRom } from '../../core/geometry';
import { drawGroup, scheduleWithin, type Slot, type StrokeGroup } from '../../core/ink';
import { clamp, TAU, type Vec2 } from '../../core/math';
import { noise2, rng } from '../../core/random';
import type { Scene } from '../../core/scene';
import { drawStroke, drawStrokeRange, prepareStroke, sampleStroke, type PreparedStroke, type StrokeStyle } from '../../core/stroke';
import { circle, fit, ground, group, nf, perSize, polyPath, sec, still, wave, wrap, type Fit } from './common';
import { GALLERY } from './palettes';

const PAL = GALLERY.chart;
const SEPIA = PAL.ink, RED = PAL.accents[0]!, LAND = PAL.fills[1]!;
const W = 1920, H = 1080;
const LOOP = 144, SAIL = 12, LOOP_FROM = 60, WAKE = 0.3;
const PEN: StrokeStyle = { color: SEPIA, size: 2.4, thinning: 0.5, smoothing: 0.5, wobble: 0.9, wobbleWavelength: 150, tremor: 0.3, pressureVariation: 0.55, dryBrush: 0.15, paper: PAL.paper, taperStart: 8, taperEnd: 12 };
const FINE: StrokeStyle = { ...PEN, size: 1.3, alpha: 0.75, dryBrush: 0 };

const ISLANDS = [
  { c: [560, 430] as Vec2, R: 220, seed: 81 },
  { c: [1370, 330] as Vec2, R: 150, seed: 82 },
  { c: [1210, 770] as Vec2, R: 92, seed: 83 },
  { c: [1620, 190] as Vec2, R: 46, seed: 84 },
  { c: [1730, 270] as Vec2, R: 30, seed: 85 },
];
const coast = (c: Vec2, R: number, seed: number, grow = 0): Vec2[] => Array.from({ length: 96 }, (_, k): Vec2 => {
  const a = (k / 96) * TAU, r = R * (1 + 0.28 * noise2(Math.cos(a) * 1.3 + 4, Math.sin(a) * 1.3 + 4, seed) + 0.1 * noise2(Math.cos(a) * 4 + 9, Math.sin(a) * 4, seed + 1)) + grow;
  return [c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r * 0.82];
});

const ROSE: Vec2 = [300, 800];
const ROUTE: Vec2[] = [[250, 560], [400, 180], [860, 200], [1100, 520], [1620, 560], [1690, 860], [1010, 930], [640, 700]];
const SERPENT: Vec2 = [1080, 180];

interface Layout {
  F: Fit;
  chart: StrokeGroup; chartSlots: Slot[];
  ripples: StrokeGroup; rippleSlots: Slot[];
  rose: StrokeGroup; roseSlots: Slot[];
  marks: StrokeGroup; markSlots: Slot[];
  route: PreparedStroke;
  ship: PreparedStroke[];
  lands: Vec2[][];
}

const layout = perSize((w, h): Layout => {
  const F = fit(w, h, W, H), r = rng(808);
  const lands = ISLANDS.map(i => coast(i.c, i.R, i.seed));
  const closed = (pts: Vec2[]) => [...pts, pts[0]!];
  // border with its degree scale
  const border: Vec2[][] = [
    closed([[40, 40], [W - 40, 40], [W - 40, H - 40], [40, H - 40]]),
    closed([[58, 58], [W - 58, 58], [W - 58, H - 58], [58, H - 58]]),
  ];
  const chart = group([...border, ...lands.map(closed)], PEN, 800);
  const ripples = group(ISLANDS.flatMap((i, k) => [14, 30, 50].map(d => closed(coast(i.c, i.R, i.seed, d)).slice(0, 97 - k * 3))), { ...FINE, size: 1.1, alpha: 0.55 }, 820);
  // compass rose: sixteen points, rings, rhumb lines out to the border
  const rose: Vec2[][] = [];
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * TAU - Math.PI / 2, len = k % 4 === 0 ? 150 : k % 2 === 0 ? 100 : 64, wdt = k % 4 === 0 ? 20 : k % 2 === 0 ? 14 : 9;
    const tip: Vec2 = [ROSE[0] + Math.cos(a) * len, ROSE[1] + Math.sin(a) * len * 0.999];
    const l: Vec2 = [ROSE[0] + Math.cos(a - Math.PI / 2) * wdt, ROSE[1] + Math.sin(a - Math.PI / 2) * wdt];
    const rr: Vec2 = [ROSE[0] + Math.cos(a + Math.PI / 2) * wdt, ROSE[1] + Math.sin(a + Math.PI / 2) * wdt];
    rose.push([l, tip, rr]);
  }
  rose.push(closed(circle(ROSE[0], ROSE[1], 44, 48)), closed(circle(ROSE[0], ROSE[1], 116, 72)), closed(circle(ROSE[0], ROSE[1], 124, 72)));
  const rhumbs: Vec2[][] = Array.from({ length: 16 }, (_, k) => {
    const a = (k / 16) * TAU - Math.PI / 2, far = 2400;
    return [[ROSE[0] + Math.cos(a) * 130, ROSE[1] + Math.sin(a) * 130], [ROSE[0] + Math.cos(a) * far, ROSE[1] + Math.sin(a) * far]];
  });
  const marks: Vec2[][] = [];
  // hills and trees on the land
  ISLANDS.forEach(i => {
    for (let k = 0; k < Math.round(i.R / 14); k++) {
      const a = r() * TAU, d = Math.sqrt(r()) * i.R * 0.55, x = i.c[0] + Math.cos(a) * d, y = i.c[1] + Math.sin(a) * d * 0.8, s = 12 + r() * 12;
      if (k % 3 === 2) marks.push(catmullRom([[x - 3, y + 6], [x, y - 8], [x + 3, y + 6]], 2), circle(x, y - 12, 7, 12).concat([[x + 7, y - 12]]));
      else marks.push([[x - s, y + s * 0.3], [x - s * 0.2, y - s * 0.7], [x + s * 0.1, y - s * 0.5], [x + s, y + s * 0.3]], [[x - s * 0.1, y - s * 0.55], [x + s * 0.3, y + s * 0.2]]);
    }
  });
  // little sea marks
  for (let k = 0; k < 26; k++) {
    const x = 120 + r() * (W - 240), y = 100 + r() * (H - 200);
    if (ISLANDS.some(i => Math.hypot(x - i.c[0], (y - i.c[1]) / 0.82) < i.R * 1.45) || Math.hypot(x - ROSE[0], y - ROSE[1]) < 170 || Math.hypot(x - SERPENT[0], y - SERPENT[1]) < 200) continue;
    marks.push(catmullRom([[x - 16, y], [x - 8, y - 6], [x, y], [x + 8, y - 6], [x + 16, y]], 3));
  }
  // cartouche: a ribbon with a title in the hand
  const cx = 960, cy = 1000;
  marks.push(
    catmullRom([[cx - 300, cy - 30], [cx - 150, cy - 44], [cx, cy - 36], [cx + 150, cy - 44], [cx + 300, cy - 30]], 6),
    catmullRom([[cx - 300, cy + 22], [cx - 150, cy + 8], [cx, cy + 16], [cx + 150, cy + 8], [cx + 300, cy + 22]], 6),
    [[cx - 300, cy - 30], [cx - 340, cy - 8], [cx - 300, cy + 22]], [[cx + 300, cy - 30], [cx + 340, cy - 8], [cx + 300, cy + 22]],
    squiggle(cx - 220, cx + 220, cy - 6, 830, { height: 9, step: 12 }),
  );
  const roseGroup = group([...rose, ...rhumbs], { ...FINE, size: 1.2 }, 840), markGroup = group(marks, { ...FINE, size: 1.5, alpha: 0.9 }, 850);
  return {
    F, lands, chart, chartSlots: scheduleWithin(chart, 0, sec(34)),
    ripples, rippleSlots: scheduleWithin(ripples, sec(14), sec(44)),
    rose: roseGroup, roseSlots: scheduleWithin(roseGroup, sec(22), sec(48)),
    marks: markGroup, markSlots: scheduleWithin(markGroup, sec(30), sec(58)),
    route: prepareStroke(catmullRom(ROUTE, 16, true), { ...PEN, color: RED, size: 3.4, dryBrush: 0 }, 860, { closed: true }),
    ship: ([
      catmullRom([[-40, -4], [-30, 14], [30, 14], [46, -8]], 5), [[-40, -4], [46, -8]],
      [[-14, -6], [-14, -64]], [[10, -6], [10, -76]], [[30, -8], [30, -50]],
      catmullRom([[-14, -58], [-4, -46], [-14, -30]], 4), catmullRom([[10, -70], [24, -54], [10, -34]], 4), catmullRom([[30, -46], [40, -36], [30, -24]], 4),
      [[10, -76], [26, -72], [10, -68]],
    ] as Vec2[][]).map((pts, k) => prepareStroke(pts, { ...PEN, size: 2, taperStart: 3, taperEnd: 3 }, 870 + k)),
  };
});

export const seaChartScene: Scene = {
  name: 'sea-chart',
  duration: (LOOP_FROM + LOOP) / 12,
  loopFrom: LOOP_FROM / 12,
  poster: (LOOP_FROM + 44) / 12,
  draw(f) {
    const { ctx, stage } = f;
    const L = layout(stage.w, stage.h), n = nf(f), { P, s } = L.F, [ox, oy] = P(0, 0);
    ground(f, PAL.paper, { seed: 808, texture: 1.3, vignette: 0.3, vignetteColor: '#6b4a1e' });
    // foxing and the folds of a chart kept in a sea chest
    still(f, 'g08-foxing', g => {
      const c = g.ctx;
      c.translate(ox, oy);
      c.scale(s, s);
      const r = rng(8080);
      for (let k = 0; k < 70; k++) {
        const x = r() * W, y = r() * H, rad = 4 + Math.pow(r(), 3) * 60;
        const grad = c.createRadialGradient(x, y, 0, x, y, rad);
        grad.addColorStop(0, 'rgba(140,90,40,0.18)');
        grad.addColorStop(0.7, 'rgba(140,90,40,0.1)');
        grad.addColorStop(1, 'rgba(140,90,40,0)');
        c.fillStyle = grad;
        c.fillRect(x - rad, y - rad, rad * 2, rad * 2);
      }
      for (const [x0, y0, x1, y1] of [[W / 2, 0, W / 2, H], [0, H / 2, W, H / 2]] as const) {
        c.strokeStyle = 'rgba(255,248,225,0.3)';
        c.lineWidth = 5;
        c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
        c.strokeStyle = 'rgba(110,80,40,0.16)';
        c.lineWidth = 2;
        c.beginPath(); c.moveTo(x0 + 3, y0 + 3); c.lineTo(x1 + 3, y1 + 3); c.stroke();
      }
    });

    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(s, s);
    const fx = { ...f, ctx };
    // land washed in as its coast is inked
    L.lands.forEach((land, k) => {
      const inked = clamp((n - 6 - k * 5) / 18, 0, 1);
      if (inked <= 0) return;
      ctx.save();
      ctx.globalAlpha = inked * 0.55;
      ctx.fillStyle = LAND;
      ctx.fill(polyPath(land));
      ctx.restore();
    });
    drawGroup(fx, L.chart, L.chartSlots);
    // the border's degree scale, alternately filled
    const scaleIn = clamp((n - 20) / 14, 0, 1);
    if (scaleIn > 0) {
      ctx.save();
      ctx.globalAlpha = scaleIn * 0.85;
      ctx.fillStyle = SEPIA;
      for (let x = 58, k = 0; x < W - 58; x += 48, k++) if (k % 2 === 0) { ctx.fillRect(x, 41, 48, 16); ctx.fillRect(x, H - 57, 48, 16); }
      for (let y = 58, k = 0; y < H - 58; y += 48, k++) if (k % 2 === 0) { ctx.fillRect(41, y, 16, 48); ctx.fillRect(W - 57, y, 16, 48); }
      ctx.restore();
    }
    drawGroup(fx, L.ripples, L.rippleSlots);
    ctx.save();
    ctx.beginPath();
    ctx.rect(58, 58, W - 116, H - 116);
    ctx.clip();
    drawGroup(fx, L.rose, L.roseSlots);
    ctx.restore();
    // the rose's alternate half-points in ink
    const roseIn = clamp((n - 40) / 10, 0, 1);
    if (roseIn > 0) {
      ctx.save();
      ctx.globalAlpha = roseIn * 0.85;
      ctx.fillStyle = SEPIA;
      for (let k = 0; k < 16; k += 2) {
        const a = (k / 16) * TAU - Math.PI / 2, len = k % 4 === 0 ? 150 : 100, wdt = k % 4 === 0 ? 20 : 14;
        ctx.beginPath();
        ctx.moveTo(ROSE[0], ROSE[1]);
        ctx.lineTo(ROSE[0] + Math.cos(a) * len, ROSE[1] + Math.sin(a) * len);
        ctx.lineTo(ROSE[0] + Math.cos(a + Math.PI / 2) * wdt, ROSE[1] + Math.sin(a + Math.PI / 2) * wdt);
        ctx.fill();
      }
      ctx.fillStyle = RED;
      ctx.beginPath();
      ctx.arc(ROSE[0], ROSE[1], 9, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
    drawGroup(fx, L.marks, L.markSlots);

    // the serpent: three coils and a head breaking the water, rising and sinking in turn
    const serpentIn = clamp((n - 30) / 16, 0, 1);
    if (serpentIn > 0) {
      const p = wrap((n - LOOP_FROM) / LOOP, 1);
      ctx.save();
      ctx.globalAlpha = serpentIn;
      ctx.translate(SERPENT[0], SERPENT[1]);
      ctx.strokeStyle = SEPIA;
      ctx.fillStyle = PAL.paper;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (let k = 0; k < 3; k++) {
        const x = -150 + k * 90, lift = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(TAU * (p * 2 - k * 0.16)));
        // a thick coil with a pale belly line and scale ticks
        ctx.lineWidth = 17;
        ctx.beginPath();
        ctx.ellipse(x, 0, 34, 44 * lift, 0, Math.PI, TAU);
        ctx.stroke();
        ctx.lineWidth = 3;
        ctx.strokeStyle = PAL.paper;
        ctx.beginPath();
        ctx.ellipse(x, 0, 38, 48 * lift, 0, Math.PI * 1.15, Math.PI * 1.85);
        ctx.stroke();
        ctx.strokeStyle = SEPIA;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(x - 50, 2); ctx.quadraticCurveTo(x - 42, -4, x - 34, 2);
        ctx.moveTo(x + 34, 2); ctx.quadraticCurveTo(x + 42, -4, x + 50, 2);
        ctx.stroke();
      }
      // head, jaw opening and closing
      const hx = 130, rise = 20 * wave(p, 2, 0.35), jaw = 0.18 + 0.14 * (0.5 + 0.5 * wave(p, 4));
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(hx - 16, 2);
      ctx.bezierCurveTo(hx - 20, -40 - rise, hx - 4, -70 - rise, hx + 20, -76 - rise);
      ctx.lineTo(hx + 62, -70 - rise);
      ctx.lineTo(hx + 20, -58 - rise + 30 * jaw);
      ctx.bezierCurveTo(hx + 12, -40 - rise, hx + 16, -20, hx + 14, 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(hx + 24, -66 - rise);
      ctx.lineTo(hx + 58, -52 - rise + 40 * jaw);
      ctx.stroke();
      ctx.fillStyle = SEPIA;
      ctx.beginPath();
      ctx.arc(hx + 18, -70 - rise, 3, 0, TAU);
      ctx.fill();
      ctx.restore();
    }

    // the voyage: the wake of dashes behind the ship, fixed to the route and fading with distance
    const sailed = Math.max(0, (n - SAIL) / LOOP), at = wrap(0.02 + sailed, 1);
    const route = L.route, dash = 26 / route.length, reach = Math.min(WAKE, sailed);
    for (let k = 0; k * dash < 1; k++) {
      const a = k * dash, behind = wrap(at - a, 1);
      if (behind > reach || behind < 0.012) continue;
      ctx.save();
      ctx.globalAlpha = Math.pow(1 - behind / WAKE, 0.8) * 0.9;
      drawStrokeRange(ctx, route, a, a + dash * 0.5, { taperStart: 2, taperEnd: 2 });
      ctx.restore();
    }
    const shipIn = clamp((n - 4) / 10, 0, 1);
    if (shipIn > 0) {
      const sm = sampleStroke(route, at), face = Math.cos(sm.angle) < 0 ? -1 : 1;
      ctx.save();
      ctx.globalAlpha = shipIn;
      // bob and roll a whole number of times per voyage
      ctx.translate(sm.point[0], sm.point[1] - 6 + 3 * Math.sin((TAU * 24 * n) / LOOP));
      ctx.rotate(0.05 * Math.sin((TAU * 12 * n) / LOOP));
      ctx.scale(face * 1.8, 1.8);
      ctx.fillStyle = PAL.paper;
      ctx.beginPath();
      ctx.moveTo(-40, -4); ctx.lineTo(46, -8); ctx.lineTo(30, 14); ctx.lineTo(-30, 14);
      ctx.fill();
      for (const st of L.ship) drawStroke(ctx, st, 1);
      ctx.restore();
    }
    ctx.restore();
  },
};
