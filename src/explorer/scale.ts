/**
 * The Scale sheet: how big and how far everything really is, next to the drawings that squeeze it to fit. Two small
 * figures drawn by hand in the style on show (its paper, ink and accent, with the stroke engine's wobble): the bodies
 * side by side at one true scale, and the Milky Way seen face-on with the Sun's orbit round it. The words come from
 * `content/scale.ts`, and every figure in them is worked out from its data.
 */
import type { Vec2 } from '../core/math';
import { hashSeed, rng } from '../core/random';
import { drawStroke, prepareStroke } from '../core/stroke';
import { PLANETS, SUN_R } from '../scenes/solar/common';
import { AU_KM, BALL, BODIES, C_KM_S, GALAXY, LIGHT_YEAR_KM, LIKE, PROXIMA_LY, SATURN_RING, SCALE_TEXT, SUN_KM, VOYAGER_1, type Body } from './content/scale';
import { parseIsoDate } from './format';
import { rgba } from './overlays';

const TAU = Math.PI * 2;
const esc = (s: string): string => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const fill = (s: string, vars: Readonly<Record<string, string | number>>): string => s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
const group = (n: number): string => Math.round(n).toLocaleString('en-GB');

/* ---------- the model: if the Sun were a basketball ---------- */

/** "2.2 mm", "2.5 cm", "26 m", "1.0 km", "6,900 km": a length in the model, in metres. */
export function modelLength(m: number): string {
  if (m < 0.01) return `${(m * 1000).toFixed(1)} mm`;
  if (m < 1) return `${(m * 100).toFixed(1)} cm`;
  if (m < 1000) return `${Math.round(m)} m`;
  if (m < 10_000) return `${(m / 1000).toFixed(1)} km`;
  return `${group(Math.round(m / 100_000) * 100)} km`;
}

/** What a body `mm` across in the model is about the size of. */
export function likeOf(mm: number): string {
  return (LIKE.find(([most]) => mm <= most) ?? LIKE[LIKE.length - 1]!)[1];
}

/** Metres in the model per kilometre of the real thing. */
const MODEL = BALL.m / SUN_KM;

/** Voyager 1's distance from the Sun on a date (days from J2000.0), au. */
export function voyagerAu(day: number): number {
  return VOYAGER_1.au + ((day - parseIsoDate(VOYAGER_1.iso)!) / 365.25) * VOYAGER_1.auPerYear;
}

/** The model as rows: each body's size and what it is like, and how far away it would be. */
export function modelRows(day: number): { name: string; size: string; far: string }[] {
  const rows = BODIES.map((b: Body) => {
    const mm = b.km * MODEL * 1000;
    return { name: b.name, size: `${likeOf(mm)}, ${modelLength(b.km * MODEL)}`, far: b.id === 'moon' ? `${modelLength(b.from * MODEL)} from the Earth` : `${modelLength(b.from * MODEL)} away` };
  });
  rows.push({ name: 'Voyager 1', size: 'the farthest spacecraft', far: `${modelLength(voyagerAu(day) * AU_KM * MODEL)} away` });
  rows.push({ name: 'Proxima Centauri', size: 'the nearest star: farther off than London is from New York', far: `${modelLength(PROXIMA_LY * LIGHT_YEAR_KM * MODEL)} away` });
  return rows;
}

/* ---------- how the plan cheats ---------- */

/** How much the From above plan exaggerates, and what true scale would look like on a screen `short` pixels high. */
export function cheats(short: number): Record<string, string> {
  const au: Record<string, number> = { mercury: 0.387, venus: 0.723, earth: 1, mars: 1.524, jupiter: 5.203, saturn: 9.537, uranus: 19.19, neptune: 30.07 };
  const factors = PLANETS.map(p => {
    const b = BODIES.find(x => x.id === p.name)!, trueR = (p.a * (b.km / 2)) / (au[p.name]! * AU_KM);
    return p.r / trueR;
  });
  const earthA = PLANETS.find(p => p.name === 'earth')!.a, neptuneA = PLANETS.find(p => p.name === 'neptune')!.a;
  const round = (x: number): string => group(Math.round(x / 100) * 100);
  // pixels per au on a screen `short` high with Neptune's orbit filling it, and a size in pixels as "1/780"
  const perAu = short / 2 / 30.07, fraction = (px: number): string => `1/${group(Number((1 / px).toPrecision(2)))}`;
  return {
    planets: `${round(Math.min(...factors))} to ~${round(Math.max(...factors))}`,
    sun: String(Math.round(SUN_R / ((earthA * (SUN_KM / 2)) / AU_KM))),
    drawn: String(Math.round(neptuneA / earthA)),
    truly: String(Math.round(30.07)),
    sunPx: fraction((SUN_KM / AU_KM) * perAu),
    earthPx: fraction((12_756 / AU_KM) * perAu),
  };
}

