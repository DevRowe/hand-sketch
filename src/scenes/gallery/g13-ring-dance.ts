/**
 * G13 "Ring Dance" (dance; cut paper). After Matisse: five vermilion figures cut from painted paper dance in a ring
 * on a green hill against ultramarine, whole from the first frame. The ring turns once per loop in perspective; each
 * dancer steps and kicks on its own count, and every hand holds the next dancer's hand, wherever that is.
 *
 * The figures are posed from a few joint angles per dancer (thigh, knee, lean), hopped so a foot is always on the
 * ground, and their arms are solved last so they reach the neighbours' hands. Each piece of paper lies a little above
 * the one below, with a flat shadow.
 */
import { catmullRom } from '../../core/geometry';
import { lerp, TAU, type Vec2 } from '../../core/math';
import type { Scene } from '../../core/scene';
import { composite, fit, ground, perSize, phase, polyPath, scissor, still, toothMask, wave, type Fit } from './common';
import { GALLERY } from './palettes';

const PAL = GALLERY.cutPaper;
const [VERMILION, GREEN, LEMON, CREAM] = PAL.fills as [string, string, string, string];
const BLUE = PAL.paper, W = 1920, H = 1080, LOOP = 192;
const RING: Vec2 = [960, 690], RX = 420, RY = 120, N = 5;
const SHADOW = 'rgba(10,20,50,0.3)';

interface Pose { hip: Vec2; neck: Vec2; head: Vec2; knees: [Vec2, Vec2]; feet: [Vec2, Vec2]; shoulders: [Vec2, Vec2]; sc: number; depth: number }

function pose(k: number, p: number): Pose {
  const th = TAU * (p + k / N), x = RING[0] + RX * Math.cos(th), floor = RING[1] + RY * Math.sin(th);
  const depth = (Math.sin(th) + 1) / 2, sc = lerp(0.66, 1.05, depth);
  // two steps per turn of the ring for each dancer, offset around the ring
  const psi = TAU * (p * 8 + k * 0.37), lean = 0.22 * Math.sin(psi + 0.6) + (k % 2 ? 0.08 : -0.08);
  const thigh = 110 * sc, shin = 105 * sc;
  const legs = [0, 1].map(side => {
    const s = side ? -1 : 1, a = s * 0.55 * Math.sin(psi) + (side ? 0.12 : -0.12), bend = 0.9 * Math.max(0, Math.sin(psi + (side ? Math.PI : 0) + 0.8));
    const knee: Vec2 = [Math.sin(a) * thigh, Math.cos(a) * thigh];
    const foot: Vec2 = [knee[0] + Math.sin(a - bend * s) * shin, knee[1] + Math.cos(a - bend * s) * shin];
    return { knee, foot };
  });
  // hop so the lower foot touches the ground
  const drop = Math.max(legs[0]!.foot[1], legs[1]!.foot[1]), hip: Vec2 = [x, floor - drop];
  const at = (v: Vec2): Vec2 => [hip[0] + v[0], hip[1] + v[1]];
  const torso = 130 * sc, neck: Vec2 = [hip[0] + Math.sin(lean) * torso, hip[1] - Math.cos(lean) * torso];
  const across: Vec2 = [Math.cos(lean) * 38 * sc, Math.sin(lean) * 38 * sc];
  return {
    hip, neck, sc, depth,
    head: [neck[0] + Math.sin(lean * 1.4) * 52 * sc, neck[1] - Math.cos(lean * 1.4) * 52 * sc],
    knees: [at(legs[0]!.knee), at(legs[1]!.knee)],
    feet: [at(legs[0]!.foot), at(legs[1]!.foot)],
    shoulders: [[neck[0] - across[0], neck[1] + 14 * sc - across[1]], [neck[0] + across[0], neck[1] + 14 * sc + across[1]]],
  };
}

