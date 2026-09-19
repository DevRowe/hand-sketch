// The promo's storyboard: the shots the live explorer is asked to perform, and the edit that cuts them to the music.
// Everything is counted in output frames at 30 a second; the music runs at 112.5 beats a minute, so a beat is exactly 16
// frames and a bar 64, and every cut lands on a beat. Functions given as `setup`, `ready`, `at`, `each` and `click` run
// inside the page with `X = window.__explorer` (they are sent as source, so they close over nothing here).
export const FPS = 30, BEAT = 16, BAR = 64;

export const STYLES = ['blueprint', 'woodblock', 'sumi', 'etching', 'riso', 'stipple', 'pastel', 'cut-paper', 'bauhaus', 'deco'];
/** The styles on pale paper, where the captions are set in ink rather than cream. */
export const PALE = new Set(['sumi', 'etching', 'stipple', 'bauhaus']);
export const STYLE_NAMES = {
  blueprint: 'Blueprint', woodblock: 'Woodblock', sumi: 'Sumi ink', etching: 'Etching', riso: 'Riso print',
  stipple: 'Stipple', pastel: 'Pastel', 'cut-paper': 'Cut paper', bauhaus: 'Bauhaus', deco: 'Art Deco',
};

const markClick = id => `X => { const a = X.app, m = a.markOf(${JSON.stringify(id)}, true); return a.renderer.toScreen(m.x, m.y); }`;
const press = sel => `X => document.querySelector(${JSON.stringify(sel)}).click()`;
// the Earth and Moon view maps its own lens, so its push is a zoom about the Earth rather than a look at a design point
const earthZoom = k => `X => { const [x, y] = X.app.earthOnScreen(); X.app.zoomBy(${k}, x, y); }`;

// the wake and the plan, framed for a wide frame: the Sun right of centre so the wakes fill the left
const WAKE = [640, 560], SKY = [540, 540];
// the interface's list of featured moments, put away where a caption stands
const NO_LIST = ['#moments'];

/** The shots that are captured once each. `ui` shots show the app's own interface, drawn larger than life. */
export const SHOTS = [
  { id: 'hook', hash: '#style=pastel&view=wake', clean: true, intro: true, warm: 0, frames: 2 * BAR, speed: 1.7, cam: { at: WAKE, from: 1.3, to: 1.55, span: 2 * BAR } },
  { id: 'above', hash: '#style=woodblock&view=sky&pace=30', clean: true, warm: 4, frames: 5 * BEAT, cam: { at: SKY, from: 1.2, to: 1.4, span: 5 * BEAT } },
  { id: 'motion', hash: '#style=cut-paper&view=wake&pace=30', clean: true, warm: 4, frames: 6 * BEAT, cam: { at: WAKE, from: 1.45, to: 1.8, span: 6 * BEAT } },
  { id: 'earth', hash: '#style=sumi&view=earth&pace=0.02', clean: true, warm: 2, frames: 5 * BEAT, ready: earthZoom(5), each: earthZoom(1.016) },
  { id: 'card', ui: true, hash: '#style=bauhaus&view=sky&date=2026-09-19', hide: NO_LIST, warm: 2, frames: 6 * BEAT, at: { 0: `X => X.app.play(true)` }, click: { 22: markClick('saturn') } },
  { id: 'apollo', ui: true, hash: '#style=blueprint&view=earth', hide: NO_LIST, warm: 1.5, frames: 6 * BEAT + 40, journey: true, speed: f => (f < 40 ? 1.5 : 5),
    at: { 0: `X => X.panel.openPreset('apollo-11-close')`, 20: press('[data-act="journey"]') } },
  { id: 'mars', ui: true, hash: '#style=deco&view=sky', hide: NO_LIST, warm: 1.5, frames: 4 * BEAT + 50, journey: true, speed: f => (f < 40 ? 1.5 : 3),
    at: { 0: `X => X.panel.openPreset('mars-window')`, 12: press('[data-act="journey"]'), 16: `X => X.panel.close()`, 20: `X => X.app.panBy(230, -90)` } },
  { id: 'life', ui: true, hash: '#style=sumi&view=wake', store: { 'explorer.birthday': '1991-04-12' }, hide: NO_LIST, warm: 1.5, frames: 250, journey: true,
    // the flight (24 s of the app's time) runs from frame 30 and lands on the card at frame 174
    speed: f => (f < 30 ? 1 : f < 174 ? 5 : 1),
    at: { 0: `X => X.panel.openMenu('you')`, 30: press('[data-act="life"]') } },
  { id: 'end', hash: '#style=blueprint&view=wake&pace=30', clean: true, warm: 4, frames: 7 * BEAT, cam: { at: WAKE, from: 1.75, to: 1.5, span: 7 * BEAT } },
];

