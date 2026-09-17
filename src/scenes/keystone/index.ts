/** The Keystone Systems set: ten looped scenes and their catalogue (placement, format, alt text) for delivery. */
import type { Scene } from '../../core/scene';
import catalogJson from './catalog.json';
import { untangleScene } from './k01-untangle';
import { runsItselfScene } from './k02-runs-itself';
import { sortedScene } from './k03-sorted';
import { swivelChairScene } from './k04-swivel-chair';

export interface KeystoneEntry {
  id: string;
  /** Scene name; the program id is `loop:<scene>`. */
  scene: string;
  title: string;
  slot: string;
  /** Only the hero autoplays; every other animation is a poster that plays on tap. */
  autoplay: boolean;
  /** Primary delivery format. */
  ar: string;
  width: number;
  metaphor: string;
  placement: string;
  alt: string;
}

export const KEYSTONE_CATALOG: readonly KeystoneEntry[] = catalogJson;

export const keystoneScenes: Record<string, Scene> = Object.fromEntries([
  untangleScene,
  runsItselfScene,
  sortedScene,
  swivelChairScene,
].map(s => [s.name, s]));
