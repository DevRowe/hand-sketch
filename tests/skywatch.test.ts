import { describe, expect, it } from 'vitest';
import { pick } from '../src/explorer/bodies';
import { COMETS, cometAt, cometMarks, cometOnPlan, cometPath, ellipticAnomaly, hyperbolicAnomaly } from '../src/explorer/comets';
import { moonShadow } from '../src/explorer/eclipse';
import { moonPhase } from '../src/explorer/live';
import { planRadius } from '../src/explorer/orbits';
import { nextFull, nextNew, phaseSvg } from '../src/explorer/phase';
import { daylight, nextTurn, seasonOf, subsolarLatitude } from '../src/explorer/seasons';
import { guessLatitude, moonHtml, seasonsHtml, tonightHtml } from '../src/explorer/skysheet';
import { brightness, magnitude, tonight } from '../src/explorer/tonight';
import { hashOf, readUrl } from '../src/explorer/url';
import { dayOf, heliocentric } from '../src/scenes/solar/ephemeris';

const U = (y: number, m: number, d: number, h = 0, min = 0): number => dayOf(Date.UTC(y, m - 1, d, h, min));
const AU_KM = 149_597_870.7;

const xyz = (name: 'earth' | 'mars' | 'jupiter', day: number): number[] => {
  const h = heliocentric(name, day), c = Math.cos(h.lat);
  return [h.r * c * Math.cos(h.lon), h.r * c * Math.sin(h.lon), h.r * Math.sin(h.lat)];
};
/** The closest a comet comes to a planet within `span` days of `day`: [au, day]. */
function closest(comet: keyof typeof COMETS, planet: 'earth' | 'mars' | 'jupiter', day: number, span = 20): [number, number] {
  let best: [number, number] = [Infinity, day];
  for (let d = day - span; d <= day + span; d += 0.05) {
    const a = cometAt(COMETS[comet], d).xyz, b = xyz(planet, d), r = Math.hypot(a[0] - b[0]!, a[1] - b[1]!, a[2] - b[2]!);
    if (r < best[0]) best = [r, d];
  }
  return best;
}

