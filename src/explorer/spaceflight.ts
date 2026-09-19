/**
 * The story of spaceflight as moments of the Earth and Moon view: the first satellite and the first people in orbit,
 * the flights to the Moon, the stations over the years, the crowds of satellites, and what is planned next. Each sets
 * the date, frames the height it happened at and, for the flights, draws the path: flown solid, still to come dashed,
 * with the craft where it is.
 *
 * Dates and figures are NASA's, ESA's, CMSA's and J. McDowell's (sources in `content/SOURCES.md`), UTC throughout;
 * "~" marks roundings. Paths are representative (`trajectories.ts`): real dates, heights and tilts, simplest orbits.
 */
import type { Vec2 } from '../core/math';
import { EARTH_EQ, EARTH_R, hiddenByEarth, moonAt, onPage, units, utc } from '../scenes/cislunar/common';
import type { App } from './app';
import { drawCraft, drawMark, drawPath } from './overlays';
import type { Preset } from './presets';
import { DAY, HOUR, MINUTE } from './sim';
import { aboveMoon, earthFlight, launchOrbit, lunarFlight, type Flight } from './trajectories';

/* ---------- framing ---------- */

/** A frame round the Earth out to `alt` km, with a little room. */
const upTo = (alt: number): NonNullable<Preset['frame']> => ({ fit: units(EARTH_EQ + alt) * 1.12 });

/* ---------- drawing a flight ---------- */

interface Sampled {
  t: number[];
  p: Vec2[];
  /** Whether the Earth hides the path there. */
  hid: boolean[];
}

/** Runs of a sampled stretch the Earth does not hide. */
function inSight(p: readonly Vec2[], hid: readonly boolean[]): Vec2[][] {
  const runs: Vec2[][] = [];
  let run: Vec2[] = [];
  p.forEach((q, i) => {
    if (hid[i]) {
      if (run.length > 1) runs.push(run);
      run = [];
    } else run.push(q);
  });
  if (run.length > 1) runs.push(run);
  return runs;
}

/** A flight's path, drawn up to the date on screen, its events marked, the craft where it is; the Earth hides what passes behind it. */
function flightOverlay(f: Flight, name: string) {
  let path: Sampled | null = null;
  return (ctx: CanvasRenderingContext2D, app: App): void => {
    if (app.view !== 'earth') return;
    if (!path) {
      // a flight's path never changes: sample it once
      const t: number[] = [], p: Vec2[] = [], hid: boolean[] = [];
      const add = (d: number): void => {
        const q = f.at(d);
        t.push(d);
        p.push(onPage(q));
        hid.push(hiddenByEarth(q));
      };
      for (let d = f.start; d < f.end; d += f.sample(d)) add(d);
      add(f.end);
      path = { t, p, hid };
    }
    const now = app.sim.day, k = path.t.findIndex(d => d > now), cut = k < 0 ? path.p.length : Math.max(1, k);
    const at = f.at(Math.min(f.end, Math.max(f.start, now))), here = onPage(at), behind = hiddenByEarth(at);
    const flown = now <= f.start ? [] : inSight([...path.p.slice(0, cut), here], [...path.hid.slice(0, cut), behind]);
    const ahead = now >= f.end ? [] : inSight([here, ...path.p.slice(cut)], [behind, ...path.hid.slice(cut)]);
    for (const run of ahead) drawPath(ctx, app, [], run);
    for (const run of flown) drawPath(ctx, app, run, []);
    for (const e of f.events) drawMark(ctx, app, e.at === 'moon' ? onPage(moonAt(e.day)) : onPage(f.at(e.day)), e.label, now >= e.day);
    if (now >= f.start && now <= f.end && !behind) drawCraft(ctx, app, here, name);
  };
}

/* ---------- the flights ---------- */

/** Launch pads, latitude and longitude (degrees). */
const PAD = {
  baikonur: [45.92, 63.34],
  cape14: [28.49, -80.55],
  cape19: [28.51, -80.55],
  lc39: [28.61, -80.6],
  jiuquan: [40.96, 100.29],
} as const;

const VOSTOK_1 = (() => {
  const t0 = utc(1961, 4, 12, 6, 7), o = launchOrbit(181, 327, 64.95, ...PAD.baikonur, t0);
  return earthFlight(o, t0, utc(1961, 4, 12, 7, 55), [{ day: t0, label: 'Baikonur' }]);
})();

const FRIENDSHIP_7 = (() => {
  const t0 = utc(1962, 2, 20, 14, 47), o = launchOrbit(161, 261, 32.5, ...PAD.cape14, t0);
  return earthFlight(o, t0, t0 + (4 * 60 + 55) * MINUTE, [{ day: t0, label: 'Cape Canaveral' }]);
})();

