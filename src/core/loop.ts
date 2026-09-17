/**
 * Loop-section helpers: a seam-safe boil clock, and the checks that keep `[loopFrom, duration)` seamless.
 *
 * A loop is seamless when local frame `duration` (loop phase 1, never shown) would look exactly like `loopFrom`
 * (phase 0). Anything periodic must therefore divide the loop length in whole drawn frames.
 */
import type { SceneFrame } from './scene';

export interface BoilOptions {
  /** Drawn frames each variant is held. */
  hold?: number;
  /** Number of re-seeded variants cycled (at least 3, preferably 4, or the repeat shows). */
  variants?: number;
}

/** Throw unless `period` whole frames divide the loop length, so a periodic thing returns to its start at the seam. */
export function assertDividesLoop(loopFrames: number, period: number, what: string): void {
  if (!(period > 0) || !Number.isInteger(period) || loopFrames % period !== 0) {
    throw new Error(`${what}: period of ${period} drawn frames does not divide the ${loopFrames}-frame loop, so the seam would jump`);
  }
}

/**
 * Boil step for the frame: 0 (the canonical shape) outside the loop section, then `variants` re-seeded shapes
 * each held `hold` drawn frames. Throws when `hold * variants` does not divide the loop, which would make the seam jump.
 */
export function boilStep(f: SceneFrame, o: BoilOptions = {}): number {
  const { hold = 3, variants = 4 } = o;
  if (f.loopFromFrame === null || f.loopPhase === null) return 0;
  assertDividesLoop(f.loopFrames, hold * variants, 'boil');
  return Math.floor((f.frame - f.loopFromFrame) / hold) % variants;
}

/**
 * Frames since the loop section started, [0, loopFrames]; -1 before it. Not wrapped: at phase 1 (the seam frame,
 * never shown) it is `loopFrames`, so a seam check sees the scene's natural continuation, not phase 0 again.
 */
export function loopFrame(f: SceneFrame): number {
  if (f.loopFromFrame === null || f.loopPhase === null) return -1;
  return f.frame - f.loopFromFrame;
}
