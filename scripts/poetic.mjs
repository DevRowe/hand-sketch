#!/usr/bin/env node
// The poetic set: web delivery for all ten animations plus a gallery board.
//
// For every entry of src/scenes/poetic/catalog.json this runs `scripts/render.mjs --web` (12 fps H.264 + VP9 with a
// keyframe at loopFrom, poster PNG + JPEG, a seam check), then writes manifest.json and board.html next to the media.
// The board plays the hero on load (intro + two loops, then rests on its poster) and shows every other piece as its
// poster with its title and line, playing on tap; prefers-reduced-motion gets posters only.
//
// Usage (after `npm run build`, or via `npm run poetic`):
//   node scripts/poetic.mjs                 render all ten into poetic/ and write the board
//   node scripts/poetic.mjs --only P01,P08  re-render some, rewrite the board from every sidecar present
//   node scripts/poetic.mjs --verify        also render each twice in independent page loads and fail on any difference
//   node scripts/poetic.mjs --out dir       output directory (default poetic/)
//   node scripts/poetic.mjs --board-only    just rewrite board.html and manifest.json from existing sidecars
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { BOARD_SCRIPT, esc, loadEntries, readCatalog, renderSet, setOptions } from './lib/web-set.mjs';

const opts = setOptions(process.argv.slice(2), 'poetic');
const { outDir } = opts;
const catalog = readCatalog('src/scenes/poetic/catalog.json');

if (!opts.boardOnly) renderSet(catalog, opts);
const entries = loadEntries(catalog, outDir);

writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(entries.map(e => ({
  id: e.id, title: e.title, line: e.line, theme: e.theme, autoplay: e.autoplay, alt: e.alt,
  width: e.media.width, height: e.media.height, fps: e.media.fps,
  loopFromSeconds: e.media.loopFromSeconds, posterSeconds: e.media.poster / e.media.fps,
  video: e.media.video, poster: e.media.posterImage,
})), null, 2) + '\n');

// in a row, each piece's width is proportional to its aspect ratio, so every frame in the row has the same height
const figure = (e, hero) => `
      <figure class="anim${hero ? ' hero' : ''}"${hero ? '' : ` style="flex: ${(e.media.width / e.media.height).toFixed(4)} 1 0"`} data-id="${e.id}" data-loop-from="${e.media.loopFromSeconds}" data-poster-at="${(e.media.poster / e.media.fps).toFixed(4)}" data-autoplay="${e.autoplay}">
        <div class="frame" style="aspect-ratio: ${e.media.width} / ${e.media.height}">
          <video muted playsinline preload="none" poster="${esc(e.media.posterImage.jpg)}" aria-label="${esc(e.alt)}" width="${e.media.width}" height="${e.media.height}">
            <source src="${esc(e.media.video.webm)}" type="video/webm">
            <source src="${esc(e.media.video.mp4)}" type="video/mp4">
          </video>
          <button type="button" class="control" aria-label="Play ${esc(e.title)}">Play</button>
        </div>
        <figcaption>
          <span class="meta"><span class="id">${e.id}</span> ${esc(e.theme)}</span>
          <strong class="title">${esc(e.title)}</strong>
          <span class="line">${esc(e.line)}</span>${hero ? `
          <span class="arc">${esc(e.arc)}</span>` : ''}
        </figcaption>
      </figure>`;

/** Consecutive rows of `size` pieces, in catalogue order. */
const rows = (list, size) => Array.from({ length: Math.ceil(list.length / size) }, (_, k) => list.slice(k * size, (k + 1) * size));

