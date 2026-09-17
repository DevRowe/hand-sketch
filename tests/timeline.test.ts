import { describe, expect, it } from 'vitest';
import { conveyor, emissions, lifeWindow } from '../src/core/emitter';
import { assertDividesLoop, boilStep, loopFrame } from '../src/core/loop';
import { posePoint } from '../src/core/puppet';
import { ON_TWOS, posterFrame, sceneFrame, seamFrames, type Scene } from '../src/core/scene';
import type { Stage } from '../src/core/stage';
import { chain, clip, rampToConstant, track } from '../src/core/track';

const scene: Scene = { name: 'k', duration: 7, loopFrom: 4, draw: () => {} };
const frameAt = (i: number, s: Scene = scene) => sceneFrame({} as CanvasRenderingContext2D, {} as Stage, s, i, ON_TWOS, { strokeMode: 'engine' });

describe('loop section', () => {
  it('exposes the loop start and length on the frame, and phase 1 at the never-shown seam frame', () => {
    expect(frameAt(10)).toMatchObject({ loopPhase: null, loopFromFrame: 48, loopFrames: 36 });
    expect(frameAt(84).loopPhase).toBe(1);
    expect(seamFrames(scene, 12)).toEqual({ from: 48, end: 84 });
    expect(seamFrames({ name: 'x', duration: 2, draw: () => {} }, 12)).toBeNull();
  });

  it('steps boil only inside the loop and returns to the canonical shape at the seam', () => {
    expect(boilStep(frameAt(40))).toBe(0);
    expect([48, 50, 51, 57, 60].map(i => boilStep(frameAt(i)))).toEqual([0, 0, 1, 3, 0]);
    expect(boilStep(frameAt(84))).toBe(boilStep(frameAt(48)));
    expect(loopFrame(frameAt(84))).toBe(36);
    expect(loopFrame(frameAt(40))).toBe(-1);
  });

  it('refuses a boil cycle that does not divide the loop', () => {
    expect(() => boilStep(frameAt(50), { hold: 5, variants: 4 })).toThrow(/does not divide the 36-frame loop/);
    expect(() => assertDividesLoop(36, 12, 'x')).not.toThrow();
  });

  it('picks the poster time, or the last intro frame', () => {
    expect(posterFrame({ ...scene, poster: 5.2 }, 12)).toBe(62);
    expect(posterFrame(scene, 12)).toBe(47);
  });
});

describe('emitters', () => {
  const spec = { every: 12, life: 10 };
  it('is periodic over the loop: frame L looks like frame 0', () => {
    for (let i = 0; i < 36; i++) expect(emissions(i + 36, 36, spec)).toEqual(emissions(i, 36, spec));
  });

  it('carries items across the seam instead of dropping them', () => {
    const late = { every: 12, life: 10, offset: 30 };
    expect(emissions(2, 36, late)).toEqual([{ index: 0, age: 8, u: 0.8 }]);
  });

  it('applies a repeating per-item jitter and rejects patterns that would not repeat', () => {
    const jittered = emissions(13, 36, { every: 9, life: 4, jitter: [0, 3] });
    expect(jittered.map(e => [e.index, e.age])).toEqual([[1, 1]]);
    expect(() => emissions(0, 36, { every: 9, life: 4, jitter: [0, 1, 2] })).toThrow(/jitter/);
    expect(() => emissions(0, 36, { every: 10, life: 4 })).toThrow(/does not divide/);
  });

  it('spaces conveyor phases evenly and wraps', () => {
    expect(conveyor(0.9, 1, 4)).toBeCloseTo(0.15);
    expect(conveyor(1, 0, 3)).toBe(0);
    expect(lifeWindow(0.05, 0.1, 0.2)).toBeCloseTo(0.5);
    expect(lifeWindow(0.5, 0.1, 0.2)).toBe(1);
    expect(lifeWindow(0.9, 0.1, 0.2)).toBeCloseTo(0.5);
  });
});

describe('tracks', () => {
  it('interpolates between keys with the approach ease of the later key', () => {
    const x = track([{ frame: 0, value: 0 }, { frame: 10, value: 100, ease: 'linear' }]);
    expect(x(-5)).toBe(0);
    expect(x(5)).toBe(50);
    expect(x(20)).toBe(100);
  });

  it('holds the previous value until the key frame when in-betweens are skipped', () => {
    const x = track([{ frame: 0, value: 0 }, { frame: 4, value: 10, ease: 'hold' }]);
    expect([0, 1, 3, 4, 5].map(x)).toEqual([0, 0, 0, 10, 10]);
  });

  it('overshoots for exactly one frame on arrival, then rests', () => {
    const y = track([{ frame: 0, value: 0 }, { frame: 2, value: 20, ease: 'hold', settle: 0.1 }]);
    expect(y(1)).toBe(0);
    expect(y(2)).toBeCloseTo(22);
    expect(y(3)).toBe(20);
  });

  it('tracks vectors', () => {
    const p = track<readonly number[]>([{ frame: 0, value: [0, 0] }, { frame: 2, value: [10, 20], ease: 'linear' }]);
    expect(p(1)).toEqual([5, 10]);
  });

  it('chains slots so each starts on the frame the previous completes', () => {
    expect(chain(30, [2, 2, 3])).toEqual([{ start: 30, frames: 2 }, { start: 32, frames: 2 }, { start: 34, frames: 3 }]);
    expect(clip(31, 30, 2)).toBe(0.5);
    expect(clip(40, 30, 0)).toBe(1);
  });

  it('hands off from an eased start to constant speed without a velocity jump', () => {
    const d = (t: number) => rampToConstant(t, 0, 1, 10);
    const eps = 1e-4;
    expect((d(1 + eps) - d(1 - eps)) / (2 * eps)).toBeCloseTo(10, 3);
    expect(d(3) - d(2)).toBeCloseTo(10);
    expect(d(-1)).toBe(0);
  });
});

describe('puppet poses', () => {
  it('maps local points through translate, rotate and scale', () => {
    const p = posePoint({ x: 100, y: 50, rotation: Math.PI / 2, scale: 2 }, [10, 0]);
    expect(p[0]).toBeCloseTo(100);
    expect(p[1]).toBeCloseTo(70);
  });
});
