/**
 * Key moments: the best of the jump-to presets, always in view as a small timeline in date order (a rail down the
 * left of a wide screen, a strip of chips on a narrower one), so the dates worth seeing invite a click instead of
 * waiting behind the "Jump to" menu, which still lists them all. Moments with a journey to fly say so. The plans show
 * the solar system's moments; the Earth and Moon view the story of spaceflight.
 */
import type { ViewId } from './bodies';
import { dateLong } from './format';
import { presetById, PRESETS, type Preset } from './presets';
import { SPACEFLIGHT_FEATURED } from './spaceflight';
import { VIEWS } from './views';

/** The featured moments of the plans, with the short name each goes by on the timeline. */
export const FEATURED: readonly [id: string, short: string][] = [
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
  'The space age': 'First',
  'To the Moon': 'To the Moon',
  'Space stations': 'Station',
  Satellites: 'Satellites',
  Next: 'Planned',
};

const PLAY = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l12.5-7.5z"/></svg>';

export interface Moments {
  /** Show the timeline of the view on show, marking the moment on show (the preset whose geometry is drawn), or none. */
  refresh(active: string | null, view: ViewId): void;
}

export function wireMoments(hooks: { open(id: string): void; openAll(): void }): Moments {
  const list = document.getElementById('moments-list')!, all = document.getElementById('moments-all')!, title = document.getElementById('moments-title')!;
  const lists = { solar: FEATURED, earth: SPACEFLIGHT_FEATURED } as const;
  const buttons = Object.entries(lists).flatMap(([family, entries]) => {
    const featured = entries.map(([id, short]) => ({ p: presetById(id), short })).filter((m): m is { p: Preset; short: string } => m.p !== undefined);
    // "next" moments are worked out for today, so the order is too
    featured.sort((a, b) => a.p.day() - b.p.day());
    return featured.map(({ p, short }) => ({ family, b: momentButton(p, short) }));
  });
  function momentButton(p: Preset, short: string): HTMLButtonElement {
    const j = p.journey?.(), when = dateLong(p.day(), true), year = when.slice(-4);
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
  }
  all.textContent = `All ${PRESETS.length} moments`;
  all.addEventListener('click', () => hooks.openAll());
  let shown: string | null = null;
  return {
    refresh(active, view) {
      const family = VIEWS[view].family;
      for (const { family: f, b } of buttons) {
        b.parentElement!.hidden = f !== family;
        if (b.dataset.preset === active) b.setAttribute('aria-current', 'true');
        else b.removeAttribute('aria-current');
      }
      if (shown !== family) {
        shown = family;
        title.textContent = family === 'earth' ? 'Spaceflight' : 'Key moments';
        list.scrollTop = list.scrollLeft = 0;
      }
    },
  };
}
