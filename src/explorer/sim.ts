/**
 * The explorer's small simulation: a calendar date that runs at a chosen pace (forwards or back), the ambient beat
 * that keeps twinkles and sparkles alive at any pace, and the trails, which fade and unspool towards what the viewer
 * asks for. Pure bookkeeping advanced by wall-clock seconds; `sky()` hands a moment to the scenes.
 */
import { dayOf } from '../scenes/solar/ephemeris';
import { datedSky, type Sky } from '../scenes/solar/sky';

export const SECOND = 1 / 86400;
export const MINUTE = 1 / 1440;
export const HOUR = 1 / 24;
export const DAY = 1;
export const WEEK = 7;
export const YEAR = 365.25;
export const MONTH = YEAR / 12;

/** Slowest and fastest pace in any view, days of sky per second (each view narrows it: `views.ts`). */
export const PACE_MIN = SECOND;
export const PACE_MAX = 25 * YEAR;

/** Shortest and longest trail in any view, days. */
export const SPAN_MIN = HOUR;
export const SPAN_MAX = 200 * YEAR;

/** The dates the explorer runs over (the ephemeris is fitted to 3000 BC .. AD 3000). */
export const DAY_MIN = dayOf(Date.UTC(1000, 0, 1));
export const DAY_MAX = dayOf(Date.UTC(3000, 0, 1));

/** The Earth among the sky's bodies (planets 0..7, from Mercury). */
const EARTH_K = 2;
/** Seconds for the trails to fade in or out, and to unspool from their bodies. */
const FADE = 0.45;
const UNSPOOL = 1.4;

export const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));

export interface Trails {
  /** Whether the viewer wants trails. */
  on: boolean;
  /** How far back they reach, days. */
  span: number;
  /** 0..1 strength the viewer asks for when on. */
  opacity: number;
  /** Strength drawn now, easing towards `on ? opacity : 0`. */
  alpha: number;
  /** 0..1 unspooled; restarts from 0 each time trails come back on. */
  reveal: number;
}

export class Sim {
  /** Days from J2000.0. */
  day: number;
  /** Days of sky per second of viewing. */
  pace: number;
  /** 1 runs forwards, -1 back. */
  direction: 1 | -1 = 1;
  playing = true;
  /** Trails change at once instead of fading and unspooling (reduced motion). */
  instant = false;
  /** Ambient drawn frames: 12 a second while playing. */
  beat = 0;
  trails: Trails;
  /** A lifetime the wakes draw (your years, from the day you were born): Earth's wake reaches all the way back to it. */
  life: number | null = null;

  constructor(day: number, pace: number, trails: Pick<Trails, 'on' | 'span' | 'opacity'>) {
    this.day = clamp(day, DAY_MIN, DAY_MAX);
    this.pace = clamp(pace, PACE_MIN, PACE_MAX);
    this.trails = { ...trails, alpha: 0, reveal: 0 };
  }

  /** Signed days per second. */
  get velocity(): number { return this.direction * this.pace; }

  /** Whether the trails are still easing: the picture changes even while paused. */
  get settling(): boolean {
    const t = this.trails, target = t.on ? t.opacity : 0;
    return Math.abs(t.alpha - target) > 1e-4 || (t.on && t.reveal < 1);
  }

  /** Move on `dt` seconds of wall-clock time. Returns true when the date ran into the end of the range. */
  advance(dt: number): boolean {
    let stopped = false;
    if (this.playing) {
      const next = this.day + this.velocity * dt;
      this.day = clamp(next, DAY_MIN, DAY_MAX);
      if (this.day !== next) {
        this.playing = false;
        stopped = true;
      }
      this.beat += 12 * dt;
    }
    const t = this.trails, target = t.on ? t.opacity : 0;
    if (this.instant) {
      t.alpha = target;
      t.reveal = t.on ? 1 : 0;
      return stopped;
    }
    const step = dt / FADE;
    t.alpha = t.alpha < target ? Math.min(target, t.alpha + step) : Math.max(target, t.alpha - step);
    if (t.on) t.reveal = Math.min(1, t.reveal + dt / UNSPOOL);
    else if (t.alpha === 0) t.reveal = 0;
    return stopped;
  }

  /** Jump to a date; the trails unspool afresh from the new place. */
  jump(day: number): void {
    this.day = clamp(day, DAY_MIN, DAY_MAX);
    this.trails.reveal = 0;
  }

  /** The sky to draw now. */
  sky(): Sky {
    const t = this.trails, eased = t.reveal * t.reveal * (3 - 2 * t.reveal);
    const life = this.life === null ? {} : { life: { since: this.life, k: EARTH_K } };
    return datedSky({ day: this.day, beat: this.beat, trails: { span: t.span, reveal: eased, alpha: t.alpha, ...life } });
  }
}
