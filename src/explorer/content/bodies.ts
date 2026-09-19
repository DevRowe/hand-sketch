/**
 * Fact cards for the bodies the explorer draws. Figures are NASA's (NSSDCA planetary fact sheets, science.nasa.gov),
 * rounded for reading; "~" marks an approximation, and moon counts carry the date NASA gave them. Sources:
 * SOURCES.md beside this file.
 */
import type { BodyId } from '../bodies';

export interface Fact {
  label: string;
  value: string;
}

export interface BodyCard {
  /** Eyebrow over the name. */
  kind: string;
  /** One sentence to open with. */
  intro: string;
  facts: readonly Fact[];
  /** A few genuinely surprising things. */
  fun: readonly string[];
  /** Something about its orbit, when there is something to say. */
  orbit?: string;
}

export const BODIES: Readonly<Record<BodyId | 'belt', BodyCard>> = {
  sun: {
    kind: 'Our star',
    intro: 'A middle-aged yellow dwarf, about 4.6 billion years old, holding everything else in its grip.',
    facts: [
      { label: 'Diameter', value: '1,391,400 km (109 × Earth)' },
      { label: 'Mass', value: '1.99 × 10³⁰ kg (333,000 × Earth)' },
      { label: 'Surface gravity', value: '274 m/s² (28 × Earth)' },
      { label: 'Surface', value: '~5,500 °C (5,772 K)' },
      { label: 'Core', value: '~15.7 million K' },
      { label: 'Spin', value: '~25 days at the equator, ~34 at the poles' },
      { label: 'Light to Earth', value: '8 min 19 s' },
    ],
    fun: [
      'It holds about 99.8% of all the mass in the solar system; some 1.3 million Earths would fit inside it.',
      'Every second it turns about 4.3 million tonnes of matter into energy.',
      'Its thin outer atmosphere, the corona, reaches up to ~2 million °C, far hotter than the surface below, and why is still not fully understood.',
    ],
  },
  mercury: {
    kind: 'Planet · 1st from the Sun',
    intro: 'The smallest planet and the fastest, scorched by day and frozen by night.',
    facts: [
      { label: 'Diameter', value: '4,879 km (0.38 × Earth)' },
      { label: 'Mass', value: '0.055 × Earth' },
      { label: 'Gravity', value: '3.7 m/s² (0.38 × Earth)' },
      { label: 'From the Sun', value: '0.39 au · 57.9 million km' },
      { label: 'Year', value: '88 Earth days' },
      { label: 'Day', value: 'spins in 58.6 days; noon to noon takes 176' },
      { label: 'Moons', value: 'none' },
      { label: 'Mean temperature', value: '167 °C' },
    ],
    orbit: 'The most stretched orbit of any planet (eccentricity 0.21): it swings between 46 and 70 million km from the Sun, and races along at 47 km/s on average, the fastest of all.',
    fun: [
      'One Mercury day, noon to noon, lasts about 176 Earth days: exactly two of its years.',
      'Days reach ~430 °C, but with almost no air to hold the heat, nights fall to ~-180 °C.',
      'Even so, there is water ice in craters at its poles that never see sunlight.',
    ],
  },
  venus: {
    kind: 'Planet · 2nd from the Sun',
    intro: "Earth's near twin in size, wrapped in a crushing, scalding carbon dioxide atmosphere.",
    facts: [
      { label: 'Diameter', value: '12,104 km (0.95 × Earth)' },
      { label: 'Mass', value: '0.82 × Earth' },
      { label: 'Gravity', value: '8.9 m/s² (0.91 × Earth)' },
      { label: 'From the Sun', value: '0.72 au · 108 million km' },
      { label: 'Year', value: '225 Earth days' },
      { label: 'Day', value: 'spins backwards in 243 days; sunrise to sunrise ~117' },
      { label: 'Moons', value: 'none' },
      { label: 'Mean temperature', value: '464 °C' },
    ],
    orbit: 'The roundest orbit of any planet (eccentricity 0.007). It comes closer to Earth than any other planet.',
    fun: [
      'Its day is longer than its year: one spin takes ~243 Earth days, one orbit ~225.',
      'It spins backwards, so the Sun rises in the west and sets in the east.',
      'The hottest planet, hot enough to melt lead, though Mercury is closer to the Sun: its thick air (92 times the pressure of ours) traps the heat.',
    ],
  },
  earth: {
    kind: 'Planet · 3rd from the Sun',
    intro: 'Home: the only world known to host life, and the only one with liquid water on its surface.',
    facts: [
      { label: 'Diameter', value: '12,756 km' },
      { label: 'Mass', value: '5.97 × 10²⁴ kg' },
      { label: 'Gravity', value: '9.8 m/s²' },
      { label: 'From the Sun', value: '1 au · 149.6 million km' },
      { label: 'Year', value: '365.26 days' },
      { label: 'Day', value: '24 h (one spin: 23 h 56 min)' },
      { label: 'Moons', value: '1' },
      { label: 'Mean temperature', value: '15 °C' },
    ],
    orbit: 'Earth is closest to the Sun in early January (147.1 million km) and farthest in early July (152.1 million km). The seasons come from its 23.4° tilt, not from that distance.',
    fun: [
      'Oceans cover about 71% of its surface.',
      'The densest planet: on average 5.5 times as dense as water.',
      'Days are slowly getting longer, by about 1.8 milliseconds a century, mainly because the Moon’s tides brake its spin.',
    ],
  },
  moon: {
    kind: "Earth's moon",
    intro: 'The only other world people have walked on, and the brightest thing in our night sky.',
    facts: [
      { label: 'Diameter', value: '3,475 km (0.27 × Earth)' },
      { label: 'Mass', value: '0.012 × Earth' },
      { label: 'Gravity', value: '1.62 m/s² (about 1/6 of Earth’s)' },
      { label: 'From Earth', value: '384,400 km on average' },
      { label: 'Orbit', value: '27.3 days; new Moon to new Moon 29.5' },
      { label: 'Day', value: 'one spin per orbit: the same face always turned to us' },
      { label: 'Mean temperature', value: '-20 °C (from ~-178 to +117 °C)' },
    ],
    fun: [
      'It drifts about 3.8 cm farther from Earth each year, measured by bouncing lasers off reflectors the Apollo astronauts left behind.',
      'No one saw its far side until the Soviet probe Luna 3 flew round it in 1959.',
      'Only 12 people have walked on it, all on Apollo missions between 1969 and 1972.',
    ],
  },
  mars: {
    kind: 'Planet · 4th from the Sun',
    intro: 'A cold red desert with the tallest volcano in the solar system and a canyon as long as the United States is wide.',
    facts: [
      { label: 'Diameter', value: '6,792 km (0.53 × Earth)' },
      { label: 'Mass', value: '0.11 × Earth' },
      { label: 'Gravity', value: '3.7 m/s² (0.38 × Earth)' },
      { label: 'From the Sun', value: '1.52 au · 228 million km' },
      { label: 'Year', value: '687 Earth days (1.88 years)' },
      { label: 'Day', value: '24 h 40 min (a "sol")' },
      { label: 'Moons', value: '2 (Phobos and Deimos)' },
      { label: 'Mean temperature', value: '-65 °C' },
    ],
    orbit: 'Earth overtakes Mars every ~26 months (780 days), when Mars shines at its brightest; launch windows open a few months before each pass. Its distance from us swings between ~55 and ~400 million km.',
    fun: [
      'Olympus Mons rises ~22 km above the plains around it, about two and a half times the height of Everest.',
      'The Valles Marineris canyons run ~4,000 km, as far as from California to New York.',
      'Martian sunsets glow blue: fine dust lets blue light through near the Sun.',
    ],
  },
  jupiter: {
    kind: 'Planet · 5th from the Sun',
    intro: 'The giant: a ball of hydrogen and helium with more mass than all the other planets put together.',
    facts: [
      { label: 'Diameter', value: '142,984 km (11.2 × Earth)' },
      { label: 'Mass', value: '318 × Earth' },
      { label: 'Gravity', value: '23.1 m/s² (2.4 × Earth)' },
      { label: 'From the Sun', value: '5.2 au · 778 million km' },
      { label: 'Year', value: '11.9 Earth years' },
      { label: 'Day', value: '9 h 56 min, the shortest of any planet' },
      { label: 'Moons', value: '115 known (NASA, August 2026)' },
      { label: 'Mean temperature', value: '-110 °C' },
    ],
    fun: [
      'It has about two and a half times the mass of all the other planets combined.',
      'The Great Red Spot, a storm watched without a break since 1831, is still a little wider than Earth, though it has shrunk by more than half since the 1800s.',
      'Its four big moons, found by Galileo in 1610, were the first ever seen circling another planet.',
    ],
  },
  saturn: {
    kind: 'Planet · 6th from the Sun',
    intro: 'The ringed planet, and the lightest for its size.',
    facts: [
      { label: 'Diameter', value: '120,536 km (9.4 × Earth)' },
      { label: 'Mass', value: '95 × Earth' },
      { label: 'Gravity', value: '9.0 m/s² (0.92 × Earth)' },
      { label: 'From the Sun', value: '9.6 au · 1.43 billion km' },
      { label: 'Year', value: '29.4 Earth years' },
      { label: 'Day', value: '10 h 39 min' },
      { label: 'Moons', value: '293 known, the most of any planet (NASA, August 2026)' },
      { label: 'Mean temperature', value: '-140 °C' },
    ],
    fun: [
      'The only planet less dense than water: on average 0.69 times as dense.',
      'Its rings reach up to 282,000 km from the planet, yet the main rings are typically only about 10 m thick.',
      'A six-sided jet stream ~30,000 km across circles its north pole.',
    ],
  },
  uranus: {
    kind: 'Planet · 7th from the Sun',
    intro: 'An ice giant knocked on its side, rolling round the Sun.',
    facts: [
      { label: 'Diameter', value: '51,118 km (4.0 × Earth)' },
      { label: 'Mass', value: '14.5 × Earth' },
      { label: 'Gravity', value: '8.7 m/s² (0.89 × Earth)' },
      { label: 'From the Sun', value: '19.2 au · 2.9 billion km' },
      { label: 'Year', value: '84 Earth years' },
      { label: 'Day', value: '17 h 14 min, spinning backwards' },
      { label: 'Moons', value: '29 known (NASA, August 2026)' },
      { label: 'Mean temperature', value: '-195 °C' },
    ],
    fun: [
      'Tilted 98°, it rolls round the Sun on its side: parts of each hemisphere go up to 42 years without sunlight.',
      'Its atmosphere gets as cold as -224 °C, colder in places than Neptune’s, although Neptune is farther out.',
      'The first planet found with a telescope: William Herschel spotted it on 13 March 1781 and at first took it for a comet.',
    ],
  },
  neptune: {
    kind: 'Planet · 8th from the Sun',
    intro: 'The farthest planet, a deep blue ice giant with the fiercest winds in the solar system.',
    facts: [
      { label: 'Diameter', value: '49,528 km (3.9 × Earth)' },
      { label: 'Mass', value: '17 × Earth' },
      { label: 'Gravity', value: '11.0 m/s² (1.12 × Earth)' },
      { label: 'From the Sun', value: '~30 au · 4.5 billion km' },
      { label: 'Year', value: '165 Earth years' },
      { label: 'Day', value: '16 h 7 min' },
      { label: 'Moons', value: '16 known' },
      { label: 'Mean temperature', value: '-200 °C' },
    ],
    fun: [
      'Found by mathematics: Urbain Le Verrier worked out where it must be from tugs on Uranus’s orbit, and Johann Galle and Heinrich d’Arrest found it within 1° of that spot on 23 September 1846, their first night of searching.',
      'The windiest planet: winds top 2,000 km/h.',
      'A year there lasts ~165 Earth years, so it completed its first orbit since its discovery only in 2011.',
    ],
  },
  /* ---------- beyond Neptune: the From above plan ---------- */

  pluto: {
    kind: 'Dwarf planet · in the Kuiper belt',
    intro: 'A small, icy world beyond Neptune, with a heart-shaped glacier and a moon half its size: the ninth planet until 2006.',
    facts: [
      { label: 'Diameter', value: '2,376 km (0.19 × Earth, two thirds of the Moon)' },
      { label: 'Mass', value: '0.002 × Earth' },
      { label: 'Gravity', value: '0.62 m/s² (0.06 × Earth)' },
      { label: 'From the Sun', value: '29.7 to 49.3 au · ~5.9 billion km on average' },
      { label: 'Year', value: '248 Earth years' },
      { label: 'Day', value: '6.4 Earth days, spinning backwards' },
      { label: 'Moons', value: '5: Charon, Nix, Hydra, Kerberos, Styx' },
      { label: 'Mean temperature', value: '-225 °C' },
    ],
    fun: [
      'Found by Clyde Tombaugh on 18 February 1930 at Lowell Observatory, by flicking between photographs of the same patch of sky taken days apart.',
      'In 2006 the International Astronomical Union made it the first “dwarf planet”: round, and circling the Sun, but not massive enough to have cleared its orbit of other bodies.',
      'New Horizons flew past on 14 July 2015 and found a heart-shaped plain of nitrogen ice, Sputnik Planitia, ringed by mountains of water ice.',
      'Charon is half Pluto’s width: the two circle a point in space between them, always showing each other the same face.',
    ],
    orbit: 'Tilted 17° to the planets’ plane and stretched (eccentricity 0.25): from 7 February 1979 to 11 February 1999 it was closer to the Sun than Neptune. The two never meet: Pluto goes round twice for every three laps of Neptune, and never comes nearer to it than ~17 au.',
  },
  kuiper: {
    kind: 'Beyond Neptune',
    intro: 'A vast ring of icy leftovers from the making of the planets, from Neptune’s orbit out to ~50 au: Pluto is one of its largest members.',
    facts: [
      { label: 'Where', value: '~30 to 50 au from the Sun' },
      { label: 'Wider than 100 km', value: 'hundreds of thousands' },
      { label: 'First found', value: '1992 QB1 (Albion), 30 August 1992, by David Jewitt and Jane Luu' },
      { label: 'Named for', value: 'Gerard Kuiper, who wrote about such a belt in 1951' },
    ],
    fun: [
      'Many of the comets that come back every few years (the Jupiter-family comets) fell in from the Kuiper belt and the scattered disc beyond it.',
      'On 1 January 2019 New Horizons flew past Arrokoth, a small, double-lobed world ~6.6 billion km from the Sun: the most distant object ever visited.',
      'Its other dwarf planets include Haumea, which spins so fast it is stretched into an egg, and Makemake; Eris, almost Pluto’s size but more massive, loops farther out.',
      'The dots here are a picture of the belt, not a catalogue: a few hundred bodies at fixed, made-up places, each circling at the pace its distance gives it.',
    ],
  },

  /* ---------- round the Earth: the Earth and Moon view ---------- */

  iss: {
    kind: 'Space station · crewed since 2000',
    intro: 'The largest thing people have built in space: a football-field-sized laboratory, crewed without a break since Expedition 1 moved in on 2 November 2000.',
    facts: [
      { label: 'Height', value: '~413 to 422 km' },
      { label: 'Speed', value: '~7.66 km/s (~27,600 km/h)' },
      { label: 'One lap', value: '~93 minutes: ~15.5 a day' },
      { label: 'Tilt to the equator', value: '51.6°' },
      { label: 'Mass', value: '~420,000 kg' },
      { label: 'First module', value: 'Zarya, 20 November 1998' },
      { label: 'Visitors', value: '290 people from 26 countries (August 2025)' },
    ],
    orbit: 'Its orbit is tilted 51.6° to the equator, so it passes over everywhere from 51.6° north to 51.6° south. The thin air up there still drags on it, and it is boosted every few weeks to keep its height.',
    fun: [
      'Its crew sees about 16 sunrises and 16 sunsets every day.',
      'The Moon is some 900 times farther away than the station: on this page, all of low Earth orbit is the thin halo round the Earth.',
      'It is to fly through 2030; a SpaceX-built US Deorbit Vehicle is then to steer it down into the remote South Pacific around 2031 (NASA plan, 2026).',
    ],
  },
  tiangong: {
    kind: 'Space station · China · since 2021',
    intro: 'China’s own station: the Tianhe core went up on 29 April 2021, and with the Wentian and Mengtian labs it was complete, in a T, by November 2022.',
    facts: [
      { label: 'Height', value: '~386 to 392 km' },
      { label: 'Tilt to the equator', value: '41.5°' },
      { label: 'Mass', value: '~100 tonnes' },
      { label: 'Crew', value: 'usually 3, brought up by Shenzhou' },
      { label: 'Design life', value: 'raised to 15 years or more' },
    ],
    fun: [
      'China’s first astronaut, Yang Liwei, flew Shenzhou 5 on 15 October 2003: 14 orbits in about 21 hours.',
      'The Shenzhou 23 crew, up since May 2026, includes Lai Ka-ying, the first astronaut from Hong Kong, and one of the three is to try China’s first year-long stay.',
    ],
  },
  hubble: {
    kind: 'Space telescope · since 1990',
    intro: 'Set loose from the shuttle Discovery on 25 April 1990, and serviced by astronauts five times between 1993 and 2009: the only telescope built to be repaired in orbit.',
    facts: [
      { label: 'Height', value: '~614 km in 1990, ~470 km in 2026' },
      { label: 'Tilt to the equator', value: '28.5°' },
      { label: 'One lap', value: '~95 minutes' },
      { label: 'Mirror', value: '2.4 m across' },
    ],
    fun: [
      'It is slowly falling: with the Sun at its most active the upper air swells and drags harder, and estimates for its re-entry run from 2028 to the 2030s.',
      'Its first images were blurred by a mirror ground a fraction of a hair’s width out of shape; the first servicing crew fitted corrective optics in December 1993.',
    ],
  },
  mir: {
    kind: 'Space station · 1986-2001',
    intro: 'The Soviet, then Russian, station built up module by module from 1986: the first long-lived home in orbit, and where US astronauts first lived with Russian crews.',
    facts: [
      { label: 'Core launched', value: '19 February 1986' },
      { label: 'Height', value: '~354 to 374 km' },
      { label: 'Tilt to the equator', value: '51.6°' },
      { label: 'Brought down', value: '23 March 2001, into the South Pacific' },
    ],
    fun: [
      'Valeri Polyakov stayed aboard for 437 days in 1994-95, still the longest single spaceflight.',
      'The space shuttle docked with it nine times between 1995 and 1998, a rehearsal for building the ISS together.',
    ],
  },
  skylab: {
    kind: 'Space station · 1973-1979',
    intro: 'America’s first space station, launched on the last Saturn V to fly and lived in by three crews in 1973-74, some 171 days in all.',
    facts: [
      { label: 'Launched', value: '14 May 1973' },
      { label: 'Height', value: '~434 to 442 km' },
      { label: 'Tilt to the equator', value: '50°' },
      { label: 'Fell', value: '11 July 1979' },
    ],
    fun: [
      'It lost a solar wing and its sunshield on the way up; the first crew rigged a parasol and freed the jammed wing on a spacewalk.',
      'It came down over the Indian Ocean and Western Australia; the shire of Esperance fined NASA A$400 for littering.',
    ],
  },
  salyut: {
    kind: 'The first space station · 1971',
    intro: 'Salyut 1 went up on 19 April 1971. The Soyuz 11 crew, Georgy Dobrovolsky, Vladislav Volkov and Viktor Patsayev, lived aboard for 23 days and died when their capsule lost its air on the way home.',
    facts: [
      { label: 'Launched', value: '19 April 1971' },
      { label: 'Height', value: '~200 to 222 km' },
      { label: 'Tilt to the equator', value: '51.6°' },
      { label: 'Re-entered', value: '11 October 1971' },
    ],
    fun: ['Every crewed station since, from Skylab and Mir to the ISS and Tiangong, has flown in low Earth orbit, within ~450 km of the ground.'],
  },
  sputnik: {
    kind: 'The first satellite · 1957',
    intro: 'A polished 58 cm ball with four whip aerials, launched by the Soviet Union on 4 October 1957: its beeping, picked up by radio amateurs round the world, opened the space age.',
    facts: [
      { label: 'Launched', value: '4 October 1957, 19:28 UTC' },
      { label: 'Orbit', value: '~215 × 939 km, 65° tilt' },
      { label: 'One lap', value: '96.2 minutes' },
      { label: 'Mass', value: '83.6 kg' },
      { label: 'Fell', value: '4 January 1958' },
    ],
    fun: ['Its batteries ran out on 26 October 1957; it circled silently for ten more weeks before burning up.'],
  },
  leo: {
    kind: 'Low Earth orbit · ~160 to 2,000 km',
    intro: 'Where every space station and most satellites fly. On this page it is the thin halo round the Earth: zoom in to see it open up.',
    facts: [
      { label: 'Speed', value: '~7.8 km/s at its low edge' },
      { label: 'One lap', value: '~88 minutes at 160 km, ~2 hours at 2,000 km' },
      { label: 'Where space begins', value: '100 km, the Kármán line (FAI)' },
    ],
    orbit: 'Low enough that the thin upper air still drags: without a push now and then, anything here spirals down, within weeks at 200 km and centuries at 1,000 km.',
    fun: [
      'Every crewed flight but Apollo’s, and Artemis’s, has stayed in low orbit.',
      'The US counts space from 50 miles (~80 km); the FAI’s Kármán line is 100 km.',
      'Gemini 11 reached 1,369 km in 1966, a height no crew beat until Polaris Dawn in 2024.',
    ],
  },
  gps: {
    kind: 'Medium Earth orbit · ~20,200 km',
    intro: 'The GPS constellation: satellites in six tilted rings of orbits, arranged so that at least four are above the horizon anywhere on Earth.',
    facts: [
      { label: 'Height', value: '~20,200 km' },
      { label: 'One lap', value: '11 h 58 min: twice a sidereal day' },
      { label: 'Tilt to the equator', value: '55°' },
      { label: 'Working satellites', value: '31 (24 slots, plus spares)' },
      { label: 'Full service', value: '1995' },
    ],
    fun: ['Your phone times the signals from four or more of them; light covers 30 cm in a nanosecond, so the clocks aboard are atomic.', 'Europe’s Galileo, Russia’s GLONASS and China’s BeiDou fly similar orbits.'],
  },
  geo: {
    kind: 'Geostationary orbit · 35,786 km',
    intro: 'The one height where a lap takes exactly as long as the Earth takes to turn (23 h 56 min), so a satellite over the equator seems to hang still in the sky.',
    facts: [
      { label: 'Height', value: '35,786 km (42,164 km from Earth’s centre)' },
      { label: 'Speed', value: '~3.07 km/s' },
      { label: 'Working satellites', value: '~580 (2026)' },
      { label: 'First', value: 'Syncom 3, 19 August 1964' },
    ],
    orbit: 'Drawn here as the ellipse in the equator’s plane: the equator is tipped 23.4° to the page, which looks down on the Earth’s orbit round the Sun.',
    fun: ['Syncom 3 carried the 1964 Tokyo Olympics live to the United States; Early Bird (Intelsat I, 1965) was the first commercial one.', 'Arthur C. Clarke described the idea in 1945, so the belt is often called the Clarke orbit.'],
  },
  starlink: {
    kind: 'Megaconstellation · since 2019',
    intro: 'SpaceX’s internet satellites: the first 60 went up on 24 May 2019, and about two of every three working satellites in orbit are now Starlinks.',
    facts: [
      { label: 'In orbit', value: '11,127 (17 September 2026)' },
      { label: 'Height', value: 'mostly ~450 to 490 km' },
      { label: 'All working satellites', value: '16,810, 66% of them Starlinks' },
      { label: 'Drawn here', value: 'one dot for ~20 satellites' },
    ],
    fun: ['In 2019 about 2,300 satellites were working in all; in 2026 there are more than seven times as many.'],
  },
  halley: {
    kind: 'Comet · 1P/Halley',
    intro: 'The most famous comet of all: a dark, icy lump ~15 km long that swings in from beyond Neptune every ~76 years and grows a glowing head and tails as the Sun warms it.',
    facts: [
      { label: 'Nucleus', value: '~15 × 8 km' },
      { label: 'One lap', value: '~76 years (74 to 79 over its recorded returns)' },
      { label: 'Closest to the Sun', value: '0.59 au, inside Venus’s orbit' },
      { label: 'Farthest', value: '~35 au, beyond Neptune' },
      { label: 'Last round the Sun', value: '9 February 1986' },
      { label: 'Next', value: '28 July 2061' },
    ],
    orbit: 'A long, thin ellipse (eccentricity 0.97), tilted 162° to the planets’ plane: it goes round the Sun the opposite way to them. Near the Sun it races at ~55 km/s; at the far end it crawls at under 1 km/s, which is why it spends most of its lap out beyond the planets. Its timings here follow the real returns.',
    fun: [
      'Edmond Halley worked out in 1705 that the comets of 1531, 1607 and 1682 were one and the same, and predicted its return in 1758; it came back, rounding the Sun in March 1759, after his death.',
      'Mark Twain was born two weeks after its perihelion in 1835 and died the day after its next, in April 1910, just as he had predicted.',
      'The Earth passed through its tail in May 1910.',
      'It is the source of the Eta Aquariid (May) and Orionid (October) meteor showers.',
    ],
  },
  atlas: {
    kind: 'Interstellar comet · C/2025 N1',
    intro: 'Only the third object ever seen passing through the solar system from another star: a comet found on 1 July 2025, moving far too fast for the Sun to hold.',
    facts: [
      { label: 'Found', value: '1 July 2025, by the ATLAS survey in Chile' },
      { label: 'Closest to the Sun', value: '1.36 au, 29 October 2025' },
      { label: 'Speed', value: '~58 km/s far from the Sun' },
      { label: 'Nucleus', value: '~0.3 to 5.6 km across (Hubble, 2025)' },
      { label: 'Before it', value: '1I/ʻOumuamua (2017), 2I/Borisov (2019)' },
    ],
    orbit: 'Not an orbit at all: an open curve, a hyperbola with eccentricity ~6.1, which the Sun only bends. It came in from the direction of Sagittarius and is leaving for good, within 5° of the planets’ plane but going round the other way.',
    fun: [
      'The “3I” means the third interstellar object; ATLAS is the survey that found it, the Asteroid Terrestrial-impact Last Alert System.',
      'Its speed alone gives it away: at its closest to the Sun it was moving at ~68 km/s, nearly twice the ~36 km/s the Sun could hold on to there.',
      'Spacecraft at Mars photographed it as it passed in October 2025, ~29 million km from the planet.',
    ],
  },
  belt: {
    kind: 'Between Mars and Jupiter',
    intro: 'Leftovers from the making of the planets, strewn between Mars and Jupiter and never gathered into a planet of their own, stirred up as they are by Jupiter’s pull.',
    facts: [
      { label: 'Where', value: '~2.1 to 3.2 au from the Sun' },
      { label: 'Wider than 1 km', value: '1.1 to 1.9 million asteroids' },
      { label: 'Catalogued so far', value: '~1.44 million (September 2026)' },
      { label: 'All together', value: '~3% of the Moon’s mass' },
    ],
    fun: [
      'The dwarf planet Ceres alone holds between a quarter and a third of all that mass.',
      'It is mostly empty space: asteroids a kilometre or more across are typically hundreds of thousands of kilometres apart, so spacecraft pass straight through.',
      'Here each rock circles at the pace Kepler’s third law gives its distance, so the belt slowly shears as you watch.',
    ],
  },
};
