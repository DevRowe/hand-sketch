/**
 * Sharing what is on screen: a link that opens paused on this moment (the date, the style, the view, the pace, the
 * trails and the camera), handed to the device's share sheet on a phone or copied on a desktop; and a picture of it,
 * drawn afresh at up to twice its size, with a small caption in the style's own paper, ink and hand.
 */
import { hashSeed } from '../core/random';
import { drawStroke, prepareStroke } from '../core/stroke';
import type { App } from './app';

/** A moment to share: its link and the words that go with it. */
export interface Moment {
  url: string;
  /** "Solar System · 20 Aug 1977 · Riso": the caption and the share sheet's text. */
  caption: string;
  /** For the picture's file name: "solar-system-1977-08-20-riso". */
  slug: string;
}

/** Where a share went: into the device's share sheet, onto the clipboard, into the downloads, or nowhere. */
export type Shared = 'sheet' | 'copied' | 'saved' | 'cancelled' | 'failed';

/** Phones and tablets hand a share to the system's sheet; a desktop copies the link. */
const touch = (): boolean => matchMedia('(pointer: coarse)').matches;

export async function shareMoment(m: Moment): Promise<Shared> {
  if (touch() && typeof navigator.share === 'function') {
    try {
      await navigator.share({ title: 'Solar System Explorer', text: m.caption, url: m.url });
      return 'sheet';
    } catch (e) {
      // the viewer closed the sheet: nothing to report
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled';
    }
  }
  try {
    await navigator.clipboard.writeText(m.url);
    return 'copied';
  } catch {
    return 'failed';
  }
}

/** Longest side of a saved picture, pixels, and most pixels in all. */
const MAX_SIDE = 4096;
const MAX_PIXELS = 9e6;

/** How many times its CSS size a picture of a `w` by `h` screen is drawn: twice, unless that is too large. */
export const stillScale = (w: number, h: number): number => Math.max(1, Math.min(2, MAX_SIDE / Math.max(w, h), Math.sqrt(MAX_PIXELS / (w * h))));

/**
 * Draw the picture and hand it over: to the share sheet on a phone (where "Save image" puts it in the photos), else as
 * a download. Resolves once it has been handed over.
 */
export async function savePicture(app: App, m: Moment): Promise<Shared> {
  await document.fonts?.load(`italic 300 40px Fraunces`).catch(() => undefined);
  const canvas = app.still(stillScale(innerWidth, innerHeight));
  caption(canvas, app.style.swatch, m);
  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
  if (!blob) return 'failed';
  return handOver(blob, `${m.slug}.png`, m);
}

/** Hand a file over: to the share sheet on a phone (to keep or send on), else as a download. */
export async function handOver(blob: Blob, name: string, m: Moment): Promise<Shared> {
  const file = new File([blob], name, { type: blob.type });
  if (touch() && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Solar System Explorer', text: m.caption });
      return 'sheet';
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled';
    }
  }
  const href = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = href;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 60_000);
  return 'saved';
}

/**
 * The caption, bottom left: a tag of the style's paper with the words in its ink, set in the explorer's italic serif
 * and underlined by hand in its accent (the stroke engine's wobble and taper), and the link beneath in small type.
 */
export function caption(canvas: HTMLCanvasElement, [paper, ink, accent]: readonly [string, string, string], m: Moment): void {
  const ctx = canvas.getContext('2d')!, W = canvas.width, H = canvas.height, u = Math.min(W, H) / 100;
  const pad = 2.4 * u, inset = 1.6 * u;
  let title = 3.1 * u, small = 1.4 * u;
  const fontTitle = (): string => `italic 300 ${title}px Fraunces, Georgia, serif`, fontSmall = (): string => `500 ${small}px Inter, system-ui, sans-serif`;
  const link = m.url.replace(/^https?:\/\//, '');
  ctx.save();
  // the scene leaves its own transform behind: the caption is set in the picture's pixels
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  // fit both lines into the picture's width, less its margins
  ctx.font = fontTitle();
  const room = W - 2 * pad - 2 * inset;
  const tw = ctx.measureText(m.caption).width;
  if (tw > room) title *= room / tw;
  ctx.font = fontSmall();
  const lw = ctx.measureText(link).width;
  if (lw > room) small *= room / lw;
  ctx.font = fontTitle();
  const titleW = ctx.measureText(m.caption).width;
  ctx.font = fontSmall();
  const linkW = ctx.measureText(link).width;
  const boxW = Math.max(titleW, linkW) + 2 * inset, boxH = title * 1.25 + small * 1.5 + inset * 2.1;
  const x0 = pad, y0 = H - pad - boxH;
  // the tag: paper, a little translucent, so the sky still reads behind its edge
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = paper;
  ctx.beginPath();
  ctx.roundRect(x0, y0, boxW, boxH, 0.9 * u);
  ctx.fill();
  ctx.globalAlpha = 1;
  const base = y0 + inset + title * 0.95;
  ctx.fillStyle = ink;
  ctx.textBaseline = 'alphabetic';
  ctx.font = fontTitle();
  ctx.fillText(m.caption, x0 + inset, base);
  // the underline, drawn by hand under the words
  const ux = x0 + inset, uy = base + title * 0.2, seed = hashSeed(7, m.caption.length, Math.round(W));
  const line = prepareStroke([[ux, uy], [ux + titleW * 0.55, uy + title * 0.05], [ux + titleW, uy - title * 0.04]], {
    color: accent, size: Math.max(1.2, 0.26 * u), thinning: 0.45, wobble: 0.18 * u, tremor: 0.05 * u, taperStart: 3 * u, taperEnd: 6 * u, alpha: 0.95,
  }, seed);
  drawStroke(ctx, line, 1);
  ctx.globalAlpha = 0.72;
  ctx.fillStyle = ink;
  ctx.font = fontSmall();
  ctx.fillText(link, x0 + inset, base + title * 0.3 + small * 1.35);
  ctx.restore();
}