/** Gemini 11's two record laps, reaching 1,369 km, on 14 September 1966. */
const GEMINI_11 = (() => {
  const t0 = utc(1966, 9, 14, 2, 12), o = launchOrbit(298, 1369, 28.8, ...PAD.cape19, t0);
  return earthFlight(o, t0, t0 + 3.4 * HOUR);
})();

const SHENZHOU_5 = (() => {
  const t0 = utc(2003, 10, 15, 1, 0), o = launchOrbit(332, 336, 42.4, ...PAD.jiuquan, t0);
  return earthFlight(o, t0, t0 + 21 * HOUR + 23 * MINUTE, [{ day: t0, label: 'Jiuquan' }]);
})();

/** Apollo lunar orbits: ~110 km up, two hours a lap, flown clockwise as seen from the north (retrograde). */
const LUNAR_ORBIT = aboveMoon(110);
/** Where a flight is said to arrive at or leave the Moon's neighbourhood: this far from it, km. */
const NEAR = 15000;

/** Keyframes for a stay in lunar orbit: in on the leading side, `laps` laps from insertion to leaving, out behind. */
function orbitKeys(loi: number, tei: number, laps: number): [number, number, number][] {
  return [[loi - 0.4, 100, NEAR], [loi, 0, LUNAR_ORBIT], [tei, -360 * laps, LUNAR_ORBIT], [tei + 0.4, -360 * laps - 100, NEAR]];
}

/** Keyframes for a flyby round the far side, closest at `peri`, `alt` km up. */
const flybyKeys = (peri: number, alt: number): [number, number, number][] => [[peri - 0.45, 100, NEAR], [peri, 0, aboveMoon(alt)], [peri + 0.45, -100, NEAR]];

const APOLLO_8 = lunarFlight({
  launch: utc(1968, 12, 21, 12, 51), tli: utc(1968, 12, 21, 15, 41), park: 185,
  keys: orbitKeys(utc(1968, 12, 24, 9, 59), utc(1968, 12, 25, 6, 10), 10),
  entry: utc(1968, 12, 27, 15, 37), splash: utc(1968, 12, 27, 15, 52),
  events: [{ day: utc(1968, 12, 24, 9, 59), label: 'Ten laps of the Moon', at: 'moon' }],
});

const APOLLO_11 = lunarFlight({
  launch: utc(1969, 7, 16, 13, 32), tli: utc(1969, 7, 16, 16, 16), park: 185,
  keys: orbitKeys(utc(1969, 7, 19, 17, 22), utc(1969, 7, 22, 4, 56), 30),
  entry: utc(1969, 7, 24, 16, 35), splash: utc(1969, 7, 24, 16, 51),
  events: [{ day: utc(1969, 7, 20, 20, 17), label: 'Eagle lands', at: 'moon' }],
});

const APOLLO_13 = lunarFlight({
  launch: utc(1970, 4, 11, 19, 13), tli: utc(1970, 4, 11, 21, 48), park: 185,
  keys: flybyKeys(utc(1970, 4, 15, 0, 21), 254),
  entry: utc(1970, 4, 17, 17, 53), splash: utc(1970, 4, 17, 18, 8),
  events: [
    { day: utc(1970, 4, 14, 3, 8), label: 'Oxygen tank bursts' },
    { day: utc(1970, 4, 15, 0, 21), label: 'Round the far side', at: 'moon' },
  ],
});

const APOLLO_17 = lunarFlight({
  launch: utc(1972, 12, 7, 5, 33), tli: utc(1972, 12, 7, 8, 46), park: 170,
  keys: orbitKeys(utc(1972, 12, 10, 19, 54), utc(1972, 12, 16, 23, 35), 75),
  entry: utc(1972, 12, 19, 19, 10), splash: utc(1972, 12, 19, 19, 25),
  events: [{ day: utc(1972, 12, 14, 22, 55), label: 'Last lift-off from the Moon', at: 'moon' }],
});

/** Artemis I: a far-side flyby out to a distant retrograde orbit, half a lap of it, and home past the far side again. */
const ARTEMIS_1 = (() => {
  const opf = utc(2022, 11, 21, 12, 57), dri = utc(2022, 11, 25, 21, 52), drd = utc(2022, 12, 1, 21, 53), rpf = utc(2022, 12, 5, 16, 43);
  // at the midpoint of the half lap it was farthest, beyond the Moon: 432,210 km from the Earth (distance records, as
  // NASA quotes them, are from the Earth's surface)
  const mid = (dri + drd) / 2, m = moonAt(mid), beyond = 432210 + EARTH_R - Math.hypot(m[0], m[1], m[2]);
  return lunarFlight({
    launch: utc(2022, 11, 16, 6, 48), tli: utc(2022, 11, 16, 8, 17), park: 185,
    keys: [[opf - 0.6, -60, NEAR], [opf, 0, aboveMoon(130)], [dri, 90, 70000], [mid, 0, beyond], [drd, -90, 70000], [rpf, 0, aboveMoon(128)], [rpf + 0.6, 60, NEAR]],
    entry: utc(2022, 12, 11, 17, 20), splash: utc(2022, 12, 11, 17, 40),
    events: [{ day: mid, label: 'Farthest: 432,210 km' }],
  });
})();

