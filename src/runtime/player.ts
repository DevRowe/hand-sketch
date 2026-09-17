/**
 * A player binds a program, a format, timing and settings to one canvas, and draws frames on demand.
 * Both the interactive preview and the offline renderer hooks go through it.
 */
import { drawProgramFrame, type DrawnFrameInfo } from '../core/program';
import { programFrames, type Program, type RenderSettings, type Timing } from '../core/scene';
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
}