/** The styles montage: one continuous move cut between styles, each style its own page load run to the same moment. */
const FLASH_CUT = 8, FLASH_CUTS = 16;
export const FLASH = Array.from({ length: FLASH_CUTS }, (_, k) => {
  const style = STYLES[(k * 3 + 4) % STYLES.length], view = (k + (k >= STYLES.length ? 1 : 0)) % 2 ? 'sky' : 'wake', span = FLASH_CUT * FLASH_CUTS;
  return {
    id: `flash-${String(k).padStart(2, '0')}`, style, hash: `#style=${style}&view=${view}&pace=60`, clean: true, warm: 3 + (k * FLASH_CUT) / FPS, frames: FLASH_CUT,
    cam: view === 'wake' ? { at: WAKE, from: 1.45, to: 2, span, offset: k * FLASH_CUT } : { at: SKY, from: 1.25, to: 1.7, span, offset: k * FLASH_CUT },
  };
});

/**
 * The edit: each entry plays `frames` of `shot` from `from`; `caption` is `[kicker, headline]` (headline words rise one
 * by one), `sub` a second line that follows, `tap` marks the shot's recorded click.
 */
export const EDIT = [
  { shot: 'hook', from: 0, frames: 2 * BAR, captions: [{ at: 6, frames: 56, text: ['', 'The solar system,'] }, { at: 64, frames: 60, text: ['', 'drawn by hand. Live.'] }] },
  { shot: 'above', from: 0, frames: 5 * BEAT, captions: [{ at: 0, text: ['Three views', 'From above'] }] },
  { shot: 'motion', from: 0, frames: 6 * BEAT, captions: [{ at: 0, text: ['Three views', 'In motion'], sub: 'every orbit drawn out into a helix' }] },
  { shot: 'earth', from: 0, frames: 5 * BEAT, captions: [{ at: 0, text: ['Three views', 'Earth & Moon, up close'] }] },
  ...FLASH.map((s, k) => ({ shot: s.id, from: 0, frames: FLASH_CUT, flash: { k, name: STYLE_NAMES[s.style] } })),
  { shot: 'card', from: 0, frames: 6 * BEAT, tap: true, captions: [{ at: 0, text: ['Every world has a story', 'Tap any planet'] }] },
  { shot: 'apollo', from: 34, frames: 6 * BEAT, captions: [{ at: 0, text: ['Jump to real moments', 'Fly Apollo 11'] }] },
  { shot: 'mars', from: 46, frames: 4 * BEAT, captions: [{ at: 0, text: ['…and the ones to come', 'The next Mars window'] }] },
  { shot: 'life', from: 174 - BAR - 6, frames: 2 * BAR, captions: [{ at: 0, frames: 60, text: ['Make it yours', 'Your life, as a helix'] }, { at: 72, frames: 52, text: ['Make it yours', 'Your age on every planet'] }] },
  { shot: 'end', from: 0, frames: 7 * BEAT, end: true },
];
export const FLASH_AT = 2 * BAR + 16 * BEAT, FLASH_FRAMES = FLASH_CUT * FLASH_CUTS;
export const TOTAL = EDIT.reduce((n, e) => n + e.frames, 0);
