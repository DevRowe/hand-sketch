/**
 * Palette schema and presets. Every palette has the same keys, so a scene written for one runs on any other.
 * Schema, presets and derivation ported from alesha-pro/tools skills/hand-drawn-canvas-animation (MIT), see NOTICE.
 */
import { alpha, lighten, mix, rotateHue, saturate, shade, tint } from './color';

export type Finish = 'ink' | 'riso' | 'screen' | 'pencil' | 'flat';

export interface Palette {
  /** Background of daylight shots. */
  paper: string;
  /** Faint diagonal light bands on paper, or null. */
  paperBand: string | null;
  /** Dark outline and text. */
  ink: string;
  /** Background of dark / blueprint shots. */
  night: string;
  /** Light line on night, and its quiet version. */
  chalk: string;
  chalkDim: string;
  /** Construction / guide line colour (with alpha). */
  guide: string;
  /** 3..8 flat fills for subjects. */
  fills: string[];
  /** Hatch / dot colour laid over fills. */
  shade: string;
  /** Highlight hatch on fills. */
  light: string;
  /** Second shade: warm shadow, cheeks, sunsets. */
  blush: string;
  /** Four loud colours for accents. */
  accents: string[];
  /** 2..4 print inks for riso plates and dot screens, in print order. */
  inks: string[];
  /** Default surface finish. */
  finish: Finish;
}

export const PALETTES = {
  paperInk: {
    paper: '#f3e6cf', paperBand: 'rgba(255,238,200,.65)', ink: '#1e1630', night: '#0b0d1f', chalk: '#e8ecff', chalkDim: '#8d97c9', guide: 'rgba(70,100,255,.55)',
    fills: ['#e79256', '#c99a5a', '#b8864e', '#d9b078'], shade: '#3a2214', light: '#fff1d6', blush: '#c8473f',
    accents: ['#ff2bd6', '#28f0e0', '#ffe22b', '#5cff5c'], inks: ['#1e1630', '#c8473f', '#2b5fb8'], finish: 'ink',
  },
  risoPop: {
    paper: '#f0ece2', paperBand: null, ink: '#22366b', night: '#2a2050', chalk: '#f3ebb1', chalkDim: '#8f86c8', guide: 'rgba(34,54,107,.5)',
    fills: ['#ff48b0', '#0078bf', '#ffe800', '#00a95c', '#ff6c2f', '#765ba7'], shade: '#22366b', light: '#fff9c8', blush: '#ff48b0',
    accents: ['#ff48b0', '#0078bf', '#ffe800', '#00a95c'], inks: ['#0078bf', '#ff48b0', '#ffe800', '#22366b'], finish: 'riso',
  },
  screenSea: {
    paper: '#e8e6db', paperBand: null, ink: '#1f1e2d', night: '#1a1c2e', chalk: '#e8e6db', chalkDim: '#8a93a6', guide: 'rgba(10,80,131,.5)',
    fills: ['#0a5083', '#518e9d', '#becacc', '#e4a05c', '#91906a', '#e8c84a', '#c8473f', '#051630'], shade: '#051630', light: '#f4f2e8', blush: '#e4a05c',
    accents: ['#c8473f', '#e8c84a', '#518e9d', '#f0a0b0'], inks: ['#0a5083', '#051630', '#e8c84a'], finish: 'screen',
  },
  pencilMinimal: {
    paper: '#f4efe4', paperBand: null, ink: '#201f1b', night: '#27251f', chalk: '#d9d2c2', chalkDim: '#7d786c', guide: 'rgba(32,31,27,.35)',
    fills: ['#e8d6cc', '#e0e2d0', '#dad2c5', '#f4efe4'], shade: '#5e5a50', light: '#ffffff', blush: '#c9a9a0',
    accents: ['#8a8a55', '#b0483a', '#7e8aa0', '#c9a15a'], inks: ['#201f1b', '#8a8a55'], finish: 'pencil',
  },
  blueprintNight: {
    paper: '#0b0d1f', paperBand: null, ink: '#e8ecff', night: '#0b0d1f', chalk: '#e8ecff', chalkDim: '#8d97c9', guide: 'rgba(150,170,255,.7)',
    fills: ['#1a2040', '#22306a', '#2c3a80', '#141a33'], shade: '#8d97c9', light: '#ffffff', blush: '#7fe7ff',
    accents: ['#7fe7ff', '#ff6fd8', '#ffe22b', '#5fe08a'], inks: ['#e8ecff', '#7fe7ff'], finish: 'ink',
  },
} satisfies Record<string, Palette>;

export type PaletteName = keyof typeof PALETTES;

/** Fill missing keys from a base palette. */
export function makePalette(part: Partial<Palette>, base: PaletteName | Palette = 'paperInk'): Palette {
  const b = typeof base === 'string' ? PALETTES[base] : base;
  return { ...b, ...part };
}

/** Shift a whole palette in HSL; paper, ink and night stay unless overridden. */
export function derivePalette(pal: Palette, o: { hue?: number; sat?: number; light?: number; paper?: string; ink?: string; night?: string; finish?: Finish } = {}): Palette {
  const { hue = 0, sat = 1, light = 0 } = o;
  const f = (c: string): string => lighten(saturate(rotateHue(c, hue), sat), light);
  return {
    ...pal,
    paper: o.paper ?? pal.paper, ink: o.ink ?? pal.ink, night: o.night ?? pal.night, finish: o.finish ?? pal.finish,
    fills: pal.fills.map(f), accents: pal.accents.map(f), inks: pal.inks.map(f), shade: f(pal.shade), blush: f(pal.blush),
  };
}

/** Two inks on paper. */
export function duotone(inkA: string, inkB: string, paper = '#f0ece2', finish: Finish = 'riso'): Palette {
  return makePalette({
    paper, ink: inkA, night: shade(inkA, 0.6), chalk: paper, chalkDim: mix(inkA, paper, 0.5), guide: alpha(inkA, 0.5),
    fills: [inkA, inkB, mix(inkA, inkB, 0.5), tint(inkA, 0.5), tint(inkB, 0.5)], shade: inkA, light: paper, blush: inkB,
    accents: [inkB, inkA, tint(inkB, 0.4), tint(inkA, 0.4)], inks: [inkA, inkB], finish,
  });
}
