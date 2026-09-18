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
 *
 * Layers come in two kinds. A view layer (`layer`) holds pixels drawn through the view, so a view change wipes it. A
 * page layer (`pageLayer`) holds a page-locked texture (paper, tooth) drawn once over the whole page at the base scale,
 * whatever the view, and `lay` maps it through the view: moving the camera never re-rasterises it. With the view at
 * home (always, in renders) laying either kind is the same plain full-frame draw.
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
  private readonly pages = new Map<string, HTMLCanvasElement>();
  private readonly pageSet = new WeakSet<HTMLCanvasElement>();
  /** Counts canvases created and page layers drawn: a frame that moved it paid for building caches. */
  builds = 0;

  constructor(readonly format: Format) {
    ({ w: this.w, h: this.h, scale: this.base, outW: this.outW, outH: this.outH } = frameSize(format));
    this.camera = { zoom: 1, x: this.w / 2, y: this.h / 2 };
  }

  get cx(): number { return this.w / 2; }
  get cy(): number { return this.h / 2; }

  /** Output pixels per logical unit through the view (the base scale times the zoom): what pixel-sized effects scale by. */
  get scale(): number { return this.base * this.camera.zoom; }

  get view(): View { return this.camera; }

  /** The view shows the whole frame, exactly as a render does. */
  get home(): boolean {
    const { zoom, x, y } = this.camera;
    return zoom === 1 && x === this.w / 2 && y === this.h / 2;
  }

  /**
   * Point the view camera. A change wipes every view layer on its next use, so stills built once are rebuilt for the
   * new view while per-frame layers keep their canvases; page layers (paper, tooth masks) are kept as they are.
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
      this.builds++;
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

  /**
   * A page layer: `build` draws it once, in logical units over the whole page as the home view shows it, and it is
   * kept whatever the view does. Lay it with `lay` (or `blit`), which maps it through the view. `build` must only
   * draw page-locked marks and use page layers, never view layers, since it runs under the home view.
   */
  pageLayer(key: string, build: (g: Ctx) => void): HTMLCanvasElement {
    const id = `${key}@${this.outW}x${this.outH}`;
    let canvas = this.pages.get(id);
    if (canvas) return canvas;
    canvas = document.createElement('canvas');
    canvas.width = this.outW;
    canvas.height = this.outH;
    this.pages.set(id, canvas);
    this.pageSet.add(canvas);
    this.builds++;
    const camera = this.camera;
    this.camera = { zoom: 1, x: this.w / 2, y: this.h / 2 };
    try {
      const g = this.context(canvas);
      this.reset(g);
      build(g);
    } finally {
      this.camera = camera;
    }
    return canvas;
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
    this.lay(ctx, layer);
  }

  /**
   * Draw an output-resolution layer full frame, shifted by (`dx`, `dy`) output pixels, whatever the current transform
   * (compositing and alpha are the caller's). A page layer goes through the view; a view layer is already in it.
   */
  lay(ctx: Ctx, layer: HTMLCanvasElement, dx = 0, dy = 0): void {
    ctx.save();
    if (this.pageSet.has(layer) && !this.home) {
      const { zoom, x, y } = this.camera;
      ctx.setTransform(zoom, 0, 0, zoom, this.base * (this.w / 2 - zoom * x) + dx, this.base * (this.h / 2 - zoom * y) + dy);
      ctx.drawImage(layer, 0, 0, this.outW, this.outH);
    } else {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(layer, dx, dy, this.outW, this.outH);
    }
    ctx.restore();
  }
}
