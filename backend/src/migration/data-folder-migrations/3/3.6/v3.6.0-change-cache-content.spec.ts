import { describe, it, before, after, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import type { Knex } from 'knex';
import { mockModule, reloadModule } from '../../../../tests/utils/test-utils';

const nodeRequire = createRequire(import.meta.url);

type MigrationModule = typeof import('./v3.6.0-change-cache-content');

interface CacheMetadata {
  contentFile: string;
  contentSize: number;
  numberOfElement: number;
  createdAt: string;
  contentType: string;
  source: string | null;
  options: Record<string, string | number>;
}

async function pathExists(target: string): Promise<boolean> {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

describe('Data folder migration v3.6.0 (change cache content)', () => {
  let tmpRoot: string;
  let migration: MigrationModule;
  let consoleErrorMock: ReturnType<typeof mock.method>;

  before(async () => {
    tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'oibus-mig-v360-'));

    // Override getCommandLineArguments so the migration's path constants resolve under tmpRoot.
    // Spread the real utils so other exports (createFolder, generateRandomId, etc.) remain intact.
    const utilsPath = '../../../../service/utils';
    const utilsActual = nodeRequire(utilsPath) as Record<string, unknown>;
    mockModule(nodeRequire, utilsPath, {
      ...utilsActual,
      getCommandLineArguments: () => ({
        configFile: tmpRoot,
        version: false,
        ignoreIpFilters: false,
        ignoreRemoteUpdate: false,
        ignoreRemoteConfig: false,
        launcherVersion: 'test'
      })
    });
    migration = reloadModule<MigrationModule>(nodeRequire, './v3.6.0-change-cache-content');

    // The migration is chatty — silence it for the test run.
    mock.method(console, 'info', () => undefined);
  });

  after(async () => {
    mock.restoreAll();
    await fs.rm(tmpRoot, { recursive: true, force: true });
  });

  beforeEach(async () => {
    // Reset the three base subfolders before each test.
    for (const sub of ['cache', 'error', 'archive']) {
      const subPath = path.join(tmpRoot, sub);
      await fs.rm(subPath, { recursive: true, force: true });
      await fs.mkdir(subPath, { recursive: true });
    }
    consoleErrorMock = mock.method(console, 'error', () => undefined);
  });

  it('does nothing when no north or history folders exist in cache, archive or error', async () => {
    await migration.up({} as Knex);

    assert.deepStrictEqual(await fs.readdir(path.join(tmpRoot, 'cache')), []);
    assert.deepStrictEqual(await fs.readdir(path.join(tmpRoot, 'archive')), []);
    assert.deepStrictEqual(await fs.readdir(path.join(tmpRoot, 'error')), []);
  });

  it('moves files from files/ into content/ and writes "any" metadata, then removes files/', async () => {
    const filesPath = path.join(tmpRoot, 'cache', 'north-1', 'files');
    await fs.mkdir(filesPath, { recursive: true });
    await fs.writeFile(path.join(filesPath, 'a.txt'), 'content-a');
    await fs.writeFile(path.join(filesPath, 'b.txt'), 'content-b');

    await migration.up({} as Knex);

    const contentDir = path.join(tmpRoot, 'cache', 'north-1', 'content');
    const metadataDir = path.join(tmpRoot, 'cache', 'north-1', 'metadata');

    const contentEntries = await fs.readdir(contentDir);
    const metadataEntries = await fs.readdir(metadataDir);
    assert.strictEqual(contentEntries.length, 2);
    assert.strictEqual(metadataEntries.length, 2);

    for (const metadataEntry of metadataEntries) {
      const metadata = JSON.parse(await fs.readFile(path.join(metadataDir, metadataEntry), 'utf8')) as CacheMetadata;
      assert.strictEqual(metadata.contentType, 'any');
      assert.strictEqual(contentEntries.includes(metadata.contentFile), true);
    }

    assert.strictEqual(await pathExists(filesPath), false);
  });

  it('moves time-values files into content/ as JSON with computed numberOfElement, then removes time-values/', async () => {
    const timeValuesPath = path.join(tmpRoot, 'cache', 'north-2', 'time-values');
    await fs.mkdir(timeValuesPath, { recursive: true });
    const values = [
      { pointId: 'p1', timestamp: '2024-01-01T00:00:00.000Z', data: { value: 1 } },
      { pointId: 'p2', timestamp: '2024-01-01T00:01:00.000Z', data: { value: 2 } }
    ];
    await fs.writeFile(path.join(timeValuesPath, 'data1.json'), JSON.stringify(values));

    await migration.up({} as Knex);

    const contentDir = path.join(tmpRoot, 'cache', 'north-2', 'content');
    const metadataDir = path.join(tmpRoot, 'cache', 'north-2', 'metadata');

    const contentEntries = await fs.readdir(contentDir);
    const metadataEntries = await fs.readdir(metadataDir);
    assert.strictEqual(contentEntries.length, 1);
    assert.strictEqual(metadataEntries.length, 1);

    const metadata = JSON.parse(await fs.readFile(path.join(metadataDir, metadataEntries[0]), 'utf8')) as CacheMetadata;
    assert.strictEqual(metadata.contentType, 'time-values');
    assert.strictEqual(metadata.numberOfElement, 2);
    assert.strictEqual(contentEntries[0], metadata.contentFile);

    assert.strictEqual(await pathExists(timeValuesPath), false);
  });

  it('refactors history-query north subfolder content the same way as a north connector', async () => {
    const filesPath = path.join(tmpRoot, 'cache', 'history-1', 'north', 'files');
    await fs.mkdir(filesPath, { recursive: true });
    await fs.writeFile(path.join(filesPath, 'c.txt'), 'content-c');

    await migration.up({} as Knex);

    const contentDir = path.join(tmpRoot, 'cache', 'history-1', 'north', 'content');
    const metadataDir = path.join(tmpRoot, 'cache', 'history-1', 'north', 'metadata');
    assert.strictEqual((await fs.readdir(contentDir)).length, 1);
    assert.strictEqual((await fs.readdir(metadataDir)).length, 1);
    assert.strictEqual(await pathExists(filesPath), false);
  });

  it('logs and skips a time-values file that fails to parse as JSON', async () => {
    const timeValuesPath = path.join(tmpRoot, 'cache', 'north-3', 'time-values');
    await fs.mkdir(timeValuesPath, { recursive: true });
    await fs.writeFile(path.join(timeValuesPath, 'bad.json'), 'not valid json');

    await migration.up({} as Knex);

    const contentDir = path.join(tmpRoot, 'cache', 'north-3', 'content');
    const metadataDir = path.join(tmpRoot, 'cache', 'north-3', 'metadata');
    assert.deepStrictEqual(await fs.readdir(contentDir), []);
    assert.deepStrictEqual(await fs.readdir(metadataDir), []);
    assert.strictEqual(consoleErrorMock.mock.calls.length > 0, true);

    // time-values folder is still removed even though the entry failed to migrate.
    assert.strictEqual(await pathExists(timeValuesPath), false);
  });

  it('logs and skips a files/ entry whose rename target collides with an existing directory', async () => {
    const filesPath = path.join(tmpRoot, 'cache', 'north-4', 'files');
    await fs.mkdir(filesPath, { recursive: true });
    await fs.writeFile(path.join(filesPath, 'd.txt'), 'content-d');
    // Pre-create the rename destination as a directory so fs.rename fails (EISDIR).
    await fs.mkdir(path.join(tmpRoot, 'cache', 'north-4', 'content', 'd.txt'), { recursive: true });

    await migration.up({} as Knex);

    const metadataDir = path.join(tmpRoot, 'cache', 'north-4', 'metadata');
    assert.deepStrictEqual(await fs.readdir(metadataDir), []);
    assert.strictEqual(consoleErrorMock.mock.calls.length > 0, true);
    assert.strictEqual(await pathExists(filesPath), false);
  });

  it('down is a no-op', async () => {
    assert.strictEqual(await migration.down(), undefined);
  });
});
