/**
 * The orbits as sound, off until the viewer asks for it (never on by itself, never remembered between visits): each
 * planet plays its own note as it passes one line from the Sun, the direction of the March equinox (straight to the
 * right of the From above plan, where the line is drawn while the sound is on).
 *
 * The rhythms are the orbits': at a year a second the inner planets patter, Jupiter chimes every twelve seconds and
 * Neptune tolls once in 165. Near-resonances become audible: five Jupiter notes to two of Saturn's, thirteen of Venus's
 * to eight of the Earth's. The notes fall from Mercury's high A to Neptune's low one on an A-major pentatonic scale,
 * with a gap between the rocky planets and the giants as there is in space; each style picks a timbre.
 *
 * Browsers let a page make sound only after a click or a key, and this one waits for the switch in the Look sheet (or
 * M) before it creates any audio at all.
 */
import { C, PLANETS, type PlanetName } from '../scenes/solar/common';
import { heliocentric, periodDays } from '../scenes/solar/ephemeris';
import type { App } from './app';
import { planRadius } from './orbits';
import { t } from './i18n';
import { GOLD, haloStroke, polyline, text } from './overlays';

/** Each planet's note (MIDI numbers): A-major pentatonic, falling outwards. */
const NOTE: Readonly<Record<PlanetName, number>> = { mercury: 81, venus: 78, earth: 76, mars: 73, jupiter: 57, saturn: 52, uranus: 49, neptune: 45 };
const hz = (midi: number): number => 440 * 2 ** ((midi - 69) / 12);

interface Timbre {
  /** The overtone over the note, as a ratio of its frequency, and how loud it is. */
  ratio: number;
  partial: number;
  /** Seconds a high note rings for (low notes ring longer). */
  ring: number;
  wave: OscillatorType;
}

/** A struck bar by default; wood for the printed styles, glass for the bright ones. */
const BELL: Timbre = { ratio: 2.76, partial: 0.28, ring: 1.4, wave: 'sine' };
const WOOD: Timbre = { ratio: 3.9, partial: 0.18, ring: 0.7, wave: 'triangle' };
const GLASS: Timbre = { ratio: 2, partial: 0.35, ring: 2, wave: 'sine' };
const TIMBRE: Readonly<Record<string, Timbre>> = { woodblock: WOOD, riso: WOOD, 'cut-paper': WOOD, bauhaus: WOOD, pastel: GLASS, deco: GLASS };

/** Fewest milliseconds between two notes of one planet: faster than this they merge into a patter, not a buzz. */
const MIN_GAP_MS = 110;

/**
 * Whether a planet passed its line between two looks `days` apart, its longitude going from `a` to `b` (radians): a
 * jump across 0 either way (as time runs forwards or back), or more than half a lap of its `period` (days), when it
 * passes every time as far as the ear can tell.
 */
export const passes = (a: number, b: number, days: number, period: number): boolean => Math.abs(b - a) > Math.PI || Math.abs(days) > period / 2;

export class Sonification {
  private ctx: AudioContext | null = null;
  private out: GainNode | null = null;
  /** Each planet's longitude when last looked at, and the day then. */
  private last: { day: number; lon: number[] } | null = null;
  private lastNote = new Map<PlanetName, number>();
  on = false;

  /** Whether this browser can make sound at all. */
  get available(): boolean {
    return typeof AudioContext !== 'undefined';
  }

  /** Switch the sound on (only ever from a click or a key) or off; resolves to whether it is on. */
  async set(on: boolean): Promise<boolean> {
    if (on && !this.available) return false;
    this.on = on;
    this.last = null;
    if (on) {
      if (!this.ctx) {
        this.ctx = new AudioContext();
        const comp = this.ctx.createDynamicsCompressor();
        this.out = this.ctx.createGain();
        this.out.gain.value = 0.32;
        this.out.connect(comp).connect(this.ctx.destination);
      }
      await this.ctx.resume().catch(() => undefined);
    } else await this.ctx?.suspend().catch(() => undefined);
    return this.on;
  }

  /** After each drawing: sound every planet that has passed its line since the last. */
  tick(app: App): void {
    const ctx = this.ctx;
    if (!this.on || !ctx || ctx.state !== 'running') return;
    const day = app.sim.day, lon = PLANETS.map(p => heliocentric(p.name, day).lon), last = this.last;
    this.last = { day, lon };
    // only the sky running is heard: not a jump's two dates (a moment, a new date, the year dragged along)
    if (!last || !app.sim.playing || day === last.day || Math.abs(day - last.day) > app.sim.pace * 0.5) return;
    const now = performance.now(), timbre = TIMBRE[app.style.key] ?? BELL;
    PLANETS.forEach((p, i) => {
      if (!passes(last.lon[i]!, lon[i]!, day - last.day, periodDays(p.name)) || now - (this.lastNote.get(p.name) ?? -1e9) < MIN_GAP_MS) return;
      this.lastNote.set(p.name, now);
      this.note(hz(NOTE[p.name]), p.k, timbre);
    });
  }

  /** One note: a quick strike and a long ring, with an overtone that fades first. */
  private note(f: number, k: number, tb: Timbre): void {
    const ctx = this.ctx!, t0 = ctx.currentTime + 0.01, low = k >= 4;
    const ring = tb.ring * (low ? 2.2 : 1), level = low ? 0.5 : 0.3;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.exponentialRampToValueAtTime(level, t0 + 0.006);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + ring);
    env.connect(this.out!);
    const main = ctx.createOscillator();
    main.type = tb.wave;
    main.frequency.value = f;
    main.connect(env);
    const over = ctx.createOscillator(), overGain = ctx.createGain();
    over.frequency.value = f * tb.ratio;
    overGain.gain.setValueAtTime(tb.partial, t0);
    overGain.gain.exponentialRampToValueAtTime(0.0001, t0 + ring * 0.35);
    over.connect(overGain).connect(env);
    for (const o of [main, over]) {
      o.start(t0);
      o.stop(t0 + ring + 0.05);
    }
    main.onended = () => env.disconnect();
  }
}

/** The line the planets sound on, drawn over the From above plan while the sound is on. */
export function drawSoundLine(ctx: CanvasRenderingContext2D, app: App): void {
  const k = 1 / app.renderer.designScale, from = planRadius(0.3), to = planRadius(app.layers.dwarfs ? 50 : 32);
  haloStroke(ctx, k, 1.1, () => polyline(ctx, [[C[0] + from, C[1]], [C[0] + to, C[1]]]), GOLD, [2, 5]);
  text(ctx, app, [C[0] + to, C[1] - 8 * k], t('sound.line'), 'right', 0.85);
}
