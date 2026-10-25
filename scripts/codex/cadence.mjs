import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url));
const appRoot = join(repositoryRoot, 'packages/twenty-apps/internal/airpal-cadence');
const temporaryDirectory = join(appRoot, 'node_modules/.cache/codex-temp');
const [operation, ...arguments_] = process.argv.slice(2);
const commands = {
  test: ['node_modules/vitest/vitest.mjs', 'run'],
  typecheck: ['node_modules/typescript/bin/tsc', '--noEmit', '-p', 'tsconfig.json'],
  lint: ['node_modules/oxlint/bin/oxlint', '-c', '.oxlintrc.json', '.'],
  build: [join(repositoryRoot, 'packages/twenty-cli/dist/cli.cjs'), 'app', 'build'],
};

if (!Object.hasOwn(commands, operation)) {
  console.error('Usage: node scripts/codex/cadence.mjs <test|typecheck|lint|build> [arguments]');
  process.exit(1);
}

mkdirSync(temporaryDirectory, { recursive: true });
const environment = { ...process.env, TEMP: temporaryDirectory, TMP: temporaryDirectory };

if (operation === 'build' && process.platform === 'win32') {
  const preload = join(appRoot, 'scripts/windows-posix-relative-paths.cjs').replaceAll('\\', '/');
  environment.NODE_OPTIONS = [environment.NODE_OPTIONS, `--require "${preload}"`]
    .filter(Boolean).join(' ');
}

const result = spawnSync(process.execPath, [...commands[operation], ...arguments_], {
  cwd: appRoot,
  env: environment,
  stdio: 'inherit',
});

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
