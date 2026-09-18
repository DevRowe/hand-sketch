/**
 * Scenes and sequences: the storyboard model.
 *
 * A Scene is a self-contained deterministic mini-timeline: `draw` is a pure function of the scene's local
 * time, with its own duration and an optional loop section for idle use. A Sequence is an ordered list of
 * scenes with a transition into each one. Longer content = add, reorder or retime scenes.
 *
 * All timing is integer drawn frames, so cuts and loop seams always land on the frame grid and the same
 * global frame index always produces the same pixels.
 */
import type { Ctx, Stage } from './stage';

export interface Timing {
  /** Drawn frames per second (12 = "on twos"). */
  fps: number;
  /** Output frames per second; each drawn frame is held for outputFps / fps output frames. */
  outputFps: number;
}

export const ON_TWOS: Timing = { fps: 12, outputFps: 24 };
export const ON_ONES: Timing = { fps: 24, outputFps: 24 };

export interface RenderSettings {
  /** 'engine' = the variable-width stroke engine; 'legacy' = the reviewed skill's constant-width wob + dash reveal, for comparison. */
  strokeMode: 'engine' | 'legacy';
}

export const DEFAULT_SETTINGS: RenderSettings = { strokeMode: 'engine' };

export interface SceneFrame {
  readonly ctx: Ctx;
  readonly stage: Stage;
  /** Local time in seconds, quantised to the drawn-frame grid. */
  readonly t: number;
  /** Local drawn-frame index. */
  readonly frame: number;
  readonly fps: number;
  readonly duration: number;
  /** 0..1 position inside the loop section (seamless at the wrap), or null before it / without one. */
  readonly loopPhase: number | null;
  /** Local drawn frame where the loop section starts, or null without one. */
  readonly loopFromFrame: number | null;
  /** Drawn frames in one loop period (0 without a loop section). */
  readonly loopFrames: number;
  readonly settings: RenderSettings;
}

export interface Scene {
  readonly name: string;
  /** Seconds. */
  readonly duration: number;
  /**
   * Start of the idle loop section in seconds. In loop mode the scene plays once, then repeats
   * [loopFrom, duration). Motion inside it should be periodic in `loopPhase`. Defaults to 0.
   */
  readonly loopFrom?: number;
  /**
   * Seconds: the resting frame that carries the whole idea when the scene cannot move (web poster,
   * reduced motion, no-JS). Exported by `scripts/render.mjs --web`. Defaults to the last intro frame.
   */
  readonly poster?: number;
  draw(f: SceneFrame): void;
}

export type Transition =
  | { readonly kind: 'cut' }
  | {
      readonly kind: 'blot';
      /** Seconds; overlaps the start of the incoming scene while the outgoing one holds its last frame. */
      readonly duration: number;
      readonly seed: number;
      /** Blot centre as fractions of the frame. */
      readonly center?: readonly [number, number];
      /** Bristle colour at the blot's edge. */
      readonly fringe?: string;
    };

export interface SequenceEntry {
  readonly scene: Scene;
  /** Transition into this scene from the previous one; ignored for the first entry. Defaults to a cut. */
  readonly transition?: Transition;
}

export interface Sequence {
  readonly name: string;
  readonly entries: readonly SequenceEntry[];
  /** Seconds into the sequence of its resting frame (poster, reduced motion). Defaults to the last frame. */
  readonly poster?: number;
}

export type Program =
  | { readonly kind: 'sequence'; readonly sequence: Sequence }
  | { readonly kind: 'loop'; readonly scene: Scene };

export const toFrames = (seconds: number, fps: number): number => Math.max(0, Math.round(seconds * fps));

/** Frame count of one pass: a sequence end to end, or a looped scene's intro plus one loop period. */
export function programFrames(p: Program, timing: Timing): number {
  if (p.kind === 'loop') return toFrames(p.scene.duration, timing.fps);
  return p.sequence.entries.reduce((n, e) => n + toFrames(e.scene.duration, timing.fps), 0);
}

