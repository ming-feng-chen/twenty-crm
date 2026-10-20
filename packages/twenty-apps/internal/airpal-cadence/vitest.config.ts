import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { defineConfig } from 'vitest/config';

// `yarn test` runs every unit test in the app, the engine's included. The
// cache goes to the OS temp dir so a run leaves nothing in the project.
export default defineConfig({
  cacheDir: join(tmpdir(), 'airpal-cadence-vitest'),
  resolve: {
    alias: { src: resolve(__dirname, 'src') },
  },
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
  },
});
