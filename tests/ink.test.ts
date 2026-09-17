import { describe, expect, it } from 'vitest';
import { scheduleEnd, scheduleWithin, type StrokeGroup } from '../src/core/ink';
import type { Vec2 } from '../src/core/math';

describe('scheduleWithin', () => {
  // regression: many short strokes used to be clamped to a minimum duration and overran their window
  it('fits many strokes inside the window', () => {
    const paths: Vec2[][] = Array.from({ length: 80 }, (_, k) => [[k * 10, 0], [k * 10 + 300, 200]]);
    const group: StrokeGroup = { paths, style: { color: '#000', size: 2 }, seed: 1 };
    const slots = scheduleWithin(group, 3.9, 5.0, 0.01);
    expect(slots).toHaveLength(80);
    expect(slots[0]!.start).toBe(3.9);
    expect(scheduleEnd(slots)).toBeCloseTo(5.0, 6);
    for (let k = 1; k < slots.length; k++) expect(slots[k]!.start).toBeGreaterThanOrEqual(slots[k - 1]!.start + slots[k - 1]!.duration);
  });
});
