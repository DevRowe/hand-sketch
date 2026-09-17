/**
 * Periodic emitters: conveyor-style streams inside a loop section that are seamless by construction.
 *
 * Items are emitted every `every` drawn frames and live for `life` frames. Age is measured modulo the loop
 * length, so an item emitted near the end of the loop is still travelling at its start, and the frame after
 * the seam shows exactly what the frame before it continued into. Per-item irregularity comes from a jitter
 * pattern that repeats a whole number of times per loop.
 */
import { assertDividesLoop } from './loop';

export interface EmitterSpec {
  /** Drawn frames between emissions; must divide the loop length. */
  every: number;
  /** Drawn frames each item stays alive (its travel), at most the loop length. */
  life: number;
  /** Frame of the first emission inside the loop period. Default 0. */
  offset?: number;
  /**
   * Per-item extra delay in drawn frames, repeated: item j is emitted `jitter[j % jitter.length]` frames late.
   * Its length must divide the number of items per loop so the pattern repeats exactly.
   */
  jitter?: readonly number[];
}

export interface Emission {
  /** Item index within one loop period, 0 .. loopFrames / every - 1 (stable identity for per-item variation). */
  index: number;
  /** Whole drawn frames since this item was emitted, 0 .. life - 1. */
  age: number;
  /** age / life, in [0, 1). */
  u: number;
}

/** Items alive at frame `frame` of a loop of `loopFrames` drawn frames, oldest first. */
export function emissions(frame: number, loopFrames: number, spec: EmitterSpec): Emission[] {
  const { every, life, offset = 0, jitter = [] } = spec;
  assertDividesLoop(loopFrames, every, 'emitter');
  const count = loopFrames / every;
  if (jitter.length > 0 && count % jitter.length !== 0) throw new Error(`emitter: jitter pattern of ${jitter.length} does not divide ${count} items per loop`);
  if (!(life > 0) || life > loopFrames) throw new Error(`emitter: life ${life} must be in (0, ${loopFrames}]`);
  const at = ((Math.floor(frame) % loopFrames) + loopFrames) % loopFrames;
  const out: Emission[] = [];
  for (let j = 0; j < count; j++) {
    const born = j * every + offset + (jitter.length ? jitter[j % jitter.length]! : 0);
    const age = (((at - born) % loopFrames) + loopFrames) % loopFrames;
    if (age < life) out.push({ index: j, age, u: age / life });
  }
  return out.sort((a, b) => b.age - a.age);
}

/** Phase of conveyor item k of n: `(phase + k / n) mod 1`. Periodic in `phase` by construction. */
export const conveyor = (phase: number, k: number, n: number): number => (((phase + k / n) % 1) + 1) % 1;

/** 0..1 visibility of an item at progress `u`: fades in over [0, enter] and out over [1 - exit, 1]. */
export function lifeWindow(u: number, enter: number, exit: number): number {
  const a = enter > 0 ? Math.min(1, Math.max(0, u / enter)) : u >= 0 ? 1 : 0;
  const b = exit > 0 ? Math.min(1, Math.max(0, (1 - u) / exit)) : u <= 1 ? 1 : 0;
  return Math.min(a, b);
}