/** Artemis II: a day in a high Earth orbit, then a free-return flyby round the far side. */
const ARTEMIS_2 = lunarFlight({
  launch: utc(2026, 4, 1, 22, 35), tli: utc(2026, 4, 2, 22, 5), park: [192, 70174],
  keys: flybyKeys(utc(2026, 4, 6, 23, 0), 6545),
  entry: utc(2026, 4, 10, 23, 50), splash: utc(2026, 4, 11, 0, 7),
  events: [{ day: utc(2026, 4, 6, 23, 2), label: 'Record: 406,771 km' }],
});

/** The flights drawn, by name (for tests). */
export const FLIGHTS = { VOSTOK_1, FRIENDSHIP_7, GEMINI_11, SHENZHOU_5, APOLLO_8, APOLLO_11, APOLLO_13, APOLLO_17, ARTEMIS_1, ARTEMIS_2 } as const;

/* ---------- the moments ---------- */

export const SPACEFLIGHT: readonly Preset[] = [
  {
    id: 'sputnik', group: 'The space age', title: 'Sputnik 1', kicker: 'The first satellite.',
    day: () => utc(1957, 10, 4, 19, 28), view: 'earth', frame: upTo(1100), select: 'sputnik', pace: MINUTE,
    card: () => ({
      when: 'Launched 4 October 1957, 19:28 UTC',
      intro: 'A polished 58 cm ball with four whip aerials, on a stretched orbit from ~215 to ~939 km. Anyone with a radio could hear it beep: the space age had begun, and the race to the Moon with it.',
      facts: [
        { label: 'One lap', value: '96.2 minutes' },
        { label: 'Mass', value: '83.6 kg' },
        { label: 'Beeped until', value: '26 October 1957' },
        { label: 'Burned up', value: '4 January 1958' },
      ],
      body: ['Four months later the first US satellite, Explorer 1, found the belts of radiation round the Earth named after James Van Allen, whose instrument it carried.'],
    }),
  },
  {
    id: 'gagarin', group: 'The space age', title: 'Yuri Gagarin', kicker: 'The first person in space: one lap of the Earth.',
    day: () => utc(1961, 4, 12, 6, 7), view: 'earth', frame: upTo(450), pace: MINUTE,
    journey: () => ({ from: utc(1961, 4, 12, 6, 7), to: utc(1961, 4, 12, 7, 55), pace: 6 * MINUTE, label: 'Fly the 108 minutes' }),
    overlay: flightOverlay(VOSTOK_1, 'Vostok 1'),
    card: () => ({
      when: '12 April 1961, 06:07 to 07:55 UTC',
      intro: 'Vostok 1 carried Yuri Gagarin once round the Earth, ~181 to ~327 km up, in 108 minutes from launch to landing. He ejected at about 7 km and came down by parachute near Saratov.',
      facts: [
        { label: 'Orbit', value: '~181 × 327 km, 65° tilt' },
        { label: 'One lap', value: '89 minutes' },
        { label: 'Speed', value: '~7.8 km/s' },
      ],
      body: [
        'Low Earth orbit is fast: ~7.8 km/s, once round in about an hour and a half. Every crewed flight since has flown this band, except the few that went to the Moon.',
        'Alan Shepard became the first American in space three weeks later, on a 15-minute arc that did not go into orbit.',
      ],
      notes: ['The path is drawn on his orbit from the Baikonur pad; where he flew along it is illustrative.'],
    }),
  },
  {
    id: 'glenn', group: 'The space age', title: 'John Glenn, Friendship 7', kicker: 'The first American in orbit: three laps in Mercury.',
    day: () => utc(1962, 2, 20, 14, 47), view: 'earth', frame: upTo(350), pace: 2 * MINUTE,
    journey: () => ({ from: utc(1962, 2, 20, 14, 47), to: utc(1962, 2, 20, 19, 42), pace: 16 * MINUTE, label: 'Fly the three laps' }),
    overlay: flightOverlay(FRIENDSHIP_7, 'Friendship 7'),
    card: () => ({
      when: '20 February 1962, from 14:47 UTC',
      intro: 'Mercury’s one-person capsule carried John Glenn three times round the Earth in 4 hours 55 minutes, ~161 to ~261 km up.',
      facts: [
        { label: 'Program', value: 'Mercury: 6 crewed flights, 1961-63' },
        { label: 'Tilt', value: '32.5° to the equator' },
        { label: 'Flight', value: '4 h 55 min, 3 laps' },
      ],
      body: ['Gemini (1965-66) came next: ten two-person flights that learned to meet and dock in orbit, the skills a Moon landing would need.'],
    }),
  },
  {
    id: 'syncom', group: 'Satellites', title: 'The first geostationary satellite', kicker: 'Syncom 3 hangs over the Pacific.',
    day: () => utc(1964, 8, 19), view: 'earth', frame: upTo(36500), select: 'geo', pace: HOUR,
    card: () => ({
      when: 'Launched 19 August 1964',
      intro: '35,786 km up, a lap takes exactly as long as the Earth takes to turn, so a satellite over the equator keeps its place in the sky. Syncom 3 was the first there; it carried the Tokyo Olympics live to the United States that October.',
      facts: [
        { label: 'Height', value: '35,786 km' },
        { label: 'One lap', value: '23 h 56 min: one turn of the Earth' },
        { label: 'Speed', value: '~3.07 km/s' },
        { label: 'Working there now', value: '~580 (2026)' },
      ],
      body: [
        'Early Bird (Intelsat I) followed on 6 April 1965, the first commercial communications satellite. By 1980 there were ~90 working in the belt, by 2000 ~290.',
        'Play time forward: the belt turns with the Earth, the satellites riding over their own spots on the equator.',
      ],
    }),
  },
  {
    id: 'gemini-11', group: 'The space age', title: 'Gemini 11’s record orbit', kicker: 'Two laps 1,369 km up: the highest crewed Earth orbit until 2024.',
    day: () => utc(1966, 9, 14, 2, 12), view: 'earth', frame: upTo(1450), pace: 2 * MINUTE,
    overlay: flightOverlay(GEMINI_11, 'Gemini 11'),
    card: () => ({
      when: '14 September 1966',
      intro: 'Pete Conrad and Dick Gordon fired the engine of the Agena target they had docked with and climbed to 1,369 km, twice round the Earth on a stretched orbit, before coming back down.',
      facts: [
        { label: 'Orbit', value: '~298 × 1,369 km' },
        { label: 'Program', value: 'Gemini: 10 crewed flights, 1965-66' },
        { label: 'Record stood until', value: 'Polaris Dawn, September 2024 (~1,400 km)' },
      ],
      body: ['Gemini 6A and 7 met in orbit in December 1965, within a foot of each other; Gemini 8 made the first docking in March 1966.'],
    }),
  },
  {
    id: 'apollo-8', group: 'To the Moon', title: 'Apollo 8', kicker: 'The first people round the Moon, and Earthrise.',
    day: () => utc(1968, 12, 24, 9, 59), view: 'earth', pace: 6 * HOUR,
    journey: () => ({ from: utc(1968, 12, 21, 12, 51), to: utc(1968, 12, 27, 15, 52), pace: 8 * HOUR, label: 'Fly the six days' }),
    overlay: flightOverlay(APOLLO_8, 'Apollo 8'),
    card: () => ({
      when: 'In lunar orbit 24-25 December 1968',
      intro: 'Frank Borman, Jim Lovell and Bill Anders were the first people to leave Earth orbit. They circled the Moon ten times, and on the fourth lap Anders photographed the Earth rising over its horizon.',
      facts: [
        { label: 'Launch', value: '21 December 1968, 12:51 UTC' },
        { label: 'Into lunar orbit', value: '24 December, 09:59 UTC' },
        { label: 'Splashdown', value: '27 December 1968' },
      ],
      body: ['They read from Genesis on Christmas Eve to the largest television audience there had ever been.'],
    }),
  },
  {
    id: 'apollo-11-close', group: 'To the Moon', title: 'Apollo 11', kicker: 'Out to the Moon and back: the first landing.',
    day: () => utc(1969, 7, 20, 20, 17), view: 'earth', pace: 6 * HOUR,
    related: { id: 'apollo-11', label: 'See it among the planets' },
    journey: () => ({ from: utc(1969, 7, 16, 13, 32), to: utc(1969, 7, 24, 16, 51), pace: 12 * HOUR, label: 'Fly the eight days' }),
    overlay: flightOverlay(APOLLO_11, 'Apollo 11'),
    card: () => ({
      when: 'Landing: 20 July 1969, 20:17 UTC',
      intro: 'After a lap and a half of the Earth in a ~185 km parking orbit, the third stage fired at 16:16 UTC and sent Armstrong, Aldrin and Collins towards where the Moon would be three days later, at ~10.8 km/s (~39,000 km/h).',
      facts: [
        { label: 'Launch', value: '16 July 1969, 13:32 UTC' },
        { label: 'Into lunar orbit', value: '19 July, 17:22 UTC' },
        { label: 'First step', value: '21 July, ~02:56 UTC' },
        { label: 'Splashdown', value: '24 July 1969, 16:51 UTC' },
      ],
      body: [
        'Drawn from above, as here, the outbound and homebound legs are long ellipses that swing round the Earth; the famous figure of eight appears only in a frame that turns with the Moon.',
        'Six Apollo crews landed between 1969 and 1972: 12 people have walked on the Moon, and 24 flew there.',
      ],
      notes: ['The path is representative: real dates and distances joined by simple orbits.'],
    }),
  },
  {
    id: 'apollo-13', group: 'To the Moon', title: 'Apollo 13', kicker: '“Houston, we’ve had a problem”: home round the far side.',
    day: () => utc(1970, 4, 15, 0, 21), view: 'earth', pace: 6 * HOUR,
    journey: () => ({ from: utc(1970, 4, 11, 19, 13), to: utc(1970, 4, 17, 18, 8), pace: 8 * HOUR, label: 'Fly the six days' }),
    overlay: flightOverlay(APOLLO_13, 'Apollo 13'),
    card: () => ({
      when: 'Round the Moon: 15 April 1970, 00:21 UTC',
      intro: 'An oxygen tank burst 56 hours out. Jim Lovell, Jack Swigert and Fred Haise shut down the command module, lived in the lunar module and swung round the far side, 254 km up, to fall back to Earth.',
      facts: [
        { label: 'Tank burst', value: '14 April 1970, 03:08 UTC' },
        { label: 'Farthest from Earth', value: '400,171 km, a record for 56 years' },
        { label: 'Splashdown', value: '17 April 1970, 18:08 UTC' },
      ],
      body: ['The Moon was near its farthest from the Earth, so the swing round its far side took them farther from home than anyone had been, until Artemis II in 2026.'],
    }),
  },
  {
    id: 'apollo-17', group: 'To the Moon', title: 'Apollo 17', kicker: 'The last people on the Moon, and the Blue Marble.',
    day: () => utc(1972, 12, 11, 19, 55), view: 'earth', pace: 6 * HOUR,
    journey: () => ({ from: utc(1972, 12, 7, 5, 33), to: utc(1972, 12, 19, 19, 25), pace: 16 * HOUR, label: 'Fly the twelve days' }),
    overlay: flightOverlay(APOLLO_17, 'Apollo 17'),
    card: () => ({
      when: 'Landing: 11 December 1972, 19:55 UTC',
      intro: 'Eugene Cernan and Harrison Schmitt, the only geologist to walk on the Moon, spent three days in the valley of Taurus-Littrow while Ronald Evans circled overhead. On the way out the crew took the Blue Marble, the whole sunlit Earth.',
      facts: [
        { label: 'Launch', value: '7 December 1972, 05:33 UTC' },
        { label: 'Last lift-off', value: '14 December 1972, 22:55 UTC' },
        { label: 'Splashdown', value: '19 December 1972' },
      ],
      body: ['No one went back beyond low Earth orbit for 53 years, until Artemis II.'],
    }),
  },
  {
    id: 'salyut-1', group: 'Space stations', title: 'Salyut 1', kicker: 'The first space station.',
    day: () => utc(1971, 4, 19, 1, 40), view: 'earth', frame: upTo(420), select: 'salyut', pace: MINUTE,
    card: () => ({
      when: 'Launched 19 April 1971',
      intro: 'A Soviet station ~200 to 222 km up. Its only crew, on Soyuz 11 in June 1971, lived aboard for 23 days; Georgy Dobrovolsky, Vladislav Volkov and Viktor Patsayev died when their capsule lost its air on the way home.',
      facts: [
        { label: 'Height', value: '~200 to 222 km' },
        { label: 'Re-entered', value: '11 October 1971' },
      ],
      body: ['Soyuz, the ship that carried them, first flew in 1967 and still ferries crews to the ISS as Soyuz MS: the longest-serving crewed spacecraft.'],
    }),
  },
  {
    id: 'skylab', group: 'Space stations', title: 'Skylab', kicker: 'America’s first station, on the last Saturn V.',
    day: () => utc(1973, 5, 14, 17, 30), view: 'earth', frame: upTo(600), select: 'skylab', pace: MINUTE,
    card: () => ({
      when: 'Launched 14 May 1973',
      intro: 'Built from a Saturn V third stage, ~435 km up. Three crews lived aboard between May 1973 and February 1974, ~171 days in all, and the first had to rescue it, rigging a sunshade and freeing a jammed solar wing.',
      facts: [
        { label: 'Height', value: '~434 to 442 km' },
        { label: 'Crewed', value: '25 May 1973 to 8 February 1974' },
        { label: 'Fell', value: '11 July 1979, over Western Australia' },
      ],
      body: ['Esperance, where pieces landed, fined NASA A$400 for littering.'],
    }),
  },
  {
    id: 'shuttle', group: 'Space stations', title: 'The Space Shuttle', kicker: 'STS-1: the first flight of a reusable spaceplane.',
    day: () => utc(1981, 4, 12, 12, 0), view: 'earth', frame: upTo(650), select: 'leo', pace: MINUTE,
    card: () => ({
      when: 'STS-1 launched 12 April 1981',
      intro: 'John Young and Bob Crippen flew Columbia on its first flight, twenty years to the day after Gagarin. In thirty years the shuttles flew 135 missions, the last landing on 21 July 2011.',
      facts: [
        { label: 'Missions', value: '135, 1981-2011' },
        { label: 'Usual height', value: '~300 to 400 km' },
        { label: 'Highest', value: '621 km, launching Hubble (1990)' },
      ],
      body: ['It launched Hubble and serviced it five times, docked with Mir, and carried up much of the ISS.'],
    }),
  },
  {
    id: 'mir', group: 'Space stations', title: 'Mir', kicker: 'The first station built in orbit, module by module.',
    day: () => utc(1986, 2, 19, 21, 28), view: 'earth', frame: upTo(500), select: 'mir', pace: MINUTE,
    card: () => ({
      when: 'Core launched 19 February 1986, 21:28 UTC',
      intro: 'For fifteen years the Soviet, then Russian, station grew to seven modules ~354 to 374 km up. Valeri Polyakov lived aboard for 437 days in 1994-95, still the longest single flight.',
      facts: [
        { label: 'Height', value: '~354 to 374 km' },
        { label: 'Brought down', value: '23 March 2001' },
      ],
      body: ['Nine shuttle dockings between 1995 and 1998 rehearsed the partnership that built the ISS.'],
    }),
  },
  {
    id: 'hubble', group: 'Satellites', title: 'Hubble', kicker: 'A telescope above the air, serviced by astronauts.',
    day: () => utc(1990, 4, 25), view: 'earth', frame: upTo(700), select: 'hubble', pace: MINUTE,
    card: () => ({
      when: 'Released 25 April 1990',
      intro: 'Discovery, on the highest shuttle flight of all (621 km), released Hubble ~614 km up. Five servicing crews between 1993 and 2009 repaired and upgraded it.',
      facts: [
        { label: 'Height then', value: '~614 km' },
        { label: 'Height now', value: '~470 km, and sinking' },
        { label: 'Mirror', value: '2.4 m' },
      ],
      body: ['Drag from the upper air, stronger with the Sun at its most active, is bringing it down; estimates for its re-entry run from 2028 to the 2030s.'],
    }),
  },
  {
    id: 'gps', group: 'Satellites', title: 'GPS complete', kicker: 'Twenty-four satellites in medium orbit.',
    day: () => utc(1995, 7, 17), view: 'earth', frame: upTo(21000), select: 'gps', pace: 10 * MINUTE,
    card: () => ({
      when: 'Full operational capability announced 17 July 1995',
      intro: 'The US Air Force declared GPS complete: 24 satellites in six rings of orbits ~20,200 km up, each lapping the Earth twice a day, so that four or more are always in view.',
      facts: [
        { label: 'Height', value: '~20,200 km' },
        { label: 'One lap', value: '11 h 58 min' },
        { label: 'First launch', value: '22 February 1978' },
        { label: 'Working now', value: '31' },
      ],
      body: ['Medium Earth orbit, between the stations and the geostationary belt, is where the navigation constellations fly: Europe’s Galileo, Russia’s GLONASS and China’s BeiDou too.'],
    }),
  },
  {
    id: 'iss', group: 'Space stations', title: 'The ISS begins', kicker: 'Zarya, the first module.',
    day: () => utc(1998, 11, 20, 6, 40), view: 'earth', frame: upTo(500), select: 'iss', pace: MINUTE,
    card: () => ({
      when: 'Zarya launched 20 November 1998, 06:40 UTC',
      intro: 'A Russian Proton launched Zarya; two weeks later the shuttle Endeavour joined the US node Unity to it. Over the next decade more than forty assembly flights built the station ~400 km up.',
      facts: [
        { label: 'Height', value: '~413 to 422 km' },
        { label: 'Tilt', value: '51.6° to the equator' },
        { label: 'Mass now', value: '~420,000 kg' },
      ],
      body: ['Its orbit is tilted so that rockets from both Florida and Baikonur can reach it.'],
    }),
  },
  {
    id: 'iss-crewed', group: 'Space stations', title: 'Always crewed', kicker: 'People have lived in orbit every day since 2 November 2000.',
    day: () => utc(2000, 11, 2, 9, 21), view: 'earth', frame: upTo(500), select: 'iss', pace: MINUTE,
    card: () => ({
      when: 'Expedition 1 arrived 2 November 2000',
      intro: 'Bill Shepherd, Yuri Gidzenko and Sergei Krikalev moved in, and someone has been aboard ever since: more than 25 years of people living off the Earth without a break.',
      facts: [
        { label: 'Visitors', value: '290 people from 26 countries (August 2025)' },
        { label: 'Laps a day', value: '~15.5: ~16 sunrises' },
        { label: 'Crew now', value: '7 (September 2026)' },
      ],
      body: ['Soyuz and, since 2020, SpaceX’s Crew Dragon carry the crews. The station is to fly through 2030 and then be steered into the South Pacific by a US Deorbit Vehicle, around 2031.'],
    }),
  },
  {
    id: 'shenzhou-5', group: 'The space age', title: 'Shenzhou 5', kicker: 'Yang Liwei, China’s first astronaut.',
    day: () => utc(2003, 10, 15, 1, 0), view: 'earth', frame: upTo(420), pace: 2 * MINUTE,
    journey: () => ({ from: utc(2003, 10, 15, 1, 0), to: utc(2003, 10, 15, 22, 23), pace: 75 * MINUTE, label: 'Fly the 14 laps' }),
    overlay: flightOverlay(SHENZHOU_5, 'Shenzhou 5'),
    card: () => ({
      when: '15 October 2003, from 01:00 UTC',
      intro: 'China became the third country to fly a person into orbit on its own: Yang Liwei made 14 laps in 21 hours 23 minutes, ~332 to 336 km up.',
      facts: [
        { label: 'Flight', value: '21 h 23 min, 14 laps' },
        { label: 'Height', value: '~332 to 336 km' },
      ],
      body: ['Shenzhou ships now ferry crews of three to China’s station, Tiangong.'],
    }),
  },
  {
    id: 'crew-dragon', group: 'Space stations', title: 'Crew Dragon', kicker: 'The first crew on a commercial spacecraft.',
    day: () => utc(2020, 5, 30, 19, 22), view: 'earth', frame: upTo(500), select: 'iss', pace: MINUTE,
    card: () => ({
      when: 'Demo-2 launched 30 May 2020, 19:22 UTC',
      intro: 'Doug Hurley and Bob Behnken flew SpaceX’s Crew Dragon to the ISS: the first crew launched from the United States since the last shuttle in 2011, on a spacecraft a company built and flies.',
      facts: [{ label: 'Docked', value: '31 May 2020' }],
      body: ['Commercial stations are next: Vast’s Haven-1 is due in 2027, Axiom’s first module the same year at the earliest, then Starlab and Orbital Reef.'],
    }),
  },
  {
    id: 'tiangong', group: 'Space stations', title: 'Tiangong', kicker: 'China’s own space station.',
    day: () => utc(2021, 4, 29, 3, 23), view: 'earth', frame: upTo(450), select: 'tiangong', pace: MINUTE,
    card: () => ({
      when: 'Tianhe core launched 29 April 2021',
      intro: 'The Tianhe core, then the Wentian and Mengtian labs, made a T-shaped station of ~100 tonnes by November 2022, ~390 km up, crewed by three at a time.',
      facts: [
        { label: 'Height', value: '~386 to 392 km' },
        { label: 'Tilt', value: '41.5° to the equator' },
        { label: 'Design life', value: '15 years or more' },
      ],
      body: ['With the ISS, that makes two crewed stations: ten people are in orbit as of September 2026, seven on the ISS and three on Tiangong.'],
    }),
  },
  {
    id: 'starlink', group: 'Satellites', title: 'The megaconstellation', kicker: 'Two of every three working satellites are Starlinks.',
    day: () => utc(2026, 9, 17), view: 'earth', frame: upTo(900), select: 'starlink', pace: MINUTE,
    card: () => ({
      when: '17 September 2026',
      intro: 'SpaceX launched its first 60 Starlinks on 24 May 2019. Seven years on, 11,127 are in orbit, most ~450 to 490 km up: here one dot stands for ~20 of them.',
      facts: [
        { label: 'Working satellites, all kinds', value: '16,810' },
        { label: 'Of them Starlinks', value: '11,114 (66%)' },
        { label: 'Working satellites in 2000', value: '~740' },
      ],
      body: ['Scrub back through the years (More, then Year) and watch low orbit fill.'],
    }),
  },
  {
    id: 'artemis-1', group: 'To the Moon', title: 'Artemis I', kicker: 'Orion flies past the Moon, uncrewed, and loops beyond it.',
    day: () => utc(2022, 11, 28, 21, 52), view: 'earth', pace: 12 * HOUR,
    journey: () => ({ from: utc(2022, 11, 16, 6, 48), to: utc(2022, 12, 11, 17, 40), pace: 1.5 * DAY, label: 'Fly the 25 days' }),
    overlay: flightOverlay(ARTEMIS_1, 'Orion'),
    card: () => ({
      when: 'Launched 16 November 2022, 06:47 UTC',
      intro: 'The first flight of NASA’s SLS rocket sent an empty Orion capsule past the Moon’s far side, 130 km up, into a distant retrograde orbit, looping the Moon against its own motion, for about six days.',
      facts: [
        { label: 'Farthest from Earth', value: '432,210 km, 28 November 2022' },
        { label: 'Closest to the Moon', value: '~130 km' },
        { label: 'Splashdown', value: '11 December 2022, 17:40 UTC' },
      ],
      body: ['On the way home its heat shield lost more char than expected: a finding NASA studied before flying the next Orion with a crew.'],
    }),
  },
  {
    id: 'artemis-2', group: 'To the Moon', title: 'Artemis II', kicker: 'The first people round the Moon since 1972, and farther than ever.',
    day: () => utc(2026, 4, 6, 23, 2), view: 'earth', pace: 6 * HOUR,
    journey: () => ({ from: utc(2026, 4, 1, 22, 35), to: utc(2026, 4, 11, 0, 7), pace: 12 * HOUR, label: 'Fly the nine days' }),
    overlay: flightOverlay(ARTEMIS_2, 'Orion'),
    card: () => ({
      when: 'Round the Moon: 6 April 2026',
      intro: 'Reid Wiseman, Victor Glover, Christina Koch and Jeremy Hansen spent a day in a high orbit round the Earth (~192 × 70,174 km), then flew a free return round the Moon’s far side, 6,545 km up.',
      facts: [
        { label: 'Launch', value: '1 April 2026, 22:35 UTC' },
        { label: 'Farthest from Earth', value: '406,771 km, 6 April, 23:02 UTC' },
        { label: 'Splashdown', value: '11 April 2026, 00:07 UTC' },
      ],
      body: [
        'They passed Apollo 13’s 56-year-old record at 17:56 UTC on 6 April. Koch is the first woman, Glover the first person of colour and Hansen, of the Canadian Space Agency, the first non-American to travel to the Moon.',
        'With them, 28 people have now gone beyond low Earth orbit.',
      ],
    }),
  },
  {
    id: 'artemis-3', group: 'Next', title: 'Artemis III and IV', kicker: 'Planned: a docking test in Earth orbit, then a landing.',
    day: () => utc(2027, 7, 1), view: 'earth', frame: upTo(500), pace: MINUTE,
    card: () => ({
      when: 'Planned: Artemis III in 2027, Artemis IV in 2028',
      intro: 'In February 2026 NASA made Artemis III a crewed test in low Earth orbit, no earlier than mid-2027: Orion is to meet and dock with a commercial lander, SpaceX’s Starship or Blue Origin’s Blue Moon. Artemis IV, in 2028, is to be the first landing since 1972, near the Moon’s south pole.',
      facts: [
        { label: 'Artemis III crew', value: 'Randy Bresnik, Luca Parmitano (ESA), Frank Rubio, Andre Douglas' },
        { label: 'Named', value: '9 June 2026' },
      ],
      body: [
        'Gateway, the small station planned for an orbit round the Moon, was paused in March 2026 in favour of a base on the lunar surface.',
        'China plans to land two astronauts before 2030, with its Mengzhou spacecraft and Lanyue lander, each launched on a Long March 10.',
      ],
      notes: ['Plans, as of September 2026: dates slip.'],
    }),
  },
  {
    id: 'after-iss', group: 'Next', title: 'After the ISS', kicker: 'Planned: commercial stations, and the ISS brought down.',
    day: () => utc(2031, 1, 1), view: 'earth', frame: upTo(500), pace: MINUTE,
    card: () => ({
      when: 'Planned: the ISS through 2030',
      intro: 'NASA plans to fly the ISS through 2030, then steer it down over the remote South Pacific with a SpaceX-built US Deorbit Vehicle (a decision on the exact year is due in 2027). Tiangong flies on.',
      facts: [
        { label: 'Haven-1 (Vast)', value: 'due early 2027, ~425 km' },
        { label: 'Axiom’s first module', value: '2027 at the earliest' },
        { label: 'Starlab, Orbital Reef', value: 'later in the decade' },
      ],
      body: ['Further out: SpaceX plans to refuel Starships in low orbit for trips to the Moon, and one day Mars; in 2026 it put the Moon first, with Mars some five to seven years off.'],
      notes: ['Plans, as of September 2026: dates slip.'],
    }),
  },
];

/** The spaceflight timeline, with the short name each goes by. */
export const SPACEFLIGHT_FEATURED: readonly [id: string, short: string][] = [
  ['sputnik', 'Sputnik 1'],
  ['gagarin', 'Gagarin'],
  ['syncom', 'Geostationary'],
  ['apollo-11-close', 'Apollo 11'],
  ['skylab', 'Skylab'],
  ['shuttle', 'Space Shuttle'],
  ['mir', 'Mir'],
  ['hubble', 'Hubble'],
  ['gps', 'GPS'],
  ['iss-crewed', 'ISS crewed'],
  ['tiangong', 'Tiangong'],
  ['starlink', 'Starlink'],
  ['artemis-1', 'Artemis I'],
  ['artemis-2', 'Artemis II'],
  ['artemis-3', 'Artemis III, IV'],
];
