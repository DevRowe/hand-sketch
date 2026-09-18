/** The programs: the vertical-slice scene, a two-scene storyboard joined by a drawn transition, the Keystone, poetic, gallery and solar sets, and the Requiem montage. */
import { PALETTES } from '../art/palette';
import type { Program, Scene, Sequence } from '../core/scene';
import { galleryScenes } from './gallery';
import { houseScene } from './house';
import { keystoneScenes } from './keystone';
import { nightScene } from './night';
import { poeticScenes } from './poetic';
import { requiemSequence } from './requiem';
import { solarScenes } from './solar';

export const demoSequence: Sequence = {
  name: 'day-to-night',
  entries: [
    { scene: houseScene },
    { scene: nightScene, transition: { kind: 'blot', duration: 1, seed: 4242, center: [0.42, 0.52], fringe: PALETTES.risoPop.night } },
  ],
};

export const scenes: Readonly<Record<string, Scene>> = { house: houseScene, night: nightScene, ...keystoneScenes, ...poeticScenes, ...galleryScenes, ...solarScenes };

export const sequences: Readonly<Record<string, Sequence>> = { requiem: requiemSequence };

/** Program ids accepted by the preview and the renderer: `sequence`, `sequence:<name>`, `scene:<name>` (one pass), `loop:<name>`. */
export function programById(id: string): Program {
  if (id === 'sequence') return { kind: 'sequence', sequence: demoSequence };
  const [kind, name] = id.split(':');
  if (kind === 'sequence' && name !== undefined && Object.hasOwn(sequences, name)) return { kind: 'sequence', sequence: sequences[name]! };
  const scene = name !== undefined && Object.hasOwn(scenes, name) ? scenes[name] : undefined;
  if (!scene) throw new Error(`unknown program "${id}"`);
  if (kind === 'loop') return { kind: 'loop', scene };
  if (kind === 'scene') return { kind: 'sequence', sequence: { name: id, entries: [{ scene }] } };
  throw new Error(`unknown program "${id}"`);
}

export const PROGRAM_IDS: readonly string[] = [
  'sequence', 'scene:house', 'scene:night', 'loop:house', 'loop:night',
  ...Object.keys(sequences).map(name => `sequence:${name}`),
  ...Object.keys(keystoneScenes).map(name => `loop:${name}`),
  ...Object.keys(poeticScenes).map(name => `loop:${name}`),
  ...Object.keys(galleryScenes).map(name => `loop:${name}`),
  ...Object.keys(solarScenes).map(name => `loop:${name}`),
];
