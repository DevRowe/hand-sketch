/** The programs: the vertical-slice scene, a two-scene storyboard joined by a drawn transition, and the Keystone set. */
import { PALETTES } from '../art/palette';
import type { Program, Scene, Sequence } from '../core/scene';
import { houseScene } from './house';
import { keystoneScenes } from './keystone';
import { nightScene } from './night';

export const demoSequence: Sequence = {
  name: 'day-to-night',
  entries: [
    { scene: houseScene },
    { scene: nightScene, transition: { kind: 'blot', duration: 1, seed: 4242, center: [0.42, 0.52], fringe: PALETTES.risoPop.night } },
  ],
};

export const scenes: Readonly<Record<string, Scene>> = { house: houseScene, night: nightScene, ...keystoneScenes };

/** Program ids accepted by the preview and the renderer: `sequence`, `scene:<name>` (one pass), `loop:<name>`. */
export function programById(id: string): Program {
  if (id === 'sequence') return { kind: 'sequence', sequence: demoSequence };
  const [kind, name] = id.split(':');
  const scene = name !== undefined && Object.hasOwn(scenes, name) ? scenes[name] : undefined;
  if (!scene) throw new Error(`unknown program "${id}"`);
  if (kind === 'loop') return { kind: 'loop', scene };
  if (kind === 'scene') return { kind: 'sequence', sequence: { name: id, entries: [{ scene }] } };
  throw new Error(`unknown program "${id}"`);
}

export const PROGRAM_IDS: readonly string[] = [
  'sequence', 'scene:house', 'scene:night', 'loop:house', 'loop:night',
  ...Object.keys(keystoneScenes).map(name => `loop:${name}`),
];
