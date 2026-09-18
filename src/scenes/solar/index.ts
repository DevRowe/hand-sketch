/**
 * The solar set, "One Sky, Ten Hands": the same top-down solar system (`common.ts`) drawn in ten visual languages,
 * and its catalogue (title = the style, theme, line, format, poster policy, alt text) for delivery.
 */
import type { Scene } from '../../core/scene';
import catalogJson from './catalog.json';
import { blueprintScene } from './s01-blueprint';
import { woodblockScene } from './s02-woodblock';
import { sumiScene } from './s03-sumi';
import { etchingScene } from './s04-etching';
import { risoScene } from './s05-riso';
import { stippleScene } from './s06-stipple';
import { pastelScene } from './s07-pastel';
import { cutPaperScene } from './s08-cut-paper';
import { bauhausScene } from './s09-bauhaus';
import { decoScene } from './s10-deco';

export interface SolarEntry {
  id: string;
  /** Scene name; the program id is `loop:<scene>`. */
  scene: string;
  /** The visual style: every piece has the same subject, so the style is its title. */
  title: string;
  /** What the style makes of the subject. */
  theme: string;
  /** A short line shown with the piece. */
  line: string;
  /** Only the hero autoplays on the board; every other piece is a poster that plays on tap. */
  autoplay: boolean;
  /** Delivery format. */
  ar: string;
  width: number;
  /** Palette, mark-making and finish, and whether it starts whole or draws on. */
  idea: string;
  /** What the seamless loop section is. */
  loop: string;
  /** Which frame the poster rests on, and why. */
  poster: string;
  alt: string;
}

export const SOLAR_CATALOG: readonly SolarEntry[] = catalogJson;

export const solarScenes: Record<string, Scene> = Object.fromEntries([
  blueprintScene,
  woodblockScene,
  sumiScene,
  etchingScene,
  risoScene,
  stippleScene,
  pastelScene,
  cutPaperScene,
  bauhausScene,
  decoScene,
].map(s => [s.name, s]));
