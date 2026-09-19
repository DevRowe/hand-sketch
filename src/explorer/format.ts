/**
 * Words and numbers for the explorer's readouts: calendar dates from day counts, paces in plain units ("1 month a
 * second"), and the logarithmic sliders that choose them.
 */
import { dayOf, msOf } from '../scenes/solar/ephemeris';
import { DAY, HOUR, MINUTE, MONTH, SECOND, WEEK, YEAR } from './sim';
import { VIEWS, type Range } from './views';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/**
 * The calendar the viewer lives by. A running sky is a real instant, read in the viewer's own time zone: at 07:30 on a
 * Saturday in Perth the UTC calendar still reads Friday, and "today" must be Perth's Saturday. A fixed event (a launch,
 * a landing) is dated in UTC, as its card says, so its date reads the same everywhere.
 */
const parts = (day: number, utc: boolean): { y: number; m: number; d: number } => {
  const t = new Date(msOf(day));
  return utc ? { y: t.getUTCFullYear(), m: t.getUTCMonth(), d: t.getUTCDate() } : { y: t.getFullYear(), m: t.getMonth(), d: t.getDate() };
};

/** "18 Sep 2026": the viewer's calendar date of a moment, or its UTC date. */
export function dateLabel(day: number, utc = false): string {
  const { y, m, d } = parts(day, utc);
  return `${d} ${MONTHS[m]} ${y}`;
}

/** "18 September 2026", for screen readers and cards. */
export function dateLong(day: number, utc = false): string {
  const { y, m, d } = parts(day, utc);
  return `${d} ${MONTHS_LONG[m]} ${y}`;
}

/** "2026-09-18": the viewer's calendar date of a moment, for date inputs and links. */
export function isoDate(day: number): string {
  const { y, m, d } = parts(day, false);
  return `${String(y).padStart(4, '0')}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Day count of an ISO date ("2026-09-18") at noon on that date in the viewer's time zone, or null. */
export function parseIsoDate(s: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  // new Date(y, ...) maps years 0..99 to 1900..1999; set the full year explicitly
  const t = new Date(2000, mo - 1, d, 12);
  t.setFullYear(y, mo - 1, d);
  if (t.getMonth() !== mo - 1 || t.getDate() !== d) return null;
  return dayOf(t.getTime());
}

/** A day count as a fractional year (for the scrubber), and back: 1 January 2000 is 2000.0. */
export const yearOf = (day: number): number => 2000 + (day + 0.5) / 365.2425;
export const dayOfYear = (year: number): number => (year - 2000) * 365.2425 - 0.5;

/** The day count of now: the true instant, whose date `dateLabel` reads in the viewer's calendar. */
export const today = (): number => dayOf(Date.now());

/** Whether an ISO date lies after the viewer's today (a birthday cannot). */
export const isFuture = (iso: string, now = today()): boolean => iso > isoDate(now);

const UNITS: readonly [number, string, string][] = [
  [YEAR, 'year', 'years'],
  [MONTH, 'month', 'months'],
  [WEEK, 'week', 'weeks'],
  [DAY, 'day', 'days'],
  [HOUR, 'hour', 'hours'],
  [MINUTE, 'minute', 'minutes'],
  [SECOND, 'second', 'seconds'],
];

/** "1 month", "2.5 years", "6 hours": a span of days in the largest unit that reads well. */
export function spanLabel(days: number): string {
  for (const [size, one, many] of UNITS) {
    if (days >= size * 0.995 || size === UNITS[UNITS.length - 1]![0]) {
      const n = days / size, r = n >= 10 ? Math.round(n) : Math.round(n * 10) / 10;
      return `${r} ${r === 1 ? one : many}`;
    }
  }
  return `${days} days`;
}

/** "1 month / s": a pace in days per second; a second a second is real time. */
export const paceLabel = (pace: number): string => (Math.abs(pace / SECOND - 1) < 0.02 ? 'Real time' : `${spanLabel(pace)} / s`);

/** A value between `lo` and `hi` on a logarithmic slider position 0..1, and back. */
export const fromLog = (u: number, lo: number, hi: number): number => Math.exp(Math.log(lo) + (Math.log(hi) - Math.log(lo)) * u);
export const toLog = (v: number, lo: number, hi: number): number => (Math.log(v) - Math.log(lo)) / (Math.log(hi) - Math.log(lo));

/** The pace and trail sliders over a view's range (the plans' by default). */
export const paceFromSlider = (u: number, r: Range = VIEWS.sky.pace): number => fromLog(u, r.min, r.max);
export const paceToSlider = (pace: number, r: Range = VIEWS.sky.pace): number => toLog(pace, r.min, r.max);
export const spanFromSlider = (u: number, r: Range = VIEWS.sky.span): number => fromLog(u, r.min, r.max);
export const spanToSlider = (span: number, r: Range = VIEWS.sky.span): number => toLog(span, r.min, r.max);
