import { describe, expect, it } from 'vitest';
import { bounds, ellipsePoints, polylineLength } from '../src/core/geometry';
import { prepareMorph, prepareStroke, sampleStroke, scheduledProgress, strokeOutline, strokeRangeOutlines, strokeSchedule } from '../src/core/stroke';
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

describe('stroke ranges', () => {
  const s = prepareStroke(path, style, 1);
  const span = (outline: Vec2[]) => { const [x, , w] = bounds(outline); return [x, x + w] as const; };

  it('draws only the requested sub-range, with both cut ends tapered inside it', () => {
    const [part] = strokeRangeOutlines(s, 0.25, 0.5);
    const [x0, x1] = span(part!);
    expect(x0).toBeGreaterThan(95);
    expect(x1).toBeLessThan(205);
    expect(strokeRangeOutlines(s, 0.5, 0.5)).toEqual([]);
    expect(strokeRangeOutlines(s, 0.6, 0.4)).toEqual([]);
  });

  it('matches the reveal outline when the range starts at 0', () => {
    expect(strokeRangeOutlines(s, 0, 0.7)[0]).toEqual(strokeOutline(s, 0.7));
  });

  it('wraps across the join of a closed stroke as one piece', () => {
    const ring = prepareStroke(ellipsePoints(0, 0, 100, 100, { start: 0 }), style, 3, { closed: true });
    expect(ring.closed).toBe(true);
    expect(ring.points[0]).toEqual(ring.points[ring.points.length - 1]);
    const wrapped = strokeRangeOutlines(ring, 0.9, 1.1);
    expect(wrapped).toHaveLength(1);
    // centred on angle 0 (the point [100, 0]): the dash straddles the x axis
    const [, y, , h] = bounds(wrapped[0]!);
    expect(y).toBeLessThan(-40);
    expect(y + h).toBeGreaterThan(40);
    expect(strokeRangeOutlines(prepareStroke(path, style, 1), 0.9, 1.1)[0]).toEqual(strokeRangeOutlines(prepareStroke(path, style, 1), 0.9, 1)[0]);
  });

  it('keeps wobble continuous across the join of a closed stroke', () => {
    const ring = prepareStroke(ellipsePoints(0, 0, 200, 120, { start: 0 }), { ...style, wobble: 8 }, 11, { closed: true });
    const a = ring.points[1]!, b = ring.points[ring.points.length - 2]!, o = ring.points[0]!;
    expect(Math.hypot(a[0] - o[0], a[1] - o[1])).toBeLessThan(5);
    expect(Math.hypot(b[0] - o[0], b[1] - o[1])).toBeLessThan(5);
  });
});

describe('sampleStroke', () => {
  it('sits on the wobbled ink and points along it', () => {
    const s = prepareStroke(path, { ...style, wobble: 6 }, 4);
    const mid = sampleStroke(s, 0.5);
    const nearest = Math.min(...s.points.map(p => Math.hypot(p[0] - mid.point[0], p[1] - mid.point[1])));
    expect(nearest).toBeLessThan(3);
    expect(mid.tangent[0]).toBeGreaterThan(0.9);
    expect(Math.hypot(...mid.normal)).toBeCloseTo(1, 6);
    expect(mid.tangent[0] * mid.normal[0] + mid.tangent[1] * mid.normal[1]).toBeCloseTo(0, 6);
    expect(sampleStroke(s, 2).point).toEqual(s.points[s.points.length - 1]);
  });

  it('wraps on closed strokes', () => {
    const ring = prepareStroke(ellipsePoints(0, 0, 100, 100), style, 3, { closed: true });
    expect(sampleStroke(ring, 1.25).point[0]).toBeCloseTo(sampleStroke(ring, 0.25).point[0], 6);
    expect(sampleStroke(ring, -0.75).point[1]).toBeCloseTo(sampleStroke(ring, 0.25).point[1], 6);
  });
});

describe('prepareMorph', () => {
  const zigzag: Vec2[] = [[0, 0], [100, 120], [200, -80], [300, 100], [400, 0]];

  it('ends exactly on the prepared target stroke', () => {
    const morph = prepareMorph(zigzag, path, style, 8);
    expect(morph(1).points).toEqual(prepareStroke(path, style, 8).points);
    expect(morph(0).points).toHaveLength(morph(1).points.length);
  });

  it('keeps the hand steady: wobble offsets do not jump between neighbouring morph frames', () => {
    const morph = prepareMorph(zigzag, path, { ...style, wobble: 5, tremor: 0.5 }, 8);
    const a = morph(0.8), b = morph(0.84);
    const worst = Math.max(...a.points.map((p, k) => Math.hypot(p[0] - b.points[k]![0], p[1] - b.points[k]![1])));
    expect(worst).toBeLessThan(15);
  });
});
