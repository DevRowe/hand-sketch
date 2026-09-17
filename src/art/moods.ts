/**
 * Mood palettes: presets chosen for a feeling rather than a brand, for the poetic set (`src/scenes/poetic/`).
 *
 * Each is a full `Palette`, so any code written for a palette runs on them. The grammar is restrained on purpose:
 * one stock, one drawing ink, and one or two print inks that carry the emotion (the light, the thread, the gold).
 * `inks[0]` is always the piece's feeling colour; `accents` are its quiet companions.
 */
import type { Palette } from './palette';

export const MOODS = {
  /** Memory and grief: warm linen, umber ink, honeyed morning light and a faded vermilion. */
  keepsake: {
    paper: '#efe7da', paperBand: null, ink: '#3a302a', night: '#221c18', chalk: '#efe7da', chalkDim: '#9d9084', guide: 'rgba(58,48,42,.32)',
    fills: ['#e6c49a', '#d9b48a', '#cdbfae', '#e9dfd0'], shade: '#3a302a', light: '#fbf6ee', blush: '#c47f68',
    accents: ['#b8462f', '#d49a57', '#7f8a88', '#a58b98'], inks: ['#d9a25e', '#b8462f', '#3a302a'], finish: 'pencil',
  },
  /** Love and connection: soft off-white, charcoal, and a true thread red with a lamplit window. */
  tenderness: {
    paper: '#f2ede4', paperBand: null, ink: '#2e2b31', night: '#1d1b22', chalk: '#f2ede4', chalkDim: '#9a948c', guide: 'rgba(46,43,49,.3)',
    fills: ['#e9c07a', '#d9a0a0', '#c9c2b8', '#efe6d6'], shade: '#2e2b31', light: '#fffaf0', blush: '#d77c6a',
    accents: ['#c3382b', '#e2a64f', '#8d8a93', '#d9a0a0'], inks: ['#c3382b', '#e2a64f'], finish: 'riso',
  },
  /** Resilience: pale stone, charcoal, a celadon glaze and gold for what was mended. */
  gilt: {
    paper: '#ece6da', paperBand: null, ink: '#2b2927', night: '#1c1a19', chalk: '#ece6da', chalkDim: '#8f887e', guide: 'rgba(43,41,39,.3)',
    fills: ['#7e9d93', '#a9bdb2', '#5d7b74', '#d8d2c4'], shade: '#2b2927', light: '#f8f4ea', blush: '#c7a15b',
    accents: ['#c38d2a', '#e8c46e', '#7e9d93', '#5d7b74'], inks: ['#c38d2a', '#6f9187'], finish: 'riso',
  },
  /** Endurance: storm-night navy, salt-white chalk and the lamp's warm gold. */
  vigil: {
    paper: '#131c2b', paperBand: null, ink: '#e3e4dc', night: '#131c2b', chalk: '#e3e4dc', chalkDim: '#7d8898', guide: 'rgba(160,175,200,.4)',
    fills: ['#1d2a3d', '#26374f', '#304560', '#0e1522'], shade: '#0b111c', light: '#fff6d8', blush: '#f2c35c',
    accents: ['#f2c35c', '#ffe7a3', '#8fa6bf', '#d98f4e'], inks: ['#f2c35c', '#8fa6bf'], finish: 'riso',
  },
  /** Solitude: the deep water column, pale aqua line and the song's soft sea-glass. */
  deep: {
    paper: '#0f2a33', paperBand: null, ink: '#d6e6e1', night: '#0f2a33', chalk: '#d6e6e1', chalkDim: '#6f9296', guide: 'rgba(140,200,195,.35)',
    fills: ['#143640', '#1b434d', '#0a1f26', '#23525b'], shade: '#081a20', light: '#eaf6f1', blush: '#8fd1c3',
    accents: ['#8fd1c3', '#c7ece2', '#5f9ea0', '#e6d9a8'], inks: ['#8fd1c3', '#5f9ea0'], finish: 'screen',
  },
  /** Growth and the turning year: moss ink, blossom, leaf, amber and rust. */
  grove: {
    paper: '#f0ede2', paperBand: null, ink: '#2b2f27', night: '#1c1f1a', chalk: '#f0ede2', chalkDim: '#9a9a8c', guide: 'rgba(43,47,39,.3)',
    fills: ['#e7a3ad', '#79a25a', '#dc8f3c', '#b4552f', '#fbfaf4'], shade: '#2b2f27', light: '#fbfaf4', blush: '#e7a3ad',
    accents: ['#79a25a', '#e7a3ad', '#dc8f3c', '#b4552f'], inks: ['#79a25a', '#dc8f3c'], finish: 'riso',
  },
  /** Journeys and letting go: river-grey stock, slate ink and a clear water blue. */
  tide: {
    paper: '#eceee9', paperBand: null, ink: '#28313a', night: '#18202a', chalk: '#eceee9', chalkDim: '#8e98a0', guide: 'rgba(40,49,58,.3)',
    fills: ['#8fb3cc', '#c9d8df', '#5b87a8', '#f7f6f1'], shade: '#28313a', light: '#fbfbf8', blush: '#d9a48a',
    accents: ['#3f78a8', '#8fb3cc', '#d9a48a', '#7f8c95'], inks: ['#3f78a8', '#8fb3cc'], finish: 'riso',
  },
  /** Hope in the dark: warm soot, candle chalk, flame amber and a low ember red. */
  ember: {
    paper: '#16120f', paperBand: null, ink: '#eadcc3', night: '#16120f', chalk: '#eadcc3', chalkDim: '#7e7061', guide: 'rgba(234,220,195,.3)',
    fills: ['#2a211b', '#3a2d23', '#0e0b09', '#4a3828'], shade: '#0b0907', light: '#fff3d6', blush: '#f3a948',
    accents: ['#f3a948', '#ffe2a6', '#c9502d', '#7e7061'], inks: ['#f3a948', '#c9502d'], finish: 'riso',
  },
  /** Wonder: evening paper turning to an indigo night, with star gold. */
  dusk: {
    paper: '#ebe4d6', paperBand: null, ink: '#2f3040', night: '#1a2141', chalk: '#e9e6f0', chalkDim: '#8088a8', guide: 'rgba(47,48,64,.3)',
    fills: ['#e6b98f', '#b6a6c4', '#5c6591', '#262e57'], shade: '#1a2141', light: '#fff8e2', blush: '#e6b98f',
    accents: ['#f3d27a', '#fff1c2', '#b6a6c4', '#e6b98f'], inks: ['#f3d27a', '#b6a6c4'], finish: 'screen',
  },
} satisfies Record<string, Palette>;

export type MoodName = keyof typeof MOODS;
