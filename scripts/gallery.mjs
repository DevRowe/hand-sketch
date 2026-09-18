#!/usr/bin/env node
// The gallery set ("Many Hands"): web delivery for all twenty pieces plus a board grouped by visual style.
//
// For every entry of src/scenes/gallery/catalog.json this runs `scripts/render.mjs --web` (12 fps H.264 + VP9 with a
// keyframe at loopFrom, poster PNG + JPEG, a seam check), then writes manifest.json and board.html next to the media.
// The board plays the hero on load (intro + two loops, then rests on its poster) and shows every other piece as its
// poster, grouped under its style with a note on the technique, playing on tap; prefers-reduced-motion gets posters.
//
// Usage (after `npm run build`, or via `npm run gallery`):
//   node scripts/gallery.mjs                 render all twenty into output/gallery/ and write the board
//   node scripts/gallery.mjs --only G01,G08  re-render some, rewrite the board from every sidecar present
//   node scripts/gallery.mjs --verify        also render each twice in independent page loads and fail on any difference
//   node scripts/gallery.mjs --out dir       output directory (default output/gallery/)
//   node scripts/gallery.mjs --board-only    just rewrite board.html and manifest.json from existing sidecars
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { BOARD_SCRIPT, esc, loadEntries, readCatalog, renderSet, setOptions } from './lib/web-set.mjs';

const opts = setOptions(process.argv.slice(2), 'output/gallery');
const { outDir } = opts;
const catalog = readCatalog('src/scenes/gallery/catalog.json');

/** What each visual treatment is, in the order the board presents them. */
const STYLES = [
  ['Woodblock', 'Flat carved colour blocks, a key block printed a hair out of register, woodgrain showing through the ink.'],
  ['Sumi brush', 'Soot ink on rice paper: loaded strokes that swell and taper, dry-brush breakup, one vermilion seal.'],
  ['Blueprint and cyanotype', 'White on Prussian blue: a draughtsman\'s drawing with its construction lines, and a sun print\'s soft shadows.'],
  ['Riso poster', 'Fluorescent drum inks overprinting on stock: halftone tones at their own screen angles, misregistration, uneven ink.'],
  ['Stipple', 'Everything, sky and flock alike, built from single dots of ink.'],
  ['Etching', 'Fine sepia line and page-locked cross-hatching; tone is the density of the lines.'],
  ['Watercolour', 'Translucent glazes on cold-press paper, pigment gathering at each edge, colour bleeding wet into wet.'],
  ['Pastel on black', 'Soft chalk on dark toothy paper; light is drawn, and the paper\'s grain breaks it.'],
  ['Cut paper', 'Shapes cut with scissors from coloured sheets, layered with a little shadow under each.'],
  ['Bauhaus', 'Primary colours and pure geometry, in rhythm.'],
  ['Art deco', 'Gold line on black lacquer, symmetry and a travelling sheen.'],
  ['Continuous line', 'One black line of one weight on white, and one red sun.'],
];

if (!opts.boardOnly) renderSet(catalog, opts);
const entries = loadEntries(catalog, outDir);
const unknown = entries.filter(e => !STYLES.some(([name]) => name === e.style));
if (unknown.length) throw new Error(`no style note for: ${unknown.map(e => `${e.id} "${e.style}"`).join(', ')}`);

writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(entries.map(e => ({
  id: e.id, title: e.title, line: e.line, theme: e.theme, style: e.style, autoplay: e.autoplay, alt: e.alt,
  width: e.media.width, height: e.media.height, fps: e.media.fps,
  loopFromSeconds: e.media.loopFromSeconds, posterSeconds: e.media.poster / e.media.fps,
  video: e.media.video, poster: e.media.posterImage,
})), null, 2) + '\n');

