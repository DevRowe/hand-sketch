/**
 * Seeded randomness and coherent noise. Nothing in hand-sketch may call Math.random:
 * every texture and wobble derives from a seed, so the same frame always has the same pixels
 * and static shots never boil unless a scene asks for it.
 *
 * `rng` is the mulberry32-style generator from alesha-pro/tools (MIT), see NOTICE.
 */

export type Rng = () => number;

/** Uniform [0, 1) generator from an integer-ish seed. */
export function rng(seed: number): Rng {
  let a = (seed * 1000003) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministic integer hash of any number of integers, for deriving child seeds. */
export function hashSeed(...parts: number[]): number {
  let h = 0x811c9dc5;
  for (const p of parts) {
    h ^= Math.floor(p) | 0;
    h = Math.imul(h, 0x01000193);
    h ^= h >>> 13;
  }
  return (h >>> 0) % 2147483647;
}

function hash2(ix: number, iy: number, seed: number): number {
  let h = Math.imul(ix | 0, 0x27d4eb2d) ^ Math.imul(iy | 0, 0x165667b1) ^ Math.imul(seed | 0, 0x9e3779b9);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const smooth = (t: number): number => t * t * t * (t * (t * 6 - 15) + 10);

/** 2D value noise in [-0.5, 0.5], C2-smooth between lattice points. */
export function noise2(x: number, y: number, seed: number): number {
  const ix = Math.floor(x), iy = Math.floor(y), fx = smooth(x - ix), fy = smooth(y - iy);
  const a = hash2(ix, iy, seed), b = hash2(ix + 1, iy, seed), c = hash2(ix, iy + 1, seed), d = hash2(ix + 1, iy + 1, seed);
  const top = a + (b - a) * fx, bottom = c + (d - c) * fx;
  return top + (bottom - top) * fy - 0.5;
}

/** 1D value noise in [-0.5, 0.5]. */
export function noise1(x: number, seed: number): number {
  return noise2(x, 0.5, seed);
}

/** Fractal 1D noise: `octaves` layers, each at double frequency and half amplitude. Range roughly [-0.5, 0.5]. */
export function fbm1(x: number, seed: number, octaves = 2): number {
  let sum = 0, amp = 1, norm = 0, freq = 1;
  for (let o = 0; o < octaves; o++) {
    sum += noise1(x * freq, seed + o * 101) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm;
}

/**
 * Noise that is periodic in `phase` (0..1 wraps seamlessly): samples 2D noise on a circle.
 * Use it for idle motion inside a loop section so the loop has no seam.
 */
export function loopNoise(phase: number, seed: number, radius = 1): number {
  const a = phase * Math.PI * 2;
  return noise2(Math.cos(a) * radius + 17.3, Math.sin(a) * radius + 5.1, seed);
}
