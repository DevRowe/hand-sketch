import { describe, expect, it } from 'vitest';
import { PALETTES } from '../src/art/palette';
import { parseAspect } from '../src/core/stage';
import { posterFrame, toFrames, type Program } from '../src/core/scene';
import { programById, PROGRAM_IDS } from '../src/scenes/demo';
import { GALLERY_CATALOG, galleryScenes } from '../src/scenes/gallery';
import { GALLERY } from '../src/scenes/gallery/palettes';

describe('gallery set', () => {
  it('catalogues every gallery scene in order, G01.., each as a loop program', () => {
    expect(GALLERY_CATALOG.map(e => e.id)).toEqual(GALLERY_CATALOG.map((_, k) => `G${String(k + 1).padStart(2, '0')}`));
    expect(Object.keys(galleryScenes).sort()).toEqual(GALLERY_CATALOG.map(e => e.scene).sort());
    for (const e of GALLERY_CATALOG) {
      expect(PROGRAM_IDS).toContain(`loop:${e.scene}`);
      const p: Program = programById(`loop:${e.scene}`);
      expect(p.kind).toBe('loop');
    }
  });

  it('has one hero and distinct subjects and titles', () => {
    expect(GALLERY_CATALOG.filter(e => e.autoplay)).toHaveLength(1);
    expect(new Set(GALLERY_CATALOG.map(e => e.theme)).size).toBe(GALLERY_CATALOG.length);
    expect(new Set(GALLERY_CATALOG.map(e => e.title)).size).toBe(GALLERY_CATALOG.length);
  });

  it('rests every poster inside its loop section, so the board can stop on it after any pass', () => {
    for (const e of GALLERY_CATALOG) {
      const scene = galleryScenes[e.scene]!;
      expect(scene.loopFrom, e.id).toBeDefined();
      const from = toFrames(scene.loopFrom!, 12), end = toFrames(scene.duration, 12), poster = posterFrame(scene, 12);
      expect(end - from, e.id).toBeGreaterThanOrEqual(36);
      expect(poster, e.id).toBeGreaterThanOrEqual(from);
      expect(poster, e.id).toBeLessThan(end);
    }
  });

  it('gives every piece a title, a line, a style, a format and alt text, in plain punctuation', () => {
    for (const e of GALLERY_CATALOG) {
      expect(parseAspect(e.ar), e.id).toBeGreaterThan(0);
      expect(e.width % 2, e.id).toBe(0);
      expect(e.title.length, e.id).toBeGreaterThan(2);
      expect(e.style.length, e.id).toBeGreaterThan(2);
      expect(e.line.length, e.id).toBeGreaterThan(8);
      expect(e.line.length, e.id).toBeLessThan(90);
      expect(e.alt.startsWith('Sketch'), e.id).toBe(true);
      for (const text of [e.title, e.line, e.idea, e.loop, e.poster, e.alt]) expect(text, e.id).not.toMatch(/—/);
    }
  });
});

describe('gallery palettes', () => {
  it('keep the full palette schema', () => {
    const keys = Object.keys(PALETTES.paperInk).sort();
    for (const [name, pal] of Object.entries(GALLERY)) expect(Object.keys(pal).sort(), name).toEqual(keys);
  });
});
