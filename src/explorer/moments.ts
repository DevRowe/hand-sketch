/**
 * Key moments: the best of the jump-to presets, always in view as a small timeline in date order (a rail down the
 * left of a wide screen, a strip of chips on a narrower one), so the dates worth seeing invite a click instead of
 * waiting behind the "Jump to" menu, which still lists them all. Moments with a journey to fly say so.
 */
import { dateLong } from './format';
import { presetById, PRESETS, type Preset } from './presets';

/** The featured moments, with the short name each goes by on the timeline. */
const FEATURED: readonly [id: string, short: string][] = [
  ['apollo-11', 'Apollo 11'],
  ['voyager', 'Voyager’s Grand Tour'],
  ['mars-2003', 'Mars at its closest'],
  ['venus-transit', 'Transit of Venus'],
  ['great-conjunction', 'Great conjunction'],
  ['parade-2025', 'A planet parade'],
  ['mars-window', 'Next launch window to Mars'],
  ['next-opposition', 'Next Mars opposition'],
];

/** What kind of moment it is, in a word or two. */
const KIND: Readonly<Record<Preset['group'], string>> = {
  'Now and next': 'Coming up',
  'Launch windows': 'Launch window',
  Missions: 'Mission',
  Alignments: 'Alignment',
};

const PLAY = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l12.5-7.5z"/></svg>';

export interface Moments {
  /** Mark the moment on show (the preset whose geometry is drawn), or none. */
  refresh(active: string | null): void;
}

export function wireMoments(hooks: { open(id: string): void; openAll(): void }): Moments {
  const list = document.getElementById('moments-list')!, all = document.getElementById('moments-all')!;
  const featured = FEATURED.map(([id, short]) => ({ p: presetById(id), short })).filter((m): m is { p: Preset; short: string } => m.p !== undefined);
  // "next" moments are worked out for today, so the order is too
  featured.sort((a, b) => a.p.day() - b.p.day());
  const buttons = featured.map(({ p, short }) => {
    const j = p.journey?.(), when = dateLong(p.day()), year = when.slice(-4);
    const li = document.createElement('li'), b = document.createElement('button');
    b.type = 'button';
    b.className = 'moment';
    b.dataset.preset = p.id;
    b.title = `${p.title}, ${when}. ${p.kicker}`;
    b.setAttribute('aria-label', `${p.title}, ${when}${j ? `, with a journey: ${j.label}` : ''}`);
    b.innerHTML = `<span class="m-year"></span><span class="m-dot" aria-hidden="true"></span><span class="m-text"><span class="m-title"></span><span class="m-sub"></span></span>${j ? `<span class="m-play" aria-hidden="true">${PLAY}</span>` : ''}`;
    b.querySelector('.m-year')!.textContent = year;
    b.querySelector('.m-title')!.textContent = short;
    b.querySelector('.m-sub')!.textContent = j ? j.label : KIND[p.group];
    b.addEventListener('click', () => hooks.open(p.id));
    li.append(b);
    list.append(li);
    return b;
  });
  all.textContent = `All ${PRESETS.length} moments`;
  all.addEventListener('click', () => hooks.openAll());
  return {
    refresh(active) {
      for (const b of buttons) {
        if (b.dataset.preset === active) b.setAttribute('aria-current', 'true');
        else b.removeAttribute('aria-current');
      }
    },
  };
}
