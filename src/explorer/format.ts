/**
 * Words and numbers for the explorer's readouts: calendar dates from day counts, paces in plain units ("1 month a
 * second"), and the logarithmic sliders that choose them.
 */
import { dayOf, msOf } from '../scenes/solar/ephemeris';
import { DAY, MONTH, PACE_MAX, PACE_MIN, SPAN_MAX, SPAN_MIN, WEEK, YEAR } from './sim';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** "18 Sep 2026" (UTC calendar, proleptic Gregorian). */
export function dateLabel(day: number): string {
  const d = new Date(msOf(day));
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** "18 September 2026", for screen readers and cards. */
export function dateLong(day: number): string {
  const d = new Date(msOf(day));
  return `${d.getUTCDate()} ${MONTHS_LONG[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** "2026-09-18", for date inputs and links. */
export function isoDate(day: number): string {
  const d = new Date(msOf(day)), y = d.getUTCFullYear();
  return `${String(y).padStart(4, '0')}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

/** Day count of an ISO date ("2026-09-18", noon UTC so the calendar day is unambiguous), or null. */
export function parseIsoDate(s: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const ms = Date.UTC(y, mo - 1, d, 12);
  const back = new Date(ms);
  // Date.UTC maps years 0..99 to 1900..1999; set the full year explicitly
  back.setUTCFullYear(y, mo - 1, d);
  if (back.getUTCMonth() !== mo - 1 || back.getUTCDate() !== d) return null;
  return dayOf(back.getTime());
}

/** A day count as a fractional year (for the scrubber), and back: 1 January 2000 is 2000.0. */
export const yearOf = (day: number): number => 2000 + (day + 0.5) / 365.2425;
export const dayOfYear = (year: number): number => (year - 2000) * 365.2425 - 0.5;

/** The day count of now. */
export const today = (): number => dayOf(Date.now());

const UNITS: readonly [number, string, string][] = [
  [YEAR, 'year', 'years'],
  [MONTH, 'month', 'months'],
  [WEEK, 'week', 'weeks'],
  [DAY, 'day', 'days'],
  [1 / 24, 'hour', 'hours'],
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

/** "1 month / s": a pace in days per second. */
export const paceLabel = (pace: number): string => `${spanLabel(pace)} / s`;

/** A value between `lo` and `hi` on a logarithmic slider position 0..1, and back. */
export const fromLog = (u: number, lo: number, hi: number): number => Math.exp(Math.log(lo) + (Math.log(hi) - Math.log(lo)) * u);
export const toLog = (v: number, lo: number, hi: number): number => (Math.log(v) - Math.log(lo)) / (Math.log(hi) - Math.log(lo));

export const paceFromSlider = (u: number): number => fromLog(u, PACE_MIN, PACE_MAX);
export const paceToSlider = (pace: number): number => toLog(pace, PACE_MIN, PACE_MAX);
export const spanFromSlider = (u: number): number => fromLog(u, SPAN_MIN, SPAN_MAX);
export const spanToSlider = (span: number): number => toLog(span, SPAN_MIN, SPAN_MAX);
