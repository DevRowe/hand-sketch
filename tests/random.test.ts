import { describe, expect, it } from 'vitest';
import { fbm1, hashSeed, loopNoise, noise1, noise2, rng } from '../src/core/random';

describe('rng', () => {
  it('is deterministic per seed and differs across seeds', () => {
    const a = rng(7), b = rng(7), c = rng(8);
    const sa = Array.from({ length: 5 }, a), sb = Array.from({ length: 5 }, b), sc = Array.from({ length: 5 }, c);
    expect(sa).toEqual(sb);
    expect(sa).not.toEqual(sc);
    for (const v of sa) expect(v).toBeGreaterThanOrEqual(0), expect(v).toBeLessThan(1);
  });
});

describe('noise', () => {
  it('stays in [-0.5, 0.5] and is continuous', () => {
    let prev = noise1(0, 3);
    for (let x = 0.01; x < 20; x += 0.01) {
      const v = noise1(x, 3);
      expect(Math.abs(v)).toBeLessThanOrEqual(0.5);
      expect(Math.abs(v - prev)).toBeLessThan(0.05);
      prev = v;
    }
    expect(Math.abs(fbm1(3.3, 9))).toBeLessThanOrEqual(0.5);
    expect(noise2(1.25, 4.5, 11)).toBe(noise2(1.25, 4.5, 11));
  });

  it('loopNoise is seamless at the wrap', () => {
    expect(loopNoise(0, 5)).toBeCloseTo(loopNoise(1, 5), 10);
  });

  it('hashSeed is stable and order-sensitive', () => {
    expect(hashSeed(1, 2, 3)).toBe(hashSeed(1, 2, 3));
    expect(hashSeed(1, 2, 3)).not.toBe(hashSeed(3, 2, 1));
    expect(hashSeed(606, 12, 0)).toBeGreaterThan(0);
  });
});