describe('comets and interstellar visitors', () => {
  it('solves Kepler’s equation for a near-parabolic ellipse and a hyperbola', () => {
    for (const M of [-3, -1, -0.01, 0.001, 0.5, 2.9]) {
      const E = ellipticAnomaly(M, 0.9671);
      expect(Math.abs(E - 0.9671 * Math.sin(E) - M)).toBeLessThan(1e-10);
      const H = hyperbolicAnomaly(M * 40, 6.14);
      expect(Math.abs(6.14 * Math.sinh(H) - H - M * 40)).toBeLessThan(1e-8);
    }
  });

  it('passes Mars, the Earth and Jupiter where NASA says 3I/ATLAS did', () => {
    const [mars, dm] = closest('atlas', 'mars', U(2025, 10, 3));
    expect(mars * AU_KM / 1e6).toBeCloseTo(29, -0.5);
    expect(Math.abs(dm - U(2025, 10, 3))).toBeLessThan(1);
    const [earth, de] = closest('atlas', 'earth', U(2025, 12, 19));
    expect(earth).toBeCloseTo(1.8, 1);
    expect(Math.abs(de - U(2025, 12, 19))).toBeLessThan(2);
    const [jupiter, dj] = closest('atlas', 'jupiter', U(2026, 3, 16));
    expect(jupiter * AU_KM / 1e6).toBeCloseTo(54, -0.5);
    expect(Math.abs(dj - U(2026, 3, 16))).toBeLessThan(1);
    // found at ~4.5 au; round the Sun at 1.36 au and ~68 km/s; ~58 km/s far out
    expect(cometAt(COMETS.atlas, U(2025, 7, 1)).r).toBeCloseTo(4.5, 1);
    const peri = cometAt(COMETS.atlas, COMETS.atlas.perihelia[0]!);
    expect(peri.r).toBeCloseTo(1.356, 3);
    expect(peri.speed).toBeCloseTo(68.3, 0);
    expect(cometAt(COMETS.atlas, U(2040, 1, 1)).speed).toBeCloseTo(58, 0);
  });

  it('brings Halley round the Sun on its real dates, past the Earth where it passed in 1910 and 1986', () => {
    for (const t of COMETS.halley.perihelia) expect(cometAt(COMETS.halley, t).r).toBeCloseTo(0.586, 3);
    // the recorded laps ran 74 to 79 years; the one predicted after 2061 is shorter, ~72.7
    const laps = COMETS.halley.perihelia.slice(1).map((t, i) => (t - COMETS.halley.perihelia[i]!) / 365.25);
    for (const y of laps) {
      expect(y).toBeGreaterThan(72.5);
      expect(y).toBeLessThan(79.5);
    }
    expect(closest('halley', 'earth', U(1910, 5, 20))[0]).toBeCloseTo(0.15, 1);
    expect(closest('halley', 'earth', U(1986, 4, 11))[0]).toBeCloseTo(0.42, 1);
    // at the far end in December 2023, beyond Neptune, crawling
    const far = cometAt(COMETS.halley, U(2023, 12, 9));
    expect(far.r).toBeGreaterThan(34.9);
    expect(far.speed).toBeLessThan(1);
    // before the table and after it, the mean lap carries on
    expect(Number.isFinite(cometAt(COMETS.halley, U(1200, 1, 1)).r)).toBe(true);
    expect(cometAt(COMETS.halley, U(2800, 1, 1)).r).toBeLessThan(36);
  });

  it('shows Kepler’s second law along a path: a year’s dots bunched far out, spread wide near the Sun', () => {
    const path = cometPath(COMETS.halley, U(2026, 9, 19));
    expect(path.perihelia).toEqual([COMETS.halley.perihelia[6], COMETS.halley.perihelia[7]]);
    const r = (p: readonly [number, number]): number => Math.hypot(p[0] - 540, p[1] - 540);
    const inside = path.ticks.filter(p => r(p) < planRadius(5.2)).length, outside = path.ticks.filter(p => r(p) > planRadius(19.2)).length;
    expect(outside).toBeGreaterThan(8 * inside);
    // the whole pass of the visitor, within the plan
    const pass = cometPath(COMETS.atlas, U(2025, 10, 29));
    expect(pass.points.length).toBeGreaterThan(50);
    for (const p of pass.points) expect(r(p.at)).toBeLessThan(540);
  });

  it('marks the comets for picking only while they are on the plan', () => {
    const now = U(2026, 9, 19), marks = cometMarks(now);
    expect(marks.map(m => m.id)).toEqual(['halley', 'atlas']);
    const atlas = marks[1]!, id = (x: number, y: number) => pick({ bodies: marks, rocks: [] }, x, y, (a, b) => [a, b], 1)?.id;
    expect(id(atlas.x + 3, atlas.y)).toBe('atlas');
    expect(cometOnPlan(COMETS.atlas, U(2035, 1, 1))).toBeNull();
  });
});

describe('look up tonight', () => {
  it('reads the 2025 planet parade: four bright planets after sunset, Saturn lost in the glare', () => {
    const t = tonight(U(2025, 2, 28, 18)), side = (id: string) => t.planets.find(p => p.id === id)!;
    for (const id of ['venus', 'mars', 'jupiter']) expect(side(id).side, id).toBe('evening');
    expect(side('saturn').side).toBe('glare');
    expect(side('venus').bright).toBe('brilliant');
  });

  it('reads the sky of 19 September 2026: Venus in the evening, Saturn and Neptune up all night, Jupiter before dawn', () => {
    const t = tonight(U(2026, 9, 19, 20)), p = (id: string) => t.planets.find(s => s.id === id)!;
    expect(p('venus').side).toBe('evening');
    expect(p('venus').mag!).toBeLessThan(-4.4);
    expect(p('saturn').side).toBe('night');
    expect(p('neptune').where).toMatch(/opposite the Sun/);
    expect(p('jupiter').side).toBe('morning');
    expect(p('uranus').eye).toBe(false);
    expect(t.moon.side).toBe('evening');
    expect(t.moon.phase.waxing).toBe(true);
    const html = tonightHtml(U(2026, 9, 19, 20));
    expect(html).toContain('After sunset');
    expect(html).toContain('data-body="venus"');
  });

  it('gives magnitudes as the almanac does, in words anyone can use', () => {
    // Jupiter at its 2023 opposition (NASA: -2.9), Mars at its 2003 closest (-2.9)
    expect(magnitude('jupiter', 4.96, 3.97, 0)).toBeCloseTo(-2.9, 1);
    expect(magnitude('mars', 1.381, 0.3727, 5)).toBeCloseTo(-2.9, 0);
    expect(brightness(-4.5)).toBe('brilliant');
    expect(brightness(5.7)).toBe('binoculars');
    expect(brightness(7.8)).toBe('a telescope');
  });
});

