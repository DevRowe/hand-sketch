export type Vec2 = readonly [number, number];

export const TAU = Math.PI * 2;
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const clamp = (x: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, x));

export const easeInOut = (t: number): number => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOut = (t: number): number => 1 - Math.pow(1 - t, 3);
export const easeIn = (t: number): number => t * t * t;
export const linear = (t: number): number => t;

/** 0..1 progress of `t` through the window [a, b], shaped by `ease`. */
export function window01(t: number, a: number, b: number, ease: (t: number) => number = easeInOut): number {
  if (b <= a) return t >= b ? 1 : 0;
  return ease(clamp((t - a) / (b - a), 0, 1));
}

/** Staggered start times: item k of n starts at `start + k * step`. */
export const stagger = (start: number, step: number, k: number): number => start + step * k;
