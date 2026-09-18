#!/usr/bin/env node
// The spiral set ("One Wake, Ten Hands"): web delivery for the ten angled, moving solar systems, the top-down solar
// set's companion, plus a board that sets them side by side.
//
// For every entry of src/scenes/solar-spiral/catalog.json this runs `scripts/render.mjs --web` (12 fps H.264 + VP9 with a
// keyframe at loopFrom, poster PNG + JPEG, a seam check), then writes manifest.json and board.html next to the media.
// The board plays the hero on load (intro + two loops, then rests on its poster) and lays all ten out as a grid of
// posters labelled by style, each playing on tap; prefers-reduced-motion gets posters.
//
// Usage (after `npm run build`, or via `npm run spiral`):
//   node scripts/solar-spiral.mjs                   render all ten into output/solar-spiral/ and write the board
//   node scripts/solar-spiral.mjs --only SP01,SP07  re-render some, rewrite the board from every sidecar present
//   node scripts/solar-spiral.mjs --verify          also render each twice in independent page loads, fail on any difference
//   node scripts/solar-spiral.mjs --out dir         output directory (default output/solar-spiral/)
//   node scripts/solar-spiral.mjs --board-only      just rewrite board.html and manifest.json from existing sidecars
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { BOARD_SCRIPT, esc, loadEntries, readCatalog, renderSet, setOptions } from './lib/web-set.mjs';

const opts = setOptions(process.argv.slice(2), 'output/solar-spiral');
const { outDir } = opts;
const catalog = readCatalog('src/scenes/solar-spiral/catalog.json');

if (!opts.boardOnly) renderSet(catalog, opts);
const entries = loadEntries(catalog, outDir);

writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(entries.map(e => ({
  id: e.id, style: e.title, theme: e.theme, line: e.line, autoplay: e.autoplay, alt: e.alt,
  width: e.media.width, height: e.media.height, fps: e.media.fps,
  loopFromSeconds: e.media.loopFromSeconds, posterSeconds: e.media.poster / e.media.fps,
  video: e.media.video, poster: e.media.posterImage,
})), null, 2) + '\n');

const figure = (e, hero) => `
      <figure class="anim${hero ? ' hero' : ''}" data-id="${e.id}" data-loop-from="${e.media.loopFromSeconds ?? 0}" data-poster-at="${(e.media.poster / e.media.fps).toFixed(4)}" data-autoplay="${hero && e.autoplay}">
        <div class="frame" style="aspect-ratio: ${e.media.width} / ${e.media.height}">
          <video muted playsinline preload="none" poster="${esc(e.media.posterImage.jpg)}" aria-label="${esc(e.alt)}" width="${e.media.width}" height="${e.media.height}">
            <source src="${esc(e.media.video.webm)}" type="video/webm">
            <source src="${esc(e.media.video.mp4)}" type="video/mp4">
          </video>
          <button type="button" class="control" aria-label="Play ${esc(e.title)}">Play</button>
        </div>
        <figcaption>
          <span class="meta"><span class="id">${e.id}</span><span class="theme">${esc(e.theme)}</span></span>
          <strong class="title">${esc(e.title)}</strong>
          <span class="line">${esc(e.line)}</span>${hero ? `
          <span class="idea">${esc(e.idea)}</span>
          <span class="idea">${esc(e.loop)}</span>` : ''}
        </figcaption>
      </figure>`;