const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const figure = (e, hero) => `
      <figure class="anim${hero ? ' hero' : ''}"${hero ? '' : ` style="flex: ${(e.media.width / e.media.height).toFixed(4)} 1 0"`} data-id="${e.id}" data-loop-from="${e.media.loopFromSeconds ?? 0}" data-poster-at="${(e.media.poster / e.media.fps).toFixed(4)}" data-autoplay="${hero && e.autoplay}">
        <div class="frame" style="aspect-ratio: ${e.media.width} / ${e.media.height}">
          <video muted playsinline preload="none" poster="${esc(e.media.posterImage.jpg)}" aria-label="${esc(e.alt)}" width="${e.media.width}" height="${e.media.height}">
            <source src="${esc(e.media.video.webm)}" type="video/webm">
            <source src="${esc(e.media.video.mp4)}" type="video/mp4">
          </video>
          <button type="button" class="control" aria-label="Play ${esc(e.title)}">Play</button>
        </div>
        <figcaption>
          <span class="meta"><span class="id">${e.id}</span><span class="theme">${esc(e.theme)}</span>${hero ? `<a class="tag" href="#${slug(e.style)}">${esc(e.style)}</a>` : ''}</span>
          <strong class="title">${esc(e.title)}</strong>
          <span class="line">${esc(e.line)}</span>${hero ? `
          <span class="idea">${esc(e.idea)}</span>` : ''}
        </figcaption>
      </figure>`;

