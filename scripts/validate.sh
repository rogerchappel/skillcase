#!/usr/bin/env bash
set -euo pipefail

npm test
npm run check
npm run smoke
node bin/skillcase.js generate --json test/fixtures/complete/SKILL.md >/dev/null
