import { describe, expect, it } from 'vitest';
import { Stage } from '../src/core/stage';
import { loopSnapshot, orbitRings, snapshot, SUN_W, wakePlan } from '../src/scenes/solar-spiral/common';
import { LOOP, MOON_K, PLANETS, planetAt } from '../src/scenes/solar/common';
import { dayOf, heliocentric, moonLongitude, periodDays, sunLongitude } from '../src/scenes/solar/ephemeris';
import { datedSky, loopSky, trailSweep } from '../src/scenes/solar/sky';

const DEG = 180 / Math.PI;
const day = (y: number, m: number, d: number, h = 0): number => dayOf(Date.UTC(y, m - 1, d) + h * 3600e3);
/** Signed difference of two angles in degrees, in (-180, 180]. */
const diff = (a: number, b: number): number => ((((a - b) * DEG) % 360) + 540) % 360 - 180;

/** Geocentric ecliptic longitude of a planet (projected on the ecliptic), radians. */
function geocentric(name: 'venus' | 'mars' | 'jupiter' | 'saturn', t: number): number {
  const p = heliocentric(name, t), e = heliocentric('earth', t);
  return Math.atan2(p.r * Math.cos(p.lat) * Math.sin(p.lon) - e.r * Math.sin(e.lon), p.r * Math.cos(p.lat) * Math.cos(p.lon) - e.r * Math.cos(e.lon));
}

describe('ephemeris', () => {
  it('gives the planets their sidereal periods', () => {
    expect(periodDays('mercury')).toBeCloseTo(87.97, 1);
    expect(periodDays('earth')).toBeCloseTo(365.26, 1);
    expect(periodDays('mars')).toBeCloseTo(686.98, 0);
    expect(periodDays('neptune') / 365.25).toBeCloseTo(164.8, 0);
  });

  it('puts the planets where they were on known dates', () => {
    // the great conjunction of 21 December 2020: Jupiter and Saturn a tenth of a degree apart in our sky
    const gc = day(2020, 12, 21, 18);
    expect(Math.abs(diff(geocentric('jupiter', gc), geocentric('saturn', gc)))).toBeLessThan(0.3);
    // Mars at opposition (opposite the Sun in our sky): 28 August 2003 and 16 January 2025
    for (const t of [day(2003, 8, 28), day(2025, 1, 16)]) expect(Math.abs(diff(geocentric('mars', t), sunLongitude(t) + Math.PI))).toBeLessThan(1.5);
    // the transit of Venus, 6 June 2012: Venus in front of the Sun
    const tv = day(2012, 6, 6, 1.5);
    expect(Math.abs(diff(geocentric('venus', tv), sunLongitude(tv)))).toBeLessThan(0.5);
    // the Sun at the March equinox of 2024 (J2000 frame: precession has moved the equinox about 0.3 degrees since)
    expect(Math.abs(diff(sunLongitude(day(2024, 3, 20, 3.1)), 0))).toBeLessThan(0.5);
  });

  it('follows the Moon through its phases', () => {
    // new Moon at the total solar eclipse of 8 April 2024, full Moon of 18 September 2024
    const nm = day(2024, 4, 8, 18.35), fm = day(2024, 9, 18, 2.57);
    // with the Moon carried to the J2000 frame the planets use, both land within a quarter of a degree
    expect(Math.abs(diff(moonLongitude(nm), sunLongitude(nm)))).toBeLessThan(0.25);
    expect(Math.abs(diff(moonLongitude(fm), sunLongitude(fm) + Math.PI))).toBeLessThan(0.25);
    // Apollo 11 landed under a waxing crescent, about 70 degrees from the Sun
    const a11 = day(1969, 7, 20, 20.28);
    expect(diff(moonLongitude(a11), sunLongitude(a11))).toBeGreaterThan(55);
    expect(diff(moonLongitude(a11), sunLongitude(a11))).toBeLessThan(85);
  });
});

describe('dated sky', () => {
  it('turns longitudes into page angles, counter-clockwise from the equinox on the right', () => {
    const t = day(2026, 9, 18), sky = datedSky({ day: t, beat: 0 });
    for (const p of PLANETS) expect(sky.angle(p.k, t)).toBeCloseTo(-heliocentric(p.name, t).lon, 12);
    expect(sky.angle(MOON_K, t)).toBeCloseTo(-moonLongitude(t), 12);
    // a quarter of a year later the Earth has moved about 90 degrees counter-clockwise (up the page from the right)
    const later = datedSky({ day: t + 91.3, beat: 0 });
    expect(diff(later.angle(2, t + 91.3), sky.angle(2, t))).toBeCloseTo(-90, -1);
    expect(sky.period(2)).toBeCloseTo(365.26, 1);
  });

  it('draws the plan where the ephemeris says', () => {
    const t = day(2020, 12, 21), sky = datedSky({ day: t, beat: 0 }), jupiter = PLANETS[4]!;
    const [x, y] = planetAt(jupiter, sky);
    expect(Math.hypot(x - 540, y - 540)).toBeCloseTo(jupiter.a, 9);
    expect(Math.atan2(y - 540, x - 540)).toBeCloseTo(Math.atan2(Math.sin(-heliocentric('jupiter', t).lon), Math.cos(-heliocentric('jupiter', t).lon)), 9);
  });

  it('sweeps trails as far back as the viewer asks, never more than a lap', () => {
    const t = day(2026, 1, 1), sky = datedSky({ day: t, beat: 0, trails: { span: 365.25, reveal: 1, alpha: 0.5 } });
    expect(trailSweep(sky, 0, 1).sweep).toBeCloseTo(2 * Math.PI, 9);
    expect(trailSweep(sky, 3, 1).sweep).toBeCloseTo((2 * Math.PI * 365.25) / periodDays('mars'), 9);
    expect(trailSweep(sky, 3, 1).alpha).toBe(0.5);
    // a render keeps each piece's own trail
    expect(trailSweep(loopSky(10), 3, 0.7)).toEqual({ sweep: 0.7, alpha: 1 });
  });
});

