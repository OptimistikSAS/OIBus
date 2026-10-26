import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { after, before, beforeEach, describe, it, mock } from 'node:test';

import type { Knex } from 'knex';

import { mockModule, reloadModule } from '../../../../tests/utils/test-utils';

const nodeRequire = createRequire(import.meta.url);

type MigrationModule = typeof import('./v3.10.0_1');

describe('Data folder migration v3.10.0_1 (cached any content renamed file)', () => {
  let tmpRoot: string;
  let migration: MigrationModule;

  before(async () => {
    tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'oibus-mig-v3100_1-'));
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
    migration = reloadModule<MigrationModule>(nodeRequire, './v3.10.0_1');
    mock.method(console, 'info', () => undefined);
    mock.method(console, 'error', () => undefined);
  });

  after(async () => {
    mock.restoreAll();
    await fs.rm(tmpRoot, { recursive: true, force: true });
  });

  beforeEach(async () => {
    for (const root of ['cache', 'error', 'archive']) {
      await fs.rm(path.join(tmpRoot, root), { recursive: true, force: true });
    }
  });

  const writeCacheFile = async (folder: string, filename: string, contentType: string) => {
    await fs.mkdir(path.join(folder, 'metadata'), { recursive: true });
    await fs.mkdir(path.join(folder, 'content'), { recursive: true });
    await fs.writeFile(path.join(folder, 'content', filename), 'a;b\n1;2');
    await fs.writeFile(
      path.join(folder, 'metadata', filename),
      JSON.stringify({ contentFile: 'file.csv', contentSize: 7, numberOfElement: 0, createdAt: '', contentType })
    );
  };
  const readMetadata = async (folder: string, filename: string) =>
    JSON.parse(await fs.readFile(path.join(folder, 'metadata', filename), 'utf-8'));

  it('should rename the any content type of the cached files of norths and history queries', async () => {
    const folders = [
      path.join(tmpRoot, 'cache', 'north-n1'),
      path.join(tmpRoot, 'error', 'north-n1'),
      path.join(tmpRoot, 'archive', 'history-h1', 'north')
    ];
    for (const folder of folders) {
      await writeCacheFile(folder, 'f1', 'any');
      await writeCacheFile(folder, 'f2', 'record-list');
    }

    await migration.up({} as Knex);

    for (const folder of folders) {
      assert.deepStrictEqual(await readMetadata(folder, 'f1'), {
        contentFile: 'file.csv',
        contentSize: 7,
        numberOfElement: 0,
        createdAt: '',
        contentType: 'file'
      });
      assert.strictEqual((await readMetadata(folder, 'f2')).contentType, 'record-list');
      assert.strictEqual(await fs.readFile(path.join(folder, 'content', 'f1'), 'utf-8'), 'a;b\n1;2');
    }
    assert.strictEqual((console.info as unknown as ReturnType<typeof mock.fn>).mock.callCount(), 1);
  });

  it('should ignore other folders, folders without metadata and unreadable metadata', async () => {
    await writeCacheFile(path.join(tmpRoot, 'cache', 'south-s1'), 'f1', 'any');
    await fs.mkdir(path.join(tmpRoot, 'cache', 'north-n2'), { recursive: true });
    await fs.mkdir(path.join(tmpRoot, 'cache', 'north-n3', 'metadata'), { recursive: true });
    await fs.writeFile(path.join(tmpRoot, 'cache', 'north-n3', 'metadata', 'broken'), 'not json');

    await migration.up({} as Knex);

    assert.strictEqual((await readMetadata(path.join(tmpRoot, 'cache', 'south-s1'), 'f1')).contentType, 'any');
    assert.strictEqual((console.error as unknown as ReturnType<typeof mock.fn>).mock.callCount(), 1);
  });

  it('should do nothing without data folders, nor when going down', async () => {
    await migration.up({} as Knex);
    await migration.down();
  });
});
