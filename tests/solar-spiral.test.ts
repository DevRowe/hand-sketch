import { describe, expect, it } from 'vitest';
import { parseAspect } from '../src/core/stage';
import { posterFrame, toFrames, type Program } from '../src/core/scene';
import { programById, PROGRAM_IDS } from '../src/scenes/demo';
import { SOLAR_CATALOG } from '../src/scenes/solar';
import { PLANETS as PLAN, LOOP as PLAN_LOOP, POSTER_M as PLAN_POSTER } from '../src/scenes/solar/common';
import { SPIRAL_CATALOG, spiralScenes } from '../src/scenes/solar-spiral';
import { behind, dust, E1, E2, INTRO, litShape, loopSnapshot, LOOP, MOON, MOTION, paint, PLANETS, POSTER_M, project, reveal, runs, shadeAt, SPEED, SUB, type Snapshot } from '../src/scenes/solar-spiral/common';

const dot = (a: readonly number[], b: readonly number[]): number => a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!;

describe('spiral set', () => {
  it('catalogues exactly the ten scenes, SP01..SP10, each as a loop program', () => {
    expect(SPIRAL_CATALOG.map(e => e.id)).toEqual(Array.from({ length: 10 }, (_, k) => `SP${String(k + 1).padStart(2, '0')}`));
    expect(Object.keys(spiralScenes).sort()).toEqual(SPIRAL_CATALOG.map(e => e.scene).sort());
    for (const e of SPIRAL_CATALOG) {
      expect(PROGRAM_IDS).toContain(`loop:${e.scene}`);
      const p: Program = programById(`loop:${e.scene}`);
      expect(p.kind).toBe('loop');
    }
  });

  it('pairs one to one with the top-down set: the same ten styles in the same order, the same hero', () => {
    expect(SPIRAL_CATALOG.map(e => e.title)).toEqual(SOLAR_CATALOG.map(e => e.title));
    expect(SPIRAL_CATALOG.findIndex(e => e.autoplay)).toBe(SOLAR_CATALOG.findIndex(e => e.autoplay));
    expect(SPIRAL_CATALOG.filter(e => e.autoplay)).toHaveLength(1);
    expect(new Set(SPIRAL_CATALOG.map(e => e.theme)).size).toBe(10);
  });

  it('runs the top-down clock after a short intro, every poster on the same moment of it', () => {
    expect(LOOP).toBe(PLAN_LOOP);
    expect(POSTER_M).toBe(PLAN_POSTER);
    for (const e of SPIRAL_CATALOG) {
      const scene = spiralScenes[e.scene]!;
      const from = toFrames(scene.loopFrom!, 12), end = toFrames(scene.duration, 12), poster = posterFrame(scene, 12);
      expect(from, e.id).toBe(INTRO);
      expect(end - from, e.id).toBe(LOOP);
      expect(poster - from, e.id).toBe(POSTER_M);
    }
  });

  it('gives every piece a format, a line and alt text, in plain punctuation', () => {
    for (const e of SPIRAL_CATALOG) {
      expect(parseAspect(e.ar), e.id).toBeGreaterThan(0);
      expect(e.width % 2, e.id).toBe(0);
      expect(e.line.length, e.id).toBeGreaterThan(8);
      expect(e.line.length, e.id).toBeLessThan(90);
      expect(e.alt.startsWith('Sketch'), e.id).toBe(true);
      for (const text of [e.title, e.theme, e.line, e.idea, e.loop, e.poster, e.alt]) expect(text, e.id).not.toMatch(/\u2014/);
    }
  });
});