/** A limb cut as one piece: a smooth tapering band along the joints, rounded at both ends. */
function limb(c: CanvasRenderingContext2D, joints: readonly Vec2[], w0: number, w1: number): void {
  const pts = catmullRom(joints, 8), n = pts.length - 1, left: Vec2[] = [], right: Vec2[] = [];
  pts.forEach(([x, y], k) => {
    const a = pts[Math.max(0, k - 1)]!, b = pts[Math.min(n, k + 1)]!, dx = b[0] - a[0], dy = b[1] - a[1], m = Math.hypot(dx, dy) || 1;
    // a calf and a forearm: the band swells a little before it tapers
    const u = k / n, w = lerp(w0, w1, u) * (1 + 0.18 * Math.sin(Math.PI * Math.min(1, u * 1.6))) / 2;
    left.push([x - (dy / m) * w, y + (dx / m) * w]);
    right.push([x + (dy / m) * w, y - (dx / m) * w]);
  });
  c.fill(polyPath([...left, ...right.reverse()]));
  for (const [[x, y], r] of [[pts[0]!, w0 / 2], [pts[n]!, w1 / 2]] as const) {
    c.beginPath();
    c.arc(x, y, r, 0, TAU);
    c.fill();
  }
}

function figure(c: CanvasRenderingContext2D, P: Pose, hands: [Vec2, Vec2], color: string): void {
  const sc = P.sc;
  c.fillStyle = color;
  limb(c, [P.hip, P.knees[0], P.feet[0]], 60 * sc, 22 * sc);
  limb(c, [P.hip, P.knees[1], P.feet[1]], 60 * sc, 22 * sc);
  // arms bow a little below the straight line to the held hand
  for (const side of [0, 1] as const) {
    const s = P.shoulders[side], h = hands[side], mid: Vec2 = [(s[0] + h[0]) / 2, (s[1] + h[1]) / 2 + 26 * sc];
    limb(c, [s, mid, h], 32 * sc, 17 * sc);
  }
  // torso: full hips, a waist, a chest and round shoulders, leaning with the body
  const ax = (P.neck[0] - P.hip[0]), ay = (P.neck[1] - P.hip[1]), len = Math.hypot(ax, ay), ux = ax / len, uy = ay / len;
  const at = (across: number, up: number): Vec2 => [P.hip[0] + ux * up * len - uy * across * sc, P.hip[1] + uy * up * len + ux * across * sc];
  const profile: [number, number][] = [[-8, 50], [0.2, 46], [0.45, 31], [0.72, 42], [0.92, 44], [1.02, 26], [1.06, 12]];
  const side = (sgn: number) => profile.map(([u, wdt]) => (u < 0 ? at(0, -0.05) : at(sgn * wdt, u)));
  c.fill(polyPath(catmullRom([...side(-1).slice(1), ...side(1).slice(1).reverse()], 5, true)));
  c.beginPath();
  c.ellipse(P.head[0], P.head[1], 27 * sc, 33 * sc, Math.atan2(ux, -uy), 0, TAU);
  c.fill();
}

const SEAWEED = (len: number, lobes: number): Vec2[] => {
  const right: Vec2[] = [], left: Vec2[] = [];
  for (let k = 0; k <= lobes * 4; k++) {
    const u = k / (lobes * 4), w = len * 0.16 * Math.sin(Math.PI * u) * (0.5 + 0.5 * Math.abs(Math.sin(u * Math.PI * lobes)));
    right.push([w, -u * len]);
    left.push([-w * 0.9, -u * len]);
  }
  return [...right, ...left.reverse()];
};

interface Layout { F: Fit; hill: Vec2[]; weeds: { at: Vec2; shape: Vec2[]; color: string; o: number; tilt: number }[]; sun: Vec2[] }

