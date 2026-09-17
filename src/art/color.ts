/**
 * Colour maths. Ported from alesha-pro/tools skills/hand-drawn-canvas-animation/assets/core.js (MIT), see NOTICE.
 */
import { clamp, lerp } from '../core/math';

export type RGB = [number, number, number];

export function parseColor(c: string): RGB {
  const s = c.trim();
  if (s.startsWith('#')) {
    const h = s.length === 4 ? [...s.slice(1)].map(ch => ch + ch).join('') : s.slice(1, 7);
    return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)) as RGB;
  }
  const m = s.match(/rgba?\(([^)]+)\)/);
  if (m) {
    const [r = 0, g = 0, b = 0] = m[1]!.split(',').map(v => parseFloat(v));
    return [r, g, b];
  }
  throw new Error(`unsupported colour: ${c}`);
}

export const toHex = ([r, g, b]: RGB): string =>
  '#' + [r, g, b].map(v => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('');

export function mix(a: string, b: string, t: number): string {
  const A = parseColor(a), B = parseColor(b);
  return toHex([lerp(A[0], B[0], t), lerp(A[1], B[1], t), lerp(A[2], B[2], t)]);
}
export const tint = (c: string, t: number): string => mix(c, '#ffffff', t);
export const shade = (c: string, t: number): string => mix(c, '#000000', t);
export function alpha(c: string, a: number): string {
  const [r, g, b] = parseColor(c);
  return `rgba(${r},${g},${b},${a})`;
}

function rgbToHsl([r, g, b]: RGB): RGB {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn, s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  const h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}
function hslToRgb([h, s, l]: RGB): RGB {
  h = (((h % 360) + 360) % 360) / 360;
  if (s === 0) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = (t: number): number => {
    t = ((t % 1) + 1) % 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
}
export const withHsl = (c: string, fn: (hsl: RGB) => RGB): string => toHex(hslToRgb(fn(rgbToHsl(parseColor(c)))));
export const rotateHue = (c: string, deg: number): string => withHsl(c, ([h, s, l]) => [h + deg, s, l]);
export const saturate = (c: string, k: number): string => withHsl(c, ([h, s, l]) => [h, clamp(s * k, 0, 1), l]);
export const lighten = (c: string, d: number): string => withHsl(c, ([h, s, l]) => [h, s, clamp(l + d, 0, 1)]);
