/**
 * Stroke groups: a set of polylines drawn by one hand with one style, with cached preparation per boil step.
 * Scenes describe *what* to draw and *when*; this module picks the renderer (engine or legacy comparison).
 */
import { hashSeed } from './random';
import type { SceneFrame } from './scene';
import { drawStroke, drawStrokeRange, prepareStroke, scheduledProgress, strokeSchedule, type PreparedStroke, type StrokeStyle } from './stroke';
import { legacyStroke } from './legacy';
import type { Vec2 } from './math';

export interface StrokeGroup {
  readonly paths: readonly (readonly Vec2[])[];
  readonly style: StrokeStyle;
  readonly seed: number;
  /** Every path is a closed loop (periodic wobble, ranges wrap across the join). */
  readonly closed?: boolean;
}

export interface Slot { start: number; duration: number }

const cache = new WeakMap<StrokeGroup, Map<number, PreparedStroke[]>>();

/** Prepared strokes of a group for a boil step (0 = the canonical shape). Cached. */
export function prepared(group: StrokeGroup, boilStep = 0): PreparedStroke[] {
  let byStep = cache.get(group);
  if (!byStep) cache.set(group, (byStep = new Map()));
  let list = byStep.get(boilStep);
  if (!list) {
    list = group.paths.map((p, k) => prepareStroke(p, group.style, hashSeed(group.seed, k, boilStep), { closed: !!group.closed }));
    byStep.set(boilStep, list);
  }
  return list;
}

/** One-hand schedule for a group: strokes follow each other at `speed` logical units per second. */
export function schedule(group: StrokeGroup, start: number, speed: number, gap = 0.04): Slot[] {
  return strokeSchedule(prepared(group), start, speed, gap);
}

/** Schedule a group so it is drawn exactly within [start, end], pen speed constant across its strokes. */
export function scheduleWithin(group: StrokeGroup, start: number, end: number, gap = 0.03): Slot[] {
  const strokes = prepared(group), total = strokes.reduce((n, s) => n + s.length, 0);
  const window = Math.max(0, end - start), gaps = Math.max(0, strokes.length - 1);
  // pen lifts never take more than a third of the window, however many strokes there are
  const g = gaps > 0 ? Math.min(gap, window / 3 / gaps) : 0;
  const drawTime = window - g * gaps;
  return strokeSchedule(strokes, start, drawTime > 0 ? total / drawTime : Infinity, g);
}

/** End time of a schedule. */
export const scheduleEnd = (slots: readonly Slot[]): number => slots.reduce((m, s) => Math.max(m, s.start + s.duration), 0);

/**
 * Draw a group at the frame's time (or at `t`, e.g. a puppet's own clock). `slots` gives per-stroke timing;
 * `boilStep` re-seeds the wobble (use a small cycling number so the cache stays bounded).
 */
export function drawGroup(f: SceneFrame, group: StrokeGroup, slots: readonly Slot[], boilStep = 0, t = f.t): void {
  const strokes = prepared(group, boilStep);
  for (let k = 0; k < strokes.length; k++) {
    const slot = slots[k];
    const progress = slot ? scheduledProgress(slot, t) : 1;
    if (progress <= 0) continue;
    if (f.settings.strokeMode === 'legacy') {
      const s = group.style;
      legacyStroke(f.ctx, group.paths[k]!, progress, hashSeed(group.seed, k, boilStep), { color: s.color, width: Math.max(0.8, s.size * 0.55), alpha: s.alpha ?? 1 });
    } else {
      drawStroke(f.ctx, strokes[k]!, progress);
    }
  }
}

/**
 * Draw each stroke of a group between fractions `range(k)` = [from, to] of its length: un-draw a group
 * (`to` falling), erase it from the tail (`from` rising), or run dashes along it. Legacy mode can only
 * reveal prefixes, so it draws [0, to].
 */
export function drawGroupRange(f: SceneFrame, group: StrokeGroup, range: (k: number) => readonly [number, number], boilStep = 0): void {
  const strokes = prepared(group, boilStep);
  for (let k = 0; k < strokes.length; k++) {
    const [from, to] = range(k);
    if (to <= from) continue;
    if (f.settings.strokeMode === 'legacy') {
      const s = group.style;
      legacyStroke(f.ctx, group.paths[k]!, to, hashSeed(group.seed, k, boilStep), { color: s.color, width: Math.max(0.8, s.size * 0.55), alpha: s.alpha ?? 1 });
    } else if (from <= 0) {
      drawStroke(f.ctx, strokes[k]!, to);
    } else {
      drawStrokeRange(f.ctx, strokes[k]!, from, to);
    }
  }
}
