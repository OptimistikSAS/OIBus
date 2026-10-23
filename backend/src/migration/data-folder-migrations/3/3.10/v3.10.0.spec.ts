import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { after, before, beforeEach, describe, it, mock } from 'node:test';

import type { Knex } from 'knex';

import { mockModule, reloadModule } from '../../../../tests/utils/test-utils';

const nodeRequire = createRequire(import.meta.url);

type MigrationModule = typeof import('./v3.10.0');

describe('Data folder migration v3.10.0 (cached time-values to record lists)', () => {
  let tmpRoot: string;
  let migration: MigrationModule;

  const timeValues = [
    { pointId: 'p1', timestamp: '2024-01-01T00:00:00.000Z', data: { value: 1, quality: 'Good' } },
    { pointId: 'p2', timestamp: '2024-01-01T00:00:01.000Z', data: { value: '2' } }
  ];
  const records = [
    { pointId: 'p1', timestamp: '2024-01-01T00:00:00.000Z', value: 1, quality: 'Good' },
    { pointId: 'p2', timestamp: '2024-01-01T00:00:01.000Z', value: '2' }
  ];

  before(async () => {
    tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'oibus-mig-v3100-'));
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
    migration = reloadModule<MigrationModule>(nodeRequire, './v3.10.0');
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

  const writeCacheFile = async (folder: string, filename: string, contentType: string, content: unknown) => {
    await fs.mkdir(path.join(folder, 'metadata'), { recursive: true });
    await fs.mkdir(path.join(folder, 'content'), { recursive: true });
    const text = JSON.stringify(content);
    await fs.writeFile(path.join(folder, 'content', filename), text);
    await fs.writeFile(
      path.join(folder, 'metadata', filename),
      JSON.stringify({ contentFile: `${filename}.json`, contentSize: text.length, numberOfElement: 2, createdAt: '', contentType })
    );
  };
  const readCacheFile = async (folder: string, filename: string) => ({
    content: JSON.parse(await fs.readFile(path.join(folder, 'content', filename), 'utf-8')),
    metadata: JSON.parse(await fs.readFile(path.join(folder, 'metadata', filename), 'utf-8'))
  });

  it('should convert the cached time values of norths and history queries into record lists', async () => {
    const folders = [
      path.join(tmpRoot, 'cache', 'north-n1'),
      path.join(tmpRoot, 'error', 'north-n1'),
      path.join(tmpRoot, 'archive', 'history-h1', 'north')
    ];
    for (const folder of folders) {
      await writeCacheFile(folder, 'file1', 'time-values', timeValues);
    }

    await migration.up({} as Knex);

    for (const folder of folders) {
      const { content, metadata } = await readCacheFile(folder, 'file1');
      assert.deepStrictEqual(content, records);
      assert.strictEqual(metadata.contentType, 'record-list');
      assert.strictEqual(metadata.contentSize, Buffer.byteLength(JSON.stringify(records)));
      assert.strictEqual(metadata.contentFile, 'file1.json');
    }
  });

  it('should turn the cached time values of OIAnalytics norths and history queries into oianalytics content', async () => {
    // The North connectors and history queries sending to OIAnalytics, as read from the configuration database
    const oiaIds: Record<string, Array<{ id: string }>> = { north_connectors: [{ id: 'oia' }], history_queries: [{ id: 'h1' }] };
    const knex = ((table: string) => ({ select: () => ({ where: async () => oiaIds[table] }) })) as unknown as Knex;
    const oiaFolders = [path.join(tmpRoot, 'cache', 'north-oia'), path.join(tmpRoot, 'archive', 'history-h1', 'north')];
    for (const folder of oiaFolders) {
      await writeCacheFile(folder, 'file1', 'time-values', timeValues);
    }
    await writeCacheFile(path.join(tmpRoot, 'cache', 'north-n1'), 'file1', 'time-values', timeValues);

    await migration.up(knex);

    for (const folder of oiaFolders) {
      const { content, metadata } = await readCacheFile(folder, 'file1');
      assert.deepStrictEqual(content, timeValues);
      assert.strictEqual(metadata.contentType, 'oianalytics');
    }
    assert.deepStrictEqual((await readCacheFile(path.join(tmpRoot, 'cache', 'north-n1'), 'file1')).content, records);
  });

  it('should leave the other content types and folders untouched', async () => {
    const north = path.join(tmpRoot, 'cache', 'north-n1');
    await writeCacheFile(north, 'file1', 'any', timeValues);
    await writeCacheFile(path.join(tmpRoot, 'cache', 'south-s1'), 'file1', 'time-values', timeValues);
    await fs.mkdir(path.join(tmpRoot, 'cache', 'north-empty'), { recursive: true });

    await migration.up({} as Knex);

    assert.deepStrictEqual((await readCacheFile(north, 'file1')).content, timeValues);
    assert.deepStrictEqual((await readCacheFile(path.join(tmpRoot, 'cache', 'south-s1'), 'file1')).content, timeValues);
  });

  it('should log a file it cannot convert and go on', async () => {
    const north = path.join(tmpRoot, 'cache', 'north-n1');
    await writeCacheFile(north, 'file1', 'time-values', timeValues);
    await fs.writeFile(path.join(north, 'metadata', 'file0'), 'not json');

    await migration.up({} as Knex);

    assert.deepStrictEqual((await readCacheFile(north, 'file1')).content, records);
  });

  it('should do nothing without data folders', async () => {
    await assert.doesNotReject(migration.up({} as Knex));
    await assert.doesNotReject(migration.down());
  });
});
