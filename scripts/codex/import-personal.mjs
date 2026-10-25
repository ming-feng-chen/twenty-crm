import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const { parse } = createRequire(import.meta.url)('yaml');
const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url));
const claudeRoot = join(homedir(), '.claude');
const checkOnly = process.argv.includes('--check');
const selected = new Map();
const inventory = [];
let differences = 0;

const discover = (directory) => {
  const entrypoint = join(directory, 'SKILL.md');

  if (existsSync(entrypoint)) {
    return [entrypoint];
  }

  return readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) => discover(join(directory, entry.name)));
};

const personalSkills = join(claudeRoot, 'skills');
const localSkills = readdirSync(personalSkills, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && entry.name !== 'synced')
  .flatMap((entry) => discover(join(personalSkills, entry.name)));
const syncedSkills = discover(join(personalSkills, 'synced'));
const settings = JSON.parse(readFileSync(join(claudeRoot, 'settings.json'), 'utf8'));
const installed = JSON.parse(readFileSync(join(claudeRoot, 'plugins/installed_plugins.json'), 'utf8'));
const pluginSkills = [];

for (const [plugin, enabled] of Object.entries(settings.enabledPlugins ?? {})) {
  if (!enabled) {
    continue;
  }

  const installations = installed.plugins[plugin];

  if (installations?.length !== 1) {
    throw new Error(`Resolve the active installation of ${plugin} before importing.`);
  }

  pluginSkills.push(...discover(join(installations[0].installPath, 'skills')));
}

const write = (path, content) => {
  if (existsSync(path) && readFileSync(path, 'utf8') === content) {
    return;
  }

  differences += 1;

  if (!checkOnly) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
  }
};

for (const source of [...localSkills, ...syncedSkills, ...pluginSkills]) {
  const content = readFileSync(source, 'utf8');
  const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---/.exec(content);

  if (!frontmatter) {
    throw new Error(`Missing skill metadata: ${source}`);
  }

  const metadata = parse(frontmatter[1]);
  const name = metadata.name;

  if (typeof name !== 'string' || typeof metadata.description !== 'string') {
    throw new Error(`Missing skill name or description: ${source}`);
  }

  const repositorySkill = join(repositoryRoot, '.claude/skills', name, 'SKILL.md');

  if (existsSync(repositorySkill)) {
    inventory.push({ name, source, uses: repositorySkill, reason: 'project-specific workflow takes precedence' });
    continue;
  }

  if (selected.has(name)) {
    inventory.push({ name, source, uses: selected.get(name), reason: 'local personal skill takes precedence over synced duplicate' });
    continue;
  }

  selected.set(name, source);
  const importedName = `claude-personal-${name}`;

  if (importedName.length > 64 || !/^[a-z0-9-]+$/.test(importedName)) {
    throw new Error(`Unsupported imported skill name: ${importedName}`);
  }

  const destination = join(repositoryRoot, '.agents/skills', importedName);
  const sourcePath = source.replaceAll('\\', '/');
  const workflowPath = join(repositoryRoot, 'CODEX-SETUP.md').replaceAll('\\', '/');
  const description = metadata.description.replaceAll(/\s+/g, ' ').trim();
  const wrapper = [
    '---',
    `name: ${importedName}`,
    `description: ${JSON.stringify(description)}`,
    '---',
    '',
    `Read and follow [the original ${name} skill](<${sourcePath}>) before acting. Resolve its supporting resources relative to that source directory.`,
    '',
    `Apply the personal-skill compatibility rules in [CODEX-SETUP.md](<${workflowPath}>). Preserve the source workflow and explicit approvals. Tool availability must be checked; a reference to a Claude connector does not provide that connector in Codex.`,
    '',
  ].join('\n');
  write(join(destination, 'SKILL.md'), wrapper);
  const explicitOnly = metadata['disable-model-invocation'] === true;
  write(join(destination, 'agents/openai.yaml'), `policy:\n  allow_implicit_invocation: ${!explicitOnly}\n`);
  inventory.push({ name, source, importedName, explicitOnly });
}

write(join(repositoryRoot, '.codex/personal-skills.json'), JSON.stringify(inventory, null, 2) + '\n');
console.log(`${selected.size} personal/plugin skills; ${inventory.length - selected.size} duplicates use existing workflows; ${differences} ${checkOnly ? 'differences' : 'files updated'}.`);
process.exitCode = checkOnly && differences > 0 ? 1 : 0;
