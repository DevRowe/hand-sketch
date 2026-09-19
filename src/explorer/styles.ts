/**
 * The ten visual styles the explorer can draw in, each a set of scenes (from above, "One Sky"; in motion, "One Wake";
 * the Earth and Moon up close, "One Neighbourhood") with its catalogue words and a swatch from its palette.
 */
import type { Scene } from '../core/scene';
import { cislunarScenes } from '../scenes/cislunar';
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
  /** Among the costliest to draw live (layered ink plates): drawn to a smaller pixel budget on dense screens. */
  heavy: boolean;
}

/** The styles whose ink plates cost the most per frame. */
const HEAVY = new Set(['riso', 'sumi', 'pastel']);

const paletteKey = (key: string): keyof typeof SOLAR => key.replace(/-(\w)/g, (_, c: string) => c.toUpperCase()) as keyof typeof SOLAR;

export const STYLES: readonly Style[] = SOLAR_CATALOG.map(e => {
  const key = e.scene.replace(/^solar-/, ''), pal = SOLAR[paletteKey(key)];
  const sky = solarScenes[e.scene], wake = spiralScenes[`spiral-${key}`], earth = cislunarScenes[key];
  if (!sky || !wake || !earth) throw new Error(`style ${key} lacks a scene`);
  return { key, title: e.title, theme: e.theme, line: e.line, swatch: [pal.paper, pal.ink, pal.accents[0] ?? pal.ink], scenes: { sky, wake, earth }, heavy: HEAVY.has(key) };
});

export const styleByKey = (key: string): Style | undefined => STYLES.find(s => s.key === key);
