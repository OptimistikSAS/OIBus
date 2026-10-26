import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { after, before, beforeEach, describe, it, mock } from 'node:test';

import type { Knex } from 'knex';

import { mockModule, reloadModule } from '../../../../tests/utils/test-utils';

const nodeRequire = createRequire(import.meta.url);

type MigrationModule = typeof import('./v3.10.0_2');

describe('Data folder migration v3.10.0_2 (cached records and setpoints of the File Writers become files)', () => {
  let tmpRoot: string;
  let migration: MigrationModule;

  before(async () => {
    tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'oibus-mig-v3100_2-'));
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
    migration = reloadModule<MigrationModule>(nodeRequire, './v3.10.0_2');
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

  // The File Writer North connectors and history queries, as read from the configuration database
  const fileWriterIds: Record<string, Array<{ id: string }>> = { north_connectors: [{ id: 'writer' }], history_queries: [{ id: 'h1' }] };
  const knex = ((table: string) => ({ select: () => ({ where: async () => fileWriterIds[table] }) })) as unknown as Knex;

  it('should turn the cached records and setpoints of the File Writers into files', async () => {
    const folders = [
      path.join(tmpRoot, 'cache', 'north-writer'),
      path.join(tmpRoot, 'error', 'north-writer'),
      path.join(tmpRoot, 'archive', 'history-h1', 'north')
    ];
    for (const folder of folders) {
      await writeCacheFile(folder, 'f1', 'record-list');
      await writeCacheFile(folder, 'f2', 'setpoint');
      await writeCacheFile(folder, 'f3', 'file');
    }
    await writeCacheFile(path.join(tmpRoot, 'cache', 'north-console'), 'f1', 'record-list');

    await migration.up(knex);

    for (const folder of folders) {
      assert.deepStrictEqual(await readMetadata(folder, 'f1'), {
        contentFile: 'file.csv',
        contentSize: 7,
        numberOfElement: 0,
        createdAt: '',
        contentType: 'file'
      });
      assert.strictEqual((await readMetadata(folder, 'f2')).contentType, 'file');
      assert.strictEqual((await readMetadata(folder, 'f3')).contentType, 'file');
    }
    assert.strictEqual((await readMetadata(path.join(tmpRoot, 'cache', 'north-console'), 'f1')).contentType, 'record-list');
    assert.strictEqual((console.info as unknown as ReturnType<typeof mock.fn>).mock.callCount(), 1);
  });

  it('should ignore folders without metadata, and log unreadable metadata', async () => {
    await fs.mkdir(path.join(tmpRoot, 'cache', 'north-writer'), { recursive: true });
    await fs.mkdir(path.join(tmpRoot, 'cache', 'history-h1', 'north', 'metadata'), { recursive: true });
    await fs.writeFile(path.join(tmpRoot, 'cache', 'history-h1', 'north', 'metadata', 'broken'), 'not json');

    await migration.up(knex);

    assert.strictEqual((console.error as unknown as ReturnType<typeof mock.fn>).mock.callCount(), 1);
  });

  it('should do nothing without data folders nor database tables, nor when going down', async () => {
    const failingKnex = (() => ({ select: () => ({ where: async () => Promise.reject(new Error('no table')) }) })) as unknown as Knex;
    await writeCacheFile(path.join(tmpRoot, 'cache', 'north-writer'), 'f1', 'record-list');

    await migration.up(failingKnex);
    await migration.down();

    assert.strictEqual((await readMetadata(path.join(tmpRoot, 'cache', 'north-writer'), 'f1')).contentType, 'record-list');
  });
});
