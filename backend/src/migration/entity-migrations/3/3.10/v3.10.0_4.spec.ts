import { describe, it, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import knex, { Knex } from 'knex';
import { buildPreMigrationSchema } from '../../../../tests/utils/test-utils';
import { down, up } from './v3.10.0_4';

const NOW = '2024-01-01T00:00:00.000Z';

const OLD_OLEDB_SETTINGS = {
  agentUrl: 'http://ip-adress-or-host:2224',
  connectionTimeout: 15000,
  retryInterval: 10000,
  requestTimeout: 15000,
  connectionString: 'Provider=MSOLEDBSQL;Data Source=myServerAddress;',
  password: null
};

const OLD_OLEDB_ITEM_SETTINGS = {
  query: 'SELECT * FROM t1',
  dateTimeFields: [
    { fieldName: 'other', useAsReference: false, type: 'unix-epoch-ms', timezone: null, format: null, locale: null },
    {
      fieldName: 'timestamp',
      useAsReference: true,
      type: 'string',
      timezone: 'Europe/Paris',
      format: 'yyyy-MM-dd HH:mm:ss.SSS',
      locale: 'en-US'
    }
  ],
  serialization: {
    type: 'csv',
    filename: 'item1.csv',
    delimiter: 'COMMA',
    compression: true,
    outputTimestampFormat: 'yyyy-MM-dd HH:mm:ss.SSS',
    outputTimezone: 'Europe/Paris'
  }
};

const northConnectorDefaults = {
  type: 'file-writer',
  settings: JSON.stringify({}),
  caching_trigger_schedule: 'sm1',
  caching_trigger_number_of_elements: 1000,
  caching_trigger_number_of_files: 1,
  caching_throttling_cache_max_size: 0,
  caching_throttling_max_number_of_elements: 10_000,
  caching_error_retry_interval: 5000,
  caching_error_retry_count: 3,
  caching_archive_enabled: false,
  caching_archive_retention_duration: 0
};

describe('Entity migration v3.10.0_4', () => {
  let db: Knex;

  after(async () => {
    await db?.destroy();
  });

  beforeEach(async () => {
    await db?.destroy();
    db = knex({ client: 'better-sqlite3', connection: { filename: ':memory:' }, useNullAsDefault: true });
    await buildPreMigrationSchema(db, 'v3.10.0_4');
    await db('scan_modes').insert({ id: 'sm1', name: 'Every minute', description: '', cron: '0 * * * * *' });
  });

  it('runs end-to-end on a realistic pre-3.10.0_4 schema', async () => {
    await up(db); // must not throw
  });

  it('drops agentUrl from an oledb south connector, preserving other fields', async () => {
    await db('south_connectors').insert({
      id: 'oledb1',
      name: 'OLEDB 1',
      type: 'oledb',
      enabled: true,
      settings: JSON.stringify(OLD_OLEDB_SETTINGS)
    });

    await up(db);

    const row = await db('south_connectors').where('id', 'oledb1').first();
    assert.deepStrictEqual(JSON.parse(row.settings), {
      connectionTimeout: 15000,
      retryInterval: 10000,
      requestTimeout: 15000,
      connectionString: OLD_OLEDB_SETTINGS.connectionString,
      password: null
    });
  });

  it('drops agentUrl from a history query with an oledb south', async () => {
    await db('history_queries').insert({
      id: 'hq-oledb',
      name: 'HQ OLEDB',
      start_time: NOW,
      end_time: NOW,
      south_type: 'oledb',
      north_type: 'file-writer',
      south_settings: JSON.stringify(OLD_OLEDB_SETTINGS),
      north_settings: JSON.stringify({}),
      caching_trigger_schedule: 'sm1',
      caching_trigger_number_of_elements: 1000,
      caching_trigger_number_of_files: 1,
      caching_throttling_cache_max_size: 0,
      caching_throttling_max_number_of_elements: 10_000,
      caching_error_retry_interval: 5000,
      caching_error_retry_count: 3,
      caching_archive_enabled: false,
      caching_archive_retention_duration: 0
    });

    await up(db);

    const row = await db('history_queries').where('id', 'hq-oledb').first();
    assert.deepStrictEqual(JSON.parse(row.south_settings), {
      connectionTimeout: 15000,
      retryInterval: 10000,
      requestTimeout: 15000,
      connectionString: OLD_OLEDB_SETTINGS.connectionString,
      password: null
    });
  });

  it('does not touch settings of south connectors of other types', async () => {
    const oldSettings = { host: 'h', port: 1, database: 'd', connectionTimeout: 1000 };
    await db('south_connectors').insert({
      id: 'mysql1',
      name: 'MySQL 1',
      type: 'mysql',
      enabled: true,
      settings: JSON.stringify(oldSettings)
    });

    await up(db);

    const row = await db('south_connectors').where('id', 'mysql1').first();
    assert.deepStrictEqual(JSON.parse(row.settings), oldSettings);
  });

  describe('item settings and transformer attachment', () => {
    beforeEach(async () => {
      await db('south_connectors').insert({
        id: 'oledb1',
        name: 'OLEDB 1',
        type: 'oledb',
        enabled: true,
        settings: JSON.stringify(OLD_OLEDB_SETTINGS)
      });
      await db('south_items').insert([
        {
          id: 'item1',
          connector_id: 'oledb1',
          scan_mode_id: 'sm1',
          name: 'item1',
          enabled: true,
          settings: JSON.stringify(OLD_OLEDB_ITEM_SETTINGS)
        },
        {
          id: 'item2',
          connector_id: 'oledb1',
          scan_mode_id: 'sm1',
          name: 'item2',
          enabled: true,
          settings: JSON.stringify({
            query: 'SELECT * FROM t2',
            dateTimeFields: null,
            serialization: OLD_OLEDB_ITEM_SETTINGS.serialization
          })
        }
      ]);
      await db('north_connectors').insert([
        { ...northConnectorDefaults, id: 'north1', name: 'North 1 (nothing resolved)', enabled: true },
        { ...northConnectorDefaults, id: 'north2', name: 'North 2 (south-level iso)', enabled: true }
      ]);
      await db('transformers').insert([
        { id: 'iso-transformer', type: 'standard', function_name: 'iso', input_type: 'any', output_type: 'any' }
      ]);
      await db('north_transformers').insert({
        id: 'nt-south-level-iso',
        north_id: 'north2',
        transformer_id: 'iso-transformer',
        options: '{}',
        source_type: 'south',
        source_south_south_id: 'oledb1',
        source_south_group_id: null
      });
    });

    it('rewrites dateTimeFields+serialization into trackingInstant for every item', async () => {
      await up(db);

      const item1 = await db('south_items').where('id', 'item1').first();
      assert.deepStrictEqual(JSON.parse(item1.settings), {
        query: 'SELECT * FROM t1',
        trackingInstant: {
          trackInstant: true,
          fieldName: 'timestamp',
          dateTimeInput: { type: 'string', timezone: 'Europe/Paris', format: 'yyyy-MM-dd HH:mm:ss.SSS', locale: 'en-US' }
        }
      });

      const item2 = await db('south_items').where('id', 'item2').first();
      assert.deepStrictEqual(JSON.parse(item2.settings), { query: 'SELECT * FROM t2', trackingInstant: { trackInstant: false } });
    });

    it('attaches an item-scoped record-list-to-csv transformer where nothing resolved before', async () => {
      await up(db);

      const recordListToCsv = await db('transformers').where('function_name', 'record-list-to-csv').first();
      const rows = await db('north_transformers as nt')
        .join('north_transformers_items as nti', 'nti.id', 'nt.id')
        .where('nt.north_id', 'north1')
        .select('nt.transformer_id', 'nti.item_id');
      assert.strictEqual(rows.length, 2);
      assert.ok(rows.every(r => r.transformer_id === recordListToCsv.id));
    });

    it('shadows a pre-existing south-level iso transformer with per-item attachments', async () => {
      await up(db);

      const oldRow = await db('north_transformers').where('id', 'nt-south-level-iso').first();
      assert.strictEqual(oldRow.transformer_id, 'iso-transformer', 'old row left in place, untouched');

      const recordListToCsv = await db('transformers').where('function_name', 'record-list-to-csv').first();
      const rows = await db('north_transformers as nt')
        .join('north_transformers_items as nti', 'nti.id', 'nt.id')
        .where('nt.north_id', 'north2')
        .select('nt.transformer_id');
      assert.strictEqual(rows.length, 2);
      assert.ok(rows.every(r => r.transformer_id === recordListToCsv.id));
    });
  });

  it('rewrites a history item and attaches a transformer for an oledb history query', async () => {
    await db('history_queries').insert({
      id: 'hq-oledb',
      name: 'HQ OLEDB',
      start_time: NOW,
      end_time: NOW,
      south_type: 'oledb',
      north_type: 'file-writer',
      south_settings: JSON.stringify(OLD_OLEDB_SETTINGS),
      north_settings: JSON.stringify({}),
      caching_trigger_schedule: 'sm1',
      caching_trigger_number_of_elements: 1000,
      caching_trigger_number_of_files: 1,
      caching_throttling_cache_max_size: 0,
      caching_throttling_max_number_of_elements: 10_000,
      caching_error_retry_interval: 5000,
      caching_error_retry_count: 3,
      caching_archive_enabled: false,
      caching_archive_retention_duration: 0
    });
    await db('history_items').insert({
      id: 'hitem1',
      history_id: 'hq-oledb',
      name: 'hitem1',
      enabled: true,
      settings: JSON.stringify(OLD_OLEDB_ITEM_SETTINGS)
    });

    await up(db);

    const item = await db('history_items').where('id', 'hitem1').first();
    assert.deepStrictEqual(JSON.parse(item.settings), {
      query: 'SELECT * FROM t1',
      trackingInstant: {
        trackInstant: true,
        fieldName: 'timestamp',
        dateTimeInput: { type: 'string', timezone: 'Europe/Paris', format: 'yyyy-MM-dd HH:mm:ss.SSS', locale: 'en-US' }
      }
    });

    const recordListToCsv = await db('transformers').where('function_name', 'record-list-to-csv').first();
    const link = await db('history_query_transformers as hqt')
      .join('history_query_transformers_items as hqti', 'hqti.id', 'hqt.id')
      .where('hqt.history_id', 'hq-oledb')
      .select('hqt.transformer_id', 'hqti.item_id')
      .first();
    assert.strictEqual(link.transformer_id, recordListToCsv.id);
    assert.strictEqual(link.item_id, 'hitem1');
  });

  it('down is a no-op', async () => {
    await db('south_connectors').insert({
      id: 'oledb2',
      name: 'OLEDB 2',
      type: 'oledb',
      enabled: true,
      settings: JSON.stringify(OLD_OLEDB_SETTINGS)
    });
    await up(db);
    await down(db);
    const row = await db('south_connectors').where('id', 'oledb2').first();
    assert.strictEqual(JSON.parse(row.settings).agentUrl, undefined, 'down does not revert the up() migration');
  });
});
