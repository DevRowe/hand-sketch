/**
 * Palettes of the solar set: one per visual language, each a full `Palette` so shared code runs on any of them.
 *
 * Where a gallery treatment already fits, it is reused as is (blueprint, sumi, riso, stipple, Bauhaus, deco); the rest
 * are new, tuned for a night sky seen from above. `fills`, `accents` and `inks` are named per palette, in order.
 */
import type { Palette } from '../../art/palette';
import { GALLERY, palette } from '../gallery/palettes';

export const SOLAR = {
  /** Diazo blue, chalk white, dim construction blue, pencil yellow. */
  blueprint: GALLERY.blueprint,
  /**
   * Woodblock: washi, key sumi-indigo; fills Prussian deep, Prussian mid, pale sky, vermilion, ochre, pine green, ash,
   * pale jade; accents the sun's vermilion and its warm halo.
   */
  woodblock: palette({
    paper: '#efe3c8', ink: '#1a2130',
    fills: ['#1d3a63', '#3f6690', '#b7c8cf', '#c8452f', '#d6a24a', '#5d7a4a', '#9a9a8e', '#9cc3b8'],
    accents: ['#c8452f', '#e9b25f'], inks: ['#1d3a63', '#c8452f', '#d6a24a'], finish: 'flat',
  }),
  /** Rice paper, soot ink; fills are ink dilutions; accent the seal vermilion. */
  sumi: GALLERY.sumi,
  /**
   * Etching, printed from two plates: warm plate paper; the cold plate's Prussian black for the sky, the warm plate's
   * bistre for the Sun and planets; fills the plate tone and the platemark shadow.
   */
  etching: palette({
    paper: '#f0e7d3', ink: '#1e2733',
    fills: ['#e6dac0', '#cdbd9b'], accents: ['#5a3620', '#8a5a34'], inks: ['#1e2733', '#5a3620'], finish: 'ink',
  }),
  /** Riso: medium blue, fluorescent pink and yellow over warm stock. */
  riso: GALLERY.risoCity,
  /** Stipple: grey laid paper, lamp-black dots, a sunset rose. */
  stipple: GALLERY.stipple,
  /**
   * Pastel on black: charcoal paper; fills sun yellow, sun orange, rose, ice cyan, ultramarine, sea green, cream, lilac
   * grey, peach; accents the sun's two.
   */
  pastel: palette({
    paper: '#14161b', ink: '#f2eee4', night: '#0b0c0f',
    fills: ['#ffd66b', '#ff9a4d', '#f08aa2', '#8ce6ee', '#6f8dff', '#6fd896', '#f6ecd0', '#b6aec6', '#f5b98a'],
    accents: ['#ffd66b', '#ff9a4d'], inks: ['#ffd66b', '#8ce6ee'], finish: 'flat',
  }),
  /**
   * Cut paper: a night-navy ground; fills the stacked orbit sheets from outer to inner, then the Sun's three papers;
   * accents the planet papers (grey, cream, blue, leaf green, red, orange, sand, pale teal, cobalt).
   */
  cutPaper: palette({
    paper: '#141c38', ink: '#0c1022',
    fills: ['#1b2650', '#213063', '#283a75', '#2f4585', '#375094', '#405ca2', '#4a68ae', '#5676b9', '#f2b631', '#ee7d2b', '#fbe08a'],
    accents: ['#a9a6a0', '#f1dfb8', '#3f86d6', '#58a55c', '#d9533b', '#e59a55', '#e8cf95', '#9fd8d0', '#3553c6'],
    inks: ['#f2b631', '#ee7d2b'], finish: 'flat',
  }),
  /** Bauhaus: bone paper, black, signal red, chrome yellow, cobalt. */
  bauhaus: GALLERY.bauhaus,
  /** Deco: black lacquer, gold, pale gold, cream, peacock teal. */
  deco: GALLERY.deco,
} satisfies Record<string, Palette>;

export type SolarPaletteName = keyof typeof SOLAR;
