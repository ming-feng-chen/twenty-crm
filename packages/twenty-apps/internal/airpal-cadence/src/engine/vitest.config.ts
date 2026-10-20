import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { defineConfig } from 'vitest/config';

// The cache goes to the OS temp dir so a run leaves nothing inside src/engine.
export default defineConfig({
  cacheDir: join(tmpdir(), 'airpal-cadence-engine-vitest'),
  test: {
    include: ['**/*.test.ts'],
  },
});
