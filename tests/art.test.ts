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

describe('keystone roles', () => {
  it('uses a near-neutral stock, not cream, and tints of one accent', async () => {
    const { KEYSTONE_ROLES, roleStrokes, rolePalette } = await import('../src/art/roles');
    const [r, g, b] = parseColor(PALETTES.keystone.paper);
    expect(Math.max(r, g, b) - Math.min(r, g, b)).toBeLessThan(8);
    const hue = (c: string) => { const [R, G, B] = parseColor(c); return Math.atan2(Math.sqrt(3) * (G - B), 2 * R - G - B); };
    for (const c of PALETTES.keystone.accents) expect(Math.abs(hue(c) - hue(KEYSTONE_ROLES.accent))).toBeLessThan(0.12);
    const s = roleStrokes(KEYSTONE_ROLES);
    expect(s.FLOW.color).toBe(KEYSTONE_ROLES.accent);
    // the automation line is the calmer hand
    expect(s.FLOW.tremor!).toBeLessThan(s.PENCIL.tremor!);
    expect(s.FLOW.pressureVariation!).toBeLessThan(s.PENCIL.pressureVariation!);
    expect(rolePalette(KEYSTONE_ROLES).paper).toBe(KEYSTONE_ROLES.stock);
  });
});

describe('glyph kit', () => {
  it('is deterministic per seed and centred on its origin', async () => {
    const { sheet, envelope, squiggle } = await import('../src/art/glyphs');
    expect(sheet(80, 100, 3)).toEqual(sheet(80, 100, 3));
    expect(squiggle(0, 100, 0, 1)).not.toEqual(squiggle(0, 100, 0, 2));
    const pts = envelope(120, 80, 5).outline.flat();
    const xs = pts.map(p => p[0]);
    expect(Math.abs(Math.min(...xs) + Math.max(...xs))).toBeLessThan(12);
  });

  it('writes cursive that loops back on itself and stays on its line', async () => {
    const { cursive } = await import('../src/art/glyphs');
    const word = cursive(0, 120, 0, 7, { height: 10, step: 9 });
    expect(word).toEqual(cursive(0, 120, 0, 7, { height: 10, step: 9 }));
    // loops: x runs backwards somewhere, as a pen does going round an "e"
    expect(word.some((p, k) => k > 0 && p[0] < word[k - 1]![0] - 0.5)).toBe(true);
    const ys = word.map(p => p[1]), xs = word.map(p => p[0]);
    expect(Math.max(...ys)).toBeLessThan(4);
    expect(Math.min(...ys)).toBeGreaterThan(-22);
    expect(Math.max(...xs)).toBeLessThan(140);
  });
});
