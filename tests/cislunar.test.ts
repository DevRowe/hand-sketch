import { afterEach, describe, expect, it } from 'vitest';
import { earthMarks, pick } from '../src/explorer/bodies';
import { dateLabel, isFuture, isoDate, parseIsoDate } from '../src/explorer/format';
import { FLIGHTS, SPACEFLIGHT, SPACEFLIGHT_FEATURED } from '../src/explorer/spaceflight';
import { presetById } from '../src/explorer/presets';
import { farthest, launchOrbit, lunarFlight } from '../src/explorer/trajectories';
import { readUrl } from '../src/explorer/url';
import { VIEWS } from '../src/explorer/views';
import { YEAR } from '../src/explorer/sim';
import { C, circularPeriod, circularSpeed, EARTH_EQ, EARTH_R, hiddenByEarth, KM, moonAt, onEarth, onPage, orbitAt, shape, sunDir, units, utc } from '../src/scenes/cislunar/common';
import { GEO_ALT, GPS_ALT } from '../src/scenes/cislunar/draw';
import { censusAt, GEO_COUNT, GPS_COUNT, STARLINK_COUNT, trackedById } from '../src/scenes/cislunar/objects';
import { moonOffset } from '../src/scenes/solar/common';
import { dayOf, moonDistance, moonLatitude, moonLongitude, siderealTime, sunLongitude } from '../src/scenes/solar/ephemeris';
import { datedSky } from '../src/scenes/solar/sky';

const DEG = 180 / Math.PI;
const dist = (p: readonly number[]): number => Math.hypot(p[0]!, p[1]!, p[2]!);
const angleDiff = (a: number, b: number): number => Math.abs(((a - b + 3 * Math.PI) % (2 * Math.PI)) - Math.PI);

describe('the Moon and the Earth on a date', () => {
  it('puts the Moon where Meeus’s worked example does (1992 April 12, 0h TD)', () => {
    const d = 2448724.5 - 2451545.0, precession = ((5028.83 / 3600) * (d / 36525)) / DEG;
    // Meeus 47.a: 133.162655 degrees (apparent), -3.229126 degrees, 368,409.7 km
    expect(Math.abs((moonLongitude(d) + precession) * DEG - 133.1627)).toBeLessThan(0.05);
    expect(Math.abs(moonLatitude(d) * DEG + 3.229126)).toBeLessThan(0.01);
    expect(Math.abs(moonDistance(d) - 368409.7)).toBeLessThan(50);
  });

  it('keeps the Moon between perigee and apogee, ~356,400 to ~406,700 km', () => {
    let lo = Infinity, hi = 0;
    for (let k = 0; k < 4000; k++) {
      const r = moonDistance(dayOf(Date.UTC(2020, 0, 1)) + k * 0.9);
      lo = Math.min(lo, r);
      hi = Math.max(hi, r);
    }
    expect(lo).toBeGreaterThan(356000);
    expect(lo).toBeLessThan(357500);
    expect(hi).toBeGreaterThan(406000);
    expect(hi).toBeLessThan(407000);
  });

  it('turns Greenwich to face the Sun at noon UTC', () => {
    for (const d of [dayOf(Date.UTC(2026, 2, 20, 12)), dayOf(Date.UTC(2026, 5, 21, 12)), dayOf(Date.UTC(2026, 11, 21, 12))]) {
      // noon at Greenwich: its meridian and the Sun at the same right ascension (to the equation of time, ~4 degrees)
      const ra = Math.atan2(Math.cos(23.44 / DEG) * Math.sin(sunLongitude(d)), Math.cos(sunLongitude(d)));
      expect(angleDiff(siderealTime(d), ra) * DEG).toBeLessThan(4.5);
      // and the place facing the Sun is Greenwich's longitude, seen on the page from above
      const g = onEarth(0, 0, d), s = sunDir(d);
      expect((g[0] * s[0] + g[1] * s[1]) / Math.hypot(g[0], g[1])).toBeGreaterThan(0.99);
    }
  });

  it('leans the northern hemisphere towards the Sun in June and away in December', () => {
    const tilt = (d: number): number => {
      const n = onEarth(90, 0, d, 1), s = sunDir(d);
      return n[0] * s[0] + n[1] * s[1];
    };
    expect(tilt(dayOf(Date.UTC(2026, 5, 21)))).toBeCloseTo(Math.sin(23.44 / DEG), 2);
    expect(tilt(dayOf(Date.UTC(2026, 11, 21)))).toBeCloseTo(-Math.sin(23.44 / DEG), 2);
  });

  it('draws the Moon at the page angle the solar plan gives it, at true scale', () => {
    const d = dayOf(Date.UTC(2026, 8, 19)), [x, y] = onPage(moonAt(d)), [mx, my] = moonOffset(datedSky({ day: d, beat: 0 }));
    expect(angleDiff(Math.atan2(y - C[1], x - C[0]), Math.atan2(my, mx)) * DEG).toBeLessThan(0.5);
    expect(units(384400)).toBeCloseTo(440, 9);
    expect(units(EARTH_R)).toBeCloseTo(7.29, 2);
    expect(KM).toBeCloseTo(873.6, 1);
  });
});

