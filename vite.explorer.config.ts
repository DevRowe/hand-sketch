import { defineConfig } from 'vite';

/**
 * The Solar System Explorer: a static build of `explorer/index.html` into `docs/explorer/`, which GitHub Pages serves
 * from main as https://devrowe.github.io/hand-sketch/explorer/. Relative asset URLs, so it runs from any folder;
 * `npm run explorer` builds it, and `npm run check` fails when the committed build is stale.
 */
export default defineConfig({
  root: 'explorer',
  base: './',
  publicDir: false,
  build: {
    target: 'es2022',
    outDir: '../docs/explorer',
    emptyOutDir: true,
    // one script and one stylesheet: the page is a single screen that needs all of it at once
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 800,
  },
});
