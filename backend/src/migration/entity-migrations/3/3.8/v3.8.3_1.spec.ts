import { describe, it, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import knex, { Knex } from 'knex';
import { buildSchemaBefore } from '../../../../tests/utils/migration-test-utils';
import { up, down } from './v3.8.3_1';

const ENTITY_MIGRATIONS_ROOT = path.resolve(__dirname, '..', '..');

/**
 * Kept on a bare (non-transactional) connection rather than the shared savepoint-based harness:
 * tests below repeatedly toggle `PRAGMA foreign_keys = OFF`/`= ON` mid-test and rely on it actually
 * taking effect, which SQLite turns into a no-op once any transaction (including a savepoint) is
 * active.
 */
async function buildPreV3831Schema(db: Knex): Promise<void> {
  await buildSchemaBefore(ENTITY_MIGRATIONS_ROOT, 'v3.8.3_1.ts', db);
}

describe('Entity migration v3.8.3_1', () => {
  let db: Knex;

  after(async () => {
    await db?.destroy();
  });

  beforeEach(async () => {
    await db?.destroy();
    db = knex({ client: 'better-sqlite3', connection: { filename: ':memory:' }, useNullAsDefault: true });
    await buildPreV3831Schema(db);
  });

  describe('up — time-values-to-oianalytics', () => {
    it('sets precision=ms when options is null', async () => {
      // Find the standard transformer id for time-values-to-oianalytics
      const transformer = await db('transformers').where('function_name', 'time-values-to-oianalytics').first();
      assert.ok(transformer, 'time-values-to-oianalytics transformer must exist after prior migrations');

      // Simulate a migrated-from-v3.7 entry: options is null
      await db.raw('PRAGMA foreign_keys = OFF');
      const ntId = 'nt-oia-test';
      await db('north_transformers').insert({
        id: ntId,
        north_id: 'north-dummy',
        transformer_id: transformer.id,
        options: null,
        source_type: 'south',
        source_south_south_id: null,
        source_south_group_id: null,
        source_api_data_source_id: null
      });
      await db.raw('PRAGMA foreign_keys = ON');

      await up(db);

      const row = await db('north_transformers').where('id', ntId).first();
      const options = JSON.parse(row.options);
      assert.equal(options.precision, 'ms');
    });

    it('does not overwrite existing non-null options', async () => {
      const transformer = await db('transformers').where('function_name', 'time-values-to-oianalytics').first();
      assert.ok(transformer);

      const existingOptions = JSON.stringify({ precision: 's' });
      await db.raw('PRAGMA foreign_keys = OFF');
      const ntId = 'nt-oia-existing';
      await db('north_transformers').insert({
        id: ntId,
        north_id: 'north-dummy',
        transformer_id: transformer.id,
        options: existingOptions,
        source_type: 'south',
        source_south_south_id: null,
        source_south_group_id: null,
        source_api_data_source_id: null
      });
      await db.raw('PRAGMA foreign_keys = ON');

      await up(db);

      const row = await db('north_transformers').where('id', ntId).first();
      assert.equal(row.options, existingOptions);
    });

    it('fixes oianalytics in history_query_transformers too', async () => {
      const transformer = await db('transformers').where('function_name', 'time-values-to-oianalytics').first();
      assert.ok(transformer);

      await db.raw('PRAGMA foreign_keys = OFF');
      const hqtId = 'hqt-oia-test';
      await db('history_query_transformers').insert({
        id: hqtId,
        history_id: 'hist-dummy',
        transformer_id: transformer.id,
        options: null
      });
      await db.raw('PRAGMA foreign_keys = ON');

      await up(db);

      const row = await db('history_query_transformers').where('id', hqtId).first();
      const options = JSON.parse(row.options);
      assert.equal(options.precision, 'ms');
    });
  });

  describe('up — time-values-to-csv with null options', () => {
    it('applies CSV defaults when options is null', async () => {
      const transformer = await db('transformers').where('function_name', 'time-values-to-csv').first();
      assert.ok(transformer, 'time-values-to-csv transformer must exist after prior migrations');

      await db.raw('PRAGMA foreign_keys = OFF');
      const ntId = 'nt-csv-test';
      await db('north_transformers').insert({
        id: ntId,
        north_id: 'north-dummy',
        transformer_id: transformer.id,
        options: null,
        source_type: 'south',
        source_south_south_id: null,
        source_south_group_id: null,
        source_api_data_source_id: null
      });
      await db.raw('PRAGMA foreign_keys = ON');

      await up(db);

      const row = await db('north_transformers').where('id', ntId).first();
      const options = JSON.parse(row.options);
      assert.equal(options.encoding, 'UTF_8');
      assert.equal(options.quoteChar, 'DOUBLE_QUOTE');
      assert.equal(options.header, true);
      assert.equal(options.pointIdProcess, null);
    });
  });

  describe('up — json-to-csv with null options', () => {
    it('applies CSV defaults when options is null', async () => {
      const transformer = await db('transformers').where('function_name', 'json-to-csv').first();
      assert.ok(transformer, 'json-to-csv transformer must exist after prior migrations');

      await db.raw('PRAGMA foreign_keys = OFF');
      const ntId = 'nt-j2c-test';
      await db('north_transformers').insert({
        id: ntId,
        north_id: 'north-dummy',
        transformer_id: transformer.id,
        options: null,
        source_type: 'south',
        source_south_south_id: null,
        source_south_group_id: null,
        source_api_data_source_id: null
      });
      await db.raw('PRAGMA foreign_keys = ON');

      await up(db);

      const row = await db('north_transformers').where('id', ntId).first();
      const options = JSON.parse(row.options);
      assert.equal(options.encoding, 'UTF_8');
      assert.equal(options.quoteChar, 'DOUBLE_QUOTE');
      assert.equal(options.header, true);
      assert.deepEqual(options.fields, []);
    });
  });

  describe('up — remaining null options (iso / no-option transformers)', () => {
    it('sets empty options object for the iso transformer left null by v3.8.0', async () => {
      const transformer = await db('transformers').where('function_name', 'iso').first();
      assert.ok(transformer, 'iso transformer must exist after prior migrations');

      await db.raw('PRAGMA foreign_keys = OFF');
      const ntId = 'nt-iso-test';
      await db('north_transformers').insert({
        id: ntId,
        north_id: 'north-dummy',
        transformer_id: transformer.id,
        options: null,
        source_type: 'south',
        source_south_south_id: null,
        source_south_group_id: null,
        source_api_data_source_id: null
      });
      await db.raw('PRAGMA foreign_keys = ON');

      await up(db);

      const row = await db('north_transformers').where('id', ntId).first();
      assert.equal(row.options, '{}');
      assert.deepEqual(JSON.parse(row.options), {});
    });

    it('fixes iso null options in history_query_transformers too', async () => {
      const transformer = await db('transformers').where('function_name', 'iso').first();
      assert.ok(transformer);

      await db.raw('PRAGMA foreign_keys = OFF');
      const hqtId = 'hqt-iso-test';
      await db('history_query_transformers').insert({
        id: hqtId,
        history_id: 'hist-dummy',
        transformer_id: transformer.id,
        options: null
      });
      await db.raw('PRAGMA foreign_keys = ON');

      await up(db);

      const row = await db('history_query_transformers').where('id', hqtId).first();
      assert.equal(row.options, '{}');
    });

    it('does not overwrite transformer-specific defaults applied earlier', async () => {
      const oia = await db('transformers').where('function_name', 'time-values-to-oianalytics').first();
      assert.ok(oia);

      await db.raw('PRAGMA foreign_keys = OFF');
      const ntId = 'nt-oia-not-empty';
      await db('north_transformers').insert({
        id: ntId,
        north_id: 'north-dummy',
        transformer_id: oia.id,
        options: null,
        source_type: 'south',
        source_south_south_id: null,
        source_south_group_id: null,
        source_api_data_source_id: null
      });
      await db.raw('PRAGMA foreign_keys = ON');

      await up(db);

      const row = await db('north_transformers').where('id', ntId).first();
      assert.equal(JSON.parse(row.options).precision, 'ms');
    });
  });

  it('is a no-op when no null-options transformer instances exist', async () => {
    // Should not throw when nothing needs fixing
    await assert.doesNotReject(() => up(db));
  });

  it('is a no-op when the time-values-to-oianalytics transformer does not exist at all', async () => {
    // Simulate an install whose standard transformers table never had this transformer registered
    // (e.g. a stripped-down deployment): fixOIAnalyticsTransformerOptions must bail out early
    // instead of throwing when transformer_id lookup finds nothing.
    await db('transformers').where('function_name', 'time-values-to-oianalytics').del();

    await assert.doesNotReject(() => up(db));

    const transformer = await db('transformers').where('function_name', 'time-values-to-oianalytics').first();
    assert.equal(transformer, undefined);
  });

  it('is a no-op when neither csv transformer (json-to-csv, time-values-to-csv) exists', async () => {
    // fixCsvTransformerOptions must bail out early when the whereIn lookup returns no rows.
    await db('transformers').whereIn('function_name', ['json-to-csv', 'time-values-to-csv']).del();

    await assert.doesNotReject(() => up(db));
  });

  it('down is a no-op', async () => {
    await assert.doesNotReject(() => down(db));
  });
});