describe('orbits round the Earth', () => {
  it('laps and speeds as NASA quotes them', () => {
    const iss = shape(trackedById('iss')!.orbit);
    expect(iss.period * 1440).toBeGreaterThan(92.5);
    expect(iss.period * 1440).toBeLessThan(93.2);
    expect(1 / iss.period).toBeCloseTo(15.5, 1);
    expect(circularSpeed(417)).toBeCloseTo(7.66, 2);
    // GPS: half a sidereal day; geostationary: one sidereal day (23 h 56 min 4 s)
    expect(circularPeriod(GPS_ALT) * 1440).toBeCloseTo(718, 0);
    expect(Math.abs(circularPeriod(GEO_ALT) * 86400 - 86164)).toBeLessThan(10);
    expect(circularSpeed(GEO_ALT)).toBeCloseTo(3.07, 2);
  });

  it('turns the space station’s orbit ~5 degrees a day westwards, as the Earth’s bulge makes it', () => {
    expect(shape(trackedById('iss')!.orbit).drift * DEG).toBeCloseTo(-5.0, 1);
  });

  it('keeps a body between its lowest and highest points, and hides it behind the Earth only there', () => {
    const o = trackedById('sputnik')!.orbit, lo = EARTH_EQ + o.peri, hi = EARTH_EQ + o.apo;
    for (let k = 0; k < 200; k++) {
      const r = dist(orbitAt(o, utc(1957, 10, 5) + k * 0.003));
      expect(r).toBeGreaterThan(lo - 1);
      expect(r).toBeLessThan(hi + 1);
    }
    expect(hiddenByEarth([0, 0, -7000])).toBe(true);
    expect(hiddenByEarth([0, 0, 7000])).toBe(false);
    expect(hiddenByEarth([8000, 0, -100])).toBe(false);
  });

  it('launches a flight over its pad, climbing north-east', () => {
    const t0 = utc(1961, 4, 12, 6, 7), o = launchOrbit(181, 327, 64.95, 45.92, 63.34, t0), p = orbitAt(o, t0), pad = onEarth(45.92, 63.34, t0);
    const cos = (p[0] * pad[0] + p[1] * pad[1] + p[2] * pad[2]) / (dist(p) * dist(pad));
    expect(Math.acos(Math.min(1, cos)) * DEG).toBeLessThan(0.5);
    // a minute later it is farther north (climbing towards its highest latitude)
    const later = orbitAt(o, t0 + 1 / 1440), north = onEarth(90, 0, t0, 1);
    expect(later[0] * north[0] + later[1] * north[1] + later[2] * north[2]).toBeGreaterThan(p[0] * north[0] + p[1] * north[1] + p[2] * north[2]);
  });

  it('counts the crowds as the catalogues do, none before the first', () => {
    expect(censusAt(GEO_COUNT, utc(1964, 1, 1))).toBe(0);
    expect(censusAt(GEO_COUNT, utc(1964, 8, 20))).toBe(1);
    expect(censusAt(GEO_COUNT, utc(2020, 1, 1))).toBe(542);
    expect(censusAt(GPS_COUNT, utc(1995, 7, 17))).toBeGreaterThanOrEqual(24);
    expect(censusAt(STARLINK_COUNT, utc(2019, 5, 1))).toBe(0);
    expect(censusAt(STARLINK_COUNT, utc(2026, 9, 17))).toBe(11127);
  });
});

