/**
 * The ten visual styles the explorer can draw in, each a pair of scenes (from above, "One Sky"; in motion, "One Wake")
 * with its catalogue words and a swatch from its palette.
 */
import type { Scene } from '../core/scene';
import { SOLAR_CATALOG, solarScenes } from '../scenes/solar';
import { spiralScenes } from '../scenes/solar-spiral';
import { SOLAR } from '../scenes/solar/palettes';
import type { ViewId } from './bodies';

export interface Style {
  /** URL key: "blueprint", "cut-paper". */
  key: string;
  title: string;
  theme: string;
  line: string;
  /** Paper, ink and an accent, for the style's chip. */
  swatch: readonly [string, string, string];
  scenes: Readonly<Record<ViewId, Scene>>;
}

const paletteKey = (key: string): keyof typeof SOLAR => key.replace(/-(\w)/g, (_, c: string) => c.toUpperCase()) as keyof typeof SOLAR;

export const STYLES: readonly Style[] = SOLAR_CATALOG.map(e => {
  const key = e.scene.replace(/^solar-/, ''), pal = SOLAR[paletteKey(key)];
  const sky = solarScenes[e.scene], wake = spiralScenes[`spiral-${key}`];
  if (!sky || !wake) throw new Error(`style ${key} lacks a scene`);
  return { key, title: e.title, theme: e.theme, line: e.line, swatch: [pal.paper, pal.ink, pal.accents[0] ?? pal.ink], scenes: { sky, wake } };
});

export const styleByKey = (key: string): Style | undefined => STYLES.find(s => s.key === key);
