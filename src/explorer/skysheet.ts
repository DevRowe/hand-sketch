/**
 * The Sky menu's sheet, as markup: what is up tonight (grouped by when in the night, in the colours of the sight-lines),
 * the Moon's phase and the next new and full Moons, and the seasons with the day's length where you are. Each block is
 * a pure function of the date, so the panel can redraw it as the date runs.
 */
import { dateLong } from './format';
import { phaseSvg, nextFull, nextNew } from './phase';
import { daylight, hoursLabel, nextTurn, seasonOf, subsolarLatitude } from './seasons';
import { SIDE_COLOR, SIDE_TITLE, tonight, type Side, type Sighting } from './tonight';
import { AU_KM, fromSunAu, km } from './live';

const esc = (s: string): string => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const NAMES: Readonly<Record<Sighting['id'], string>> = {
  mercury: 'Mercury', venus: 'Venus', earth: 'Earth', mars: 'Mars', jupiter: 'Jupiter', saturn: 'Saturn', uranus: 'Uranus', neptune: 'Neptune', moon: 'Moon',
};

/** "-2.4": a magnitude with a true minus sign. */
const mag = (m: number): string => (m < 0 ? `−${Math.abs(m).toFixed(1)}` : m.toFixed(1));

const ORDER: readonly Side[] = ['evening', 'night', 'morning', 'glare'];

/** Tonight's planets, grouped by when in the night they are up, each with where to look and how bright it is. */
export function tonightHtml(day: number): string {
  const t = tonight(day);
  const groups = ORDER.map(side => {
    const ps = t.planets.filter(p => p.side === side);
    if (!ps.length) return '';
    const items = ps.map(p => `<li${p.eye ? '' : ' class="faint"'}><button type="button" class="sight" data-body="${p.id}"><b>${NAMES[p.id]}</b><span class="s-where">${esc(p.where)}</span><span class="s-mag">${esc(p.bright ?? '')}${p.mag !== undefined ? ` · ${mag(p.mag)}` : ''}</span></button></li>`).join('');
    return `<div class="sky-group" style="--side:${SIDE_COLOR[side]}"><h4><span class="s-dot" aria-hidden="true"></span>${esc(SIDE_TITLE[side])}</h4><ul class="sightings">${items}</ul></div>`;
  }).join('');
  const m = t.moon, where = m.side === 'glare' ? 'lost in the Sun’s glare' : m.where;
  return `<div class="sky-moon-line">${phaseSvg(m.phase, 30)}<p><b>Moon</b>: ${esc(m.phase.name.toLowerCase())}, ${Math.round(m.phase.lit * 100)}% lit, ${esc(where)}</p></div>${groups}`;
}

/** The Moon's phase, large, with the next new and full Moons. */
export function moonHtml(day: number): string {
  const t = tonight(day), p = t.moon.phase, full = nextFull(day), fresh = nextNew(day);
  const next = full < fresh ? [['Full Moon', full], ['New Moon', fresh]] as const : [['New Moon', fresh], ['Full Moon', full]] as const;
  return `<div class="moon-now">${phaseSvg(p, 56)}<div><p class="moon-name">${esc(p.name)}</p><p class="moon-lit">${Math.round(p.lit * 100)}% of the side we see is lit</p></div></div>
    <dl class="facts live">${next.map(([name, d]) => `<div><dt>Next ${esc(name.toLowerCase())}</dt><dd>${esc(dateLong(d))}</dd></div>`).join('')}</dl>`;
}

/** Latitudes to choose from for the day's length, north and south, with a place near each. */
export const SKY_LATITUDES: readonly [number, string][] = [
  [60, '60° N (Oslo, Anchorage)'],
  [51.5, '51° N (London)'],
  [40.7, '41° N (New York, Madrid)'],
  [35.7, '36° N (Tokyo)'],
  [30, '30° N (Cairo, Shanghai)'],
  [19, '19° N (Mumbai, Mexico City)'],
  [1.3, '1° N (Singapore)'],
  [-23, '23° S (Rio de Janeiro)'],
  [-33.9, '34° S (Sydney, Cape Town)'],
  [-37.8, '38° S (Melbourne)'],
  [-45.9, '46° S (Dunedin)'],
];

/** Time zones of the southern hemisphere (by name, or by the start of it). */
const SOUTH = /^(Australia\/|Antarctica\/|America\/(Argentina|Sao_Paulo|Santiago|Montevideo|Asuncion|La_Paz|Lima|Bahia|Recife|Fortaleza|Belem|Maceio|Cuiaba|Campo_Grande|Porto_Velho|Manaus)|Pacific\/(Auckland|Chatham|Fiji|Tongatapu|Noumea|Apia|Efate|Port_Moresby|Tahiti)|Africa\/(Johannesburg|Maputo|Harare|Lusaka|Windhoek|Gaborone|Maseru|Mbabane|Lubumbashi|Luanda|Blantyre|Dar_es_Salaam)|Indian\/(Mauritius|Reunion|Antananarivo|Mayotte|Comoro))/;

/**
 * A first guess at the viewer's hemisphere: from the time zone's name, else from the clocks (where summer time runs in
 * January, it is summer in January: the south). Failing both, the north, where most people live.
 */
export function guessLatitude(): number {
  let zone = '';
  try {
    zone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? '';
  } catch {
    /* no time zone to read */
  }
  const y = new Date().getFullYear(), jan = new Date(y, 0, 1).getTimezoneOffset(), jul = new Date(y, 6, 1).getTimezoneOffset();
  return SOUTH.test(zone) || jan < jul ? -33.9 : 40.7;
}

/** A day's length, "~" where the Sun rises and sets (refraction and the terrain move it by minutes). */
const daylightLabel = (h: number): string => (h > 0 && h < 24 ? `~${hoursLabel(h)}` : hoursLabel(h));

const latLabel = (lat: number): string => `${Math.abs(lat).toFixed(0)}° ${lat >= 0 ? 'N' : 'S'}`;

/** The seasons now: in each hemisphere, where the Sun is overhead, the next solstice or equinox, the day's length. */
export function seasonsHtml(day: number, lat: number): string {
  const s = seasonOf(day), turn = nextTurn(day), sub = subsolarLatitude(day), inDays = Math.round(turn.day - day);
  const au = fromSunAu('earth', day);
  const rows = [
    ['North', `${s.part} ${s.north}`],
    ['South', `${s.part} ${s.south}`],
    ['Noon Sun overhead at', latLabel(sub)],
    [`Next: ${turn.name}`, `${dateLong(turn.day)}${inDays > 0 ? ` (in ${inDays} day${inDays === 1 ? '' : 's'})` : ' (today)'}`],
    [`Daylight at ${latLabel(lat)}`, daylightLabel(daylight(lat, day))],
    ['Sun to Earth', `${km(au * AU_KM)}`],
  ];
  return `<dl class="facts live">${rows.map(([a, b]) => `<div><dt>${esc(a!)}</dt><dd>${esc(b!)}</dd></div>`).join('')}</dl>`;
}
