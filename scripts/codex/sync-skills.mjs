import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url));
const checkOnly = process.argv.slice(2).includes('--check');
const sources = [
  join(repositoryRoot, '.claude/skills'),
  join(repositoryRoot, 'packages/twenty-agent-skills/dist/skills'),
];
const destinationRoot = join(repositoryRoot, '.agents/skills');
let differences = 0;
let skillCount = 0;

const syncFile = (source, destination) => {
  if (existsSync(destination) && readFileSync(source).equals(readFileSync(destination))) {
    return;
  }

  differences += 1;
  console.log(`${checkOnly ? 'DIFF' : 'SYNC'} ${relative(repositoryRoot, destination)}`);

  if (!checkOnly) {
    copyFileSync(source, destination);
  }
};

const syncDirectory = (source, destination) => {
  if (!checkOnly) {
    mkdirSync(destination, { recursive: true });
  }

  for (const entry of readdirSync(source, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      syncDirectory(join(source, entry.name), join(destination, entry.name));
    } else if (entry.isFile()) {
      syncFile(join(source, entry.name), join(destination, entry.name));
    }
  }
};

for (const sourceRoot of sources) {
  for (const entry of readdirSync(sourceRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }

    const source = join(sourceRoot, entry.name);
    const entrypoint = join(source, 'SKILL.md');

    if (!existsSync(entrypoint)) {
      continue;
    }

    skillCount += 1;
    const destination = join(destinationRoot, entry.name);
    syncDirectory(source, destination);

    if (/^disable-model-invocation:\s*true\s*$/m.test(readFileSync(entrypoint, 'utf8'))) {
      const metadataPath = join(destination, 'agents/openai.yaml');
      const metadata = 'policy:\n  allow_implicit_invocation: false\n';

      if (!existsSync(metadataPath) || readFileSync(metadataPath, 'utf8') !== metadata) {
        if (existsSync(metadataPath)) {
          throw new Error(`Review existing metadata before replacing ${metadataPath}`);
        }

        differences += 1;
        console.log(`${checkOnly ? 'DIFF' : 'SYNC'} ${relative(repositoryRoot, metadataPath)}`);

        if (!checkOnly) {
          mkdirSync(join(destination, 'agents'), { recursive: true });
          writeFileSync(metadataPath, metadata);
        }
      }
    }
  }
}

console.log(`${skillCount} skills checked; ${differences} ${checkOnly ? 'differences' : 'files synchronized'}.`);
process.exitCode = checkOnly && differences > 0 ? 1 : 0;
