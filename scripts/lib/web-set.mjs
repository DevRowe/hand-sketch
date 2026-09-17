// Shared pieces of the web-delivery sets (scripts/keystone.mjs, scripts/poetic.mjs): command-line options, rendering
// every catalogue entry with `scripts/render.mjs --web`, reading the sidecars back, and the review board's player.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/** `--out dir`, `--only K01,K08`, `--verify`, `--board-only`. */
export function setOptions(argv, defaultOut) {
  const flag = name => { const k = argv.indexOf(name); return k >= 0 ? argv[k + 1] : undefined; };
  return {
    outDir: path.resolve(root, flag('--out') ?? defaultOut),
    only: flag('--only')?.split(','),
    verify: argv.includes('--verify'),
    boardOnly: argv.includes('--board-only'),
  };
}

export const readCatalog = rel => JSON.parse(readFileSync(path.join(root, rel), 'utf8'));

/** Base file name of an entry's media: `k01-untangle`. */
export const baseName = e => `${e.id.toLowerCase()}-${e.scene}`;

/** Render every selected entry (12 fps H.264 + VP9, keyframe at loopFrom, posters, seam check) into `outDir`. */
export function renderSet(catalog, { outDir, only, verify }) {
  for (const e of catalog) {
    if (only && !only.includes(e.id)) continue;
    const args = ['scripts/render.mjs', '--program', `loop:${e.scene}`, '--ar', e.ar, '--width', String(e.width), '--web', '--out', outDir, '--name', baseName(e)];
    if (verify) args.push('--verify');
    console.log(`\n${e.id} ${e.title}`);
    execFileSync(process.execPath, args, { cwd: root, stdio: 'inherit' });
  }
}

/** Catalogue entries joined with their rendered sidecars (`media`). */
export function loadEntries(catalog, outDir) {
  return catalog.map(e => {
    const sidecar = path.join(outDir, `${baseName(e)}.json`);
    if (!existsSync(sidecar)) throw new Error(`missing ${sidecar}: render ${e.id} first`);
    return { ...e, media: JSON.parse(readFileSync(sidecar, 'utf8')) };
  });
}

export const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/**
 * The board's player, for figures shaped `.anim[data-loop-from][data-poster-at][data-autoplay]` holding a `video` with
 * `source`s, a `.control` button and a `strong` title.
 */
export const BOARD_SCRIPT = `  <script>
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
  </script>`;
