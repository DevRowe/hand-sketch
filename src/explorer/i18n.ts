/**
 * The explorer's interface words in one table, ready for translation: the menus and their tooltips, the controls'
 * spoken labels, and every passing message (toasts and announcements). Only English exists; a translation is a
 * second table with the same keys (any key it leaves out falls back to English).
 *
 * Long-form words live beside the data they describe and are translated there: the fact cards and the guide in
 * `content/`, the moments' cards in `presets.ts`, `comets.ts`, `eclipse.ts` and `spaceflight.ts`, the tour's stops in
 * `content/tour.ts` and the Scale sheet in `content/scale.ts`.
 *
 * Static words in `explorer/index.html` carry their key (`data-i18n` for the text, `data-i18n-title` and
 * `data-i18n-label` for the tooltip and the spoken label): `localize` sets them from this table at start, so the
 * page's English there is only what shows before the script runs, and a test keeps the two in step.
 */

const EN = {
  // the menus: the word on each button, and its tooltip (with its key)
  'menu.moments': 'Moments',
  'menu.moments.title': 'Moments: key moments, journeys and the guided tour (J)',
  'menu.sky': 'Sky',
  'menu.sky.title': 'Sky: look up tonight, the Moon and eclipses, comets, seasons (K)',
  'menu.scale': 'Scale',
  'menu.scale.title': 'Scale: sizes side by side, true distances, beyond Neptune, the galaxy (C)',
  'menu.look': 'Look',
  'menu.look.title': 'Look: the visual style, trails, names, zoom and sound (S)',
  'menu.you': 'You',
  'menu.you.title': 'You: share this moment, save a picture or a clip, fly your years (Y)',
  'menu.guide': 'Guide',
  'menu.guide.title': 'Guide: the bodies, how to read the views, keys and sources (G)',
  'menu.look.label': 'Look (now {style}): visual style, trails, names, zoom and sound',

  // the dock's More, which holds the finer time controls
  'dock.more': 'More time controls: speed, direction and the year',
  'dock.fewer': 'Fewer time controls',

  // the tour
  'tour.start': 'Take the guided tour',
  'tour.short': 'Guided tour',
  'tour.lede': 'Two minutes, eight stops: from today’s sky to Apollo, Voyager, Halley’s Comet and the edge of the Sun’s realm.',
  'tour.step': 'Stop {n} of {of}',
  'tour.back': 'Previous stop',
  'tour.next': 'Next stop',
  'tour.pause': 'Pause the tour',
  'tour.play': 'Play the tour',
  'tour.exit': 'End the tour',
  'tour.finish': 'Done',

  // stepping through the moments
  'moment.prev': 'Previous moment (←)',
  'moment.next': 'Next moment (→)',
  'moment.of': 'Moment {n} of {of}',
  'moment.last': 'Last seen',

  // sound
  'sound.on': 'Sound on: each planet plays its note as it passes the line to the right of the Sun.',
  'sound.slow': 'Sound on. At this speed the planets pass their line only now and then: try a year a second to hear the inner ones patter.',
  'sound.off': 'Sound off.',
  'sound.none': 'Sound is not available in this browser.',
  'sound.line': '♪ each planet sounds as it crosses',

  // a clip
  'clip.recording': 'Recording {s} seconds of the sky…',
  'clip.saved': 'Clip saved to your downloads.',
  'clip.failed': 'The clip could not be made here.',
  'clip.none': 'This browser cannot record a clip.',

  // passing messages
  'toast.reduced': 'Paused, as your device asks for reduced motion. Press play to set the planets moving.',
  'toast.reducedNow': 'Paused, as your device now asks for reduced motion. Press play to set the planets moving.',
  'toast.earth': 'The Earth and the Moon at true scale: the Moon is ~30 Earths away. Zoom in on the Earth to see where the stations fly.',
  'toast.hidden': 'Controls hidden. Press H or tap the sky with two fingers to bring them back.',
  'toast.noFullscreen': 'Full screen is not available here.',
  'toast.copied': 'Link copied. It opens paused on {date}, just as you see it.',
  'toast.copyBelow': 'Copy the link below to share this moment.',
  'toast.drawing': 'Drawing your picture…',
  'toast.pictureSaved': 'Picture saved to your downloads.',
  'toast.pictureFailed': 'The picture could not be made here.',

  // what the screen reader hears as bodies are stepped through (N)
  'announce.body': '{name}. {facts}',
  'announce.none': 'Nothing to step through in this view.',
} as const;

export type MessageKey = keyof typeof EN;
type Catalog = Partial<Record<MessageKey, string>>;

/** Every table there is, by language tag. */
const CATALOGS: Readonly<Record<string, Catalog>> = { en: EN };

let table: Catalog = EN;

/** Use the table for `lang` ("fr-CA" falls back to "fr", then to English). */
export function setLocale(lang: string): void {
  const base = lang.toLowerCase().split('-')[0] ?? 'en';
  table = CATALOGS[lang.toLowerCase()] ?? CATALOGS[base] ?? EN;
}

/** The words for `key`, with `{name}` placeholders filled from `vars`. */
export function t(key: MessageKey, vars?: Readonly<Record<string, string | number>>): string {
  const s: string = table[key] ?? EN[key];
  return vars ? s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : s;
}

/** Whether `key` names a message (for words keyed in the page). */
export const isKey = (key: string): key is MessageKey => key in EN;

/** Set the keyed words of the page (`data-i18n`, `data-i18n-title`, `data-i18n-label`) from the table. */
export function localize(root: ParentNode = document): void {
  for (const el of root.querySelectorAll<HTMLElement>('[data-i18n]')) {
    const k = el.dataset.i18n!;
    if (isKey(k)) el.textContent = t(k);
  }
  for (const el of root.querySelectorAll<HTMLElement>('[data-i18n-title]')) {
    const k = el.dataset.i18nTitle!;
    if (isKey(k)) el.title = t(k);
  }
  for (const el of root.querySelectorAll<HTMLElement>('[data-i18n-label]')) {
    const k = el.dataset.i18nLabel!;
    if (isKey(k)) el.setAttribute('aria-label', t(k));
  }
}

/** English, for tests that hold the page's fallbacks to the table. */
export const ENGLISH: Readonly<Record<MessageKey, string>> = EN;