const hero = entries.find(e => e.autoplay) ?? entries[0];
const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>A Life in Ten Lines</title>
  <meta name="description" content="Ten hand-sketched animations, each one feeling and one turn.">
  <link rel="icon" href="data:,">
  <style>
    :root { --bg: #161513; --card: #1f1d1a; --text: #ece6da; --muted: #a39a8d; --faint: #6f675d; --accent: #d9a25e; --line: rgba(236, 230, 218, .12); }
    * { box-sizing: border-box; }
    body { margin: 0; background: var(--bg); color: var(--text); font: 15px/1.55 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; -webkit-font-smoothing: antialiased; }
    header, main, footer { max-width: 1200px; margin: 0 auto; padding: 0 16px; }
    header { padding-top: 56px; padding-bottom: 12px; }
    .kicker { margin: 0 0 10px; font-size: 12px; letter-spacing: .14em; text-transform: uppercase; color: var(--muted); }
    h1 { margin: 0 0 14px; font: 400 44px/1.1 "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif; letter-spacing: -.01em; text-wrap: balance; }
    header p { margin: 0; max-width: 62ch; color: var(--muted); text-wrap: pretty; }
    .anim { margin: 0; }
    .frame { position: relative; border-radius: 4px; overflow: hidden; background: var(--card); box-shadow: 0 0 0 1px var(--line), 0 18px 40px rgba(0, 0, 0, .35); }
    video { display: block; width: 100%; height: 100%; object-fit: contain; cursor: pointer; }
    .control { position: absolute; right: 12px; bottom: 12px; font: inherit; font-size: 12px; letter-spacing: .04em; color: var(--text); background: rgba(22, 21, 19, .72); border: 1px solid rgba(236, 230, 218, .28); border-radius: 999px; padding: 4px 13px; cursor: pointer; backdrop-filter: blur(4px); }
    .control:hover { background: rgba(22, 21, 19, .88); }
    .control:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
    figcaption { display: flex; flex-direction: column; gap: 4px; margin-top: 14px; }
    .meta { font-size: 11px; letter-spacing: .14em; text-transform: uppercase; color: var(--faint); }
    .id { color: var(--accent); font-variant-numeric: tabular-nums; margin-right: 6px; }
    .title { font: 400 22px/1.2 "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif; color: var(--text); }
    .line { font: italic 400 17px/1.4 "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif; color: var(--muted); text-wrap: pretty; }
    .hero { display: grid; grid-template-columns: minmax(0, 480px) minmax(0, 1fr); gap: 48px; align-items: center; padding: 36px 0 64px; border-bottom: 1px solid var(--line); }
    .hero figcaption { margin-top: 0; gap: 10px; }
    .hero .title { font-size: 40px; }
    .hero .line { font-size: 24px; color: var(--text); }
    .hero .arc { max-width: 46ch; color: var(--muted); margin-top: 6px; text-wrap: pretty; }
    .rows { display: flex; flex-direction: column; gap: 60px; padding: 56px 0 72px; }
    .row { display: flex; gap: 32px; align-items: flex-start; }
    .row .anim { min-width: 0; }
    footer { padding-bottom: 48px; color: var(--faint); font-size: 13px; }
    footer p { margin: 0; border-top: 1px solid var(--line); padding-top: 20px; }
    @media (max-width: 980px) { .hero { gap: 32px; } .row { gap: 20px; } .row .title { font-size: 19px; } .row .line { font-size: 15px; } }
    @media (max-width: 680px) {
      header { padding-top: 36px; }
      h1 { font-size: 34px; }
      .hero { grid-template-columns: 1fr; gap: 20px; padding: 28px 0 44px; }
      .hero .title { font-size: 32px; }
      .hero .line { font-size: 20px; }
      .rows { gap: 44px; padding-top: 44px; }
      .row { flex-direction: column; gap: 44px; }
      .row .anim { flex: none !important; width: 100%; }
      .row .title { font-size: 22px; }
      .row .line { font-size: 17px; }
    }
  </style>
</head>
<body>
  <header>
    <p class="kicker">hand-sketch</p>
    <h1>A Life in Ten Lines</h1>
    <p>Ten hand-sketched animations, each one feeling with one turn. Read in order they make a life: wonder, growing up, leaving, love, the turning years, storms, mending, loss, solitude, and hope. The first plays on its own; tap any other to play it.</p>
  </header>
  <main>${figure(hero, true)}
    <div class="rows">${rows(entries.filter(e => e !== hero), 3).map(row => `
    <div class="row">${row.map(e => figure(e, false)).join('')}
    </div>`).join('')}
    </div>
  </main>
  <footer>
    <p>Drawn in code: deterministic Canvas 2D strokes on twos, each loop seamless.</p>
  </footer>
${BOARD_SCRIPT}
</body>
</html>
`;
writeFileSync(path.join(outDir, 'board.html'), html);
console.log(`\nboard: ${path.join(outDir, 'board.html')}\nmanifest: ${path.join(outDir, 'manifest.json')}`);
