/**
 * G16 "Four Beats" (music; Bauhaus). A painted score after Kandinsky, whole from the start: a big ringed circle, a red
 * triangle, a zigzag string, a row of coloured dots, a blue arc, a small chequerboard and a set of rings, loosely laid
 * across five staff lines. A red playhead crosses the score once per loop and every shape answers in its own way as
 * it is played: the triangle spins, the string rings, the dots jump in turn, the arc opens, the squares invert, the
 * rings spread. Under it all the big circle keeps the beat, four to a bar.
 *
 * Hits and beats are counted in whole drawn frames from the loop start, so every envelope is exact at the seam.
 */
import { clamp, lerp, TAU, type Vec2 } from '../../core/math';
import type { Scene } from '../../core/scene';
import { fit, ground, ink, nf, perSize, polyPath, still, wrap, type Fit } from './common';
import { GALLERY } from './palettes';

const PAL = GALLERY.score;
const [RED, YELLOW, BLUE, ROSE, VIOLET, GREEN] = PAL.fills as [string, string, string, string, string, string];
const BLACK = PAL.ink;
const W = 1920, H = 1080, LOOP = 192, BEAT = 12, START = 150, END = 1770;

const hitFrame = (x: number): number => Math.round(((x - START) / (END - START)) * LOOP);
/** Whole frames since the playhead crossed x, wrapped to the loop. */
const since = (n: number, x: number): number => wrap(n - hitFrame(x), LOOP);
/** A struck envelope: instant attack, exponential ring-down over `frames`. */
const struck = (age: number, frames: number): number => (age < frames ? Math.exp((-4 * age) / frames) : 0);
const easeOut = (t: number): number => 1 - Math.pow(1 - clamp(t, 0, 1), 3);

const layout = perSize((w, h): { F: Fit } => ({ F: fit(w, h, W, H) }));

