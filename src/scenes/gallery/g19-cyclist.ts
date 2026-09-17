/**
 * G19 "Cyclist" (motion; continuous line). One black line of one weight on white, and one red sun. It draws on as a
 * single pen would, the hills, the road and the poles, then the bicycle in one unbroken stroke and its rider in
 * another; then the rider pushes off and the world starts to pass: far hills and clouds at half speed, bushes at three
 * quarters, poles and wires at full, the pedals and the wheels turning with the road.
 *
 * Speed ramps from rest into a steady 16 units a drawn frame (`rampToConstant`); in one loop the road moves exactly 1920
 * units, a whole number of periods of every layer, eight crank turns and twelve wheel turns, so the seam is exact.
 */
import { arcLengths, cutAtLength } from '../../core/geometry';
import { clamp, lerp, TAU, type Vec2 } from '../../core/math';
import type { Scene } from '../../core/scene';
import { rampToConstant } from '../../core/track';
import { fit, ground, nf, perSize, wrap, type Fit } from './common';
import { GALLERY } from './palettes';

const PAL = GALLERY.monoline;
const INK = PAL.ink, SUN = PAL.accents[0]!;
const W = 1920, H = 1080, ROAD = 880, LOOP = 120, START = 60, RAMP = 12, SPEED = 16, LOOP_FROM = START + RAMP;
const LINE = 3.6;

const layout = perSize((w, h): { F: Fit } => ({ F: fit(w, h, W, H) }));

/** Draw a polyline revealed up to fraction `t` of its length. */
function line(c: CanvasRenderingContext2D, pts: readonly Vec2[], t = 1): void {
  if (t <= 0 || pts.length < 2) return;
  const lengths = t >= 1 ? null : arcLengths(pts);
  const shown = lengths ? cutAtLength(pts, lengths, clamp(t, 0, 1) * (lengths.at(-1) ?? 0)) : pts;
  c.beginPath();
  shown.forEach(([x, y], k) => (k ? c.lineTo(x, y) : c.moveTo(x, y)));
  c.stroke();
}

/** A layer of the world scrolled by `shift`: sample x across the screen, read the periodic profile in world units. */
function profile(shift: number, fn: (worldX: number) => number, step = 12): Vec2[] {
  const pts: Vec2[] = [];
  for (let x = -40; x <= W + 40; x += step) pts.push([x, fn(x + shift)]);
  return pts;
}

/** A wheel as a pen draws one: a loop and a bit, spiralling in, starting wherever the wheel has turned to. */
function wheel(cx: number, cy: number, r: number, angle: number): Vec2[] {
  const pts: Vec2[] = [];
  for (let k = 0; k <= 80; k++) {
    const u = k / 64, a = angle + u * TAU, rr = r * (1 - 0.1 * u);
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  pts.push([cx, cy]);
  return pts;
}

/** Knee position for a hip and a pedal, bending forward. */
function knee(hip: Vec2, foot: Vec2, l1: number, l2: number): Vec2 {
  const dx = foot[0] - hip[0], dy = foot[1] - hip[1], d = clamp(Math.hypot(dx, dy), 1, l1 + l2 - 1);
  const a = Math.atan2(dy, dx), off = Math.acos(clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1));
  return [hip[0] + Math.cos(a - off) * l1, hip[1] + Math.sin(a - off) * l1];
}

