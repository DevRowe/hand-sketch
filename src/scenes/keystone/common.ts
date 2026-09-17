/**
 * Shared pieces of the Keystone set: the colour roles and stroke presets, the paper and the accent plate, and the
 * set's timing. Every Keystone scene follows the same grammar: pencil = the manual process, key ink = the client's
 * tools, accent = the automation; the intro draws once by hand, then the loop section runs by itself.
 * Generic scene helpers (fit, layout caches, fills, drawn-frame clocks) live in `../kit`.
 */
import { drawPaper } from '../../art/paper';
import { plate, printPlate, type PrintOptions } from '../../art/print';
import { KEYSTONE_ROLES, roleStrokes } from '../../art/roles';
import type { SceneFrame } from '../../core/scene';
import { loopClock } from '../kit';

export { coverage, fillPoly, fit, group, nf, perSize, place, sec, withAlpha, type Fit } from '../kit';

export const R = KEYSTONE_ROLES;
export const S = roleStrokes(R);
/** A pulse or dash travelling on an accent line: a bold slug of the same line (same wobble, heavier pen). */
export const PULSE = { ...S.FLOW, size: 17, dryBrush: 0 };

/** Default Keystone timing: 7 s scene (84 drawn frames), loop section from 4 s (frame 48), 36-frame loop. */
export const DURATION = 7;
export const LOOP_FROM = 4;

export function paper(f: SceneFrame): void {
  drawPaper(f.ctx, f.stage, { color: R.stock, seed: 7, texture: 0.8 });
}

/** Paint coverage on the accent plate and print it as halftone dots in the accent ink (the one screen angle of the set). */
export function accentPlate(f: SceneFrame, key: string, paint: (g: CanvasRenderingContext2D) => void, o: Partial<PrintOptions> = {}): void {
  const p = plate(f.stage, `keystone:${key}`);
  paint(p.ctx);
  printPlate(f.ctx, f.stage, p.canvas, { ink: R.accent, cell: 7, angle: 0.26, seed: 3, alpha: 0.9, ...o });
}

/** Drawn frames of the loop section at 12 fps. */
export const LOOP = 36;

/** Frame inside the Keystone loop section in 12 fps drawn frames, [0, loop]; -1 in the intro (see `loopClock`). */
export const lf = (f: SceneFrame, loop = LOOP): number => loopClock(f, loop);
