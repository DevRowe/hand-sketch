/**
 * The explorer's state in the address bar (`#style=pastel&view=wake&date=1977-08-20&...`), so any moment can be
 * shared or bookmarked. Unknown or malformed values are ignored rather than trusted.
 */
import { parseIsoDate } from './format';

export interface UrlState {
  style?: string;
  view?: 'sky' | 'wake' | 'earth';
  day?: number;
  pace?: number;
  reverse?: boolean;
  trails?: boolean;
  span?: number;
  /** Trail strength, 0..1. */
  opacity?: number;
  /** The camera: its zoom, and the design point in the middle of the free part of the screen. */
  zoom?: number;
  at?: [number, number];
  /** A shared life's helix: the day it starts. */
  born?: number;
  body?: string;
  preset?: string;
}

const num = (v: string | null): number | undefined => {
  if (v === null || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

export function readUrl(hash = location.hash): UrlState {
  const q = new URLSearchParams(hash.replace(/^#/, '')), out: UrlState = {};
  const style = q.get('style'), view = q.get('view'), date = q.get('date'), body = q.get('body'), preset = q.get('preset');
  if (style && /^[a-z-]{2,20}$/.test(style)) out.style = style;
  if (view === 'sky' || view === 'wake' || view === 'earth') out.view = view;
  const day = date ? parseIsoDate(date) : null;
  if (day !== null) out.day = day;
  const pace = num(q.get('pace')), span = num(q.get('span'));
  if (pace !== undefined) out.pace = pace;
  if (span !== undefined) out.span = span;
  if (q.get('reverse') === '1') out.reverse = true;
  const opacity = Number(q.get('opacity') ?? NaN), zoom = num(q.get('zoom')), at = (q.get('at') ?? '').split(',').map(Number);
  if (q.get('opacity') && opacity >= 0 && opacity <= 1) out.opacity = opacity;
  if (zoom !== undefined && zoom <= 1000) out.zoom = zoom;
  if (at.length === 2 && at.every(v => Number.isFinite(v) && Math.abs(v) <= 5000)) out.at = [at[0]!, at[1]!];
  const born = q.get('born') ? parseIsoDate(q.get('born')!) : null;
  if (born !== null) out.born = born;
  if (q.get('trails') === '0') out.trails = false;
  if (q.get('trails') === '1') out.trails = true;
  if (body && /^[a-z]{3,10}$/.test(body)) out.body = body;
  if (preset && /^[a-z0-9-]{2,40}$/.test(preset)) out.preset = preset;
  return out;
}

/** The state as an address-bar hash ("#style=riso&date=1977-08-20"; empty for the defaults). */
export function hashOf(s: Record<string, string | number | boolean | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(s)) {
    if (v === undefined || v === false) continue;
    q.set(k, v === true ? '1' : typeof v === 'number' ? String(Number(v.toPrecision(5))) : v);
  }
  // commas may stand in a fragment as they are ("at=540,512"), and read better there
  const hash = q.toString().replace(/%2C/g, ',');
  return hash ? `#${hash}` : '';
}

export function writeUrl(s: Record<string, string | number | boolean | undefined>): void {
  const hash = hashOf(s);
  if (hash !== location.hash) history.replaceState(null, '', hash || location.pathname + location.search);
}
