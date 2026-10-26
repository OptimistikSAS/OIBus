import assert from 'node:assert/strict';
import path from 'node:path';
import { after, afterEach, before, beforeEach, describe, it } from 'node:test';

import { Knex } from 'knex';

import { buildSchemaBefore, createMigrationSchemaHarness } from '../../../../tests/utils/migration-test-utils';
import { down, up } from './v3.10.0_7';

const ENTITY_MIGRATIONS_ROOT = path.resolve(__dirname, '..', '..');

describe('Entity migration v3.10.0_7', () => {
  const harness = createMigrationSchemaHarness({
    buildSchema: db => buildSchemaBefore(ENTITY_MIGRATIONS_ROOT, 'v3.10.0_7.ts', db)
  });
  let db: Knex;

  before(() => harness.before());
  after(() => harness.after());

  beforeEach(async () => {
    await harness.beforeEach();
    db = harness.getDb();
    await db('transformers').del();
    await db('transformers').insert([
      { id: 'file', type: 'standard', function_name: 'file', input_type: 'any', output_type: 'any' },
      { id: 'json', type: 'standard', function_name: 'record-list-to-json', input_type: 'record-list', output_type: 'any' },
      { id: 'csv', type: 'standard', function_name: 'csv-to-record-list', input_type: 'any', output_type: 'record-list' },
      { id: 'custom', type: 'custom', name: 'Custom', input_type: 'any', output_type: 'oianalytics' }
    ]);
  });

  afterEach(() => harness.afterEach());

  it('should rename the any data type of the transformers file', async () => {
    await up(db);

    assert.deepStrictEqual(await db('transformers').select('id', 'input_type', 'output_type').orderBy('id'), [
      { id: 'csv', input_type: 'file', output_type: 'record-list' },
      { id: 'custom', input_type: 'file', output_type: 'oianalytics' },
      { id: 'file', input_type: 'file', output_type: 'file' },
      { id: 'json', input_type: 'record-list', output_type: 'file' }
    ]);
  });

  it('should not revert', async () => {
    await down();
  });
});
