/**
 * What the Scale sheet says and the figures it works from: the bodies' true sizes and distances (NASA's planetary fact
 * sheets: equatorial diameters and mean distances, rounded), the Sun's orbit round the galaxy, and the everyday things
 * a scale model compares them to. The sheet computes its model from these; nothing in it is hard-coded.
 */
import type { BodyId } from '../bodies';

export interface Body {
  id: BodyId;
  name: string;
  /** Diameter, km. */
  km: number;
  /** Mean distance from the Sun (the Moon: from the Earth), km. */
  from: number;
}

export const SUN_KM = 1_391_400;
export const AU_KM = 149_597_870.7;

export const BODIES: readonly Body[] = [
  { id: 'mercury', name: 'Mercury', km: 4_879, from: 57.9e6 },
  { id: 'venus', name: 'Venus', km: 12_104, from: 108.2e6 },
  { id: 'earth', name: 'Earth', km: 12_756, from: 149.6e6 },
  { id: 'moon', name: 'Moon', km: 3_475, from: 384_400 },
  { id: 'mars', name: 'Mars', km: 6_792, from: 227.9e6 },
  { id: 'jupiter', name: 'Jupiter', km: 142_984, from: 778.5e6 },
  { id: 'saturn', name: 'Saturn', km: 120_536, from: 1_432.0e6 },
  { id: 'uranus', name: 'Uranus', km: 51_118, from: 2_867.0e6 },
  { id: 'neptune', name: 'Neptune', km: 49_528, from: 4_515.0e6 },
  { id: 'pluto', name: 'Pluto', km: 2_376, from: 5_906.4e6 },
];

/** Saturn's main rings reach out to this many of its radii (the A ring's outer edge, 136,775 km). */
export const SATURN_RING = 136_775 / 60_268;

/** The model's Sun: a ball of this diameter, metres. */
export const BALL = { name: 'a basketball', m: 0.24 } as const;

/** Things about the size of a small body in the model, by the largest they stand for (mm). */
export const LIKE: readonly [mm: number, words: string][] = [
  [0.5, 'a grain of salt'],
  [1, 'a grain of sand'],
  [1.6, 'a pinhead'],
  [3, 'a mustard seed'],
  [12, 'a pea'],
  [22, 'a grape'],
  [40, 'a walnut'],
];

/** Voyager 1, one light-day (173.1 au) from the Sun on 18 November 2026, receding at ~3.57 au a year. */
export const VOYAGER_1 = { au: 173.1, iso: '2026-11-18', auPerYear: 3.57 } as const;
/** Proxima Centauri, the nearest star, light-years away; and a light-year, km. */
export const PROXIMA_LY = 4.2465;
export const LIGHT_YEAR_KM = 9.4607e12;
export const C_KM_S = 299_792.458;

/** The Sun's path round the Milky Way (Reid et al. 2019, GRAVITY 2022, NASA): the guide's figures. */
export const GALAXY = {
  speed: 230,
  /** Distance from the galaxy's centre, light-years, and the disc's radius. */
  fromCentre: 27_000,
  disc: 50_000,
  /** One lap, millions of years; the Sun's age, billions. */
  lapMyr: 230,
  ageGyr: 4.6,
  /** How far the Sun travels in a year, au (230 km/s for a year). */
  auPerYear: (230 * 365.25 * 86_400) / AU_KM,
} as const;

export const SCALE_TEXT = {
  intro: 'The drawings squeeze the solar system to fit a screen. Here is how big and how far everything really is.',
  sizes: 'All at one scale: the Sun’s edge on the left, the giants beside it, and the rocky worlds and Pluto below. Jupiter is 11 times as wide as the Earth; the Sun, 109 times.',
  ball: 'If the Sun were {ball} ({cm} cm across):',
  light: 'Sunlight would crawl along at ~{speed} a second, and take {minutes} minutes to reach the Earth.',
  beyond: 'Past Neptune a ring of icy leftovers, the Kuiper belt, reaches out to ~50 au; Pluto is one of its largest members. The plan squeezes them in just beyond Neptune’s orbit.',
  galaxyLede: 'The Sun is not standing still: it carries every planet round the Milky Way at ~{speed} km/s, ~{from} light-years from the centre. One lap, a galactic year, takes ~{lap} million years: it has been round ~{laps} times, and one lap ago the first dinosaurs were appearing.',
  galaxyMotion: 'That is the idea the In motion view draws: the Sun travelling and each orbit trailing behind it into a helix. The picture takes liberties to fit a screen.',
  galaxyHonest: [
    'Each year the Sun covers ~{auYear} au, so each of the Earth’s real coils is ~{auYear} au long but only 2 au across: the true helix is stretched almost straight.',
    'The Sun’s path crosses the planets’ plane at ~60°, not square to it as drawn, so the real coils lean.',
    '“Moving” depends on what against: against the stars around us the Sun drifts at only ~20 km/s; against the cosmic microwave background, ~370 km/s.',
  ],
  cheat: 'To fit on a screen, the From above plan draws the planets ~{planets} times too big for their orbits and the Sun ~{sun} times, and squeezes the outer orbits in: Neptune’s is drawn {drawn} times as wide as the Earth’s, when it is truly {truly} times as wide.',
  cheatScreen: 'At true scale, if Neptune’s orbit filled the height of this screen, the Sun would be {sun} of a pixel across and the Earth {earth} of a pixel.',
} as const;
