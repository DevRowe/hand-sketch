import { describe, expect, it } from 'vitest';
import { arcLengths, catmullRom, cutAtLength, ellipsePoints, polylineLength, resample } from '../src/core/geometry';
import type { Vec2 } from '../src/core/math';

const line: Vec2[] = [[0, 0], [100, 0], [100, 50]];

describe('geometry', () => {
  it('measures arc length', () => {
    expect(arcLengths(line)).toEqual([0, 100, 150]);
    expect(polylineLength(line)).toBe(150);
  });

  it('cuts exactly at a length, ending on the cut point', () => {
    const s = arcLengths(line);
    expect(cutAtLength(line, s, 0)).toEqual([]);
    expect(cutAtLength(line, s, 125)).toEqual([[0, 0], [100, 0], [100, 25]]);
    expect(polylineLength(cutAtLength(line, s, 150))).toBeCloseTo(150);
  });

  it('resamples evenly and keeps endpoints', () => {
    const r = resample(line, 10);
    expect(r[0]).toEqual([0, 0]);
    expect(r[r.length - 1]).toEqual([100, 50]);
    expect(polylineLength(r)).toBeCloseTo(150, 5);
  });

  it('catmull-rom passes through its control points', () => {
    const c = catmullRom(line, 4);
    expect(c[0]).toEqual([0, 0]);
    expect(c[4]![0]).toBeCloseTo(100);
    expect(c[c.length - 1]).toEqual([100, 50]);
  });

  it('ellipse overshoot adds length', () => {
    const one = polylineLength(ellipsePoints(0, 0, 100, 100, { turns: 1, n: 200 }));
    expect(one).toBeCloseTo(2 * Math.PI * 100, -1);
    expect(polylineLength(ellipsePoints(0, 0, 100, 100, { turns: 1.2, n: 200 }))).toBeGreaterThan(one * 1.15);
  });
});
