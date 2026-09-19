/**
 * "Jump to": real moments the explorer can be set to, each with the geometry worth seeing and a card saying what it
 * is and why it matters. Dates are UTC and come from NASA, ESA and JPL (Horizons) records; the launch window and the
 * next opposition are worked out from the ephemeris for whenever the page is opened.
 *
 * Spacecraft paths are schematic: they pass through the real planets at the real encounter dates, but between
 * encounters they follow a smooth transfer paced by Kepler's second law, not a navigation solution.
 */
import type { Vec2 } from '../core/math';
import type { PlanetName } from '../scenes/solar/common';
import { C } from '../scenes/solar/common';
import { dayOf, heliocentric } from '../scenes/solar/ephemeris';
import type { App } from './app';
import type { BodyId, ViewId } from './bodies';
import { dateLong } from './format';
import { fromEarthKm, km, lightTime } from './live';
import { Flight, hohmannDays, nextWindow, planetOnPlan, planPoint, type Polar, type Waypoint } from './orbits';
import { drawCraft, drawMark, drawPath, drawSight, GOLD, text } from './overlays';
import { DAY, WEEK, YEAR } from './sim';
import { SPACEFLIGHT } from './spaceflight';
import { COMET_PRESETS } from './comets';
import { ECLIPSES } from './eclipse';

/** Days from J2000.0 of a UTC date and time. */
export const utc = (y: number, m: number, d: number, h = 0, min = 0): number => dayOf(Date.UTC(y, m - 1, d, h, min));

const A_AU: Record<PlanetName, number> = { mercury: 0.387, venus: 0.723, earth: 1, mars: 1.524, jupiter: 5.203, saturn: 9.537, uranus: 19.19, neptune: 30.07 };

/** A planet's place on a date, at the distance the plan draws its orbit: marks land on the planet as drawn. */
const atPlanet = (name: PlanetName, day: number): Polar => ({ r: A_AU[name], lon: heliocentric(name, day).lon });

const wp = (name: PlanetName, day: number, label: string): Waypoint => ({ day, at: atPlanet(name, day), label });

export interface Fact {
  label: string;
  value: string;
}

export interface Card {
  /** "20 August 1977". */
  when: string;
  intro: string;
  facts: readonly Fact[];
  /** Paragraphs of explanation. */
  body: readonly string[];
  /** Extra lines, as a list. */
  notes?: readonly string[];
}

export interface Preset {
  id: string;
  group: 'Now and next' | 'Launch windows' | 'Missions' | 'Alignments' | 'Eclipses' | 'Comets' | 'The space age' | 'To the Moon' | 'Space stations' | 'Satellites' | 'Next';
  title: string;
  /** One line for the list. */
  kicker: string;
  /** The moment, days from J2000.0. */
  day(): number;
  view?: ViewId;
  /** Select this body and glide in on it. */
  focus?: { body: BodyId; zoom: number };
  /**
   * Otherwise frame the plan: fit a circle of `fit` design units round `at` (default the page's centre: the Sun, or the
   * Earth) into the free screen; `at` may be worked out for the moment (where the Moon is).
   */
  frame?: { fit: number; at?: Vec2 | (() => Vec2) };
  /** The pace to run at from the moment, days a second (it opens paused). */
  pace?: number;
  /** The same moment seen in the other scale (among the planets, or up close round the Earth). */
  related?: { id: string; label: string };
  select?: BodyId;
  /** A journey to play from the moment: until `to`, at `pace` days a second. */
  journey?(): { from: number; to: number; pace: number; label: string };
  overlay?(ctx: CanvasRenderingContext2D, app: App): void;
  card(): Card;
}

/* ---------- shared drawing ---------- */

/** A flight drawn up to the date on screen: flown path, the rest dashed, encounters marked, the craft where it is. */
function flightOverlay(flight: Flight, name: string, color = GOLD, labels = true) {
  return (ctx: CanvasRenderingContext2D, app: App): void => {
    if (app.view !== 'sky') return;
    const now = app.sim.day;
    drawPath(ctx, app, flight.path(flight.start, Math.min(now, flight.end)), flight.path(Math.max(now, flight.start), flight.end), color);
    for (const w of flight.waypoints) drawMark(ctx, app, planPoint(w.at), labels ? w.label : '', now >= w.day);
    const at = flight.at(now);
    if (at) drawCraft(ctx, app, planPoint(at), name);
  };
}

