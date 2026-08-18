import { describe, it, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { Knex } from 'knex';
import { createMigrationSchemaHarness, buildSchemaBefore } from '../../../../tests/utils/migration-test-utils';
import { down, up } from './v3.9.0_2';

const ENTITY_MIGRATIONS_ROOT = path.resolve(__dirname, '..', '..');

describe('Entity migration v3.9.0_2', () => {
  const harness = createMigrationSchemaHarness({
    buildSchema: db => buildSchemaBefore(ENTITY_MIGRATIONS_ROOT, 'v3.9.0_2.ts', db)
  });
  let db: Knex;

  before(() => harness.before());
  after(() => harness.after());

  beforeEach(async () => {
    await harness.beforeEach();
    db = harness.getDb();
  });
  afterEach(() => harness.afterEach());

  async function insertSouthConnector(type: string, settings: object, id = 'south-1') {
    await db('south_connectors').insert({
      id,
      name: `Test ${type}`,
      type,
      description: '',
      enabled: 1,
      settings: JSON.stringify(settings),
      created_by: 'admin',
      updated_by: 'admin',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z'
    });
  }

  describe('up', () => {
    it('backfills retryInterval to 10000 on an ftp south connector', async () => {
      await insertSouthConnector('ftp', { host: 'localhost', port: 21 });

      await up(db);

      const row = await db('south_connectors').where('id', 'south-1').first();
      const settings = JSON.parse(row.settings);
      assert.strictEqual(settings.retryInterval, 10000);
      assert.strictEqual(settings.host, 'localhost', 'existing settings are preserved');
    });

    it('backfills retryInterval to 10000 on an sftp south connector', async () => {
      await insertSouthConnector('sftp', { host: 'localhost', port: 22 });

      await up(db);

      const row = await db('south_connectors').where('id', 'south-1').first();
      const settings = JSON.parse(row.settings);
      assert.strictEqual(settings.retryInterval, 10000);
      assert.strictEqual(settings.host, 'localhost', 'existing settings are preserved');
    });

    it('does not touch south connectors of a different type', async () => {
      await insertSouthConnector('mssql', { host: 'localhost' });

      await up(db);

      const row = await db('south_connectors').where('id', 'south-1').first();
      const settings = JSON.parse(row.settings);
      assert.strictEqual(settings.retryInterval, undefined);
      assert.strictEqual(settings.host, 'localhost');
    });

    it('does not override an already-set retryInterval', async () => {
      await insertSouthConnector('ftp', { host: 'localhost', retryInterval: 5000 });

      await up(db);

      const row = await db('south_connectors').where('id', 'south-1').first();
      const settings = JSON.parse(row.settings);
      assert.strictEqual(settings.retryInterval, 5000);
    });
  });

  describe('down', () => {
    it('removes retryInterval from ftp and sftp south connectors', async () => {
      await insertSouthConnector('ftp', { host: 'localhost' }, 'south-1');
      await insertSouthConnector('sftp', { host: 'localhost' }, 'south-2');

      await up(db);
      await down(db);

      const ftpRow = await db('south_connectors').where('id', 'south-1').first();
      assert.strictEqual(JSON.parse(ftpRow.settings).retryInterval, undefined);
      const sftpRow = await db('south_connectors').where('id', 'south-2').first();
      assert.strictEqual(JSON.parse(sftpRow.settings).retryInterval, undefined);
    });
  });

  it('is reversible: up → down → up backfills retryInterval again', async () => {
    await insertSouthConnector('ftp', { host: 'localhost' });

    await up(db);
    await down(db);
    await up(db);

    const row = await db('south_connectors').where('id', 'south-1').first();
    assert.strictEqual(JSON.parse(row.settings).retryInterval, 10000);
  });
});
