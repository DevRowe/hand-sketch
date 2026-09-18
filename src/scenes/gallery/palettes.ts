/**
 * Palettes of the gallery set: one per visual treatment, each a full `Palette` so shared code runs on any of them.
 *
 * The set is deliberately not one look: washi and Prussian blue for the woodblocks, rice paper and soot for sumi,
 * blueprint and cyanotype blues, fluorescent riso inks, sepia etching, cold-press watercolour, pastel on black,
 * cut coloured paper, Bauhaus primaries, deco gold on lacquer and a single black line on white.
 * `fills`, `accents` and `inks` are named per palette in its comment, in order.
 */
import { alpha, mix, shade, tint } from '../../art/color';
import type { Finish, Palette } from '../../art/palette';

export interface PaletteSpec {
  paper: string;
  ink: string;
  fills: string[];
  accents: string[];
  inks: string[];
  finish: Finish;
  night?: string;
  shade?: string;
  light?: string;
  blush?: string;
}

/** A full `Palette` from the few colours a treatment names; the rest derived. */
export function palette(o: PaletteSpec): Palette {
  const dark = o.night ?? shade(o.ink, 0.3);
  return {
    paper: o.paper, paperBand: null, ink: o.ink, night: dark, chalk: o.paper, chalkDim: mix(o.ink, o.paper, 0.55), guide: alpha(o.ink, 0.35),
    fills: o.fills, shade: o.shade ?? o.ink, light: o.light ?? tint(o.paper, 0.6), blush: o.blush ?? o.accents[0]!,
    accents: o.accents, inks: o.inks, finish: o.finish,
  };
}

