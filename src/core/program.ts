/**
 * Draw any frame of a program (a sequence or a looped scene). Pure in (program, frame index, timing, settings, format).
 */
import { drawScene, loopLocalFrame, resolveSequence, type Program, type RenderSettings, type Timing } from './scene';
import type { Ctx, Stage } from './stage';
import { blotWipe } from './transitions';

export interface DrawnFrameInfo {
  scene: string;
  localFrame: number;
  transition: string | null;
}

export function drawProgramFrame(ctx: Ctx, stage: Stage, program: Program, i: number, timing: Timing, settings: RenderSettings): DrawnFrameInfo {
  if (program.kind === 'loop') {
    const local = loopLocalFrame(program.scene, i, timing.fps);
    drawScene(ctx, stage, program.scene, local, timing, settings);
    return { scene: program.scene.name, localFrame: local, transition: null };
  }
  const r = resolveSequence(program.sequence, i, timing.fps);
  if (!r.transition) {
    drawScene(ctx, stage, r.scene, r.localFrame, timing, settings);
    return { scene: r.scene.name, localFrame: r.localFrame, transition: null };
  }
  const tr = r.transition;
  const out = stage.layer('transition:out'), inn = stage.layer('transition:in');
  for (const layer of [out, inn]) {
    const g = stage.context(layer);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, layer.width, layer.height);
  }
  drawScene(stage.context(out), stage, tr.from, tr.fromFrame, timing, settings);
  drawScene(stage.context(inn), stage, r.scene, r.localFrame, timing, settings);
  stage.reset(ctx);
  blotWipe(ctx, stage, out, inn, tr.progress, { seed: tr.kind.seed, ...(tr.kind.center ? { center: tr.kind.center } : {}), ...(tr.kind.fringe ? { fringe: tr.kind.fringe } : {}) });
  stage.reset(ctx);
  return { scene: r.scene.name, localFrame: r.localFrame, transition: `${tr.kind.kind} ${Math.round(tr.progress * 100)}%` };
}
