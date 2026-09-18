#!/usr/bin/env node
// The public GitHub Pages site for the two solar sets, served from `main` /docs: docs/index.html presents the top-down
// set ("One Sun, Ten Hands", media in docs/solar/media/) and beneath it the spiral set ("One Wake, Ten Hands", media in
// docs/solar-spiral/media/).
//
// Built from existing `npm run solar` and `npm run spiral` renders (output/<set>/manifest.json and the PNG frames they
// leave under output/sequence/web-frames/), so run those first. For each of the twenty this writes:
//   <name>-hd.mp4          1080 x 1080 H.264 CRF 18 at 24 fps (each drawing held for two frames), for download
//   <name>-web.mp4         720 x 720 H.264 (CRF 26 top-down, 24 for the finer spiral lines) at 12 fps with a keyframe
//                          at loopFrom; the page plays these
//   <name>-poster.jpg      the set's 1080 poster frame, for download
//   <name>-poster-web.jpg  a 720 copy the page shows before a clip plays
// Each set's hero autoplays once it scrolls into view (intro, two loops, then rests on its poster frame), the rest play
// on tap; every clip loops from loopFrom, and the page offers plain `<a download>` links for the HD mp4, the web mp4 and the poster.
// Everything is encoded bitexact, so rebuilding from unchanged frames gives identical files.
//
// Usage: npm run solar:site                  rebuild both sets' media and the page
//        npm run solar:site -- --set spiral  rebuild one set's media (solar or spiral), then the page
//        npm run solar:site -- --page-only   rewrite docs/index.html alone
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { esc } from './lib/web-set.mjs';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const docs = path.join(root, 'docs');
const argv = process.argv.slice(2);
const pageOnly = argv.includes('--page-only');
const only = argv.includes('--set') ? argv[argv.indexOf('--set') + 1] : null;

const SETS = [
  {
    key: 'solar', dir: 'solar', crf: 26, run: 'npm run solar',
    eyebrow: 'the solar system from above', title: 'One Sun, Ten Hands',
    lede: 'The same plan of the solar system drawn ten times, each in its own visual language. Every planet runs a whole number of orbits per loop, so each piece draws itself on and then circles forever without a seam. All ten are drawn in code, frame by frame.',
  },
  {
    key: 'spiral', dir: 'solar-spiral', crf: 24, run: 'npm run spiral',
    eyebrow: 'the solar system at an angle, in motion', title: 'One Wake, Ten Hands',
    lede: 'The same solar system seen at an angle while the Sun travels through space, so each orbit trails behind its planet as a spiral: Mercury a tight, fast corkscrew, Neptune one long, lazy turn. Tilted and exaggerated for the eye rather than to scale, in the same ten visual languages on the same seamless clock.',
  },
];
if (only && !SETS.some(s => s.key === only)) throw new Error(`--set must be one of ${SETS.map(s => s.key).join(', ')}`);

for (const set of SETS) {
  const manifestFile = path.join(root, 'output', set.dir, 'manifest.json');
  if (!existsSync(manifestFile)) throw new Error(`missing ${manifestFile}: run ${set.run} first`);
  set.entries = JSON.parse(readFileSync(manifestFile, 'utf8')).map(e => ({ ...e, set, base: e.video.mp4.replace(/\.mp4$/, '') }));
  set.hero = set.entries.find(e => e.autoplay) ?? set.entries[0];
  set.rest = set.entries.filter(e => e !== set.hero);
}

const ff = args => execFileSync('ffmpeg', ['-nostdin', '-v', 'error', '-y', ...args], { stdio: 'inherit' });
const bitexact = ['-fflags', '+bitexact', '-flags:v', '+bitexact', '-movflags', '+faststart'];

for (const set of SETS) {
  if (pageOnly || (only && set.key !== only)) continue;
  const src = path.join(root, 'output', set.dir);
  const media = path.join(docs, set.dir, 'media');
  mkdirSync(media, { recursive: true });
  for (const e of set.entries) {
    const frames = path.join(root, 'output', 'sequence', 'web-frames', e.base);
    const sidecar = JSON.parse(readFileSync(path.join(src, `${e.base}.json`), 'utf8'));
    const count = existsSync(frames) ? readdirSync(frames).filter(f => f.endsWith('.png')).length : 0;
    if (count !== sidecar.frames) throw new Error(`${frames} has ${count} frames, expected ${sidecar.frames}: run ${set.run}`);
    const input = ['-framerate', String(e.fps), '-i', path.join(frames, '%05d.png')];
    const out = suffix => path.join(media, `${e.base}-${suffix}`);
    ff([...input, '-r', String(e.fps * 2), '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', ...bitexact, out('hd.mp4')]);
    ff([...input, '-vf', 'scale=720:720:flags=lanczos', '-c:v', 'libx264', '-preset', 'veryslow', '-crf', String(set.crf), '-pix_fmt', 'yuv420p',
      '-force_key_frames', `0,${e.loopFromSeconds.toFixed(6)}`, '-g', String(sidecar.frames), ...bitexact, out('web.mp4')]);
    copyFileSync(path.join(src, e.poster.jpg), out('poster.jpg'));
    ff(['-i', path.join(src, e.poster.png), '-vf', 'scale=720:720:flags=lanczos', '-q:v', '4', '-fflags', '+bitexact', out('poster-web.jpg')]);
    console.log(`${e.id} ${e.base}: hd ${size(out('hd.mp4'))}, web ${size(out('web.mp4'))}`);
  }
}