describe('the Moon and eclipses', () => {
  it('finds the next new and full Moons', () => {
    expect(Math.abs(nextFull(U(2024, 9, 10)) - U(2024, 9, 18, 2, 34)) * 1440).toBeLessThan(20);
    expect(Math.abs(nextFull(U(2026, 9, 19)) - U(2026, 9, 26, 16, 49)) * 1440).toBeLessThan(20);
    expect(nextNew(U(2027, 8, 20))).toBeCloseTo(U(2027, 8, 31, 17, 41), 1);
    expect(moonHtml(U(2026, 9, 19))).toContain('Next full moon');
  });

  it('draws the phase: lit on the right while waxing, whole at full, dark at new', () => {
    expect(phaseSvg({ name: 'Full Moon', lit: 1, waxing: false })).toContain('<circle r="18" class="lit"/>');
    expect(phaseSvg({ name: 'New Moon', lit: 0, waxing: true })).not.toContain('class="lit"');
    // waxing crescent: the right-hand limb (sweep 1), the terminator back up bulging right (sweep 0)
    expect(phaseSvg({ name: 'Waxing crescent', lit: 0.2, waxing: true })).toMatch(/A18 18 0 0 1 0 18A10\.80 18 0 0 0 0 -18Z/);
    expect(moonPhase(U(2024, 9, 18, 2, 34)).name).toBe('Full Moon');
  });

  it('lets the Moon’s shadow fall on the Earth at real eclipses, and pass by at other new Moons', () => {
    const e2027 = moonShadow(U(2027, 8, 2, 10, 7))!;
    expect(e2027.kind).toBe('total');
    expect(e2027.miss).toBeLessThan(1500);
    expect(moonShadow(U(2024, 4, 8, 18, 17))!.kind).toBe('total');
    expect(moonShadow(U(2026, 8, 12, 17, 46))!.kind).toBe('total');
    expect(moonShadow(U(2023, 10, 14, 18, 0))!.kind).toBe('annular');
    expect(moonShadow(U(2027, 2, 6, 16, 0))!.kind).toBe('annular');
    expect(moonShadow(U(2027, 8, 31, 17, 41))!.kind).toBe('none');
    // at full Moon the Moon is behind the Earth: no shadow to fall on it
    expect(moonShadow(U(2026, 9, 26, 16, 49))).toBeNull();
  });
});

describe('seasons and the tilt', () => {
  it('finds the solstices and equinoxes within minutes of the almanac', () => {
    const cases: [number, string, number][] = [
      [U(2024, 3, 1), 'March equinox', U(2024, 3, 20, 3, 6)],
      [U(2024, 6, 1), 'June solstice', U(2024, 6, 20, 20, 51)],
      [U(2024, 9, 1), 'September equinox', U(2024, 9, 22, 12, 44)],
      [U(2024, 12, 1), 'December solstice', U(2024, 12, 21, 9, 21)],
      [U(2025, 3, 1), 'March equinox', U(2025, 3, 20, 9, 1)],
      [U(2025, 12, 1), 'December solstice', U(2025, 12, 21, 15, 3)],
    ];
    for (const [from, name, at] of cases) {
      const t = nextTurn(from);
      expect(t.name).toBe(name);
      expect(Math.abs(t.day - at) * 1440, name).toBeLessThan(20);
    }
  });

  it('tells the season, where the Sun is overhead, and how long the day is', () => {
    expect(seasonOf(U(2026, 9, 19))).toEqual({ north: 'summer', south: 'winter', part: 'late' });
    expect(subsolarLatitude(U(2026, 6, 21, 12))).toBeCloseTo(23.44, 1);
    // London at midsummer: 16 h 38 min
    expect(daylight(51.5, U(2026, 6, 21, 12)) * 60).toBeCloseTo(16 * 60 + 38, -0.5);
    expect(daylight(78, U(2026, 6, 21))).toBe(24);
    expect(daylight(78, U(2026, 12, 21))).toBe(0);
    expect(daylight(-33.9, U(2026, 12, 21))).toBeGreaterThan(14);
    expect(seasonsHtml(U(2026, 9, 19), 51.5)).toContain('September equinox');
    expect([40.7, -33.9]).toContain(guessLatitude());
  });
});

describe('the Sky menu in a link', () => {
  it('carries the layers: sight-lines and seasons on, comets off', () => {
    expect(readUrl('#view=sky&tonight=1&seasons=1&comets=0')).toEqual({ view: 'sky', tonight: true, seasons: true, comets: false });
    expect(readUrl('#tonight=yes&comets=1')).toEqual({});
    expect(hashOf({ tonight: true, seasons: false, comets: '0' })).toBe('#tonight=1&comets=0');
  });
});
