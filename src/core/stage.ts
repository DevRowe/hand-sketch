/**
 * The stage: logical frame size, output scale, an optional view camera, and cached offscreen layers.
 *
 * Scenes draw in logical units where the short side is always 1080 and place things relative to
 * `cx`, `cy`, `w`, `h`, so one scene renders square, wide or tall. Output resolution is a separate,
 * render-time choice: `scale` maps logical units to output pixels, so a 4K render stays crisp.
 * (Scheme ported from alesha-pro/tools hand-drawn-canvas-animation `setFormat`, MIT, see NOTICE.)
 *
 * The view camera magnifies and pans the whole frame (the live explorer's zoom); renders never set it, so their
 * transform is the plain output scale.
 */

export const SHORT_SIDE = 1080;

export interface Format {
  /** Aspect ratio as "16:9", "1:1", "9:16". */
  ar: string;
  /** Output width in pixels; defaults to the logical width. */
  width?: number;
  /**
   * Output height in pixels, with `width`: pins the output to exactly that size (a live canvas matching its device
   * pixels). Renders leave it out, and both sides are rounded even for libx264.
   */
  height?: number;
}

export interface FrameSize {
  /** Logical width and height. */
  w: number;
  h: number;
  /** Output pixels per logical unit. */
  scale: number;
  outW: number;
  outH: number;
}

/** Width / height of an aspect ratio string ("16:9", "4x3", "4/5"). Throws on anything unparsable, never guesses. */
export function parseAspect(ar: string): number {
  const m = /^\s*(\d+(?:\.\d+)?)\s*[:x/]\s*(\d+(?:\.\d+)?)\s*$/.exec(String(ar));
  const a = m ? Number(m[1]) : NaN, b = m ? Number(m[2]) : NaN;
  if (!(a > 0 && b > 0)) throw new Error(`bad aspect ratio "${ar}": expected W:H, e.g. 16:9, 4:3, 1:1`);
  return a / b;
}

export function frameSize({ ar, width, height }: Format): FrameSize {
  const r = parseAspect(ar);
  const w = r >= 1 ? Math.round(SHORT_SIDE * r) : SHORT_SIDE;
  const h = r >= 1 ? SHORT_SIDE : Math.round(SHORT_SIDE / r);
  if (width && height) {
    // exact pixels: scale by the short side, which the logical frame holds at exactly SHORT_SIDE
    if (!(Number.isInteger(width) && Number.isInteger(height) && width > 0 && height > 0)) throw new Error(`bad output size ${width}x${height}`);
    return { w, h, scale: r >= 1 ? height / h : width / w, outW: width, outH: height };
  }
  // libx264 needs even dimensions: round the output height to even, then derive the scale from it.
  let scale = width ? width / w : 1;
  const outH = 2 * Math.round((h * scale) / 2);
  scale = outH / h;
  const outW = 2 * Math.round((w * scale) / 2);
  return { w, h, scale, outW, outH };
}

export type Ctx = CanvasRenderingContext2D;

/**
 * A view camera over the logical frame: magnified `zoom` times (1 shows the whole frame) about the logical point
 * (`x`, `y`), which lands on the centre of the output.
 */
export interface View {
  readonly zoom: number;
  readonly x: number;
  readonly y: number;
}

export class Stage implements FrameSize {
  readonly w: number;
  readonly h: number;
  readonly outW: number;
  readonly outH: number;
  /** Output pixels per logical unit of the whole frame, before any zoom. */
  readonly base: number;
  private camera: View;
  /** Bumped by every view change: a layer drawn under an older view is wiped before it is handed out again. */
  private generation = 0;
  private readonly layers = new Map<string, { canvas: HTMLCanvasElement; generation: number }>();

  constructor(readonly format: Format) {
    ({ w: this.w, h: this.h, scale: this.base, outW: this.outW, outH: this.outH } = frameSize(format));
    this.camera = { zoom: 1, x: this.w / 2, y: this.h / 2 };
  }

  get cx(): number { return this.w / 2; }
  get cy(): number { return this.h / 2; }

  /** Output pixels per logical unit through the view (the base scale times the zoom): what pixel-sized effects scale by. */
  get scale(): number { return this.base * this.camera.zoom; }

  get view(): View { return this.camera; }

  /**
   * Point the view camera. A change wipes every layer on its next use, so layers built once (paper, stills, tooth
   * masks) are rebuilt for the new view while per-frame layers keep their canvases.
   */
  setView(v: View): void {
    if (!(v.zoom > 0 && Number.isFinite(v.zoom) && Number.isFinite(v.x) && Number.isFinite(v.y))) throw new Error(`bad view ${JSON.stringify(v)}`);
    const c = this.camera;
    if (v.zoom === c.zoom && v.x === c.x && v.y === c.y) return;
    this.camera = { zoom: v.zoom, x: v.x, y: v.y };
    this.generation++;
  }

  /** Output pixel of a logical point, through the view. */
  toPixel(x: number, y: number): [number, number] {
    const { zoom, x: vx, y: vy } = this.camera;
    return [this.base * (this.w / 2 + zoom * (x - vx)), this.base * (this.h / 2 + zoom * (y - vy))];
  }

  /** Logical point under an output pixel, through the view. */
  toLogical(px: number, py: number): [number, number] {
    const { zoom, x: vx, y: vy } = this.camera;
    return [vx + (px / this.base - this.w / 2) / zoom, vy + (py / this.base - this.h / 2) / zoom];
  }

  /** A cached offscreen canvas at output resolution, or at an explicit pixel size. */
  layer(key: string, pixelW = this.outW, pixelH = this.outH): HTMLCanvasElement {
    const id = `${key}@${pixelW}x${pixelH}`;
    let entry = this.layers.get(id);
    if (!entry) {
      const canvas = document.createElement('canvas');
      canvas.width = pixelW;
      canvas.height = pixelH;
      this.layers.set(id, (entry = { canvas, generation: this.generation }));
    } else if (entry.generation !== this.generation) {
      // drawn under an older view: resetting the size clears the bitmap and every piece of context state
      entry.canvas.width = pixelW;
      entry.generation = this.generation;
    }
    return entry.canvas;
  }

  /** True when the layer already exists for the current view (lets callers build static layers once). */
  hasLayer(key: string, pixelW = this.outW, pixelH = this.outH): boolean {
    return this.layers.get(`${key}@${pixelW}x${pixelH}`)?.generation === this.generation;
  }

  context(canvas: HTMLCanvasElement): Ctx {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas context unavailable');
    return ctx;
  }

  /** Reset `ctx` to logical units (through the view) with default compositing. */
  reset(ctx: Ctx): void {
    const { zoom, x, y } = this.camera, k = this.base * zoom;
    ctx.setTransform(k, 0, 0, k, this.base * (this.w / 2 - zoom * x), this.base * (this.h / 2 - zoom * y));
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  /** Draw an output-resolution layer full frame, whatever the current transform. */
  blit(ctx: Ctx, layer: HTMLCanvasElement): void {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(layer, 0, 0, this.outW, this.outH);
    ctx.restore();
  }
}
