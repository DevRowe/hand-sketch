/**
 * P09 "52 Hertz" (solitude). Deep water, light from far above, marine snow drifting. A whale is drawn, gliding. It
 * sings: rings of song go out across the whole empty ocean, touching the drifting motes as they pass, and fade at the
 * edge of everything. Nothing answers. The loop is the listening silence, and then the song again, anyway.
 */
import { MOODS } from '../../art/moods';
import { catmullRom } from '../../core/geometry';
import { drawGroup, scheduleWithin, type Slot, type StrokeGroup } from '../../core/ink';
import { clamp, TAU, type Vec2 } from '../../core/math';
import { rng } from '../../core/random';
import type { Scene } from '../../core/scene';
import { drawStroke, prepareMorph, type PreparedStroke, type StrokeStyle } from '../../core/stroke';
import { clip } from '../../core/track';
import { breath, fillPoly, fit, group, nf, perSize, sec, stock } from './common';

const M = MOODS.deep;
const SONG = M.inks[0]!;
const LINE: StrokeStyle = { color: M.chalk, size: 4, thinning: 0.62, wobble: 1.5, wobbleWavelength: 200, tremor: 0.3, pressureVariation: 0.55, dryBrush: 0.3, paper: M.paper, taperStart: 30, taperEnd: 44 };
const RING: StrokeStyle = { color: SONG, size: 3.4, thinning: 0.5, wobble: 2.2, wobbleWavelength: 240, tremor: 0.3, pressureVariation: 0.6, dryBrush: 0.35, paper: M.paper, taperStart: 90, taperEnd: 90 };

/** Storyboard in drawn frames (12 fps). */
const F = { snow: [0, 36], whale: [12, 52], firstCall: 60 } as const;
const LOOP = 120;
/** A call is three rings, a beat apart; each crosses the ocean in RING_LIFE frames. */
const CALL = [0, 6, 12] as const, RING_LIFE = 84;
/**
 * The whale calls every LOOP frames from its first call on. The loop starts 36 frames before the second call, so the
 * rings of the call before are still fading out at the loop start exactly as the first call's were: seamless.
 */
const LOOP_FROM = F.firstCall + LOOP - 36;

const SNOUT: Vec2 = [300, 8];
const WHALE_AT: Vec2 = [660, 560];
/** The whale is drawn in its own units at this scale; its line keeps the set's weight. */
const WHALE_SCALE = 1.2;
const WHALE_LINE: StrokeStyle = { ...LINE, size: LINE.size / WHALE_SCALE, taperStart: 30 / WHALE_SCALE, taperEnd: 44 / WHALE_SCALE };

const TOP = catmullRom([[300, 8], [282, -30], [200, -60], [60, -72], [-80, -60], [-200, -32], [-272, -10], [-306, -2]], 8);
const BOTTOM = catmullRom([[300, 8], [272, 40], [180, 66], [40, 74], [-100, 52], [-222, 18], [-306, 6]], 8);
const FIN = catmullRom([[176, 56], [126, 112], [48, 166], [12, 174], [34, 140], [96, 90], [128, 64]], 6);
const MOUTH = catmullRom([[300, 10], [226, 22], [168, 16]], 5);
const GROOVES = [catmullRom([[270, 34], [190, 56], [120, 66]], 4), catmullRom([[248, 46], [180, 64], [118, 74]], 4)];
const EYE = catmullRom([[214, -4], [222, 2], [230, -2]], 3);
/** The flukes, up and down a little: morphed so the hand holds still while the tail breathes. */
const flukePose = (turn: number): Vec2[] => {
  const pts: Vec2[] = [[-304, 0], [-346, -34], [-392, -60], [-378, -20], [-346, 1], [-380, 24], [-400, 52], [-356, 30], [-304, 5]];
  const c = Math.cos(turn), s = Math.sin(turn);
  return catmullRom(pts.map(([x, y]): Vec2 => [-304 + (x + 304) * c - y * s, (x + 304) * s + y * c]), 6);
};

interface Layout {
  P(x: number, y: number): Vec2; s: number;
  whale: StrokeGroup; slots: Slot[]; body: Vec2[];
  fluke: (t: number) => PreparedStroke;
  rings: ((t: number) => PreparedStroke)[];
  snow: { x: number; y: number; r: number; phase: number; cycles: number; drift: number }[];
}

const layout = perSize((w, h): Layout => {
  const { P, s } = fit(w, h, 1920, 1080);
  const whale = group([TOP, BOTTOM, FIN, MOUTH, ...GROOVES, EYE], WHALE_LINE, 9001);
  const arc = (r: number): Vec2[] => Array.from({ length: 49 }, (_, k): Vec2 => {
    const a = -1.05 + (2.1 * k) / 48;
    return [Math.cos(a) * r, Math.sin(a) * r];
  });
  const rnd = rng(9100);
  return {
    P, s, whale, body: [...TOP, ...BOTTOM.slice().reverse()],
    slots: scheduleWithin(whale, 0, sec(F.whale[1] - F.whale[0]), 0.12),
    fluke: prepareMorph(flukePose(-0.1), flukePose(0.16), WHALE_LINE, 9002),
    rings: CALL.map((_, k) => prepareMorph(arc(26), arc(1500), RING, 9010 + k)),
    snow: Array.from({ length: 90 }, () => ({ x: rnd() * 1920, y: rnd() * 1080, r: 1.2 + rnd() * 2.4, phase: rnd(), cycles: 1 + Math.floor(rnd() * 2), drift: 20 + rnd() * 40 })),
  };
});