/** Sight lines from Earth through each named planet. */
function sightOverlay(targets: readonly PlanetName[], through?: 'sun') {
  return (ctx: CanvasRenderingContext2D, app: App): void => {
    if (app.view !== 'sky') return;
    const day = app.sim.day, earth = planetOnPlan('earth', day);
    if (through === 'sun') drawSight(ctx, app, C as Vec2, earth, 1);
    for (const t of targets) drawSight(ctx, app, earth, planetOnPlan(t, day), t === 'venus' ? 1.6 : 1.12);
  };
}

/* ---------- the next Mars window ---------- */

const MARS_TRIP = hohmannDays(1, A_AU.mars);

interface MarsWindow {
  depart: number;
  arrive: number;
  /** NASA's planned lowest-energy trajectory, or the ideal Hohmann alignment worked out here. */
  planned: boolean;
}

/**
 * NASA's lowest-energy (type 1) Earth-Mars trajectories for the next two windows (NASA TM-2010-216764, the Mars
 * trajectory handbook); after those, the ideal Hohmann alignment from the ephemeris.
 */
const PLANNED: readonly MarsWindow[] = [
  { depart: utc(2026, 11, 14), arrive: utc(2027, 8, 9), planned: true },
  { depart: utc(2028, 12, 10), arrive: utc(2029, 7, 20), planned: true },
];

let windowCache: { from: number; windows: MarsWindow[] } | null = null;
/** The next five Earth-Mars windows from a date (a window just opened still counts for six weeks). */
function marsWindows(from: number): MarsWindow[] {
  const key = Math.floor(from);
  if (windowCache?.from !== key) {
    const out = PLANNED.filter(w => w.depart >= key - 42);
    let d = Math.max(key, (PLANNED[PLANNED.length - 1]?.depart ?? key) + 400);
    while (out.length < 5) {
      const w = nextWindow('mars', d);
      out.push({ depart: w, arrive: w + MARS_TRIP, planned: false });
      d = w + 400;
    }
    windowCache = { from: key, windows: out };
  }
  return windowCache.windows;
}

const nextMarsWindow = (): MarsWindow => marsWindows(dayOf(Date.now()))[0]!;
const marsFlight = (w: MarsWindow): Flight => new Flight([wp('earth', w.depart, 'Earth at launch'), wp('mars', w.arrive, 'Mars at arrival')]);

/** How far Mars leads Earth round the Sun on a date, degrees. */
const marsLead = (day: number): number => ((((heliocentric('mars', day).lon - heliocentric('earth', day).lon) * 180) / Math.PI) % 360 + 360) % 360;

function marsWindowOverlay(ctx: CanvasRenderingContext2D, app: App): void {
  if (app.view !== 'sky') return;
  const w = nextMarsWindow(), now = app.sim.day;
  flightOverlay(marsFlight(w), 'Spacecraft')(ctx, app);
  // on launch day: Mars must already be well ahead of Earth, to be there when the craft arrives
  if (Math.abs(now - w.depart) < 20) {
    const mars = planetOnPlan('mars', w.depart), earth = planetOnPlan('earth', w.depart);
    drawSight(ctx, app, C as Vec2, earth, 1.3);
    drawSight(ctx, app, C as Vec2, mars, 1.25);
    const a0 = Math.atan2(earth[1] - C[1], earth[0] - C[0]), a1 = Math.atan2(mars[1] - C[1], mars[0] - C[0]), R = 128;
    ctx.save();
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 1.6 / app.renderer.designScale;
    ctx.beginPath();
    // Mars leads counter-clockwise on the page, which is towards smaller angles
    ctx.arc(C[0], C[1], R, a1, a0);
    ctx.stroke();
    ctx.restore();
    let mid = (a0 + a1) / 2;
    if (Math.abs(a0 - a1) > Math.PI) mid += Math.PI;
    text(ctx, app, [C[0] + Math.cos(mid) * (R + 16), C[1] + Math.sin(mid) * (R + 16) + 4 / app.renderer.designScale], `${Math.round(marsLead(w.depart))}°`, 'center', 1, true);
  }
}

/* ---------- the next Mars opposition ---------- */

