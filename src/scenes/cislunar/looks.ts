/**
 * The ten visual styles, as the Earth and Moon view wears them: each on its solar plan's own paper (the same stock,
 * seed and grain, so switching views keeps the sheet) with that plan's inks and a hand to match: blueprint chalk line,
 * woodblock's flat colour and key block, sumi's brush, etching's hatched night, riso's off-register overprint,
 * stipple's dots, pastel's bloom on black, cut paper's shadowed sheets, Bauhaus's heavy primaries and deco's gold.
 */
import { SOLAR } from '../solar/palettes';
import type { Look } from './draw';

const P = SOLAR;

export const LOOKS: readonly Look[] = [
  {
    key: 'blueprint', paper: P.blueprint.paper, ground: { seed: 1100, texture: 1.4, vignette: 0.45, vignetteColor: '#06182c' },
    hand: 'pen', line: P.blueprint.ink, faint: P.blueprint.accents[1]!, accent: P.blueprint.accents[0]!, accent2: '#bcd6f2',
    band: '#eaf2fb', bandAlpha: 0.1, ocean: '#2b66a3', land: '#8fb3d9', night: '#0b2744', nightAlpha: 0.6,
    trail: '#f3d67a', moon: '#dfe9f5', mare: '#9dbbdc', rim: '#ffffff', width: 1.5,
  },
  {
    key: 'woodblock', paper: P.woodblock.paper, ground: { seed: 1200, texture: 1.3 },
    hand: 'print', line: P.woodblock.ink, faint: '#9a9a8e', accent: '#c8452f', accent2: '#1d3a63',
    band: '#9cc3b8', bandAlpha: 0.55, ocean: '#3f6690', land: '#5d7a4a', night: '#1d3a63', nightAlpha: 0.55,
    trail: '#1d3a63', moon: '#b7c8cf', mare: '#3f6690', rim: '#e9b25f', width: 1.9,
    tooth: { seed: 1293, density: 25, size: 1.3, alpha: 0.3 },
  },
  {
    key: 'sumi', paper: P.sumi.paper, ground: { seed: 1300, texture: 1.5, vignette: 0.12, vignetteColor: '#6b5a3a' },
    hand: 'brush', line: P.sumi.ink, faint: '#8d8a83', accent: '#b3342a', accent2: '#5c5a55',
    band: '#8d8a83', bandAlpha: 0.22, ocean: '#b9b4a8', land: '#5c5a55', night: '#141311', nightAlpha: 0.45,
    trail: '#141311', moon: '#f6f1e6', mare: '#b9b4a8', rim: '#141311', width: 1.8,
  },
  {
    key: 'etching', paper: P.etching.paper, ground: { seed: 1400, texture: 0.9 },
    hand: 'pen', line: P.etching.ink, faint: '#8a7a64', accent: '#5a3620', accent2: '#1e2733',
    band: '#cdbd9b', bandAlpha: 0.45, ocean: '#e6dac0', land: '#8a5a34', night: '#1e2733', nightAlpha: 0.85,
    trail: '#1e2733', moon: '#f6efe0', mare: '#cdbd9b', rim: '#5a3620', width: 1.1, hatch: true,
  },
  {
    key: 'riso', paper: P.riso.paper, ground: { seed: 1500, texture: 0.8 },
    hand: 'print', line: '#0078bf', faint: '#ff48b0', accent: '#ff48b0', accent2: '#0078bf',
    band: '#ffe800', bandAlpha: 0.55, ocean: '#0078bf', land: '#ff48b0', night: '#0078bf', nightAlpha: 0.45,
    trail: '#0078bf', moon: '#ffe800', mare: '#ff48b0', rim: '#ffe800', width: 1.8, misregister: [2.2, -1.6],
  },
  {
    key: 'stipple', paper: P.stipple.paper, ground: { seed: 1600, texture: 1.1 },
    hand: 'dots', line: P.stipple.ink, faint: '#6f6a62', accent: '#c2694b', accent2: '#221f1c',
    band: '#d9a47c', bandAlpha: 0.18, ocean: '#b8b2a6', land: '#6f6a62', night: '#221f1c', nightAlpha: 0.5,
    trail: '#221f1c', moon: '#f4f0e8', mare: '#b8b2a6', rim: '#c2694b', width: 1.3,
  },
  {
    key: 'pastel', paper: P.pastel.paper, ground: { seed: 1700, texture: 1.7, vignette: 0.55 },
    hand: 'chalk', line: '#b6aec6', faint: '#8a8499', accent: '#f08aa2', accent2: '#8ce6ee',
    band: '#6f8dff', bandAlpha: 0.16, ocean: '#6f8dff', land: '#6fd896', night: '#0b0c0f', nightAlpha: 0.84,
    trail: '#f6ecd0', moon: '#f6ecd0', mare: '#b6aec6', rim: '#f6ecd0', width: 1.6, bloom: true,
    tooth: { seed: 1704, density: 90, size: 1.2, alpha: 0.4 },
  },
  {
    key: 'cut-paper', paper: P.cutPaper.paper, ground: { seed: 1800, texture: 1.2, vignette: 0.35 },
    hand: 'cut', line: '#5676b9', faint: '#405ca2', accent: '#f2b631', accent2: '#9fd8d0',
    band: '#2f4585', bandAlpha: 1, ocean: '#3f86d6', land: '#58a55c', night: '#0c1022', nightAlpha: 0.55,
    trail: '#f1dfb8', moon: '#f1dfb8', mare: '#a9a6a0', rim: '#fbe08a', width: 1.8, shadow: 'rgba(4,6,14,0.7)',
  },
  {
    key: 'bauhaus', paper: P.bauhaus.paper, ground: { seed: 1900, texture: 0.9 },
    hand: 'bold', line: P.bauhaus.ink, faint: '#8d877b', accent: '#d23c2a', accent2: '#2a57a5',
    band: '#f0b429', bandAlpha: 0.35, ocean: '#2a57a5', land: '#f0b429', night: '#1b1b1b', nightAlpha: 0.55,
    trail: '#1b1b1b', moon: '#f0b429', mare: '#d8951c', rim: '#d23c2a', width: 1.5,
  },
  {
    key: 'deco', paper: P.deco.paper, ground: { seed: 2000, texture: 0.7, vignette: 0.5 },
    hand: 'pen', line: '#d6b25e', faint: '#8a7440', accent: '#f3e2ae', accent2: '#4f9a93',
    band: '#1c4a4a', bandAlpha: 0.6, ocean: '#1c4a4a', land: '#d6b25e', night: '#070708', nightAlpha: 0.6,
    trail: '#d6b25e', moon: '#efe4c8', mare: '#b09a66', rim: '#f3e2ae', width: 1.2,
    tooth: { seed: 2002, density: 30, size: 1, alpha: 0.18 },
  },
];
