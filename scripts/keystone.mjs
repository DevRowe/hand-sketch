#!/usr/bin/env node
// Keystone Systems set: web delivery for all ten animations plus a review board.
//
// For every entry of src/scenes/keystone/catalog.json this runs `scripts/render.mjs --web` (12 fps H.264 + VP9 with a
// keyframe at loopFrom, poster PNG + JPEG, a seam check), then writes manifest.json and board.html next to the media.
// The board plays the hero on load (intro + two loops, then rests on its poster, with a pause/replay control) and
// shows every other animation as its poster, playing on tap; prefers-reduced-motion gets posters only.
//
// Usage (after `npm run build`, or via `npm run keystone`):
//   node scripts/keystone.mjs                 render all ten into output/keystone/ and write the board
//   node scripts/keystone.mjs --only K01,K08  re-render some, rewrite the board from every sidecar present
//   node scripts/keystone.mjs --verify        also render each twice in independent page loads and fail on any difference
//   node scripts/keystone.mjs --out dir       output directory (default output/keystone/)
//   node scripts/keystone.mjs --board-only    just rewrite board.html and manifest.json from existing sidecars
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { BOARD_SCRIPT, esc, loadEntries, readCatalog, renderSet, setOptions } from './lib/web-set.mjs';

const opts = setOptions(process.argv.slice(2), 'output/keystone');
const { outDir } = opts;
const catalog = readCatalog('src/scenes/keystone/catalog.json');

if (!opts.boardOnly) renderSet(catalog, opts);
const entries = loadEntries(catalog, outDir);

// the site-facing manifest: what a page needs to place each animation
writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(entries.map(e => ({
  id: e.id, title: e.title, slot: e.slot, autoplay: e.autoplay, alt: e.alt, placement: e.placement,
  width: e.media.width, height: e.media.height, fps: e.media.fps,
  loopFromSeconds: e.media.loopFromSeconds, posterSeconds: e.media.poster / e.media.fps,
  video: e.media.video, poster: e.media.posterImage,
})), null, 2) + '\n');

const figure = (e, hero) => `
    <figure class="anim${hero ? ' hero' : ''}" data-id="${e.id}" data-loop-from="${e.media.loopFromSeconds}" data-poster-at="${(e.media.poster / e.media.fps).toFixed(4)}" data-autoplay="${e.autoplay}">
      <div class="frame" style="aspect-ratio: ${hero ? `${e.media.width} / ${e.media.height}` : '16 / 10'}">
        <video muted playsinline preload="none" poster="${esc(e.media.posterImage.jpg)}" aria-label="${esc(e.alt)}" width="${e.media.width}" height="${e.media.height}">
          <source src="${esc(e.media.video.webm)}" type="video/webm">
          <source src="${esc(e.media.video.mp4)}" type="video/mp4">
        </video>
        <button type="button" class="control" aria-label="Play ${esc(e.title)}">Play</button>
      </div>
      <figcaption><span class="id">${e.id}</span> <strong>${esc(e.title)}</strong> <span class="slot">${esc(e.slot)}</span><br>${esc(e.metaphor)} <span class="where">${esc(e.placement)}</span></figcaption>
    </figure>`;

const hero = entries.find(e => e.autoplay) ?? entries[0];
const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Keystone animations</title>
  <link rel="icon" href="data:,">
  <style>
    :root { --paper: #f2f3ee; --ink: #1d3337; --accent: #1f7a64; --muted: #5d6865; --line: #d9ddd6; --bg: #fafbf8; }
    * { box-sizing: border-box; }
    body { margin: 0; background: var(--bg); color: var(--ink); font: 15px/1.5 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; }
    header, main { max-width: 1240px; margin: 0 auto; padding: 0 16px; }
    header { padding-top: 32px; padding-bottom: 8px; }
    h1 { font-size: 22px; margin: 0 0 4px; letter-spacing: -0.01em; }
    header p { margin: 0; color: var(--muted); max-width: 70ch; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 28px 24px; padding: 24px 0 48px; }
    .anim { margin: 0; }
    .anim.hero { grid-column: 1 / -1; display: grid; grid-template-columns: minmax(0, 560px) minmax(0, 1fr); gap: 24px; align-items: center; }
    .frame { position: relative; background: var(--paper); border-radius: 6px; overflow: hidden; box-shadow: 0 0 0 1px var(--line); }
    video { display: block; width: 100%; height: 100%; object-fit: contain; }
    .control { position: absolute; right: 10px; bottom: 10px; font: inherit; font-size: 13px; color: var(--ink); background: rgba(250, 251, 248, .92); border: 1px solid var(--line); border-radius: 999px; padding: 4px 12px; cursor: pointer; }
    .control:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
    figcaption { margin-top: 10px; color: var(--muted); font-size: 14px; }
    .hero figcaption { margin-top: 0; font-size: 16px; }
    figcaption strong { color: var(--ink); }
    .id { font-variant-numeric: tabular-nums; color: var(--accent); font-weight: 600; }
    .slot { font-size: 12px; text-transform: uppercase; letter-spacing: .06em; color: var(--accent); margin-left: 6px; }
    .where { display: block; font-size: 13px; }
    @media (max-width: 760px) { .anim.hero { grid-template-columns: 1fr; } .grid { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <header>
    <h1>Keystone Systems: hand-sketch animations</h1>
    <p>Custom automation that simplifies your workflow. Pencil is the manual way, key ink is your tools, the green accent is the automation. Each draws itself once, then runs by itself. Only the hero plays on its own; tap any other to play it.</p>
  </header>
  <main>
    <div class="grid">${figure(hero, true)}${entries.filter(e => e !== hero).map(e => figure(e, false)).join('')}
    </div>
  </main>
${BOARD_SCRIPT}
</body>
</html>
`;
writeFileSync(path.join(outDir, 'board.html'), html);
console.log(`\nboard: ${path.join(outDir, 'board.html')}\nmanifest: ${path.join(outDir, 'manifest.json')}`);
