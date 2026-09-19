/**
 * A short clip of the sky as it moves, recorded in the browser: every animation frame the live picture is copied onto
 * a canvas of a sensible size under the same caption as a saved picture, and that canvas is recorded with the
 * browser's MediaRecorder (MP4 where the browser offers it, WebM otherwise). The clip is then handed over as a picture
 * is: to the share sheet on a phone, else as a download. Nothing leaves the device.
 */
import type { App } from './app';
import { caption, handOver, type Moment, type Shared } from './share';

/** Seconds a clip lasts. */
export const CLIP_S = 6;
/** Longest side of a clip, pixels (kept even, as video encoders want). */
const MAX_SIDE = 1280;

/** The first format this browser records, with its file extension; null where it records none. */
function format(): { mime: string; ext: string } | null {
  if (typeof MediaRecorder === 'undefined' || typeof HTMLCanvasElement.prototype.captureStream !== 'function') return null;
  for (const [mime, ext] of [['video/mp4;codecs=avc1.42E01E', 'mp4'], ['video/mp4', 'mp4'], ['video/webm;codecs=vp9', 'webm'], ['video/webm;codecs=vp8', 'webm'], ['video/webm', 'webm']] as const) {
    if (MediaRecorder.isTypeSupported(mime)) return { mime, ext };
  }
  return null;
}

/** Whether this browser can record a clip. */
export const canRecord = (): boolean => format() !== null;

const even = (n: number): number => Math.max(2, 2 * Math.round(n / 2));

/**
 * Record `seconds` of `source` (the live sky) under the moment's caption, and hand the clip over. `progress` hears
 * how far along it is (0..1) every frame.
 */
export async function recordClip(app: App, source: HTMLCanvasElement, m: Moment, seconds = CLIP_S, progress: (u: number) => void = () => {}): Promise<Shared> {
  const f = format();
  if (!f) return 'failed';
  // sharp on a dense screen, but never past `MAX_SIDE`
  const W = innerWidth, H = innerHeight, s = Math.min(devicePixelRatio || 1, 2, MAX_SIDE / Math.max(W, H));
  const w = even(W * s), h = even(H * s);
  const rec = document.createElement('canvas');
  rec.width = w;
  rec.height = h;
  const ctx = rec.getContext('2d');
  // the caption is set once, on a layer of its own laid over every frame
  const tag = document.createElement('canvas');
  tag.width = w;
  tag.height = h;
  await document.fonts?.load('italic 300 40px Fraunces').catch(() => undefined);
  caption(tag, app.style.swatch, m);
  if (!ctx) return 'failed';
  const stream = rec.captureStream(30), chunks: Blob[] = [];
  let recorder: MediaRecorder;
  try {
    recorder = new MediaRecorder(stream, { mimeType: f.mime, videoBitsPerSecond: 8_000_000 });
  } catch {
    return 'failed';
  }
  recorder.ondataavailable = e => {
    if (e.data.size) chunks.push(e.data);
  };
  const stopped = new Promise<void>(resolve => (recorder.onstop = () => resolve()));
  const t0 = performance.now();
  let raf = 0;
  const copy = (now: number): void => {
    ctx.drawImage(source, 0, 0, w, h);
    ctx.drawImage(tag, 0, 0);
    progress(Math.min(1, (now - t0) / (seconds * 1000)));
    raf = requestAnimationFrame(copy);
  };
  copy(t0);
  recorder.start(500);
  await new Promise(r => setTimeout(r, seconds * 1000));
  cancelAnimationFrame(raf);
  recorder.stop();
  await stopped;
  for (const track of stream.getTracks()) track.stop();
  if (!chunks.length) return 'failed';
  return handOver(new Blob(chunks, { type: f.mime.split(';')[0]! }), `${m.slug}.${f.ext}`, m);
}
