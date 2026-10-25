import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const payload = JSON.parse(readFileSync(0, 'utf8'));
const notification = payload.hook_event_name === 'PermissionRequest';
const adapted = {
  hook_event_name: notification ? 'Notification' : 'Stop',
  cwd: payload.cwd,
  message: notification ? 'Codex needs your approval to continue.' : undefined,
  assistant_message: notification ? undefined : payload.last_assistant_message ?? 'Finished this turn.',
};

if (process.argv.includes('--check')) {
  process.stdout.write(JSON.stringify(adapted) + '\n');
} else {
  const result = spawnSync('powershell.exe', [
    '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
    '-File', join(homedir(), '.claude/claude-notify.ps1'),
  ], { input: JSON.stringify(adapted), encoding: 'utf8', windowsHide: true, timeout: 8000 });

  process.stdout.write(JSON.stringify(result.error || result.status !== 0
    ? { systemMessage: 'The Windows notification adapter could not run.' }
    : {}) + '\n');
}