function size(file) {
  const n = statSync(file).size;
  return n >= 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.round(n / 1e3)} KB`;
}

function piece(e, hero) {
  const file = suffix => `${e.set.dir}/media/${e.base}-${suffix}`;
  for (const s of ['hd.mp4', 'web.mp4', 'poster.jpg', 'poster-web.jpg']) {
    if (!existsSync(path.join(docs, file(s)))) throw new Error(`missing docs/${file(s)}: run without --page-only`);
  }
  const sz = s => size(path.join(docs, file(s)));
  const [tag, h] = hero ? ['section', 'h2'] : ['article', 'h3'];
  const pad = hero ? '      ' : '        ';
  return `<${tag} class="piece${hero ? ' hero' : ''}" id="${e.id.toLowerCase()}">
  <figure class="anim" data-loop-from="${e.loopFromSeconds.toFixed(6)}" data-poster-at="${e.posterSeconds.toFixed(6)}" data-autoplay="${hero}">
    <video src="${file('web.mp4')}" poster="${file('poster-web.jpg')}" width="720" height="720" muted playsinline preload="${hero && e.set === SETS[0] ? 'auto' : 'none'}" controls aria-label="${esc(e.alt)}"></video>
    <button class="control" type="button" hidden>Play</button>
  </figure>
  <div class="text">
    <p class="num">${e.id}</p>
    <${h}>${esc(e.style)}</${h}>
    <p class="theme">${esc(e.theme)}</p>
    <p class="line">${esc(e.line)}</p>
    <p class="dl">
      <a href="${file('hd.mp4')}" download>Download (HD)<span>1080p · 24 fps · ${sz('hd.mp4')}</span></a>
      <a href="${file('web.mp4')}" download>Download (web)<span>720p · 12 fps · ${sz('web.mp4')}</span></a>
    </p>
    <p class="still"><a href="${file('poster.jpg')}" download>Download the poster frame</a> · 1080 JPEG · ${sz('poster.jpg')}</p>
  </div>
</${tag}>`.replace(/^/gm, pad);
}

// The first set opens the page under its h1 with a jump link to every set; later sets open under a ruled h2 head.
const section = (set, first) => `      <section class="set" id="${set.key}" aria-labelledby="${set.key}-title">
        <header class="set-head${first ? ' first' : ''}">
          <p class="eyebrow">hand-sketch · ${esc(set.eyebrow)}</p>
          <${first ? 'h1' : 'h2'} class="set-title" id="${set.key}-title">${esc(set.title)}</${first ? 'h1' : 'h2'}>
          <p class="lede">${esc(set.lede)}</p>
${first ? `          <nav class="sets" aria-label="Collections">
${SETS.map(s => `            <a href="#${s.key}"><img src="${s.dir}/media/${s.hero.base}-poster-web.jpg" alt="" width="720" height="720"><span><b>${esc(s.title)}</b>${esc(s.eyebrow)}</span></a>`).join('\n')}
          </nav>
` : ''}        </header>
${piece(set.hero, true)}
        <div class="grid-head">
          <h2>Ten styles</h2>
          <p>Tap any piece to play it. Every clip is silent, square and free to download.</p>
        </div>
        <div class="grid">
