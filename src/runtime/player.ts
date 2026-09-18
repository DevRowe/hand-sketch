/**
 * A player binds a program, a format, timing and settings to one canvas, and draws frames on demand.
 * Both the interactive preview and the offline renderer hooks go through it.
 */
import { drawProgramFrame, type DrawnFrameInfo } from '../core/program';
import { drawScene, posterFrame, programFrames, seamFrames, toFrames, type Program, type RenderSettings, type Timing } from '../core/scene';
import { Stage, type Format } from '../core/stage';

export interface PlayerConfig {
  program: Program;
  format: Format;
  timing: Timing;
  settings: RenderSettings;
}

export class Player {
  readonly stage: Stage;
  readonly frames: number;
  private readonly ctx: CanvasRenderingContext2D;
  private last = -1;

  constructor(readonly canvas: HTMLCanvasElement, readonly config: PlayerConfig) {
    this.stage = new Stage(config.format);
    canvas.width = this.stage.outW;
    canvas.height = this.stage.outH;
    this.ctx = this.stage.context(canvas);
    this.frames = programFrames(config.program, config.timing);
  }

  get duration(): number { return this.frames / this.config.timing.fps; }

  /** Draw drawn-frame `i` (skips work when it is already on screen, unless forced). */
  draw(i: number, force = false): DrawnFrameInfo | null {
    if (i === this.last && !force) return null;
    this.last = i;
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    return drawProgramFrame(this.ctx, this.stage, this.config.program, i, this.config.timing, this.config.settings);
  }

  /** Drawn frame where a looped program's loop section starts (a web video seeks here on `ended`), or null. */
  get loopFrom(): number | null {
    const p = this.config.program;
    return p.kind === 'loop' && p.scene.loopFrom !== undefined ? toFrames(p.scene.loopFrom, this.config.timing.fps) : null;
  }

  /** Global drawn frame of the program's poster: the looped scene's resting frame, or the sequence's (default its last frame). */
  get poster(): number {
    const p = this.config.program;
    if (p.kind === 'loop') return posterFrame(p.scene, this.config.timing.fps);
    const at = p.sequence.poster;
    return at === undefined ? this.frames - 1 : Math.min(this.frames - 1, toFrames(at, this.config.timing.fps));
  }

  /**
   * Seam check for a looped program: draw local frame `loopFrom` (phase 0) and local frame `duration` (phase 1,
   * never shown in playback) and count differing pixels. A seamless loop gives 0.
   */
  seam(): { from: number; end: number; differing: number; maxDelta: number; box: [number, number, number, number] | null } | null {
    const p = this.config.program;
    if (p.kind !== 'loop') return null;
    const frames = seamFrames(p.scene, this.config.timing.fps);
    if (!frames) return null;
    const grab = (local: number): Uint8ClampedArray => {
      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      drawScene(this.ctx, this.stage, p.scene, local, this.config.timing, this.config.settings);
      return this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height).data;
    };
    const a = grab(frames.from), b = grab(frames.end);
    this.last = -1;
    let differing = 0, maxDelta = 0, x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
    const width = this.canvas.width;
    for (let k = 0; k < a.length; k += 4) {
      const d = Math.max(Math.abs(a[k]! - b[k]!), Math.abs(a[k + 1]! - b[k + 1]!), Math.abs(a[k + 2]! - b[k + 2]!), Math.abs(a[k + 3]! - b[k + 3]!));
      if (d > 0) {
        differing++;
        if (d > maxDelta) maxDelta = d;
        const x = (k / 4) % width, y = Math.floor(k / 4 / width);
        x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
      }
    }
    // where the seam breaks, in output pixels, so it can be found without diffing images by hand
    return { ...frames, differing, maxDelta, box: differing ? [x0, y0, x1 - x0 + 1, y1 - y0 + 1] : null };
  }
}
