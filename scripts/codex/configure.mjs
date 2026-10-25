import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url));
const configurationRoot = join(repositoryRoot, '.codex');
const backupRoot = join(repositoryRoot, 'node_modules/.cache/codex-setup-backup');
const configurationPath = join(configurationRoot, 'config.toml');
const hooksPath = join(configurationRoot, 'hooks.json');
const gitBash = 'C:/Program Files/Git/bin/bash.exe';

if (!existsSync(gitBash)) {
  throw new Error('Git Bash was not found at the verified location.');
}

mkdirSync(backupRoot, { recursive: true });

for (const name of ['config.toml', 'hooks.json']) {
  const backup = join(backupRoot, name);

  if (!existsSync(backup)) {
    writeFileSync(backup, readFileSync(join(configurationRoot, name)));
  }
}

let configuration = readFileSync(configurationPath, 'utf8');
configuration = configuration.replace(
  /\[mcp_servers\.postgres\]\r?\ncommand = "bash"/,
  `[mcp_servers.postgres]\ncommand = "${gitBash}"\ncwd = ${JSON.stringify(repositoryRoot.replaceAll('\\', '/'))}`,
);
configuration = configuration.replace(
  /\[mcp_servers\.playwright\]\r?\ncommand = "npx"\r?\nargs = \[\r?\n(?!\s*"-y")/,
  '[mcp_servers.playwright]\ncommand = "npx"\nargs = [\n    "-y",\n',
);
writeFileSync(configurationPath, configuration);

const hooks = JSON.parse(readFileSync(hooksPath, 'utf8'));
const sessionHooks = hooks.hooks.SessionStart;

if (sessionHooks.length !== 1 || sessionHooks[0].hooks.length !== 1) {
  throw new Error('SessionStart configuration changed; review before adapting it.');
}

sessionHooks[0].hooks[0].command = `node "${join(repositoryRoot, 'scripts/codex/session-start.mjs').replaceAll('\\', '/')}"`;

if (process.argv.includes('--personal')) {
  const notificationCommand = `node "${join(repositoryRoot, 'scripts/codex/notify.mjs').replaceAll('\\', '/')}"`;

  for (const event of ['Stop', 'PermissionRequest']) {
    hooks.hooks[event] ??= [];

    if (!hooks.hooks[event].some((group) => group.hooks.some((hook) => hook.command === notificationCommand))) {
      hooks.hooks[event].push({ hooks: [{ type: 'command', command: notificationCommand, timeout: 10 }] });
    }
  }
}

writeFileSync(hooksPath, JSON.stringify(hooks, null, 2) + '\n');

const sync = spawnSync(process.execPath, [join(repositoryRoot, 'scripts/codex/sync-skills.mjs')], {
  cwd: repositoryRoot,
  stdio: 'inherit',
});

if (sync.error) {
  throw sync.error;
}

process.exitCode = sync.status ?? 1;