describe('flights to the Moon', () => {
  const artemis2 = (): ReturnType<typeof lunarFlight> => lunarFlight({
    launch: utc(2026, 4, 1, 22, 35), tli: utc(2026, 4, 2, 22, 5), park: [192, 70174],
    keys: [[utc(2026, 4, 6, 23) - 0.45, 100, 15000], [utc(2026, 4, 6, 23), 0, 1737.4 + 6545], [utc(2026, 4, 6, 23) + 0.45, -100, 15000]],
    entry: utc(2026, 4, 10, 23, 50), splash: utc(2026, 4, 11, 0, 7), events: [],
  });

  it('flies a continuous path from the Earth to the Moon and home', () => {
    const f = artemis2();
    let last = f.at(f.start);
    for (let t = f.start; t <= f.end; t += 1 / 96) {
      const p = f.at(t);
      // never a jump: at most the speed of a craft near perigee (~11 km/s) over the step
      expect(Math.hypot(p[0] - last[0], p[1] - last[1], p[2] - last[2])).toBeLessThan(11 * 900 * 1.3);
      last = p;
    }
    expect(dist(f.at(f.start))).toBeLessThan(EARTH_EQ + 200);
    expect(dist(f.at(f.end))).toBeLessThan(EARTH_R + 200);
  });

  it('passes the Moon’s far side at the real height and time', () => {
    const f = artemis2(), t = utc(2026, 4, 6, 23), p = f.at(t), m = moonAt(t);
    expect(Math.hypot(p[0] - m[0], p[1] - m[1], p[2] - m[2]) - 1737.4).toBeCloseTo(6545, -1);
    // the far side: the craft is farther from the Earth than the Moon is
    expect(dist(p)).toBeGreaterThan(dist(m));
  });

  it('takes each flight as far from the Earth as it went', () => {
    // Artemis I 432,210 km; Artemis II 406,771 km; Apollo 13 400,171 km (records, NASA: from the Earth's surface)
    for (const [f, km] of [[FLIGHTS.ARTEMIS_1, 432210], [FLIGHTS.ARTEMIS_2, 406771], [FLIGHTS.APOLLO_13, 400171]] as const) {
      expect(Math.abs((farthest(f, f.start, f.end).km - EARTH_R) / km - 1)).toBeLessThan(0.006);
    }
    for (const f of Object.values(FLIGHTS)) {
      expect(dist(f.at(f.start))).toBeLessThan(EARTH_EQ + 400);
      expect(Number.isFinite(dist(f.at((f.start + f.end) / 2)))).toBe(true);
    }
  });
});

