import { describe, expect, it } from 'vitest';
import { PALETTES } from '../src/art/palette';
import { parseAspect } from '../src/core/stage';
import { posterFrame, toFrames, type Program } from '../src/core/scene';
import { programById, PROGRAM_IDS } from '../src/scenes/demo';
import { SOLAR_CATALOG, solarScenes } from '../src/scenes/solar';
import { BELT, cyclePhase, LOOP, MOON, moonOffset, orbitAngle, PLANETS, planetAt, POSTER_M, RINGS, ROCKS, rockAt, SUN_R, URANUS_RING } from '../src/scenes/solar/common';
import { SOLAR } from '../src/scenes/solar/palettes';

describe('solar set', () => {
  it('catalogues exactly the ten scenes, S01..S10, each as a loop program', () => {
    expect(SOLAR_CATALOG.map(e => e.id)).toEqual(Array.from({ length: 10 }, (_, k) => `S${String(k + 1).padStart(2, '0')}`));
    expect(Object.keys(solarScenes).sort()).toEqual(SOLAR_CATALOG.map(e => e.scene).sort());
    for (const e of SOLAR_CATALOG) {
      expect(PROGRAM_IDS).toContain(`loop:${e.scene}`);
      const p: Program = programById(`loop:${e.scene}`);
      expect(p.kind).toBe('loop');
    }
  });

  it('has one hero and ten distinct styles and themes', () => {
    expect(SOLAR_CATALOG.filter(e => e.autoplay)).toHaveLength(1);
    expect(new Set(SOLAR_CATALOG.map(e => e.title)).size).toBe(10);
    expect(new Set(SOLAR_CATALOG.map(e => e.theme)).size).toBe(10);
  });

  it('runs one shared loop and rests every poster on the same configuration inside it', () => {
    for (const e of SOLAR_CATALOG) {
      const scene = solarScenes[e.scene]!;
      expect(scene.loopFrom, e.id).toBeDefined();
      const from = toFrames(scene.loopFrom!, 12), end = toFrames(scene.duration, 12), poster = posterFrame(scene, 12);
      expect(end - from, e.id).toBe(LOOP);
      expect(poster - from, e.id).toBe(POSTER_M);
    }
  });

  it('gives every piece a format, a line and alt text, in plain punctuation', () => {
    for (const e of SOLAR_CATALOG) {
      expect(parseAspect(e.ar), e.id).toBeGreaterThan(0);
      expect(e.width % 2, e.id).toBe(0);
      expect(e.line.length, e.id).toBeGreaterThan(8);
      expect(e.line.length, e.id).toBeLessThan(90);
      expect(e.alt.startsWith('Sketch'), e.id).toBe(true);
      for (const text of [e.title, e.theme, e.line, e.idea, e.loop, e.poster, e.alt]) expect(text, e.id).not.toMatch(/\u2014/);
    }
  });
});

describe('solar geometry', () => {
  it('orders the planets outward, inner ones faster, every one a whole number of turns per loop', () => {
    for (let k = 1; k < PLANETS.length; k++) {
      expect(PLANETS[k]!.a).toBeGreaterThan(PLANETS[k - 1]!.a);
      expect(PLANETS[k]!.turns).toBeLessThan(PLANETS[k - 1]!.turns);
    }
    for (const t of [...PLANETS.map(p => p.turns), MOON.turns, ...ROCKS.map(r => r.turns)]) expect(Number.isInteger(t)).toBe(true);
    expect(PLANETS.find(p => p.name === 'jupiter')!.r).toBe(Math.max(...PLANETS.map(p => p.r)));
  });

  it('closes every orbit exactly on the seam frame, not just up to rounding', () => {
    for (const p of PLANETS) expect(planetAt(p, LOOP)).toEqual(planetAt(p, 0));
    expect(moonOffset(LOOP)).toEqual(moonOffset(0));
    for (const rk of ROCKS) expect(rockAt(rk, LOOP)).toEqual(rockAt(rk, 0));
    for (const c of [1, 3, 7]) expect(cyclePhase(c, LOOP)).toBe(cyclePhase(c, 0));
    // an intro counts back from the loop start without a jump
    expect(orbitAngle(5, 1, -1)).toBeCloseTo(orbitAngle(5, 1, LOOP - 1), 12);
  });

  it('keeps neighbouring bodies clear of each other whatever their positions', () => {
    const reach = (k: number): number => {
      const p = PLANETS[k]!;
      if (p.name === 'saturn') return RINGS.outer;
      if (p.name === 'uranus') return URANUS_RING.rx;
      if (p.name === 'earth') return MOON.a + MOON.r;
      return p.r;
    };
    expect(PLANETS[0]!.a - reach(0)).toBeGreaterThan(SUN_R + 10);
    for (let k = 1; k < PLANETS.length; k++) expect(PLANETS[k]!.a - PLANETS[k - 1]!.a, PLANETS[k]!.name).toBeGreaterThan(reach(k) + reach(k - 1));
    const mars = PLANETS.find(p => p.name === 'mars')!, jupiter = PLANETS.find(p => p.name === 'jupiter')!;
    expect(BELT.inner).toBeGreaterThan(mars.a + mars.r);
    expect(BELT.outer).toBeLessThan(jupiter.a - jupiter.r);
    expect(PLANETS[PLANETS.length - 1]!.a + reach(PLANETS.length - 1)).toBeLessThan(540);
  });
});

describe('solar palettes', () => {
  it('keep the full palette schema', () => {
    const keys = Object.keys(PALETTES.paperInk).sort();
    for (const [name, pal] of Object.entries(SOLAR)) expect(Object.keys(pal).sort(), name).toEqual(keys);
  });
});
