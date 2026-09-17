import { describe, expect, it } from 'vitest';
import { bounds, ellipsePoints, polylineLength } from '../src/core/geometry';
import { prepareStroke, scheduledProgress, strokeOutline, strokeSchedule } from '../src/core/stroke';
import type { Vec2 } from '../src/core/math';

const style = { color: '#000', size: 6 };
const path: Vec2[] = [[0, 0], [400, 0]];

describe('prepareStroke', () => {
  it('is deterministic per seed and wobbles differently per seed', () => {
    const a = prepareStroke(path, style, 3), b = prepareStroke(path, style, 3), c = prepareStroke(path, style, 4);
    expect(a.points).toEqual(b.points);
    expect(a.points).not.toEqual(c.points);
  });

  it('wobbles coherently: neighbouring samples move together', () => {
    const s = prepareStroke(path, { ...style, wobble: 6, tremor: 0 }, 9);
    const ys = s.points.map(p => p[1]);
    expect(Math.max(...ys.map(Math.abs))).toBeGreaterThan(1);
    for (let k = 1; k < ys.length; k++) expect(Math.abs(ys[k]! - ys[k - 1]!)).toBeLessThan(1);
  });

  it('measures the wobbled path, not the clean one', () => {
    const s = prepareStroke(ellipsePoints(0, 0, 100, 100), { ...style, wobble: 8 }, 2);
    expect(s.length).toBeCloseTo(polylineLength(s.points), 6);
  });
});

describe('strokeOutline', () => {
  it('draws nothing at 0 and reaches both ends at 1', () => {
    const s = prepareStroke(path, style, 1);
    expect(strokeOutline(s, 0)).toEqual([]);
    const [x0, , w] = bounds(strokeOutline(s, 1));
    expect(x0).toBeLessThan(2);
    expect(x0 + w).toBeGreaterThan(398);
  });

  it('grows with progress', () => {
    const s = prepareStroke(path, style, 1);
    const reach = (p: number) => { const [x, , w] = bounds(strokeOutline(s, p)); return x + w; };
    expect(reach(0.25)).toBeLessThan(reach(0.5));
    expect(reach(0.5)).toBeLessThan(reach(1));
    expect(reach(0.5)).toBeGreaterThan(190);
    expect(reach(0.5)).toBeLessThan(215);
  });

  it('varies in width along the stroke', () => {
    const s = prepareStroke(path, { ...style, pressureVariation: 1, thinning: 0.8 }, 5);
    expect(Math.max(...s.pressures) - Math.min(...s.pressures)).toBeGreaterThan(0.2);
  });
});

describe('schedule', () => {
  it('orders strokes by one hand at constant speed', () => {
    const strokes = [prepareStroke(path, style, 1), prepareStroke([[0, 0], [200, 0]], style, 2)];
    const slots = strokeSchedule(strokes, 1, 400, 0.1);
    expect(slots[0]!.start).toBe(1);
    expect(slots[1]!.start).toBeCloseTo(1 + strokes[0]!.length / 400 + 0.1);
    expect(scheduledProgress(slots[0]!, 0.5)).toBe(0);
    expect(scheduledProgress(slots[0]!, 100)).toBe(1);
  });
});
