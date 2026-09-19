# hand-sketch

Hand-sketch-style animation done in code: deterministic Canvas 2D scenes, composed into storyboard sequences, previewed live in the browser and rendered offline to mp4.

Delivery: work lands on a branch and goes to `origin` (GitHub `DevRowe/hand-sketch`, private) as a pull request against `main`.
There is no CI pipeline; run `npm run check` before opening a PR.

## Stack

- TypeScript ES modules, strict, built and served with Vite; unit tests with Vitest.
- `perfect-freehand` turns centrelines into variable-width, tapered stroke outlines.
- `roughjs` generates sketchy geometry and hachure fills; its output is converted to polylines and drawn by our stroke engine, never by rough.js's own renderer.
- Offline rendering: `puppeteer-core` driving an installed Chrome, plus `ffmpeg` on PATH.

## Commands

| command | what it does |
|---|---|
| `npm install` | install dependencies |
| `npm run dev` | interactive preview at http://localhost:5173 (play, scrub, program, strokes engine/legacy, aspect, on twos) |
| `npm run check` | typecheck + unit tests + production build; run before every PR |
| `npm run render` | build, then render the demo sequence to `output/sequence/sequence-16x9.mp4` and a contact sheet |
| `npm run render -- --grid 24` | 24 evenly spaced frames tiled into `output/sequence/<name>-grid.jpg`; the fastest look at a whole program |
| `npm run render -- --only 0,40,90` | spot frames as PNGs in `output/sequence/<name>-frames/` |
| `npm run render -- --program loop:house --ar 9:16 --width 1080` | other programs (`sequence`, `sequence:<name>`, `scene:<name>`, `loop:<name>`) and formats; `--poster` adds a poster to a full mp4 render, `--frames <dir under output/>` moves the frame PNGs |
| `npm run render -- --strokes legacy` | the reviewed skill's constant-width stroke look, for comparison |
| `npm run render -- --verify` | render twice in independent page loads and fail if any frame differs |
| `npm run render -- --program loop:gate --seam` | fail unless a looped scene's phase 1 (local frame `duration`) draws pixel-identical to `loopFrom`; reports the differing region |
| `npm run render -- --program loop:untangle --ar 1:1 --width 1080 --web --out dir` | web delivery: 12 fps H.264 + VP9 with a keyframe at `loopFrom`, poster PNG/JPEG at `Scene.poster`, JSON sidecar; implies `--seam` |
| `npm run keystone` | web-render the ten Keystone scenes from `src/scenes/keystone/catalog.json` into `output/keystone/` plus `manifest.json` and `board.html` (`-- --only K01,K08`, `-- --verify`, `-- --board-only`) |
| `npm run poetic` | the same for the ten poetic scenes (`src/scenes/poetic/catalog.json`) into `output/poetic/`, with a gallery board; same flags (`-- --only P01,P08`) |
| `npm run gallery` | the same for the twenty "Many Hands" pieces (`src/scenes/gallery/catalog.json`) into `output/gallery/`, board grouped by visual style; same flags (`-- --only G01,G08`) |
| `npm run solar` | the same for the ten top-down solar systems, one per visual style (`src/scenes/solar/catalog.json`), into `output/solar/`, board of all ten side by side; same flags (`-- --only S01,S07`) |
| `npm run solar:site` | rebuild the public GitHub Pages site (`docs/index.html`: the explorer's card, then both solar sets; `docs/solar/media/` and `docs/solar-spiral/media/`: HD and web mp4s plus posters) from existing `npm run solar` / `npm run spiral` renders and their frames (`-- --set spiral` rebuilds one set's media, `-- --page-only` just the page) |
| `npm run spiral` | the same for the solar set's companion, the ten angled spiral systems (`src/scenes/solar-spiral/catalog.json`), into `output/solar-spiral/`; same flags (`-- --only SP01,SP07`) |
| `npm run explorer` | rebuild the Solar System Explorer (`explorer/index.html` and `src/explorer/`) into `docs/explorer/`, served live on Pages at https://devrowe.github.io/hand-sketch/explorer/; commit the rebuilt folder (`npm run check` fails while it is stale). `npm run dev` serves it at http://localhost:5173/explorer/ |
| `npm run requiem` | render the etched "Requiem" montage (`sequence:requiem`, about 48 s) to `output/requiem/requiem.mp4` plus poster, contact sheet and `requiem.json` cut list (`-- --verify`); about 3 min per pass (its hatching is dense); a local artifact, never force-added |