export const fourBeatsScene: Scene = {
  name: 'four-beats',
  duration: LOOP / 12,
  loopFrom: 0,
  poster: 70 / 12,
  draw(f) {
    const { stage } = f;
    const { F } = layout(stage.w, stage.h), [ox, oy] = F.P(0, 0), s = F.s;
    // an unwrapped frame clock; the envelopes below do their own modulo
    const n = Math.round(nf(f));
    ground(f, PAL.paper, { seed: 1600, texture: 1 });

    // the staff and the static diagonals, printed once
    still(f, 'g16-staff', g => {
      const c = g.ctx;
      c.translate(ox, oy);
      c.scale(s, s);
      c.strokeStyle = BLACK;
      c.globalAlpha = 0.22;
      c.lineWidth = 2;
      for (let k = 0; k < 5; k++) { c.beginPath(); c.moveTo(90, 400 + k * 62); c.lineTo(1830, 392 + k * 62); c.stroke(); }
      c.globalAlpha = 1;
      c.lineWidth = 7;
      c.beginPath(); c.moveTo(250, 980); c.lineTo(980, 120); c.stroke();
      c.lineWidth = 3;
      c.beginPath(); c.moveTo(1080, 980); c.lineTo(1860, 150); c.stroke();
      c.beginPath(); c.moveTo(120, 200); c.lineTo(760, 330); c.stroke();
    });

    ink(f, 'g16-score', g => {
      const c = g.ctx;
      c.translate(ox, oy);
      c.scale(s, s);
      c.lineJoin = 'round';
      c.lineCap = 'round';

      // the beat: the big circle swells on every beat, harder on the downbeat
      const beatAge = n % BEAT, downbeat = Math.floor(n / BEAT) % 4 === 0;
      const kick = struck(beatAge, BEAT) * (downbeat ? 0.09 : 0.045);
      c.save();
      c.translate(360, 330);
      c.scale(1 + kick, 1 + kick);
      c.fillStyle = YELLOW;
      c.beginPath(); c.arc(0, 0, 170, 0, TAU); c.fill();
      c.strokeStyle = BLACK;
      c.lineWidth = 12;
      c.beginPath(); c.arc(0, 0, 176, 0, TAU); c.stroke();
      c.fillStyle = BLUE;
      c.beginPath(); c.arc(28, -18, 82, 0, TAU); c.fill();
      c.fillStyle = BLACK;
      c.beginPath(); c.arc(40, -26, 30, 0, TAU); c.fill();
      c.restore();

      // triangle: one full spin when played, resting exactly upright again
      const triT = easeOut(since(n, 760) / 18);
      c.save();
      c.translate(760, 650);
      c.rotate(triT >= 1 ? 0 : TAU * triT);
      c.fillStyle = RED;
      c.fill(polyPath([[0, -130], [115, 70], [-115, 70]]));
      c.restore();

      // zigzag string: rings when plucked
      const ring = struck(since(n, 1100), 40);
      c.strokeStyle = BLACK;
      c.lineWidth = 6;
      c.beginPath();
      for (let k = 0; k <= 12; k++) {
        const u = k / 12, x = lerp(990, 1320, u), zig = (k % 2 ? -1 : 1) * 38;
        const shake = ring * 26 * Math.sin(Math.PI * u) * Math.cos((since(n, 1100) * TAU) / 5);
        if (k === 0) c.moveTo(x, 520 + zig + shake); else c.lineTo(x, 520 + zig + shake);
      }
      c.stroke();

      // dots: each jumps as the playhead reaches it
      const dotColors = [BLUE, RED, YELLOW, BLACK, ROSE, BLUE, VIOLET];
      dotColors.forEach((col, k) => {
        const x = 1400 + k * 46, age = since(n, x), jump = age < 10 ? Math.sin((Math.PI * age) / 10) : 0;
        c.fillStyle = col;
        c.beginPath();
        c.arc(x, 300 - jump * 70, 17, 0, TAU);
        c.fill();
      });

      // blue arc: opens and closes like a mouth singing
      const open = struck(since(n, 1480), 30);
      c.save();
      c.translate(1480, 800);
      c.strokeStyle = BLUE;
      c.lineWidth = 34;
      c.lineCap = 'butt';
      c.beginPath();
      c.arc(0, 0, 120, Math.PI * (1 - 0.25 * open), TAU + Math.PI * 0.25 * open);
      c.stroke();
      c.restore();

      // chequerboard: squares invert, one wave across
      const checkAge = since(n, 520);
      for (let j = 0; j < 4; j++) {
        for (let i = 0; i < 4; i++) {
          const flipped = checkAge < 16 && checkAge >= i * 2 && checkAge < i * 2 + 8;
          c.fillStyle = ((i + j) % 2 === 0) !== flipped ? BLACK : PAL.paper;
          c.fillRect(470 + i * 38, 780 + j * 38, 38, 38);
        }
      }
      c.strokeStyle = BLACK;
      c.lineWidth = 3;
      c.strokeRect(470, 780, 152, 152);

      // rings spreading from a violet centre
      const rippleAge = since(n, 1690);
      c.fillStyle = VIOLET;
      c.beginPath(); c.arc(1690, 560, 36, 0, TAU); c.fill();
      for (let k = 0; k < 3; k++) {
        const r = 60 + k * 34 + (rippleAge < 36 ? easeOut(rippleAge / 36) * 40 : 0), a = rippleAge < 36 ? 1 - rippleAge / 48 : 0.75;
        c.strokeStyle = k === 1 ? ROSE : VIOLET;
        c.globalAlpha = a;
        c.lineWidth = 8 - k * 2;
        c.beginPath(); c.arc(1690, 560, r, 0, TAU); c.stroke();
      }
      c.globalAlpha = 1;

      // a green crescent and a small black square keep still, for balance
      c.fillStyle = GREEN;
      c.beginPath(); c.arc(1180, 230, 58, 0.6, 0.6 + Math.PI); c.fill();
      c.fillStyle = BLACK;
      c.save(); c.translate(900, 860); c.rotate(0.3); c.fillRect(-26, -26, 52, 52); c.restore();

      // the playhead and its marker; beat ticks along the bottom staff line
      const px = lerp(START, END, wrap(n, LOOP) / LOOP);
      c.strokeStyle = RED;
      c.lineWidth = 3;
      c.beginPath(); c.moveTo(px, 360); c.lineTo(px, 680); c.stroke();
      c.fillStyle = RED;
      c.fill(polyPath([[px - 14, 340], [px + 14, 340], [px, 364]] as Vec2[]));
      for (let b = 0; b < LOOP / BEAT; b++) {
        const bx = lerp(START, END, (b * BEAT) / LOOP), lit = struck(wrap(n - b * BEAT, LOOP), BEAT);
        c.fillStyle = b % 4 === 0 ? BLACK : lit > 0 ? RED : BLACK;
        c.globalAlpha = 0.35 + 0.65 * lit;
        c.fillRect(bx - 3, 666, 6, b % 4 === 0 ? 34 : 22);
      }
      c.globalAlpha = 1;
    }, { tooth: { seed: 1610, density: 22, size: 1.6, alpha: 0.25 } });
  },
};