export const GALLERY = {
  /** Woodblock sea: washi, key indigo; fills far-to-near sea blues and the foam; accents sun vermilion, mountain grey. */
  woodblock: palette({
    paper: '#eee2c6', ink: '#1c2433',
    fills: ['#b3c6cf', '#86a5b8', '#55809f', '#2f5d84', '#1b3d63', '#f3ead4'],
    accents: ['#c8452f', '#8497a6', '#2e4a6b'], inks: ['#1b3d63', '#c8452f'], finish: 'flat',
  }),
  /** Woodcut winter: cream stock, carbon black block, fox vermilion block, birch grey. */
  snowblock: palette({
    paper: '#efe8da', ink: '#16151a',
    fills: ['#d9502e', '#a33a22', '#c9c2b4'], accents: ['#d9502e', '#f4efe4'], inks: ['#16151a', '#d9502e'], finish: 'flat',
  }),
  /** Sumi: rice paper, soot ink; fills are ink dilutions; accent is the seal vermilion. */
  sumi: palette({
    paper: '#efe8d8', ink: '#141311',
    fills: ['#8d8a83', '#b9b4a8', '#d7d0c0'], accents: ['#b3342a', '#e0643f'], inks: ['#141311', '#b3342a'], finish: 'ink',
  }),
  /** Blueprint: diazo blue, chalk white line, dim construction line, pencil yellow. */
  blueprint: palette({
    paper: '#174a7e', ink: '#eaf2fb', night: '#0f355d',
    fills: ['#1f5791', '#12395f', '#2b66a3'], accents: ['#f3d67a', '#9dbbdc'], inks: ['#eaf2fb', '#f3d67a'], finish: 'flat',
  }),
  /** Cyanotype: white rag paper, Prussian coating (deep, mid), exposed white and the half-exposed pale blue. */
  cyanotype: palette({
    paper: '#f3f0e8', ink: '#15406f',
    fills: ['#1b4b80', '#123763', '#2d64a0'], accents: ['#e2ecf3', '#8fb2d2'], inks: ['#15406f', '#e2ecf3'], finish: 'flat',
  }),
  /** Riso city: fluorescent pink, medium blue and yellow over warm stock. */
  risoCity: palette({
    paper: '#f1ece1', ink: '#0078bf',
    fills: ['#0078bf', '#ff48b0', '#ffe800'], accents: ['#ff48b0', '#ffe800', '#0078bf'], inks: ['#0078bf', '#ff48b0', '#ffe800'], finish: 'riso',
  }),
  /** Riso island: orange, teal, purple and yellow. */
  risoIsland: palette({
    paper: '#f3eee2', ink: '#00838a',
    fills: ['#ff6c2f', '#00838a', '#765ba7', '#ffe800'], accents: ['#ff6c2f', '#ffe800'], inks: ['#ff6c2f', '#00838a', '#765ba7', '#ffe800'], finish: 'riso',
  }),
  /** Stipple dusk: grey laid paper, lamp-black dots and a sunset rose. */
  stipple: palette({
    paper: '#e8e3d8', ink: '#221f1c',
    fills: ['#c2694b', '#d9a47c'], accents: ['#c2694b'], inks: ['#221f1c', '#c2694b'], finish: 'flat',
  }),
  /** Etching: warm plate paper, sepia-black line, a lamp's honey. */
  etching: palette({
    paper: '#efe6d2', ink: '#2a2118',
    fills: ['#d7c29a', '#b89a6e'], accents: ['#e8b85a', '#fff4d6'], inks: ['#2a2118'], finish: 'ink',
  }),
  /** Sea chart: foxed vellum, iron-gall sepia, sea wash, vermilion route. */
  chart: palette({
    paper: '#e6d6b0', ink: '#4a3322',
    fills: ['#a9b9a4', '#c9b98e', '#8d7a5a'], accents: ['#9b3b2a', '#2f5d6b'], inks: ['#4a3322', '#9b3b2a'], finish: 'ink',
  }),
  /** Watercolour night: cold-press white, indigo, ultramarine, amber lamps, teal. */
  watercolour: palette({
    paper: '#f5f2ea', ink: '#2b2d42',
    fills: ['#2f3e6e', '#4a6fa5', '#7fa7b5', '#f0a64a', '#e46a4d'], accents: ['#f0a64a', '#ffd68a'], inks: ['#2f3e6e', '#f0a64a'], finish: 'flat',
  }),
  /** Pastel on black: charcoal paper, aurora green, teal, magenta, snow. */
  pastelNight: palette({
    paper: '#15171c', ink: '#e9ecef', night: '#0c0d10',
    fills: ['#62f0a4', '#2fc6b8', '#e374c8', '#f6f0d8'], accents: ['#62f0a4', '#e374c8'], inks: ['#62f0a4', '#e374c8'], finish: 'flat',
  }),
  /** Abyss: blue-black, bioluminescent cyan, magenta, violet. */
  abyss: palette({
    paper: '#070b16', ink: '#bff6ff', night: '#04060c',
    fills: ['#6ff2ff', '#ff79d8', '#a58cff', '#3a5bd9'], accents: ['#6ff2ff', '#ff79d8'], inks: ['#6ff2ff', '#ff79d8'], finish: 'flat',
  }),
  /** Cut paper (Matisse): ultramarine ground, vermilion figures, leaf green, lemon, black. */
  cutPaper: palette({
    paper: '#1f45a8', ink: '#131313',
    fills: ['#e5532d', '#2f8f5a', '#f2c230', '#f4ede0'], accents: ['#e5532d', '#f2c230'], inks: ['#e5532d', '#2f8f5a'], finish: 'flat',
  }),
  /** Toy theatre: card in dusk blue, sea teal, crimson curtains, gold moon, cream. */
  theatre: palette({
    paper: '#2a3050', ink: '#1a1a24',
    fills: ['#3f5a8a', '#2f7f86', '#1f5f6e', '#b8323a', '#e8c35a', '#f1e6cf'], accents: ['#e8c35a', '#b8323a'], inks: ['#b8323a', '#e8c35a'], finish: 'flat',
  }),
  /** Bauhaus: bone paper, black, signal red, chrome yellow, cobalt. */
  bauhaus: palette({
    paper: '#eee7d7', ink: '#1b1b1b',
    fills: ['#d23c2a', '#f0b429', '#2a57a5', '#1b1b1b'], accents: ['#d23c2a', '#f0b429', '#2a57a5'], inks: ['#d23c2a', '#2a57a5'], finish: 'flat',
  }),
  /** Kandinsky score: warm canvas, black, red, yellow, blue, rose, violet. */
  score: palette({
    paper: '#f0e9da', ink: '#191717',
    fills: ['#cf3b2b', '#f2b632', '#2e5aa8', '#e58fa6', '#6e4c9a', '#2f8a6b'], accents: ['#cf3b2b', '#2e5aa8'], inks: ['#191717', '#cf3b2b'], finish: 'flat',
  }),
  /** Deco: black lacquer, gold, pale gold, cream, peacock teal. */
  deco: palette({
    paper: '#0f0e10', ink: '#d6b25e', night: '#070708',
    fills: ['#1c4a4a', '#16302f', '#2b2a2e'], accents: ['#d6b25e', '#f3e2ae', '#efe4c8'], inks: ['#d6b25e', '#1c4a4a'], finish: 'flat',
  }),
  /** One line: bright white, black line, one red sun. */
  monoline: palette({
    paper: '#faf8f3', ink: '#141414',
    fills: ['#e2412f'], accents: ['#e2412f'], inks: ['#141414', '#e2412f'], finish: 'flat',
  }),
} satisfies Record<string, Palette>;

export type GalleryPaletteName = keyof typeof GALLERY;