export const cyclistScene: Scene = {
  name: 'cyclist',
  duration: (LOOP_FROM + LOOP) / 12,
  loopFrom: LOOP_FROM / 12,
  poster: (LOOP_FROM + 20) / 12,
  draw(f) {
    const { ctx, stage } = f;
    const { F } = layout(stage.w, stage.h), n = nf(f), [ox, oy] = F.P(0, 0), s = F.s;
    ground(f, PAL.paper, { seed: 1900, texture: 0.35 });
    const shift = rampToConstant(n, START, RAMP, SPEED);
    const drawn = (a: number, b: number) => clamp((n - a) / (b - a), 0, 1);
    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(s, s);

    // the sun, pressed on as a flat red disc once the line has found the horizon
    const sunIn = drawn(44, 52);
    if (sunIn > 0) {
      ctx.fillStyle = SUN;
      ctx.beginPath();
      ctx.arc(1480, 270, 120 * (0.2 + 0.8 * Math.sqrt(sunIn)), 0, TAU);
      ctx.fill();
    }
    ctx.strokeStyle = INK;
    ctx.lineWidth = LINE;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // far hills and a cloud at half speed (period 960)
    const far = shift * 0.5;
    line(ctx, profile(far, X => 790 + 34 * Math.sin((TAU * X) / 960) + 16 * Math.sin((TAU * X) / 480 + 1.3)), drawn(0, 18));
    const cloudX = wrap(260 - far, 960) - 300;
    for (const cx of [cloudX, cloudX + 960, cloudX + 1920]) {
      // a cloud in one line: a flat underside, three rounded humps back over the top
      const cloud: Vec2[] = [[cx, 250], [cx + 230, 250]];
      for (let k = 0; k <= 48; k++) {
        const u = k / 48, hump = Math.abs(Math.sin(u * Math.PI * 3)) * (26 + 22 * Math.sin(u * Math.PI));
        cloud.push([cx + 230 - u * 230, 250 - hump - 6 * Math.sin(u * Math.PI)]);
      }
      line(ctx, cloud, drawn(6, 20));
    }
    // bushes at three quarters (period 480)
    line(ctx, profile(shift * 0.75, X => {
      const u = wrap(X, 480);
      return ROAD - 14 - (u > 300 && u < 420 ? 46 * Math.sin((Math.PI * (u - 300)) / 120) + 14 * Math.abs(Math.sin((Math.PI * (u - 300)) / 30)) : 0);
    }, 6), drawn(10, 26));
    // the road
    line(ctx, profile(shift, X => ROAD + 26 + 2.5 * Math.sin((TAU * X) / 320) + 1.5 * Math.sin((TAU * X) / 80 + 0.7), 16), drawn(14, 26));
    // poles and a sagging wire at full speed (period 640), high above the rider
    const poleX = wrap(-shift, 640);
    const wires: Vec2[] = [];
    for (let px = poleX - 640; px < W + 640; px += 640) {
      line(ctx, [[px, ROAD + 20], [px, 330], [px - 36, 330], [px + 36, 330]], drawn(18, 30));
      for (let k = 0; k <= 32; k++) { const u = k / 32; wires.push([lerp(px + 36, px + 604, u), 330 + Math.sin(Math.PI * u) * 40]); }
    }
    line(ctx, wires, drawn(22, 34));

    // the bicycle, in one stroke
    const crank = (TAU * shift) / 240, spin = crank * 1.5;
    const REAR: Vec2 = [640, ROAD - 104], FRONT: Vec2 = [1010, ROAD - 104], BB: Vec2 = [800, ROAD - 94], SEAT: Vec2 = [760, ROAD - 300], BAR: Vec2 = [980, ROAD - 318];
    const bike: Vec2[] = [
      ...wheel(REAR[0], REAR[1], 104, Math.PI / 2 + spin),
      BB, SEAT, REAR, SEAT, [SEAT[0] - 30, SEAT[1] - 4], [SEAT[0] + 20, SEAT[1] - 6], SEAT, [BAR[0] - 40, BAR[1] + 22], BB,
      [BAR[0] - 40, BAR[1] + 22], [BAR[0] - 8, BAR[1]], [BAR[0] + 24, BAR[1] - 8], [BAR[0] + 40, BAR[1] + 8], [BAR[0] + 22, BAR[1] + 18],
      [BAR[0] - 8, BAR[1]], FRONT,
      ...wheel(FRONT[0], FRONT[1], 104, Math.PI / 2 + spin + 1.1).slice(1),
    ];
    line(ctx, bike, drawn(26, 44));
    // the rider, in another: one foot, up to the hip, down to the other foot, back, up the back, head, arm to the bar
    const bob = 4 * Math.sin(crank * 2);
    const hip: Vec2 = [SEAT[0] + 6, SEAT[1] - 12 + bob];
    const pedal = (a: number): Vec2 => [BB[0] + Math.cos(a) * 52, BB[1] + Math.sin(a) * 52];
    const pA = pedal(crank), pB = pedal(crank + Math.PI), kA = knee(hip, pA, 150, 148), kB = knee(hip, pB, 150, 148);
    const shoulder: Vec2 = [hip[0] + 132, hip[1] - 150 + bob * 0.5], head: Vec2 = [shoulder[0] + 44, shoulder[1] - 58];
    const headLoop: Vec2[] = Array.from({ length: 34 }, (_, k): Vec2 => {
      const a = Math.PI * 0.75 + (k / 30) * TAU;
      return [head[0] + Math.cos(a) * 34, head[1] + Math.sin(a) * 38];
    });
    const elbow: Vec2 = [lerp(shoulder[0], BAR[0], 0.5) + 6, lerp(shoulder[1], BAR[1], 0.5) + 30];
    const rider: Vec2[] = [
      [pA[0] + 18, pA[1] + 2], pA, kA, hip, kB, pB, [pB[0] + 18, pB[1] + 2], pB, kB, hip,
      [hip[0] + 60, hip[1] - 96], shoulder, ...headLoop, shoulder, elbow, [BAR[0] + 4, BAR[1] - 2],
    ];
    line(ctx, rider, drawn(40, 58));

    // two birds keeping pace above the wires
    const birdIn = drawn(52, 60);
    for (let k = 0; k < 2; k++) {
      const x = 1180 + k * 120 + 40 * Math.sin((TAU * shift) / 960 + k), y = 440 + k * 40 + 14 * Math.sin((TAU * shift) / 480 + k * 2), flap = 12 * Math.sin((TAU * shift) / 120 + k);
      line(ctx, [[x - 26, y - flap], [x - 10, y - 4], [x, y + 3], [x + 10, y - 4], [x + 26, y - flap]], birdIn);
    }
    ctx.restore();
  },
};