const hero = entries.find(e => e.autoplay) ?? entries[0];

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>One Wake, Ten Hands</title>
  <meta name="description" content="The solar system seen at an angle as the Sun travels, every orbit drawn out into a spiral, drawn in code ten times in ten visual languages.">
  <link rel="icon" href="data:,">
  <style>
    :root { --wall: #121317; --card: #1c1d22; --text: #ece8df; --muted: #a6a197; --faint: #77736b; --accent: #e8b25a; --line: rgba(236, 232, 223, .12); }
    * { box-sizing: border-box; }
    body { margin: 0; background: var(--wall); color: var(--text); font: 15px/1.55 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; -webkit-font-smoothing: antialiased; }
    header, main, footer { max-width: 1240px; margin: 0 auto; padding: 0 16px; }
    header { padding-top: 60px; padding-bottom: 8px; }
    .kicker { margin: 0 0 10px; font-size: 12px; letter-spacing: .14em; text-transform: uppercase; color: var(--muted); }
    h1 { margin: 0 0 14px; font: 400 52px/1.05 "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif; letter-spacing: -.015em; }
    header p { margin: 0; max-width: 66ch; color: var(--muted); text-wrap: pretty; }
    .anim { margin: 0; min-width: 0; }
    .frame { position: relative; overflow: hidden; background: var(--card); box-shadow: 0 0 0 1px rgba(236, 232, 223, .1), 0 18px 36px -14px rgba(0, 0, 0, .7); }
    video { display: block; width: 100%; height: 100%; object-fit: contain; cursor: pointer; }
    .control { position: absolute; right: 10px; bottom: 10px; font: inherit; font-size: 12px; letter-spacing: .04em; color: #f4f1ea; background: rgba(18, 19, 23, .7); border: 1px solid rgba(244, 241, 234, .3); border-radius: 999px; padding: 3px 12px; cursor: pointer; backdrop-filter: blur(4px); }
    .control:hover { background: rgba(18, 19, 23, .9); }
    .control:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
    figcaption { display: flex; flex-direction: column; gap: 2px; margin-top: 12px; }
    .meta { display: flex; flex-wrap: wrap; align-items: baseline; gap: 2px 8px; font-size: 11px; letter-spacing: .12em; text-transform: uppercase; color: var(--faint); }
    .id { color: var(--accent); font-variant-numeric: tabular-nums; }
    .title { font: 400 21px/1.2 "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif; color: var(--text); }
    .line { font: italic 400 15px/1.4 "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif; color: var(--muted); text-wrap: pretty; }
    .hero { display: grid; grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr); gap: 44px; align-items: center; padding: 40px 0 60px; border-bottom: 1px solid var(--line); }
    .hero figcaption { margin-top: 0; gap: 10px; }
    .hero .title { font-size: 40px; }
    .hero .line { font-size: 23px; color: var(--text); }
    .hero .idea { max-width: 48ch; color: var(--muted); text-wrap: pretty; }
    section { padding: 48px 0 20px; }
    h2 { margin: 0 0 6px; font: 400 28px/1.15 "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif; }
    section > p { margin: 0 0 28px; color: var(--muted); max-width: 70ch; }
    .grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 36px 22px; }
    .grid .meta { flex-wrap: nowrap; white-space: nowrap; min-width: 0; }
    .grid .theme { overflow: hidden; text-overflow: ellipsis; }
    footer { padding-top: 28px; padding-bottom: 52px; color: var(--faint); font-size: 13px; }
    footer p { margin: 0; border-top: 1px solid var(--line); padding-top: 20px; }
    @media (max-width: 1060px) { .grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
    @media (max-width: 760px) {
      header { padding-top: 36px; }
      h1 { font-size: 38px; }
      .hero { grid-template-columns: 1fr; gap: 18px; padding: 28px 0 44px; }
      .hero .title { font-size: 32px; }
      .hero .line { font-size: 20px; }
      .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 28px 14px; }
      .grid .title { font-size: 18px; }
      .grid .line { font-size: 14px; }
    }
  </style>
</head>
<body>
  <header>
    <p class="kicker">hand-sketch &middot; solar spiral</p>
    <h1>One Wake, Ten Hands</h1>
    <p>The companion to the top-down set: the same solar system, now seen at an angle while the Sun travels through space and drags its planets along. Each orbit is drawn out behind its planet into a spiral, Mercury a tight, fast corkscrew, Neptune one long, lazy turn, the Sun's own path running back through the middle into the distance. It is a picture of the idea, tilted and exaggerated for the eye, not a to-scale model. The same planets, the same whole turns per loop and the same clock as the top-down pieces, drawn ten times in the same ten visual languages, every loop seamless and deterministic to the pixel. The first plays on its own; tap any other to play it.</p>
  </header>
  <main>${figure(hero, true)}
    <section aria-labelledby="ten-title">
      <h2 id="ten-title">The ten</h2>
      <p>Side by side, each resting on the same moment of the same loop, the moment the top-down posters rest on.</p>
      <div class="grid">${entries.map(e => figure(e, false)).join('')}
      </div>
    </section>
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
