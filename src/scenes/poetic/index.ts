/**
 * The poetic set: ten looped scenes, each one feeling with one turn, and their catalogue (title, line, format,
 * poster policy, alt text) for delivery. In catalogue order they read as a life: wonder, growing up, leaving, love,
 * the turning years, storms, breaking and mending, loss, solitude, hope.
 */
import type { Scene } from '../../core/scene';
import catalogJson from './catalog.json';
import { wishesScene } from './p01-wishes';
import { doorframeScene } from './p02-doorframe';
import { paperBoatScene } from './p03-paper-boat';
import { redThreadScene } from './p04-red-thread';
import { everySpringScene } from './p05-every-spring';
import { lighthouseScene } from './p06-lighthouse';
import { kintsugiScene } from './p07-kintsugi';
import { twoCupsScene } from './p08-two-cups';
import { fiftyTwoHertzScene } from './p09-52-hertz';
import { smallLightScene } from './p10-small-light';

export interface PoeticEntry {
  id: string;
  /** Scene name; the program id is `loop:<scene>`. */
  scene: string;
  title: string;
  /** The poetic line shown with the piece. */
  line: string;
  theme: string;
  /** Only the hero autoplays on the board; every other piece is a poster that plays on tap. */
  autoplay: boolean;
  /** Delivery format. */
  ar: string;
  width: number;
  /** The one emotional turn of the intro. */
  arc: string;
  /** What the seamless loop section is. */
  loop: string;
  /** Which frame the poster rests on, and why. */
  poster: string;
  alt: string;
}

export const POETIC_CATALOG: readonly PoeticEntry[] = catalogJson;

export const poeticScenes: Record<string, Scene> = Object.fromEntries([
  wishesScene,
  doorframeScene,
  paperBoatScene,
  redThreadScene,
  everySpringScene,
  lighthouseScene,
  kintsugiScene,
  twoCupsScene,
  fiftyTwoHertzScene,
  smallLightScene,
].map(s => [s.name, s]));
