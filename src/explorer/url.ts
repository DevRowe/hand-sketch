/**
 * The explorer's state in the address bar (`#style=pastel&view=wake&date=1977-08-20&...`), so any moment can be
 * shared or bookmarked. Unknown or malformed values are ignored rather than trusted.
 */
import { parseIsoDate } from './format';

export interface UrlState {
  style?: string;
  view?: 'sky' | 'wake';
  day?: number;
  pace?: number;
  reverse?: boolean;
  trails?: boolean;
  span?: number;
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
  if (view === 'sky' || view === 'wake') out.view = view;
  const day = date ? parseIsoDate(date) : null;
  if (day !== null) out.day = day;
  const pace = num(q.get('pace')), span = num(q.get('span'));
  if (pace !== undefined) out.pace = pace;
  if (span !== undefined) out.span = span;
  if (q.get('reverse') === '1') out.reverse = true;
  if (q.get('trails') === '0') out.trails = false;
  if (q.get('trails') === '1') out.trails = true;
  if (body && /^[a-z]{3,10}$/.test(body)) out.body = body;
  if (preset && /^[a-z0-9-]{2,40}$/.test(preset)) out.preset = preset;
  return out;
}

export function writeUrl(s: Record<string, string | number | boolean | undefined>): void {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(s)) {
    if (v === undefined || v === false) continue;
    q.set(k, v === true ? '1' : typeof v === 'number' ? String(Math.round(v * 1e4) / 1e4) : v);
  }
  const hash = q.toString();
  if (`#${hash}` !== location.hash) history.replaceState(null, '', hash ? `#${hash}` : location.pathname + location.search);
}