/** Local frame of a looped scene at global frame `i`. */
export function loopLocalFrame(scene: Scene, i: number, fps: number): number {
  const dur = toFrames(scene.duration, fps), from = Math.min(toFrames(scene.loopFrom ?? 0, fps), dur - 1);
  if (i < dur) return Math.max(0, i);
  return from + ((i - from) % (dur - from));
}

export interface ResolvedFrame {
  entry: number;
  scene: Scene;
  localFrame: number;
  /** Present while a transition into `scene` is running. */
  transition?: { kind: Exclude<Transition, { kind: 'cut' }>; progress: number; from: Scene; fromFrame: number };
}

/** Which scene (and transition) is on screen at global frame `i` of a sequence. Frames past the end hold the last frame. */
export function resolveSequence(seq: Sequence, i: number, fps: number): ResolvedFrame {
  if (seq.entries.length === 0) throw new Error(`sequence "${seq.name}" has no scenes`);
  let start = 0;
  for (let k = 0; k < seq.entries.length; k++) {
    const entry = seq.entries[k]!, len = toFrames(entry.scene.duration, fps);
    const last = k === seq.entries.length - 1;
    if (i < start + len || last) {
      const localFrame = Math.min(Math.max(0, i - start), Math.max(0, len - 1));
      const resolved: ResolvedFrame = { entry: k, scene: entry.scene, localFrame };
      const tr = entry.transition;
      if (k > 0 && tr && tr.kind !== 'cut') {
        const trFrames = Math.max(1, toFrames(tr.duration, fps));
        if (localFrame < trFrames) {
          const prev = seq.entries[k - 1]!.scene;
          resolved.transition = { kind: tr, progress: localFrame / trFrames, from: prev, fromFrame: Math.max(0, toFrames(prev.duration, fps) - 1) };
        }
      }
      return resolved;
    }
    start += len;
  }
  throw new Error('unreachable');
}

export function sceneFrame(ctx: Ctx, stage: Stage, scene: Scene, localFrame: number, timing: Timing, settings: RenderSettings): SceneFrame {
  const fps = timing.fps, dur = toFrames(scene.duration, fps);
  const from = scene.loopFrom === undefined ? null : toFrames(scene.loopFrom, fps);
  const loops = from !== null && dur > from;
  const loopPhase = !loops || localFrame < from ? null : (localFrame - from) / (dur - from);
  return { ctx, stage, t: localFrame / fps, frame: localFrame, fps, duration: scene.duration, loopPhase, loopFromFrame: loops ? from : null, loopFrames: loops ? dur - from : 0, settings };
}

/**
 * Draw one scene frame onto `ctx` with a clean logical transform before and after. `inputs` join the frame for a
 * driven scene (the live explorer hands the solar scenes its sky this way); renders pass none, so every frame stays a
 * pure function of local time.
 */
export function drawScene(ctx: Ctx, stage: Stage, scene: Scene, localFrame: number, timing: Timing, settings: RenderSettings, inputs?: Readonly<Record<string, unknown>>): void {
  stage.reset(ctx);
  ctx.save();
  const f = sceneFrame(ctx, stage, scene, localFrame, timing, settings);
  scene.draw(inputs ? { ...f, ...inputs } : f);
  ctx.restore();
  stage.reset(ctx);
}

/**
 * The two local frames that must look identical for a loop to be seamless: `loopFrom` (phase 0) and
 * `duration` (phase 1, never shown in playback because it wraps). Draw both and compare pixels.
 */
export function seamFrames(scene: Scene, fps: number): { from: number; end: number } | null {
  if (scene.loopFrom === undefined) return null;
  const dur = toFrames(scene.duration, fps), from = toFrames(scene.loopFrom, fps);
  return dur > from ? { from, end: dur } : null;
}

/** Local drawn frame of a scene's poster: its `poster` time, or the last frame before the loop section. */
export function posterFrame(scene: Scene, fps: number): number {
  const dur = toFrames(scene.duration, fps);
  if (scene.poster !== undefined) return Math.min(dur - 1, toFrames(scene.poster, fps));
  return Math.max(0, Math.min(dur, toFrames(scene.loopFrom ?? scene.duration, fps)) - 1);
}
