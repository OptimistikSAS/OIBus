import { describe, it, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import knex, { Knex } from 'knex';
import { buildPreMigrationSchema } from '../../../../tests/utils/test-utils';
import { down, up } from './v3.10.0';

const NOW = '2024-01-01T00:00:00.000Z';

async function columnNames(db: Knex, table: string): Promise<Array<string>> {
  const cols = (await db.raw(`PRAGMA table_info(${table})`)) as Array<{ name: string }>;
  return cols.map(c => c.name);
}

describe('Entity migration v3.10.0', () => {
  describe('scan modes scheduling / certificate chain', () => {
    let db: Knex;

    after(async () => {
      await db?.destroy();
    });

    beforeEach(async () => {
      await db?.destroy();
      db = knex({ client: 'better-sqlite3', connection: { filename: ':memory:' }, useNullAsDefault: true });
      await buildPreMigrationSchema(db, 'v3.10.0');
      await db('scan_modes').insert([
        { id: 'sm1', name: 'Every minute', description: 'Trigger every minute', cron: '0 * * * * *' },
        { id: 'sm2', name: 'Every hour', description: 'Trigger every hour', cron: '0 0 * * * *' },
        // The reserved push-driven row, whose cron is empty.
        { id: 'subscription', name: 'Subscription', description: 'Used for subscription', cron: '' }
      ]);
      await db('certificates').insert({
        id: 'test-certificate-id',
        name: 'Test Certificate',
        public_key: 'public key',
        private_key: 'private key',
        certificate: 'certificate',
        expiry: '2026-01-01T00:00:00Z'
      });
    });

    describe('scan_modes', () => {
      it('should add the type, interval and activation window columns', async () => {
        await up(db);

        const columns = await columnNames(db, 'scan_modes');
        assert.ok(columns.includes('type'));
        assert.ok(columns.includes('interval'));
        assert.ok(columns.includes('activation_window'));
      });

      it('should backfill every existing scan mode as cron', async () => {
        await up(db);

        const rows = await db('scan_modes').select('id', 'type').orderBy('id');
        assert.deepStrictEqual(
          rows.map(row => row.type),
          ['sm1', 'sm2', 'subscription'].map(() => 'cron')
        );
      });

      it('should leave interval and activation window empty', async () => {
        await up(db);

        const rows = await db('scan_modes').select('interval', 'activation_window');
        for (const row of rows) {
          assert.strictEqual(row.interval, null);
          assert.strictEqual(row.activation_window, null);
        }
      });

      it('should drop the columns on down', async () => {
        await up(db);
        await down(db);

        const columns = await columnNames(db, 'scan_modes');
        assert.ok(!columns.includes('type'));
        assert.ok(!columns.includes('interval'));
        assert.ok(!columns.includes('activation_window'));
        // The rows themselves survive the rollback.
        assert.strictEqual((await db('scan_modes').select('id')).length, 3);
      });

      it('should be re-appliable after a rollback', async () => {
        await up(db);
        await down(db);
        await up(db);

        const rows = await db('scan_modes').select('type');
        assert.ok(rows.every(row => row.type === 'cron'));
      });
    });

    describe('certificates', () => {
      describe('up', () => {
        it('adds the certificate_chain column to certificates', async () => {
          await up(db);
          const cols = await columnNames(db, 'certificates');
          assert.ok(cols.includes('certificate_chain'), 'certificates.certificate_chain added');
        });

        it('leaves certificate_chain null for existing rows', async () => {
          await up(db);
          const row = await db('certificates').where('id', 'test-certificate-id').first();
          assert.strictEqual(row.certificate_chain, null);
        });
      });

      describe('down', () => {
        it('drops the certificate_chain column', async () => {
          await up(db);
          await down(db);
          const cols = await columnNames(db, 'certificates');
          assert.ok(!cols.includes('certificate_chain'), 'certificates.certificate_chain removed');
        });
      });

      it('is reversible: up → down → up produces the column again', async () => {
        await up(db);
        await down(db);
        await up(db);

        const cols = await columnNames(db, 'certificates');
        assert.ok(cols.includes('certificate_chain'), 'certificates.certificate_chain added');
      });
    });
  });

  describe('SQL-family souths record-list refactor', () => {
    let db: Knex;

    after(async () => {
      await db?.destroy();
    });

    beforeEach(async () => {
      await db?.destroy();
      db = knex({ client: 'better-sqlite3', connection: { filename: ':memory:' }, useNullAsDefault: true });
      await buildPreMigrationSchema(db, 'v3.10.0');

      await db('scan_modes').insert([{ id: 'sm1', name: 'Every minute', description: '', cron: '0 * * * * *' }]);

      // A south of an in-scope SQL type, with 3 items covering the interesting settings combinations:
      // - item1: has a reference dateTimeField (tracked) plus a non-reference one, full serialization
      // - item2: no dateTimeFields at all
      // - item3: same "reference field" shape as item1, used to exercise a pre-existing transformer
      await db('south_connectors').insert({
        id: 'south1',
        name: 'South 1',
        type: 'mysql',
        enabled: true,
        settings: JSON.stringify({ host: 'h', port: 1, database: 'd', connectionTimeout: 1000 })
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
            requestTimeout: 1000,
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
            requestTimeout: 1000,
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
            requestTimeout: 1000,
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

      // A history query of an in-scope SQL type, one item with a reference field, and a pre-existing
      // history-level iso transformer that should be shadowed per item.
      await db('history_queries').insert({
        id: 'hq1',
        name: 'HQ 1',
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

      // south2/item4: exercises every `??` fallback at once — a reference dateTimeField missing
      // timezone/format/locale entirely (so `toNewItemSettings`'s fallbacks to `null` are hit), and no
      // `serialization` key at all on the item (so every `serialization?.x ?? default` fallback in
      // `buildTransformerOptions` is hit too). item4 also belongs to a south-item-group ('grp1'), which
      // north6/north7 target at the group level rather than item- or south-level.
      await db('south_connectors').insert({
        id: 'south2',
        name: 'South 2',
        type: 'postgresql',
        enabled: true,
        settings: JSON.stringify({ host: 'h', port: 1, database: 'd' })
      });
      await db('south_items').insert({
        id: 'item4',
        connector_id: 'south2',
        scan_mode_id: 'sm1',
        name: 'item4',
        enabled: true,
        settings: JSON.stringify({
          query: 'SELECT * FROM t4',
          dateTimeFields: [{ fieldName: 'ts', useAsReference: true, type: 'unix-epoch-ms' }]
        })
      });
      await db('south_item_groups').insert({
        id: 'grp1',
        created_at: NOW,
        updated_at: NOW,
        name: 'Group 1',
        south_id: 'south2',
        scan_mode_id: 'sm1'
      });
      await db('group_items').insert({ group_id: 'grp1', item_id: 'item4' });

      // south3: an in-scope SQL south with no items at all -> exercises the "no items" early return.
      await db('south_connectors').insert({
        id: 'south3',
        name: 'South 3',
        type: 'oracle',
        enabled: true,
        settings: JSON.stringify({ host: 'h', port: 1, database: 'd' })
      });

      // north6/north7: group-scoped (not item- or south-level) pre-existing transformers for south2/grp1.
      await db('north_connectors').insert([
        { ...northConnectorDefaults, id: 'north6', name: 'North 6', enabled: true },
        { ...northConnectorDefaults, id: 'north7', name: 'North 7', enabled: true }
      ]);
      await db('north_transformers').insert({
        id: 'nt-group-iso',
        north_id: 'north6',
        transformer_id: 'iso-transformer',
        options: '{}',
        source_type: 'south',
        source_south_south_id: 'south2',
        source_south_group_id: 'grp1'
      });
      await db('north_transformers').insert({
        id: 'nt-group-csvmqtt',
        north_id: 'north7',
        transformer_id: 'csv-to-mqtt-transformer',
        options: '{}',
        source_type: 'south',
        source_south_south_id: 'south2',
        source_south_group_id: 'grp1'
      });

      // The migration processes every (south, north) combination, not just the ones a given test cares
      // about — so, left alone, south2/item4 would also get a new attachment on north1..north5 (nothing
      // resolves for south2 there), and south1's item1..item3 would also get one on north6/north7
      // (nothing resolves for south1 there), corrupting the item-count assertions above and below. A
      // south-level 'ignore' bridge on the "other" south for each of those norths keeps the two
      // scenarios independent, the same deliberate "leave it" choice north3/north4 already exercise at
      // the item level.
      for (const northId of ['north1', 'north2', 'north3', 'north4', 'north5']) {
        await db('north_transformers').insert({
          id: `nt-${northId}-south2-ignore-bridge`,
          north_id: northId,
          transformer_id: 'ignore-transformer',
          options: '{}',
          source_type: 'south',
          source_south_south_id: 'south2',
          source_south_group_id: null
        });
      }
      for (const northId of ['north6', 'north7']) {
        await db('north_transformers').insert({
          id: `nt-${northId}-south1-ignore-bridge`,
          north_id: northId,
          transformer_id: 'ignore-transformer',
          options: '{}',
          source_type: 'south',
          source_south_south_id: 'south1',
          source_south_group_id: null
        });
      }

      // hq2: an in-scope history query with no items at all -> exercises the per-history-query "no
      // items" `continue` (distinct from the "no in-scope history queries at all" early return).
      await db('history_queries').insert({
        id: 'hq2',
        name: 'HQ 2',
        start_time: NOW,
        end_time: NOW,
        south_type: 'mssql',
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
    });

    it('should seed a single record-list-to-csv transformer catalog row, idempotently', async () => {
      // Simulates the catalog row already existing (e.g. seeded by a previous run of this same
      // migration) — up() must reuse it rather than inserting a duplicate. (Re-invoking the whole
      // migration's up() to simulate this, as this test used to, isn't meaningful any more now that
      // scan mode/certificate columns are added unconditionally earlier in the same up(): a second
      // full pass would fail on those, not on this idempotency check.)
      await db('transformers').insert({
        id: 'existing-record-list-to-csv',
        type: 'standard',
        function_name: 'record-list-to-csv',
        input_type: 'record-list',
        output_type: 'any',
        created_by: 'system',
        updated_by: 'system'
      });

      await up(db);

      const rows = await db('transformers').select('id').where('function_name', 'record-list-to-csv');
      assert.strictEqual(rows.length, 1);
      assert.strictEqual(rows[0].id, 'existing-record-list-to-csv');
    });

    it('should rewrite dateTimeFields+serialization into trackingInstant for every item', async () => {
      await up(db);

      const item1 = await db('south_items').where('id', 'item1').first();
      assert.deepStrictEqual(JSON.parse(item1.settings), {
        query: 'SELECT * FROM t1',
        requestTimeout: 1000,
        trackingInstant: {
          trackInstant: true,
          fieldName: 'timestamp',
          dateTimeInput: { type: 'string', timezone: 'Europe/Paris', format: 'yyyy-MM-dd HH:mm:ss.SSS', locale: 'en-US' }
        }
      });

      const item2 = await db('south_items').where('id', 'item2').first();
      assert.deepStrictEqual(JSON.parse(item2.settings), {
        query: 'SELECT * FROM t2',
        requestTimeout: 1000,
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

    it('should apply the same treatment to history queries', async () => {
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

    it('should fall back to null for a reference field missing timezone/format/locale, and to the documented defaults when serialization is entirely absent (item4)', async () => {
      await up(db);

      const item4 = await db('south_items').where('id', 'item4').first();
      assert.deepStrictEqual(JSON.parse(item4.settings), {
        query: 'SELECT * FROM t4',
        trackingInstant: {
          trackInstant: true,
          fieldName: 'ts',
          dateTimeInput: { type: 'unix-epoch-ms', timezone: null, format: null, locale: null }
        }
      });

      // item4 gets a new attachment on north6 (see the group-level test below) whose options prove
      // every `serialization?.x ?? default` fallback fired, since item4 has no `serialization` at all.
      const recordListToCsv = await db('transformers').where('function_name', 'record-list-to-csv').first();
      const north6Rows = await db('north_transformers as nt')
        .join('north_transformers_items as nti', 'nti.id', 'nt.id')
        .where('nt.north_id', 'north6')
        .andWhere('nt.transformer_id', recordListToCsv.id)
        .select('nt.options', 'nti.item_id');
      assert.strictEqual(north6Rows.length, 1);
      assert.strictEqual(north6Rows[0].item_id, 'item4');
      assert.deepStrictEqual(JSON.parse(north6Rows[0].options), {
        filename: '@CurrentDate.csv',
        encoding: 'UTF_8',
        header: true,
        compression: false,
        delimiter: 'COMMA',
        newline: 'LF',
        quoteChar: 'NONE',
        escapeChar: 'DOUBLE_QUOTE',
        nullValue: '',
        fields: [
          {
            fieldName: 'ts',
            columnName: null,
            dataType: 'datetime',
            fieldProcess: null,
            datetimeSettings: {
              inputType: 'unix-epoch-ms',
              inputTimezone: null,
              inputFormat: null,
              inputLocale: null,
              outputType: 'string',
              outputTimezone: 'UTC',
              outputFormat: 'yyyy-MM-dd HH:mm:ss.SSS',
              outputLocale: null
            }
          }
        ]
      });
    });

    it('should resolve a group-level transformer via south-item-group membership, shadowing an "iso" one (north6) but leaving a real one alone (north7)', async () => {
      await up(db);

      const recordListToCsv = await db('transformers').where('function_name', 'record-list-to-csv').first();

      // north6: the group-level 'iso' row is left in place, untouched...
      const isoRow = await db('north_transformers').where('id', 'nt-group-iso').first();
      assert.strictEqual(isoRow.transformer_id, 'iso-transformer');
      // ...but item4 gets a new, higher-priority item-level attachment on north6, since group-level
      // resolution found only a bare passthrough.
      const north6NewRows = await db('north_transformers as nt')
        .join('north_transformers_items as nti', 'nti.id', 'nt.id')
        .where('nt.north_id', 'north6')
        .andWhere('nt.transformer_id', recordListToCsv.id)
        .select('nti.item_id');
      assert.deepStrictEqual(
        north6NewRows.map(r => r.item_id),
        ['item4']
      );

      // north7: the group-level 'csv-to-mqtt' row is a deliberate, already-rendered choice -> left
      // alone, and no new attachment is created for item4 there.
      const csvMqttRow = await db('north_transformers').where('id', 'nt-group-csvmqtt').first();
      assert.strictEqual(csvMqttRow.transformer_id, 'csv-to-mqtt-transformer');
      const north7NewRows = await db('north_transformers as nt')
        .join('north_transformers_items as nti', 'nti.id', 'nt.id')
        .where('nt.north_id', 'north7')
        .andWhere('nt.transformer_id', recordListToCsv.id);
      assert.strictEqual(north7NewRows.length, 0);
    });

    it('should skip a south connector with no items at all (south3) without error', async () => {
      await assert.doesNotReject(up(db));

      const rows = await db('south_items').where('connector_id', 'south3');
      assert.strictEqual(rows.length, 0);
    });

    it('should skip a history query with no items (hq2) while still processing hq1 normally', async () => {
      await up(db);

      const hq2TransformerRows = await db('history_query_transformers').where('history_id', 'hq2');
      assert.strictEqual(hq2TransformerRows.length, 0);

      const hq1Item = await db('history_items').where('id', 'hitem1').first();
      assert.ok(JSON.parse(hq1Item.settings).trackingInstant, 'expected hq1 to still be migrated normally');
    });

    it('should no-op cleanly when there are no in-scope history queries at all', async () => {
      await db('history_query_transformers_items').del();
      await db('history_query_transformers').del();
      await db('history_items').del();
      await db('history_queries').del();

      await assert.doesNotReject(up(db));

      // the south-side migration still runs normally even though the history-query side is empty.
      const item1 = await db('south_items').where('id', 'item1').first();
      assert.ok(JSON.parse(item1.settings).trackingInstant);
    });

    it('down() is a no-op (irreversible)', async () => {
      await up(db);
      await assert.doesNotReject(down(db));
    });
  });

  describe('audit trail', () => {
    let db: Knex;

    after(async () => {
      await db?.destroy();
    });

    beforeEach(async () => {
      await db?.destroy();
      db = knex({ client: 'better-sqlite3', connection: { filename: ':memory:' }, useNullAsDefault: true });
      await buildPreMigrationSchema(db, 'v3.10.0');

      await db('engines').insert({
        id: 'test-engine-id',
        name: 'Test Engine',
        port: 2223,
        log_console_level: 'silent',
        log_file_level: 'silent',
        log_file_max_file_size: 50,
        log_file_number_of_files: 5,
        log_database_level: 'silent',
        log_database_max_number_of_logs: 100000,
        log_loki_level: 'silent',
        log_loki_interval: 60,
        log_oia_level: 'silent',
        log_oia_interval: 10,
        proxy_enabled: 0,
        proxy_port: 9000,
        oibus_version: '3.9.0',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z'
      });
    });

    describe('up', () => {
      it('creates the audit_logs table with the expected columns', async () => {
        await up(db);

        await db('audit_logs').insert({
          id: 'audit1',
          entity_type: 'south_connector',
          entity_id: 'south1',
          action: 'CREATE',
          previous_state: null,
          new_state: JSON.stringify({ name: 'South 1' }),
          user_id: 'user1',
          created_at: '2026-01-01T00:00:00.000Z'
        });
        const row = await db('audit_logs').where('id', 'audit1').first();
        assert.strictEqual(row.entity_type, 'south_connector');
        assert.strictEqual(row.entity_id, 'south1');
        assert.strictEqual(row.action, 'CREATE');
        assert.strictEqual(row.previous_state, null);
        assert.strictEqual(row.new_state, JSON.stringify({ name: 'South 1' }));
        assert.strictEqual(row.user_id, 'user1');
        assert.strictEqual(row.created_at, '2026-01-01T00:00:00.000Z');

        await db('audit_logs').insert({
          id: 'audit2',
          entity_type: 'south_connector',
          entity_id: 'south1',
          action: 'DELETE',
          previous_state: JSON.stringify({ name: 'South 1' }),
          new_state: null,
          user_id: 'user1',
          created_at: '2026-01-02T00:00:00.000Z'
        });
        const row2 = await db('audit_logs').where('id', 'audit2').first();
        assert.strictEqual(row2.previous_state, JSON.stringify({ name: 'South 1' }));
        assert.strictEqual(row2.new_state, null);
      });

      it('adds audit_retention_duration to engines and backfills it to 90', async () => {
        await up(db);

        const engine = await db('engines').where('id', 'test-engine-id').first();
        assert.strictEqual(engine.audit_retention_duration, 90);
      });
    });

    describe('down', () => {
      it('drops the audit_logs table', async () => {
        await up(db);
        await down(db);

        const table = await db('sqlite_master').where({ type: 'table', name: 'audit_logs' }).first();
        assert.strictEqual(table, undefined);
      });

      it('removes the audit_retention_duration column from engines', async () => {
        await up(db);
        await down(db);

        const cols = (await db.raw('PRAGMA table_info(engines)')) as Array<{ name: string }>;
        assert.ok(!cols.map(c => c.name).includes('audit_retention_duration'));
      });
    });
  });

  describe('configuration workflows table', () => {
    let db: Knex;

    after(async () => {
      await db?.destroy();
    });

    beforeEach(async () => {
      await db?.destroy();
      db = knex({ client: 'better-sqlite3', connection: { filename: ':memory:' }, useNullAsDefault: true });
      await db.raw('PRAGMA foreign_keys = ON');
      await buildPreMigrationSchema(db, 'v3.10.0');

      await db('scan_modes').insert([{ id: 'sm1', name: 'Every minute', description: '', cron: '0 * * * * *' }]);
      await db('south_connectors').insert({
        id: 'south1',
        name: 'South 1',
        type: 'opcua',
        enabled: true,
        settings: JSON.stringify({})
      });
    });

    describe('up', () => {
      it('creates a local (item-creating) configuration_workflows row', async () => {
        await up(db);

        await db('configuration_workflows').insert({
          id: 'workflow1',
          name: 'workflow1',
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:00.000Z',
          created_by: 'user1',
          updated_by: 'user1',
          south_id: 'south1',
          discovery_scope: JSON.stringify({ rootNodeId: 'ns=1;s=Root' }),
          identity_key_fields: JSON.stringify(['nodeId']),
          eligibility_filter: JSON.stringify([{ field: 'type', operator: 'equals', value: 'Variable' }]),
          item_field_mapping: JSON.stringify({ name: '{{name}}', 'settings.nodeId': '{{nodeId}}' }),
          push_to_oi_analytics: false,
          scan_mode_id: 'sm1',
          enabled: true
        });

        const row = await db('configuration_workflows').where('id', 'workflow1').first();
        assert.strictEqual(row.south_id, 'south1');
        assert.strictEqual(row.discovery_scope, JSON.stringify({ rootNodeId: 'ns=1;s=Root' }));
        assert.strictEqual(row.eligibility_filter, JSON.stringify([{ field: 'type', operator: 'equals', value: 'Variable' }]));
        assert.strictEqual(Boolean(row.push_to_oi_analytics), false);
        assert.strictEqual(row.scan_mode_id, 'sm1');
        assert.strictEqual(Boolean(row.enabled), true);
      });

      it('creates a remote (push to OIAnalytics) configuration_workflows row', async () => {
        await up(db);

        await db('configuration_workflows').insert({
          id: 'workflow2',
          name: 'workflow2',
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:00.000Z',
          created_by: 'user1',
          updated_by: 'user1',
          south_id: 'south1',
          discovery_scope: JSON.stringify({ query: 'SELECT tag_name, unit, min, max FROM metadata_table' }),
          identity_key_fields: JSON.stringify(['tagName']),
          eligibility_filter: '[]',
          item_field_mapping: null,
          push_to_oi_analytics: true,
          scan_mode_id: null,
          enabled: true
        });

        const row = await db('configuration_workflows').where('id', 'workflow2').first();
        assert.strictEqual(row.item_field_mapping, null);
        assert.strictEqual(Boolean(row.push_to_oi_analytics), true);
        assert.strictEqual(row.scan_mode_id, null);
      });

      it('defaults push_to_oi_analytics to false and enabled to true', async () => {
        await up(db);

        await db('configuration_workflows').insert({
          id: 'workflow3',
          name: 'workflow3',
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:00.000Z',
          south_id: 'south1',
          discovery_scope: '{}',
          identity_key_fields: '[]',
          eligibility_filter: '[]',
          item_field_mapping: '{}'
        });

        const row = await db('configuration_workflows').where('id', 'workflow3').first();
        assert.strictEqual(Boolean(row.push_to_oi_analytics), false);
        assert.strictEqual(Boolean(row.enabled), true);
      });

      it('cascades: deleting the south connector deletes its workflows', async () => {
        await up(db);
        await db('configuration_workflows').insert({
          id: 'workflow5',
          name: 'workflow5',
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:00.000Z',
          south_id: 'south1',
          discovery_scope: '{}',
          identity_key_fields: '[]',
          eligibility_filter: '[]',
          item_field_mapping: '{}'
        });

        await db('south_connectors').where('id', 'south1').delete();

        const row = await db('configuration_workflows').where('id', 'workflow5').first();
        assert.strictEqual(row, undefined);
      });

      it('sets scan_mode_id to null instead of failing when the scan mode is deleted', async () => {
        await up(db);
        await db('configuration_workflows').insert({
          id: 'workflow6',
          name: 'workflow6',
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:00.000Z',
          south_id: 'south1',
          scan_mode_id: 'sm1',
          discovery_scope: '{}',
          identity_key_fields: '[]',
          eligibility_filter: '[]',
          item_field_mapping: '{}'
        });

        await db('scan_modes').where('id', 'sm1').delete();

        const row = await db('configuration_workflows').where('id', 'workflow6').first();
        assert.strictEqual(row.scan_mode_id, null);
      });
    });

    describe('down', () => {
      it('drops the configuration_workflows table', async () => {
        await up(db);
        await down(db);

        const table = await db('sqlite_master').where({ type: 'table', name: 'configuration_workflows' }).first();
        assert.strictEqual(table, undefined);
      });
    });
  });

  describe('south_items workflow columns', () => {
    let db: Knex;

    after(async () => {
      await db?.destroy();
    });

    beforeEach(async () => {
      await db?.destroy();
      db = knex({ client: 'better-sqlite3', connection: { filename: ':memory:' }, useNullAsDefault: true });
      await db.raw('PRAGMA foreign_keys = ON');
      await buildPreMigrationSchema(db, 'v3.10.0');

      await db('scan_modes').insert([{ id: 'sm1', name: 'Every minute', description: '', cron: '0 * * * * *' }]);
      await db('south_connectors').insert({
        id: 'south1',
        name: 'South 1',
        type: 'opcua',
        enabled: true,
        settings: JSON.stringify({})
      });
    });

    // configuration_workflows is created by this same migration's own up(), so a row referencing it can
    // only be inserted after up() has run — unlike under the old per-file migrations, where the table
    // already existed by the time this describe block's own migration was under test.
    async function seedWorkflow1(): Promise<void> {
      await db('configuration_workflows').insert({
        id: 'workflow1',
        name: 'workflow1',
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
        south_id: 'south1',
        discovery_scope: JSON.stringify({ rootNodeId: 'ns=1;s=Root' }),
        identity_key_fields: JSON.stringify(['nodeId']),
        eligibility_filter: '[]',
        item_field_mapping: JSON.stringify({ name: '{{name}}' })
      });
    }

    describe('up', () => {
      it('lets an item be owned by a workflow', async () => {
        await up(db);
        await seedWorkflow1();

        await db('south_items').insert({
          id: 'item1',
          connector_id: 'south1',
          scan_mode_id: 'sm1',
          name: 'item1',
          enabled: true,
          settings: JSON.stringify({}),
          created_by_workflow_id: 'workflow1'
        });

        const row = await db('south_items').where('id', 'item1').first();
        assert.strictEqual(row.created_by_workflow_id, 'workflow1');
        assert.strictEqual(row.disabled_reason, null);
      });

      it('lets an item be flagged with a disabled_reason', async () => {
        await up(db);

        await db('south_items').insert({
          id: 'item2',
          connector_id: 'south1',
          scan_mode_id: 'sm1',
          name: 'item2',
          enabled: false,
          settings: JSON.stringify({}),
          disabled_reason: 'No longer found by workflow "workflow1" discovery'
        });

        const row = await db('south_items').where('id', 'item2').first();
        assert.strictEqual(row.disabled_reason, 'No longer found by workflow "workflow1" discovery');
      });

      it('leaves both columns null by default (an item not owned by any workflow)', async () => {
        await up(db);

        await db('south_items').insert({
          id: 'item3',
          connector_id: 'south1',
          scan_mode_id: 'sm1',
          name: 'item3',
          enabled: true,
          settings: JSON.stringify({})
        });

        const row = await db('south_items').where('id', 'item3').first();
        assert.strictEqual(row.created_by_workflow_id, null);
        assert.strictEqual(row.disabled_reason, null);
      });

      it('clears created_by_workflow_id instead of failing when the owning workflow is deleted', async () => {
        await up(db);
        await seedWorkflow1();
        await db('south_items').insert({
          id: 'item4',
          connector_id: 'south1',
          scan_mode_id: 'sm1',
          name: 'item4',
          enabled: true,
          settings: JSON.stringify({}),
          created_by_workflow_id: 'workflow1'
        });

        await db('configuration_workflows').where('id', 'workflow1').delete();

        const row = await db('south_items').where('id', 'item4').first();
        assert.strictEqual(row.created_by_workflow_id, null);
        // the item itself survives — only the ownership link is cleared
        assert.strictEqual(row.name, 'item4');
      });
    });

    describe('down', () => {
      it('removes both columns from south_items', async () => {
        await up(db);
        await down(db);

        const cols = (await db.raw('PRAGMA table_info(south_items)')) as Array<{ name: string }>;
        const names = cols.map(c => c.name);
        assert.ok(!names.includes('created_by_workflow_id'));
        assert.ok(!names.includes('disabled_reason'));
      });
    });
  });

  describe('workflow_runs table', () => {
    let db: Knex;

    after(async () => {
      await db?.destroy();
    });

    beforeEach(async () => {
      await db?.destroy();
      db = knex({ client: 'better-sqlite3', connection: { filename: ':memory:' }, useNullAsDefault: true });
      await db.raw('PRAGMA foreign_keys = ON');
      await buildPreMigrationSchema(db, 'v3.10.0');

      await db('south_connectors').insert({
        id: 'south1',
        name: 'South 1',
        type: 'opcua',
        enabled: true,
        settings: JSON.stringify({})
      });
    });

    // configuration_workflows is created by this same migration's own up(), so seed it after up() runs.
    async function seedWorkflow1(): Promise<void> {
      await db('configuration_workflows').insert({
        id: 'workflow1',
        name: 'workflow1',
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
        south_id: 'south1',
        discovery_scope: JSON.stringify({ rootNodeId: 'ns=1;s=Root' }),
        identity_key_fields: JSON.stringify(['nodeId']),
        eligibility_filter: '[]',
        item_field_mapping: JSON.stringify({ name: '{{name}}' })
      });
    }

    describe('up', () => {
      it('creates a running row with counts defaulted to 0', async () => {
        await up(db);
        await seedWorkflow1();

        await db('workflow_runs').insert({
          id: 'run1',
          workflow_id: 'workflow1',
          trigger_type: 'manual',
          status: 'RUNNING',
          started_at: '2026-01-01T00:00:00.000Z',
          triggered_by: 'user1'
        });

        const row = await db('workflow_runs').where('id', 'run1').first();
        assert.strictEqual(row.status, 'RUNNING');
        assert.strictEqual(row.completed_at, null);
        assert.strictEqual(row.discovered_count, 0);
        assert.strictEqual(row.eligible_count, 0);
        assert.strictEqual(row.created_count, 0);
        assert.strictEqual(row.updated_count, 0);
        assert.strictEqual(row.disabled_count, 0);
        assert.strictEqual(row.pushed_count, 0);
        assert.strictEqual(row.payload, null);
        assert.strictEqual(row.error, null);
        assert.strictEqual(row.triggered_by, 'user1');
      });

      it('records a completed scheduled run with full counts and no triggered_by', async () => {
        await up(db);
        await seedWorkflow1();

        await db('workflow_runs').insert({
          id: 'run2',
          workflow_id: 'workflow1',
          trigger_type: 'scheduled',
          status: 'COMPLETED',
          started_at: '2026-01-01T00:00:00.000Z',
          completed_at: '2026-01-01T00:00:05.000Z',
          discovered_count: 120,
          eligible_count: 45,
          created_count: 3,
          updated_count: 2,
          disabled_count: 1,
          pushed_count: 5,
          payload: JSON.stringify({
            entries: [{ key: 'nodeId=a', status: 'new', record: { nodeId: 'a' }, previousMetadata: null }],
            records: []
          }),
          triggered_by: null
        });

        const row = await db('workflow_runs').where('id', 'run2').first();
        assert.strictEqual(row.trigger_type, 'scheduled');
        assert.strictEqual(row.triggered_by, null);
        assert.strictEqual(row.discovered_count, 120);
        assert.strictEqual(row.eligible_count, 45);
        assert.strictEqual(row.created_count, 3);
        assert.strictEqual(row.updated_count, 2);
        assert.strictEqual(row.disabled_count, 1);
        assert.strictEqual(row.pushed_count, 5);
        assert.deepStrictEqual(JSON.parse(row.payload), {
          entries: [{ key: 'nodeId=a', status: 'new', record: { nodeId: 'a' }, previousMetadata: null }],
          records: []
        });
      });

      it('records an errored run with a partial count and an error message', async () => {
        await up(db);
        await seedWorkflow1();

        await db('workflow_runs').insert({
          id: 'run3',
          workflow_id: 'workflow1',
          trigger_type: 'manual',
          status: 'ERRORED',
          started_at: '2026-01-01T00:00:00.000Z',
          completed_at: '2026-01-01T00:00:02.000Z',
          discovered_count: 10,
          error: 'OPCUA explore session expired, please restart the exploration',
          triggered_by: 'user1'
        });

        const row = await db('workflow_runs').where('id', 'run3').first();
        assert.strictEqual(row.status, 'ERRORED');
        assert.strictEqual(row.discovered_count, 10);
        assert.strictEqual(row.eligible_count, 0);
        assert.strictEqual(row.error, 'OPCUA explore session expired, please restart the exploration');
      });

      it('cascades: deleting the workflow deletes its run history', async () => {
        await up(db);
        await seedWorkflow1();
        await db('workflow_runs').insert({
          id: 'run4',
          workflow_id: 'workflow1',
          trigger_type: 'manual',
          status: 'RUNNING',
          started_at: '2026-01-01T00:00:00.000Z'
        });

        await db('configuration_workflows').where('id', 'workflow1').delete();

        const row = await db('workflow_runs').where('id', 'run4').first();
        assert.strictEqual(row, undefined);
      });
    });

    describe('down', () => {
      it('drops the workflow_runs table', async () => {
        await up(db);
        await down(db);

        const table = await db('sqlite_master').where({ type: 'table', name: 'workflow_runs' }).first();
        assert.strictEqual(table, undefined);
      });
    });
  });

  describe('item_point_metadata table', () => {
    let db: Knex;

    after(async () => {
      await db?.destroy();
    });

    beforeEach(async () => {
      await db?.destroy();
      db = knex({ client: 'better-sqlite3', connection: { filename: ':memory:' }, useNullAsDefault: true });
      await db.raw('PRAGMA foreign_keys = ON');
      await buildPreMigrationSchema(db, 'v3.10.0');

      await db('south_connectors').insert({
        id: 'south1',
        name: 'South 1',
        type: 'opcua',
        enabled: true,
        settings: JSON.stringify({})
      });
      await db('south_items').insert([
        { id: 'item1', connector_id: 'south1', name: 'item1', enabled: true, settings: JSON.stringify({}) },
        { id: 'item2', connector_id: 'south1', name: 'item2', enabled: true, settings: JSON.stringify({}) }
      ]);
    });

    // configuration_workflows is created by this same migration's own up(), so seed it after up() runs.
    async function seedWorkflow1(): Promise<void> {
      await db('configuration_workflows').insert({
        id: 'workflow1',
        name: 'workflow1',
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
        south_id: 'south1',
        discovery_scope: JSON.stringify({ rootNodeId: 'ns=1;s=Root' }),
        identity_key_fields: JSON.stringify(['nodeId']),
        eligibility_filter: '[]',
        item_field_mapping: JSON.stringify({ name: '{{name}}' })
      });
    }

    describe('up', () => {
      it('records a point for a discovered entry', async () => {
        await up(db);
        await seedWorkflow1();

        await db('item_point_metadata').insert({
          id: 'point1',
          workflow_id: 'workflow1',
          south_item_id: 'item1',
          discovered_entry_key: 'ns=1;s=Temperature',
          discovered_metadata: JSON.stringify({ nodeId: 'ns=1;s=Temperature', type: 'Variable' })
        });

        const row = await db('item_point_metadata').where('id', 'point1').first();
        assert.strictEqual(row.south_item_id, 'item1');
        assert.strictEqual(row.discovered_metadata, JSON.stringify({ nodeId: 'ns=1;s=Temperature', type: 'Variable' }));
        assert.strictEqual(row.status, 'active');
        assert.strictEqual(row.orphaned_at, null);
      });

      it('rejects a second point with the same (workflow_id, discovered_entry_key) — the diff lookup must stay unique', async () => {
        await up(db);
        await seedWorkflow1();
        await db('item_point_metadata').insert({
          id: 'point1',
          workflow_id: 'workflow1',
          south_item_id: 'item1',
          discovered_entry_key: 'ns=1;s=Temperature',
          discovered_metadata: '{}'
        });

        await assert.rejects(
          db('item_point_metadata').insert({
            id: 'point2',
            workflow_id: 'workflow1',
            south_item_id: 'item2',
            discovered_entry_key: 'ns=1;s=Temperature',
            discovered_metadata: '{}'
          }),
          /UNIQUE constraint failed/
        );
      });

      it('allows the same discovered_entry_key across two different workflows', async () => {
        await up(db);
        await seedWorkflow1();
        await db('configuration_workflows').insert({
          id: 'workflow2',
          name: 'workflow2',
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:00.000Z',
          south_id: 'south1',
          discovery_scope: '{}',
          identity_key_fields: '[]',
          eligibility_filter: '[]',
          item_field_mapping: JSON.stringify({})
        });

        await db('item_point_metadata').insert([
          { id: 'point1', workflow_id: 'workflow1', south_item_id: 'item1', discovered_entry_key: 'sameKey', discovered_metadata: '{}' },
          { id: 'point2', workflow_id: 'workflow2', south_item_id: 'item1', discovered_entry_key: 'sameKey', discovered_metadata: '{}' }
        ]);

        const rows = await db('item_point_metadata').where('discovered_entry_key', 'sameKey');
        assert.strictEqual(rows.length, 2);
      });

      it('marks a point orphaned without deleting it', async () => {
        await up(db);
        await seedWorkflow1();
        await db('item_point_metadata').insert({
          id: 'point1',
          workflow_id: 'workflow1',
          south_item_id: 'item1',
          discovered_entry_key: 'ns=1;s=Temperature',
          discovered_metadata: '{}'
        });

        await db('item_point_metadata').where('id', 'point1').update({ status: 'orphaned', orphaned_at: '2026-01-02T00:00:00.000Z' });

        const row = await db('item_point_metadata').where('id', 'point1').first();
        assert.strictEqual(row.status, 'orphaned');
        assert.strictEqual(row.orphaned_at, '2026-01-02T00:00:00.000Z');
      });

      it('cascades: deleting the item deletes its points', async () => {
        await up(db);
        await seedWorkflow1();
        await db('item_point_metadata').insert({
          id: 'point1',
          workflow_id: 'workflow1',
          south_item_id: 'item1',
          discovered_entry_key: 'ns=1;s=Temperature',
          discovered_metadata: '{}'
        });

        await db('south_items').where('id', 'item1').delete();

        const row = await db('item_point_metadata').where('id', 'point1').first();
        assert.strictEqual(row, undefined);
      });

      it('cascades: deleting the workflow deletes its points', async () => {
        await up(db);
        await seedWorkflow1();
        await db('item_point_metadata').insert({
          id: 'point1',
          workflow_id: 'workflow1',
          south_item_id: 'item1',
          discovered_entry_key: 'ns=1;s=Temperature',
          discovered_metadata: '{}'
        });

        await db('configuration_workflows').where('id', 'workflow1').delete();

        const row = await db('item_point_metadata').where('id', 'point1').first();
        assert.strictEqual(row, undefined);
      });
    });

    describe('down', () => {
      it('drops the item_point_metadata table', async () => {
        await up(db);
        await down(db);

        const table = await db('sqlite_master').where({ type: 'table', name: 'item_point_metadata' }).first();
        assert.strictEqual(table, undefined);
      });
    });
  });

  describe('oianalytics_messages workflow columns', () => {
    let db: Knex;

    after(async () => {
      await db?.destroy();
    });

    beforeEach(async () => {
      await db?.destroy();
      db = knex({ client: 'better-sqlite3', connection: { filename: ':memory:' }, useNullAsDefault: true });
      await db.raw('PRAGMA foreign_keys = ON');
      await buildPreMigrationSchema(db, 'v3.10.0');

      await db('south_connectors').insert({
        id: 'south1',
        name: 'South 1',
        type: 'mssql',
        enabled: true,
        settings: JSON.stringify({})
      });
    });

    // configuration_workflows/workflow_runs are created by this same migration's own up(), so seed them
    // after up() runs.
    async function seedWorkflowAndRun(): Promise<void> {
      await db('configuration_workflows').insert({
        id: 'workflow1',
        name: 'workflow1',
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
        south_id: 'south1',
        discovery_scope: JSON.stringify({ query: 'SELECT tag_name, unit FROM metadata_table' }),
        identity_key_fields: JSON.stringify(['tagName']),
        eligibility_filter: '[]',
        push_to_oi_analytics: true
      });
      await db('workflow_runs').insert({
        id: 'run1',
        workflow_id: 'workflow1',
        trigger_type: 'manual',
        status: 'RUNNING',
        started_at: '2026-01-01T00:00:00.000Z'
      });
    }

    describe('up', () => {
      it('records a configuration-workflow-result message with its run and payload', async () => {
        await up(db);
        await seedWorkflowAndRun();

        const payload = JSON.stringify({ southId: 'south1', workflowId: 'workflow1', records: [{ tagName: 'a', unit: 'C' }] });
        await db('oianalytics_messages').insert({
          id: 'message1',
          type: 'configuration-workflow-result',
          status: 'PENDING',
          created_by: 'system',
          updated_by: 'system',
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:00.000Z',
          workflow_run_id: 'run1',
          payload
        });

        const row = await db('oianalytics_messages').where('id', 'message1').first();
        assert.strictEqual(row.workflow_run_id, 'run1');
        assert.strictEqual(row.payload, payload);
      });

      it('leaves both columns null by default (an unrelated full-config/history-queries message)', async () => {
        await up(db);

        await db('oianalytics_messages').insert({
          id: 'message2',
          type: 'full-config',
          status: 'PENDING',
          created_by: 'system',
          updated_by: 'system',
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:00.000Z'
        });

        const row = await db('oianalytics_messages').where('id', 'message2').first();
        assert.strictEqual(row.workflow_run_id, null);
        assert.strictEqual(row.payload, null);
      });

      it('cascades: deleting the run deletes its message', async () => {
        await up(db);
        await seedWorkflowAndRun();
        await db('oianalytics_messages').insert({
          id: 'message1',
          type: 'configuration-workflow-result',
          status: 'PENDING',
          created_by: 'system',
          updated_by: 'system',
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:00.000Z',
          workflow_run_id: 'run1',
          payload: '{}'
        });

        await db('workflow_runs').where('id', 'run1').delete();

        const row = await db('oianalytics_messages').where('id', 'message1').first();
        assert.strictEqual(row, undefined);
      });
    });

    describe('down', () => {
      it('removes both columns from oianalytics_messages', async () => {
        await up(db);
        await down(db);

        const cols = (await db.raw('PRAGMA table_info(oianalytics_messages)')) as Array<{ name: string }>;
        const names = cols.map(c => c.name);
        assert.ok(!names.includes('workflow_run_id'));
        assert.ok(!names.includes('payload'));
      });
    });
  });

  describe('caching strategy columns', () => {
    let db: Knex;

    after(async () => {
      await db?.destroy();
    });

    beforeEach(async () => {
      await db?.destroy();
      db = knex({ client: 'better-sqlite3', connection: { filename: ':memory:' }, useNullAsDefault: true });
      await buildPreMigrationSchema(db, 'v3.10.0');
    });

    async function insertScanMode(id = 'scan-mode-1') {
      await db('scan_modes').insert({
        id,
        name: 'Every 10s',
        description: '',
        cron: '*/10 * * * * *',
        created_by: 'admin',
        updated_by: 'admin',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z'
      });
    }

    async function insertSouthConnector(id = 'south-1', type = 'modbus') {
      await db('south_connectors').insert({
        id,
        name: `Test ${type}`,
        type,
        description: '',
        enabled: 1,
        settings: '{}',
        created_by: 'admin',
        updated_by: 'admin',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z'
      });
    }

    async function insertGroup(southId: string, id = 'group-1') {
      await db('south_item_groups').insert({
        id,
        name: 'Group A',
        south_id: southId,
        scan_mode_id: 'scan-mode-1',
        max_read_interval: 3600,
        read_delay: 200,
        created_by: 'admin',
        updated_by: 'admin',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z'
      });
    }

    async function insertItem(connectorId: string, id = 'item-1') {
      await db('south_items').insert({
        id,
        name: 'Item A',
        enabled: 1,
        connector_id: connectorId,
        scan_mode_id: null,
        settings: '{}',
        sync_with_group: 1,
        max_read_interval: null,
        read_delay: null,
        created_by: 'admin',
        updated_by: 'admin',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z'
      });
    }

    it('runs end-to-end on a realistic pre-3.10.0 schema', async () => {
      await up(db); // must not throw
    });

    it('adds caching_strategy to south_item_groups', async () => {
      await up(db);
      const cols = await columnNames(db, 'south_item_groups');
      assert.ok(cols.includes('caching_strategy'), 'south_item_groups.caching_strategy added');
    });

    it('adds caching_strategy, threshold_type, threshold, range_low, range_high, max_caching_interval to south_items', async () => {
      await up(db);
      const cols = await columnNames(db, 'south_items');
      assert.ok(cols.includes('caching_strategy'), 'south_items.caching_strategy added');
      assert.ok(cols.includes('threshold_type'), 'south_items.threshold_type added');
      assert.ok(cols.includes('threshold'), 'south_items.threshold added');
      assert.ok(cols.includes('range_low'), 'south_items.range_low added');
      assert.ok(cols.includes('range_high'), 'south_items.range_high added');
      assert.ok(cols.includes('max_caching_interval'), 'south_items.max_caching_interval added');
    });

    it("backfills caching_strategy to 'allValues' for items and groups of an IoT-family connector (modbus)", async () => {
      await insertScanMode();
      await insertSouthConnector('south-1', 'modbus');
      await insertGroup('south-1');
      await insertItem('south-1');

      await up(db);

      const group = await db('south_item_groups').where('id', 'group-1').first();
      assert.strictEqual(group.caching_strategy, 'allValues', "IoT-family connector's group row defaults to 'allValues'");

      const item = await db('south_items').where('id', 'item-1').first();
      assert.strictEqual(item.caching_strategy, 'allValues', "IoT-family connector's item row defaults to 'allValues'");
    });

    it('backfills caching_strategy for every IoT-family type (opcua, modbus, ads, opc, s7, mqtt)', async () => {
      await insertScanMode();
      const iotTypes = ['opcua', 'modbus', 'ads', 'opc', 's7', 'mqtt'];
      for (const [index, type] of iotTypes.entries()) {
        const southId = `south-${type}-${index}`;
        await insertSouthConnector(southId, type);
        await insertGroup(southId, `group-${type}-${index}`);
        await insertItem(southId, `item-${type}-${index}`);
      }

      await up(db);

      for (const [index, type] of iotTypes.entries()) {
        const group = await db('south_item_groups').where('id', `group-${type}-${index}`).first();
        assert.strictEqual(group.caching_strategy, 'allValues', `${type} group row defaults to 'allValues'`);
        const item = await db('south_items').where('id', `item-${type}-${index}`).first();
        assert.strictEqual(item.caching_strategy, 'allValues', `${type} item row defaults to 'allValues'`);
      }
    });

    it('leaves caching_strategy null for items and groups of a non-IoT-family connector (sqlite)', async () => {
      await insertScanMode();
      await insertSouthConnector('south-1', 'sqlite');
      await insertGroup('south-1');
      await insertItem('south-1');

      await up(db);

      const group = await db('south_item_groups').where('id', 'group-1').first();
      assert.strictEqual(group.caching_strategy, null, "non-IoT-family connector's group row stays null");

      const item = await db('south_items').where('id', 'item-1').first();
      assert.strictEqual(item.caching_strategy, null, "non-IoT-family connector's item row stays null");
    });

    it('leaves threshold_type, threshold, range_low, range_high, max_caching_interval null for all rows', async () => {
      await insertScanMode();
      await insertSouthConnector('south-1', 'modbus');
      await insertGroup('south-1');
      await insertItem('south-1');

      await up(db);

      const item = await db('south_items').where('id', 'item-1').first();
      assert.strictEqual(item.threshold_type, null);
      assert.strictEqual(item.threshold, null);
      assert.strictEqual(item.range_low, null);
      assert.strictEqual(item.range_high, null);
      assert.strictEqual(item.max_caching_interval, null);
    });

    it('drops all added columns on down', async () => {
      await up(db);
      await down(db);

      const groupCols = await columnNames(db, 'south_item_groups');
      assert.ok(!groupCols.includes('caching_strategy'), 'south_item_groups.caching_strategy removed');

      const itemCols = await columnNames(db, 'south_items');
      assert.ok(!itemCols.includes('caching_strategy'), 'south_items.caching_strategy removed');
      assert.ok(!itemCols.includes('threshold_type'), 'south_items.threshold_type removed');
      assert.ok(!itemCols.includes('threshold'), 'south_items.threshold removed');
      assert.ok(!itemCols.includes('range_low'), 'south_items.range_low removed');
      assert.ok(!itemCols.includes('range_high'), 'south_items.range_high removed');
      assert.ok(!itemCols.includes('max_caching_interval'), 'south_items.max_caching_interval removed');
    });

    it('down preserves existing rows', async () => {
      await insertScanMode();
      await insertSouthConnector('south-1', 'modbus');
      await insertGroup('south-1');
      await insertItem('south-1');

      await up(db);
      await down(db);

      const group = await db('south_item_groups').where('id', 'group-1').first();
      assert.ok(group, 'group row survives the rollback');
      const item = await db('south_items').where('id', 'item-1').first();
      assert.ok(item, 'item row survives the rollback');
    });

    it('does not fail with a FOREIGN KEY constraint error when group_items rows still reference south_item_groups/south_items, inside a real transaction', async () => {
      // Reproduces the production migration runner, which always wraps each migration file's up()/down() in a
      // knex.transaction(...). Inside that transaction, knex's schema builder cannot toggle
      // `PRAGMA foreign_keys` around a dropColumn()-driven table rebuild, so DROP TABLE south_items/
      // south_item_groups would fail while group_items still holds rows referencing them.
      await insertScanMode();
      await insertSouthConnector('south-1', 'modbus');
      await insertGroup('south-1');
      await insertItem('south-1');
      await db('group_items').insert({ group_id: 'group-1', item_id: 'item-1' });

      await db.transaction(async trx => {
        await up(trx);
        await down(trx);
      });

      const groupItemsRows = await db('group_items').select('*');
      assert.deepStrictEqual(groupItemsRows, [{ group_id: 'group-1', item_id: 'item-1' }], 'group_items row is preserved');
    });
  });
});
