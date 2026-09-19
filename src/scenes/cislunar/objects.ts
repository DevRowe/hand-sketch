/**
 * What orbits the Earth in the Earth and Moon view, and when: the space stations and telescopes one by one, and the
 * crowds (the GPS constellation, the geostationary belt, Starlink) as counts that grow over the years.
 *
 * Orbits are representative: the real height and tilt of each, with its node drifting at the real rate, but the place
 * along the orbit on a given day is illustrative (no live tracking). Dates are UTC; sources in
 * `src/explorer/content/SOURCES.md`.
 */
import { rng } from '../../core/random';
import { utc, type Orbit } from './common';

export type ObjectKind = 'station' | 'telescope' | 'satellite';

export interface Tracked {
  id: string;
  name: string;
  kind: ObjectKind;
  /** In orbit from, to (days from J2000.0); `to` is open while it still flies. */
  from: number;
  to?: number;
  orbit: Orbit;
}

/** Reference epoch for the illustrative phases: 1 January 2000. */
const EPOCH = utc(2000, 1, 1);

export const TRACKED: readonly Tracked[] = [
  { id: 'sputnik', name: 'Sputnik 1', kind: 'satellite', from: utc(1957, 10, 4, 19, 28), to: utc(1958, 1, 4), orbit: { peri: 215, apo: 939, inc: 65.1, node: 40, argp: 58, m0: 10, epoch: EPOCH } },
  { id: 'salyut', name: 'Salyut 1', kind: 'station', from: utc(1971, 4, 19, 1, 40), to: utc(1971, 10, 11), orbit: { peri: 200, apo: 222, inc: 51.6, node: 120, m0: 200, epoch: EPOCH } },
  { id: 'skylab', name: 'Skylab', kind: 'station', from: utc(1973, 5, 14, 17, 30), to: utc(1979, 7, 11, 16, 37), orbit: { peri: 434, apo: 442, inc: 50, node: 300, m0: 80, epoch: EPOCH } },
  { id: 'mir', name: 'Mir', kind: 'station', from: utc(1986, 2, 19, 21, 28), to: utc(2001, 3, 23, 5, 59), orbit: { peri: 354, apo: 374, inc: 51.6, node: 20, m0: 300, epoch: EPOCH } },
  // deployed at ~614 km in 1990, sinking since (~470 km in 2026): drawn at its height of the early 2020s
  { id: 'hubble', name: 'Hubble', kind: 'telescope', from: utc(1990, 4, 25), orbit: { peri: 530, apo: 540, inc: 28.5, node: 200, m0: 150, epoch: EPOCH } },
  // flown through 2030, then steered into the South Pacific by the US Deorbit Vehicle (planned)
  { id: 'iss', name: 'ISS', kind: 'station', from: utc(1998, 11, 20, 6, 40), to: utc(2031, 1, 1), orbit: { peri: 413, apo: 422, inc: 51.64, node: 250, m0: 0, epoch: EPOCH } },
  { id: 'tiangong', name: 'Tiangong', kind: 'station', from: utc(2021, 4, 29, 3, 23), orbit: { peri: 386, apo: 392, inc: 41.47, node: 90, m0: 120, epoch: EPOCH } },
];

export const trackedById = (id: string): Tracked | undefined => TRACKED.find(t => t.id === id);

/** Whether an object is in orbit on `day`. */
export const flying = (t: Tracked, day: number): boolean => day >= t.from && (t.to === undefined || day < t.to);

/* ---------- crowds ---------- */

/** A count over the years: straight lines between dated anchors, none before the first, held after the last. */
export type Census = readonly (readonly [day: number, count: number])[];

export function censusAt(c: Census, day: number): number {
  if (!c.length || day < c[0]![0]) return 0;
  for (let k = 1; k < c.length; k++) {
    const [d1, n1] = c[k]!, [d0, n0] = c[k - 1]!;
    if (day < d1) return Math.round(n0 + ((n1 - n0) * (day - d0)) / (d1 - d0));
  }
  return c[c.length - 1]![1];
}

/**
 * GPS satellites in service: the first Block I launched 22 February 1978, ~8 by 1985 and ~13 by 1990 (counted from
 * launch and retirement dates), the full 24 at initial capability (December 1993), 31 operational today.
 */
export const GPS_COUNT: Census = [
  [utc(1978, 2, 22), 1], [utc(1985, 1, 1), 8], [utc(1990, 1, 1), 13], [utc(1993, 12, 8), 24], [utc(2005, 1, 1), 29], [utc(2015, 1, 1), 31],
];

/**
 * Working satellites in geosynchronous orbit on 1 January of each year (J. McDowell's catalogue): from Syncom 3 in 1964
 * to ~580 today.
 */
export const GEO_COUNT: Census = [
  [utc(1964, 8, 19), 1], [utc(1965, 1, 1), 2], [utc(1970, 1, 1), 15], [utc(1980, 1, 1), 90], [utc(1990, 1, 1), 178],
  [utc(2000, 1, 1), 289], [utc(2010, 1, 1), 403], [utc(2020, 1, 1), 542], [utc(2025, 1, 1), 568], [utc(2026, 1, 1), 582],
];

/** Starlink satellites in orbit at the end of each year (McDowell): the first 60 launched 24 May 2019, 11,127 by 17 September 2026. */
export const STARLINK_COUNT: Census = [
  [utc(2019, 5, 24), 60], [utc(2020, 1, 1), 122], [utc(2021, 1, 1), 892], [utc(2022, 1, 1), 1791], [utc(2023, 1, 1), 3373],
  [utc(2024, 1, 1), 5268], [utc(2025, 1, 1), 6881], [utc(2026, 1, 1), 9392], [utc(2026, 9, 17), 11127],
];

/** Starlink's main shells, as one: height (km, most fly ~450 to 490 km in 2026) and tilt (degrees). */
export const STARLINK_SHELL = { alt: 480, inc: 53 } as const;
/** Satellites each drawn dot of Starlink stands for. */
export const STARLINK_PER_DOT = 20;

/** Fixed places for the crowds' members (orbital slots and phases), so a dot keeps its place from day to day. */
export const SLOTS = (() => {
  const r = rng(38_4400), geo: number[] = [], starlink: { node: number; phase: number }[] = [];
  // geostationary longitudes, filled in a scattered order as the belt grows: first Syncom 3 over the date line, then
  // Early Bird over the Atlantic
  geo.push(180, -28);
  for (let k = 2; k < 600; k++) geo.push(r() * 360);
  for (let k = 0; k < 600; k++) starlink.push({ node: Math.floor(r() * 72) * 5, phase: r() * 360 });
  return { geo, starlink };
})();
