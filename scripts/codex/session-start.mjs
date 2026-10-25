import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const settingsPath = new URL('../../.claude/settings.json', import.meta.url);
const settings = JSON.parse(readFileSync(settingsPath, 'utf8'));
const instructions = settings.hooks.SessionStart.flatMap(({ hooks }) =>
  hooks.map(({ command }) => {
    const match = /^cat <<'EOF'\r?\n([\s\S]*?)\r?\nEOF\s*$/.exec(command);

    if (!match) {
      throw new Error('Claude SessionStart changed; review the Codex adapter.');
    }

    return match[1];
  }),
);

process.stdout.write(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: 'SessionStart',
    additionalContext: [
      ...instructions,
      `Read ${fileURLToPath(new URL('../../AGENTS.md', import.meta.url))} and follow its linked project instructions.`,
    ].join('\n\n'),
  },
}) + '\n');
