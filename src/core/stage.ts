/**
 * The stage: logical frame size, output scale, and cached offscreen layers.
 *
 * Scenes draw in logical units where the short side is always 1080 and place things relative to
 * `cx`, `cy`, `w`, `h`, so one scene renders square, wide or tall. Output resolution is a separate,
 * render-time choice: `scale` maps logical units to output pixels, so a 4K render stays crisp.
 * (Scheme ported from alesha-pro/tools hand-drawn-canvas-animation `setFormat`, MIT, see NOTICE.)
 */

export const SHORT_SIDE = 1080;

export interface Format {
  /** Aspect ratio as "16:9", "1:1", "9:16". */
  ar: string;
  /** Output width in pixels; defaults to the logical width. */
  width?: number;
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

export function frameSize({ ar, width }: Format): FrameSize {
  const r = parseAspect(ar);
  const w = r >= 1 ? Math.round(SHORT_SIDE * r) : SHORT_SIDE;
  const h = r >= 1 ? SHORT_SIDE : Math.round(SHORT_SIDE / r);
  // libx264 needs even dimensions: round the output height to even, then derive the scale from it.
  let scale = width ? width / w : 1;
  const outH = 2 * Math.round((h * scale) / 2);
  scale = outH / h;
  const outW = 2 * Math.round((w * scale) / 2);
  return { w, h, scale, outW, outH };
}

export type Ctx = CanvasRenderingContext2D;

export class Stage implements FrameSize {
  readonly w: number;
  readonly h: number;
  readonly scale: number;
  readonly outW: number;
  readonly outH: number;
  private readonly layers = new Map<string, HTMLCanvasElement>();

  constructor(readonly format: Format) {
    ({ w: this.w, h: this.h, scale: this.scale, outW: this.outW, outH: this.outH } = frameSize(format));
  }

  get cx(): number { return this.w / 2; }
  get cy(): number { return this.h / 2; }

  /** A cached offscreen canvas at output resolution, or at an explicit pixel size. */
  layer(key: string, pixelW = this.outW, pixelH = this.outH): HTMLCanvasElement {
    const id = `${key}@${pixelW}x${pixelH}`;
    let c = this.layers.get(id);
    if (!c) {
      c = document.createElement('canvas');
      c.width = pixelW;
      c.height = pixelH;
      this.layers.set(id, c);
    }
    return c;
  }

  /** True when the layer already exists (lets callers build static layers once). */
  hasLayer(key: string, pixelW = this.outW, pixelH = this.outH): boolean {
    return this.layers.has(`${key}@${pixelW}x${pixelH}`);
  }

  context(canvas: HTMLCanvasElement): Ctx {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas context unavailable');
    return ctx;
  }

  /** Reset `ctx` to logical units with default compositing. */
  reset(ctx: Ctx): void {
    ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
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