describe('spiral geometry', () => {
  it('keeps the plan: the same planets, turns and starting angles as the top-down set', () => {
    expect(PLANETS.map(p => [p.name, p.turns, p.at0])).toEqual(PLAN.map(p => [p.name, p.turns, p.at0]));
    for (let k = 1; k < PLANETS.length; k++) expect(PLANETS[k]!.a).toBeGreaterThan(PLANETS[k - 1]!.a);
    // inner wakes are short tight coils, outer ones long lazy turns, none older than the loop
    for (let k = 1; k < PLANETS.length; k++) expect(PLANETS[k]!.trail).toBeGreaterThanOrEqual(PLANETS[k - 1]!.trail);
    for (const p of PLANETS) expect(p.trail).toBeLessThanOrEqual(LOOP);
    expect(MOON.trail).toBeLessThan(LOOP);
  });

  it('squares the orbital plane to the motion and tilts it towards the camera', () => {
    for (const v of [MOTION, E1, E2]) expect(dot(v, v)).toBeCloseTo(1, 12);
    expect(dot(MOTION, E1)).toBeCloseTo(0, 12);
    expect(dot(MOTION, E2)).toBeCloseTo(0, 12);
    expect(dot(E1, E2)).toBeCloseTo(0, 12);
    // the Sun comes out of the page, so its wake recedes; the plane is tipped 55 to 70 degrees from face-on
    expect(MOTION[2]).toBeLessThan(0);
    const tilt = Math.acos(-MOTION[2]) * 180 / Math.PI;
    expect(tilt).toBeGreaterThan(55);
    expect(tilt).toBeLessThan(70);
  });

  it('traces a helix: one year back along a wake is exactly one pitch back along the Sun\'s line', () => {
    const m = 100, S = loopSnapshot(m), merc = S.bodies[0]!, year = LOOP / merc.planet.turns;
    const sample = S.trails[0]!.samples[year * SUB]!, want = project(behind(merc.p, year));
    expect(sample.x).toBeCloseTo(want.x, 9);
    expect(sample.y).toBeCloseTo(want.y, 9);
    expect(sample.z).toBeCloseTo(want.z, 9);
    expect(SPEED * year).toBeGreaterThan(2 * merc.planet.a);
  });

  it('closes the loop exactly: the seam frame repeats the first, wakes, bodies and dust alike', () => {
    const scene = (S: Snapshot): Partial<Snapshot> => ({ sun: S.sun, bodies: S.bodies, moon: S.moon, trails: S.trails, sunTrail: S.sunTrail, rocks: S.rocks });
    expect(scene(loopSnapshot(LOOP))).toEqual(scene(loopSnapshot(0)));
    expect(dust(loopSnapshot(LOOP))).toEqual(dust(loopSnapshot(0)));
    // the intro counts back into the loop without a jump; only the wakes are still unspooling
    const a = loopSnapshot(-1), b = loopSnapshot(LOOP - 1);
    expect(a.bodies).toEqual(b.bodies);
    expect(a.moon).toEqual(b.moon);
    expect(reveal(-INTRO)).toBe(0);
    expect(reveal(0)).toBe(1);
  });

  it('paints back to front: far wakes and bodies before the Sun, near ones after', () => {
    const S = loopSnapshot(POSTER_M), log: string[] = [];
    paint(S, {
      run: (_t, _r, near) => log.push(near ? 'near' : 'far'),
      body: b => log.push(b.near ? 'near' : 'far'),
      sun: () => log.push('sun'),
    });
    const sun = log.indexOf('sun');
    expect(log.slice(0, sun).every(x => x === 'far')).toBe(true);
    expect(log.slice(sun + 1).every(x => x === 'near')).toBe(true);
    expect(log.filter(x => x === 'near').length).toBeGreaterThan(8);
    for (const t of S.trails) for (const r of runs(t.samples)) expect(r.run.every((s, i) => i === 0 || i === r.run.length - 1 || s.near === r.near)).toBe(true);
  });

  it('lights each sphere by its true phase', () => {
    const area = (pts: readonly (readonly [number, number])[]): number => Math.abs(pts.reduce((acc, [x, y], i) => {
      const [x1, y1] = pts[(i + 1) % pts.length]!;
      return acc + x * y1 - x1 * y;
    }, 0)) / 2;
    expect(area(litShape(10, 0.3, 1, 64))).toBeCloseTo(Math.PI * 100, 0);
    expect(area(litShape(10, 0.3, 0, 64))).toBeCloseTo((Math.PI * 100) / 2, 0);
    expect(area(litShape(10, 0.3, -1, 64))).toBeCloseTo(0, 6);
    // a planet straight between the Sun and the viewer shows its night side
    expect(shadeAt(0, 0, [0, 0, 1])).toBe(0);
    expect(shadeAt(0, 0, [0, 0, -1])).toBe(1);
  });
});
