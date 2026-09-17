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

`scripts/render.mjs` finds Chrome on PATH; otherwise set `CHROME=/path/to/chrome` (on this machine `~/.local/chrome-for-testing/chrome-linux64/chrome`).
It fails fast on any page error, console error or failed request.
Canvas 2D rendering here is CPU-bound; a 12 s 1080p sequence renders in about 8 s.

Preview query string (also what the renderer uses): `program`, `ar`, `w` (output width), `strokes=engine|legacy`, `twos=1|0`, `frame=N`, `bare=1`.

## Architecture

- `src/core/scene.ts` is the storyboard model.
  A `Scene` is a self-contained mini-timeline: `draw(frame)` is a pure function of local time, with its own `duration` and an optional `loopFrom` idle section.
  A `Sequence` is an ordered list of scenes with a `Transition` into each (`cut`, or a drawn `blot` wipe).
  A `Program` is either a sequence or a single looped scene (`loop` mode: intro once, then `[loopFrom, duration)` repeats; use `loopPhase` for seamless idle motion).
  All timing is integer drawn frames, so cuts and loop seams land on the frame grid.
- `src/core/program.ts` draws any global frame of a program, compositing transitions through stage layers.
- `src/core/stroke.ts` is the stroke engine: even resampling, coherent-noise wobble along arc length, noise pressure, arc-length reveal with a tapered pen head, perfect-freehand outline, optional dry-brush breakup.
- `src/core/ink.ts` groups strokes by one hand (`scheduleWithin` fits a group into a time window) and caches preparation per boil step.
- `src/core/sketch.ts` wraps rough.js; every call needs a positive `seed` (rough.js falls back to `Math.random` otherwise).
- `src/core/stage.ts`: logical frame with the short side fixed at 1080 units; scenes place things relative to `w`, `h`, `cx`, `cy`, and output width is a render-time choice.
- `src/art/`: colour maths, palette schema and presets, finishes (hatch, grain, halftone), riso plates (`plate` + `printPlate`), cached paper stock.
- `src/scenes/`: the demo `house` scene (the vertical slice), `night`, and `demo.ts` with the two-scene sequence and program ids.
- `src/preview/` and `src/runtime/player.ts`: the preview UI and the `window.__handSketch` hooks the renderer calls.

## Invariants

- `Math.random` is banned; derive everything from seeds (`rng`, `hashSeed`, `noise*`).
  The same program, frame, format and settings must give byte-identical pixels (`--verify` checks this).
- Scenes keep no state between frames; caches must be pure functions of their key (layout per frame size, prepared strokes per boil step).
- Boil (re-seeded wobble) belongs in idle sections only, stepped every few drawn frames, never on paper or finishes.
- Default timing is on twos: 12 drawn fps held to 24 output fps.

## Licence and attribution

Palettes, finishes, riso plates, colour maths, the format scheme, the blot wipe and the renderer design are ported from `alesha-pro/tools` `skills/hand-drawn-canvas-animation` under the MIT licence.
Keep `NOTICE` and `LICENSES/alesha-pro-tools-MIT.txt` intact, and keep the attribution header in any file that carries ported code.
