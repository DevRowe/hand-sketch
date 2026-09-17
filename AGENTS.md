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
| `npm run render` | build, then render the demo sequence to `out/sequence-16x9.mp4` and a contact sheet |
| `npm run render -- --grid 24` | 24 evenly spaced frames tiled into `out/<name>-grid.jpg`; the fastest look at a whole program |
| `npm run render -- --only 0,40,90` | spot frames as PNGs in `out/<name>-frames/` |
| `npm run render -- --program loop:house --ar 9:16 --width 1080` | other programs (`sequence`, `scene:<name>`, `loop:<name>`) and formats |
| `npm run render -- --strokes legacy` | the reviewed skill's constant-width stroke look, for comparison |
| `npm run render -- --verify` | render twice in independent page loads and fail if any frame differs |
| `npm run render -- --program loop:gate --seam` | fail unless a looped scene's phase 1 (local frame `duration`) draws pixel-identical to `loopFrom`; reports the differing region |
| `npm run render -- --program loop:untangle --ar 1:1 --width 1080 --web --out dir` | web delivery: 12 fps H.264 + VP9 with a keyframe at `loopFrom`, poster PNG/JPEG at `Scene.poster`, JSON sidecar; implies `--seam` |
| `npm run keystone` | web-render the ten Keystone scenes from `src/scenes/keystone/catalog.json` into `keystone/` plus `manifest.json` and `board.html` (`-- --only K01,K08`, `-- --verify`, `-- --board-only`) |
| `npm run poetic` | the same for the ten poetic scenes (`src/scenes/poetic/catalog.json`) into `poetic/`, with a gallery board; same flags (`-- --only P01,P08`) |
| `npm run gallery` | the same for the twenty "Many Hands" pieces (`src/scenes/gallery/catalog.json`) into `gallery/`, board grouped by visual style; same flags (`-- --only G01,G08`) |

`scripts/render.mjs` finds Chrome on PATH; otherwise set `CHROME=/path/to/chrome` (on this machine `~/.local/chrome-for-testing/chrome-linux64/chrome`).
It fails fast on any page error, console error or failed request.
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
- `src/art/`: colour maths, palette schema and presets, finishes (hatch, grain, halftone), riso plates (`plate` + `printPlate`), cached paper stock.
- `src/art/roles.ts` (colour by role: pencil = manual, key ink = the client's tools, accent = automation, with stroke presets), `src/art/glyphs.ts` (the office glyph kit, local units centred on the origin, including `squiggle` and `cursive` handwriting) and `src/art/moods.ts` (mood palettes for the poetic set; `inks[0]` is the feeling colour).
- `src/scenes/`: the demo `house` scene (the vertical slice), `night`, `demo.ts` with the two-scene sequence and program ids, and `kit.ts` (design-box `fit`, `perSize` layout caches, fills, 12 fps `nf`/`loopClock` clocks) shared by the sets.
  `src/scenes/keystone/` holds the ten Keystone Systems scenes (`k01-untangle.ts` .. `k10-keystone.ts`, shared `common.ts`) and `catalog.json` (format, poster policy, alt text); the rendered delivery lives in `keystone/` and is regenerated with `npm run keystone`.
  `src/scenes/poetic/` holds the ten poetic scenes (`p01-wishes.ts` .. `p10-small-light.ts`, shared `common.ts` with stock, light-as-print `glow`, `lit` reveal-by-light and rising wisps) and `catalog.json` (title, line, arc, loop, poster policy, alt text); delivery in `poetic/`, regenerated with `npm run poetic`.
  `src/scenes/gallery/` holds the twenty gallery pieces (`g01-rolling-sea.ts` .. `g20-koi.ts`), each in its own visual language with its palette in `palettes.ts`; `common.ts` is the technique kit (cached `still` layers, per-frame `scratch` layers and `ink` plates printed with registration offsets and tooth, page-locked `screen` halftone, `hatchLines` and `stipple`, `wash`, `scissor`); delivery in `gallery/`, regenerated with `npm run gallery`.
  The set renderers share `scripts/lib/web-set.mjs` (render loop, sidecars, board player).
- `src/preview/` and `src/runtime/player.ts`: the preview UI and the `window.__handSketch` hooks the renderer calls.

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