/* ---------- the sheet ---------- */

/** The Scale sheet's markup; its two figures are drawn by `drawFigures` once it is in the page. */
export function scaleHtml(day: number, short: number, dwarfs: boolean, presetItem: (id: string) => string): string {
  const light = C_KM_S * MODEL, ch = cheats(short), earth = BODIES.find(b => b.id === 'earth')!;
  const rows = modelRows(day).map(r => `<li><span class="md-name">${esc(r.name)}</span><span class="md-far">${esc(r.far)}</span><span class="md-size">${esc(r.size)}</span></li>`).join('');
  const g = GALAXY, auYear = String(Math.round(g.auPerYear / 5) * 5);
  const honest = SCALE_TEXT.galaxyHonest.map(s => `<li>${esc(fill(s, { auYear }))}</li>`).join('');
  return `<p class="intro">${esc(SCALE_TEXT.intro)}</p>
    <section class="sky-sec" aria-labelledby="scale-sizes-h">
      <h3 id="scale-sizes-h">Sizes side by side</h3>
      <figure class="figure"><canvas class="lineup" data-figure="lineup" role="img" aria-label="The Sun, the planets, the Moon and Pluto drawn side by side at one true scale: the Sun's edge dwarfs Jupiter, and the Earth is a dot beside it."></canvas>
        <figcaption>${esc(SCALE_TEXT.sizes)}</figcaption></figure>
    </section>
    <section class="sky-sec" aria-labelledby="scale-ball-h">
      <h3 id="scale-ball-h">True distances</h3>
      <p>${esc(fill(SCALE_TEXT.ball, { ball: BALL.name, cm: Math.round(BALL.m * 100) }))}</p>
      <ul class="model">${rows}</ul>
      <p class="small">${esc(fill(SCALE_TEXT.light, { speed: modelLength(light), minutes: Math.round(earth.from / C_KM_S / 60) }))}</p>
    </section>
    <section class="sky-sec" aria-labelledby="scale-beyond-h">
      <h3 id="scale-beyond-h">Beyond Neptune</h3>
      <p>${esc(SCALE_TEXT.beyond)}</p>
      <div class="row">
        <button type="button" class="toggle" data-act="layer" data-layer="dwarfs" aria-pressed="${dwarfs}"><span class="dot" aria-hidden="true"></span>Pluto and the Kuiper belt on the plan</button>
        <button type="button" class="chip" data-body="pluto">Pluto</button>
        <button type="button" class="chip" data-body="kuiper">Kuiper belt</button>
      </div>
      <ul class="presets">${presetItem('new-horizons')}</ul>
    </section>
    <section class="sky-sec" aria-labelledby="scale-galaxy-h">
      <h3 id="scale-galaxy-h">The Sun’s path through the galaxy</h3>
      <p>${esc(fill(SCALE_TEXT.galaxyLede, { speed: g.speed, from: group(g.fromCentre), lap: g.lapMyr, laps: Math.round((g.ageGyr * 1000) / g.lapMyr) }))}</p>
      <figure class="figure"><canvas class="galaxy" data-figure="galaxy" role="img" aria-label="The Milky Way seen face-on: spiral arms round a bright centre, and the Sun about halfway out on its orbit, moving at 230 kilometres a second."></canvas></figure>
      <p>${esc(SCALE_TEXT.galaxyMotion)}</p>
      <ul class="fun">${honest}</ul>
      <div class="card-actions"><button type="button" class="act" data-act="view-wake">See it in motion</button></div>
    </section>
    <details class="guide"><summary><h3>How the drawings cheat</h3></summary>
      <p>${esc(fill(SCALE_TEXT.cheat, ch))}</p>
      <p>${esc(fill(SCALE_TEXT.cheatScreen, { sun: ch.sunPx!, earth: ch.earthPx! }))}</p>
    </details>
    <p class="small">Sizes and distances: NASA’s planetary fact sheets, rounded. The galaxy: Reid et al. 2019 and GRAVITY 2022; see Sources in the guide.</p>`;
}