`scripts/render.mjs` finds Chrome on PATH; otherwise set `CHROME=/path/to/chrome` (on this machine `~/.local/chrome-for-testing/chrome-linux64/chrome`).
It fails fast on any page error, console error or failed request.
Produced renders live under `output/`, which is gitignored. The published sets under `output/keystone/`, `output/poetic/`, and `output/gallery/` are a force-committed snapshot; new renders stay ignored unless deliberately force-added.
To check a board in a real browser here, serve its folder with `python3 -m http.server`; chrome-devtools-axi cannot launch its own Chrome on this machine, so start that Chrome with `--headless=new --remote-debugging-port=<port>` and set `CHROME_DEVTOOLS_AXI_BROWSER_URL=http://127.0.0.1:<port>` (plus a `CHROME_DEVTOOLS_AXI_SESSION` name).
Canvas 2D rendering here is CPU-bound; a 12 s 1080p sequence renders in about 8 s.

Preview query string (also what the renderer uses): `program`, `ar` (any `W:H`; unparsable values fail loudly), `w` (output width), `strokes=engine|legacy`, `twos=1|0`, `frame=N`, `bare=1`.

## Architecture

- `src/core/scene.ts` is the storyboard model.
  A `Scene` is a self-contained mini-timeline: `draw(frame)` is a pure function of local time, with its own `duration` and an optional `loopFrom` idle section.
  A `Sequence` is an ordered list of scenes with a `Transition` into each (`cut`, or a drawn `blot` wipe).
  A `Program` is either a sequence or a single looped scene (`loop` mode: intro once, then `[loopFrom, duration)` repeats; use `loopPhase` for seamless idle motion).
  All timing is integer drawn frames, so cuts and loop seams land on the frame grid.
- `src/core/program.ts` draws any global frame of a program, compositing transitions through stage layers.
- `src/core/stroke.ts` is the stroke engine: even resampling, coherent-noise wobble along arc length, noise pressure, arc-length reveal with a tapered pen head, perfect-freehand outline, optional dry-brush breakup.
- `src/core/ink.ts` groups strokes by one hand (`scheduleWithin` fits a group into a time window) and caches preparation per boil step.
- Motion helpers: `stroke.ts` also draws sub-ranges (`drawStrokeRange`, wrapping on `closed` strokes), samples the wobbled line (`sampleStroke`), morphs with a pinned wobble (`prepareMorph`) and shapes pressure by gesture (`withPressure`); `puppet.ts` draws a drawing prepared once in local units under a pose; `emitter.ts` gives conveyor streams that are periodic by construction; `track.ts` has frame-keyed tracks (`hold`, one-frame `settle`), `chain` and `rampToConstant`; `loop.ts` has the seam-safe `boilStep`.
- `src/core/sketch.ts` wraps rough.js; every call needs a positive `seed` (rough.js falls back to `Math.random` otherwise).
- `src/core/stage.ts`: logical frame with the short side fixed at 1080 units; scenes place things relative to `w`, `h`, `cx`, `cy`, and output width is a render-time choice.
  It also has a view camera (`setView`: zoom about a logical point, and `scale` includes the zoom) that only the explorer sets; a view change wipes every view layer (`layer`) on its next use.
  Paper, `ground`, `toothMask` and gallery `cached` stills are page layers (`pageLayer`): drawn once at the home view and mapped through the camera by `lay`, with `refine` redrawing sharp copies for a held zoom in idle slices; builders must set transforms only through `reset`, and at home (every render) laying is the old full-frame draw, so renders stay byte-identical.
  `lay` draws a page layer by its measured extent (exact under source-over-like compositing), and `bleed` layers (paper, ground, tooth) run on mirrored where the explorer's camera shows past the page's edge.
