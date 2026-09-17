/**
 * Interactive preview and offline-render hooks.
 * Query string: program=sequence|scene:<name>|loop:<name>, ar=16:9, w=<output px>, strokes=engine|legacy,
 * twos=1|0, frame=<n> (hold a frame), bare=1 (canvas only, used by scripts/render.mjs).
 */
import type { DrawnFrameInfo } from '../core/program';
import { ON_ONES, ON_TWOS, type RenderSettings } from '../core/scene';
import { parseAspect } from '../core/stage';
import { Player } from '../runtime/player';
import { PROGRAM_IDS, programById } from '../scenes/demo';

declare global {
  interface Window {
    __handSketch?: {
      ready: boolean;
      frames: number;
      fps: number;
      outputFps: number;
      size: { outW: number; outH: number; w: number; h: number; scale: number };
      frame(i: number): string;
      info(i: number): string;
    };
  }
}

const q = new URLSearchParams(location.search);
const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing #${id}`);
  return el as T;
};

const canvas = $<HTMLCanvasElement>('canvas');
const ui = {
  play: $<HTMLButtonElement>('play'),
  scrub: $<HTMLInputElement>('scrub'),
  readout: $<HTMLSpanElement>('readout'),
  program: $<HTMLSelectElement>('program'),
  strokes: $<HTMLSelectElement>('strokes'),
  ar: $<HTMLSelectElement>('ar'),
  twos: $<HTMLInputElement>('twos'),
};

for (const id of PROGRAM_IDS) ui.program.add(new Option(id, id));
// same trap as the aspect below: an id without a matching <option> would empty the select, so resolve it first
const programId = q.get('program') ?? 'sequence';
programById(programId);
ui.program.value = programId;
ui.strokes.value = q.get('strokes') === 'legacy' ? 'legacy' : 'engine';
// read the aspect from the query string itself: assigning a value with no matching <option> empties the
// select, which used to fall back to a square frame without a word (`--ar 4:3` rendered 1:1)
const ar = q.get('ar') ?? '16:9';
parseAspect(ar);
if (![...ui.ar.options].some(o => o.value === ar)) ui.ar.add(new Option(ar, ar));
ui.ar.value = ar;
ui.twos.checked = q.get('twos') !== '0';
const bare = q.has('bare');
if (bare) document.body.classList.add('bare');

function build(): Player {
  const width = Number(q.get('w')) || undefined;
  const settings: RenderSettings = { strokeMode: ui.strokes.value === 'legacy' ? 'legacy' : 'engine' };
  return new Player(canvas, {
    program: programById(ui.program.value),
    format: width ? { ar: ui.ar.value, width } : { ar: ui.ar.value },
    timing: ui.twos.checked ? ON_TWOS : ON_ONES,
    settings,
  });
}

let player = build();
let playing = !q.has('frame') && !bare;
let startedAt = performance.now();
let offset = Number(q.get('frame')) || 0;

function label(i: number, info: DrawnFrameInfo): string {
  const t = (i / player.config.timing.fps).toFixed(2);
  return `${String(i).padStart(4, '0')}  ${t}s  ${info.scene}@${info.localFrame}${info.transition ? `  ${info.transition}` : ''}`;
}

function show(i: number): void {
  const info = player.draw(i);
  if (!info) return;
  ui.scrub.value = String(Math.min(i, Number(ui.scrub.max)));
  ui.readout.textContent = label(i, info);
}

function scrubFrames(): number {
  // a looped scene plays its intro and then repeats: let the scrubber reach two extra loop periods
  const p = player.config.program;
  if (p.kind !== 'loop') return player.frames;
  const fps = player.config.timing.fps, from = Math.round((p.scene.loopFrom ?? 0) * fps);
  return player.frames + 2 * (player.frames - from);
}

function reset(keepTime = true): void {
  const t = keepTime ? Number(ui.scrub.value) / player.config.timing.fps : 0;
  player = build();
  ui.scrub.max = String(scrubFrames() - 1);
  offset = Math.min(Math.round(t * player.config.timing.fps), scrubFrames() - 1);
  startedAt = performance.now();
  show(offset);
}

function tick(): void {
  if (playing) {
    const fps = player.config.timing.fps;
    let i = offset + Math.floor(((performance.now() - startedAt) / 1000) * fps);
    if (player.config.program.kind === 'sequence') i %= player.frames;
    show(i);
  }
  requestAnimationFrame(tick);
}

ui.play.textContent = playing ? 'Pause' : 'Play';
ui.play.addEventListener('click', () => {
  playing = !playing;
  ui.play.textContent = playing ? 'Pause' : 'Play';
  offset = Number(ui.scrub.value);
  startedAt = performance.now();
});
ui.scrub.addEventListener('input', () => {
  playing = false;
  ui.play.textContent = 'Play';
  show(Number(ui.scrub.value));
});
for (const el of [ui.program, ui.strokes, ui.ar, ui.twos]) el.addEventListener('change', () => reset(el !== ui.program));

ui.scrub.max = String(scrubFrames() - 1);
show(offset);
requestAnimationFrame(tick);

window.__handSketch = {
  ready: true,
  get frames() { return player.frames; },
  get fps() { return player.config.timing.fps; },
  get outputFps() { return player.config.timing.outputFps; },
  get size() { const s = player.stage; return { outW: s.outW, outH: s.outH, w: s.w, h: s.h, scale: s.scale }; },
  frame(i: number): string {
    player.draw(i, true);
    return canvas.toDataURL('image/png');
  },
  info(i: number): string {
    const info = player.draw(i, true);
    return info ? label(i, info) : '';
  },
};
