import { describe, expect, it } from 'vitest';
import { ON_ONES, ON_TWOS, programFrames, resolveSequence, toFrames } from '../src/core/scene';
import { parseAspect } from '../src/core/stage';
import { programById, PROGRAM_IDS } from '../src/scenes/demo';
import { REQUIEM_CATALOG, requiemSequence } from '../src/scenes/requiem';
import { lettering } from '../src/scenes/requiem/etch';
import { CUT_FPS, snap } from '../src/scenes/requiem/montage';
import { REQUIEM } from '../src/scenes/requiem/palette';
import { STORYBOARD } from '../src/scenes/requiem/storyboard';

const C = REQUIEM_CATALOG;
const filmTimes = [...new Set([0, ...C.filmCuts, ...C.addedCuts])].sort((a, b) => a - b);

describe('requiem montage', () => {
  it('cuts exactly where the film does: its 91 detected cuts plus the ones the detector missed, in order', () => {
    expect(C.filmCuts).toHaveLength(91);
    for (const t of C.addedCuts) expect(C.filmCuts, `added cut ${t}`).not.toContain(t);
    expect(STORYBOARD.map(c => c.at)).toEqual(filmTimes);
    for (let k = 1; k < STORYBOARD.length; k++) expect(STORYBOARD[k]!.at).toBeGreaterThan(STORYBOARD[k - 1]!.at);
  });

  it('snaps every cut to the drawn-frame grid within half a frame of the film, without drift', () => {
    const visible = STORYBOARD.filter((c, k) => snap(c.at) < (k + 1 < STORYBOARD.length ? snap(STORYBOARD[k + 1]!.at) : snap(C.end)));
    expect(requiemSequence.entries).toHaveLength(visible.length);
    let start = 0;
    requiemSequence.entries.forEach((e, k) => {
      expect(start, e.scene.name).toBe(snap(visible[k]!.at));
      expect(Math.abs(start / CUT_FPS - visible[k]!.at), e.scene.name).toBeLessThanOrEqual(0.5 / CUT_FPS + 1e-9);
      expect(e.scene.name).toContain(visible[k]!.label);
      expect(e.transition, e.scene.name).toBeUndefined();
      start += toFrames(e.scene.duration, CUT_FPS);
    });
    expect(start).toBe(snap(C.end));
  });

  it('drops only cuts too short to be seen, and runs the film length on twos and on ones', () => {
    const snapped = filmTimes.map(snap), invisible = snapped.filter((f, k) => k + 1 < snapped.length && snapped[k + 1] === f).length;
    expect(requiemSequence.entries).toHaveLength(filmTimes.length - invisible);
    expect(invisible).toBeLessThanOrEqual(2);
    const program = programById('sequence:requiem');
    expect(programFrames(program, ON_TWOS)).toBe(snap(C.end));
    expect(programFrames(program, ON_ONES)).toBe(2 * snap(C.end));
    expect(programFrames(program, ON_TWOS) / ON_TWOS.fps).toBeCloseTo(47.75, 5);
    for (const e of requiemSequence.entries) expect(e.scene.duration * CUT_FPS, e.scene.name).toBeCloseTo(Math.round(e.scene.duration * CUT_FPS), 9);
  });

  it('keeps the montage cadence: most shots under half a second, none longer than the opening split screen', () => {
    const lengths = requiemSequence.entries.map(e => e.scene.duration);
    expect(Math.max(...lengths)).toBeCloseTo(lengths[0]!, 9);
    expect(lengths.filter(l => l <= 0.5 + 1e-9).length / lengths.length).toBeGreaterThan(0.75);
  });

  it('brings the recurring shots back: the eye five times, and the cell, the pill, the powder and the cap again and again', () => {
    const count = (label: string) => STORYBOARD.filter(c => c.label.includes(label)).length;
    expect(count('eye')).toBe(5);
    for (const label of ['cell', 'pill', 'powder', 'cap', 'barrel', 'lighter']) expect(count(label), label).toBeGreaterThanOrEqual(3);
  });

  it('is wired as a program with its poster inside the montage', () => {
    expect(PROGRAM_IDS).toContain('sequence:requiem');
    const program = programById('sequence:requiem');
    expect(program.kind).toBe('sequence');
    const poster = toFrames(C.poster, ON_TWOS.fps);
    expect(poster).toBeGreaterThan(0);
    expect(poster).toBeLessThan(programFrames(program, ON_TWOS));
    expect(resolveSequence(requiemSequence, poster, ON_TWOS.fps).scene.name).toContain('eye');
  });

  it('describes the piece in plain punctuation, with a format and alt text', () => {
    expect(parseAspect(C.ar)).toBeCloseTo(16 / 9, 9);
    expect(C.width % 2).toBe(0);
    expect(C.alt.startsWith('Sketch')).toBe(true);
    for (const text of [C.title, C.line, C.idea, C.rhythm, C.etching, C.alt]) {
      expect(text.length).toBeGreaterThan(4);
      expect(text).not.toMatch(/—/);
    }
  });
});

describe('requiem etching kit', () => {
  it('uses one black and two accents on bone paper', () => {
    for (const c of Object.values(REQUIEM)) expect(c).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('letters with the needle alphabet and refuses letters it does not have', () => {
    const strokes = lettering('VISUAL POWER', 0, 100, 50);
    expect(strokes.length).toBeGreaterThan(11);
    // between cap height and baseline, give or take a curve's overshoot
    for (const s of strokes) for (const [, y] of s) {
      expect(y).toBeGreaterThanOrEqual(50 - 2.5);
      expect(y).toBeLessThanOrEqual(100 + 2.5);
    }
    expect(() => lettering('Q', 0, 0, 10)).toThrow(/no glyph/);
  });
});