${set.rest.map(e => piece(e, false)).join('\n')}
        </div>
      </section>`;

writeFileSync(path.join(docs, 'index.html'), `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>One Sun, Ten Hands</title>
  <meta name="description" content="The solar system drawn in code in ten visual styles, from blueprint to art deco: seen from above, then at an angle as the Sun travels and each orbit trails into a spiral. Watch all twenty in the browser or download them.">
  <meta property="og:title" content="One Sun, Ten Hands">
  <meta property="og:description" content="The solar system hand-sketched in ten visual styles, from above and in motion.">
  <meta property="og:type" content="website">
  <meta property="og:image" content="${SETS[0].dir}/media/${SETS[0].hero.base}-poster.jpg">
  <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Ccircle cx='16' cy='16' r='6' fill='%23e8a33d'/%3E%3Ccircle cx='16' cy='16' r='12.5' fill='none' stroke='%23efe6d4' stroke-width='1.5'/%3E%3Ccircle cx='28.5' cy='16' r='2.5' fill='%23efe6d4'/%3E%3C/svg%3E">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300;9..144,500&family=Inter:wght@400;500&display=swap" rel="stylesheet">
  <style>
    :root {
      color-scheme: dark;
      --bg: #0d0f15;
      --panel: #151822;
      --rule: #272b38;
      --ink: #efe6d4;
      --muted: #a39d91;
      --faint: #736f68;
      --gold: #e8a33d;
      --serif: 'Fraunces', Georgia, serif;
      --sans: 'Inter', system-ui, sans-serif;
    }
    * { box-sizing: border-box; }
    html { -webkit-text-size-adjust: 100%; }
    body {
      margin: 0; background: var(--bg); color: var(--ink); font: 400 16px/1.55 var(--sans);
      background-image: radial-gradient(ellipse 80% 50% at 50% -10%, #1d2130 0%, transparent 70%);
    }
    a { color: inherit; }
    .wrap { max-width: 1180px; margin: 0 auto; padding: 0 24px; }
    .set-head { padding: 72px 0 40px; }
    .set + .set .set-head { padding-top: 88px; border-top: 1px solid var(--rule); }
    .eyebrow { margin: 0 0 14px; color: var(--gold); font: 500 12px/1.4 var(--sans); letter-spacing: .18em; text-transform: uppercase; }
    h1, h2.set-title { margin: 0; font: 300 clamp(40px, 7vw, 76px)/1.02 var(--serif); letter-spacing: -.02em; }
    .sets { display: flex; flex-wrap: wrap; gap: 12px; margin: 28px 0 0; }
    .sets a {
      display: flex; align-items: center; gap: 12px; padding: 8px 16px 8px 8px; border: 1px solid var(--rule); border-radius: 8px;
      background: rgb(21 24 34 / .6); text-decoration: none; transition: border-color .15s, background .15s;
    }
    .sets a:hover { border-color: var(--gold); background: rgb(232 163 61 / .07); }
    .sets a:focus-visible { outline: 2px solid var(--gold); outline-offset: 2px; }
    .sets img { width: 48px; height: 48px; border-radius: 4px; }
    .sets span { display: flex; flex-direction: column; gap: 2px; color: var(--faint); font-size: 12.5px; line-height: 1.3; }
    .sets b { color: var(--ink); font: 500 16px/1.2 var(--serif); }
    .lede { max-width: 640px; margin: 20px 0 0; color: var(--muted); font-size: 18px; }
    .piece { display: grid; gap: 20px; }
    .hero { grid-template-columns: minmax(0, min(620px, 72vh)) minmax(0, 1fr); align-items: center; gap: 40px; padding-bottom: 64px; border-bottom: 1px solid var(--rule); }
    figure { position: relative; margin: 0; aspect-ratio: 1; overflow: hidden; border-radius: 4px; background: var(--panel); box-shadow: 0 20px 50px -24px #000; }
    video { display: block; width: 100%; height: 100%; object-fit: cover; cursor: pointer; }
    .control {
      position: absolute; right: 12px; bottom: 12px; min-width: 76px; padding: 8px 14px; border: 0; border-radius: 999px;
      background: rgb(13 15 21 / .72); color: var(--ink); font: 500 13px/1 var(--sans); cursor: pointer;
      backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); transition: background .15s;
    }
    .control:hover { background: rgb(13 15 21 / .9); }
    .control:focus-visible, .dl a:focus-visible, .still a:focus-visible { outline: 2px solid var(--gold); outline-offset: 2px; }
    .num { margin: 0; color: var(--faint); font: 500 12px/1 var(--sans); letter-spacing: .14em; }
    h2, h3 { margin: 8px 0 0; font-family: var(--serif); font-weight: 500; letter-spacing: -.01em; }
    h2 { font-size: clamp(32px, 4vw, 44px); line-height: 1.05; }
    h3 { font-size: 24px; line-height: 1.15; }
    .theme { margin: 4px 0 0; color: var(--gold); font-size: 14px; }
    .line { margin: 10px 0 0; color: var(--muted); font-family: var(--serif); font-style: italic; font-weight: 300; font-size: 17px; }
    .hero .line { font-size: 21px; }
    .dl { display: flex; flex-wrap: wrap; gap: 8px; margin: 18px 0 0; }
    .dl a {
      display: inline-flex; flex-direction: column; gap: 3px; padding: 9px 13px; border: 1px solid var(--rule); border-radius: 6px;
      font: 500 13px/1.1 var(--sans); text-decoration: none; transition: border-color .15s, background .15s;
    }
    .dl a:hover { border-color: var(--gold); background: rgb(232 163 61 / .07); }
    .dl a span { color: var(--faint); font-weight: 400; font-size: 11.5px; }
    .dl a:first-child { border-color: rgb(232 163 61 / .55); }
    .still { margin: 10px 0 0; color: var(--faint); font-size: 12.5px; }
    .still a { color: var(--muted); text-underline-offset: 3px; text-decoration-color: var(--rule); }
    .still a:hover { color: var(--ink); text-decoration-color: var(--gold); }
    .grid-head { display: flex; justify-content: space-between; align-items: baseline; gap: 16px; padding: 56px 0 24px; }
    .grid-head h2 { font-size: 28px; }
    .grid-head p { margin: 0; color: var(--faint); font-size: 14px; }
    .grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 48px 32px; padding-bottom: 72px; }
    .grid .piece { gap: 16px; align-content: start; }
    footer { padding: 32px 0 56px; border-top: 1px solid var(--rule); color: var(--faint); font-size: 13px; }
    footer p { margin: 0 0 6px; max-width: 760px; }
    @media (min-width: 601px) { .grid .line { min-height: calc(2 * 1.55em); } }
    @media (max-width: 900px) {
      .hero { grid-template-columns: 1fr; gap: 24px; }
      .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
    @media (max-width: 600px) {
      .wrap { padding: 0 16px; }
      .set-head { padding: 44px 0 28px; }
      .set + .set .set-head { padding-top: 56px; }
      .sets a { flex: 1 1 100%; }
      .eyebrow { font-size: 11px; letter-spacing: .12em; }
      .lede { font-size: 16px; }
      .grid { grid-template-columns: 1fr; gap: 44px; }
      .grid-head { flex-direction: column; gap: 6px; }
    }
  </style>
</head>
<body>
  <div class="wrap">
    <main>
${SETS.map((set, i) => section(set, i === 0)).join('\n')}
    </main>
    <footer>
      <p>Made with hand-sketch: deterministic Canvas 2D scenes with a tapered, wobbling pen, rendered offline at 12 drawings a second.</p>
      <p>HD downloads are 1080 × 1080 H.264 at 24 fps (each drawing held for two frames); web downloads are the 720 × 720 files this page plays.</p>
    </footer>
  </div>
  <script>
    // Each set's hero autoplays as it comes into view (intro, then two loops, then rests on its poster frame) unless the visitor prefers reduced
    // motion; every other piece plays on tap and loops until paused. On 'ended' a clip seeks to its loop start
    // (a keyframe), so only the loop repeats, not the draw-on. Clips pause while scrolled off-screen.
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const seen = new IntersectionObserver(entries => {
      for (const { target, isIntersecting } of entries) target.onVisible?.(isIntersecting);
    });
    for (const fig of document.querySelectorAll('.anim')) {
      const video = fig.querySelector('video'), button = fig.querySelector('.control');
      const name = \`\${fig.closest('.set').querySelector('.set-title').textContent}: \${fig.closest('.piece').querySelector('h2, h3').textContent}\`;
      const loopFrom = Number(fig.dataset.loopFrom), posterAt = Number(fig.dataset.posterAt);
      const hero = fig.dataset.autoplay === 'true';
      let playing = false, rested = false, loops = 0, visible = false;
      video.controls = false;
      button.hidden = false;
      const label = text => { button.textContent = text; button.setAttribute('aria-label', \`\${text} \${name}\`); };
      label('Play');
      const go = () => video.play().catch(err => { if (err.name !== 'AbortError') { console.warn(err); stop('Play'); } });
      const stop = text => { playing = false; video.pause(); label(text); };
      const start = () => { if (rested) { rested = false; video.currentTime = 0; } playing = true; label('Pause'); if (visible) go(); };
      video.addEventListener('ended', () => {
        if (!playing) return;
        if (hero && ++loops > 2) { stop('Replay'); video.currentTime = posterAt; loops = 0; rested = true; return; }
        video.currentTime = loopFrom;
        go();
      });
      button.addEventListener('click', () => (playing ? stop('Play') : start()));
      video.addEventListener('click', () => button.click());
      fig.onVisible = on => { visible = on; if (!playing) return; on ? go() : video.pause(); };
      seen.observe(fig);
      if (hero && !reduce) start();
    }
  </script>
</body>
</html>
`);
console.log(`site: docs/index.html (${SETS.map(s => `${s.key}: ${s.entries.length} pieces, hero ${s.hero.id}`).join('; ')})`);
