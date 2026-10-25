# Temporary Codex takeover

Ming-Feng requested this setup on 2026-10-17, confirmed Claude is paused, and explicitly included personal Claude setup. All Codex adaptations are scoped to this project. Claude's source instructions, settings, skills and private memory remain authoritative inputs; product decisions are recorded in the cadence specification. Setup does not approve unresolved product choices or deployments.

## Start work

1. Read `CLAUDE.md`, `SKILLS.md` and `HANDOVER-ASTRA.md`. For cadence work read `packages/twenty-apps/internal/airpal-cadence/SPEC.md` and its README. The handover is historical evidence, not proof of the current deployment.
2. Read the project memory index at `C:/Users/ming_/.claude/projects/C--Users-ming--Desktop-Workk-AirPal-CRM/memory/MEMORY.md` and its linked design/deployment notes when that context is needed. Use the existing files; avoid creating a competing memory copy. Some memory predates the handover and implementation.
3. Check `git status --short` before editing. At takeover, branch `main` was at `9b0bedc720`; the cadence app, handover and existing Codex setup were untracked. Preserve that work and coordinate with the owner before resuming Claude in the same folder.
4. Ask one question at a time about missing requirements, conflicts or pending decisions. Explain the practical effect and recommend an option. Keep the handover's F1-F4, G1-G4, H1, S1 and meeting-stage questions pending until answered.
5. Use independent subagents for parallel work where the task or applicable skill calls for it, and verify their results before reporting. Run the checks appropriate to the change and distinguish local, API and browser evidence.
6. Before staging operations, confirm the target and pass `--remote staging` or `--environment staging` explicitly. The Railway folder is linked to production. Production changes, destructive staging changes identified in the handover, commits and pushes still need explicit authorization. Never print credentials or dump environment/configuration files containing them.

## Claude skills and hooks in Codex

The 18 project skills in `.claude/skills` are the source. `.agents/skills` contains exact copies including supporting files, plus the five portable app-development skills built from `packages/twenty-agent-skills`. `SKILLS.md` explains their different audiences.

Run `node scripts/codex/sync-skills.mjs --check` to detect drift. After an intentional source change, build the portable skills with `node packages/twenty-agent-skills/scripts/build.js`, then run `node scripts/codex/sync-skills.mjs`. The latter writes protected agent configuration and may require Codex approval. It copies without deleting unrelated skills.

Compatibility rules:

- A Claude instruction to call the Skill tool means read and follow that skill's `SKILL.md` and the references it requires. Claude slash-command names correspond to Codex `$skill-name` invocations. Do not replace references to `CLAUDE.md` with `AGENTS.md`.
- Preserve explicit-only invocation for `grill-with-docs`, `retro` and `thermo-nuclear-code-quality-review` using `agents/openai.yaml` with `allow_implicit_invocation: false`.
- Preserve the workflow when translating harness names and tool calls. If an exact browser, database or other tool is unavailable, report the gap; do not claim that skill's verification has passed.
- `.codex/hooks.json` runs `scripts/codex/session-start.mjs`. It reads Claude's SessionStart instruction text from `.claude/settings.json` and emits Codex `additionalContext`. It does not execute the Bash text. If the source format changes, the adapter fails visibly for review.
- The source hook's communication rules apply in this chat too: concise human tone, standard punctuation, no em dashes or unsolicited emojis, no attribution/signatures in repository or GitHub artifacts, and only necessary comments explaining why.

Open a fresh Codex chat in this project after setup to load the updated skill catalog, startup hook and MCP configuration. This chat can read the skills directly. A successful direct hook test does not prove a future chat loaded it.

## Personal skills and notifications

`node scripts/codex/import-personal.mjs` discovers personal skills under `~/.claude/skills` and skills in the two enabled Claude plugins, React Native best practices and DuckDB. It creates 42 project-local adapters named `claude-personal-<original-name>`. Ten duplicate entries resolve to the existing project skill or the top-level personal version before its synced copy. The local `.codex/personal-skills.json` records every source and resolution. Run the importer with `--check` to check drift without writing.

The adapters point to the original skill and its supporting files instead of copying personal/proprietary content into this public fork. Their folders and inventory are Git-ignored. They preserve each source's automatic or explicit-only invocation setting. When an imported skill calls another skill by its original name, use the project version if present; otherwise find its `claude-personal-` adapter in the inventory. Read the original skill before using it.

Compatibility rules for personal workflows:

- Claude Agent/Explore calls map to available Codex subagents; verify delegated results. Claude Skill calls map to reading the relevant skill. Preserve each workflow's interview, planning, implementation and review boundaries.
- The personal AirPal PRD skill describes the airport wayfinding product, not this CRM. Its availability does not change this project's scope.
- Claude Docs, cloud memory import, Google connectors, scheduled tasks, artifact links and `/mnt/...` runtime paths are environment-specific. Use the available Codex artifact/automation skills and connected tools for equivalent operations, and verify tool access first. Claude cloud memory import has no connected equivalent here. Google access and account authorizations have not been transferred. Never claim those operations are available merely because their skill is imported.
- The installed DuckDB and React Native skill instructions are reachable; their external binaries, mobile devices and service connections are checked when their workflow is invoked. Installing their adapters does not install all their tool dependencies.
- Claude model names, effort settings, UI theme, update channel and transcript formats are not portable Codex settings. Keep the user's selected Codex model and app settings. No credentials or Claude account session were copied.

The existing personal Windows toast script is reused through `scripts/codex/notify.mjs`. Codex Stop passes its `last_assistant_message` as Claude's `assistant_message`; PermissionRequest emits a generic attention message without copying tool input. The adapter returns no approval decision. Codex has no documented general Notification event, so this covers completion and permission requests, not every Claude notification type. Native Codex UI handles other attention states. The original personal script and its settings are unchanged.

`node scripts/codex/configure.mjs --personal` wires these notification adapters and the startup hook. It preserves unrelated config and keeps original project config backups under ignored `node_modules/.cache/codex-setup-backup`. Changes to `.codex` and `.agents` may require approval under the active sandbox.

## Local cadence commands

Run from the repository root:

```powershell
node scripts/codex/cadence.mjs test
node scripts/codex/cadence.mjs typecheck
node scripts/codex/cadence.mjs lint
node scripts/codex/cadence.mjs build
```

These use the installed app dependencies and the repo-built Twenty CLI. The runner sets child-process TEMP/TMP inside the app's ignored `node_modules/.cache/codex-temp`, avoiding Windows sandbox rename failures. On Windows, build preloads the app's existing POSIX-path adapter with forward slashes so Node preserves paths containing spaces. Build uploads nothing.

For Yarn, use `node .yarn/releases/yarn-4.13.0.cjs <arguments>` from the root. The bundled version is 4.13.0. The bare Corepack shim attempted a network download under this sandbox even though the bundled release already exists.

The app's parity test imports the old CRM under `C:/Users/ming_/Desktop/Workk/crm`; keep that checkout available. Full Twenty core development is a separate setup; do not infer that a successful cadence build proves the entire monorepo runs locally.

## Tools and verification

The existing project MCP definitions are Context7, Playwright and read-only Postgres. Codex's Postgres command uses the verified Git Bash executable and repository working directory; plain `bash` resolves to Windows' WSL launcher here. The database URL remains in the existing server `.env`, and its host was checked to be loopback without printing credentials. Neither that fact nor a configured MCP entry proves a database service is running.

Verified on 2026-10-17:

- Node 24.21.0; bundled Yarn 4.13.0; Twenty CLI 2.49.0.
- Cadence unit/parity tests: 25 files, 517 passing tests.
- Cadence TypeScript check passed; lint reported zero errors and warnings.
- Local cadence build passed. Existing warning: `logged-touch-panel` has no `widgetAvailability`, so it is not offered in widget pickers.
- Portable Twenty skill distribution built; source and distribution validators passed. The source validator's Bash checks needed Git Bash outside the Windows sandbox.
- All 47 new skill entrypoints passed the skill-creator validator. All 18 project skill copies match their sources; project and personal drift checks reported zero differences. Every personal source/precedence link was checked. PyYAML 6.0.3 for the validator is installed only in ignored `node_modules/.cache/codex-validation-python`.
- Startup adapter output preserves the source instructions. Notification payload checks passed, including excluding private tool input from approval notices. Actual toast delivery and automatic hook loading have not been observed in a restarted Codex session.

Staging/production state, authenticated browser access, MCP connections and full core startup are separate from this local baseline. No deployment or migration was performed by this setup. Credentials remain in their existing private locations identified by the handover.

## Hand back to Claude

Pause Codex edits first. Report changed files, decisions explicitly made by the owner, exact checks and outcomes, deployment actions and remaining work. Keep `HANDOVER-ASTRA.md`'s original history distinguishable from new evidence, and update the relevant existing specification when an approved product decision changes it. Leave commits and pushes to the owner's instruction.

## Codex references

The adapters follow the official [skills documentation](https://learn.chatgpt.com/docs/build-skills), [hooks documentation](https://learn.chatgpt.com/docs/hooks) and [configuration reference](https://learn.chatgpt.com/docs/config-file/config-reference).