/* ---------- drawing by hand ---------- */

/** A circle drawn by hand: a closed, wobbling stroke round it. */
function ring(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, width: number, seed: number): void {
  const n = Math.max(24, Math.min(96, Math.round(r * 1.5))), pts: Vec2[] = [];
  for (let i = 0; i < n; i++) pts.push([x + Math.cos((i / n) * TAU) * r, y + Math.sin((i / n) * TAU) * r]);
  drawStroke(ctx, prepareStroke(pts, { color, size: width, thinning: 0.3, wobble: Math.min(1.4, 0.03 * r + 0.2), tremor: 0.15, taperStart: 0, taperEnd: 0 }, seed, { closed: true }), 1);
}

/** A disc: a light wash of ink and a hand-drawn edge (the smallest only a dot of ink). */
function disc(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, ink: string, seed: number): void {
  ctx.fillStyle = r < 2.2 ? ink : rgba(ink, 0.16);
  ctx.beginPath();
  ctx.arc(x, y, Math.max(r, 0.8), 0, TAU);
  ctx.fill();
  if (r >= 2.2) ring(ctx, x, y, r, ink, Math.min(1.6, 0.6 + r * 0.03), seed);
}

/** Size a canvas to `h` CSS pixels high at its CSS width, sharp on the screen; the context works in CSS pixels. */
function fit(canvas: HTMLCanvasElement, h: number): CanvasRenderingContext2D | null {
  const w = canvas.clientWidth, dpr = Math.min(3, devicePixelRatio || 1);
  canvas.style.height = `${h}px`;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  const ctx = canvas.getContext('2d');
  ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

/** A name set in the explorer's type, haloed in the paper (`halo`) where it crosses the drawing. */
const label = (ctx: CanvasRenderingContext2D, s: string, x: number, y: number, color: string, size = 11, align: CanvasTextAlign = 'center', halo?: string): void => {
  ctx.font = `500 ${size}px Inter, system-ui, sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  if (halo) {
    ctx.lineJoin = 'round';
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = halo;
    ctx.strokeText(s, x, y);
  }
  ctx.fillStyle = color;
  ctx.fillText(s, x, y);
};

/**
 * The line-up: the Sun's edge filling the left, the four giants beside it and the small worlds on a row below, all at
 * one scale (as large as the width allows with every name clear of the next).
 */
export function drawLineup(canvas: HTMLCanvasElement, [paper, ink, accent]: readonly [string, string, string]): void {
  const W = canvas.clientWidth;
  if (W < 50) return;
  const giants = BODIES.filter(b => ['jupiter', 'saturn', 'uranus', 'neptune'].includes(b.id));
  const small = BODIES.filter(b => ['mercury', 'venus', 'earth', 'moon', 'mars', 'pluto'].includes(b.id));
  const probe = canvas.getContext('2d')!, size = W < 300 ? 10 : 11;
  probe.font = `500 ${size}px Inter, system-ui, sans-serif`;
  const lw = (b: Body): number => probe.measureText(b.name).width + 8;
  // a giant's width on the page: its disc, or Saturn's tilted rings
  const extent = (b: Body, s: number): number => (b.id === 'saturn' ? b.km * SATURN_RING * 0.92 : b.km) * s;
  const sliver = Math.max(26, W * 0.09), pad = 8, room = W - sliver - pad * 2;
  const used = (s: number): number => giants.reduce((sum, b) => sum + Math.max(extent(b, s), lw(b)) + 6, 0);
  // the largest scale at which the giants and their names fit
  let lo = 0, hi = 1;
  for (let k = 0; k < 40; k++) { const m = (lo + hi) / 2; if (used(m) <= room) lo = m; else hi = m; }
  // the small worlds share the width evenly; where their names would touch, every other one drops a line
  const each = (W - sliver - pad * 2) / small.length, stagger = small.some(b => lw(b) - 6 > each) ? 13 : 0;
  const s = lo, big = giants[0]!.km * s, row1 = pad + big / 2 + 4, row2 = row1 + big / 2 + 44;
  const H = Math.round(row2 + 30 + stagger);
  const ctx = fit(canvas, H);
  if (!ctx) return;
  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, W, H);
  // the Sun: its edge alone fills the left
  const R = (SUN_KM / 2) * s, sx = sliver - R, sy = H / 2;
  ctx.save();
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.arc(sx, sy, R, 0, TAU);
  ctx.fill();
  ctx.restore();
  ring(ctx, sx, sy, R, ink, 1.4, hashSeed(41, 1));
  ctx.save();
  ctx.translate(sliver / 2 - 1, sy);
  ctx.rotate(-Math.PI / 2);
  label(ctx, 'Sun', 0, 4, ink, size);
  ctx.restore();
  // the giants, left to right from the Sun
  let x = sliver + pad;
  giants.forEach((b, i) => {
    const slot = Math.max(extent(b, s), lw(b)), cx = x + slot / 2, r = (b.km / 2) * s, seed = hashSeed(41, 10 + i);
    if (b.id === 'saturn') {
      ctx.save();
      ctx.strokeStyle = rgba(ink, 0.85);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.ellipse(cx, row1, r * SATURN_RING, r * SATURN_RING * 0.26, -0.42, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }
    disc(ctx, cx, row1, r, ink, seed);
    if (b.id === 'jupiter') {
      // a few of its belts
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, row1, r * 0.97, 0, TAU);
      ctx.clip();
      ctx.strokeStyle = rgba(ink, 0.35);
      ctx.lineWidth = Math.max(1, r * 0.06);
      for (const f of [-0.45, -0.15, 0.2, 0.5]) {
        ctx.beginPath();
        ctx.moveTo(cx - r, row1 + f * r);
        ctx.quadraticCurveTo(cx, row1 + f * r + r * 0.05, cx + r, row1 + f * r);
        ctx.stroke();
      }
      ctx.restore();
    }
    label(ctx, b.name, cx, row1 + big / 2 + 18, ink, size);
    x += slot + 6;
  });
  // the small worlds, spread evenly along the row below
  small.forEach((b, i) => {
    const cx = sliver + pad + each * (i + 0.5);
    disc(ctx, cx, row2, (b.km / 2) * s, ink, hashSeed(41, 30 + i));
    label(ctx, b.name, cx, row2 + 20 + (i % 2) * stagger, ink, size);
  });
}

/**
 * The Milky Way face-on, as seen from above its north pole: a bright centre, four arms winding out, the Sun about
 * halfway to the edge on the Orion Spur, its orbit dashed and an arrow along it (the galaxy turns clockwise from here).
 */
export function drawGalaxy(canvas: HTMLCanvasElement, [paper, ink, accent]: readonly [string, string, string]): void {
  const W = canvas.clientWidth;
  if (W < 50) return;
  const H = Math.round(Math.min(260, W * 0.72)), ctx = fit(canvas, H);
  if (!ctx) return;
  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, W, H);
  const cx = W / 2, cy = H / 2 - 6, R = Math.min(W * 0.46, H * 0.47), r = rng(hashSeed(52, 7));
  // the arms: logarithmic spirals ~12 degrees open, their stars scattered along them
  const pitch = Math.tan((12 * Math.PI) / 180), a0 = 0.16 * R;
  const arm = (phase: number, from: number, to: number): Vec2[] => {
    const pts: Vec2[] = [];
    for (let th = from; th <= to; th += 0.06) {
      const rr = a0 * Math.exp(pitch * th);
      if (rr > R) break;
      // clockwise from above, on a page with y down: the arms trail anticlockwise
      pts.push([cx + Math.cos(-(th + phase)) * rr, cy + Math.sin(-(th + phase)) * rr * 0.92]);
    }
    return pts;
  };
  ctx.save();
  // two major arms and two fainter ones, starting clear of the bright centre
  const from = Math.log(0.22 / 0.16) / pitch;
  for (let k = 0; k < 4; k++) {
    const pts = arm((k * Math.PI) / 2, from, 14), strong = k % 2 === 0;
    drawStroke(ctx, prepareStroke(pts, { color: rgba(ink, strong ? 0.4 : 0.22), size: R * (strong ? 0.05 : 0.035), thinning: 0.5, wobble: 1, tremor: 0.25, taperStart: R * 0.15, taperEnd: R * 0.5 }, hashSeed(52, k)), 1);
    ctx.fillStyle = rgba(ink, strong ? 0.6 : 0.4);
    ctx.beginPath();
    for (const [x, y] of pts) {
      if (r() > 0.75) continue;
      const dx = (r() - 0.5) * R * 0.1, dy = (r() - 0.5) * R * 0.1, s = 0.4 + r() * 0.8;
      ctx.moveTo(x + dx + s, y + dy);
      ctx.arc(x + dx, y + dy, s, 0, TAU);
    }
    ctx.fill();
  }
  // the bright centre and its bar
  const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.3);
  glow.addColorStop(0, rgba(accent, 0.95));
  glow.addColorStop(0.4, rgba(accent, 0.45));
  glow.addColorStop(1, rgba(accent, 0));
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(cx, cy, R * 0.3, 0, TAU);
  ctx.fill();
  ctx.restore();
  // the Sun's orbit, the Sun below the centre, and its way round
  const Rs = (R * GALAXY.fromCentre) / GALAXY.disc, sunX = cx, sunY = cy + Rs * 0.92;
  ctx.save();
  ctx.setLineDash([3, 4]);
  ctx.strokeStyle = rgba(accent, 0.9);
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.ellipse(cx, cy, Rs, Rs * 0.92, 0, 0, TAU);
  ctx.stroke();
  ctx.setLineDash([]);
  // moving left along the bottom of the orbit (clockwise)
  const ax = sunX - Rs * 0.55, ay = cy + Rs * 0.92 * Math.cos(Math.asin(0.55));
  ctx.strokeStyle = accent;
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.ellipse(cx, cy, Rs, Rs * 0.92, 0, Math.PI / 2 - 0.05, Math.PI / 2 + Math.asin(0.55));
  ctx.stroke();
  const tx = -Math.cos(Math.asin(0.55)), ty = -0.55 * 0.92;
  const tl = Math.hypot(tx, ty), ux = tx / tl, uy = ty / tl;
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.moveTo(ax + ux * 6, ay + uy * 6);
  ctx.lineTo(ax - uy * 4 - ux * 3, ay + ux * 4 - uy * 3);
  ctx.lineTo(ax + uy * 4 - ux * 3, ay - ux * 4 - uy * 3);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.arc(sunX, sunY, 3.6, 0, TAU);
  ctx.fill();
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = paper;
  ctx.stroke();
  ctx.restore();
  const size = W < 300 ? 10 : 11;
  label(ctx, 'You are here: the Sun', sunX + 8, sunY + 16, ink, size, 'left', paper);
  label(ctx, `~${GALAXY.speed} km/s`, ax - 4, ay - 8, ink, size, 'right', paper);
  label(ctx, `~${group(GALAXY.disc * 2)} light-years across`, W - 8, 16, rgba(ink, 0.8), size, 'right');
}

/** Draw the sheet's figures (again, for a new style or a new width). */
export function drawFigures(root: ParentNode, swatch: readonly [string, string, string]): void {
  const lineup = root.querySelector<HTMLCanvasElement>('canvas[data-figure="lineup"]');
  const galaxy = root.querySelector<HTMLCanvasElement>('canvas[data-figure="galaxy"]');
  if (lineup) drawLineup(lineup, swatch);
  if (galaxy) drawGalaxy(galaxy, swatch);
}
