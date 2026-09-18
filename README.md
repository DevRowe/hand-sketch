# hand-sketch

Hand-sketch-style animation done in code: deterministic Canvas 2D scenes with a variable-width stroke engine, composed into storyboard sequences, previewed live and rendered offline to mp4.

![Stroke comparison](docs/images/stroke-comparison.jpg)

![Demo sequence contact sheet](docs/images/sequence-contact.jpg)

```bash
npm install
npm run dev        # interactive preview
npm run check      # typecheck + tests + build
npm run render     # output/sequence/sequence-16x9.mp4 (needs Chrome and ffmpeg)
npm run keystone   # the ten Keystone animations -> output/keystone/ (mp4, webm, posters, manifest.json, board.html)
npm run poetic     # "A Life in Ten Lines", ten poetic animations -> output/poetic/ (same deliverables, gallery board)
npm run gallery    # twenty "Many Hands" pieces -> output/gallery/
```

See [AGENTS.md](AGENTS.md) for commands, architecture and invariants, and [NOTICE](NOTICE) for third-party attribution.
