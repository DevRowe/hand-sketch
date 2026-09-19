/**
 * The Earth and Moon view, "One Neighbourhood": the Earth, its orbits and the Moon at one true scale (`common.ts`),
 * drawn in each of the ten visual styles (`looks.ts`) by one renderer (`draw.ts`). A live view of the explorer: a
 * frame carries the date and the lens; a render (no sky) draws a still of the Artemis II flyby.
 */
import type { Scene } from '../../core/scene';
import { cislunarScene } from './draw';
import { LOOKS } from './looks';

/** Scenes by style key ("pastel", "cut-paper"). */
export const cislunarScenes: Readonly<Record<string, Scene>> = Object.fromEntries(LOOKS.map(l => [l.key, cislunarScene(l)]));