describe('dated wakes', () => {
  const t = day(2026, 9, 18, 7.3), trails = { span: 4 * 365.25, reveal: 1, alpha: 1 };

  it('start at the body and reach back the span, on a grid fixed in time', () => {
    const S = snapshot(datedSky({ day: t, beat: 0, trails })), plan = S.plan;
    for (const tr of S.trails.slice(0, 8)) {
      const head = tr.samples[0]!, body = S.bodies[tr.k]!;
      expect(head.x).toBeCloseTo(body.x, 9);
      expect(head.y).toBeCloseTo(body.y, 9);
      expect(head.age).toBe(0);
      // every sample but the head and tail sits on a whole grid index
      for (const s of tr.samples.slice(1, -1)) expect(Number.isInteger(s.q)).toBe(true);
      expect(tr.samples.at(-1)!.age).toBeCloseTo(1, 1);
      // ruler ticks are whole numbers of samples, so marks line up across wakes
      expect(Number.isInteger(plan.tick[tr.k]!)).toBe(true);
    }
    expect(S.sunTrail.length).toBeGreaterThan(10);
    expect(Number.isInteger(plan.tick[SUN_W]!)).toBe(true);
  });

  it('keep a sample\'s key as time moves on, so marks ride along', () => {
    const a = snapshot(datedSky({ day: t, beat: 0, trails })), b = snapshot(datedSky({ day: t + 0.37, beat: 0, trails }));
    const keysA = new Set(a.trails[3]!.samples.slice(1, -1).map(s => s.q));
    const shared = b.trails[3]!.samples.slice(1, -1).filter(s => keysA.has(s.q));
    expect(shared.length).toBeGreaterThan(a.trails[3]!.samples.length * 0.8);
  });

  it('fade out to nothing, handing over to plain orbit rings', () => {
    const off = snapshot(datedSky({ day: t, beat: 0, trails: { ...trails, alpha: 0 } }));
    expect(off.trails.every(tr => tr.samples.length === 0)).toBe(true);
    expect(off.sunTrail).toHaveLength(0);
    expect(off.rings).toBe(1);
    // renders never draw the stand-in rings
    expect(loopSnapshot(5).rings).toBe(0);
    let strokes = 0;
    const ctx = { save() {}, restore() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke: () => strokes++ } as unknown as CanvasRenderingContext2D;
    orbitRings(ctx, loopSnapshot(5), [{ x: 0, y: 0, z: 1, s: 1 }, { x: 1, y: 1, z: 1, s: 1 }], true, '#000', 1);
    expect(strokes).toBe(0);
  });

  it('use the piece\'s own clock in a render', () => {
    const plan = wakePlan(loopSky(12));
    expect(plan.step.every(h => h === 0.5)).toBe(true);
    expect(plan.alpha).toBe(1);
    expect(plan.tick[SUN_W]).toBe((LOOP / PLANETS[0]!.turns) * 2);
  });
});

describe('view camera', () => {
  const recorder = (): { ctx: CanvasRenderingContext2D; last: () => number[] } => {
    let m: number[] = [];
    const ctx = { setTransform: (...a: number[]) => { m = a; } } as unknown as CanvasRenderingContext2D;
    return { ctx, last: () => m };
  };

  it('leaves renders on the plain output scale', () => {
    const stage = new Stage({ ar: '16:9', width: 1280 }), r = recorder();
    stage.reset(r.ctx);
    expect(r.last()).toEqual([stage.base, 0, 0, stage.base, 0, 0]);
    expect(stage.scale).toBe(stage.base);
  });

  it('magnifies about a logical point and maps pixels back', () => {
    const stage = new Stage({ ar: '16:9', width: 1280 }), r = recorder();
    stage.setView({ zoom: 3, x: 400, y: 300 });
    expect(stage.scale).toBeCloseTo(stage.base * 3, 12);
    // the view's point lands on the centre of the output
    const [cx, cy] = stage.toPixel(400, 300);
    expect(cx).toBeCloseTo(stage.outW / 2, 6);
    expect(cy).toBeCloseTo(stage.outH / 2, 6);
    const [lx, ly] = stage.toLogical(123, 456), [px, py] = stage.toPixel(lx, ly);
    expect(px).toBeCloseTo(123, 9);
    expect(py).toBeCloseTo(456, 9);
    // reset applies the same mapping
    stage.reset(r.ctx);
    const [a, , , d, e, f] = r.last();
    expect(a! * 400 + e!).toBeCloseTo(stage.outW / 2, 6);
    expect(d! * 300 + f!).toBeCloseTo(stage.outH / 2, 6);
    expect(() => stage.setView({ zoom: 0, x: 0, y: 0 })).toThrow();
  });
});
