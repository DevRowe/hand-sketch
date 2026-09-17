/**
 * Sketchy geometry from rough.js, turned into plain polylines so the stroke engine (not rough.js's
 * constant-width canvas renderer) draws them with pressure, taper and a timed reveal.
 *
 * rough.js falls back to Math.random when `seed` is 0 or missing, so every call here requires a seed.
 */
import rough from 'roughjs';
import type { Drawable, Op, Options } from 'roughjs/bin/core';
import type { Point } from 'roughjs/bin/geometry';
import { flattenCubic } from './geometry';
import type { Vec2 } from './math';

export interface SketchGeometry {
  /** Outline strokes, in drawing order. */
  outline: Vec2[][];
  /** Hachure / zigzag / cross-hatch fill strokes, in drawing order. */
  fill: Vec2[][];
  /** Solid fill polygons (fillStyle 'solid'). */
  fillPolygons: Vec2[][];
}

export type SketchOptions = Omit<Options, 'seed'> & { seed: number };

const generator = rough.generator();

function withSeed(o: SketchOptions): Options {
  if (!Number.isFinite(o.seed) || o.seed <= 0) throw new Error(`rough.js needs a positive seed for determinism, got ${o.seed}`);
  return { disableMultiStroke: false, ...o, seed: Math.floor(o.seed) };
}

function opsToPolylines(ops: readonly Op[], curveSteps: number): Vec2[][] {
  const lines: Vec2[][] = [];
  let cur: Vec2[] = [];
  for (const { op, data } of ops) {
    if (op === 'move') {
      if (cur.length > 1) lines.push(cur);
      cur = [[data[0]!, data[1]!]];
    } else if (op === 'lineTo') {
      cur.push([data[0]!, data[1]!]);
    } else {
      const p0 = cur[cur.length - 1] ?? [data[4]!, data[5]!];
      flattenCubic(p0, [data[0]!, data[1]!], [data[2]!, data[3]!], [data[4]!, data[5]!], curveSteps, cur);
    }
  }
  if (cur.length > 1) lines.push(cur);
  return lines;
}

export function drawableToGeometry(d: Drawable, curveSteps = 10): SketchGeometry {
  const g: SketchGeometry = { outline: [], fill: [], fillPolygons: [] };
  for (const set of d.sets) {
    const lines = opsToPolylines(set.ops, curveSteps);
    if (set.type === 'path') g.outline.push(...lines);
    else if (set.type === 'fillSketch') g.fill.push(...lines);
    else g.fillPolygons.push(...lines);
  }
  return g;
}

const pts = (p: readonly Vec2[]): Point[] => p.map(([x, y]) => [x, y] as Point);

/** Sketchy primitives. Coordinates are logical units. */
export const sketch = {
  line: (a: Vec2, b: Vec2, o: SketchOptions) => drawableToGeometry(generator.line(a[0], a[1], b[0], b[1], withSeed(o))),
  rectangle: (x: number, y: number, w: number, h: number, o: SketchOptions) => drawableToGeometry(generator.rectangle(x, y, w, h, withSeed(o))),
  ellipse: (cx: number, cy: number, w: number, h: number, o: SketchOptions) => drawableToGeometry(generator.ellipse(cx, cy, w, h, withSeed(o))),
  circle: (cx: number, cy: number, d: number, o: SketchOptions) => drawableToGeometry(generator.circle(cx, cy, d, withSeed(o))),
  polygon: (p: readonly Vec2[], o: SketchOptions) => drawableToGeometry(generator.polygon(pts(p), withSeed(o))),
  linearPath: (p: readonly Vec2[], o: SketchOptions) => drawableToGeometry(generator.linearPath(pts(p), withSeed(o))),
  curve: (p: readonly Vec2[], o: SketchOptions) => drawableToGeometry(generator.curve(pts(p), withSeed(o))),
  path: (d: string, o: SketchOptions) => drawableToGeometry(generator.path(d, withSeed(o))),
};
