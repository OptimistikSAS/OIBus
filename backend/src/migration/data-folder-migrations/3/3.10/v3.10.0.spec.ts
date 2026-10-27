import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { after, afterEach, before, beforeEach, describe, it, mock } from 'node:test';

import type { Knex } from 'knex';

import { mockModule, reloadModule } from '../../../../tests/utils/test-utils';

const nodeRequire = createRequire(import.meta.url);

type MigrationModule = typeof import('./v3.10.0');

describe('Data folder migration v3.10.0', () => {
  let tmpRoot: string;
  let migration: MigrationModule;
  let info: ReturnType<typeof mock.method>;
  let error: ReturnType<typeof mock.method>;

  const timeValues = [
    { pointId: 'p1', timestamp: '2024-01-01T00:00:00.000Z', data: { value: 1, quality: 'Good' } },
    { pointId: 'p2', timestamp: '2024-01-01T00:00:01.000Z', data: { value: '2' } }
  ];
  const records = [
    { pointId: 'p1', timestamp: '2024-01-01T00:00:00.000Z', value: 1, quality: 'Good' },
    { pointId: 'p2', timestamp: '2024-01-01T00:00:01.000Z', value: '2' }
  ];
  const setpoints = [{ reference: 'sp1', value: 1 }];

  // The North connectors and history queries, as read from the configuration database
  const northTypes: Record<string, Array<{ id: string; type: string; name?: string; settings?: string }>> = {
    north_connectors: [
      { id: 'console', type: 'console' },
      { id: 'oia', type: 'oianalytics' },
      { id: 'writer', type: 'file-writer' },
      {
        id: 'prefixed',
        type: 'file-writer',
        name: 'Writer',
        settings: JSON.stringify({ prefix: '@ConnectorName-', suffix: '-@CurrentDate' })
      },
      { id: 'mqtt', type: 'mqtt', name: 'MQTT', settings: JSON.stringify({ prefix: 'not-a-prefix' }) }
    ],
    history_queries: [
      { id: 'h1', type: 'console' },
      { id: 'h2', type: 'oianalytics' },
      { id: 'h3', type: 'file-writer' },
      { id: 'h4', type: 'sftp', name: 'History', settings: JSON.stringify({ prefix: 'pre_', suffix: null }) }
    ]
  };
  const knex = ((table: string) => ({ select: async () => northTypes[table] })) as unknown as Knex;

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
  });

  after(async () => {
    await fs.rm(tmpRoot, { recursive: true, force: true });
  });

  beforeEach(async () => {
    info = mock.method(console, 'info', () => undefined);
    error = mock.method(console, 'error', () => undefined);
    for (const root of ['cache', 'error', 'archive']) {
      await fs.rm(path.join(tmpRoot, root), { recursive: true, force: true });
    }
  });

  afterEach(() => {
    info.mock.restore();
    error.mock.restore();
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
  const contentTypeOf = async (folder: string, filename: string) => (await readCacheFile(folder, filename)).metadata.contentType;

  it('should convert the cached time values of norths and history queries into record lists', async () => {
    const folders = [
      path.join(tmpRoot, 'cache', 'north-console'),
      path.join(tmpRoot, 'error', 'north-console'),
      path.join(tmpRoot, 'archive', 'history-h1', 'north'),
      // a North deleted since: its type is unknown
      path.join(tmpRoot, 'cache', 'north-deleted')
    ];
    for (const folder of folders) {
      await writeCacheFile(folder, 'file1', 'time-values', timeValues);
    }

    await migration.up(knex);

    for (const folder of folders) {
      const { content, metadata } = await readCacheFile(folder, 'file1');
      assert.deepStrictEqual(content, records);
      assert.deepStrictEqual(metadata, {
        contentFile: 'file1.json',
        contentSize: Buffer.byteLength(JSON.stringify(records)),
        numberOfElement: 2,
        createdAt: '',
        contentType: 'record-list'
      });
    }
    assert.strictEqual(info.mock.callCount(), 1);
  });

  it('should turn the cached time values of OIAnalytics norths and history queries into oianalytics content', async () => {
    const folders = [path.join(tmpRoot, 'cache', 'north-oia'), path.join(tmpRoot, 'archive', 'history-h2', 'north')];
    for (const folder of folders) {
      await writeCacheFile(folder, 'file1', 'time-values', timeValues);
    }

    await migration.up(knex);

    for (const folder of folders) {
      const { content, metadata } = await readCacheFile(folder, 'file1');
      assert.deepStrictEqual(content, timeValues);
      assert.strictEqual(metadata.contentType, 'oianalytics');
    }
  });

  it('should rename the any content type file, keeping the content', async () => {
    const folders = [path.join(tmpRoot, 'cache', 'north-console'), path.join(tmpRoot, 'archive', 'history-h1', 'north')];
    for (const folder of folders) {
      await writeCacheFile(folder, 'file1', 'any', timeValues);
    }

    await migration.up(knex);

    for (const folder of folders) {
      const { content, metadata } = await readCacheFile(folder, 'file1');
      assert.deepStrictEqual(content, timeValues);
      assert.strictEqual(metadata.contentType, 'file');
    }
  });

  it('should turn the cached setpoints into record lists, keeping their content', async () => {
    const folders = [path.join(tmpRoot, 'cache', 'north-console'), path.join(tmpRoot, 'error', 'history-h1', 'north')];
    for (const folder of folders) {
      await writeCacheFile(folder, 'file1', 'setpoint', setpoints);
    }

    await migration.up(knex);

    for (const folder of folders) {
      const { content, metadata } = await readCacheFile(folder, 'file1');
      assert.deepStrictEqual(content, setpoints);
      assert.strictEqual(metadata.contentType, 'record-list');
    }
  });

  it('should turn the cached time values, records and setpoints of the File Writers into files', async () => {
    const folders = [path.join(tmpRoot, 'cache', 'north-writer'), path.join(tmpRoot, 'archive', 'history-h3', 'north')];
    for (const folder of folders) {
      await writeCacheFile(folder, 'file1', 'time-values', timeValues);
      await writeCacheFile(folder, 'file2', 'record-list', records);
      await writeCacheFile(folder, 'file3', 'setpoint', setpoints);
      await writeCacheFile(folder, 'file4', 'any', setpoints);
    }

    await migration.up(knex);

    for (const folder of folders) {
      assert.deepStrictEqual(await readCacheFile(folder, 'file1'), {
        content: records,
        metadata: {
          contentFile: 'file1.json',
          contentSize: Buffer.byteLength(JSON.stringify(records)),
          numberOfElement: 2,
          createdAt: '',
          contentType: 'file'
        }
      });
      assert.deepStrictEqual((await readCacheFile(folder, 'file2')).content, records);
      for (const filename of ['file2', 'file3', 'file4']) {
        assert.strictEqual(await contentTypeOf(folder, filename), 'file');
      }
    }
  });

  it('should rename the files cached by the File Writer and SFTP norths, adding their prefix and suffix', async () => {
    mock.timers.enable({ apis: ['Date'], now: new Date('2024-01-02T03:04:05.006Z') });
    const north = path.join(tmpRoot, 'cache', 'north-prefixed');
    const history = path.join(tmpRoot, 'error', 'history-h4', 'north');
    const other = path.join(tmpRoot, 'cache', 'north-mqtt');
    await writeCacheFile(north, 'file1', 'file', records);
    await writeCacheFile(history, 'file1', 'any', records);
    await writeCacheFile(other, 'file1', 'file', records);

    await migration.up(knex);
    mock.timers.reset();

    assert.deepStrictEqual((await readCacheFile(north, 'file1')).metadata, {
      contentFile: 'Writer-file1-2024_01_02_03_04_05_006.json',
      contentSize: JSON.stringify(records).length,
      numberOfElement: 2,
      createdAt: '',
      contentType: 'file'
    });
    const historyFile = await readCacheFile(history, 'file1');
    assert.deepStrictEqual([historyFile.metadata.contentFile, historyFile.metadata.contentType], ['pre_file1.json', 'file']);
    assert.strictEqual((await readCacheFile(other, 'file1')).metadata.contentFile, 'file1.json');
  });

  it('should leave the other content types and folders untouched', async () => {
    const north = path.join(tmpRoot, 'cache', 'north-console');
    await writeCacheFile(north, 'file1', 'record-list', records);
    await writeCacheFile(north, 'file2', 'file', records);
    await writeCacheFile(path.join(tmpRoot, 'cache', 'south-s1'), 'file1', 'time-values', timeValues);
    await fs.mkdir(path.join(tmpRoot, 'cache', 'north-empty'), { recursive: true });

    await migration.up(knex);

    assert.strictEqual(await contentTypeOf(north, 'file1'), 'record-list');
    assert.strictEqual(await contentTypeOf(north, 'file2'), 'file');
    assert.deepStrictEqual(await readCacheFile(path.join(tmpRoot, 'cache', 'south-s1'), 'file1'), {
      content: timeValues,
      metadata: {
        contentFile: 'file1.json',
        contentSize: JSON.stringify(timeValues).length,
        numberOfElement: 2,
        createdAt: '',
        contentType: 'time-values'
      }
    });
    assert.strictEqual(info.mock.callCount(), 0);
  });

  it('should log a file it cannot convert and go on', async () => {
    const north = path.join(tmpRoot, 'cache', 'north-console');
    await writeCacheFile(north, 'file1', 'time-values', timeValues);
    await fs.writeFile(path.join(north, 'metadata', 'file0'), 'not json');

    await migration.up(knex);

    assert.deepStrictEqual((await readCacheFile(north, 'file1')).content, records);
    assert.strictEqual(error.mock.callCount(), 1);
  });

  it('should convert the content without database tables', async () => {
    const failingKnex = (() => ({ select: async () => Promise.reject(new Error('no table')) })) as unknown as Knex;
    const north = path.join(tmpRoot, 'cache', 'north-writer');
    await writeCacheFile(north, 'file1', 'time-values', timeValues);
    await writeCacheFile(north, 'file2', 'setpoint', setpoints);

    await migration.up(failingKnex);

    assert.deepStrictEqual(await readCacheFile(north, 'file1'), {
      content: records,
      metadata: {
        contentFile: 'file1.json',
        contentSize: Buffer.byteLength(JSON.stringify(records)),
        numberOfElement: 2,
        createdAt: '',
        contentType: 'record-list'
      }
    });
    assert.strictEqual(await contentTypeOf(north, 'file2'), 'record-list');
  });

  it('should do nothing without data folders, nor when going down', async () => {
    await assert.doesNotReject(migration.up(knex));
    await assert.doesNotReject(migration.down());
    assert.strictEqual(info.mock.callCount(), 0);
  });
});
