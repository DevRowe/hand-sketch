/**
 * Fact cards for the bodies the explorer draws. Figures are NASA's (NSSDCA planetary fact sheets, science.nasa.gov),
 * rounded for reading; "~" marks an approximation, and moon counts carry the date NASA gave them. Research notes and
 * sources: docs/explorer/SOURCES.md.
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