describe('the Earth and Moon view in the explorer', () => {
  it('names the heights as rings, and shows the stations only once low orbit opens up', () => {
    const d = utc(2026, 9, 19, 12), far = earthMarks(d, 1), near = earthMarks(d, 40);
    expect(far.bodies.map(b => b.id)).toEqual(expect.arrayContaining(['earth', 'moon', 'leo', 'gps', 'geo']));
    expect(far.bodies.some(b => b.id === 'iss')).toBe(false);
    // over an orbit the station spends some time in sight (and some hidden behind the Earth)
    const seen = Array.from({ length: 24 }, (_, k) => earthMarks(d + k / 250, 40).bodies.some(b => b.id === 'iss'));
    expect(seen.some(Boolean)).toBe(true);
    expect(seen.every(Boolean)).toBe(false);
    expect(near.bodies.find(b => b.id === 'geo')!.ring).toBeCloseTo(units(EARTH_EQ + GEO_ALT), 9);
    // no Starlink, GPS or geostationary crowd before its first launch
    expect(earthMarks(utc(1960, 1, 1), 40).bodies.some(b => b.id === 'starlink' || b.id === 'gps' || b.id === 'geo')).toBe(false);
  });

  it('picks a ring along its line, and the Earth over its rings', () => {
    const d = utc(2026, 9, 19, 12), marks = earthMarks(d, 8), s = 5, toScreen = (x: number, y: number): [number, number] => [(x - C[0]) * s + 500, (y - C[1]) * s + 500];
    const geo = units(EARTH_EQ + GEO_ALT) * s;
    expect(pick(marks, 500 + geo + 2, 500, toScreen, s)?.id).toBe('geo');
    expect(pick(marks, 500 + geo * 0.8, 500 + 30, toScreen, s)).toBeNull();
    expect(pick(marks, 500 + 3, 500, toScreen, s)?.id).toBe('earth');
  });

  it('runs on its own clock and trails, and each view offers paces within its range', () => {
    expect(VIEWS.earth.family).not.toBe(VIEWS.sky.family);
    expect(VIEWS.wake.span.start).toBe(12 * YEAR);
    for (const v of Object.values(VIEWS)) {
      expect(v.pace.start).toBeGreaterThanOrEqual(v.pace.min);
      expect(v.pace.start).toBeLessThanOrEqual(v.pace.max);
      for (const [pace] of v.pace.chips) expect(pace >= v.pace.min && pace <= v.pace.max).toBe(true);
      expect(v.span.start >= v.span.min && v.span.start <= v.span.max).toBe(true);
    }
  });

  it('features spaceflight moments that exist, each once, all in the Earth and Moon view', () => {
    expect(new Set(SPACEFLIGHT_FEATURED.map(([id]) => id)).size).toBe(SPACEFLIGHT_FEATURED.length);
    for (const [id, short] of SPACEFLIGHT_FEATURED) {
      const p = presetById(id);
      expect(p, id).toBeDefined();
      expect(short.length).toBeLessThanOrEqual(p!.title.length);
    }
    for (const p of SPACEFLIGHT) expect(p.view, p.id).toBe('earth');
  });

  it('reads the Earth and Moon view from the address bar', () => {
    expect(readUrl('#view=earth&body=tiangong')).toEqual({ view: 'earth', body: 'tiangong' });
  });
});

describe('the viewer’s calendar', () => {
  const tz = process.env.TZ;
  afterEach(() => {
    if (tz === undefined) delete process.env.TZ;
    else process.env.TZ = tz;
  });

  it('reads today in the viewer’s own time zone, east of UTC included', () => {
    // 07:27 on Saturday 19 September 2026 in Perth is still Friday evening in UTC
    const instant = dayOf(Date.UTC(2026, 8, 18, 23, 27));
    process.env.TZ = 'Australia/Perth';
    expect(dateLabel(instant)).toBe('19 Sep 2026');
    expect(isoDate(instant)).toBe('2026-09-19');
    expect(isFuture('2026-09-19', instant)).toBe(false);
    expect(isFuture('2026-09-20', instant)).toBe(true);
    // an event keeps its UTC date wherever it is read
    expect(dateLabel(instant, true)).toBe('18 Sep 2026');
    process.env.TZ = 'America/Los_Angeles';
    expect(dateLabel(instant)).toBe('18 Sep 2026');
  });

  it('parses a date as noon on that day where the viewer is', () => {
    process.env.TZ = 'Pacific/Auckland';
    const d = parseIsoDate('2026-01-01')!;
    expect(isoDate(d)).toBe('2026-01-01');
    expect(dateLabel(d)).toBe('1 Jan 2026');
    process.env.TZ = 'Pacific/Honolulu';
    expect(isoDate(parseIsoDate('1969-07-20')!)).toBe('1969-07-20');
  });
});
