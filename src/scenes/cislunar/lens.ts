/**
 * The lens the Earth and Moon view is drawn through. Its range of scales is too wide for magnifying a drawing (from
 * the Moon's orbit down to the space station's, a factor of a hundred), so the stage stays at its home view and the
 * scene maps its geometry itself: the page, the paper and the textures stay put on the screen while the orbits grow,
 * and every line keeps its weight, as on a map.
 *
 * A frame the live explorer draws carries the lens (the view camera, in logical units); a render has none, and draws
 * the whole neighbourhood.
 */
import type { SceneFrame } from '../../core/scene';
import type { Ctx, View } from '../../core/stage';
import { frameFit } from '../solar/common';
import type { SkyFrame } from '../solar/sky';

export interface LensFrame extends SkyFrame {
  /** The view camera over the logical frame; home when absent. */
  readonly lens?: View;
  /** Days the sky moves between drawings (fast orbits smear when they would jump). */
  readonly step?: number;
}

export interface Lens {
  zoom: number;
  /** Output pixels per logical unit (the stage's base scale). */
  base: number;
  /** Output pixels per design unit. */
  k: number;
  /** Design units per logical unit: sizes meant to hold on screen are given in logical units and scaled by this. */
  u: number;
  /** Output pixel of the design origin. */
  tx: number;
  ty: number;
  /** The design units on screen: [x0, y0, x1, y1]. */
  box: readonly [number, number, number, number];
  /** Identifies the lens, for caches built under it. */
  key: string;
}

/** The lens a frame is drawn through. */
export function lensOf(f: SceneFrame): Lens {
  const { stage } = f, fr = frameFit(stage.w, stage.h), v = (f as LensFrame).lens ?? { zoom: 1, x: stage.w / 2, y: stage.h / 2 };
  const k = stage.base * v.zoom * fr.s, tx = stage.base * (stage.w / 2 + v.zoom * (fr.ox - v.x)), ty = stage.base * (stage.h / 2 + v.zoom * (fr.oy - v.y));
  const box = [-tx / k, -ty / k, (stage.outW - tx) / k, (stage.outH - ty) / k] as const;
  return { zoom: v.zoom, base: stage.base, k, u: 1 / (v.zoom * fr.s), tx, ty, box, key: `${stage.outW}x${stage.outH}:${v.zoom}:${v.x}:${v.y}` };
}

/** Set `ctx` to draw in design units through the lens. */
export const enterLens = (ctx: Ctx, L: Lens): void => ctx.setTransform(L.k, 0, 0, L.k, L.tx, L.ty);

/** Whether a disc of radius `r` (design units) at (x, y) reaches the screen, with `pad` logical units to spare. */
export function onScreen(L: Lens, x: number, y: number, r: number, pad = 24): boolean {
  const m = r + pad * L.u, [x0, y0, x1, y1] = L.box;
  return x + m >= x0 && x - m <= x1 && y + m >= y0 && y - m <= y1;
}

/** Whether a ring of radius `r` round (x, y) crosses the screen (neither wholly off it nor wholly round it). */
export function ringOnScreen(L: Lens, x: number, y: number, r: number): boolean {
  if (!onScreen(L, x, y, r, 8)) return false;
  const [x0, y0, x1, y1] = L.box, far = Math.max(Math.hypot(x0 - x, y0 - y), Math.hypot(x1 - x, y0 - y), Math.hypot(x0 - x, y1 - y), Math.hypot(x1 - x, y1 - y));
  return r < far + 8 * L.u;
}

const built = new WeakMap<HTMLCanvasElement, string>();

/**
 * A view layer drawn under one lens and kept until the lens (or the frame) changes: the static geometry (the shells,
 * the belt, the Moon's orbit) costs nothing while the view holds. A pure function of its key and the lens.
 */
export function lensLayer(f: SceneFrame, key: string, L: Lens, build: (g: Ctx) => void): HTMLCanvasElement {
  const { stage } = f, id = `cislunar:${key}`, fresh = !stage.hasLayer(id), layer = stage.layer(id);
  if (fresh || built.get(layer) !== L.key) {
    const g = stage.context(layer);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    g.filter = 'none';
    g.clearRect(0, 0, layer.width, layer.height);
    g.save();
    build(g);
    g.restore();
    built.set(layer, L.key);
  }
  return layer;
}