export const fiftyTwoHertzScene: Scene = {
  name: '52-hertz',
  duration: (LOOP_FROM + LOOP) / 12,
  loopFrom: LOOP_FROM / 12,
  poster: (LOOP_FROM + 36 + 30) / 12,
  draw(f) {
    const { ctx, stage } = f;
    const L = layout(stage.w, stage.h), n = nf(f), s = L.s;
    // the ocean's clock: the frame modulo the loop from the loop start, running through the intro too
    const m = (((n - LOOP_FROM) % LOOP) + LOOP) % LOOP;
    const phase = m / LOOP;
    stock(f, M.paper, { seed: 91, texture: 0.7, vignette: 0.55, vignetteColor: '#000000' });

    // light from far above: faint slanted shafts
    ctx.save();
    for (const [x0, wd, a] of [[520, 160, 0.05], [860, 90, 0.04], [1260, 220, 0.035]] as const) {
      const [tx, ty] = L.P(x0, -40), [bx, by] = L.P(x0 - 380, 1120);
      const g = ctx.createLinearGradient(tx, ty, bx, by);
      g.addColorStop(0, `rgba(214,230,225,${a})`);
      g.addColorStop(0.8, 'rgba(214,230,225,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(tx, ty); ctx.lineTo(tx + wd * s, ty); ctx.lineTo(bx + wd * 2.2 * s, by); ctx.lineTo(bx, by);
      ctx.fill();
    }
    ctx.restore();

    // song rings alive now: the intro's first call, then the loop's call (both on the ocean clock)
    const center = L.P(WHALE_AT[0] + (SNOUT[0] + 16) * WHALE_SCALE, WHALE_AT[1] + (SNOUT[1] - 10) * WHALE_SCALE);
    const bob = 10 * s * Math.sin(TAU * phase);
    const alive: { k: number; t: number }[] = [];
    for (let start = F.firstCall; start < n; start += LOOP) {
      CALL.forEach((d, k) => {
        const age = n - start - d;
        if (age > 0 && age < RING_LIFE) alive.push({ k, t: age / RING_LIFE });
      });
    }
    const ringR = (t: number) => (26 + 1474 * t) * s;

    // marine snow: motes drifting down in whole cycles per loop, glinting as a ring passes through them
    const snowIn = clip(n, F.snow[0], F.snow[1] - F.snow[0]);
    ctx.save();
    ctx.fillStyle = M.chalk;
    for (const p of L.snow) {
      const u = (phase * p.cycles + p.phase) % 1;
      const x = (p.x - u * p.drift) * s, y = (p.y + u * p.drift * 1.6) * s;
      let a = Math.sin(u * Math.PI) * 0.5;
      for (const r of alive) {
        const d = Math.abs(Math.hypot(x - center[0], y - center[1] - bob) - ringR(r.t));
        if (d < 26 * s && Math.abs(Math.atan2(y - center[1], x - center[0])) < 1.05) a += (1 - d / (26 * s)) * 0.6 * (1 - r.t);
      }
      ctx.globalAlpha = clamp(a, 0, 1) * snowIn;
      ctx.beginPath();
      ctx.arc(x, y, p.r * s, 0, TAU);
      ctx.fill();
    }
    ctx.restore();

    for (const r of alive) {
      ctx.save();
      ctx.translate(center[0], center[1] + bob);
      ctx.scale(s, s);
      ctx.globalAlpha *= Math.pow(1 - r.t, 1.4) * clamp(r.t * 30, 0, 1) * 0.9;
      drawStroke(ctx, L.rings[r.k]!(r.t), 1);
      ctx.restore();
    }

    // the whale, gliding in place: a slow rise and fall, its flukes breathing
    const [wx, wy] = L.P(...WHALE_AT);
    ctx.save();
    ctx.translate(wx, wy + bob);
    ctx.rotate(0.025 * Math.cos(TAU * phase));
    ctx.scale(s * WHALE_SCALE, s * WHALE_SCALE);
    const drawn = clip(n, F.whale[0], 30);
    fillPoly(ctx, L.body, M.fills[0]!, 0.75 * drawn);
    drawGroup({ ...f, ctx }, L.whale, L.slots, 0, f.t - sec(F.whale[0]));
    const flukeIn = clip(n, F.whale[1] - 10, 10);
    if (flukeIn > 0) drawStroke(ctx, L.fluke(breath(phase, 2)), flukeIn);
    ctx.restore();
  },
};
