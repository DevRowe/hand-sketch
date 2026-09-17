import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Relative asset URLs so the built preview works from any static root, including the offline renderer's server.
  base: './',
  build: { target: 'es2022' },
  test: { include: ['tests/**/*.test.ts'] },
});
