import { describe, expect, it } from 'vitest';
import { MOODS } from '../src/art/moods';
import { PALETTES } from '../src/art/palette';
import { parseAspect } from '../src/core/stage';
import { posterFrame, toFrames, type Program } from '../src/core/scene';
import { programById, PROGRAM_IDS } from '../src/scenes/demo';
import { POETIC_CATALOG, poeticScenes } from '../src/scenes/poetic';

describe('poetic set', () => {
  it('catalogues exactly the ten scenes, P01..P10, each as a loop program', () => {
    expect(POETIC_CATALOG.map(e => e.id)).toEqual(Array.from({ length: 10 }, (_, k) => `P${String(k + 1).padStart(2, '0')}`));
    expect(Object.keys(poeticScenes).sort()).toEqual(POETIC_CATALOG.map(e => e.scene).sort());
    for (const e of POETIC_CATALOG) {
      expect(PROGRAM_IDS).toContain(`loop:${e.scene}`);
      const p: Program = programById(`loop:${e.scene}`);
      expect(p.kind).toBe('loop');
    }
  });

  it('has one hero and ten distinct themes', () => {
    expect(POETIC_CATALOG.filter(e => e.autoplay)).toHaveLength(1);
    expect(new Set(POETIC_CATALOG.map(e => e.theme)).size).toBe(10);
  });

  it('rests every poster inside its loop section, so the board can stop on it after any pass', () => {
    for (const e of POETIC_CATALOG) {
      const scene = poeticScenes[e.scene]!;
      expect(scene.loopFrom, e.id).toBeDefined();
      const from = toFrames(scene.loopFrom!, 12), end = toFrames(scene.duration, 12), poster = posterFrame(scene, 12);
      expect(end - from, e.id).toBeGreaterThanOrEqual(36);
      expect(poster, e.id).toBeGreaterThanOrEqual(from);
      expect(poster, e.id).toBeLessThan(end);
    }
  });

  it('gives every piece a title, a line, a format and alt text, in plain punctuation', () => {
    for (const e of POETIC_CATALOG) {
      expect(parseAspect(e.ar), e.id).toBeGreaterThan(0);
      expect(e.width % 2, e.id).toBe(0);
      expect(e.title.length, e.id).toBeGreaterThan(2);
      expect(e.line.length, e.id).toBeGreaterThan(8);
      expect(e.line.length, e.id).toBeLessThan(90);
      expect(e.alt.startsWith('Sketch: '), e.id).toBe(true);
      for (const text of [e.title, e.line, e.arc, e.loop, e.poster, e.alt]) expect(text, e.id).not.toMatch(/—/);
    }
  });
});

describe('mood palettes', () => {
  it('keep the full palette schema', () => {
    const keys = Object.keys(PALETTES.paperInk).sort();
    for (const [name, mood] of Object.entries(MOODS)) expect(Object.keys(mood).sort(), name).toEqual(keys);
  });
});
