import assert from 'node:assert/strict';
import path from 'node:path';
import { after, afterEach, before, beforeEach, describe, it } from 'node:test';

import { Knex } from 'knex';

import { buildSchemaBefore, createMigrationSchemaHarness } from '../../../../tests/utils/migration-test-utils';
import { down, up } from './v3.9.5';

const ENTITY_MIGRATIONS_ROOT = path.resolve(__dirname, '..', '..');

describe('Entity migration v3.9.5', () => {
  const harness = createMigrationSchemaHarness({
    buildSchema: db => buildSchemaBefore(ENTITY_MIGRATIONS_ROOT, 'v3.9.5.ts', db)
  });
  let db: Knex;

  before(() => harness.before());
  after(() => harness.after());

  beforeEach(async () => {
    await harness.beforeEach();
    db = harness.getDb();
  });
  afterEach(() => harness.afterEach());

  async function insertCommand(id: string, type: string, status: string) {
    await db('commands').insert({
      id,
      type,
      status,
      ack: 1,
      target_version: '',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z'
    });
  }

  describe('up', () => {
    it('removes legacy update-engine-settings commands whatever their status', async () => {
      await insertCommand('command-1', 'update-engine-settings', 'COMPLETED');
      await insertCommand('command-2', 'update-engine-settings', 'RETRIEVED');

      await up(db);

      assert.deepStrictEqual(await db('commands').whereIn('id', ['command-1', 'command-2']), []);
    });

    it('keeps commands of other types', async () => {
      await insertCommand('command-1', 'update-engine-settings', 'COMPLETED');
      await insertCommand('command-2', 'update-engine-general', 'COMPLETED');
      await insertCommand('command-3', 'restart-engine', 'ERRORED');

      await up(db);

      const ids = (await db('commands').select('id').orderBy('id')).map(row => row.id);
      assert.deepStrictEqual(ids, ['command-2', 'command-3']);
    });
  });

  describe('down', () => {
    it('is a no-op that resolves without throwing', async () => {
      await assert.doesNotReject(down(db));
    });
  });
});
