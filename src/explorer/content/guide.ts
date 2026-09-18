/**
 * The guide: short, sourced sections on orbits, moons, satellites, spaceflight, the far reaches and scale, plus an
 * honest word on the drawings themselves. Figures as of September 2026 (sources: SOURCES.md beside this file).
 */

export interface Item {
  /** A bold lead-in. */
  title: string;
  text: string;
}

export interface Section {
  id: string;
  title: string;
  intro?: string;
  items: readonly Item[];
}

export const GUIDE: readonly Section[] = [
  {
    id: 'orbits',
    title: 'Orbits',
    intro: 'Watch the planets for a while and you can see Johannes Kepler’s three laws at work.',
    items: [
      { title: 'Inner planets are faster', text: 'The closer a planet is to the Sun, the faster it moves and the shorter its year: Mercury averages 47.4 km/s and laps the Sun in 88 days; Earth 29.8 km/s and a year; Neptune 5.4 km/s and ~165 years. Kepler’s third law ties them together: the square of the year grows as the cube of the distance (Jupiter, 5.2 times Earth’s distance, takes 11.9 years).' },
      { title: 'Orbits are ellipses', text: 'Most are nearly circles. Earth is 147.1 million km from the Sun in early January and 152.1 million km in early July; the seasons come from Earth’s 23.4° tilt, not that small difference. Mercury’s orbit is the most stretched: 46 to 70 million km.' },
      { title: 'Faster when closer', text: 'A planet sweeps out equal areas in equal times, so it speeds up near the Sun: Mercury runs at 59 km/s at its closest and 39 km/s at its farthest. Slow the pace down and you can see it here, because each planet is placed at its real position for the date.' },
      { title: 'Why nothing falls in', text: 'Every planet is falling towards the Sun all the time, but moving sideways so fast that it keeps missing. That sideways speed is what launch windows, gravity assists and the rest of spaceflight are about.' },
    ],
  },
  {
    id: 'moons',
    title: 'Moons',
    intro: 'The planets have hundreds of moons between them: NASA counted 115 at Jupiter, 293 at Saturn, 29 at Uranus and 16 at Neptune by August 2026, most of them small captured rocks. A few are worlds in their own right.',
    items: [
      { title: 'Ganymede (Jupiter)', text: 'The largest moon in the solar system, 5,262 km across, wider than the planet Mercury (though under half its mass), and the only moon with a magnetic field of its own. A salty ocean may lie under its ice.' },
      { title: 'Io (Jupiter)', text: 'The most volcanic world known, with around 400 volcanoes, heated by the squeeze of Jupiter’s tides and the tug of its neighbours.' },
      { title: 'Europa (Jupiter)', text: 'An ice shell over a global salty ocean that may hold about twice the water of Earth’s oceans. Europa Clipper arrives in 2030 to study it.' },
      { title: 'Titan (Saturn)', text: 'Bigger than Mercury and the only moon with a thick atmosphere, mostly nitrogen, about 1.5 times Earth’s surface pressure at -180 °C. It has rivers, lakes and seas of liquid methane and ethane; the Huygens probe landed there in 2005, and NASA’s Dragonfly rotorcraft is due in 2034.' },
      { title: 'Enceladus (Saturn)', text: 'Only 504 km across, yet it sprays jets of water ice from cracks at its south pole, fed by an ocean under the ice. It is the most reflective body in the solar system.' },
      { title: 'Triton (Neptune)', text: 'The only big moon that orbits backwards, against its planet’s spin, so it was probably a Kuiper belt world captured long ago. Voyager 2 saw geysers on it in 1989.' },
      { title: 'Phobos and Deimos (Mars)', text: 'Two little moons found by Asaph Hall in 1877. Phobos circles Mars three times a day and is spiralling inward by ~1.8 m a century: in some 50 million years it will crash or break into a ring.' },
      { title: 'Charon (Pluto)', text: 'Half Pluto’s width, so big that the two circle a point in the space between them, each keeping the same face to the other.' },
    ],
  },
  {
    id: 'satellites',
    title: 'Satellites',
    intro: 'Around Earth, about 16,800 working satellites (September 2026), stacked by what they need to see or reach.',
    items: [
      { title: 'International Space Station', text: 'About 420 km up, it goes round every ~93 minutes, 15 to 16 times a day, at ~27,600 km/h. People have lived aboard without a break since 2 November 2000. The partners plan to fly it to 2030, and a SpaceX-built vehicle is to steer it down in 2031.' },
      { title: 'Hubble Space Telescope', text: 'Launched in 1990, repaired and upgraded by five shuttle crews (the first fixed its flawed mirror in 1993). Air drag has lowered it to ~470 km, about 140 km below where it began.' },
      { title: 'Starlink', text: 'SpaceX’s internet constellation: over 11,000 satellites in orbit, about two-thirds of all active ones, most at ~450-490 km so worn-out ones fall and burn up within a few years.' },
      { title: 'GPS', text: '31 working satellites at ~20,200 km, each lapping Earth twice a day. A receiver needs four to fix its place and time. Their clocks run fast by ~38 microseconds a day, relativity at work, and are tuned to allow for it; uncorrected, positions would drift ~10 km a day.' },
      { title: 'Geostationary orbit', text: 'At 35,786 km above the equator an orbit takes one day, so a satellite there hangs over one spot: dishes point at it without moving. Weather and TV satellites live there. Arthur C. Clarke proposed it for communications in 1945.' },
      { title: 'Sputnik 1', text: 'The first artificial satellite, a 58 cm, 83.6 kg sphere, launched on 4 October 1957; it beeped for three weeks and burned up in January 1958.' },
      { title: 'Far out: Webb', text: 'The James Webb Space Telescope circles the Sun-Earth L2 point, 1.5 million km away on the night side, four times as far as the Moon.' },
    ],
  },
  {
    id: 'spaceflight',
    title: 'People and probes',
    items: [
      { title: 'First in space', text: 'Yuri Gagarin, 12 April 1961: one orbit in 108 minutes. Valentina Tereshkova, the first woman, 16 June 1963: 48 orbits. Alexei Leonov made the first spacewalk on 18 March 1965, and had to let air out of his swollen suit to get back in.' },
      { title: 'The Moon', text: 'Apollo 8 first carried people round the Moon at Christmas 1968. Twelve astronauts walked on it on six Apollo landings from July 1969 to December 1972. In April 2026 Artemis II flew four people round the far side and 406,771 km from Earth, the farthest humans have ever been.' },
      { title: 'Voyagers', text: 'Launched in 1977, both are now in interstellar space. Voyager 1 is ~172 au from the Sun; on 18 November 2026 it becomes the first spacecraft a whole light-day from Earth. In 1990 it turned round to photograph Earth from 6 billion km: the Pale Blue Dot.' },
      { title: 'Mars rovers', text: 'Sojourner (1997) planned a week and lasted 83 days; Opportunity planned 90 days and drove 45 km over nearly 15 years. Curiosity has been climbing Mount Sharp since 2012, and Perseverance, landed in 2021, is sealing rock samples. Its helicopter Ingenuity flew 72 times.' },
      { title: 'Fastest', text: 'New Horizons left Earth faster than anything before, 16.26 km/s. Parker Solar Probe is the fastest object ever built: in December 2024 it passed 6.1 million km from the Sun’s surface at ~692,000 km/h, and it keeps repeating the feat every 88 days.' },
      { title: 'Gravity assists', text: 'Swinging close past a planet, a spacecraft leaves with the same speed relative to the planet but in a new direction, so relative to the Sun it can gain or lose a great deal. Jupiter gave New Horizons nearly 4 km/s; Cassini borrowed from Venus, Earth and Jupiter to reach Saturn.' },
    ],
  },
  {
    id: 'beyond',
    title: 'Beyond the planets',
    items: [
      { title: 'The asteroid belt', text: 'Between ~2.1 and 3.2 au, with 1.1 to 1.9 million asteroids wider than 1 km, yet all of it together weighs only ~3% of our Moon, and the dwarf planet Ceres holds a quarter to a third of that. It is mostly empty: big asteroids are typically hundreds of thousands of km apart, so spacecraft cross it untouched.' },
      { title: 'Pluto and the dwarf planets', text: 'Pluto, found in 1930, was reclassified as a dwarf planet in 2006. The IAU recognises five: Ceres, Pluto, Eris, Haumea and Makemake. Pluto takes 248 years to go round; it has not completed a lap since its discovery.' },
      { title: 'The Kuiper belt', text: 'A disc of icy bodies beyond Neptune, from ~30 to ~50 au, home to Pluto and Arrokoth, the small double-lobed world New Horizons flew past on 1 January 2019.' },
      { title: 'The Oort cloud', text: 'A vast, unseen shell of comets from a few thousand to perhaps 100,000 au out. Voyager 1 will not reach it for ~300 years, and will take ~30,000 more to cross it.' },
      { title: 'Comets', text: 'Icy leftovers that grow tails when they near the Sun. Halley’s comet last rounded the Sun on 9 February 1986 and returns on 28 July 2061; it comes back every ~76 years.' },
    ],
  },
  {
    id: 'scale',
    title: 'Light and scale',
    intro: 'Nothing here is drawn to scale, and that is the only way it fits on a screen.',
    items: [
      { title: 'Light takes time', text: 'Sunlight takes 8 min 19 s to reach Earth, 3 min 13 s to Mercury, 43 min to Jupiter and 4 h 10 min to Neptune. A radio message to Mars takes 3 to 22 minutes each way, so rovers there must drive themselves.' },
      { title: 'If the Sun were a 1 m ball', text: 'Earth would be a 9 mm pea 108 m away, Jupiter a 10 cm ball at 560 m, and Neptune a 3.6 cm marble 3.2 km off.' },
      { title: 'Room between Earth and the Moon', text: 'About 30 Earths would fit side by side in the 384,400 km to the Moon.' },
      { title: 'How the drawing cheats', text: 'The orbits here are spaced for the eye, not by distance (Neptune is 78 times as far out as Mercury), drawn as circles, and the planets are drawn huge. What is real is where each planet sits on its orbit, and the Moon round Earth, for the date shown, from JPL’s orbital elements.' },
    ],
  },
  {
    id: 'wake',
    title: 'The wake view',
    intro: '"In motion" is a picture of an idea, not a model.',
    items: [
      { title: 'The Sun is moving', text: 'The Sun carries the whole solar system round the Milky Way at roughly 230-250 km/s, about 27,000 light-years from its centre; one lap, a galactic year, takes some 230 million years. In one Earth year it covers ~50 au, fifty times the Earth’s distance from the Sun.' },
      { title: 'So every orbit is a spiral', text: 'Seen from a still point in the galaxy each planet traces a corkscrew round the Sun’s path. Each of Earth’s real coils is ~50 au long but only 2 au across, and the solar system is tilted ~60° to the galaxy’s disc; here the pitch, the tilt and the Sun’s pace are chosen to fit the screen. The trail length control sets how much history the wakes show.' },
      { title: 'Not a vortex', text: 'Some popular "vortex" animations show the planets trailing behind the Sun like a comet’s tail. They do not: they keep circling it, sometimes ahead of it and sometimes behind, as the helices here do.' },
    ],
  },
];

export interface Source {
  label: string;
  href: string;
}

export const SOURCES: readonly Source[] = [
  { label: 'NASA planetary fact sheets (NSSDCA)', href: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/' },
  { label: 'JPL: Approximate positions of the planets', href: 'https://ssd.jpl.nasa.gov/planets/approx_pos.html' },
  { label: 'JPL Horizons', href: 'https://ssd.jpl.nasa.gov/horizons/' },
  { label: 'NASA Science: planets, moons and missions', href: 'https://science.nasa.gov/solar-system/' },
  { label: 'NASA Mars trajectory handbook (TM-2010-216764)', href: 'https://ntrs.nasa.gov/citations/20100037210' },
  { label: 'ESA Space Science', href: 'https://www.esa.int/Science_Exploration/Space_Science' },
  { label: 'Jonathan McDowell’s satellite statistics', href: 'https://planet4589.org/space/stats/active.html' },
  { label: 'Reid et al. 2019: the Milky Way’s rotation (the Sun’s galactic speed)', href: 'https://arxiv.org/abs/1910.03357' },
  { label: 'Planck 2018 results I: our motion against the cosmic microwave background', href: 'https://arxiv.org/abs/1807.06205' },
];
