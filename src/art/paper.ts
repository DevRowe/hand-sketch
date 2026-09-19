/**
 * Paper stock: base colour, optional light bands, soft mottling, fibres and grain.
 * Built once per (stage size, colour, seed) into a cached layer, then blitted every frame, so the stock
 * never boils and costs one drawImage (the ported skill redrew ~1400 grain rects per frame, ~35 ms).
 */
import { TAU } from '../core/math';
import { noise2, rng } from '../core/random';
import type { Ctx, Region, Stage } from '../core/stage';
import { parseColor, shade, tint } from './color';

export interface PaperOptions {
  color: string;
  band?: string | null;
  seed?: number;
  /** Speckle colour; defaults to a darker shade of the stock (or a lighter one on dark stock). */
  speckle?: string;
  /** 0..1 overall texture strength. */
  texture?: number;
}

function isDark(c: string): boolean {
  const [r, g, b] = parseColor(c);
  return r * 0.299 + g * 0.587 + b * 0.114 < 110;
}

export function drawPaper(ctx: Ctx, stage: Stage, o: PaperOptions): void {
  const { color, band = null, seed = 5, texture = 1 } = o;
  const key = `paper:${color}:${band}:${seed}:${texture}:${o.speckle ?? ''}`;
  // page-locked: built once per stage size, and a moving view camera only maps it
  const layer = stage.pageLayer(key, (g, region) => paperSteps(stage, g, region, { ...o, band, seed, texture }), true);
  stage.blit(ctx, layer);
}

/** Marks drawn between yields while a sharp copy is built a slice at a time. */
const SLICE = 1500;

/**
 * Draw paper stock into `g` (set to logical units) as a page-layer build (see `PageBuild`): the whole page, or with a
 * `region` only the marks that show in it, yielding between slices.
 */
export function* paperSteps(stage: Stage, g: Ctx, region: Region | null, o: PaperOptions): Generator<void> {
  const { w: W, h: H } = stage, { band = null, seed = 5, texture = 1 } = o, dark = isDark(o.color), r = rng(seed);
  const speckle = o.speckle ?? (dark ? tint(o.color, 0.6) : shade(o.color, 0.5));
  const out = (x: number, y: number, e: number): boolean => region !== null && (x + e < region[0] || x - e > region[2] || y + e < region[1] || y - e > region[3]);
  let drawn = 0;
  g.fillStyle = o.color;
  g.fillRect(0, 0, W, H);

  // soft mottling: a coarse noise field upscaled with smoothing
  const mw = 64, mh = Math.max(8, Math.round((64 * H) / W));
  const mottle = document.createElement('canvas');
  mottle.width = mw;
  mottle.height = mh;
  const m = mottle.getContext('2d');
  if (m) {
    const img = m.createImageData(mw, mh), [cr, cg, cb] = parseColor(dark ? tint(o.color, 0.25) : shade(o.color, 0.25));
    for (let y = 0; y < mh; y++) {
      for (let x = 0; x < mw; x++) {
        const n = noise2(x / 7, y / 7, seed) + 0.5 * noise2(x / 2.5, y / 2.5, seed + 9);
        const k = (y * mw + x) * 4;
        img.data[k] = cr; img.data[k + 1] = cg; img.data[k + 2] = cb;
        img.data[k + 3] = Math.max(0, Math.min(255, (n + 0.35) * 70 * texture));
      }
    }
    m.putImageData(img, 0, 0);
    g.save();
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    g.globalAlpha = 0.5;
    g.drawImage(mottle, 0, 0, W, H);
    g.restore();
  }

  if (band) {
    g.save();
    g.translate(W / 2, H / 2);
    g.rotate(-Math.PI / 4);
    g.fillStyle = band;
    const span = Math.hypot(W, H);
    for (let i = -8; i <= 8; i++) g.fillRect(-span, i * 160 - 40, span * 2, 80);
    g.restore();
  }

  // fibres: short faint curved hairs
  g.save();
  g.strokeStyle = speckle;
  g.lineWidth = 0.6;
  g.globalAlpha = 0.07 * texture;
  g.beginPath();
  const fibres = Math.round((W * H) / 2600);
  for (let i = 0; i < fibres; i++) {
    const x = r() * W, y = r() * H, a = r() * TAU, L = 4 + r() * 14, bend = (r() - 0.5) * 6;
    if (out(x, y, L + 4)) continue;
    g.moveTo(x, y);
    g.quadraticCurveTo(x + Math.cos(a) * L * 0.5 - Math.sin(a) * bend, y + Math.sin(a) * L * 0.5 + Math.cos(a) * bend, x + Math.cos(a) * L, y + Math.sin(a) * L);
    if (region && ++drawn % SLICE === 0) {
      g.stroke();
      yield;
      g.beginPath();
    }
  }
  g.stroke();
  g.restore();

  // grain: dense tiny specks, one path
  g.save();
  g.fillStyle = speckle;
  g.globalAlpha = (dark ? 0.35 : 0.08) * texture;
  g.beginPath();
  const specks = Math.round((W * H) / 180);
  for (let i = 0; i < specks; i++) {
    const s = 0.5 + r() * 1.3, x = r() * W, y = r() * H;
    if (out(x, y, s)) continue;
    g.rect(x, y, s, s);
    if (region && ++drawn % SLICE === 0) {
      g.fill();
      yield;
      g.beginPath();
    }
  }
  g.fill();
  g.restore();
}
