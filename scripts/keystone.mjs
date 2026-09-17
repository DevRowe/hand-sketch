#!/usr/bin/env node
// Keystone Systems set: web delivery for all ten animations plus a review board.
//
// For every entry of src/scenes/keystone/catalog.json this runs `scripts/render.mjs --web` (12 fps H.264 + VP9 with a
// keyframe at loopFrom, poster PNG + JPEG, a seam check), then writes manifest.json and board.html next to the media.
// The board plays the hero on load (intro + two loops, then rests on its poster, with a pause/replay control) and
// shows every other animation as its poster, playing on tap; prefers-reduced-motion gets posters only.
//
// Usage (after `npm run build`, or via `npm run keystone`):
//   node scripts/keystone.mjs                 render all ten into keystone/ and write the board
//   node scripts/keystone.mjs --only K01,K08  re-render some, rewrite the board from every sidecar present
//   node scripts/keystone.mjs --verify        also render each twice in independent page loads and fail on any difference
//   node scripts/keystone.mjs --out dir       output directory (default keystone/)
//   node scripts/keystone.mjs --board-only    just rewrite board.html and manifest.json from existing sidecars
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const flag = name => { const k = argv.indexOf(name); return k >= 0 ? argv[k + 1] : undefined; };
const has = name => argv.includes(name);
const outDir = path.resolve(root, flag('--out') ?? 'keystone');
const only = flag('--only')?.split(',');
const catalog = JSON.parse(readFileSync(path.join(root, 'src/scenes/keystone/catalog.json'), 'utf8'));
const base = e => `${e.id.toLowerCase()}-${e.scene}`;

if (!has('--board-only')) {
  for (const e of catalog) {
    if (only && !only.includes(e.id)) continue;
    const args = ['scripts/render.mjs', '--program', `loop:${e.scene}`, '--ar', e.ar, '--width', String(e.width), '--web', '--out', outDir, '--name', base(e)];
    if (has('--verify')) args.push('--verify');
    console.log(`\n${e.id} ${e.title}`);
    execFileSync(process.execPath, args, { cwd: root, stdio: 'inherit' });
  }
}

const entries = catalog.map(e => {
  const sidecar = path.join(outDir, `${base(e)}.json`);
  if (!existsSync(sidecar)) throw new Error(`missing ${sidecar}: render ${e.id} first`);
  return { ...e, media: JSON.parse(readFileSync(sidecar, 'utf8')) };
});

// the site-facing manifest: what a page needs to place each animation
writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(entries.map(e => ({
  id: e.id, title: e.title, slot: e.slot, autoplay: e.autoplay, alt: e.alt, placement: e.placement,
  width: e.media.width, height: e.media.height, fps: e.media.fps,
  loopFromSeconds: e.media.loopFromSeconds, posterSeconds: e.media.poster / e.media.fps,
  video: e.media.video, poster: e.media.posterImage,
})), null, 2) + '\n');

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
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
  <script>
    // Site policy: only the hero autoplays (intro + two loops, then rest on its poster frame); everything else is a
    // poster that plays on tap; reduced motion gets posters only unless the visitor asks. Videos seek to loopFrom on end.
    // Each clip is loaded whole as a blob before it plays: seeking to loopFrom then works on any static server,
    // including ones without HTTP Range support (python -m http.server), and the files are only a few hundred KB.
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const load = video => {
      if (!video.loaded) {
        const sources = [...video.querySelectorAll('source')];
        const pick = sources.find(s => video.canPlayType(s.type)) ?? sources[sources.length - 1];
        video.loaded = fetch(pick.src).then(r => { if (!r.ok) throw new Error(r.status + ' ' + pick.src); return r.blob(); })
          .then(blob => { sources.forEach(s => s.remove()); video.src = URL.createObjectURL(blob); return new Promise(ok => video.addEventListener('loadeddata', ok, { once: true })); });
      }
      return video.loaded;
    };
    for (const fig of document.querySelectorAll('.anim')) {
      const video = fig.querySelector('video'), button = fig.querySelector('.control');
      const loopFrom = Number(fig.dataset.loopFrom), posterAt = Number(fig.dataset.posterAt);
      let loops = 0, playing = false, paused = false;
      const label = text => { button.textContent = text; button.setAttribute('aria-label', text + ' ' + fig.querySelector('strong').textContent); };
      // a play() interrupted by pause() (scrolled off-screen, tapped) is not a failure
      const resume = () => video.play().catch(err => { if (err.name !== 'AbortError') rest(); });
      const rest = () => { playing = false; paused = false; video.pause(); video.currentTime = posterAt; label('Replay'); };
      const start = () => {
        loops = 0; playing = true; label('Pause');
        load(video).then(() => { video.currentTime = 0; return video.play(); }).catch(err => { console.warn(err); rest(); });
      };
      video.addEventListener('ended', () => {
        if (!playing) return;
        if (++loops <= 2) { video.currentTime = loopFrom; resume(); } else rest();
      });
      button.addEventListener('click', () => {
        if (playing) { playing = false; paused = true; video.pause(); label('Play'); }
        else if (paused) { playing = true; paused = false; label('Pause'); resume(); }
        else start();
      });
      video.addEventListener('click', () => button.click());
      if (fig.dataset.autoplay === 'true' && !reduce) {
        // pause when off-screen, resume when back
        new IntersectionObserver(([entry]) => {
          if (!entry.isIntersecting && playing) { video.pause(); }
          else if (entry.isIntersecting && playing && video.paused) { resume(); }
        }).observe(fig);
        start();
      }
    }
  </script>
</body>
</html>
`;
writeFileSync(path.join(outDir, 'board.html'), html);
console.log(`\nboard: ${path.join(outDir, 'board.html')}\nmanifest: ${path.join(outDir, 'manifest.json')}`);
