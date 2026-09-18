/**
 * Cutting the montage: a list of shots at film timecodes becomes a Sequence of hard cuts on the 12 fps drawn grid.
 *
 * Every cut is snapped from its film time to the nearest drawn frame (never from the previous shot's rounded length),
 * so rounding never accumulates: each cut lands within half a drawn frame of the film's, and the whole montage ends on
 * the film's last frame. A cut that snaps onto the same frame as the next one (a one-frame flash in the 25 fps film)
 * is dropped, since it cannot be seen.
 */
import type { Scene, Sequence } from '../../core/scene';
import { nf } from '../kit';
import { print, type Box, type Clock, type Panel, type Shot } from './etch';

/** Drawn frames per second the cuts are snapped to (the engine's default, on twos). */
export const CUT_FPS = 12;

/** What is on screen after a cut: one plate, or a split screen of two. */
export type Frame = Shot | { split: 'side' | 'stack'; a: Shot; b: Shot };

export interface Cut {
  /** Film time of the cut, in seconds. */
  at: number;
  /** Short label for the scene name and the shot list. */
  label: string;
  frame: Frame;
}

export const snap = (seconds: number): number => Math.round(seconds * CUT_FPS);

function panels(frame: Frame, w: number, h: number, clock: Clock): Panel[] {
  if (!('split' in frame)) return [{ box: [0, 0, w, h], shot: frame, clock }];
  const boxes: [Box, Box] = frame.split === 'side' ? [[0, 0, w / 2, h], [w / 2, 0, w / 2, h]] : [[0, 0, w, h / 2], [0, h / 2, w, h / 2]];
  return [{ box: boxes[0], shot: frame.a, clock }, { box: boxes[1], shot: frame.b, clock }];
}

/** The montage as a sequence of hard cuts; `end` is the film time of the last frame's end. */
export function montage(name: string, cuts: readonly Cut[], end: number): Sequence {
  const total = snap(end), entries: { scene: Scene }[] = [];
  cuts.forEach((c, k) => {
    const start = snap(c.at), stop = k + 1 < cuts.length ? snap(cuts[k + 1]!.at) : total, frames = stop - start;
    if (frames <= 0) return;
    entries.push({
      scene: {
        name: `${name}-${String(k).padStart(3, '0')}-${c.label}`,
        duration: frames / CUT_FPS,
        draw(f) {
          const frame = nf(f);
          const clock: Clock = { u: (frame + 0.5) / frames, t: frame / CUT_FPS, frame, frames, heat: (start + frame) / total };
          print(f, panels(c.frame, f.stage.w, f.stage.h, clock));
        },
      },
    });
  });
  return { name, entries };
}
