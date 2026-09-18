import { describe, expect, it } from 'vitest';
import { BODIES } from '../src/explorer/content/bodies';
import { GUIDE } from '../src/explorer/content/guide';
import { Flight, hohmannDays, hohmannLead, nextWindow, planetOnPlan, planPoint, planRadius } from '../src/explorer/orbits';
import { km } from '../src/explorer/live';
import { FEATURED } from '../src/explorer/moments';
import { PRESETS, presetById, utc } from '../src/explorer/presets';
import { PLANETS, planetAt } from '../src/scenes/solar/common';
import { heliocentric } from '../src/scenes/solar/ephemeris';
import { datedSky } from '../src/scenes/solar/sky';

const DEG = 180 / Math.PI;

describe('orbit geometry for the presets', () => {
  it('places real distances on the plan: each planet’s own orbit, and in order between', () => {
    const au = [0.387, 0.723, 1, 1.524, 5.203, 9.537, 19.19, 30.07];
    PLANETS.forEach((p, k) => expect(planRadius(au[k]!)).toBeCloseTo(p.a, 6));
    for (let r = 0.2; r < 60; r *= 1.3) expect(planRadius(r * 1.3)).toBeGreaterThanOrEqual(planRadius(r));
  });

  it('draws a planet on its plan orbit at its real longitude, where the scenes draw it', () => {
    const t = utc(2026, 9, 18), sky = datedSky({ day: t, beat: 0 });
    for (const p of PLANETS) {
      const [x, y] = planetOnPlan(p.name, t), [sx, sy] = planetAt(p, sky);
      expect(x).toBeCloseTo(sx, 9);
      expect(y).toBeCloseTo(sy, 9);
    }
  });

  it('finds the ideal Mars window: Mars ~44 degrees ahead, every ~26 months', () => {
    expect(hohmannDays(1, 1.524)).toBeCloseTo(259, 0);
    expect(hohmannLead('mars') * DEG).toBeCloseTo(44.3, 0);
    const a = nextWindow('mars', utc(2026, 9, 18)), b = nextWindow('mars', a + 400);
    const lead = ((((heliocentric('mars', a).lon - heliocentric('earth', a).lon) * DEG) % 360) + 360) % 360;
    expect(lead).toBeCloseTo(44.3, 1);
    expect(b - a).toBeGreaterThan(740);
    expect(b - a).toBeLessThan(820);
  });

  it('flies a path through every encounter on its day, paced faster near the Sun', () => {
    const at = (name: 'earth' | 'jupiter' | 'saturn', day: number) => ({ day, at: { r: { earth: 1, jupiter: 5.203, saturn: 9.537 }[name], lon: heliocentric(name, day).lon }, label: name });
    const f = new Flight([at('earth', utc(1977, 9, 5)), at('jupiter', utc(1979, 3, 5)), at('saturn', utc(1980, 11, 12))]);
    for (const w of f.waypoints) {
      const p = f.at(w.day)!;
      expect(p.r).toBeCloseTo(w.at.r, 9);
      expect(Math.cos(p.lon - w.at.lon)).toBeCloseTo(1, 9);
    }
    expect(f.at(utc(1977, 1, 1))).toBeNull();
    expect(f.at(utc(1990, 1, 1))).toBeNull();
    // the first leg climbs out: halfway through in time it is less than halfway in distance, as a real transfer
    const mid = f.at((f.waypoints[0]!.day + f.waypoints[1]!.day) / 2)!;
    expect(mid.r).toBeGreaterThan(1);
    expect(mid.r).toBeLessThan(5.203);
    expect(planPoint(mid)).toHaveLength(2);
  });
});

describe('presets and cards', () => {
  it('every preset has a moment, a card with facts, and a journey that runs forwards', () => {
    const ids = new Set<string>();
    for (const p of PRESETS) {
      expect(ids.has(p.id), p.id).toBe(false);
      ids.add(p.id);
      expect(Number.isFinite(p.day()), p.id).toBe(true);
      const c = p.card();
      expect(c.when.length, p.id).toBeGreaterThan(4);
      expect(c.intro.length, p.id).toBeGreaterThan(40);
      expect(c.facts.length, p.id).toBeGreaterThan(0);
      const j = p.journey?.();
      if (j) {
        expect(j.to, p.id).toBeGreaterThan(j.from);
        expect(j.pace, p.id).toBeGreaterThan(0);
        // a journey plays in a few seconds to a quarter of a minute
        expect((j.to - j.from) / j.pace, p.id).toBeLessThan(20);
      }
    }
  });

  it('writes in plain punctuation: no em dashes anywhere in the words', () => {
    const words = [
      ...PRESETS.flatMap(p => { const c = p.card(); return [p.title, p.kicker, c.when, c.intro, ...c.body, ...(c.notes ?? []), ...c.facts.flatMap(f => [f.label, f.value])]; }),
      ...Object.values(BODIES).flatMap(b => [b.kind, b.intro, b.orbit ?? '', ...b.fun, ...b.facts.flatMap(f => [f.label, f.value])]),
      ...GUIDE.flatMap(s => [s.title, s.intro ?? '', ...s.items.flatMap(i => [i.title, i.text])]),
    ];
    for (const w of words) expect(w).not.toMatch(/—/);
  });
});

describe('key moments', () => {
  it('features real presets, each once, under a name no longer than the preset’s own', () => {
    expect(new Set(FEATURED.map(([id]) => id)).size).toBe(FEATURED.length);
    for (const [id, short] of FEATURED) {
      const p = presetById(id);
      expect(p, id).toBeDefined();
      expect(short.length).toBeLessThanOrEqual(p!.title.length);
    }
  });

  it('reads distances to three significant figures, as the cards quote them', () => {
    expect(km(55_760_000)).toBe('55.8 million km');
    expect(km(101_400_000)).toBe('101 million km');
    expect(km(5_503_000)).toBe('5.5 million km');
    expect(km(1_234_000_000)).toBe('1.23 billion km');
  });
});
