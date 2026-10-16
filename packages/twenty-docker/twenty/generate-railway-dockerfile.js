const fs = require('fs');
const path = require('path');

const dir = __dirname;
const source = fs.readFileSync(path.join(dir, 'Dockerfile'), 'utf8');
const markerIndex = source.indexOf('# Target: twenty-aws ');

if (markerIndex < 0) {
  throw new Error('twenty-aws stage marker not found in Dockerfile');
}

const body = source
  .slice(0, source.lastIndexOf('# ====', markerIndex))
  .trimEnd();
const header = [
  '# Generated from ./Dockerfile, cut after the production `twenty` stage: Railway builds the last stage',
  '# and rejects volume declarations. Regenerate after upstream syncs with: node generate-railway-dockerfile.js',
  '',
].join('\n');

fs.writeFileSync(path.join(dir, 'Dockerfile.railway'), `${header}\n${body}\n`);
