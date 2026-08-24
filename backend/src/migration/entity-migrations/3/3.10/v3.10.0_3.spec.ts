import { describe, it, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import knex, { Knex } from 'knex';
import { buildPreMigrationSchema } from '../../../../tests/utils/test-utils';
import { down, up } from './v3.10.0_3';

const NOW = '2024-01-01T00:00:00.000Z';

const OLD_ODBC_SETTINGS = {
  remoteAgent: true,
  agentUrl: 'http://ip-adress-or-host:2224',
  connectionTimeout: 15000,
  retryInterval: 10000,
  requestTimeout: 15000,
  connectionString: 'Driver={SQL Server};Server=myServerAddress;Database=myDataBase;Uid=myUsername;Pwd=myPassword;',
  password: null
};

const OLD_ODBC_LOCAL_SETTINGS = {
  remoteAgent: false,
  connectionTimeout: 15000,
  retryInterval: 10000,
  requestTimeout: 15000,
  connectionString: 'Driver={SQL Server};Server=myServerAddress;Database=myDataBase;Uid=myUsername;Pwd=myPassword;',
  password: null
};

describe('Entity migration v3.10.0_3', () => {
  let db: Knex;

  after(async () => {
    await db?.destroy();
  });

  beforeEach(async () => {
    await db?.destroy();
    db = knex({ client: 'better-sqlite3', connection: { filename: ':memory:' }, useNullAsDefault: true });
    await buildPreMigrationSchema(db, 'v3.10.0_3');
    await db('scan_modes').insert({ id: 'sm1', name: 'Every minute', description: '', cron: '0 * * * * *' });
  });

  it('runs end-to-end on a realistic pre-3.10.0_3 schema', async () => {
    await up(db); // must not throw
  });

  it('drops remoteAgent/agentUrl/retryInterval/requestTimeout from an odbc south connector, preserving other fields', async () => {
    await db('south_connectors').insert({
      id: 'odbc1',
      name: 'ODBC 1',
      type: 'odbc',
      enabled: true,
      settings: JSON.stringify(OLD_ODBC_SETTINGS)
    });

    await up(db);

    const row = await db('south_connectors').where('id', 'odbc1').first();
    const settings = JSON.parse(row.settings);
    assert.deepStrictEqual(settings, {
      connectionTimeout: 15000,
      connectionString: OLD_ODBC_SETTINGS.connectionString,
      password: null
    });
  });

  it('drops the same fields whether remoteAgent was true or false', async () => {
    await db('south_connectors').insert({
      id: 'odbc-local',
      name: 'ODBC local',
      type: 'odbc',
      enabled: true,
      settings: JSON.stringify(OLD_ODBC_LOCAL_SETTINGS)
    });

    await up(db);

    const row = await db('south_connectors').where('id', 'odbc-local').first();
    const settings = JSON.parse(row.settings);
    assert.deepStrictEqual(settings, {
      connectionTimeout: 15000,
      connectionString: OLD_ODBC_LOCAL_SETTINGS.connectionString,
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

  it('drops the same fields from a history query with an odbc south, preserving other fields', async () => {
    await db('history_queries').insert({
      id: 'hq-odbc',
      name: 'HQ ODBC',
      start_time: NOW,
      end_time: NOW,
      south_type: 'odbc',
      north_type: 'file-writer',
      south_settings: JSON.stringify(OLD_ODBC_SETTINGS),
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

    const row = await db('history_queries').where('id', 'hq-odbc').first();
    const settings = JSON.parse(row.south_settings);
    assert.deepStrictEqual(settings, {
      connectionTimeout: 15000,
      connectionString: OLD_ODBC_SETTINGS.connectionString,
      password: null
    });
  });

  it('does not touch south_settings of history queries with a different south type', async () => {
    const oldSettings = { host: 'h', port: 1, database: 'd' };
    await db('history_queries').insert({
      id: 'hq-postgres',
      name: 'HQ Postgres',
      start_time: NOW,
      end_time: NOW,
      south_type: 'postgresql',
      north_type: 'file-writer',
      south_settings: JSON.stringify(oldSettings),
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

    const row = await db('history_queries').where('id', 'hq-postgres').first();
    assert.deepStrictEqual(JSON.parse(row.south_settings), oldSettings);
  });

  it('down is a no-op', async () => {
    await db('south_connectors').insert({
      id: 'odbc2',
      name: 'ODBC 2',
      type: 'odbc',
      enabled: true,
      settings: JSON.stringify(OLD_ODBC_SETTINGS)
    });
    await up(db);
    await down(db);
    const row = await db('south_connectors').where('id', 'odbc2').first();
    const settings = JSON.parse(row.settings);
    assert.strictEqual(settings.remoteAgent, undefined, 'down does not revert the up() migration');
  });

  describe('record-list rework (items + transformers)', () => {
    beforeEach(async () => {
      // An odbc south with 3 items covering the interesting settings combinations:
      // - item1: has a reference dateTimeField (tracked) plus a non-reference one, full serialization
      // - item2: no dateTimeFields at all
      // - item3: same "reference field" shape as item1, used to exercise a pre-existing transformer
      await db('south_connectors').insert({
        id: 'south1',
        name: 'South 1',
        type: 'odbc',
        enabled: true,
        settings: JSON.stringify(OLD_ODBC_LOCAL_SETTINGS)
      });
      await db('south_items').insert([
        {
          id: 'item1',
          connector_id: 'south1',
          scan_mode_id: 'sm1',
          name: 'item1',
          enabled: true,
          settings: JSON.stringify({
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
          })
        },
        {
          id: 'item2',
          connector_id: 'south1',
          scan_mode_id: 'sm1',
          name: 'item2',
          enabled: true,
          settings: JSON.stringify({
            query: 'SELECT * FROM t2',
            dateTimeFields: null,
            serialization: {
              type: 'csv',
              filename: 'item2.csv',
              delimiter: 'SEMI_COLON',
              compression: false,
              outputTimestampFormat: 'yyyy-MM-dd',
              outputTimezone: 'UTC'
            }
          })
        },
        {
          id: 'item3',
          connector_id: 'south1',
          scan_mode_id: 'sm1',
          name: 'item3',
          enabled: true,
          settings: JSON.stringify({
            query: 'SELECT * FROM t3',
            dateTimeFields: [
              { fieldName: 'timestamp', useAsReference: true, type: 'string', timezone: 'UTC', format: 'yyyy-MM-dd', locale: 'en-US' }
            ],
            serialization: {
              type: 'csv',
              filename: 'item3.csv',
              delimiter: 'COMMA',
              compression: false,
              outputTimestampFormat: 'yyyy-MM-dd',
              outputTimezone: 'UTC'
            }
          })
        }
      ]);

      // north1: no transformer at all configured for south1 -> should get one attached per item.
      // north2: south-level 'iso' passthrough for south1 -> should be shadowed per item.
      // north3: item-level 'ignore' on item1, nothing on item2/item3 -> item1 left alone, others get one.
      // north4: item-level 'csv-to-mqtt' on item3 -> left untouched (edge case).
      // north5 (disabled): still gets the migration applied like any other north.
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
      await db('north_connectors').insert([
        { ...northConnectorDefaults, id: 'north1', name: 'North 1', enabled: true },
        { ...northConnectorDefaults, id: 'north2', name: 'North 2', enabled: true },
        { ...northConnectorDefaults, id: 'north3', name: 'North 3', enabled: true },
        { ...northConnectorDefaults, id: 'north4', name: 'North 4', enabled: true },
        { ...northConnectorDefaults, id: 'north5', name: 'North 5 (disabled)', enabled: false }
      ]);

      await db('transformers').insert([
        { id: 'iso-transformer', type: 'standard', function_name: 'iso', input_type: 'any', output_type: 'any' },
        { id: 'ignore-transformer', type: 'standard', function_name: 'ignore', input_type: 'any', output_type: 'any' },
        { id: 'csv-to-mqtt-transformer', type: 'standard', function_name: 'csv-to-mqtt', input_type: 'any', output_type: 'mqtt' }
      ]);
      // north2: south-level iso (no item/group scoping at all).
      await db('north_transformers').insert({
        id: 'nt-south-level-iso',
        north_id: 'north2',
        transformer_id: 'iso-transformer',
        options: '{}',
        source_type: 'south',
        source_south_south_id: 'south1',
        source_south_group_id: null
      });
      // north3: item-level ignore, scoped to item1 only.
      await db('north_transformers').insert({
        id: 'nt-item-ignore',
        north_id: 'north3',
        transformer_id: 'ignore-transformer',
        options: '{}',
        source_type: 'south',
        source_south_south_id: 'south1',
        source_south_group_id: null
      });
      await db('north_transformers_items').insert({ id: 'nt-item-ignore', item_id: 'item1' });
      // north4: item-level csv-to-mqtt, scoped to item3 only.
      await db('north_transformers').insert({
        id: 'nt-item-csvmqtt',
        north_id: 'north4',
        transformer_id: 'csv-to-mqtt-transformer',
        options: '{}',
        source_type: 'south',
        source_south_south_id: 'south1',
        source_south_group_id: null
      });
      await db('north_transformers_items').insert({ id: 'nt-item-csvmqtt', item_id: 'item3' });

      // A history query with an odbc south, one item with a reference field, and a pre-existing
      // history-level iso transformer that should be shadowed per item.
      await db('history_queries').insert({
        id: 'hq1',
        name: 'HQ 1',
        start_time: NOW,
        end_time: NOW,
        south_type: 'odbc',
        north_type: 'file-writer',
        south_settings: JSON.stringify(OLD_ODBC_LOCAL_SETTINGS),
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
        history_id: 'hq1',
        name: 'hitem1',
        enabled: true,
        settings: JSON.stringify({
          query: 'SELECT * FROM t1',
          dateTimeFields: [
            { fieldName: 'timestamp', useAsReference: true, type: 'string', timezone: 'UTC', format: 'yyyy-MM-dd', locale: 'en-US' }
          ],
          serialization: {
            type: 'csv',
            filename: 'hitem1.csv',
            delimiter: 'COMMA',
            compression: false,
            outputTimestampFormat: 'yyyy-MM-dd',
            outputTimezone: 'UTC'
          }
        })
      });
      await db('history_query_transformers').insert({
        id: 'hqt-history-level-iso',
        history_id: 'hq1',
        transformer_id: 'iso-transformer',
        options: '{}'
      });
    });

    it('should seed a single record-list-to-csv transformer catalog row, idempotently', async () => {
      await up(db);
      const rows = await db('transformers').select('id').where('function_name', 'record-list-to-csv');
      assert.strictEqual(rows.length, 1);

      // Running up() again (simulating a second migration pass) must not create a duplicate.
      await up(db);
      const rowsAfterSecondRun = await db('transformers').select('id').where('function_name', 'record-list-to-csv');
      assert.strictEqual(rowsAfterSecondRun.length, 1);
      assert.strictEqual(rowsAfterSecondRun[0].id, rows[0].id);
    });

    it('should rewrite dateTimeFields+serialization into trackingInstant for every item', async () => {
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
      assert.deepStrictEqual(JSON.parse(item2.settings), {
        query: 'SELECT * FROM t2',
        trackingInstant: { trackInstant: false }
      });
    });

    it('should attach an item-scoped record-list-to-csv transformer where nothing resolved before (north1)', async () => {
      await up(db);

      const recordListToCsv = await db('transformers').where('function_name', 'record-list-to-csv').first();
      const rows = await db(`${'north_transformers'} as nt`)
        .join('north_transformers_items as nti', 'nti.id', 'nt.id')
        .where('nt.north_id', 'north1')
        .select('nt.id', 'nt.transformer_id', 'nt.options', 'nti.item_id');

      assert.strictEqual(rows.length, 3); // item1, item2, item3
      for (const row of rows) {
        assert.strictEqual(row.transformer_id, recordListToCsv.id);
      }
      const item1Row = rows.find(r => r.item_id === 'item1');
      assert.deepStrictEqual(JSON.parse(item1Row.options), {
        filename: 'item1.csv',
        encoding: 'UTF_8',
        header: true,
        compression: true,
        delimiter: 'COMMA',
        newline: 'LF',
        quoteChar: 'NONE',
        escapeChar: 'DOUBLE_QUOTE',
        nullValue: '',
        fields: [
          {
            fieldName: 'other',
            columnName: null,
            dataType: 'datetime',
            fieldProcess: null,
            datetimeSettings: {
              inputType: 'unix-epoch-ms',
              inputTimezone: null,
              inputFormat: null,
              inputLocale: null,
              outputType: 'string',
              outputTimezone: 'Europe/Paris',
              outputFormat: 'yyyy-MM-dd HH:mm:ss.SSS',
              outputLocale: null
            }
          },
          {
            fieldName: 'timestamp',
            columnName: null,
            dataType: 'datetime',
            fieldProcess: null,
            datetimeSettings: {
              inputType: 'string',
              inputTimezone: 'Europe/Paris',
              inputFormat: 'yyyy-MM-dd HH:mm:ss.SSS',
              inputLocale: 'en-US',
              outputType: 'string',
              outputTimezone: 'Europe/Paris',
              outputFormat: 'yyyy-MM-dd HH:mm:ss.SSS',
              outputLocale: null
            }
          }
        ]
      });
    });

    it('should shadow a pre-existing south-level iso transformer with per-item attachments (north2)', async () => {
      await up(db);

      // The old south-level iso row is left in place, untouched...
      const oldRow = await db('north_transformers').where('id', 'nt-south-level-iso').first();
      assert.strictEqual(oldRow.transformer_id, 'iso-transformer');

      // ...but every item now has its own higher-priority item-level record-list-to-csv row.
      const recordListToCsv = await db('transformers').where('function_name', 'record-list-to-csv').first();
      const rows = await db('north_transformers as nt')
        .join('north_transformers_items as nti', 'nti.id', 'nt.id')
        .where('nt.north_id', 'north2')
        .select('nt.transformer_id', 'nti.item_id');
      assert.strictEqual(rows.length, 3);
      assert.ok(rows.every(r => r.transformer_id === recordListToCsv.id));
    });

    it('should leave an "ignore" item-level transformer alone (north3, item1) but attach one to the other items', async () => {
      await up(db);

      const ignoreRow = await db('north_transformers').where('id', 'nt-item-ignore').first();
      assert.strictEqual(ignoreRow.transformer_id, 'ignore-transformer'); // untouched

      const recordListToCsv = await db('transformers').where('function_name', 'record-list-to-csv').first();
      const rows = await db('north_transformers as nt')
        .join('north_transformers_items as nti', 'nti.id', 'nt.id')
        .where('nt.north_id', 'north3')
        .andWhere('nt.transformer_id', recordListToCsv.id)
        .select('nti.item_id');
      assert.deepStrictEqual(rows.map(r => r.item_id).sort(), ['item2', 'item3']);
    });

    it('should leave an unrelated pre-existing transformer untouched (north4, csv-to-mqtt on item3)', async () => {
      await up(db);

      const csvMqttRow = await db('north_transformers').where('id', 'nt-item-csvmqtt').first();
      assert.strictEqual(csvMqttRow.transformer_id, 'csv-to-mqtt-transformer'); // untouched

      // item1 and item2 still get their own attachment on north4 (nothing resolved for them there).
      const recordListToCsv = await db('transformers').where('function_name', 'record-list-to-csv').first();
      const rows = await db('north_transformers as nt')
        .join('north_transformers_items as nti', 'nti.id', 'nt.id')
        .where('nt.north_id', 'north4')
        .andWhere('nt.transformer_id', recordListToCsv.id)
        .select('nti.item_id');
      assert.deepStrictEqual(rows.map(r => r.item_id).sort(), ['item1', 'item2']);
    });

    it('should still attach transformers for a disabled north connector (north5)', async () => {
      await up(db);

      const recordListToCsv = await db('transformers').where('function_name', 'record-list-to-csv').first();
      const rows = await db('north_transformers as nt')
        .join('north_transformers_items as nti', 'nti.id', 'nt.id')
        .where('nt.north_id', 'north5')
        .select('nt.transformer_id', 'nti.item_id');
      assert.strictEqual(rows.length, 3); // item1, item2, item3
      assert.ok(rows.every(r => r.transformer_id === recordListToCsv.id));
    });

    it('should apply the same treatment to a history query with an odbc south', async () => {
      await up(db);

      const item = await db('history_items').where('id', 'hitem1').first();
      assert.deepStrictEqual(JSON.parse(item.settings), {
        query: 'SELECT * FROM t1',
        trackingInstant: {
          trackInstant: true,
          fieldName: 'timestamp',
          dateTimeInput: { type: 'string', timezone: 'UTC', format: 'yyyy-MM-dd', locale: 'en-US' }
        }
      });

      // The old history-level iso row is left in place...
      const oldRow = await db('history_query_transformers').where('id', 'hqt-history-level-iso').first();
      assert.strictEqual(oldRow.transformer_id, 'iso-transformer');

      // ...shadowed by a new item-level record-list-to-csv attachment.
      const recordListToCsv = await db('transformers').where('function_name', 'record-list-to-csv').first();
      const rows = await db('history_query_transformers as ht')
        .join('history_query_transformers_items as hti', 'hti.id', 'ht.id')
        .where('ht.history_id', 'hq1')
        .select('ht.transformer_id', 'hti.item_id');
      assert.strictEqual(rows.length, 1);
      assert.strictEqual(rows[0].item_id, 'hitem1');
      assert.strictEqual(rows[0].transformer_id, recordListToCsv.id);
    });

    it("does not touch items or transformers of a history query whose south isn't odbc", async () => {
      await db('history_queries').insert({
        id: 'hq-other',
        name: 'HQ Other',
        start_time: NOW,
        end_time: NOW,
        south_type: 'postgresql',
        north_type: 'file-writer',
        south_settings: JSON.stringify({ host: 'h', port: 1, database: 'd' }),
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
      const otherItemSettings = { query: 'SELECT * FROM t', dateTimeFields: null, serialization: { type: 'csv' } };
      await db('history_items').insert({
        id: 'hitem-other',
        history_id: 'hq-other',
        name: 'hitem-other',
        enabled: true,
        settings: JSON.stringify(otherItemSettings)
      });

      await up(db);

      const item = await db('history_items').where('id', 'hitem-other').first();
      assert.deepStrictEqual(JSON.parse(item.settings), otherItemSettings);
    });

    it('down() is a no-op (irreversible)', async () => {
      await up(db);
      await assert.doesNotReject(down(db));
    });
  });
});
