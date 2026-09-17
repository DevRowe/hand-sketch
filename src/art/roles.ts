/**
 * Colour by role: a small grammar for explainer animations where colour carries meaning without words.
 *
 * - pencil: the manual process as it is today (and, at low alpha, the ghost of the "before");
 * - key ink: the client's own tools, documents and frames;
 * - accent ink: only ever the thing being introduced (for Keystone, the automation it builds).
 *
 * When the mess resolves, pencil gives way to accent ink and the pencil stays behind as a faint ghost, so one
 * resting frame shows before and after. Scenes take their stroke presets from `roleStrokes`, so a brand pack
 * only has to swap the role colours.
 */
import type { StrokeStyle } from '../core/stroke';
import { PALETTES, type Palette } from './palette';

export interface InkRoles {
  /** The page. */
  stock: string;
  /** The client's tools and documents. */
  key: string;
  /** The automation, and nothing else. */
  accent: string;
  /** The manual way. */
  pencil: string;
  /** Opacity of the pencil "before" once it has become a ghost. */
  ghost: number;
}

const k = PALETTES.keystone;
export const KEYSTONE_ROLES: InkRoles = { stock: k.paper, key: k.ink, accent: k.inks[0]!, pencil: '#6f7673', ghost: 0.24 };

export interface RoleStrokes {
  /** Key ink outlines of tools and documents. */
  INK: StrokeStyle;
  /** Fine key-ink detail: rows, squiggle writing. */
  FINE: StrokeStyle;
  /** The manual process. */
  PENCIL: StrokeStyle;
  /** The automation line: steadier than the pencil (less tremor and pressure change, longer drift). Same medium, calmer hand. */
  FLOW: StrokeStyle;
  /** Accent ticks and short marks. */
  TICK: StrokeStyle;
}

/** Stroke presets per role (values validated on the K01 proof render). */
export function roleStrokes(r: InkRoles): RoleStrokes {
  const INK: StrokeStyle = { color: r.key, size: 5, thinning: 0.6, wobble: 1.8, wobbleWavelength: 170, tremor: 0.4, pressureVariation: 0.5, dryBrush: 0.25, paper: r.stock };
  const FLOW: StrokeStyle = { color: r.accent, size: 8.5, thinning: 0.3, wobble: 0.9, wobbleWavelength: 280, tremor: 0.12, pressureVariation: 0.2, dryBrush: 0.18, paper: r.stock, taperStart: 30, taperEnd: 40 };
  return {
    INK,
    FINE: { ...INK, size: 2.6, thinning: 0.45, wobble: 1, tremor: 0.3, dryBrush: 0, alpha: 0.85 },
    PENCIL: { color: r.pencil, size: 2.9, thinning: 0.3, wobble: 2.6, tremor: 0.9, pressureVariation: 0.7, alpha: 0.82, taperStart: 24, taperEnd: 24 },
    FLOW,
    TICK: { ...FLOW, size: 6, taperStart: 8, taperEnd: 12 },
  };
}

/** A palette whose keys follow the roles (for code that works on any `Palette`). */
export function rolePalette(r: InkRoles, base: Palette = PALETTES.keystone): Palette {
  return { ...base, paper: r.stock, ink: r.key, inks: [r.accent, r.key], shade: r.key, light: r.stock, chalk: r.stock };
}
