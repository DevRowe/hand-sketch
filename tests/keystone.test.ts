import { describe, expect, it } from 'vitest';
import { parseAspect } from '../src/core/stage';
import { posterFrame, toFrames, type Program } from '../src/core/scene';
import { programById, PROGRAM_IDS } from '../src/scenes/demo';
import { KEYSTONE_CATALOG, keystoneScenes } from '../src/scenes/keystone';

describe('Keystone set', () => {
  it('catalogues exactly the ten scenes, K01..K10, each as a loop program', () => {
    expect(KEYSTONE_CATALOG.map(e => e.id)).toEqual(Array.from({ length: 10 }, (_, k) => `K${String(k + 1).padStart(2, '0')}`));
    expect(Object.keys(keystoneScenes).sort()).toEqual(KEYSTONE_CATALOG.map(e => e.scene).sort());
    for (const e of KEYSTONE_CATALOG) {
      expect(PROGRAM_IDS).toContain(`loop:${e.scene}`);
      const p: Program = programById(`loop:${e.scene}`);
      expect(p.kind).toBe('loop');
    }
  });

  it('only the hero autoplays', () => {
    expect(KEYSTONE_CATALOG.filter(e => e.autoplay).map(e => e.id)).toEqual(['K01']);
  });

  it('gives every scene a 36-frame loop, a poster inside the scene, a format and alt text', () => {
    for (const e of KEYSTONE_CATALOG) {
      const scene = keystoneScenes[e.scene]!;
      expect(scene.loopFrom, e.id).toBeDefined();
      expect(toFrames(scene.duration, 12) - toFrames(scene.loopFrom!, 12), e.id).toBe(36);
      const poster = posterFrame(scene, 12);
      expect(poster, e.id).toBeGreaterThan(0);
      expect(poster, e.id).toBeLessThan(toFrames(scene.duration, 12));
      expect(parseAspect(e.ar), e.id).toBeGreaterThan(0);
      expect(e.width % 2, e.id).toBe(0);
      expect(e.alt.startsWith('Sketch: '), e.id).toBe(true);
      expect(e.metaphor.length, e.id).toBeGreaterThan(20);
    }
  });
});
