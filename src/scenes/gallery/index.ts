/**
 * The gallery set, "Many Hands": twenty looped pieces, each a different subject in a different visual language, and
 * their catalogue (title, line, theme, style, format, poster policy, alt text) for delivery. Most start whole and live
 * by motion; a few draw on where the drawing is the idea.
 */
import type { Scene } from '../../core/scene';
import catalogJson from './catalog.json';
import { rollingSeaScene } from './g01-rolling-sea';
import { bambooWindScene } from './g02-bamboo-wind';
import { orreryScene } from './g03-orrery';
import { nightCityScene } from './g04-night-city';
import { fiddleheadScene } from './g05-fiddlehead';

export interface GalleryEntry {
  id: string;
  /** Scene name; the program id is `loop:<scene>`. */
  scene: string;
  title: string;
  /** A short line shown with the piece. */
  line: string;
  theme: string;
  /** Visual treatment; the board groups pieces by it. */
  style: string;
  /** Only the hero autoplays on the board; every other piece is a poster that plays on tap. */
  autoplay: boolean;
  /** Delivery format. */
  ar: string;
  width: number;
  /** The idea, and whether it starts whole or draws on. */
  idea: string;
  /** What the seamless loop section is. */
  loop: string;
  /** Which frame the poster rests on, and why. */
  poster: string;
  alt: string;
}

export const GALLERY_CATALOG: readonly GalleryEntry[] = catalogJson;

export const galleryScenes: Record<string, Scene> = Object.fromEntries([
  rollingSeaScene,
  bambooWindScene,
  orreryScene,
  nightCityScene,
  fiddleheadScene,
].map(s => [s.name, s]));
