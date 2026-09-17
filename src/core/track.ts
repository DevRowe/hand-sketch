/**
 * Timeline tracks: keyframed values over drawn frames, for beats, chains and same-frame hand-offs.
 *
 * Keys are in local drawn frames (integers), so an event lands on an exact frame, and "the next station fires on
 * the frame the pulse arrives" is a matter of sharing a frame number. The ease of a key shapes the approach *to*
 * it: `hold` skips every in-between (the value jumps on the key frame), which is how a beat lands as impact.
 * `settle` overshoots on the arrival frame only, then rests: at most one overshoot frame, no bounce.
 */
import { clamp, easeIn, easeInOut, easeOut, lerp, linear } from './math';

export const EASES = { linear, in: easeIn, out: easeOut, inOut: easeInOut } as const;
export type EaseName = keyof typeof EASES | 'hold';

export type TrackValue = number | readonly number[];

export interface Key<V extends TrackValue = number> {
  /** Local drawn frame. */
  frame: number;
  value: V;
  /** How the value approaches this key from the previous one. Default 'inOut'. */
  ease?: EaseName;
  /** Overshoot on the arrival frame as a fraction of the step from the previous value (e.g. 0.15). */
  settle?: number;
}

const mixValue = <V extends TrackValue>(a: V, b: V, t: number): V =>
  (typeof a === 'number' ? lerp(a, b as number, t) : (a as readonly number[]).map((x, i) => lerp(x, (b as readonly number[])[i]!, t))) as V;

/** A keyframed track: returns the value at a (possibly fractional) local frame. Keys are sorted by frame. */
export function track<V extends TrackValue>(keys: readonly Key<V>[]): (frame: number) => V {
  if (keys.length === 0) throw new Error('track needs at least one key');
  const ks = [...keys].sort((a, b) => a.frame - b.frame);
  return frame => {
    if (frame <= ks[0]!.frame) return ks[0]!.value;
    for (let i = 1; i < ks.length; i++) {
      const prev = ks[i - 1]!, key = ks[i]!;
      if (frame > key.frame) continue;
      if (frame === key.frame) return key.settle ? mixValue(prev.value, key.value, 1 + key.settle) : key.value;
      const ease = key.ease ?? 'inOut';
      if (ease === 'hold') return prev.value;
      const u = (frame - prev.frame) / (key.frame - prev.frame);
      return mixValue(prev.value, key.value, EASES[ease](u));
    }
    return ks[ks.length - 1]!.value;
  };
}

/** Linear 0..1 progress of `frame` through `frames` drawn frames starting at `start`; 1 on and after the last frame. */
export function clip(frame: number, start: number, frames: number): number {
  if (frames <= 0) return frame >= start ? 1 : 0;
  return clamp((frame - start) / frames, 0, 1);
}

export interface FrameSlot { start: number; frames: number }

/** Chained slots: each starts on the drawn frame the previous one completes, so causes and effects share a frame. */
export function chain(start: number, durations: readonly number[]): FrameSlot[] {
  let at = start;
  return durations.map(frames => {
    const slot = { start: at, frames };
    at += frames;
    return slot;
  });
}

/**
 * Distance travelled by something that starts from rest at `t0`, accelerates evenly over `ramp`, and then moves
 * at constant `speed` without a jump in velocity: the hand's eased stroke handing off to the machine's metronome.
 * Any time unit works as long as `ramp` and `speed` use the same one.
 */
export function rampToConstant(t: number, t0: number, ramp: number, speed: number): number {
  const dt = t - t0;
  if (dt <= 0) return 0;
  if (ramp <= 0) return speed * dt;
  if (dt < ramp) return (speed * dt * dt) / (2 * ramp);
  return speed * (ramp / 2 + dt - ramp);
}
