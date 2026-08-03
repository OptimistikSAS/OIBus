import { globSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

// node --test's own CLI glob resolution is unreliable on Windows for recursive `**` patterns
// (matches nothing, no error). Resolving the glob ourselves via fs.globSync and passing the
// resulting file list to --test sidesteps that entirely.
const files = globSync('src/**/*.spec.ts');
if (files.length === 0) {
  console.error('No test files found matching src/**/*.spec.ts');
  process.exit(1);
}

const result = spawnSync(
  process.execPath,
  ['--experimental-config-file=test.config.json', '--test', ...files],
  { stdio: 'inherit' }
);
process.exit(result.status ?? 1);