const hero = entries.find(e => e.autoplay) ?? entries[0];
// every piece appears under its style, the hero too (only its hero copy autoplays)
const groups = STYLES.map(([name, note]) => ({ name, note, list: entries.filter(e => e.style === name) })).filter(g => g.list.length > 0);

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Many Hands</title>
  <meta name="description" content="Twenty hand-drawn animations in twelve visual languages, drawn in code on one engine.">
  <link rel="icon" href="data:,">
  <style>
    :root { --wall: #efebe3; --card: #e4dfd4; --text: #1f1d1a; --muted: #625c53; --faint: #8b8479; --accent: #b3402a; --line: rgba(31, 29, 26, .14); }
    * { box-sizing: border-box; }
    html { scroll-behavior: smooth; }
    body { margin: 0; background: var(--wall); color: var(--text); font: 15px/1.55 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; -webkit-font-smoothing: antialiased; }
    header, main, footer { max-width: 1240px; margin: 0 auto; padding: 0 16px; }
    header { padding-top: 60px; padding-bottom: 8px; }
    .kicker { margin: 0 0 10px; font-size: 12px; letter-spacing: .14em; text-transform: uppercase; color: var(--muted); }
    h1 { margin: 0 0 14px; font: 400 52px/1.05 "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif; letter-spacing: -.015em; }
    header p { margin: 0; max-width: 64ch; color: var(--muted); text-wrap: pretty; }
    nav { display: flex; flex-wrap: wrap; gap: 8px; margin: 22px 0 0; padding: 0; list-style: none; }
    nav a { display: inline-flex; gap: 6px; align-items: baseline; font-size: 13px; color: var(--text); text-decoration: none; border: 1px solid var(--line); border-radius: 999px; padding: 4px 12px; background: rgba(255, 255, 255, .35); }
    nav a:hover { border-color: rgba(31, 29, 26, .4); }
    nav a span { color: var(--faint); font-variant-numeric: tabular-nums; font-size: 12px; }
    .anim { margin: 0; }
    .frame { position: relative; overflow: hidden; background: var(--card); box-shadow: 0 0 0 1px rgba(31, 29, 26, .08), 0 2px 3px rgba(31, 29, 26, .08), 0 18px 36px -12px rgba(31, 29, 26, .35); }
    video { display: block; width: 100%; height: 100%; object-fit: contain; cursor: pointer; }
    .control { position: absolute; right: 12px; bottom: 12px; font: inherit; font-size: 12px; letter-spacing: .04em; color: #f4f1ea; background: rgba(24, 22, 20, .66); border: 1px solid rgba(244, 241, 234, .3); border-radius: 999px; padding: 4px 13px; cursor: pointer; backdrop-filter: blur(4px); }
    .control:hover { background: rgba(24, 22, 20, .85); }
    .control:focus-visible, nav a:focus-visible, .tag:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
    figcaption { display: flex; flex-direction: column; gap: 3px; margin-top: 14px; }
    .meta { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 10px; font-size: 11px; letter-spacing: .14em; text-transform: uppercase; color: var(--faint); }
    .id { color: var(--accent); font-variant-numeric: tabular-nums; }
    .tag { color: var(--muted); text-decoration: none; border-bottom: 1px solid var(--line); }
    .title { font: 400 22px/1.2 "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif; color: var(--text); }
    .line { font: italic 400 17px/1.4 "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif; color: var(--muted); text-wrap: pretty; }
    .hero { display: grid; grid-template-columns: minmax(0, 1.75fr) minmax(0, 1fr); gap: 44px; align-items: center; padding: 40px 0 64px; border-bottom: 1px solid var(--line); }
    .hero figcaption { margin-top: 0; gap: 10px; }
    .hero .title { font-size: 40px; }
    .hero .line { font-size: 23px; color: var(--text); }
    .hero .idea { max-width: 46ch; color: var(--muted); margin-top: 6px; text-wrap: pretty; }
    section { padding: 52px 0 12px; border-bottom: 1px solid var(--line); scroll-margin-top: 12px; }
    section:last-of-type { border-bottom: 0; }
    .style-head { display: grid; grid-template-columns: minmax(0, 260px) minmax(0, 1fr); gap: 8px 40px; align-items: baseline; margin-bottom: 26px; }
    h2 { margin: 0; font: 400 28px/1.15 "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif; }
    .style-head p { margin: 0; color: var(--muted); max-width: 70ch; text-wrap: pretty; }
    .row { display: flex; gap: 32px; align-items: flex-start; padding-bottom: 40px; }
    .row .anim { min-width: 0; }
    .row.single .anim { max-width: 62%; }
    footer { padding-top: 28px; padding-bottom: 52px; color: var(--faint); font-size: 13px; }
    footer p { margin: 0; border-top: 1px solid var(--line); padding-top: 20px; }
    @media (max-width: 980px) { .hero { gap: 28px; } .row { gap: 20px; } .row .title { font-size: 19px; } .row .line { font-size: 15px; } }
    @media (max-width: 760px) {
      header { padding-top: 36px; }
      h1 { font-size: 38px; }
      .hero { grid-template-columns: 1fr; gap: 18px; padding: 28px 0 44px; }
      .hero .title { font-size: 32px; }
      .hero .line { font-size: 20px; }
      .style-head { grid-template-columns: 1fr; }
      .row, .row.single { flex-direction: column; gap: 40px; }
      .row .anim, .row.single .anim { flex: none !important; width: 100%; max-width: none; }
      .row .title { font-size: 22px; }
      .row .line { font-size: 17px; }
    }
  </style>
</head>
<body>
  <header>
    <p class="kicker">hand-sketch &middot; gallery</p>
    <h1>Many Hands</h1>
    <p>Twenty small animations, each in its own visual language: woodblock and sumi, blueprint and sun print, riso inks, stipple and etching, watercolour, pastel on black, cut paper, Bauhaus, deco gold and a single line. All of them are drawn in code on the same engine, deterministic to the pixel. Most begin already whole and live by motion; a few draw themselves on because the drawing is the idea. The first plays on its own; tap any other to play it.</p>
    <nav aria-label="Styles">${[...new Set(entries.map(e => e.style))].sort((a, b) => STYLES.findIndex(s => s[0] === a) - STYLES.findIndex(s => s[0] === b)).map(style => `
      <a href="#${slug(style)}">${esc(style)} <span>${entries.filter(e => e.style === style).length}</span></a>`).join('')}
    </nav>
  </header>
  <main>${figure(hero, true)}${groups.map(g => `
    <section id="${slug(g.name)}" aria-labelledby="${slug(g.name)}-title">
      <div class="style-head">
        <h2 id="${slug(g.name)}-title">${esc(g.name)}</h2>
        <p>${esc(g.note)}</p>
      </div>
      <div class="row${g.list.length === 1 ? ' single' : ''}">${g.list.map(e => figure(e, false)).join('')}
      </div>
    </section>`).join('')}
  </main>
  <footer>
    <p>Drawn in code: deterministic Canvas 2D on twos, every loop seamless.</p>
  </footer>
${BOARD_SCRIPT}
</body>
</html>
`;
writeFileSync(path.join(outDir, 'board.html'), html);
console.log(`\nboard: ${path.join(outDir, 'board.html')}\nmanifest: ${path.join(outDir, 'manifest.json')}`);