- `src/art/`: colour maths, palette schema and presets, finishes (hatch, grain, halftone), riso plates (`plate` + `printPlate`), cached paper stock.
- `src/art/roles.ts` (colour by role: pencil = manual, key ink = the client's tools, accent = automation, with stroke presets), `src/art/glyphs.ts` (the office glyph kit, local units centred on the origin, including `squiggle` and `cursive` handwriting) and `src/art/moods.ts` (mood palettes for the poetic set; `inks[0]` is the feeling colour).
- `src/scenes/`: the demo `house` scene (the vertical slice), `night`, `demo.ts` with the two-scene sequence and program ids, and `kit.ts` (design-box `fit`, `perSize` layout caches, fills, 12 fps `nf`/`loopClock` clocks) shared by the sets.
  `src/scenes/keystone/` holds the ten Keystone Systems scenes (`k01-untangle.ts` .. `k10-keystone.ts`, shared `common.ts`) and `catalog.json` (format, poster policy, alt text); the rendered delivery lives in `output/keystone/` and is regenerated with `npm run keystone`.
  `src/scenes/poetic/` holds the ten poetic scenes (`p01-wishes.ts` .. `p10-small-light.ts`, shared `common.ts` with stock, light-as-print `glow`, `lit` reveal-by-light and rising wisps) and `catalog.json` (title, line, arc, loop, poster policy, alt text); delivery in `output/poetic/`, regenerated with `npm run poetic`.
  `src/scenes/gallery/` holds the twenty gallery pieces (`g01-rolling-sea.ts` .. `g20-koi.ts`), each in its own visual language with its palette in `palettes.ts`; `common.ts` is the technique kit (cached `still` layers, per-frame `scratch` layers and `ink` plates printed with registration offsets and tooth, page-locked `screen` halftone, `hatchLines` and `stipple`, `wash`, `scissor`); delivery in `output/gallery/`, regenerated with `npm run gallery`.
  `src/scenes/solar/` draws one subject, the solar system seen from above, in ten styles (`s01-blueprint.ts` .. `s10-deco.ts`, palettes in `palettes.ts`, reusing the gallery technique kit); `common.ts` owns the shared plan and clock (orbits, whole turns per 576-frame loop counted as integer remainders, `POSTER_M`), so the ten differ only in mark-making; delivery in `output/solar/` (ignored, not force-added), regenerated with `npm run solar`.
  `src/scenes/solar-spiral/` is its companion: the same planets and clock seen at an angle while the Sun travels, each orbit drawn out into a helix, in the same ten styles (`sp01-blueprint.ts` .. `sp10-deco.ts`); `common.ts` owns the camera (perspective, `MOTION`, `TILT`), the wakes (`snapshot` samples each helix back from its planet, keyed to each sample's own time `q` so marks ride along instead of swimming) and the painter's order (`paint`: far half of every coil, the Sun, near half); delivery in `output/solar-spiral/` (ignored), regenerated with `npm run spiral`.
  `src/scenes/cislunar/` is the explorer's Earth and Moon view (no render set): one renderer (`draw.ts`) worn in the ten styles (`looks.ts`, same paper keys as the solar plans), a true-scale 3D model seen from above the ecliptic (`common.ts`: Meeus Moon with latitude and distance, sidereal spin, J2-drifting Kepler orbits; Natural Earth coasts in `land.ts`, regenerated by `scripts/cislunar-land.mjs`) and dated stations and satellite counts (`objects.ts`). It is a lens scene: the stage stays home and the scene maps the view itself (`lens.ts`), so paper never zooms and lines keep their weight from ~0.5x to 120x; its static rings are a view layer rebuilt only when the lens changes.
  Both solar sets read where bodies are from a `Sky` (`src/scenes/solar/sky.ts`), never from a bare frame count: a render gets the loop sky (the plan's whole-turns clock); the explorer hands a dated sky (real positions from `ephemeris.ts`, JPL mean elements and Meeus's Moon) through `drawScene`'s `inputs`, with its own trails (top-down sweeps, spiral wakes sampled by `wakePlan`, faded in each style's terms). Changes there must leave renders byte-identical: compare `--only` frames of all twenty scenes before and after.
  `docs/` is a public GitHub Pages site (served from `main` /docs, https://devrowe.github.io/hand-sketch/) that deliberately hosts the solar and solar-spiral videos for watching and download, and the live explorer (`docs/explorer/`, built); everything under `docs/` is public (including the README's `docs/images/`), so publish no other set there without the owner's approval. Preview it with `npx vite preview --outDir docs`, which serves Range requests as Pages does (the page seeks to `loopFrom`).
  The set renderers share `scripts/lib/web-set.mjs` (render loop, sidecars, board player).
  `src/scenes/requiem/` is one long hard-cut sequence rather than a set of loops: `etch.ts` is its plate kit (shots paint a two-channel tone map; red drives five page-locked hatch layers plus aquatint, green drives `engraveCurves` form-following burin lines), `montage.ts` snaps film-time cuts to the drawn grid without drift, `storyboard.ts` lists every cut against `catalog.json`'s film cut times (a test holds them equal), and `shots/` holds the subjects, each designed in a 1600x900 box and cover-fitted into full-frame or split-screen panels.
- `src/preview/` and `src/runtime/player.ts`: the preview UI and the `window.__handSketch` hooks the renderer calls.
- `src/explorer/`: the live Solar System Explorer (entry `explorer/index.html`, config `vite.explorer.config.ts`, build committed under `docs/explorer/`, never edited by hand).
  `sim.ts` is the date, pace and trails model (a real instant, shown in the viewer's calendar; events in UTC); `views.ts` each view's pace and trail ranges, zoom limits and home (the plans never below 1x, so the page edge never shows); `camera.ts` the zoom-and-pan view (no rotation), which keeps the room the controls leave (`setRoom`, from `app.syncRoom`) on the page, so on a wide screen the page slides under the bars and zooms below 1x to frame a moment (`frameBox`); `renderer.ts` sizes the canvas to its device pixels, keeps a stage per backing size, draws to smaller pixel budgets on phones (smallest In motion), steps resolution down while frames run late (on a phone, past ~48 ms) and back to full at rest, and draws saved pictures afresh (`still`); `app.ts` runs the loop (on twos, faster as the pace rises; idle when paused; idle frames call `refine`), holds the defaults (in motion, 2 weeks/s, light trails) and home framing, and picks bodies through `bodies.ts`; `labels.ts` places the names with hysteresis so they fade rather than blink; `presets.ts` with `orbits.ts` and `overlays.ts` are the jump-to moments (`spaceflight.ts` with `trajectories.ts` the Earth and Moon view's, with representative flight paths; pushing a plan's zoom past its deepest on the Earth, or E, dives into that view and the renderer's `cross` fades between them), `moments.ts` the featured ones always on screen, `journey.ts` the bar that replaces the dock while a flight plays; `travel.ts` is the You sheet's arithmetic (distances travelled, age on every planet), `life.ts` your life's helix (the Earth's wake back to a birthday via `TrailSpec.life`, gold birthday ticks, its framing), `share.ts` the share link and the captioned picture, `url.ts` the state a link carries, `welcome.ts` the first visit's tips; the Sky menu's models and drawings are `tonight.ts` (elongations, magnitudes, sight-lines), `phase.ts` and `eclipse.ts` (the Moon's phase, its shadow, the 2027 eclipse), `comets.ts` (Halley timed to its real returns, 3I/ATLAS on a hyperbola, with their moments) and `seasons.ts`, laid out by `skysheet.ts`, drawn over From above as `App.layers`; the Scale menu's are `scale.ts` (the hand-drawn size line-up and galaxy sketch, the basketball model worked out from `content/scale.ts`) and `beyond.ts` (Pluto from the ephemeris, a seeded Kuiper belt; the `dwarfs` layer); `tour.ts` plays the guided tour's stops (`content/tour.ts`) through the moments on its own clock; `sound.ts` is the orbits' sonification (WebAudio created only on the viewer's switch, never remembered); `clip.ts` records a short clip with MediaRecorder; `content/` holds the cards, the guide and the tour, every figure sourced in `content/SOURCES.md`, and `i18n.ts` the interface words (`t`, and `data-i18n*` keys in `index.html`, held in step by a test).
  Navigation: the three views always sit in the top bar; the dock is time only (play, date, speed with Reverse leading its presets, the year, and zoom on wide screens); everything else lives in six menus (`MenuId` in `controls.ts`: Moments with the guided tour, Sky, Scale, Look, You, Guide), each an icon with its word that opens its sheet in the panel (`Panel.openMenu`; the Look sheet is kept whole in `index.html`), mapped in the Guide's "Finding your way".
  A new feature joins the menu it belongs to (Sky for what can be seen from the Earth, Scale for size and depth, You for what you take away) rather than becoming another loose button; every control shows its word beside its icon (only the universal play, step, close and zoom glyphs stand alone, with spoken labels).
  Layout has four modes in `explorer.css`: wide, tablet (<= 980 px wide), upright phone (<= 720 wide and > 540 tall) and short (<= 540 tall, a phone on its side); "compact" (<= 980 wide or <= 540 tall) turns the menus into tabs along the foot of the dock (`place` in `controls.ts`), and `app.freeRect` plus `refit` keep home and framed moments inside the room the controls leave, also after a turn of the phone.
  To measure it, drive the served `docs/explorer/` with puppeteer-core (as `scripts/render.mjs` does) and time `app.renderer.draw` plus a `getImageData(0,0,1,1)` raster flush; CDP `Emulation.setCPUThrottlingRate` 4 approximates a laptop or phone, and a phone's DPR 3 needs Chrome launched with `--force-device-scale-factor=3` (an emulated DPR does not reach the canvas's backing).
  Live-only drawing goes through inputs renders never set, so renders stay byte-identical (compare `--only` frames before and after): the explorer hands plan scenes `room` (`solar/common` `roomOf`/`sheetOf`: the resting free room in design units, which print pieces such as Woodblock's seal keep to and fields bleed past) and sets `halftone.live` (`gallery/common`: even-toned screens become pattern fills).
  `window.__explorer` exposes the running app, panel, tour and sound for browser tests; set `localStorage['explorer.welcomed'] = '1'` first to skip the welcome, and note that `page.goto` to the same URL with only a new hash does not reload the page (it resizes the running one).
  Headless Chrome's synthetic touch taps now and then yield no click; retry a tap only while its target is still on screen, or test layout flows with the mouse and gestures in focused probes.

## Invariants

- `Math.random` is banned; derive everything from seeds (`rng`, `hashSeed`, `noise*`).
  The same program, frame, format and settings must give byte-identical pixels (`--verify` checks this).
- Scenes keep no state between frames; caches must be pure functions of their key (layout per frame size, prepared strokes per boil step).
- Boil (re-seeded wobble) belongs in idle sections only, stepped every few drawn frames, never on paper or finishes.
- Loop sections must be seamless: compute loop motion from an unwrapped loop clock (phase 1 must be the natural continuation, not phase 0 again) and let periodic helpers do the modulo; `--seam` checks it.
  Anything tied to a whole number of frames (beats, look-backs along a periodic path) is safest counted in integer frames or ticks, so the seam frame is exact rather than equal up to rounding.
- A cached offscreen layer's context outlives the frame: draw into it inside `save`/`restore`, or a clip or style set in one frame leaks into the next (and into `--seam`/`--verify`).
- Default timing is on twos: 12 drawn fps held to 24 output fps.

## Licence and attribution

Palettes, finishes, riso plates, colour maths, the format scheme, the blot wipe and the renderer design are ported from `alesha-pro/tools` `skills/hand-drawn-canvas-animation` under the MIT licence.
Keep `NOTICE` and `LICENSES/alesha-pro-tools-MIT.txt` intact, and keep the attribution header in any file that carries ported code.

## Maintaining this file

Keep this file for knowledge useful to almost every future agent session in this project.
Do not repeat what the codebase already shows; point to the authoritative file or command instead.
Prefer rewriting or pruning existing entries over appending new ones.
When updating this file, preserve this bar for all agents and keep entries concise.
