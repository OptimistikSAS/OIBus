import { describe, it, before, after, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import type { Knex } from 'knex';
import { mockModule, reloadModule } from '../../../../tests/utils/test-utils';

const nodeRequire = createRequire(import.meta.url);

type MigrationModule = typeof import('./v3.8.0_1');

describe('Data folder migration v3.8.0_1 (drop legacy opcua/ subfolders)', () => {
  let tmpRoot: string;
  let migration: MigrationModule;

  before(async () => {
    tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'oibus-mig-v381-'));

    // Override getCommandLineArguments so the migration's path constants resolve under tmpRoot.
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
    migration = reloadModule<MigrationModule>(nodeRequire, './v3.8.0_1');

    mock.method(console, 'info', () => undefined);
    mock.method(console, 'error', () => undefined);
  });

  after(async () => {
    mock.restoreAll();
    await fs.rm(tmpRoot, { recursive: true, force: true });
  });

  beforeEach(async () => {
    const cacheRoot = path.join(tmpRoot, 'cache');
    await fs.rm(cacheRoot, { recursive: true, force: true });
    await fs.mkdir(cacheRoot, { recursive: true });
  });

  async function makeOpcuaTree(root: string): Promise<void> {
    // Mirror what the old initOPCUACertificateFolders used to create.
    await fs.mkdir(path.join(root, 'own', 'certs'), { recursive: true });
    await fs.mkdir(path.join(root, 'own', 'private'), { recursive: true });
    await fs.mkdir(path.join(root, 'rejected'), { recursive: true });
    await fs.mkdir(path.join(root, 'trusted', 'certs'), { recursive: true });
    await fs.mkdir(path.join(root, 'trusted', 'crl'), { recursive: true });
    await fs.mkdir(path.join(root, 'issuers', 'certs'), { recursive: true });
    await fs.mkdir(path.join(root, 'issuers', 'crl'), { recursive: true });
    await fs.writeFile(path.join(root, 'own', 'private', 'private_key.pem'), 'fake-key');
    await fs.writeFile(path.join(root, 'own', 'certs', 'client_certificate.pem'), 'fake-cert');
  }

  it('removes cache/north-*/opcua/ trees', async () => {
    const northCacheRoot = path.join(tmpRoot, 'cache', 'north-OPCUA1');
    await fs.mkdir(path.join(northCacheRoot, 'content'), { recursive: true });
    await fs.mkdir(path.join(northCacheRoot, 'metadata'), { recursive: true });
    await makeOpcuaTree(path.join(northCacheRoot, 'opcua'));

    await migration.up({} as Knex);

    assert.strictEqual(fsSync.existsSync(path.join(northCacheRoot, 'opcua')), false);
    // Other cache subfolders are untouched.
    assert.strictEqual(fsSync.existsSync(path.join(northCacheRoot, 'content')), true);
    assert.strictEqual(fsSync.existsSync(path.join(northCacheRoot, 'metadata')), true);
  });

  it('removes cache/history-*/north/opcua/ trees', async () => {
    const historyNorthRoot = path.join(tmpRoot, 'cache', 'history-Q1', 'north');
    await fs.mkdir(path.join(historyNorthRoot, 'content'), { recursive: true });
    await makeOpcuaTree(path.join(historyNorthRoot, 'opcua'));

    await migration.up({} as Knex);

    assert.strictEqual(fsSync.existsSync(path.join(historyNorthRoot, 'opcua')), false);
    assert.strictEqual(fsSync.existsSync(path.join(historyNorthRoot, 'content')), true);
  });

  it('leaves untouched any cache folder that has no opcua/ subfolder', async () => {
    const northCacheRoot = path.join(tmpRoot, 'cache', 'north-MQTT1');
    await fs.mkdir(path.join(northCacheRoot, 'content'), { recursive: true });
    await fs.mkdir(path.join(northCacheRoot, 'metadata'), { recursive: true });

    await migration.up({} as Knex);

    assert.strictEqual(fsSync.existsSync(path.join(northCacheRoot, 'content')), true);
    assert.strictEqual(fsSync.existsSync(path.join(northCacheRoot, 'metadata')), true);
  });

  it('is idempotent — running twice is a no-op the second time', async () => {
    const northCacheRoot = path.join(tmpRoot, 'cache', 'north-OPCUA1');
    await fs.mkdir(path.join(northCacheRoot, 'content'), { recursive: true });
    await makeOpcuaTree(path.join(northCacheRoot, 'opcua'));

    await migration.up({} as Knex);
    await migration.up({} as Knex);

    assert.strictEqual(fsSync.existsSync(path.join(northCacheRoot, 'opcua')), false);
    assert.strictEqual(fsSync.existsSync(path.join(northCacheRoot, 'content')), true);
  });

  it('does not fail if the cache folder itself is missing', async () => {
    await fs.rm(path.join(tmpRoot, 'cache'), { recursive: true, force: true });
    await migration.up({} as Knex);
    // No assertion needed — the test passes if no exception was thrown.
  });

  it('down() is a no-op (migration is not reversible)', async () => {
    const result = await migration.down();
    assert.strictEqual(result, undefined);
  });
});
