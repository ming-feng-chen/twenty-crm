// Windows-only preload for the twenty CLI (2.49): the CLI builds manifest and
// upload paths with path.relative(), which yields backslashes on Windows, and
// the server rejects them ("Resource path must not contain backslashes").
// Load it with NODE_OPTIONS="--require <this file>" so the build worker gets it too.
const path = require('node:path');

if (process.platform === 'win32' && !path.relative.__twentyPosixPatched) {
  const originalRelative = path.relative;
  const posixRelative = (from, to) =>
    originalRelative(from, to).split('\\').join('/');

  posixRelative.__twentyPosixPatched = true;
  path.relative = posixRelative;
}
