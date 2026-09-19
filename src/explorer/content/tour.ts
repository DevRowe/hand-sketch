/**
 * The guided tour's stops: a couple of minutes through the explorer's best moments, each with a short caption. A stop
 * sets the sky (a moment from the Moments menu, or a view on today) and either flies the moment's journey or lets the
 * sky run a while, then moves on. Figures are the moments' own (their cards cite the sources).
 */
import type { BodyId, ViewId } from '../bodies';
import { DAY, WEEK, YEAR } from '../sim';

export interface TourStop {
  id: string;
  title: string;
  text: string;
  /** A moment (a preset id) to set the sky to; otherwise `view` on today, at its home. */
  preset?: string;
  view?: ViewId;
  /** Fly the moment's journey before holding. */
  journey?: boolean;
  /** Days of sky a second for the journey, where the moment's own pace is too quick to follow without its controls. */
  journeyPace?: number;
  /** Days of sky a second while the stop holds (the sky runs; a journey sets its own). */
  pace?: number;
  /** A body to pick out and follow, and how close. */
  focus?: { body: BodyId; zoom: number };
  /** Seconds the stop stays after its journey (or from the start, without one); 0 for the last, which waits. */
  hold: number;
}

export const TOUR: readonly TourStop[] = [
  {
    id: 'today', title: 'The sky today', view: 'sky', pace: 2 * WEEK, hold: 10,
    text: 'Every planet is drawn where it really is today. Mercury laps the Sun in 88 days; Neptune takes 165 years.',
  },
  {
    id: 'motion', title: 'The Sun is on the move', view: 'wake', pace: 2 * WEEK, hold: 11,
    text: 'The Sun carries its planets round the Milky Way at ~230 km/s, so each orbit trails out behind it into a helix: Mercury a tight corkscrew, Neptune one long, lazy turn.',
  },
  {
    id: 'apollo', title: 'Apollo 11, 1969', preset: 'apollo-11-close', journey: true, hold: 3,
    text: 'Out to the Moon and back in eight days: the first people to walk on another world. Here the Earth and the Moon are at true scale.',
  },
  {
    id: 'voyager', title: 'Voyager’s Grand Tour', preset: 'voyager', journey: true, journeyPace: YEAR / 2, hold: 3,
    text: 'A line-up of the outer planets that comes round every ~175 years let Voyager 2 swing from Jupiter to Saturn, Uranus and Neptune in twelve years.',
  },
  {
    id: 'mars', title: 'Mars at its closest, 2003', preset: 'mars-2003', pace: DAY, hold: 9,
    text: 'Every ~26 months the Earth overtakes Mars. In August 2003 it passed just 55.8 million km away, the closest in nearly 60,000 years.',
  },
  {
    id: 'halley', title: 'Halley’s Comet comes back', preset: 'halley-2061', journey: true, hold: 3,
    text: 'Turned round beyond Neptune in 2023, it creeps for decades, then whips round the Sun on 28 July 2061. The dots are a year apart: Kepler’s second law, drawn.',
  },
  {
    id: 'beyond', title: 'Beyond Neptune', view: 'sky', pace: YEAR, focus: { body: 'pluto', zoom: 2.5 }, hold: 10,
    text: 'Pluto and the Kuiper belt, icy leftovers from the making of the planets. Pluto takes 248 years to go round once; New Horizons flew past in 2015.',
  },
  {
    id: 'yours', title: 'Over to you', view: 'sky', pace: 2 * WEEK, hold: 0,
    text: 'Tap any planet for its story. Moments holds dozens more like these, Sky shows what is up tonight, Scale how big and how far, and You flies your own years.',
  },
];