/** The next date, on or after `from`, when Earth passes between the Sun and Mars (equal heliocentric longitudes). */
function nextOpposition(from: number): number {
  const gap = (d: number): number => {
    const x = (((heliocentric('mars', d).lon - heliocentric('earth', d).lon) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    return x > Math.PI ? x - 2 * Math.PI : x;
  };
  let a = from, ga = gap(a);
  for (let d = from + 5; d < from + 900; d += 5) {
    const gd = gap(d);
    if (ga > 0 && gd <= 0 && ga - gd < Math.PI) {
      let lo = a, hi = d;
      for (let k = 0; k < 40; k++) { const m = (lo + hi) / 2; if (gap(m) > 0) lo = m; else hi = m; }
      return (lo + hi) / 2;
    }
    a = d;
    ga = gd;
  }
  return from;
}

/* ---------- missions ---------- */

const VOYAGER_2 = new Flight([
  wp('earth', utc(1977, 8, 20, 14, 30), ''),
  wp('jupiter', utc(1979, 7, 9, 22, 29), 'V2 · Jupiter 1979'),
  wp('saturn', utc(1981, 8, 26, 3, 24), 'V2 · Saturn 1981'),
  wp('uranus', utc(1986, 1, 24, 17, 59), 'V2 · Uranus 1986'),
  wp('neptune', utc(1989, 8, 25, 3, 56), 'V2 · Neptune 1989'),
]);

const VOYAGER_1 = new Flight([
  wp('earth', utc(1977, 9, 5, 12, 56), ''),
  wp('jupiter', utc(1979, 3, 5, 12, 5), 'V1 · Jupiter 1979'),
  wp('saturn', utc(1980, 11, 12, 23, 46), 'V1 · Saturn 1980'),
]);

const CASSINI = new Flight([
  wp('earth', utc(1997, 10, 15, 8, 43), ''),
  wp('venus', utc(1998, 4, 26), 'Venus'),
  wp('venus', utc(1999, 6, 24), 'Venus again'),
  wp('earth', utc(1999, 8, 18, 3, 28), 'Earth'),
  wp('jupiter', utc(2000, 12, 30), 'Jupiter'),
  wp('saturn', utc(2004, 7, 1, 2, 48), 'Saturn 2004'),
]);

const plutoAt = (day: number): Polar => {
  const h = heliocentric('pluto', day);
  return { r: h.r * Math.cos(h.lat), lon: h.lon };
};
const NEW_HORIZONS = new Flight([
  wp('earth', utc(2006, 1, 19, 19), ''),
  wp('jupiter', utc(2007, 2, 28, 5, 44), 'Jupiter 2007'),
  { day: utc(2015, 7, 14, 11, 49), at: plutoAt(utc(2015, 7, 14, 11, 49)), label: 'Pluto 2015' },
]);

const CURIOSITY = new Flight([wp('earth', utc(2011, 11, 26, 15, 2), 'Launch'), wp('mars', utc(2012, 8, 6, 5, 18), 'Landing')]);
const PERSEVERANCE = new Flight([wp('earth', utc(2020, 7, 30, 11, 50), 'Launch'), wp('mars', utc(2021, 2, 18, 20, 44), 'Landing')]);

/** Pluto marked on the plan, for New Horizons. */
function plutoMark(ctx: CanvasRenderingContext2D, app: App): void {
  if (app.view !== 'sky') return;
  drawMark(ctx, app, planPoint(plutoAt(app.sim.day)), 'Pluto', true);
}

/* ---------- the presets ---------- */

const SOLAR_PRESETS: readonly Preset[] = [
  {
    id: 'juice-earth',
    group: 'Now and next',
    title: 'JUICE swings past Earth',
    kicker: 'Borrowing speed on the way to Jupiter.',
    day: () => utc(2026, 9, 28, 11, 45),
    view: 'sky',
    focus: { body: 'earth', zoom: 3 },
    card: () => ({
      when: '28 September 2026, 11:45 UTC (on ESA’s current trajectory)',
      intro: 'ESA’s Jupiter Icy Moons Explorer passes about 8,600 km above Earth, the second of its Earth flybys, trading some of our planet’s orbital speed for its own.',
      facts: [
        { label: 'Launched', value: '14 April 2023' },
        { label: 'Flybys so far', value: 'Moon and Earth (August 2024), Venus (August 2025)' },
        { label: 'Jupiter arrival', value: 'July 2031' },
        { label: 'Then', value: 'orbit Ganymede from December 2034' },
      ],
      body: [
        'In August 2024 JUICE made the first ever double flyby of the Moon and then Earth. After this pass and one more in January 2029 it heads out to Jupiter to study Ganymede, Callisto and Europa, and in 2034 it becomes the first spacecraft to orbit a moon other than our own.',
      ],
    }),
  },
  {
    id: 'voyager-light-day',
    group: 'Now and next',
    title: 'Voyager 1, one light-day from home',
    kicker: 'The first spacecraft a whole light-day away.',
    day: () => utc(2026, 11, 18, 10, 16),
    view: 'sky',
    card: () => ({
      when: '18 November 2026, 10:16 UTC',
      intro: 'Launched in 1977, Voyager 1 becomes the first human-made object one light-day from Earth: a radio signal, crossing space at the speed of light, needs a full 24 hours to reach it, and another 24 to hear back.',
      facts: [
        { label: 'One light-day', value: '25.9 billion km (173 au)' },
        { label: 'Speed', value: '~17 km/s (~3.6 au a year) away from the Sun' },
        { label: 'Crossed into interstellar space', value: '25 August 2012' },
        { label: 'Voyager 2 follows', value: 'one light-day out in November 2035' },
      ],
      body: [
        'Both Voyagers are still talking to Earth after nearly 50 years, on nuclear batteries that each lose about 4 watts a year. Engineers switch instruments off one by one to save power; NASA hopes to keep at least one working into the 2030s.',
        'On the plan it is far off the edge of the page: 173 au is more than five times Neptune’s distance.',
      ],
    }),
  },
  {
    id: 'bepicolombo',
    group: 'Now and next',
    title: 'BepiColombo arrives at Mercury',
    kicker: 'After an eight-year braking journey.',
    day: () => utc(2026, 11, 21),
    view: 'sky',
    focus: { body: 'mercury', zoom: 3 },
    card: () => ({
      when: '21 November 2026 (planned)',
      intro: 'Europe and Japan’s BepiColombo is due to slip into orbit round Mercury, eight years after it left Earth in October 2018.',
      facts: [
        { label: 'Launched', value: '20 October 2018' },
        { label: 'Mercury orbit insertion', value: '21 November 2026 (planned)' },
        { label: 'Direct Hohmann trip', value: '~105 days, but you could not stop' },
      ],
      body: [
        'Going to Mercury is harder than it looks. Falling towards the Sun, a spacecraft speeds up, and shedding that speed to be caught by a small planet takes more energy than going to Pluto. So BepiColombo brakes the slow way: flybys of Earth, Venus and Mercury itself, each trimming its orbit, until it can be captured.',
        'NASA’s MESSENGER did the same: launched in 2004, it reached Mercury orbit in 2011 after six and a half years.',
      ],
    }),
  },
  {
    id: 'europa-clipper',
    group: 'Now and next',
    title: 'Europa Clipper swings past Earth',
    kicker: 'A slingshot on the way to Jupiter.',
    day: () => utc(2026, 12, 3),
    view: 'sky',
    focus: { body: 'earth', zoom: 3 },
    card: () => ({
      when: '3 December 2026',
      intro: 'NASA’s Europa Clipper, launched in October 2024, comes back past Earth about 3,200 km above it, borrowing some of our planet’s orbital speed to fling itself out to Jupiter.',
      facts: [
        { label: 'Launched', value: '14 October 2024' },
        { label: 'Mars flyby', value: '1 March 2025' },
        { label: 'Earth flyby', value: '3 December 2026' },
        { label: 'Jupiter arrival', value: 'April 2030, then 49 flybys of Europa' },
      ],
      body: [
        'A gravity assist leaves a spacecraft with the same speed relative to the planet it passes but a new direction, so relative to the Sun it can gain (or lose) a lot. Two assists let Clipper reach Jupiter with a smaller rocket.',
        'Europa hides a salty ocean under its ice, perhaps with twice the water of all Earth’s oceans. Clipper will measure the ice and the ocean and ask whether it could support life.',
      ],
    }),
  },
  {
    id: 'mars-window',
    group: 'Launch windows',
    title: 'The next launch window to Mars',
    kicker: 'Every ~26 months Earth and Mars line up for the cheapest trip.',
    day: () => nextMarsWindow().depart,
    view: 'sky',
    frame: { fit: 240 },
    select: 'mars',
    journey() {
      const w = nextMarsWindow();
      return { from: w.depart, to: w.arrive, pace: 3 * WEEK, label: 'Fly the transfer' };
    },
    overlay: marsWindowOverlay,
    card() {
      const ws = marsWindows(dayOf(Date.now())), w = ws[0]!, trip = Math.round(w.arrive - w.depart);
      return {
        when: `${w.planned ? '' : 'Around '}${dateLong(w.depart)}`,
        intro: 'You cannot fly to Mars whenever you like. The cheapest path is a transfer orbit that leaves Earth’s orbit and meets Mars’s on the far side of the Sun, and it only works when Mars is the right distance ahead of us.',
        facts: [
          { label: 'Launch', value: dateLong(w.depart) },
          { label: 'Arrival', value: `${dateLong(w.arrive)} (${trip} days)` },
          { label: 'Mars ahead at launch', value: `~${Math.round(marsLead(w.depart))}°` },
          { label: 'Windows recur', value: 'every ~780 days (~26 months)' },
        ],
        body: [
          'In the ideal case, a Hohmann transfer, the craft leaves Earth about 2.9 km/s faster than Earth itself moves (some 3.6 km/s of burn from low orbit) and coasts out along half an ellipse, slowing as it climbs, for ~259 days. To find Mars waiting at the end, it must set off when Mars is ~44° ahead of Earth, and Earth only gets back into that position every ~26 months. Miss the window and you wait.',
          w.planned
            ? `These dates are NASA’s lowest-energy trajectory for this window, from its Mars trajectory handbook: real orbits are ellipses, not circles, so the best path is a little shorter or longer than half an orbit and the lead a little off 44°. A launch period lasts a few weeks.${w.depart < utc(2027, 1, 1) ? ' Japan’s MMX, bound for Mars’s moon Phobos, is set to launch in this window in October 2026, and NASA’s twin ESCAPADE orbiters, launched in November 2025 and waiting near L2, swing past Earth in November to reach Mars in September 2027.' : ''}`
            : 'This date is the ideal Hohmann alignment worked out from the planets’ real positions; real launch periods last a few weeks and fall near it, shifted by the planets’ elliptical orbits.',
          'Real missions often pay for speed: Perseverance took 203 days, Curiosity ~254.',
        ],
        notes: ['Coming windows:', ...ws.map(x => `${dateLong(x.depart)} → ${dateLong(x.arrive)}${x.planned ? '' : ' (ideal alignment)'}`)],
      };
    },
  },
  {
    id: 'voyager',
    group: 'Missions',
    title: 'Voyager and the Grand Tour',
    kicker: 'A once-in-175-years line-up of the outer planets.',
    day: () => utc(1977, 8, 20, 14, 30),
    view: 'sky',
    frame: { fit: 510 },
    journey: () => ({ from: utc(1977, 8, 20, 14, 30), to: utc(1989, 8, 25, 3, 56), pace: YEAR, label: 'Fly the Grand Tour' }),
    overlay(ctx, app) {
      flightOverlay(VOYAGER_1, 'Voyager 1', '#f4e3b5', true)(ctx, app);
      flightOverlay(VOYAGER_2, 'Voyager 2')(ctx, app);
    },
    card: () => ({
      when: '20 August 1977 (Voyager 2) and 5 September 1977 (Voyager 1)',
      intro: 'In the late 1970s Jupiter, Saturn, Uranus and Neptune lined up so that one spacecraft could swing from each planet to the next, every flyby bending its path towards the one after. That line-up comes round about every 175 years.',
      facts: [
        { label: 'Voyager 2 flybys', value: 'Jupiter 1979, Saturn 1981, Uranus 1986, Neptune 1989' },
        { label: 'Voyager 1 flybys', value: 'Jupiter 1979, Saturn 1980' },
        { label: 'Trip to Neptune', value: '12 years instead of 30' },
        { label: 'Interstellar space', value: 'Voyager 1 in 2012, Voyager 2 in 2018' },
      ],
      body: [
        'Gary Flandro, a graduate student working at JPL, spotted the alignment in 1965. A four-spacecraft "Grand Tour" was cancelled as too costly, so the two Voyagers were funded for Jupiter and Saturn only; Voyager 2’s mission was later stretched to Uranus and Neptune, and it is still the only spacecraft to have visited either.',
        'Voyager 1 skipped the rest to take a close look at Saturn’s moon Titan, which swung it up out of the plane of the planets. Both carry a golden record of sounds and pictures from Earth.',
        'Now (September 2026) Voyager 1 is ~172 au from the Sun and Voyager 2 ~144 au: radio signals take about 24 and 20 hours to reach them.',
      ],
    }),
  },
  {
    id: 'apollo-11',
    group: 'Missions',
    title: 'Apollo 11',
    kicker: 'The first people on the Moon.',
    day: () => utc(1969, 7, 20, 20, 17),
    view: 'sky',
    focus: { body: 'earth', zoom: 6 },
    related: { id: 'apollo-11-close', label: 'See the flight up close' },
    journey: () => ({ from: utc(1969, 7, 16, 13, 32), to: utc(1969, 7, 24, 16, 51), pace: 0.75 * DAY, label: 'Play the eight days' }),
    card: () => ({
      when: 'Landing: 20 July 1969, 20:17 UTC',
      intro: 'Neil Armstrong and Buzz Aldrin landed the lunar module Eagle in the Sea of Tranquility while Michael Collins circled overhead in Columbia. The Moon here stands about 70° round from the Sun, as it did that night: a waxing crescent in Earth’s evening sky.',
      facts: [
        { label: 'Launch', value: '16 July 1969, 13:32 UTC' },
        { label: 'First step', value: '21 July 1969, 02:56 UTC' },
        { label: 'Splashdown', value: '24 July 1969' },
        { label: 'Moonwalkers, 1969-1972', value: '12, on six landings' },
      ],
      body: [
        'Apollo 8 had first carried people round the Moon at Christmas 1968, when Bill Anders took the "Earthrise" photograph. After Apollo 11 came five more landings; Eugene Cernan of Apollo 17 left the last footprints in December 1972. The missions brought back 382 kg of Moon rock.',
        'In April 2026 Artemis II took four astronauts round the Moon again, the first crew there since 1972, and flew 406,771 km from Earth, farther than anyone before them.',
      ],
    }),
  },
  {
    id: 'cassini',
    group: 'Missions',
    title: 'Cassini-Huygens',
    kicker: 'To Saturn by way of Venus, Venus, Earth and Jupiter.',
    day: () => utc(1997, 10, 15, 8, 43),
    view: 'sky',
    frame: { fit: 390 },
    journey: () => ({ from: utc(1997, 10, 15, 8, 43), to: utc(2004, 7, 1, 2, 48), pace: 0.5 * YEAR, label: 'Fly to Saturn' }),
    overlay: flightOverlay(CASSINI, 'Cassini'),
    card: () => ({
      when: '15 October 1997',
      intro: 'Cassini was too heavy to fly straight to Saturn. Instead it stole speed from four flybys, Venus twice, then Earth, then Jupiter, and reached Saturn six and a half years later.',
      facts: [
        { label: 'Flybys', value: 'Venus Apr 1998 and Jun 1999, Earth Aug 1999, Jupiter Dec 2000' },
        { label: 'Saturn arrival', value: '1 July 2004' },
        { label: 'Huygens on Titan', value: '14 January 2005' },
        { label: 'Grand Finale', value: 'dived into Saturn, 15 September 2017' },
      ],
      body: [
        'The Earth flyby alone added about 5.5 km/s. At Saturn, Cassini made 294 orbits over 13 years, found the geysers of Enceladus, and mapped seas of liquid methane on Titan.',
        'Its European probe Huygens parachuted through Titan’s orange haze and landed on 14 January 2005: still the most distant landing ever made.',
      ],
    }),
  },
  {
    id: 'new-horizons',
    group: 'Missions',
    title: 'New Horizons to Pluto',
    kicker: 'The fastest launch ever, and a slingshot off Jupiter.',
    day: () => utc(2006, 1, 19, 19),
    view: 'sky',
    frame: { fit: 530 },
    journey: () => ({ from: utc(2006, 1, 19, 19), to: utc(2015, 7, 14, 11, 49), pace: YEAR, label: 'Fly to Pluto' }),
    overlay(ctx, app) {
      plutoMark(ctx, app);
      flightOverlay(NEW_HORIZONS, 'New Horizons')(ctx, app);
    },
    card: () => ({
      when: '19 January 2006',
      intro: 'New Horizons left Earth faster than anything before it, about 16.26 km/s (58,536 km/h), and passed the Moon’s orbit just nine hours after launch.',
      facts: [
        { label: 'Jupiter flyby', value: '28 February 2007, gaining ~4 km/s' },
        { label: 'Pluto flyby', value: '14 July 2015, ~12,500 km up' },
        { label: 'Arrokoth flyby', value: '1 January 2019' },
        { label: 'Hohmann trip to Pluto', value: '~45 years; it took 9.5' },
      ],
      body: [
        'Jupiter’s gravity added nearly 4 km/s and cut three years off the trip. At Pluto it found a heart-shaped plain of nitrogen ice and mountains of water ice; then it flew on to Arrokoth, a small, double-lobed world in the Kuiper belt, the most distant object ever visited.',
        'Pluto is marked here from its orbital elements. In 2006, the year New Horizons launched, the IAU reclassified Pluto as a dwarf planet.',
      ],
    }),
  },
  {
    id: 'curiosity',
    group: 'Missions',
    title: 'Curiosity',
    kicker: 'A car-sized rover, lowered by sky crane.',
    day: () => utc(2011, 11, 26, 15, 2),
    view: 'sky',
    frame: { fit: 240 },
    journey: () => ({ from: utc(2011, 11, 26, 15, 2), to: utc(2012, 8, 6, 5, 18), pace: 3 * WEEK, label: 'Fly to Mars' }),
    overlay: flightOverlay(CURIOSITY, 'Curiosity'),
    card: () => ({
      when: '26 November 2011',
      intro: 'Curiosity launched in the 2011 window and landed in Gale Crater on 6 August 2012, lowered to the ground on cables by a rocket-powered "sky crane".',
      facts: [
        { label: 'Cruise', value: '~254 days, ~567 million km' },
        { label: 'Landing', value: '6 August 2012, 05:18 UTC' },
        { label: 'Rover mass', value: '899 kg' },
        { label: 'Still driving', value: 'reached 1 km of climb up Mount Sharp in August 2026' },
      ],
      body: [
        'It found that Gale Crater once held a lake that could have supported microbial life, and it is still climbing Mount Sharp, reading the planet’s history layer by layer.',
      ],
    }),
  },
  {
    id: 'perseverance',
    group: 'Missions',
    title: 'Perseverance and Ingenuity',
    kicker: 'A rover, and the first helicopter on another world.',
    day: () => utc(2020, 7, 30, 11, 50),
    view: 'sky',
    frame: { fit: 240 },
    journey: () => ({ from: utc(2020, 7, 30, 11, 50), to: utc(2021, 2, 18, 20, 44), pace: 2 * WEEK, label: 'Fly to Mars' }),
    overlay: flightOverlay(PERSEVERANCE, 'Perseverance'),
    card: () => ({
      when: '30 July 2020',
      intro: 'Perseverance crossed 472 million km in 203 days and landed in Jezero Crater, an ancient river delta, on 18 February 2021.',
      facts: [
        { label: 'Landing', value: '18 February 2021, 20:44 UTC' },
        { label: 'Samples', value: '33 of 43 tubes filled (2026)' },
        { label: 'Ingenuity’s first flight', value: '19 April 2021: 39 seconds' },
        { label: 'Ingenuity in all', value: '72 flights, 17 km' },
      ],
      body: [
        'Ingenuity was meant to try five flights in 30 days; it flew 72 times over nearly three years before a hard landing broke its rotor blades in January 2024.',
        'Perseverance seals rock cores in tubes for a future return to Earth, though NASA closed its Mars Sample Return programme in its 2026 budget.',
      ],
    }),
  },
  {
    id: 'webb',
    group: 'Missions',
    title: 'James Webb Space Telescope',
    kicker: 'A telescope a million and a half km out.',
    day: () => utc(2021, 12, 25, 12, 20),
    view: 'sky',
    focus: { body: 'earth', zoom: 6 },
    journey: () => ({ from: utc(2021, 12, 25, 12, 20), to: utc(2022, 1, 24, 19), pace: 3 * DAY, label: 'Play the month out to L2' }),
    card: () => ({
      when: '25 December 2021, 12:20 UTC',
      intro: 'Webb rode an Ariane 5 from Kourou and spent a month unfolding on its way to L2, a balance point ~1.5 million km from Earth on the side away from the Sun, about four times as far as the Moon.',
      facts: [
        { label: 'Arrived at L2', value: '24 January 2022' },
        { label: 'Mirror', value: '6.5 m, 18 gold-coated segments' },
        { label: 'Sunshield', value: '21 × 14 m, five layers' },
        { label: 'First images', value: '11-12 July 2022' },
      ],
      body: [
        'At L2 the Sun, Earth and Moon all stay on one side, so a single sunshield keeps the telescope in permanent shade, cold enough to see the faint infrared glow of the first galaxies. It circles L2 while L2 circles the Sun with the Earth, once a year.',
      ],
    }),
  },
  {
    id: 'great-conjunction',
    group: 'Alignments',
    title: 'The great conjunction of 2020',
    kicker: 'Jupiter and Saturn a tenth of a degree apart.',
    day: () => utc(2020, 12, 21, 18, 20),
    view: 'sky',
    frame: { fit: 390 },
    overlay: sightOverlay(['jupiter', 'saturn']),
    card: () => ({
      when: '21 December 2020',
      intro: 'Seen from Earth, Jupiter and Saturn crept to just 0.1° apart, a fifth of the width of the full Moon, the closest they had appeared since 1623 and the closest seen at night since 1226.',
      facts: [
        { label: 'Separation', value: '~0.1° (6 arcminutes)' },
        { label: 'Great conjunctions', value: 'every ~20 years' },
        { label: 'Next this close', value: '15 March 2080' },
      ],
      body: [
        'From above you can see what a conjunction is: Earth, Jupiter and Saturn nearly in one line, so the two giants, some 730 million km apart in space, stand side by side in our sky. The dashed lines are our lines of sight.',
        'Jupiter laps Saturn every ~20 years; how close the pair look depends on where the meeting falls, because their orbits are tilted slightly to each other.',
      ],
    }),
  },
  {
    id: 'mars-2003',
    group: 'Alignments',
    title: 'Mars at its closest in 60,000 years',
    kicker: 'Just 55.76 million km away.',
    day: () => utc(2003, 8, 27, 9, 50),
    view: 'sky',
    frame: { fit: 240 },
    select: 'mars',
    overlay: sightOverlay(['mars'], 'sun'),
    card: () => ({
      when: '27 August 2003',
      intro: 'At opposition, Earth passes between the Sun and Mars: Sun, Earth and Mars stand in a line, and Mars is up all night at its brightest. In 2003 that happened just as Mars neared the point of its orbit closest to the Sun.',
      facts: [
        { label: 'Closest approach', value: '55.76 million km (27 August 2003)' },
        { label: 'Light time', value: '3.1 minutes' },
        { label: 'Oppositions', value: 'every ~26 months' },
        { label: 'This close again', value: 'not until 2287' },
      ],
      body: [
        'Mars’s orbit is stretched (eccentricity 0.09), so some oppositions are much closer than others: 2003’s was the closest in nearly 60,000 years, while the one in February 2027 is the farthest of the century, ~101 million km. The next good one comes in September 2035, 56.9 million km.',
      ],
    }),
  },
  {
    id: 'next-opposition',
    group: 'Alignments',
    title: 'The next Mars opposition',
    kicker: 'When Earth next overtakes Mars.',
    day: () => nextOpposition(dayOf(Date.now())),
    view: 'sky',
    frame: { fit: 240 },
    select: 'mars',
    overlay: sightOverlay(['mars'], 'sun'),
    card() {
      const d = nextOpposition(dayOf(Date.now()));
      return {
        when: dateLong(d),
        intro: 'Earth, on its faster inside track, overtakes Mars about every 26 months. On the day it passes, Sun, Earth and Mars line up and Mars rises at sunset, bright and up all night.',
        facts: [
          { label: 'Distance then', value: km(fromEarthKm('mars', d)) },
          { label: 'Light time', value: lightTime(fromEarthKm('mars', d)) },
        ],
        body: ['The closest approach can fall a few days from opposition itself, because Mars’s orbit is not quite a circle.'],
      };
    },
  },
  {
    id: 'parade-2025',
    group: 'Alignments',
    title: 'A planet parade',
    kicker: 'Every planet on one side of the sky.',
    day: () => utc(2025, 2, 28, 18),
    view: 'sky',
    frame: { fit: 510 },
    overlay: sightOverlay(['mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune']),
    card: () => ({
      when: '28 February 2025',
      intro: 'In the evenings of early 2025 Venus, Mars, Jupiter and Saturn shone together after sunset, with Uranus and Neptune there for binoculars, and around 28 February Mercury joined them low in the west (though NASA warned Mercury and Saturn were too low and faint for most to see).',
      facts: [
        { label: 'What a parade is', value: 'several planets on the same side of the Sun as seen from Earth' },
        { label: 'Next notable', value: 'late October 2028 (five before dawn)' },
      ],
      body: [
        'From above it is plain that the planets were never in a line: they were simply all on the evening side of our sky. The sight lines fan out across the sky rather than lying together.',
        'Planets always look strung along one arc, the ecliptic, because the solar system is almost flat: every orbit lies within a few degrees of Earth’s (Mercury’s tilts most, 7°).',
      ],
    }),
  },
  {
    id: 'venus-transit',
    group: 'Alignments',
    title: 'The transit of Venus',
    kicker: 'Venus crosses the face of the Sun.',
    day: () => utc(2012, 6, 6, 1, 29),
    view: 'sky',
    frame: { fit: 190 },
    select: 'venus',
    overlay: sightOverlay(['venus']),
    card: () => ({
      when: '5-6 June 2012',
      intro: 'For about six hours Venus crept across the Sun as a small black dot, lined up exactly between the Sun and Earth.',
      facts: [
        { label: 'Previous', value: '8 June 2004' },
        { label: 'Next', value: '11 December 2117, then 8 December 2125' },
        { label: 'Pattern', value: 'pairs 8 years apart, more than a century between pairs' },
      ],
      body: [
        'Venus passes between us and the Sun every 19 months or so, but usually a little above or below it, because its orbit is tilted 3.4° to ours. Only when that passing falls in early June or early December, where the two orbits cross, does it cross the Sun’s face.',
        'In the 1700s astronomers travelled the world to time transits of Venus, and used them to measure the size of the solar system.',
      ],
    }),
  },
];

/** Every moment: the solar system's, its comets' and eclipses', then spaceflight's round the Earth (`spaceflight.ts`). */
export const PRESETS: readonly Preset[] = [...SOLAR_PRESETS, ...COMET_PRESETS, ...ECLIPSES, ...SPACEFLIGHT];

export const presetById = (id: string): Preset | undefined => PRESETS.find(p => p.id === id);