const layout = perSize((w, h): Layout => {
  const hill = scissor([[-40, 1120], [-40, 700], ...catmullRom([[-40, 700], [400, 610], [960, 580], [1500, 620], [1960, 720]], 10), [1960, 1120]], 1301, 40, 3);
  const weeds = [
    { at: [110, 560] as Vec2, len: 360, lobes: 6, color: LEMON, tilt: -0.15 },
    { at: [260, 430] as Vec2, len: 250, lobes: 5, color: CREAM, tilt: 0.25 },
    { at: [1750, 590] as Vec2, len: 380, lobes: 7, color: LEMON, tilt: 0.12 },
    { at: [1600, 400] as Vec2, len: 220, lobes: 4, color: CREAM, tilt: -0.3 },
    { at: [1850, 330] as Vec2, len: 240, lobes: 5, color: GREEN, tilt: 0.3 },
  ].map((wd, k) => ({ at: wd.at, shape: scissor(SEAWEED(wd.len, wd.lobes), 1310 + k, 18, 2), color: wd.color, o: k * 0.19, tilt: wd.tilt }));
  const sun = scissor(Array.from({ length: 96 }, (_, k): Vec2 => {
    const a = (k / 96) * TAU, r = 92 + 26 * Math.pow(Math.abs(Math.sin(a * 6)), 3);
    return [Math.cos(a) * r, Math.sin(a) * r];
  }), 1320, 16, 1.5);
  return { F: fit(w, h, W, H), hill, weeds, sun };
});

export const ringDanceScene: Scene = {
  name: 'ring-dance',
  duration: LOOP / 12,
  loopFrom: 0,
  poster: 30 / 12,
  draw(f) {
    const { ctx, stage } = f;
    const L = layout(stage.w, stage.h), p = phase(f), { P, s } = L.F, [ox, oy] = P(0, 0);
    ground(f, BLUE, { seed: 1300, texture: 0.7 });
    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(s, s);

    const cut = (shape: Path2D, color: string, lift = 1) => {
      ctx.save();
      ctx.translate(5 * lift, 7 * lift);
      ctx.fillStyle = SHADOW;
      ctx.fill(shape);
      ctx.restore();
      ctx.fillStyle = color;
      ctx.fill(shape);
    };
    // the sun and the sea-leaves sway on the wall
    ctx.save();
    ctx.translate(1420, 190);
    ctx.rotate(0.06 * wave(p, 1));
    ctx.scale(1 + 0.03 * wave(p, 4), 1 + 0.03 * wave(p, 4));
    cut(polyPath(L.sun), LEMON);
    ctx.restore();
    for (const wd of L.weeds) {
      ctx.save();
      ctx.translate(wd.at[0], wd.at[1]);
      ctx.rotate(wd.tilt + 0.07 * wave(p, 2, wd.o));
      cut(polyPath(wd.shape), wd.color);
      ctx.restore();
    }
    cut(polyPath(L.hill), GREEN, 1.4);

    // the ring: pose everyone, link hands, then cut them out back to front
    const poses = Array.from({ length: N }, (_, k) => pose(k, p));
    const hands = poses.map((P0, k) => {
      const next = poses[(k + 1) % N]!, prev = poses[(k + N - 1) % N]!;
      const meet = (a: Vec2, b: Vec2, sc: number): Vec2 => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - 30 * sc];
      // which shoulder faces which neighbour depends on where they stand on screen
      const toNext = next.neck[0] > P0.neck[0] ? 1 : 0, toPrev = 1 - toNext;
      const h: [Vec2, Vec2] = [[0, 0], [0, 0]];
      h[toNext] = meet(P0.shoulders[toNext]!, next.shoulders[next.neck[0] > P0.neck[0] ? 0 : 1], P0.sc);
      h[toPrev] = meet(P0.shoulders[toPrev]!, prev.shoulders[prev.neck[0] > P0.neck[0] ? 0 : 1], P0.sc);
      return h;
    });
    const order = poses.map((_, k) => k).sort((a, b) => poses[a]!.depth - poses[b]!.depth);
    for (const k of order) {
      const P0 = poses[k]!;
      ctx.save();
      ctx.translate(6 * P0.sc, 8 * P0.sc);
      figure(ctx, P0, hands[k]!, SHADOW);
      ctx.restore();
      figure(ctx, P0, hands[k]!, k === 2 ? '#d9482a' : VERMILION);
    }
    ctx.restore();

    // painted paper: gouache brush streaks in every sheet
    still(f, 'g13-gouache', g => {
      composite(g, toothMask(g, { seed: 1330, kind: 'streak', angle: 0.4, density: 6, size: 6, length: 110, color: '#ffffff' }), { alpha: 0.03 });
    });
  },
};
