/**
 * "Requiem", an etched montage: the 48-second addiction montage of Requiem for a Dream re-imagined as one continuous
 * etching, every shot an original plate cut hard on the film's own editing rhythm.
 */
import type { Sequence } from '../../core/scene';
import catalogJson from './catalog.json';
import { montage } from './montage';
import { STORYBOARD } from './storyboard';

export interface RequiemCatalog {
  title: string;
  line: string;
  style: string;
  ar: string;
  width: number;
  /** Seconds into the montage of the resting frame for the poster. */
  poster: number;
  /** Film time of the last frame's end. */
  end: number;
  /** The 91 hard cuts detected in the film, in seconds. */
  filmCuts: number[];
  /** Cuts the detector missed (split by eye from frame-difference peaks), in seconds. */
  addedCuts: number[];
  idea: string;
  rhythm: string;
  etching: string;
  alt: string;
}

export const REQUIEM_CATALOG: RequiemCatalog = catalogJson;

export const requiemSequence: Sequence = { ...montage('requiem', STORYBOARD, REQUIEM_CATALOG.end), poster: REQUIEM_CATALOG.poster };
