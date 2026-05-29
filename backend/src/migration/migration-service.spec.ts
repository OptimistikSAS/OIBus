import { describe, it, before, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import { migrateDataFolder } from './migration-service';

const TMP_DIR = path.join(os.tmpdir(), `oibus-mig-svc-test-${process.pid}`);
const TMP_DB = path.join(TMP_DIR, 'data-folder.db');

describe('migration-service', () => {
  let origCwd: string;

  before(async () => {
    origCwd = process.cwd();
    // Create a minimal data-folder structure that the data-folder migrations expect.
    await fs.mkdir(path.join(TMP_DIR, 'cache'), { recursive: true });
    await fs.mkdir(path.join(TMP_DIR, 'archive'), { recursive: true });
    await fs.mkdir(path.join(TMP_DIR, 'error'), { recursive: true });
    // Silence migration console output.
    mock.method(console, 'info', () => undefined);
    mock.method(console, 'error', () => undefined);
    // Change CWD so getCommandLineArguments() returns configFile pointing to TMP_DIR.
    process.chdir(TMP_DIR);
  });

  after(async () => {
    process.chdir(origCwd);
    mock.restoreAll();
    await fs.rm(TMP_DIR, { recursive: true, force: true });
  });

  it('should run migrateDataFolder without errors on a fresh database', async () => {
    await assert.doesNotReject(() => migrateDataFolder(TMP_DB));
  });

  it('should be idempotent — second call should not throw', async () => {
    await assert.doesNotReject(() => migrateDataFolder(TMP_DB));
  });
});
