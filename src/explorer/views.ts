/**
 * The explorer's three views and what each needs of the controls: the two solar plans (in motion, from above) share
 * their pace; the Earth and Moon view runs on its own clock (from real time to a month a second: the space station
 * laps the Earth in 93 minutes, the Moon in 27 days), zooms a hundred times deeper, and keeps its own trails.
 */
import type { ViewId } from './bodies';
import { DAY, HOUR, MINUTE, MONTH, SECOND, WEEK, YEAR } from './sim';

export interface Range {
  min: number;
  max: number;
}

export interface ViewSpec {
  id: ViewId;
  /** Views of one family share a pace. */
  family: 'solar' | 'earth';
  /** Days of sky per second: the slider's range, the pace to start at, and the presets offered. */
  pace: Range & { start: number; chips: readonly (readonly [number, string])[] };
  /** Trail length, days: the slider's range and the length to start at. */
  span: Range & { start: number };
  /** Widest and deepest zoom: the plans never below 1, so their page always covers the screen. */
  zoomMin: number;
  zoomMax: number;
  /** Home always fits `home` into the room the controls leave (the plans fill a wide screen with the page instead). */
  fitHome?: boolean;
  /** What home must show, design units [x0, y0, x1, y1]. */
  home: readonly [number, number, number, number];
  /** Period (days) of the quickest motion on show: it sets how often the sky is drawn. */
  quickest: number;
}

const SOLAR_PACE = {
  min: HOUR, max: 25 * YEAR, start: 2 * WEEK,
  chips: [[DAY, '1 day/s'], [WEEK, '1 week/s'], [2 * WEEK, '2 weeks/s'], [MONTH, '1 month/s'], [YEAR, '1 year/s'], [10 * YEAR, '10 years/s']],
} as const;
const SOLAR_SPAN = { min: WEEK, max: 200 * YEAR } as const;
/** Mercury's sidereal period, days: the fastest planet sets the plans' cadence. */
const MERCURY_DAYS = 87.97;

export const VIEWS: Readonly<Record<ViewId, ViewSpec>> = {
  // in motion: the tilted orbits round the Sun (right of centre), a little of the wake behind and room for names; a
  // wake of twelve years (one lap of Jupiter) is long enough for the coils to read as a spiral
  wake: { id: 'wake', family: 'solar', pace: SOLAR_PACE, span: { ...SOLAR_SPAN, start: 12 * YEAR }, zoomMin: 1, zoomMax: 16, home: [440, 330, 960, 880], quickest: MERCURY_DAYS },
  // from above: the plan out to Neptune; short sweeps behind the planets
  sky: { id: 'sky', family: 'solar', pace: SOLAR_PACE, span: { ...SOLAR_SPAN, start: YEAR / 8 }, zoomMin: 1, zoomMax: 16, home: [38, 38, 1042, 1042], quickest: MERCURY_DAYS },
  // the Earth and Moon: out to the Moon's farthest (406,700 km); the Earth's spin sets the cadence
  earth: {
    id: 'earth', family: 'earth',
    pace: {
      min: SECOND, max: MONTH, start: 6 * HOUR,
      chips: [[SECOND, 'Real time'], [MINUTE, '1 min/s'], [10 * MINUTE, '10 min/s'], [HOUR, '1 hour/s'], [6 * HOUR, '6 hours/s'], [DAY, '1 day/s']],
    },
    span: { min: HOUR, max: YEAR, start: 2 * WEEK },
    zoomMin: 0.5,
    zoomMax: 120,
    fitHome: true,
    home: [72, 72, 1008, 1008],
    quickest: 0.99727,
  },
};
