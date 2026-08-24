import { globSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

// node --test's own CLI glob resolution is unreliable on Windows for recursive `**` patterns
// (matches nothing, no error). Resolving the glob ourselves via fs.globSync and passing the
// resulting file list to --test sidesteps that entirely.
//
// native/**/*.spec.ts covers local packages under backend/native/ (e.g. @oibus/oledb-windows,
// @oibus/pi-afsdk-windows) — they ship their own tests but aren't under src/, so they need their own
// glob. Their node_modules (if any get installed locally for that package) are excluded the same way
// src/ implicitly is.
const files = [
  ...globSync('src/**/*.spec.ts'),
  ...globSync('native/**/*.spec.ts', { exclude: path => path.includes('node_modules') })
];
if (files.length === 0) {
  console.error('No test files found matching src/**/*.spec.ts or native/**/*.spec.ts');
  process.exit(1);
}

const result = spawnSync(
  process.execPath,
  ['--experimental-config-file=test.config.json', '--test', ...files],
  { stdio: 'inherit' }
);
process.exit(result.status ?? 1);
