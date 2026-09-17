/**
 * G15 "Truchet" (geometric rhythm; Bauhaus). A screen-printed Bauhaus grid of Truchet tiles, whole from the start:
 * black quarter-circle bands with red, yellow and blue corners. Waves of rotation cross the grid on the diagonal, four
 * a loop; each tile turns a quarter as the wave passes, so the black bands keep breaking and rejoining into new
 * paths. After four waves every tile has made a full turn.
 *
 * Timing is counted in whole drawn frames (turn index and in-turn progress are integers), so the loop's seam is exact.
 */
import { clamp, TAU } from '../../core/math';
import { hashSeed, noise2 } from '../../core/random';
import type { Scene } from '../../core/scene';
import { ease, fit, ground, ink, nf, perSize, type Fit } from './common';
import { GALLERY } from './palettes';

const PAL = GALLERY.bauhaus;
const [RED, YELLOW, BLUE, BLACK] = PAL.fills as [string, string, string, string];
const W = 1080, H = 1080, GRID = 6, T = 160, X0 = (W - GRID * T) / 2, Y0 = (H - GRID * T) / 2;
const WAVE = 36, TURN = 11, LOOP = WAVE * 4, BAND = 38;

/** A hand-cut screen: arcs whose radius wanders a hair, fixed per tile. */
function arc(path: Path2D, cx: number, cy: number, r: number, a0: number, a1: number, seed: number, reverse = false): void {
  const n = 24;
  for (let k = 0; k <= n; k++) {
    const u = reverse ? 1 - k / n : k / n, a = a0 + (a1 - a0) * u, rr = r + noise2(u * 3, r / 10, seed) * 2.2;
    const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
    if (k === 0 && !reverse) path.moveTo(x, y); else path.lineTo(x, y);
  }
}

interface Tile { colorA: string; colorB: string; flip: number; delay: number; seed: number; corners: [Path2D, Path2D]; bands: Path2D; dot: boolean }

/** The tiles, cut once on first draw (Path2D exists only in the browser). */
let cut: Tile[] | null = null;
const tiles = (): Tile[] => (cut ??= cutTiles());

function cutTiles(): Tile[] {
  const out: Tile[] = [];
  for (let j = 0; j < GRID; j++) {
    for (let i = 0; i < GRID; i++) {
      const h = hashSeed(1500, i, j), colors = [RED, YELLOW, BLUE], h2 = T / 2;
      const cornerA = new Path2D(), cornerB = new Path2D(), bands = new Path2D();
      // quarter discs in two opposite corners, then the two black bands around them
      cornerA.moveTo(-h2, -h2); arc(cornerA, -h2, -h2, h2 - BAND / 2, 0, Math.PI / 2, h + 1, true); cornerA.closePath();
      cornerB.moveTo(h2, h2); arc(cornerB, h2, h2, h2 - BAND / 2, Math.PI, Math.PI * 1.5, h + 2, true); cornerB.closePath();
      arc(bands, -h2, -h2, h2 + BAND / 2, 0, Math.PI / 2, h + 3); arc(bands, -h2, -h2, h2 - BAND / 2, 0, Math.PI / 2, h + 4, true); bands.closePath();
      arc(bands, h2, h2, h2 + BAND / 2, Math.PI, Math.PI * 1.5, h + 5); arc(bands, h2, h2, h2 - BAND / 2, Math.PI, Math.PI * 1.5, h + 6, true); bands.closePath();
      out.push({
        colorA: colors[h % 3]!, colorB: colors[(h >> 3) % 3 === h % 3 ? ((h % 3) + 1) % 3 : (h >> 3) % 3]!,
        flip: (h >> 6) % 2, delay: Math.round((i + j) * 1.6), seed: h, corners: [cornerA, cornerB], bands, dot: (h >> 9) % 7 === 0,
      });
    }
  }
  return out;
}

const layout = perSize((w, h): { F: Fit } => ({ F: fit(w, h, W, H) }));

/** Quarter turns of a tile so far and its eased progress into the current turn, from whole frames. */
function turnOf(n: number, delay: number): number {
  const t = n - delay, wave = Math.floor(t / WAVE), into = t - wave * WAVE;
  return (((wave % 4) + 4) % 4) + ease(clamp(into / TURN, 0, 1));
}

export const truchetScene: Scene = {
  name: 'truchet',
  duration: LOOP / 12,
  loopFrom: 0,
  // a rest: every tile has finished its turn
  poster: 30 / 12,
  draw(f) {
    const { stage } = f;
    const { F } = layout(stage.w, stage.h), n = Math.round(nf(f) * 2) / 2, [ox, oy] = F.P(0, 0), s = F.s;
    ground(f, PAL.paper, { seed: 1500, texture: 0.8 });
    const each = (draw: (c: CanvasRenderingContext2D, tile: Tile) => void) => (g: Parameters<Scene['draw']>[0]) => {
      const c = g.ctx;
      c.translate(ox, oy);
      c.scale(s, s);
      tiles().forEach((tile, k) => {
        const i = k % GRID, j = Math.floor(k / GRID);
        c.save();
        c.translate(X0 + i * T + T / 2, Y0 + j * T + T / 2);
        const turn = turnOf(n, tile.delay), lift = Math.sin(Math.PI * (turn - Math.floor(turn)));
        c.rotate((tile.flip + turn) * (Math.PI / 2));
        // a turning tile draws in a little, so it clears its neighbours
        c.scale(1 - 0.22 * lift, 1 - 0.22 * lift);
        draw(c, tile);
        c.restore();
      });
    };
    // the colour screen, then the black screen printed over it a little out of register
    ink(f, 'g15-colour', each((c, tile) => {
      c.fillStyle = tile.colorA;
      c.fill(tile.corners[0]);
      c.fillStyle = tile.colorB;
      c.fill(tile.corners[1]);
      if (tile.dot) {
        c.fillStyle = tile.colorA === YELLOW ? BLUE : YELLOW;
        c.beginPath();
        c.arc(0, 0, 16, 0, TAU);
        c.fill();
      }
    }), { tooth: { seed: 1510, density: 24, size: 1.8, alpha: 0.3 } });
    ink(f, 'g15-black', each((c, tile) => {
      c.fillStyle = BLACK;
      c.fill(tile.bands);
    }), { tooth: { seed: 1511, density: 24, size: 1.8, alpha: 0.28 }, offset: [2.5, 1.5] });
  },
};
