import { describe, expect, it } from 'vitest';
import { mix, parseColor, rotateHue } from '../src/art/color';
import { derivePalette, duotone, PALETTES } from '../src/art/palette';
import { sketch } from '../src/core/sketch';

describe('colour and palettes', () => {
  it('parses and mixes colours', () => {
    expect(parseColor('#f80')).toEqual([255, 136, 0]);
    expect(parseColor('rgba(1, 2, 3, .5)')).toEqual([1, 2, 3]);
    expect(mix('#000000', '#ffffff', 0.5)).toBe('#808080');
    expect(rotateHue('#ff0000', 120)).toBe('#00ff00');
  });

  it('derived and duotone palettes keep the full schema', () => {
    const keys = Object.keys(PALETTES.paperInk).sort();
    expect(Object.keys(derivePalette(PALETTES.risoPop, { hue: 40 })).sort()).toEqual(keys);
    expect(Object.keys(duotone('#ff48b0', '#0078bf')).sort()).toEqual(keys);
  });
});

describe('sketch (rough.js)', () => {
  it('is deterministic for a seed and refuses to run unseeded', () => {
    const a = sketch.rectangle(0, 0, 100, 60, { seed: 5 }), b = sketch.rectangle(0, 0, 100, 60, { seed: 5 });
    expect(a).toEqual(b);
    expect(a.outline.length).toBeGreaterThan(0);
    expect(() => sketch.rectangle(0, 0, 100, 60, { seed: 0 })).toThrow(/positive seed/);
  });

  it('exposes hachure fill lines as separate strokes', () => {
    const g = sketch.polygon([[0, 0], [200, 0], [200, 200], [0, 200]], { seed: 3, fill: 'x', fillStyle: 'hachure', hachureGap: 20 });
    expect(g.fill.length).toBeGreaterThan(5);
  });
});
