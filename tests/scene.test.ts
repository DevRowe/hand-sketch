import { describe, expect, it } from 'vitest';
import { loopLocalFrame, ON_TWOS, programFrames, resolveSequence, sceneFrame, type Scene, type Sequence } from '../src/core/scene';
import { frameSize, type Stage } from '../src/core/stage';

const scene = (name: string, duration: number, loopFrom?: number): Scene => ({ name, duration, ...(loopFrom === undefined ? {} : { loopFrom }), draw: () => {} });
const a = scene('a', 2), b = scene('b', 1.5, 0.5);
const seq: Sequence = { name: 's', entries: [{ scene: a }, { scene: b, transition: { kind: 'blot', duration: 0.5, seed: 1 } }] };

describe('sequence', () => {
  it('sums scene frames', () => {
    expect(programFrames({ kind: 'sequence', sequence: seq }, ON_TWOS)).toBe(24 + 18);
  });

  it('maps global frames to scene-local frames with hard boundaries', () => {
    expect(resolveSequence(seq, 0, 12)).toMatchObject({ entry: 0, localFrame: 0 });
    expect(resolveSequence(seq, 23, 12)).toMatchObject({ entry: 0, localFrame: 23 });
    expect(resolveSequence(seq, 24, 12)).toMatchObject({ entry: 1, localFrame: 0 });
    expect(resolveSequence(seq, 999, 12)).toMatchObject({ entry: 1, localFrame: 17 });
  });

  it('runs the transition over the start of the incoming scene, holding the outgoing last frame', () => {
    const r = resolveSequence(seq, 27, 12);
    expect(r.transition).toMatchObject({ progress: 0.5, from: a, fromFrame: 23 });
    expect(resolveSequence(seq, 30, 12).transition).toBeUndefined();
    expect(resolveSequence(seq, 24, 12).transition?.progress).toBe(0);
  });

  it('treats a missing transition as a hard cut', () => {
    const cut: Sequence = { name: 'c', entries: [{ scene: a }, { scene: b }] };
    expect(resolveSequence(cut, 24, 12).transition).toBeUndefined();
  });
});

describe('loop mode', () => {
  it('plays the intro once, then repeats the loop section seamlessly', () => {
    // b: 18 frames, loop from frame 6 -> period 12
    expect(loopLocalFrame(b, 5, 12)).toBe(5);
    expect(loopLocalFrame(b, 17, 12)).toBe(17);
    expect(loopLocalFrame(b, 18, 12)).toBe(6);
    expect(loopLocalFrame(b, 18 + 12 * 40 + 3, 12)).toBe(9);
    expect(loopLocalFrame(a, 24, 12)).toBe(0);
  });

  it('reports loop phase only inside the loop section', () => {
    const stage = {} as Stage;
    expect(sceneFrame({} as CanvasRenderingContext2D, stage, b, 3, ON_TWOS, { strokeMode: 'engine' }).loopPhase).toBeNull();
    expect(sceneFrame({} as CanvasRenderingContext2D, stage, b, 12, ON_TWOS, { strokeMode: 'engine' }).loopPhase).toBe(0.5);
  });
});

describe('frameSize', () => {
  it('keeps the short side at 1080 logical units and output dimensions even', () => {
    expect(frameSize({ ar: '16:9' })).toMatchObject({ w: 1920, h: 1080, outW: 1920, outH: 1080 });
    expect(frameSize({ ar: '9:16', width: 721 })).toMatchObject({ w: 1080, h: 1920 });
    const s = frameSize({ ar: '4:3', width: 1001 });
    expect(s.outW % 2).toBe(0);
    expect(s.outH % 2).toBe(0);
  });
});
