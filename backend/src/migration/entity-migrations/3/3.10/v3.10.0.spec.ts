import assert from 'node:assert/strict';
import path from 'node:path';
import { after, afterEach, before, beforeEach, describe, it, mock } from 'node:test';

import { Knex } from 'knex';

import { COMPRESSED_FILE_OPTIONS, toOIAnalyticsItemFileOptions } from '../../../../service/config-transfer/config-upgrades/3.10/v3.10.0';
import {
  buildSchemaBefore,
  createMigrationFileCloneHarness,
  createMigrationSchemaHarness
} from '../../../../tests/utils/migration-test-utils';
import {
  addContentEndpointSetting,
  addDatabaseConnectionSettings,
  addEmptyIntervalStrategies,
  addHttpsSettings,
  addItemAndWorkflowDescriptions,
  addOIAnalyticsReferenceProcess,
  addOPCUATimeoutsAndSubscriptionSettings,
  addRegistrationPermissions,
  convertFileWriterLinks,
  convertOIAnalyticsSouths,
  down,
  groupOIAnalyticsOptions,
  mergeSetpointsIntoRecordLists,
  moveCompressionToNorths,
  moveFilenamePrefixAndSuffixToTransformers,
  moveSqlSerializationToTransformers,
  renameAnyDataType,
  replaceCsvAndJsonReaders,
  replaceCsvAndJsonWriters,
  replaceFileTransformer,
  replaceIsoAndIgnoreTransformers,
  replaceRawResampling,
  replaceTimeValuesByRecordLists,
  STEPS,
  up
} from './v3.10.0';

const ENTITY_MIGRATIONS_ROOT = path.resolve(__dirname, '..', '..');
const NOW = '2024-01-01T00:00:00.000Z';

async function columnNames(db: Knex, table: string): Promise<Array<string>> {
  const cols = (await db.raw(`PRAGMA table_info(${table})`)) as Array<{ name: string }>;
  return cols.map(c => c.name);
}

const caching = {
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
const HTTPS_COLUMNS = [
  'https_enabled',
  'https_certificate_source',
  'https_certificate_id',
  'https_certificate_path',
  'https_private_key_path'
];

const oldOptions = {
  pointIdColumn: 'reference',
  timestampColumn: 'time',
  valueColumn: 'measure',
  timestampSettings: { type: 'string', timezone: 'Europe/Paris', format: 'dd/MM/yyyy HH:mm', locale: 'fr-FR' },
  precision: 's',
  referenceProcess: 'value.toUpperCase()'
};

const groupedOptions = {
  reference: { referenceField: 'reference', referenceProcess: 'value.toUpperCase()' },
  timestamp: {
    timestampField: 'time',
    sourceType: 'string',
    precision: 's',
    timezone: 'Europe/Paris',
    format: 'dd/MM/yyyy HH:mm',
    locale: 'fr-FR'
  },
  value: { valueField: 'measure', valueProcess: null }
};

const serialization = (filename: string) => ({
  type: 'csv',
  filename,
  delimiter: 'SEMI_COLON',
  compression: true,
  outputTimestampFormat: 'yyyy-MM-dd',
  outputTimezone: 'Europe/Paris'
});

const itemSettings = (filename: string) => JSON.stringify({ endpoint: '/api', queryParams: [], serialization: serialization(filename) });

/** Builds the schema and data the steps of the migration before `step` leave (on the data of the previous migrations) */
async function buildSchemaBeforeStep(step: (knex: Knex) => Promise<void>, db: Knex): Promise<void> {
  await buildSchemaBefore(ENTITY_MIGRATIONS_ROOT, 'v3.10.0.ts', db);
  for (const previousStep of STEPS.slice(0, STEPS.indexOf(step))) {
    await previousStep(db);
  }
}

/** Runs the steps of the migration from `step` on */
async function runStepsFrom(step: (knex: Knex) => Promise<void>, db: Knex): Promise<void> {
  for (const nextStep of STEPS.slice(STEPS.indexOf(step))) {
    await nextStep(db);
  }
}

describe('Entity migration v3.10.0', () => {
  // The pre-migration schema is built once, each test gets its own copy of it
  const harness = createMigrationFileCloneHarness({
    buildSchema: db => buildSchemaBefore(ENTITY_MIGRATIONS_ROOT, 'v3.10.0.ts', db)
  });
  before(() => harness.before());
  beforeEach(() => harness.beforeEach());
  afterEach(() => harness.afterEach());
  after(() => harness.after());

  describe('scan modes scheduling / certificate chain', () => {
    let db: Knex;

    beforeEach(async () => {
      db = harness.getDb();
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

    beforeEach(async () => {
      db = harness.getDb();

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

      await moveSqlSerializationToTransformers(db);

      const rows = await db('transformers').select('id').where('function_name', 'record-list-to-csv');
      assert.strictEqual(rows.length, 1);
      assert.strictEqual(rows[0].id, 'existing-record-list-to-csv');
    });

    it('should rewrite dateTimeFields+serialization into trackingInstant for every item', async () => {
      await moveSqlSerializationToTransformers(db);

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
      await moveSqlSerializationToTransformers(db);

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
        keepOtherFields: true,
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
      await moveSqlSerializationToTransformers(db);

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
      await moveSqlSerializationToTransformers(db);

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
      await moveSqlSerializationToTransformers(db);

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
      await moveSqlSerializationToTransformers(db);

      const recordListToCsv = await db('transformers').where('function_name', 'record-list-to-csv').first();
      const rows = await db('north_transformers as nt')
        .join('north_transformers_items as nti', 'nti.id', 'nt.id')
        .where('nt.north_id', 'north5')
        .select('nt.transformer_id', 'nti.item_id');
      assert.strictEqual(rows.length, 3); // item1, item2, item3
      assert.ok(rows.every(r => r.transformer_id === recordListToCsv.id));
    });

    it('should apply the same treatment to history queries', async () => {
      await moveSqlSerializationToTransformers(db);

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
      await moveSqlSerializationToTransformers(db);

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
        keepOtherFields: true,
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
      await moveSqlSerializationToTransformers(db);

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
      await moveSqlSerializationToTransformers(db);

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

    describe('ODBC and OLEDB items', () => {
      const dateTimeFields = [
        { fieldName: 'other', useAsReference: false, type: 'unix-epoch-ms', timezone: null, format: null, locale: null },
        {
          fieldName: 'timestamp',
          useAsReference: true,
          type: 'string',
          timezone: 'Europe/Paris',
          format: 'yyyy-MM-dd HH:mm:ss',
          locale: 'en-US'
        }
      ];
      const serialization = {
        type: 'csv',
        filename: 'odbc.csv',
        delimiter: 'SEMI_COLON',
        compression: false,
        outputTimestampFormat: 'yyyy-MM-dd HH:mm',
        outputTimezone: 'UTC'
      };
      const isoReferenceField = {
        fieldName: 'timestamp',
        columnName: null,
        dataType: 'datetime',
        fieldProcess: null,
        datetimeSettings: {
          inputType: 'iso-string',
          inputTimezone: null,
          inputFormat: null,
          inputLocale: null,
          outputType: 'string',
          outputTimezone: 'UTC',
          outputFormat: 'yyyy-MM-dd HH:mm',
          outputLocale: null
        }
      };
      const transformerFieldsOf = async (itemId: string): Promise<Array<{ fieldName: string }>> => {
        const row = await db('north_transformers as nt')
          .join('north_transformers_items as nti', 'nti.id', 'nt.id')
          .where({ 'nt.north_id': 'north1', 'nti.item_id': itemId })
          .first('nt.options');
        return JSON.parse(row.options).fields;
      };

      beforeEach(async () => {
        await db('south_connectors').insert([
          { id: 'odbc-agent', name: 'ODBC agent', type: 'odbc', enabled: true, settings: JSON.stringify({ remoteAgent: true }) },
          { id: 'odbc-local', name: 'ODBC local', type: 'odbc', enabled: true, settings: JSON.stringify({ remoteAgent: false }) },
          { id: 'oledb', name: 'OLEDB', type: 'oledb', enabled: true, settings: JSON.stringify({ agentUrl: 'http://localhost:2224' }) }
        ]);
        await db('south_items').insert(
          ['odbc-agent', 'odbc-local', 'oledb'].map(southId => ({
            id: `${southId}-item`,
            connector_id: southId,
            scan_mode_id: 'sm1',
            name: `${southId}-item`,
            enabled: true,
            settings: JSON.stringify({ query: 'SELECT * FROM t', dateTimeFields, serialization })
          }))
        );
      });

      it('should rewrite their settings into trackingInstant', async () => {
        await moveSqlSerializationToTransformers(db);

        for (const southId of ['odbc-agent', 'odbc-local', 'oledb']) {
          const item = await db('south_items').where('id', `${southId}-item`).first();
          assert.deepStrictEqual(JSON.parse(item.settings), {
            query: 'SELECT * FROM t',
            trackingInstant: {
              trackInstant: true,
              fieldName: 'timestamp',
              dateTimeInput: { type: 'string', timezone: 'Europe/Paris', format: 'yyyy-MM-dd HH:mm:ss', locale: 'en-US' }
            }
          });
        }
      });

      it('should only format the reference field, sent as an ISO string, when queried through the remote agent', async () => {
        await moveSqlSerializationToTransformers(db);

        assert.deepStrictEqual(await transformerFieldsOf('odbc-agent-item'), [isoReferenceField]);
        assert.deepStrictEqual(await transformerFieldsOf('oledb-item'), [isoReferenceField]);
      });

      it('should format every date time field of an ODBC item queried locally', async () => {
        await moveSqlSerializationToTransformers(db);

        assert.deepStrictEqual(
          (await transformerFieldsOf('odbc-local-item')).map(field => field.fieldName),
          ['other', 'timestamp']
        );
      });

      it('should only format the reference field of an ODBC history query through the remote agent', async () => {
        await db('history_queries').insert({
          id: 'hq-odbc',
          name: 'HQ ODBC',
          start_time: NOW,
          end_time: NOW,
          south_type: 'odbc',
          north_type: 'file-writer',
          south_settings: JSON.stringify({ remoteAgent: true }),
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
          id: 'hitem-odbc',
          history_id: 'hq-odbc',
          name: 'hitem-odbc',
          enabled: true,
          settings: JSON.stringify({ query: 'SELECT * FROM t', dateTimeFields, serialization })
        });

        await moveSqlSerializationToTransformers(db);

        const row = await db('history_query_transformers').where('history_id', 'hq-odbc').first();
        assert.deepStrictEqual(JSON.parse(row.options).fields, [isoReferenceField]);
      });
    });

    it('down() is a no-op (irreversible)', async () => {
      await up(db);
      await assert.doesNotReject(down(db));
    });
  });

  describe('audit trail', () => {
    let db: Knex;

    beforeEach(async () => {
      db = harness.getDb();

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

    beforeEach(async () => {
      db = harness.getDb();
      await db.raw('PRAGMA foreign_keys = ON');

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

    beforeEach(async () => {
      db = harness.getDb();
      await db.raw('PRAGMA foreign_keys = ON');

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

    beforeEach(async () => {
      db = harness.getDb();
      await db.raw('PRAGMA foreign_keys = ON');

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

    beforeEach(async () => {
      db = harness.getDb();
      await db.raw('PRAGMA foreign_keys = ON');

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

    beforeEach(async () => {
      db = harness.getDb();
      await db.raw('PRAGMA foreign_keys = ON');

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

    beforeEach(async () => {
      db = harness.getDb();
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

  describe('OIAnalytics transformers referenceProcess option', () => {
    let db: Knex;

    beforeEach(async () => {
      db = harness.getDb();

      await db('scan_modes').insert({ id: 'sm1', name: 'sm1', description: '', cron: '* * * * * *' });
      const cachingDefaults = {
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
      await db('north_connectors').insert({
        ...cachingDefaults,
        id: 'north1',
        name: 'North 1',
        type: 'oianalytics',
        enabled: true,
        settings: '{}'
      });
      await db('history_queries').insert({
        ...cachingDefaults,
        id: 'hq1',
        name: 'HQ 1',
        start_time: NOW,
        end_time: NOW,
        south_type: 'opcua',
        north_type: 'oianalytics',
        south_settings: '{}',
        north_settings: '{}'
      });
      await db('transformers').insert([
        {
          id: 'tv-to-oia',
          type: 'standard',
          function_name: 'time-values-to-oianalytics',
          input_type: 'time-values',
          output_type: 'oianalytics'
        },
        { id: 'json-to-oia', type: 'standard', function_name: 'json-to-oianalytics', input_type: 'any', output_type: 'oianalytics' },
        { id: 'tv-to-csv', type: 'standard', function_name: 'time-values-to-csv', input_type: 'time-values', output_type: 'any' }
      ]);
    });

    async function insertNorthTransformer(id: string, transformerId: string, options: string | null): Promise<void> {
      await db('north_transformers').insert({ id, north_id: 'north1', transformer_id: transformerId, options, source_type: 'south' });
    }

    async function optionsOf(table: string, id: string): Promise<unknown> {
      const row = await db(table).where('id', id).first();
      return row.options === null ? null : JSON.parse(row.options);
    }

    it('adds referenceProcess: null to north and history query OIAnalytics transformers', async () => {
      await insertNorthTransformer('nt-tv', 'tv-to-oia', JSON.stringify({ precision: 's' }));
      await insertNorthTransformer('nt-json', 'json-to-oia', JSON.stringify({ rowIteratorPath: '$[*]', pointId: '$[*].id' }));
      await insertNorthTransformer('nt-null', 'tv-to-oia', null);
      await db('history_query_transformers').insert({
        id: 'hqt-tv',
        history_id: 'hq1',
        transformer_id: 'tv-to-oia',
        options: '{"precision":"ms"}'
      });

      await addOIAnalyticsReferenceProcess(db);

      assert.deepStrictEqual(await optionsOf('north_transformers', 'nt-tv'), { precision: 's', referenceProcess: null });
      assert.deepStrictEqual(await optionsOf('north_transformers', 'nt-json'), {
        rowIteratorPath: '$[*]',
        pointId: '$[*].id',
        referenceProcess: null
      });
      assert.deepStrictEqual(await optionsOf('north_transformers', 'nt-null'), { referenceProcess: null });
      assert.deepStrictEqual(await optionsOf('history_query_transformers', 'hqt-tv'), { precision: 'ms', referenceProcess: null });
    });

    it('leaves other transformers and already migrated options untouched', async () => {
      await insertNorthTransformer('nt-csv', 'tv-to-csv', JSON.stringify({ pointIdProcess: null }));
      await insertNorthTransformer('nt-done', 'tv-to-oia', JSON.stringify({ precision: 'ms', referenceProcess: 'value.toUpperCase()' }));

      await addOIAnalyticsReferenceProcess(db);

      assert.deepStrictEqual(await optionsOf('north_transformers', 'nt-csv'), { pointIdProcess: null });
      assert.deepStrictEqual(await optionsOf('north_transformers', 'nt-done'), {
        precision: 'ms',
        referenceProcess: 'value.toUpperCase()'
      });
    });
  });
});

describe('Entity migration v3.10.0: addRegistrationPermissions', () => {
  const harness = createMigrationSchemaHarness({
    buildSchema: db => buildSchemaBeforeStep(addRegistrationPermissions, db)
  });
  let db: Knex;

  before(() => harness.before());
  after(() => harness.after());

  const CONFIGURATION_PERMISSIONS = {
    command_update_engine_settings: true,
    command_create_scan_mode: true,
    command_update_scan_mode: true,
    command_delete_scan_mode: true,
    command_create_ip_filter: true,
    command_update_ip_filter: true,
    command_delete_ip_filter: true,
    command_create_certificate: true,
    command_update_certificate: true,
    command_delete_certificate: true,
    command_create_south: true,
    command_update_south: true,
    command_delete_south: true,
    command_create_or_update_south_items_from_csv: true,
    command_create_north: true,
    command_update_north: true,
    command_delete_north: true,
    command_create_history_query: true,
    command_update_history_query: true,
    command_delete_history_query: true,
    command_create_or_update_history_items_from_csv: true,
    command_create_custom_transformer: true,
    command_update_custom_transformer: true,
    command_delete_custom_transformer: true
  };

  beforeEach(async () => {
    await harness.beforeEach();
    db = harness.getDb();
  });
  afterEach(() => harness.afterEach());

  async function importConfigurationAfterMigration(permissions: Record<string, boolean | null>): Promise<number> {
    await db('registrations').insert({ id: 'registration-id', host: 'http://localhost:4200', status: 'REGISTERED', ...permissions });
    await addRegistrationPermissions(db);
    return (await db('registrations').where('id', 'registration-id').first()).command_import_configuration;
  }

  it('should add the new permissions', async () => {
    await addRegistrationPermissions(db);

    const columns = await columnNames(db, 'registrations');
    assert.ok(columns.includes('command_import_configuration'));
    assert.ok(columns.includes('command_dump_memory'));
    assert.ok(columns.includes('command_retrieve_logs_database'));
  });

  it('should grant the dump-memory and retrieve-logs-database permissions', async () => {
    await db('registrations').insert({ id: 'registration-id', host: 'http://localhost:4200', status: 'REGISTERED' });

    await addRegistrationPermissions(db);

    const registration = await db('registrations').where('id', 'registration-id').first();
    assert.strictEqual(registration.command_dump_memory, 1);
    assert.strictEqual(registration.command_retrieve_logs_database, 1);
  });

  it('should grant the import-configuration permission when every configuration permission is granted', async () => {
    assert.strictEqual(
      await importConfigurationAfterMigration({
        ...CONFIGURATION_PERMISSIONS,
        // not changing the configuration
        command_update_version: false,
        command_update_registration_settings: false,
        command_test_south_connection: false,
        command_setpoint: false,
        command_update_north_cache_content: false
      }),
      1
    );
  });

  for (const permission of Object.keys(CONFIGURATION_PERMISSIONS)) {
    it(`should not grant the import-configuration permission when ${permission} is not granted`, async () => {
      assert.strictEqual(await importConfigurationAfterMigration({ ...CONFIGURATION_PERMISSIONS, [permission]: false }), 0);
    });
  }

  it('should not grant the import-configuration permission when a configuration permission is not set', async () => {
    assert.strictEqual(await importConfigurationAfterMigration({ ...CONFIGURATION_PERMISSIONS, command_create_south: null }), 0);
  });

  it('should remove the new permissions', async () => {
    await runStepsFrom(addRegistrationPermissions, db);
    await down(db);

    const columns = await columnNames(db, 'registrations');
    assert.ok(!columns.includes('command_import_configuration'));
    assert.ok(!columns.includes('command_dump_memory'));
    assert.ok(!columns.includes('command_retrieve_logs_database'));
  });
});

describe('Entity migration v3.10.0: replaceRawResampling', () => {
  const harness = createMigrationSchemaHarness({
    buildSchema: db => buildSchemaBeforeStep(replaceRawResampling, db)
  });
  let db: Knex;

  before(() => harness.before());
  after(() => harness.after());

  beforeEach(async () => {
    await harness.beforeEach();
    db = harness.getDb();
    await db('scan_modes').insert({ id: 'sm1', name: 'Every minute', description: '', cron: '0 * * * * *' });
    await db('south_connectors').insert([
      { id: 'opcua1', name: 'OPCUA', type: 'opcua', enabled: true, settings: '{}' },
      { id: 'opc1', name: 'OPC', type: 'opc', enabled: true, settings: '{}' },
      { id: 'mqtt1', name: 'MQTT', type: 'mqtt', enabled: true, settings: '{}' }
    ]);
    await db('history_queries').insert([historyQuery('hq-opcua', 'opcua'), historyQuery('hq-opc', 'opc')]);
  });
  afterEach(() => harness.afterEach());

  async function settingsOf(table: string, id: string): Promise<unknown> {
    return JSON.parse((await db(table).where('id', id).first()).settings);
  }

  function historyQuery(id: string, southType: string) {
    return {
      id,
      name: id,
      start_time: '2026-01-01T00:00:00.000Z',
      end_time: '2026-01-02T00:00:00.000Z',
      south_type: southType,
      north_type: 'console',
      south_settings: '{}',
      north_settings: '{}',
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
  }

  function southItem(id: string, connectorId: string, settings: object) {
    return { id, connector_id: connectorId, scan_mode_id: 'sm1', name: id, enabled: true, settings: JSON.stringify(settings) };
  }

  function historyItem(id: string, historyId: string, settings: object) {
    return { id, history_id: historyId, name: id, enabled: true, settings: JSON.stringify(settings) };
  }

  it('should replace the raw resampling of OPC UA and OPC items with none', async () => {
    await db('south_items').insert([
      southItem('opcua-raw', 'opcua1', { nodeId: 'ns=1', mode: 'ha', haMode: { aggregate: 'average', resampling: 'raw' } }),
      southItem('opcua-1min', 'opcua1', { nodeId: 'ns=2', mode: 'ha', haMode: { aggregate: 'average', resampling: '1min' } }),
      southItem('opcua-da', 'opcua1', { nodeId: 'ns=3', mode: 'da', timestampOrigin: 'oibus' }),
      southItem('opc-raw', 'opc1', { nodeId: 'a', aggregate: 'average', resampling: 'raw' }),
      southItem('mqtt-raw', 'mqtt1', { topic: 't', resampling: 'raw' })
    ]);
    await db('history_items').insert([
      historyItem('hq-opcua-raw', 'hq-opcua', { nodeId: 'ns=1', mode: 'ha', haMode: { aggregate: 'count', resampling: 'raw' } }),
      historyItem('hq-opc-raw', 'hq-opc', { nodeId: 'a', aggregate: 'count', resampling: 'raw' }),
      historyItem('hq-opc-10s', 'hq-opc', { nodeId: 'b', aggregate: 'count', resampling: '10s' })
    ]);

    await replaceRawResampling(db);

    assert.deepStrictEqual(await settingsOf('south_items', 'opcua-raw'), {
      nodeId: 'ns=1',
      mode: 'ha',
      haMode: { aggregate: 'average', resampling: 'none' }
    });
    assert.deepStrictEqual(await settingsOf('south_items', 'opcua-1min'), {
      nodeId: 'ns=2',
      mode: 'ha',
      haMode: { aggregate: 'average', resampling: '1min' }
    });
    assert.deepStrictEqual(await settingsOf('south_items', 'opcua-da'), { nodeId: 'ns=3', mode: 'da', timestampOrigin: 'oibus' });
    assert.deepStrictEqual(await settingsOf('south_items', 'opc-raw'), { nodeId: 'a', aggregate: 'average', resampling: 'none' });
    assert.deepStrictEqual(await settingsOf('south_items', 'mqtt-raw'), { topic: 't', resampling: 'raw' });
    assert.deepStrictEqual(await settingsOf('history_items', 'hq-opcua-raw'), {
      nodeId: 'ns=1',
      mode: 'ha',
      haMode: { aggregate: 'count', resampling: 'none' }
    });
    assert.deepStrictEqual(await settingsOf('history_items', 'hq-opc-raw'), { nodeId: 'a', aggregate: 'count', resampling: 'none' });
    assert.deepStrictEqual(await settingsOf('history_items', 'hq-opc-10s'), { nodeId: 'b', aggregate: 'count', resampling: '10s' });
  });
});

describe('Entity migration v3.10.0: addHttpsSettings', () => {
  const harness = createMigrationSchemaHarness({
    buildSchema: db => buildSchemaBeforeStep(addHttpsSettings, db)
  });
  let db: Knex;

  before(() => harness.before());
  after(() => harness.after());

  beforeEach(async () => {
    await harness.beforeEach();
    db = harness.getDb();
    await db('engines').insert({
      id: 'test-engine-id',
      name: 'Test Engine',
      port: 2223,
      auth_token_duration: '7d',
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
  afterEach(() => harness.afterEach());

  it('should add the https columns to engines, keeping existing installs on HTTP', async () => {
    await addHttpsSettings(db);

    const cols = await columnNames(db, 'engines');
    for (const column of HTTPS_COLUMNS) {
      assert.ok(cols.includes(column), `engines.${column} added`);
    }
    const row = await db('engines').where('id', 'test-engine-id').first();
    assert.strictEqual(row.https_enabled, 0);
    assert.strictEqual(row.https_certificate_source, 'store');
    assert.strictEqual(row.https_certificate_id, null);
    assert.strictEqual(row.https_certificate_path, null);
    assert.strictEqual(row.https_private_key_path, null);
  });

  it('should drop the https columns on down', async () => {
    await runStepsFrom(addHttpsSettings, db);
    await down(db);

    const cols = await columnNames(db, 'engines');
    for (const column of HTTPS_COLUMNS) {
      assert.ok(!cols.includes(column), `engines.${column} removed`);
    }
  });
});

describe('Entity migration v3.10.0: addContentEndpointSetting', () => {
  const harness = createMigrationSchemaHarness({
    buildSchema: db => buildSchemaBeforeStep(addContentEndpointSetting, db)
  });
  let db: Knex;

  before(() => harness.before());
  after(() => harness.after());

  beforeEach(async () => {
    await harness.beforeEach();
    db = harness.getDb();
    await db('engines').insert({
      id: 'test-engine-id',
      name: 'Test Engine',
      port: 2223,
      auth_token_duration: '7d',
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
    await db('scan_modes').insert({ id: 'sm1', name: 'sm1', description: '', cron: '* * * * * *' });
    await db('north_connectors').insert({ ...caching, id: 'north1', name: 'North 1', type: 'console', enabled: true, settings: '{}' });
    await db('transformers').insert({ id: 'iso', type: 'standard', function_name: 'iso', input_type: 'any', output_type: 'any' });
  });
  afterEach(() => harness.afterEach());

  const enabled = async () => (await db('engines').where('id', 'test-engine-id').first()).enable_content_endpoint;

  it('should keep the content endpoint disabled when no North transformer applies to the OIBus API', async () => {
    await db('north_transformers').insert({ id: 'nt1', north_id: 'north1', transformer_id: 'iso', options: '{}', source_type: 'south' });

    await addContentEndpointSetting(db);

    assert.ok((await columnNames(db, 'engines')).includes('enable_content_endpoint'));
    assert.strictEqual(await enabled(), 0);
  });

  it('should enable the content endpoint when a North transformer applies to the OIBus API', async () => {
    await db('north_transformers').insert({
      id: 'nt1',
      north_id: 'north1',
      transformer_id: 'iso',
      options: '{}',
      source_type: 'oibus-api',
      source_api_data_source_id: 'my-source'
    });

    await addContentEndpointSetting(db);

    assert.strictEqual(await enabled(), 1);
  });

  it('should drop the column on down', async () => {
    await runStepsFrom(addContentEndpointSetting, db);
    await down(db);

    assert.ok(!(await columnNames(db, 'engines')).includes('enable_content_endpoint'));
  });
});

describe('Entity migration v3.10.0: replaceTimeValuesByRecordLists', () => {
  const harness = createMigrationSchemaHarness({
    buildSchema: db => buildSchemaBeforeStep(replaceTimeValuesByRecordLists, db)
  });
  let db: Knex;

  const standard = (id: string, functionName: string, inputType: string, outputType: string) => ({
    id,
    type: 'standard',
    function_name: functionName,
    input_type: inputType,
    output_type: outputType
  });
  const optionsOf = async (table: string, id: string) => {
    const row = await db(table).where('id', id).first('transformer_id', 'options');
    return { transformerId: row.transformer_id as string, options: JSON.parse(row.options) };
  };

  before(() => harness.before());
  after(() => harness.after());

  beforeEach(async () => {
    await harness.beforeEach();
    db = harness.getDb();
    await db('scan_modes').insert([{ id: 'sm1', name: 'Every minute', description: '', cron: '0 * * * * *' }]);
    await db('north_connectors').insert({
      id: 'north1',
      name: 'North 1',
      type: 'file-writer',
      enabled: true,
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
    });
    await db('history_queries').insert({
      id: 'hq1',
      name: 'HQ 1',
      start_time: NOW,
      end_time: NOW,
      south_type: 'opcua',
      north_type: 'file-writer',
      south_settings: JSON.stringify({}),
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
    // Replace the standard transformers seeded by the previous migrations with known ids
    await db('transformers').where('type', 'standard').del();
    await db('transformers').insert([
      standard('csv', 'record-list-to-csv', 'record-list', 'any'),
      standard('tvCsv', 'time-values-to-csv', 'time-values', 'any'),
      standard('tvOia', 'time-values-to-oianalytics', 'time-values', 'oianalytics'),
      standard('tvMqtt', 'time-values-to-mqtt', 'time-values', 'mqtt'),
      standard('tvModbus', 'time-values-to-modbus', 'time-values', 'modbus'),
      standard('tvJson', 'time-values-to-json', 'time-values', 'any'),
      standard('csvTv', 'csv-to-time-values', 'any', 'time-values'),
      {
        id: 'custom1',
        type: 'custom',
        input_type: 'time-values',
        output_type: 'any',
        name: 'custom 1',
        custom_code: '',
        language: 'javascript'
      },
      {
        id: 'custom2',
        type: 'custom',
        input_type: 'any',
        output_type: 'time-values',
        name: 'custom 2',
        custom_code: '',
        language: 'javascript'
      }
    ]);
    const link = (id: string, transformerId: string, options: object) => ({
      id,
      north_id: 'north1',
      transformer_id: transformerId,
      options: JSON.stringify(options),
      source_type: 'oianalytics-setpoint'
    });
    await db('north_transformers').insert([
      link('ntCsv', 'csv', { filename: 'sql.csv' }),
      link('ntCsvKept', 'csv', { filename: 'sql.csv', keepOtherFields: false }),
      link('ntTvCsv', 'tvCsv', {
        filename: 'values.csv',
        encoding: 'UTF_8',
        header: true,
        delimiter: 'SEMI_COLON',
        newline: 'LF',
        quoteChar: 'NONE',
        escapeChar: 'DOUBLE_QUOTE',
        pointIdColumnTitle: 'Ref',
        valueColumnTitle: 'Val',
        timestampColumnTitle: 'Date',
        timestampType: 'string',
        timestampFormat: 'yyyy-MM-dd',
        timezone: 'Europe/Paris',
        pointIdProcess: 'value.toUpperCase()'
      }),
      link('ntOia', 'tvOia', { precision: 's', referenceProcess: null }),
      link('ntMqtt', 'tvMqtt', { mapping: [{ pointId: 'p1', topic: 't1' }] }),
      link('ntModbus', 'tvModbus', { mapping: [] }),
      link('ntJson', 'tvJson', {}),
      link('ntCsvTv', 'csvTv', { delimiter: 'COMMA' })
    ]);
    await db('history_query_transformers').insert({
      id: 'hqtOia',
      history_id: 'hq1',
      transformer_id: 'tvOia',
      options: '{"precision":"ms"}'
    });
  });
  afterEach(() => harness.afterEach());

  it('should convert the custom transformers to record lists', async () => {
    await replaceTimeValuesByRecordLists(db);

    const customs = await db('transformers').where('type', 'custom').orderBy('id').select('id', 'input_type', 'output_type');
    assert.deepStrictEqual(customs, [
      { id: 'custom1', input_type: 'record-list', output_type: 'any' },
      { id: 'custom2', input_type: 'any', output_type: 'record-list' }
    ]);
  });

  it('should rename the time-values standard transformers into their record-list replacements', async () => {
    await replaceTimeValuesByRecordLists(db);

    const standards = await db('transformers')
      .where('type', 'standard')
      .orderBy('id')
      .select('id', 'function_name', 'input_type', 'output_type');
    assert.deepStrictEqual(standards, [
      { id: 'csv', function_name: 'record-list-to-csv', input_type: 'record-list', output_type: 'any' },
      { id: 'csvTv', function_name: 'csv-to-record-list', input_type: 'any', output_type: 'record-list' },
      { id: 'tvJson', function_name: 'record-list-to-json', input_type: 'record-list', output_type: 'any' },
      { id: 'tvModbus', function_name: 'record-list-to-modbus', input_type: 'record-list', output_type: 'modbus' },
      { id: 'tvMqtt', function_name: 'record-list-to-mqtt', input_type: 'record-list', output_type: 'mqtt' },
      { id: 'tvOia', function_name: 'record-list-to-oianalytics', input_type: 'record-list', output_type: 'oianalytics' }
    ]);
  });

  it('should convert the options of the links', async () => {
    await replaceTimeValuesByRecordLists(db);

    assert.deepStrictEqual(await optionsOf('north_transformers', 'ntOia'), {
      transformerId: 'tvOia',
      options: {
        pointIdColumn: 'pointId',
        timestampColumn: 'timestamp',
        valueColumn: 'value',
        timestampSettings: { type: 'iso-string', timezone: 'UTC', format: 'yyyy-MM-dd HH:mm:ss', locale: 'en-En' },
        precision: 's',
        referenceProcess: null
      }
    });
    assert.deepStrictEqual((await optionsOf('history_query_transformers', 'hqtOia')).options.precision, 'ms');
    assert.deepStrictEqual((await optionsOf('north_transformers', 'ntMqtt')).options, {
      pointIdColumn: 'pointId',
      mapping: [{ pointId: 'p1', topic: 't1' }]
    });
    assert.deepStrictEqual((await optionsOf('north_transformers', 'ntModbus')).options, {
      pointIdColumn: 'pointId',
      valueColumn: 'value',
      mapping: []
    });
    assert.deepStrictEqual((await optionsOf('north_transformers', 'ntJson')).options, {});
    assert.deepStrictEqual((await optionsOf('north_transformers', 'ntCsvTv')).options, { delimiter: 'COMMA' });
  });

  it('should merge time-values-to-csv into record-list-to-csv, writing the same three columns', async () => {
    await replaceTimeValuesByRecordLists(db);

    assert.strictEqual(await db('transformers').where('id', 'tvCsv').first(), undefined);
    const { transformerId, options } = await optionsOf('north_transformers', 'ntTvCsv');
    assert.strictEqual(transformerId, 'csv');
    assert.deepStrictEqual(options, {
      filename: 'values.csv',
      encoding: 'UTF_8',
      header: true,
      compression: false,
      delimiter: 'SEMI_COLON',
      newline: 'LF',
      quoteChar: 'NONE',
      escapeChar: 'DOUBLE_QUOTE',
      nullValue: '',
      keepOtherFields: false,
      fields: [
        { fieldName: 'pointId', columnName: 'Ref', dataType: 'string', fieldProcess: 'value.toUpperCase()', datetimeSettings: null },
        {
          fieldName: 'timestamp',
          columnName: 'Date',
          dataType: 'datetime',
          fieldProcess: null,
          datetimeSettings: {
            inputType: 'iso-string',
            inputTimezone: null,
            inputFormat: null,
            inputLocale: null,
            outputType: 'string',
            outputTimezone: 'Europe/Paris',
            outputFormat: 'yyyy-MM-dd',
            outputLocale: null
          }
        },
        { fieldName: 'value', columnName: 'Val', dataType: 'string', fieldProcess: null, datetimeSettings: null }
      ]
    });
  });

  it('should keep every field of the existing record-list-to-csv links', async () => {
    await replaceTimeValuesByRecordLists(db);

    assert.strictEqual((await optionsOf('north_transformers', 'ntCsv')).options.keepOtherFields, true);
    assert.strictEqual((await optionsOf('north_transformers', 'ntCsvKept')).options.keepOtherFields, false);
  });

  it('should rename time-values-to-csv when there is no record-list-to-csv yet', async () => {
    await db('north_transformers').where('transformer_id', 'csv').del();
    await db('transformers').where('id', 'csv').del();

    await replaceTimeValuesByRecordLists(db);

    const transformer = await db('transformers').where('id', 'tvCsv').first('function_name');
    assert.strictEqual(transformer.function_name, 'record-list-to-csv');
    assert.strictEqual((await optionsOf('north_transformers', 'ntTvCsv')).options.keepOtherFields, false);
  });

  describe('OIAnalytics North', () => {
    const northConnector = (id: string, type: string) => ({
      id,
      name: id,
      type,
      enabled: true,
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
    });
    const historyQuery = (id: string, southType: string, northType: string) => ({
      id,
      name: id,
      start_time: NOW,
      end_time: NOW,
      south_type: southType,
      north_type: northType,
      south_settings: JSON.stringify({}),
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
    const southLink = (id: string, northId: string, southId: string, transformerId: string) => ({
      id,
      north_id: northId,
      transformer_id: transformerId,
      options: '{}',
      source_type: 'south',
      source_south_south_id: southId,
      source_south_group_id: null
    });
    const linksOf = (northId: string, southId: string) =>
      db('north_transformers as nt')
        .join('transformers as t', 't.id', 'nt.transformer_id')
        .where({ 'nt.north_id': northId, 'nt.source_south_south_id': southId })
        .orderBy('nt.id')
        .select('nt.id', 't.function_name', 'nt.options');

    beforeEach(async () => {
      await db('transformers').insert([standard('iso', 'iso', 'any', 'any'), standard('ignore', 'ignore', 'any', 'any')]);
      await db('north_connectors').insert([northConnector('oia', 'oianalytics')]);
      await db('south_connectors').insert([
        { id: 'opcua1', name: 'opcua1', type: 'opcua', enabled: true, settings: '{}' },
        { id: 'opcua2', name: 'opcua2', type: 'opcua', enabled: true, settings: '{}' },
        { id: 'modbus1', name: 'modbus1', type: 'modbus', enabled: true, settings: '{}' },
        { id: 'mysql1', name: 'mysql1', type: 'mysql', enabled: true, settings: '{}' }
      ]);
      await db('south_items').insert({
        id: 'item1',
        connector_id: 'opcua2',
        scan_mode_id: 'sm1',
        name: 'item1',
        enabled: true,
        settings: '{}'
      });
      await db('north_transformers').insert([
        southLink('isoItem', 'oia', 'opcua2', 'iso'),
        southLink('ignoreSouth', 'oia', 'modbus1', 'ignore')
      ]);
      await db('north_transformers_items').insert({ id: 'isoItem', item_id: 'item1' });
    });

    it('should send the values of a point-based south through record-list-to-oianalytics', async () => {
      await replaceTimeValuesByRecordLists(db);

      const [link] = await linksOf('oia', 'opcua1');
      assert.strictEqual(link.function_name, 'record-list-to-oianalytics');
      assert.deepStrictEqual(JSON.parse(link.options), {
        pointIdColumn: 'pointId',
        timestampColumn: 'timestamp',
        valueColumn: 'value',
        timestampSettings: { type: 'iso-string', timezone: 'UTC', format: 'yyyy-MM-dd HH:mm:ss', locale: 'en-En' },
        precision: 'ms',
        referenceProcess: null
      });
    });

    it('should replace iso links and still add a south-level link', async () => {
      await replaceTimeValuesByRecordLists(db);

      const links = await linksOf('oia', 'opcua2');
      assert.deepStrictEqual(
        links.map(link => link.function_name),
        ['record-list-to-oianalytics', 'record-list-to-oianalytics']
      );
      assert.ok(links.some(link => link.id === 'isoItem'));
      assert.ok(await db('north_transformers_items').where('id', 'isoItem').first());
    });

    it('should keep an existing south-level link, and leave the other souths and norths alone', async () => {
      await replaceTimeValuesByRecordLists(db);

      assert.deepStrictEqual(
        (await linksOf('oia', 'modbus1')).map(link => link.function_name),
        ['ignore']
      );
      assert.deepStrictEqual(await linksOf('oia', 'mysql1'), []);
      assert.deepStrictEqual(await linksOf('north1', 'opcua1'), []);
    });

    it('should create record-list-to-oianalytics when it does not exist', async () => {
      await db('north_transformers').where('transformer_id', 'tvOia').del();
      await db('history_query_transformers').where('transformer_id', 'tvOia').del();
      await db('transformers').where('id', 'tvOia').del();

      await replaceTimeValuesByRecordLists(db);

      const transformer = await db('transformers').where('function_name', 'record-list-to-oianalytics').first();
      assert.strictEqual(transformer.input_type, 'record-list');
      assert.strictEqual((await linksOf('oia', 'opcua1'))[0].function_name, 'record-list-to-oianalytics');
    });

    it('should send the values of OIAnalytics history queries of point-based souths through record-list-to-oianalytics', async () => {
      await db('history_queries').insert([
        historyQuery('hqOia', 'opcua', 'oianalytics'),
        historyQuery('hqOiaIso', 'modbus', 'oianalytics'),
        historyQuery('hqSql', 'mysql', 'oianalytics')
      ]);
      await db('history_query_transformers').insert({ id: 'hqIso', history_id: 'hqOiaIso', transformer_id: 'iso', options: '{}' });

      await replaceTimeValuesByRecordLists(db);

      const functionNames = (historyId: string) =>
        db('history_query_transformers as ht')
          .join('transformers as t', 't.id', 'ht.transformer_id')
          .where('ht.history_id', historyId)
          .pluck('t.function_name');
      assert.deepStrictEqual(await functionNames('hqOia'), ['record-list-to-oianalytics']);
      assert.deepStrictEqual(await functionNames('hqOiaIso'), ['record-list-to-oianalytics']);
      assert.deepStrictEqual(await functionNames('hqSql'), []);
    });
  });
});

describe('Entity migration v3.10.0: replaceIsoAndIgnoreTransformers', () => {
  const harness = createMigrationSchemaHarness({
    buildSchema: db => buildSchemaBeforeStep(replaceIsoAndIgnoreTransformers, db)
  });
  let db: Knex;

  const southLink = (id: string, northId: string, transformerId: string, southId: string, groupId: string | null = null) => ({
    id,
    north_id: northId,
    transformer_id: transformerId,
    options: '{"kept":true}',
    source_type: 'south',
    source_api_data_source_id: null,
    source_south_south_id: southId,
    source_south_group_id: groupId
  });
  const sourceLink = (id: string, northId: string, transformerId: string, sourceType: string, dataSourceId: string | null = null) => ({
    id,
    north_id: northId,
    transformer_id: transformerId,
    options: '{}',
    source_type: sourceType,
    source_api_data_source_id: dataSourceId,
    source_south_south_id: null,
    source_south_group_id: null
  });

  /** The links of a North, described by their transformer, source and items */
  const northLinks = async (northId: string) => {
    const links = await db('north_transformers as nt')
      .join('transformers as t', 't.id', 'nt.transformer_id')
      .select(
        'nt.id',
        't.function_name',
        't.name',
        'nt.options',
        'nt.source_type',
        'nt.source_api_data_source_id',
        'nt.source_south_south_id',
        'nt.source_south_group_id'
      )
      .where('nt.north_id', northId);
    const result = [];
    for (const link of links) {
      const itemRows = await db('north_transformers_items').where('id', link.id).whereNotNull('item_id').orderBy('item_id');
      result.push({
        transformer: link.function_name ?? link.name,
        options: JSON.parse(link.options),
        source: link.source_south_south_id ?? link.source_api_data_source_id ?? link.source_type,
        group: link.source_south_group_id,
        items: itemRows.filter(row => !row.excluded).map(row => row.item_id),
        excludedItems: itemRows.filter(row => row.excluded).map(row => row.item_id)
      });
    }
    return result.sort((a, b) => `${a.source}${a.transformer}`.localeCompare(`${b.source}${b.transformer}`));
  };
  const historyLinks = async (historyId: string) => {
    const links = await db('history_query_transformers as ht')
      .join('transformers as t', 't.id', 'ht.transformer_id')
      .select('ht.id', 't.function_name')
      .where('ht.history_id', historyId);
    const result = [];
    for (const link of links) {
      const items = await db('history_query_transformers_items').where('id', link.id).orderBy('item_id').pluck('item_id');
      result.push({ transformer: link.function_name, items });
    }
    return result;
  };

  before(() => harness.before());
  after(() => harness.after());

  beforeEach(async () => {
    await harness.beforeEach();
    db = harness.getDb();
    await db('scan_modes').insert([{ id: 'sm1', name: 'Every minute', description: '', cron: '0 * * * * *' }]);
    await db('south_connectors').insert([
      { id: 'opcua', name: 'OPC UA', type: 'opcua', enabled: true, settings: '{}' },
      { id: 'folder', name: 'Folder', type: 'folder-scanner', enabled: true, settings: '{}' },
      { id: 'mqtt', name: 'MQTT', type: 'mqtt', enabled: true, settings: '{}' }
    ]);
    const item = (id: string, southId: string) => ({
      id,
      connector_id: southId,
      scan_mode_id: 'sm1',
      name: id,
      enabled: true,
      settings: '{}'
    });
    await db('south_items').insert([
      item('i1', 'opcua'),
      item('i2', 'opcua'),
      item('i3', 'opcua'),
      item('f1', 'folder'),
      item('m1', 'mqtt')
    ]);
    await db('south_item_groups').insert({
      id: 'g1',
      created_at: NOW,
      updated_at: NOW,
      name: 'Group 1',
      south_id: 'opcua',
      scan_mode_id: 'sm1'
    });
    await db('group_items').insert([
      { group_id: 'g1', item_id: 'i1' },
      { group_id: 'g1', item_id: 'i2' }
    ]);
    await db('north_connectors').insert([
      { ...caching, id: 'console', name: 'Console', type: 'console', enabled: true, settings: '{}' },
      { ...caching, id: 's3', name: 'S3', type: 'aws-s3', enabled: true, settings: '{}' },
      { ...caching, id: 'mqttNorth', name: 'MQTT', type: 'mqtt', enabled: true, settings: '{}' }
    ]);
    const historyQuery = (id: string, southType: string, northType: string) => ({
      ...caching,
      id,
      name: id,
      start_time: NOW,
      end_time: NOW,
      south_type: southType,
      north_type: northType,
      south_settings: '{}',
      north_settings: '{}'
    });
    await db('history_queries').insert([historyQuery('hqConsole', 'opcua', 'console'), historyQuery('hqS3', 'mssql', 'aws-s3')]);
    await db('history_items').insert([
      { id: 'h1', history_id: 'hqConsole', name: 'h1', enabled: true, settings: '{}' },
      { id: 'h2', history_id: 'hqConsole', name: 'h2', enabled: true, settings: '{}' },
      { id: 'h3', history_id: 'hqS3', name: 'h3', enabled: true, settings: '{}' }
    ]);
    // Replace the standard transformers seeded by the previous migrations with known ids
    await db('transformers').where('type', 'standard').del();
    await db('transformers').insert([
      { id: 'iso', type: 'standard', function_name: 'iso', input_type: 'any', output_type: 'any' },
      { id: 'ignore', type: 'standard', function_name: 'ignore', input_type: 'any', output_type: 'any' },
      { id: 'json', type: 'standard', function_name: 'record-list-to-json', input_type: 'record-list', output_type: 'any' },
      { id: 'csv', type: 'standard', function_name: 'record-list-to-csv', input_type: 'record-list', output_type: 'any' },
      { id: 'custom', type: 'custom', input_type: 'any', output_type: 'any', name: 'custom', custom_code: '', language: 'javascript' }
    ]);
  });

  afterEach(() => harness.afterEach());

  it('should add the passthroughs of the data the North received without transformer, and remove iso and ignore', async () => {
    await replaceIsoAndIgnoreTransformers(db);

    const columns = await db('north_transformers_items').columnInfo();
    assert.strictEqual(columns.excluded.defaultValue, "'0'");
    assert.strictEqual(columns.excluded.nullable, false);

    assert.deepStrictEqual(await northLinks('console'), [
      { transformer: 'file', options: {}, source: 'folder', group: null, items: [], excludedItems: [] },
      { transformer: 'setpoint-to-json', options: {}, source: 'oianalytics-setpoint', group: null, items: [], excludedItems: [] },
      { transformer: 'file', options: {}, source: 'oibus-api', group: null, items: [], excludedItems: [] },
      { transformer: 'record-list-to-json', options: {}, source: 'opcua', group: null, items: [], excludedItems: [] }
    ]);
    assert.deepStrictEqual(await northLinks('s3'), [
      { transformer: 'file', options: {}, source: 'folder', group: null, items: [], excludedItems: [] },
      { transformer: 'file', options: {}, source: 'oibus-api', group: null, items: [], excludedItems: [] }
    ]);
    assert.deepStrictEqual(await northLinks('mqttNorth'), []);
    assert.deepStrictEqual(await historyLinks('hqConsole'), [{ transformer: 'record-list-to-json', items: [] }]);
    assert.deepStrictEqual(await historyLinks('hqS3'), []);
    assert.deepStrictEqual(await db('transformers').where('type', 'standard').orderBy('function_name').pluck('function_name'), [
      'file',
      'record-list-to-csv',
      'record-list-to-json',
      'setpoint-to-json'
    ]);
    assert.deepStrictEqual(await db('transformers').where('function_name', 'file').first('input_type', 'output_type', 'created_by'), {
      input_type: 'any',
      output_type: 'any',
      created_by: 'system'
    });
  });

  it('should leave the ignored items out of the transformers they fall back to', async () => {
    await db('north_transformers').insert([
      southLink('ignoreI2', 'console', 'ignore', 'opcua'),
      southLink('groupCsv', 'console', 'csv', 'opcua', 'g1'),
      southLink('ignoreFolder', 'console', 'ignore', 'folder')
    ]);
    await db('north_transformers_items').insert([
      { id: 'ignoreI2', item_id: 'i2' },
      { id: 'groupCsv', group_id: 'g1' }
    ]);

    await replaceIsoAndIgnoreTransformers(db);

    assert.deepStrictEqual(await northLinks('console'), [
      { transformer: 'setpoint-to-json', options: {}, source: 'oianalytics-setpoint', group: null, items: [], excludedItems: [] },
      { transformer: 'file', options: {}, source: 'oibus-api', group: null, items: [], excludedItems: [] },
      { transformer: 'record-list-to-csv', options: { kept: true }, source: 'opcua', group: 'g1', items: [], excludedItems: ['i2'] },
      { transformer: 'record-list-to-json', options: {}, source: 'opcua', group: null, items: [], excludedItems: ['i2'] }
    ]);
    assert.ok(await db('north_transformers_items').where('id', 'groupCsv').whereNotNull('group_id').first());
  });

  it('should replace iso by the passthrough the North accepts, and drop the ignored sources', async () => {
    await db('north_transformers').insert([
      southLink('isoMqtt', 's3', 'iso', 'mqtt'),
      southLink('isoOpcua', 's3', 'iso', 'opcua'),
      southLink('customFolder', 's3', 'custom', 'folder'),
      sourceLink('isoApi', 's3', 'iso', 'oibus-api', 'ds1'),
      sourceLink('ignoreApi', 's3', 'ignore', 'oibus-api', 'ds2'),
      sourceLink('ignoreSetpoints', 'console', 'ignore', 'oianalytics-setpoint'),
      sourceLink('isoSetpoints', 'mqttNorth', 'iso', 'oianalytics-setpoint')
    ]);

    await replaceIsoAndIgnoreTransformers(db);

    assert.deepStrictEqual(await northLinks('s3'), [
      { transformer: 'file', options: {}, source: 'ds1', group: null, items: [], excludedItems: [] },
      { transformer: 'custom', options: { kept: true }, source: 'folder', group: null, items: [], excludedItems: [] },
      { transformer: 'file', options: {}, source: 'mqtt', group: null, items: [], excludedItems: [] }
    ]);
    assert.deepStrictEqual(
      (await northLinks('console')).filter(link => link.source === 'oianalytics-setpoint'),
      []
    );
    assert.deepStrictEqual(await northLinks('mqttNorth'), []);
  });

  it('should keep routing the items of history queries as before', async () => {
    await db('history_query_transformers').insert([
      { id: 'ignoreH1', history_id: 'hqConsole', transformer_id: 'ignore', options: '{}' },
      { id: 'isoS3', history_id: 'hqS3', transformer_id: 'iso', options: '{}' }
    ]);
    await db('history_query_transformers_items').insert({ id: 'ignoreH1', item_id: 'h1' });

    await replaceIsoAndIgnoreTransformers(db);

    assert.deepStrictEqual(await historyLinks('hqConsole'), [{ transformer: 'record-list-to-json', items: ['h2'] }]);
    assert.deepStrictEqual(await historyLinks('hqS3'), []);
  });

  it('should reuse the existing passthroughs, and drop the links of deleted souths', async () => {
    await db('transformers').insert({ id: 'file', type: 'standard', function_name: 'file', input_type: 'any', output_type: 'any' });
    await db('north_transformers').insert({ ...southLink('orphan', 'mqttNorth', 'iso', 'opcua'), source_south_south_id: null });

    await replaceIsoAndIgnoreTransformers(db);

    assert.deepStrictEqual(
      (await northLinks('s3')).map(link => link.transformer),
      ['file', 'file']
    );
    assert.strictEqual(
      await db('north_transformers')
        .where('transformer_id', 'file')
        .count({ count: '*' })
        .first()
        .then(row => row?.count),
      4
    );
    assert.strictEqual(await db('north_transformers').where('id', 'orphan').first(), undefined);
  });
});

describe('Entity migration v3.10.0: groupOIAnalyticsOptions', () => {
  const harness = createMigrationSchemaHarness({
    buildSchema: db => buildSchemaBeforeStep(groupOIAnalyticsOptions, db)
  });
  let db: Knex;
  const optionsOf = async (table: string, id: string) => JSON.parse((await db(table).where('id', id).first('options')).options);

  before(() => harness.before());
  after(() => harness.after());

  beforeEach(async () => {
    await harness.beforeEach();
    db = harness.getDb();
    await db('scan_modes').insert([{ id: 'sm1', name: 'Every minute', description: '', cron: '0 * * * * *' }]);
    await db('north_connectors').insert({ ...caching, id: 'north1', name: 'North 1', type: 'oianalytics', enabled: true, settings: '{}' });
    await db('history_queries').insert({
      ...caching,
      id: 'hq1',
      name: 'HQ 1',
      start_time: NOW,
      end_time: NOW,
      south_type: 'opcua',
      north_type: 'oianalytics',
      south_settings: '{}',
      north_settings: '{}'
    });
    await db('transformers').where('type', 'standard').del();
    await db('transformers').insert([
      { id: 'oia', type: 'standard', function_name: 'record-list-to-oianalytics', input_type: 'record-list', output_type: 'oianalytics' },
      { id: 'json', type: 'standard', function_name: 'record-list-to-json', input_type: 'record-list', output_type: 'any' }
    ]);
  });

  afterEach(() => harness.afterEach());

  it('should group the options of the OIAnalytics transformers by reference, timestamp and value', async () => {
    const link = (id: string, transformerId: string, options: object | null) => ({
      id,
      north_id: 'north1',
      transformer_id: transformerId,
      options: options ? JSON.stringify(options) : null,
      source_type: 'oianalytics-setpoint'
    });
    await db('north_transformers').insert([
      link('old', 'oia', oldOptions),
      link('grouped', 'oia', groupedOptions),
      link('empty', 'oia', null),
      link('other', 'json', { pointIdColumn: 'kept' })
    ]);
    await db('history_query_transformers').insert({
      id: 'history',
      history_id: 'hq1',
      transformer_id: 'oia',
      options: JSON.stringify({ ...oldOptions, timestampSettings: { type: 'unix-epoch-ms' }, referenceProcess: null })
    });

    await groupOIAnalyticsOptions(db);

    assert.deepStrictEqual(await optionsOf('north_transformers', 'old'), groupedOptions);
    assert.deepStrictEqual(await optionsOf('north_transformers', 'grouped'), groupedOptions);
    assert.deepStrictEqual(await optionsOf('north_transformers', 'empty'), {
      reference: { referenceField: 'pointId', referenceProcess: null },
      timestamp: { timestampField: 'timestamp', sourceType: 'iso-string', precision: 'ms' },
      value: { valueField: 'value', valueProcess: null }
    });
    assert.deepStrictEqual(await optionsOf('north_transformers', 'other'), { pointIdColumn: 'kept' });
    assert.deepStrictEqual(await optionsOf('history_query_transformers', 'history'), {
      reference: { referenceField: 'reference', referenceProcess: null },
      timestamp: { timestampField: 'time', sourceType: 'unix-epoch-ms', precision: 's' },
      value: { valueField: 'measure', valueProcess: null }
    });
  });

  it('should do nothing without OIAnalytics transformer', async () => {
    await db('transformers').where('id', 'oia').del();

    await groupOIAnalyticsOptions(db);
  });
});

describe('Entity migration v3.10.0: renameAnyDataType', () => {
  const harness = createMigrationSchemaHarness({
    buildSchema: db => buildSchemaBeforeStep(renameAnyDataType, db)
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
    await renameAnyDataType(db);

    assert.deepStrictEqual(await db('transformers').select('id', 'input_type', 'output_type').orderBy('id'), [
      { id: 'csv', input_type: 'file', output_type: 'record-list' },
      { id: 'custom', input_type: 'file', output_type: 'oianalytics' },
      { id: 'file', input_type: 'file', output_type: 'file' },
      { id: 'json', input_type: 'record-list', output_type: 'file' }
    ]);
  });
});

describe('Entity migration v3.10.0: replaceCsvAndJsonReaders', () => {
  const harness = createMigrationSchemaHarness({
    buildSchema: db => buildSchemaBeforeStep(replaceCsvAndJsonReaders, db)
  });
  let db: Knex;
  const linkOf = async (table: string, id: string) => {
    const link = await db(table).where('id', id).first('transformer_id', 'options');
    return { transformerId: link.transformer_id, options: JSON.parse(link.options) };
  };
  const northLink = (id: string, transformerId: string, options: object | null) => ({
    id,
    north_id: 'north1',
    transformer_id: transformerId,
    options: options ? JSON.stringify(options) : null,
    source_type: 'oibus-api'
  });

  before(() => harness.before());
  after(() => harness.after());

  beforeEach(async () => {
    await harness.beforeEach();
    db = harness.getDb();
    await db('scan_modes').insert([{ id: 'sm1', name: 'Every minute', description: '', cron: '0 * * * * *' }]);
    await db('north_connectors').insert({ ...caching, id: 'north1', name: 'North 1', type: 'oianalytics', enabled: true, settings: '{}' });
    await db('history_queries').insert({
      ...caching,
      id: 'hq1',
      name: 'HQ 1',
      start_time: NOW,
      end_time: NOW,
      south_type: 'folder-scanner',
      north_type: 'oianalytics',
      south_settings: '{}',
      north_settings: '{}'
    });
    await db('transformers').where('type', 'standard').del();
    await db('transformers').insert([
      { id: 'mqtt', type: 'standard', function_name: 'csv-to-mqtt', input_type: 'file', output_type: 'mqtt' },
      { id: 'records', type: 'standard', function_name: 'csv-to-record-list', input_type: 'file', output_type: 'record-list' },
      { id: 'oia', type: 'standard', function_name: 'json-to-oianalytics', input_type: 'file', output_type: 'oianalytics' },
      { id: 'existing', type: 'standard', function_name: 'file-to-record-list', input_type: 'file', output_type: 'record-list' }
    ]);
  });

  afterEach(() => harness.afterEach());

  it('should replace the CSV and JSON transformers by the file ones, converting their options', async () => {
    await db('north_transformers').insert([
      northLink('mqtt', 'mqtt', {
        delimiter: 'COMMA',
        hasHeader: false,
        topicColumn: '0',
        payloadType: 'object',
        valueColumn: null,
        objectFields: [{ key: 'temp', column: '1', dataType: 'number' }]
      }),
      northLink('records', 'records', { delimiter: 'TAB', hasHeader: true, pointIdColumn: 'id' }),
      northLink('empty', 'records', null)
    ]);
    await db('history_query_transformers').insert({
      id: 'history',
      history_id: 'hq1',
      transformer_id: 'oia',
      options: JSON.stringify({
        rowIteratorPath: '$.rows[*]',
        pointId: '$.rows[*].name',
        value: '$.rows[*].value',
        timestamp: '$.rows[*].time',
        referenceProcess: 'value.trim()',
        datetimeSettings: {
          inputType: 'string',
          inputTimezone: 'Europe/Paris',
          inputFormat: 'dd/MM/yyyy',
          inputLocale: 'fr-FR',
          outputPrecision: 's'
        }
      })
    });

    await replaceCsvAndJsonReaders(db);

    assert.deepStrictEqual(await db('transformers').select('id', 'function_name').orderBy('id'), [
      { id: 'existing', function_name: 'file-to-record-list' },
      { id: 'mqtt', function_name: 'file-to-mqtt' },
      { id: 'oia', function_name: 'file-to-oianalytics' }
    ]);
    assert.deepStrictEqual(await linkOf('north_transformers', 'mqtt'), {
      transformerId: 'mqtt',
      options: {
        input: { fileType: 'csv', delimiter: 'COMMA', hasHeader: false },
        topicField: '0',
        payloadType: 'object',
        valueField: null,
        objectFields: [{ key: 'temp', field: '1', dataType: 'number' }]
      }
    });
    assert.deepStrictEqual(await linkOf('north_transformers', 'records'), {
      transformerId: 'existing',
      options: { input: { fileType: 'csv', delimiter: 'TAB', hasHeader: true } }
    });
    assert.deepStrictEqual(await linkOf('north_transformers', 'empty'), {
      transformerId: 'existing',
      options: { input: { fileType: 'csv', delimiter: 'SEMI_COLON', hasHeader: true } }
    });
    assert.deepStrictEqual(await linkOf('history_query_transformers', 'history'), {
      transformerId: 'oia',
      options: {
        input: { fileType: 'json', rowIteratorPath: '$.rows[*]' },
        reference: { referenceField: '$.rows[*].name', referenceProcess: 'value.trim()' },
        timestamp: {
          timestampField: '$.rows[*].time',
          sourceType: 'string',
          precision: 's',
          timezone: 'Europe/Paris',
          format: 'dd/MM/yyyy',
          locale: 'fr-FR'
        },
        value: { valueField: '$.rows[*].value', valueProcess: null }
      }
    });
  });

  it('should keep the options already converted, and do nothing without CSV or JSON transformer', async () => {
    const converted = {
      input: { fileType: 'csv', delimiter: 'COMMA', hasHeader: true },
      topicField: 'topic',
      payloadType: 'string',
      valueField: 'v'
    };
    await db('north_transformers').insert(northLink('mqtt', 'mqtt', converted));

    await replaceCsvAndJsonReaders(db);
    await replaceCsvAndJsonReaders(db);

    assert.deepStrictEqual(await linkOf('north_transformers', 'mqtt'), { transformerId: 'mqtt', options: converted });
  });
});

describe('Entity migration v3.10.0: replaceCsvAndJsonWriters', () => {
  const harness = createMigrationSchemaHarness({
    buildSchema: db => buildSchemaBeforeStep(replaceCsvAndJsonWriters, db)
  });
  let db: Knex;
  const linkOf = async (table: string, id: string) => {
    const link = await db(table).where('id', id).first('transformer_id', 'options');
    return { transformerId: link.transformer_id, options: JSON.parse(link.options) };
  };
  const northLink = (id: string, transformerId: string, options: object | null) => ({
    id,
    north_id: 'north1',
    transformer_id: transformerId,
    options: options ? JSON.stringify(options) : null,
    source_type: 'oibus-api'
  });

  before(() => harness.before());
  after(() => harness.after());

  beforeEach(async () => {
    await harness.beforeEach();
    db = harness.getDb();
    await db('scan_modes').insert([{ id: 'sm1', name: 'Every minute', description: '', cron: '0 * * * * *' }]);
    await db('north_connectors').insert({ ...caching, id: 'north1', name: 'North 1', type: 'oianalytics', enabled: true, settings: '{}' });
    await db('history_queries').insert({
      ...caching,
      id: 'hq1',
      name: 'HQ 1',
      start_time: NOW,
      end_time: NOW,
      south_type: 'mysql',
      north_type: 'oianalytics',
      south_settings: '{}',
      north_settings: '{}'
    });
    await db('transformers').where('type', 'standard').del();
    await db('transformers').insert([
      { id: 'jsonToCsv', type: 'standard', function_name: 'json-to-csv', input_type: 'file', output_type: 'file' },
      { id: 'csv', type: 'standard', function_name: 'record-list-to-csv', input_type: 'record-list', output_type: 'file' },
      { id: 'json', type: 'standard', function_name: 'record-list-to-json', input_type: 'record-list', output_type: 'file' }
    ]);
  });

  afterEach(() => harness.afterEach());

  it('should replace the CSV and JSON writers by the file ones, converting their options', async () => {
    const datetimeSettings = { inputType: 'iso-string', outputType: 'unix-epoch-ms' };
    await db('north_transformers').insert([
      northLink('jsonToCsv', 'jsonToCsv', {
        filename: 'report.csv',
        encoding: 'LATIN_1',
        header: false,
        delimiter: 'TAB',
        newline: 'CRLF',
        quoteChar: 'DOUBLE_QUOTE',
        escapeChar: 'BACKSLASH',
        nullValue: 'NULL',
        rowIteratorPath: '$.data[*]',
        fields: [{ columnName: 'Time', jsonPath: '$.data[*].ts', dataType: 'datetime', fieldProcess: null, datetimeSettings }]
      }),
      northLink('json', 'json', {})
    ]);
    await db('history_query_transformers').insert({
      id: 'history',
      history_id: 'hq1',
      transformer_id: 'csv',
      options: JSON.stringify({
        filename: '@CurrentDate.csv',
        encoding: 'UTF_8',
        header: true,
        compression: true,
        delimiter: 'COMMA',
        newline: 'LF',
        quoteChar: 'NONE',
        escapeChar: 'DOUBLE_QUOTE',
        nullValue: '',
        keepOtherFields: false,
        fields: [{ fieldName: 'value', columnName: null, dataType: 'number', fieldProcess: 'value * 2' }]
      })
    });

    await replaceCsvAndJsonWriters(db);

    assert.deepStrictEqual(await db('transformers').select('id', 'function_name').orderBy('id'), [
      { id: 'csv', function_name: 'record-list-to-file' },
      { id: 'jsonToCsv', function_name: 'file-to-file' }
    ]);
    assert.deepStrictEqual(await linkOf('north_transformers', 'jsonToCsv'), {
      transformerId: 'jsonToCsv',
      options: {
        input: { fileType: 'json', rowIteratorPath: '$.data[*]' },
        output: {
          fileType: 'csv',
          encoding: 'LATIN_1',
          compression: false,
          header: false,
          delimiter: 'TAB',
          newline: 'CRLF',
          quoteChar: 'DOUBLE_QUOTE',
          escapeChar: 'BACKSLASH',
          nullValue: 'NULL'
        },
        filename: 'report.csv',
        keepOtherFields: false,
        fields: [{ field: '$.data[*].ts', name: 'Time', dataType: 'datetime', fieldProcess: null, datetimeSettings }]
      }
    });
    assert.deepStrictEqual(await linkOf('north_transformers', 'json'), {
      transformerId: 'csv',
      options: {
        output: { fileType: 'json', encoding: 'UTF_8', compression: false },
        filename: '@CurrentDate.json',
        keepOtherFields: true,
        fields: []
      }
    });
    assert.deepStrictEqual(await linkOf('history_query_transformers', 'history'), {
      transformerId: 'csv',
      options: {
        output: {
          fileType: 'csv',
          encoding: 'UTF_8',
          compression: true,
          header: true,
          delimiter: 'COMMA',
          newline: 'LF',
          quoteChar: 'NONE',
          escapeChar: 'DOUBLE_QUOTE',
          nullValue: ''
        },
        filename: '@CurrentDate.csv',
        keepOtherFields: false,
        fields: [{ field: 'value', name: null, dataType: 'number', fieldProcess: 'value * 2' }]
      }
    });
  });

  it('should keep the options already converted, and fill the missing ones', async () => {
    const converted = {
      output: { fileType: 'json', encoding: 'UTF_8', compression: false },
      filename: 'a.json',
      keepOtherFields: true,
      fields: []
    };
    await db('north_transformers').insert([northLink('converted', 'csv', converted), northLink('empty', 'jsonToCsv', null)]);

    await replaceCsvAndJsonWriters(db);
    await replaceCsvAndJsonWriters(db);

    assert.deepStrictEqual(await linkOf('north_transformers', 'converted'), { transformerId: 'csv', options: converted });
    assert.deepStrictEqual((await linkOf('north_transformers', 'empty')).options, {
      input: { fileType: 'json', rowIteratorPath: '$[*]' },
      output: {
        fileType: 'csv',
        encoding: 'UTF_8',
        compression: false,
        header: true,
        delimiter: 'COMMA',
        newline: 'LF',
        quoteChar: 'NONE',
        escapeChar: 'DOUBLE_QUOTE',
        nullValue: ''
      },
      filename: '@CurrentDate.csv',
      keepOtherFields: false,
      fields: []
    });
  });
});

describe('Entity migration v3.10.0: convertFileWriterLinks', () => {
  const harness = createMigrationSchemaHarness({
    buildSchema: db => buildSchemaBeforeStep(convertFileWriterLinks, db)
  });
  let db: Knex;
  const linkOf = async (table: string, id: string) => {
    const link = await db(table).where('id', id).first('transformer_id', 'options');
    return { transformerId: link.transformer_id, options: JSON.parse(link.options) };
  };
  const northLink = (id: string, northId: string, transformerId: string, options: object | null) => ({
    id,
    north_id: northId,
    transformer_id: transformerId,
    options: options ? JSON.stringify(options) : null,
    source_type: 'oibus-api'
  });

  before(() => harness.before());
  after(() => harness.after());

  beforeEach(async () => {
    await harness.beforeEach();
    db = harness.getDb();
    await db('scan_modes').insert([{ id: 'sm1', name: 'Every minute', description: '', cron: '0 * * * * *' }]);
    await db('north_connectors').insert([
      { ...caching, id: 'writer', name: 'Writer', type: 'file-writer', enabled: true, settings: '{}' },
      { ...caching, id: 'console', name: 'Console', type: 'console', enabled: true, settings: '{}' }
    ]);
    await db('history_queries').insert({
      ...caching,
      id: 'hq1',
      name: 'HQ 1',
      start_time: NOW,
      end_time: NOW,
      south_type: 'folder-scanner',
      north_type: 'file-writer',
      south_settings: '{}',
      north_settings: '{}'
    });
    await db('transformers').del();
    await db('transformers').insert([
      { id: 'records', type: 'standard', function_name: 'file-to-record-list', input_type: 'file', output_type: 'record-list' },
      { id: 'file', type: 'standard', function_name: 'file', input_type: 'file', output_type: 'file' },
      { id: 'customRecords', type: 'custom', name: 'Records', input_type: 'file', output_type: 'record-list' },
      { id: 'customSetpoints', type: 'custom', name: 'Setpoints', input_type: 'setpoint', output_type: 'setpoint' }
    ]);
  });

  afterEach(() => harness.afterEach());

  it('should only send files to the File Writer Norths', async () => {
    const input = { fileType: 'json', rowIteratorPath: '$.rows[*]' };
    await db('north_transformers').insert([
      northLink('records', 'writer', 'records', { input }),
      northLink('file', 'writer', 'file', {}),
      northLink('custom', 'writer', 'customRecords', {}),
      northLink('setpoints', 'writer', 'customSetpoints', null),
      northLink('console', 'console', 'records', { input })
    ]);
    await db('history_query_transformers').insert([
      { id: 'historyRecords', history_id: 'hq1', transformer_id: 'records', options: null },
      { id: 'historyCustom', history_id: 'hq1', transformer_id: 'customRecords', options: null }
    ]);

    await convertFileWriterLinks(db);

    const fileToFile = await db('transformers').where('function_name', 'file-to-file').first('id', 'input_type', 'output_type');
    assert.deepStrictEqual({ ...fileToFile, id: undefined }, { id: undefined, input_type: 'file', output_type: 'file' });
    const fileOptions = (fileInput: object) => ({
      input: fileInput,
      output: { fileType: 'json', encoding: 'UTF_8', compression: false },
      filename: '@CurrentDate.json',
      keepOtherFields: true,
      fields: []
    });
    assert.deepStrictEqual(await linkOf('north_transformers', 'records'), { transformerId: fileToFile.id, options: fileOptions(input) });
    assert.deepStrictEqual(
      (await db('north_transformers').select('id').orderBy('id')).map(link => link.id),
      ['console', 'file', 'records']
    );
    assert.deepStrictEqual(await linkOf('north_transformers', 'console'), { transformerId: 'records', options: { input } });
    assert.deepStrictEqual(await linkOf('history_query_transformers', 'historyRecords'), {
      transformerId: fileToFile.id,
      options: fileOptions({ fileType: 'csv', delimiter: 'SEMI_COLON', hasHeader: true })
    });
    assert.deepStrictEqual(await db('history_query_transformers').select('id'), [{ id: 'historyRecords' }]);
  });

  it('should reuse the file-to-file transformer, and do nothing without transformer sending records or setpoints', async () => {
    await db('transformers').insert({
      id: 'existing',
      type: 'standard',
      function_name: 'file-to-file',
      input_type: 'file',
      output_type: 'file'
    });
    await db('north_transformers').insert(northLink('records', 'writer', 'records', null));

    await convertFileWriterLinks(db);

    assert.strictEqual((await linkOf('north_transformers', 'records')).transformerId, 'existing');

    await db('transformers').whereIn('id', ['records', 'customRecords', 'customSetpoints']).del();
    await convertFileWriterLinks(db);
  });
});

describe('Entity migration v3.10.0: convertOIAnalyticsSouths', () => {
  const harness = createMigrationSchemaHarness({
    buildSchema: db => buildSchemaBeforeStep(convertOIAnalyticsSouths, db)
  });
  let db: Knex;
  const settingsOf = async (table: string, id: string) => JSON.parse((await db(table).where('id', id).first('settings')).settings);

  before(() => harness.before());
  after(() => harness.after());

  beforeEach(async () => {
    await harness.beforeEach();
    db = harness.getDb();
    await db('scan_modes').insert([{ id: 'sm1', name: 'Every minute', description: '', cron: '0 * * * * *' }]);
    await db('south_connectors').insert([
      { id: 'oia', name: 'OIA', type: 'oianalytics', enabled: true, settings: '{}' },
      { id: 'folder', name: 'Folder', type: 'folder-scanner', enabled: true, settings: '{}' }
    ]);
    const item = (id: string, southId: string, settings: string) => ({
      id,
      connector_id: southId,
      scan_mode_id: 'sm1',
      name: id,
      enabled: true,
      settings
    });
    await db('south_items').insert([
      item('i1', 'oia', itemSettings('i1.csv')),
      item('i2', 'oia', itemSettings('i2.csv')),
      item('i3', 'oia', itemSettings('i3.csv')),
      item('f1', 'folder', '{}')
    ]);
    await db('south_item_groups').insert({ id: 'g1', created_at: NOW, updated_at: NOW, name: 'G1', south_id: 'oia', scan_mode_id: 'sm1' });
    await db('group_items').insert({ group_id: 'g1', item_id: 'i2' });
    await db('north_connectors').insert([
      { ...caching, id: 'writer', name: 'Writer', type: 'file-writer', enabled: true, settings: '{}' },
      { ...caching, id: 'mqttNorth', name: 'MQTT', type: 'mqtt', enabled: true, settings: '{}' }
    ]);
    await db('history_queries').insert({
      ...caching,
      id: 'hq',
      name: 'HQ',
      start_time: NOW,
      end_time: NOW,
      south_type: 'oianalytics',
      north_type: 'file-writer',
      south_settings: '{}',
      north_settings: '{}'
    });
    await db('history_items').insert([
      { id: 'h1', history_id: 'hq', name: 'h1', enabled: true, settings: itemSettings('h1.csv') },
      { id: 'h2', history_id: 'hq', name: 'h2', enabled: true, settings: itemSettings('h2.csv') }
    ]);
    await db('transformers').where('type', 'standard').del();
    await db('transformers').insert([
      { id: 'file', type: 'standard', function_name: 'file', input_type: 'file', output_type: 'file' },
      { id: 'fileToMqtt', type: 'standard', function_name: 'file-to-mqtt', input_type: 'file', output_type: 'mqtt' }
    ]);
  });

  afterEach(() => harness.afterEach());

  const southLink = (id: string, northId: string, transformerId: string, southId: string, groupId: string | null = null) => ({
    id,
    north_id: northId,
    transformer_id: transformerId,
    options: '{}',
    source_type: 'south',
    source_south_south_id: southId,
    source_south_group_id: groupId
  });

  it('should write the CSV files of the South OIAnalytics items sent as they are through record-list-to-file', async () => {
    await db('north_transformers').insert([
      // i2 is sent as is through its group, i1 is left out of the South level link, i3 is sent as is
      southLink('group', 'writer', 'file', 'oia', 'g1'),
      southLink('south', 'writer', 'file', 'oia'),
      southLink('mqtt', 'mqttNorth', 'fileToMqtt', 'oia'),
      southLink('folder', 'writer', 'file', 'folder')
    ]);
    await db('north_transformers_items').insert({ id: 'south', item_id: 'i1', excluded: true });
    await db('history_query_transformers').insert([
      { id: 'hItem', history_id: 'hq', transformer_id: 'fileToMqtt', options: '{}' },
      { id: 'hAll', history_id: 'hq', transformer_id: 'file', options: '{}' }
    ]);
    await db('history_query_transformers_items').insert({ id: 'hItem', item_id: 'h1' });

    await convertOIAnalyticsSouths(db);

    const recordListToFile = await db('transformers').where('function_name', 'record-list-to-file').first('id');
    const northLinks = await db('north_transformers').select('id', 'north_id', 'transformer_id', 'options').orderBy('rowid');
    assert.deepStrictEqual(
      northLinks.filter(link => link.transformer_id !== recordListToFile.id).map(link => link.id),
      ['folder']
    );
    const added = northLinks.filter(link => link.transformer_id === recordListToFile.id);
    const itemsOf = async (table: string, id: string) => (await db(table).where('id', id).select('item_id')).map(row => row.item_id);
    assert.deepStrictEqual(
      await Promise.all(added.map(async link => [link.north_id, await itemsOf('north_transformers_items', link.id)])),
      [
        ['writer', ['i2']],
        ['writer', ['i3']]
      ]
    );
    assert.deepStrictEqual(JSON.parse(added[0].options), toOIAnalyticsItemFileOptions(serialization('i2.csv')));
    assert.deepStrictEqual(await settingsOf('south_items', 'i1'), { endpoint: '/api', queryParams: [] });
    assert.deepStrictEqual(await settingsOf('south_items', 'f1'), {});

    const historyLinks = await db('history_query_transformers').select('id', 'transformer_id', 'options');
    assert.deepStrictEqual(historyLinks.length, 1);
    assert.strictEqual(historyLinks[0].transformer_id, recordListToFile.id);
    assert.deepStrictEqual(await itemsOf('history_query_transformers_items', historyLinks[0].id), ['h2']);
    assert.deepStrictEqual(JSON.parse(historyLinks[0].options), toOIAnalyticsItemFileOptions(serialization('h2.csv')));
    assert.deepStrictEqual(await settingsOf('history_items', 'h1'), { endpoint: '/api', queryParams: [] });
  });

  it('should reuse the record-list-to-file transformer, and do nothing once the items are converted', async () => {
    await db('transformers').insert({
      id: 'existing',
      type: 'standard',
      function_name: 'record-list-to-file',
      input_type: 'record-list',
      output_type: 'file'
    });
    await db('north_transformers').insert(southLink('south', 'writer', 'file', 'oia'));

    await convertOIAnalyticsSouths(db);
    const linksAfterFirstRun = await db('north_transformers').select('id', 'transformer_id');
    await convertOIAnalyticsSouths(db);

    assert.deepStrictEqual(await db('north_transformers').select('id', 'transformer_id'), linksAfterFirstRun);
    assert.deepStrictEqual(
      linksAfterFirstRun.map(link => link.transformer_id),
      ['existing', 'existing', 'existing']
    );
  });

  it('should do nothing without South OIAnalytics', async () => {
    await db('history_queries').update({ south_type: 'folder-scanner' });
    await db('south_connectors').where('type', 'oianalytics').update({ type: 'folder-scanner' });

    await convertOIAnalyticsSouths(db);
  });
});

describe('Entity migration v3.10.0: moveCompressionToNorths', () => {
  const harness = createMigrationSchemaHarness({
    buildSchema: db => buildSchemaBeforeStep(moveCompressionToNorths, db)
  });
  let db: Knex;
  const linkOf = async (table: string, id: string) => {
    const link = await db(table).where('id', id).first('transformer_id', 'options');
    return { transformerId: link.transformer_id, options: JSON.parse(link.options) };
  };
  const southLink = (id: string, southId: string, transformerId: string) => ({
    id,
    north_id: 'writer',
    transformer_id: transformerId,
    options: '{}',
    source_type: 'south',
    source_south_south_id: southId
  });
  const historyQuery = (id: string, compression: boolean) => ({
    ...caching,
    id,
    name: id,
    start_time: NOW,
    end_time: NOW,
    south_type: 'sftp',
    north_type: 'file-writer',
    south_settings: JSON.stringify({ host: 'h', compression }),
    north_settings: '{}'
  });

  before(() => harness.before());
  after(() => harness.after());

  beforeEach(async () => {
    await harness.beforeEach();
    db = harness.getDb();
    await db('scan_modes').insert([{ id: 'sm1', name: 'Every minute', description: '', cron: '0 * * * * *' }]);
    await db('south_connectors').insert([
      { id: 'compressed', name: 'Compressed', type: 'folder-scanner', enabled: true, settings: '{"inputFolder":"in","compression":true}' },
      { id: 'raw', name: 'Raw', type: 'ftp', enabled: true, settings: '{"host":"h","compression":false}' },
      { id: 'mqtt', name: 'MQTT', type: 'mqtt', enabled: true, settings: '{"compression":true}' }
    ]);
    await db('north_connectors').insert({ ...caching, id: 'writer', name: 'Writer', type: 'file-writer', enabled: true, settings: '{}' });
    await db('history_queries').insert([historyQuery('hqCompressed', true), historyQuery('hqRaw', false)]);
    await db('transformers').where('type', 'standard').del();
    await db('transformers').insert([
      { id: 'file', type: 'standard', function_name: 'file', input_type: 'file', output_type: 'file' },
      { id: 'fileToOia', type: 'standard', function_name: 'file-to-oianalytics', input_type: 'file', output_type: 'oianalytics' }
    ]);
  });

  afterEach(() => harness.afterEach());

  it('should compress the files of the compressing Souths in file-to-file transformers', async () => {
    await db('north_transformers').insert([
      southLink('compressed', 'compressed', 'file'),
      southLink('converted', 'compressed', 'fileToOia'),
      southLink('raw', 'raw', 'file'),
      southLink('mqtt', 'mqtt', 'file')
    ]);
    await db('history_query_transformers').insert([
      { id: 'hCompressed', history_id: 'hqCompressed', transformer_id: 'file', options: '{}' },
      { id: 'hRaw', history_id: 'hqRaw', transformer_id: 'file', options: '{}' }
    ]);

    await moveCompressionToNorths(db);

    const fileToFile = await db('transformers').where('function_name', 'file-to-file').first('id');
    assert.deepStrictEqual(await linkOf('north_transformers', 'compressed'), {
      transformerId: fileToFile.id,
      options: COMPRESSED_FILE_OPTIONS
    });
    assert.deepStrictEqual(await linkOf('north_transformers', 'converted'), { transformerId: 'fileToOia', options: {} });
    assert.deepStrictEqual(await linkOf('north_transformers', 'raw'), { transformerId: 'file', options: {} });
    assert.deepStrictEqual(await linkOf('north_transformers', 'mqtt'), { transformerId: 'file', options: {} });
    assert.deepStrictEqual(await linkOf('history_query_transformers', 'hCompressed'), {
      transformerId: fileToFile.id,
      options: COMPRESSED_FILE_OPTIONS
    });
    assert.deepStrictEqual(await linkOf('history_query_transformers', 'hRaw'), { transformerId: 'file', options: {} });

    const settingsOf = async (table: string, column: string, id: string) =>
      JSON.parse((await db(table).where('id', id).first(column))[column]);
    assert.deepStrictEqual(await settingsOf('south_connectors', 'settings', 'compressed'), { inputFolder: 'in' });
    assert.deepStrictEqual(await settingsOf('south_connectors', 'settings', 'raw'), { host: 'h' });
    assert.deepStrictEqual(await settingsOf('south_connectors', 'settings', 'mqtt'), { compression: true });
    assert.deepStrictEqual(await settingsOf('history_queries', 'south_settings', 'hqCompressed'), { host: 'h' });
    assert.deepStrictEqual(await settingsOf('history_queries', 'south_settings', 'hqRaw'), { host: 'h' });
  });

  it('should reuse the file-to-file transformer, and do nothing once the settings are removed', async () => {
    await db('transformers').insert({
      id: 'existing',
      type: 'standard',
      function_name: 'file-to-file',
      input_type: 'file',
      output_type: 'file'
    });
    await db('north_transformers').insert(southLink('compressed', 'compressed', 'file'));

    await moveCompressionToNorths(db);
    await moveCompressionToNorths(db);

    assert.strictEqual((await linkOf('north_transformers', 'compressed')).transformerId, 'existing');
  });

  it('should only remove the setting without file transformer', async () => {
    await db('transformers').where('id', 'file').del();

    await moveCompressionToNorths(db);

    assert.deepStrictEqual(JSON.parse((await db('south_connectors').where('id', 'compressed').first('settings')).settings), {
      inputFolder: 'in'
    });
  });
});

describe('Entity migration v3.10.0: mergeSetpointsIntoRecordLists', () => {
  const harness = createMigrationSchemaHarness({
    buildSchema: db => buildSchemaBeforeStep(mergeSetpointsIntoRecordLists, db)
  });
  let db: Knex;
  const linkOf = async (table: string, id: string) => {
    const link = await db(table).where('id', id).first('transformer_id', 'options');
    return { transformerId: link.transformer_id, options: JSON.parse(link.options) };
  };
  const setpointLink = (id: string, northId: string, transformerId: string, options: object | null) => ({
    id,
    north_id: northId,
    transformer_id: transformerId,
    options: options ? JSON.stringify(options) : null,
    source_type: 'oianalytics-setpoint'
  });
  const standard = (id: string, functionName: string, inputType: string, outputType: string) => ({
    id,
    type: 'standard',
    function_name: functionName,
    input_type: inputType,
    output_type: outputType
  });

  before(() => harness.before());
  after(() => harness.after());

  beforeEach(async () => {
    await harness.beforeEach();
    db = harness.getDb();
    await db('scan_modes').insert([{ id: 'sm1', name: 'Every minute', description: '', cron: '0 * * * * *' }]);
    await db('north_connectors').insert(
      ['console', 'modbus', 'mqtt', 'opcua'].map(type => ({ ...caching, id: type, name: type, type, enabled: true, settings: '{}' }))
    );
    await db('transformers').where('type', 'standard').del();
  });

  afterEach(() => harness.afterEach());

  it('should rename the setpoint transformers into the record-list ones, converting their options', async () => {
    await db('transformers').insert([
      standard('json', 'setpoint-to-json', 'setpoint', 'file'),
      standard('modbus', 'setpoint-to-modbus', 'setpoint', 'modbus'),
      standard('mqtt', 'setpoint-to-mqtt', 'setpoint', 'mqtt'),
      standard('opcua', 'setpoint-to-opcua', 'setpoint', 'opcua')
    ]);
    await db('north_transformers').insert([
      setpointLink('console', 'console', 'json', {}),
      setpointLink('modbus', 'modbus', 'modbus', { mapping: [{ reference: 'sp1', address: '0x01', modbusType: 'coil' }] }),
      setpointLink('mqtt', 'mqtt', 'mqtt', { mapping: [{ reference: 'sp1', topic: 'topic/sp1' }] }),
      setpointLink('opcua', 'opcua', 'opcua', { mapping: [{ reference: 'sp1', nodeId: 'ns=1;s=sp1' }] })
    ]);

    await mergeSetpointsIntoRecordLists(db);

    assert.deepStrictEqual(await db('transformers').select('id', 'function_name', 'input_type', 'output_type').orderBy('id'), [
      { id: 'json', function_name: 'record-list-to-file', input_type: 'record-list', output_type: 'file' },
      { id: 'modbus', function_name: 'record-list-to-modbus', input_type: 'record-list', output_type: 'modbus' },
      { id: 'mqtt', function_name: 'record-list-to-mqtt', input_type: 'record-list', output_type: 'mqtt' },
      { id: 'opcua', function_name: 'record-list-to-opcua', input_type: 'record-list', output_type: 'opcua' }
    ]);
    assert.deepStrictEqual(await linkOf('north_transformers', 'console'), {
      transformerId: 'json',
      options: {
        output: { fileType: 'json', encoding: 'UTF_8', compression: false },
        filename: '@CurrentDate.json',
        keepOtherFields: true,
        fields: []
      }
    });
    assert.deepStrictEqual(await linkOf('north_transformers', 'modbus'), {
      transformerId: 'modbus',
      options: { pointIdColumn: 'reference', valueColumn: 'value', mapping: [{ pointId: 'sp1', address: '0x01', modbusType: 'coil' }] }
    });
    assert.deepStrictEqual(await linkOf('north_transformers', 'mqtt'), {
      transformerId: 'mqtt',
      options: { pointIdColumn: 'reference', payload: 'value', valueColumn: 'value', mapping: [{ pointId: 'sp1', topic: 'topic/sp1' }] }
    });
    assert.deepStrictEqual(await linkOf('north_transformers', 'opcua'), {
      transformerId: 'opcua',
      options: { pointIdColumn: 'reference', valueColumn: 'value', mapping: [{ pointId: 'sp1', nodeId: 'ns=1;s=sp1' }] }
    });
  });

  it('should merge the setpoint transformers into the existing record-list ones', async () => {
    await db('transformers').insert([
      standard('setpointToJson', 'setpoint-to-json', 'setpoint', 'file'),
      standard('setpointToMqtt', 'setpoint-to-mqtt', 'setpoint', 'mqtt'),
      standard('recordListToFile', 'record-list-to-file', 'record-list', 'file'),
      standard('recordListToMqtt', 'record-list-to-mqtt', 'record-list', 'mqtt')
    ]);
    await db('north_transformers').insert([
      setpointLink('console', 'console', 'setpointToJson', null),
      setpointLink('mqtt', 'mqtt', 'setpointToMqtt', { mapping: [{ reference: 'sp1', topic: 'topic/sp1' }] }),
      { ...setpointLink('records', 'mqtt', 'recordListToMqtt', { pointIdColumn: 'id', mapping: [] }), source_type: 'oibus-api' }
    ]);
    await db('history_queries').insert({
      ...caching,
      id: 'hq1',
      name: 'HQ 1',
      start_time: NOW,
      end_time: NOW,
      south_type: 'opcua',
      north_type: 'mqtt',
      south_settings: '{}',
      north_settings: '{}'
    });
    await db('history_query_transformers').insert({
      id: 'history',
      history_id: 'hq1',
      transformer_id: 'recordListToMqtt',
      options: JSON.stringify({ pointIdColumn: 'pointId', payload: 'value', valueColumn: 'v', mapping: [] })
    });

    await mergeSetpointsIntoRecordLists(db);

    assert.deepStrictEqual(await db('transformers').select('id', 'function_name').orderBy('id'), [
      { id: 'recordListToFile', function_name: 'record-list-to-file' },
      { id: 'recordListToMqtt', function_name: 'record-list-to-mqtt' }
    ]);
    assert.strictEqual((await linkOf('north_transformers', 'console')).transformerId, 'recordListToFile');
    assert.deepStrictEqual(await linkOf('north_transformers', 'mqtt'), {
      transformerId: 'recordListToMqtt',
      options: { pointIdColumn: 'reference', payload: 'value', valueColumn: 'value', mapping: [{ pointId: 'sp1', topic: 'topic/sp1' }] }
    });
    // The other record-list-to-mqtt links without payload publish the whole record, as before
    assert.deepStrictEqual(await linkOf('north_transformers', 'records'), {
      transformerId: 'recordListToMqtt',
      options: { pointIdColumn: 'id', mapping: [], payload: 'record' }
    });
    assert.deepStrictEqual(await linkOf('history_query_transformers', 'history'), {
      transformerId: 'recordListToMqtt',
      options: { pointIdColumn: 'pointId', payload: 'value', valueColumn: 'v', mapping: [] }
    });
  });

  it('should make the custom transformers reading or writing setpoints read or write records', async () => {
    const custom = (id: string, inputType: string, outputType: string) => ({
      id,
      type: 'custom',
      input_type: inputType,
      output_type: outputType,
      name: id,
      description: '',
      custom_code: '',
      custom_manifest: '{}',
      language: 'javascript',
      timeout: 2000
    });
    await db('transformers').insert([
      custom('reads', 'setpoint', 'mqtt'),
      custom('writes', 'file', 'setpoint'),
      custom('other', 'file', 'file')
    ]);

    await mergeSetpointsIntoRecordLists(db);

    assert.deepStrictEqual(await db('transformers').select('id', 'input_type', 'output_type').orderBy('id'), [
      { id: 'other', input_type: 'file', output_type: 'file' },
      { id: 'reads', input_type: 'record-list', output_type: 'mqtt' },
      { id: 'writes', input_type: 'file', output_type: 'record-list' }
    ]);
  });
});

describe('Entity migration v3.10.0: replaceFileTransformer', () => {
  const harness = createMigrationSchemaHarness({
    buildSchema: db => buildSchemaBeforeStep(replaceFileTransformer, db)
  });
  let db: Knex;
  const fileAsIs = { input: { fileType: 'other' }, filename: '@SourceFilename@SourceExtension', compression: false };
  const linksOf = async (table: string) =>
    (await db(table).select('id', 'transformer_id', 'options').orderBy('id')).map(
      (link: { id: string; transformer_id: string; options: string }) => [link.id, link.transformer_id, JSON.parse(link.options)]
    );
  const standard = (id: string, functionName: string) => ({
    id,
    type: 'standard',
    function_name: functionName,
    input_type: 'file',
    output_type: 'file'
  });
  const northLink = (id: string, transformerId: string, options: object) => ({
    id,
    north_id: 'writer',
    transformer_id: transformerId,
    options: JSON.stringify(options),
    source_type: 'oibus-api'
  });

  before(() => harness.before());
  after(() => harness.after());

  beforeEach(async () => {
    await harness.beforeEach();
    db = harness.getDb();
    await db('scan_modes').insert([{ id: 'sm1', name: 'Every minute', description: '', cron: '0 * * * * *' }]);
    await db('north_connectors').insert({ ...caching, id: 'writer', name: 'writer', type: 'file-writer', enabled: true, settings: '{}' });
    await db('history_queries').insert({
      ...caching,
      id: 'hq1',
      name: 'HQ 1',
      start_time: NOW,
      end_time: NOW,
      south_type: 'folder-scanner',
      north_type: 'file-writer',
      south_settings: '{}',
      north_settings: '{}'
    });
    await db('transformers').where('type', 'standard').del();
  });

  afterEach(() => harness.afterEach());

  it('should rename the file transformer into file-to-file, sending the files as they are', async () => {
    await db('transformers').insert(standard('file', 'file'));
    await db('north_transformers').insert(northLink('north', 'file', {}));
    await db('history_query_transformers').insert({ id: 'history', history_id: 'hq1', transformer_id: 'file', options: '{}' });

    await replaceFileTransformer(db);

    assert.deepStrictEqual(await db('transformers').select('id', 'function_name', 'input_type', 'output_type'), [
      { id: 'file', function_name: 'file-to-file', input_type: 'file', output_type: 'file' }
    ]);
    assert.deepStrictEqual(await linksOf('north_transformers'), [['north', 'file', fileAsIs]]);
    assert.deepStrictEqual(await linksOf('history_query_transformers'), [['history', 'file', fileAsIs]]);
  });

  it('should merge the file transformer into the existing file-to-file one', async () => {
    const compressed = { ...fileAsIs, compression: true };
    await db('transformers').insert([standard('file', 'file'), standard('fileToFile', 'file-to-file')]);
    await db('north_transformers').insert([northLink('asIs', 'file', {}), northLink('compressed', 'fileToFile', compressed)]);

    await replaceFileTransformer(db);

    assert.deepStrictEqual(await db('transformers').select('id', 'function_name'), [{ id: 'fileToFile', function_name: 'file-to-file' }]);
    assert.deepStrictEqual(await linksOf('north_transformers'), [
      ['asIs', 'fileToFile', fileAsIs],
      ['compressed', 'fileToFile', compressed]
    ]);
  });

  it('should do nothing without file transformer', async () => {
    await db('transformers').insert(standard('fileToFile', 'file-to-file'));

    await replaceFileTransformer(db);

    assert.deepStrictEqual(await db('transformers').select('id', 'function_name'), [{ id: 'fileToFile', function_name: 'file-to-file' }]);
  });
});

describe('Entity migration v3.10.0: moveFilenamePrefixAndSuffixToTransformers', () => {
  const harness = createMigrationSchemaHarness({
    buildSchema: db => buildSchemaBeforeStep(moveFilenamePrefixAndSuffixToTransformers, db)
  });
  let db: Knex;
  const fileAsIs = { input: { fileType: 'other' }, filename: '@SourceFilename@SourceExtension', compression: false };
  const linkOptions = async (table: string, id: string) => JSON.parse((await db(table).where('id', id).first('options')).options);
  const northLink = (id: string, northId: string, transformerId: string, options: object) => ({
    id,
    north_id: northId,
    transformer_id: transformerId,
    options: JSON.stringify(options),
    source_type: 'oibus-api'
  });
  const north = (id: string, type: string, settings: object) => ({
    ...caching,
    id,
    name: `North ${id}`,
    type,
    enabled: true,
    settings: JSON.stringify(settings)
  });

  before(() => harness.before());
  after(() => harness.after());

  beforeEach(async () => {
    await harness.beforeEach();
    db = harness.getDb();
    await db('scan_modes').insert([{ id: 'sm1', name: 'Every minute', description: '', cron: '0 * * * * *' }]);
    await db('transformers').where('type', 'standard').del();
    await db('transformers').insert([
      { id: 'fileToFile', type: 'standard', function_name: 'file-to-file', input_type: 'file', output_type: 'file' },
      { id: 'recordListToFile', type: 'standard', function_name: 'record-list-to-file', input_type: 'record-list', output_type: 'file' },
      {
        id: 'custom',
        type: 'custom',
        input_type: 'file',
        output_type: 'file',
        name: 'custom',
        description: '',
        custom_code: '',
        custom_manifest: '{}',
        language: 'javascript',
        timeout: 2000
      }
    ]);
  });

  afterEach(() => harness.afterEach());

  it('should add the prefix and suffix of the File Writer and SFTP norths to the filename of their transformers', async () => {
    const warn = mock.method(console, 'warn', () => undefined);
    await db('north_connectors').insert([
      north('writer', 'file-writer', { outputFolder: 'out', prefix: '@ConnectorName-', suffix: '-@CurrentDate' }),
      north('sftp', 'sftp', { remoteFolder: 'remote', prefix: 'pre_', suffix: null }),
      north('empty', 'file-writer', { outputFolder: 'out', prefix: '', suffix: '' })
    ]);
    await db('north_transformers').insert([
      northLink('asIs', 'writer', 'fileToFile', fileAsIs),
      northLink('csv', 'writer', 'fileToFile', { input: { fileType: 'json' }, filename: '@CurrentDate.csv' }),
      northLink('records', 'sftp', 'recordListToFile', { filename: '@ItemName' }),
      northLink('custom', 'writer', 'custom', {}),
      northLink('empty', 'empty', 'fileToFile', fileAsIs)
    ]);
    await db('history_queries').insert({
      ...caching,
      id: 'hq1',
      name: 'HQ 1',
      start_time: NOW,
      end_time: NOW,
      south_type: 'folder-scanner',
      north_type: 'sftp',
      south_settings: '{}',
      north_settings: JSON.stringify({ remoteFolder: 'remote', prefix: '', suffix: '_@ConnectorName' })
    });
    await db('history_query_transformers').insert({
      id: 'history',
      history_id: 'hq1',
      transformer_id: 'fileToFile',
      options: JSON.stringify(fileAsIs)
    });

    await moveFilenamePrefixAndSuffixToTransformers(db);

    const settingsOf = async (table: string, column: string, id: string) =>
      JSON.parse((await db(table).where('id', id).first(column))[column]);
    assert.deepStrictEqual(await settingsOf('north_connectors', 'settings', 'writer'), { outputFolder: 'out' });
    assert.deepStrictEqual(await settingsOf('north_connectors', 'settings', 'sftp'), { remoteFolder: 'remote' });
    assert.deepStrictEqual(await settingsOf('north_connectors', 'settings', 'empty'), { outputFolder: 'out' });
    assert.deepStrictEqual(await settingsOf('history_queries', 'north_settings', 'hq1'), { remoteFolder: 'remote' });
    assert.deepStrictEqual(await linkOptions('north_transformers', 'asIs'), {
      ...fileAsIs,
      filename: 'North writer-@SourceFilename-@CurrentDate@SourceExtension'
    });
    assert.deepStrictEqual(await linkOptions('north_transformers', 'csv'), {
      input: { fileType: 'json' },
      filename: 'North writer-@CurrentDate-@CurrentDate.csv'
    });
    assert.deepStrictEqual(await linkOptions('north_transformers', 'records'), { filename: 'pre_@ItemName' });
    assert.deepStrictEqual(await linkOptions('north_transformers', 'custom'), {});
    assert.deepStrictEqual(await linkOptions('north_transformers', 'empty'), fileAsIs);
    assert.deepStrictEqual(await linkOptions('history_query_transformers', 'history'), {
      ...fileAsIs,
      filename: '@SourceFilename_HQ 1@SourceExtension'
    });
    // The custom transformers name the files themselves
    assert.strictEqual(warn.mock.callCount(), 1);
    warn.mock.restore();
  });

  it('should leave the other norths untouched', async () => {
    const settings = { host: 'h', prefix: 'not-a-prefix' };
    await db('north_connectors').insert(north('mqtt', 'mqtt', settings));
    await db('north_transformers').insert(northLink('link', 'mqtt', 'fileToFile', fileAsIs));

    await moveFilenamePrefixAndSuffixToTransformers(db);

    assert.deepStrictEqual(JSON.parse((await db('north_connectors').where('id', 'mqtt').first('settings')).settings), settings);
    assert.deepStrictEqual(await linkOptions('north_transformers', 'link'), fileAsIs);
  });
});

describe('Entity migration v3.10.0: addOPCUATimeoutsAndSubscriptionSettings', () => {
  const harness = createMigrationSchemaHarness({
    buildSchema: db => buildSchemaBeforeStep(addOPCUATimeoutsAndSubscriptionSettings, db)
  });
  let db: Knex;
  const settingsOf = async (table: string, column: string, id: string) =>
    JSON.parse((await db(table).where('id', id).first(column))[column]);
  const historyQuery = (id: string, southType: string, northType: string, southSettings: object, northSettings: object) => ({
    ...caching,
    id,
    name: id,
    start_time: NOW,
    end_time: NOW,
    south_type: southType,
    north_type: northType,
    south_settings: JSON.stringify(southSettings),
    north_settings: JSON.stringify(northSettings)
  });
  const oldSouth = { url: 'opc.tcp://localhost', readTimeout: 20_000, maxNumberOfMessages: 500, flushMessageTimeout: 2000 };
  const newSouth = {
    url: 'opc.tcp://localhost',
    readTimeout: 20_000,
    connectionTimeout: 15_000,
    subscription: {
      publishingInterval: 150,
      maxKeepAliveCount: 10,
      numberOfMessageBeforeFlush: 500,
      delayBetweenFlush: 2000
    }
  };

  before(() => harness.before());
  after(() => harness.after());

  beforeEach(async () => {
    await harness.beforeEach();
    db = harness.getDb();
    await db('scan_modes').insert([{ id: 'sm1', name: 'Every minute', description: '', cron: '0 * * * * *' }]);
  });

  afterEach(() => harness.afterEach());

  it('should add the connection timeout and the subscription settings of the OPC UA souths, moving the flush settings', async () => {
    await db('south_connectors').insert([
      { id: 'opcua', name: 'OPCUA', type: 'opcua', enabled: true, settings: JSON.stringify(oldSouth) },
      { id: 'mqtt', name: 'MQTT', type: 'mqtt', enabled: true, settings: JSON.stringify({ maxNumberOfMessages: 1 }) }
    ]);
    await db('history_queries').insert([
      historyQuery('hq-opcua', 'opcua', 'console', oldSouth, {}),
      historyQuery('hq-mqtt', 'mqtt', 'console', { maxNumberOfMessages: 1 }, {})
    ]);

    await addOPCUATimeoutsAndSubscriptionSettings(db);

    assert.deepStrictEqual(await settingsOf('south_connectors', 'settings', 'opcua'), newSouth);
    assert.deepStrictEqual(await settingsOf('history_queries', 'south_settings', 'hq-opcua'), newSouth);
    assert.deepStrictEqual(await settingsOf('south_connectors', 'settings', 'mqtt'), { maxNumberOfMessages: 1 });
    assert.deepStrictEqual(await settingsOf('history_queries', 'south_settings', 'hq-mqtt'), { maxNumberOfMessages: 1 });
  });

  it('should use the default flush settings when the OPC UA south has none', async () => {
    await db('south_connectors').insert({ id: 'opcua', name: 'OPCUA', type: 'opcua', enabled: true, settings: '{}' });

    await addOPCUATimeoutsAndSubscriptionSettings(db);

    assert.deepStrictEqual(await settingsOf('south_connectors', 'settings', 'opcua'), {
      connectionTimeout: 15_000,
      subscription: {
        publishingInterval: 150,
        maxKeepAliveCount: 10,
        numberOfMessageBeforeFlush: 1000,
        delayBetweenFlush: 1000
      }
    });
  });

  it('should add the connection and write timeouts of the OPC UA norths', async () => {
    await db('north_connectors').insert([
      { ...caching, id: 'opcua', name: 'OPCUA', type: 'opcua', enabled: true, settings: JSON.stringify({ url: 'opc.tcp://localhost' }) },
      { ...caching, id: 'mqtt', name: 'MQTT', type: 'mqtt', enabled: true, settings: JSON.stringify({ host: 'h' }) }
    ]);
    await db('history_queries').insert([
      historyQuery('hq-opcua', 'console', 'opcua', {}, { url: 'opc.tcp://localhost', connectionTimeout: 5000 }),
      historyQuery('hq-mqtt', 'console', 'mqtt', {}, { host: 'h' })
    ]);

    await addOPCUATimeoutsAndSubscriptionSettings(db);

    assert.deepStrictEqual(await settingsOf('north_connectors', 'settings', 'opcua'), {
      url: 'opc.tcp://localhost',
      connectionTimeout: 15_000,
      writeTimeout: 15_000
    });
    // An already set timeout is kept
    assert.deepStrictEqual(await settingsOf('history_queries', 'north_settings', 'hq-opcua'), {
      url: 'opc.tcp://localhost',
      connectionTimeout: 5000,
      writeTimeout: 15_000
    });
    assert.deepStrictEqual(await settingsOf('north_connectors', 'settings', 'mqtt'), { host: 'h' });
    assert.deepStrictEqual(await settingsOf('history_queries', 'north_settings', 'hq-mqtt'), { host: 'h' });
  });
});

describe('Entity migration v3.10.0: addItemAndWorkflowDescriptions', () => {
  const harness = createMigrationSchemaHarness({
    buildSchema: db => buildSchemaBeforeStep(addItemAndWorkflowDescriptions, db)
  });
  const TABLES = ['south_items', 'history_items', 'configuration_workflows'];
  let db: Knex;

  before(() => harness.before());
  after(() => harness.after());

  beforeEach(async () => {
    await harness.beforeEach();
    db = harness.getDb();
    await db('scan_modes').insert([{ id: 'sm1', name: 'Every minute', description: '', cron: '0 * * * * *' }]);
    await db('south_connectors').insert({ id: 'south1', name: 'South', type: 'mqtt', enabled: true, settings: '{}' });
    await db('south_items').insert({
      id: 'item1',
      name: 'Item',
      enabled: true,
      connector_id: 'south1',
      scan_mode_id: 'sm1',
      settings: '{}'
    });
  });

  afterEach(() => harness.afterEach());

  it('should add a description column, null for the existing rows', async () => {
    await addItemAndWorkflowDescriptions(db);

    for (const table of TABLES) {
      assert.ok((await columnNames(db, table)).includes('description'), `${table}.description added`);
    }
    assert.strictEqual((await db('south_items').where('id', 'item1').first('description')).description, null);
  });

  it('should drop the description columns on down', async () => {
    await runStepsFrom(addItemAndWorkflowDescriptions, db);
    await down(db);

    for (const table of ['south_items', 'history_items']) {
      assert.ok(!(await columnNames(db, table)).includes('description'), `${table}.description removed`);
    }
    assert.strictEqual((await db('south_items').select('id')).length, 1);
  });
});

describe('Entity migration v3.10.0: addEmptyIntervalStrategies', () => {
  const harness = createMigrationSchemaHarness({
    buildSchema: db => buildSchemaBeforeStep(addEmptyIntervalStrategies, db)
  });
  let db: Knex;

  before(() => harness.before());
  after(() => harness.after());

  beforeEach(async () => {
    await harness.beforeEach();
    db = harness.getDb();
    await db('scan_modes').insert([{ id: 'sm1', name: 'Every minute', description: '', cron: '0 * * * * *' }]);
    await db('south_connectors').insert([
      { id: 'mysql1', name: 'MySQL', type: 'mysql', enabled: true, settings: '{}' },
      { id: 'mqtt1', name: 'MQTT', type: 'mqtt', enabled: true, settings: '{}' }
    ]);
    await db('south_item_groups').insert([
      { id: 'group1', created_at: NOW, updated_at: NOW, name: 'Group 1', south_id: 'mysql1', scan_mode_id: 'sm1' },
      { id: 'group2', created_at: NOW, updated_at: NOW, name: 'Group 2', south_id: 'mqtt1', scan_mode_id: 'sm1' }
    ]);
    await db('south_items').insert([
      { id: 'item1', name: 'Item 1', enabled: true, connector_id: 'mysql1', scan_mode_id: 'sm1', settings: '{}' },
      { id: 'item2', name: 'Item 2', enabled: true, connector_id: 'mqtt1', scan_mode_id: 'sm1', settings: '{}' }
    ]);
  });

  afterEach(() => harness.afterEach());

  it('should keep the tracked instant of the history items and groups, and leave the others null', async () => {
    await addEmptyIntervalStrategies(db);

    assert.deepStrictEqual(await db('south_item_groups').select('id', 'empty_interval_strategy').orderBy('id'), [
      { id: 'group1', empty_interval_strategy: 'keep' },
      { id: 'group2', empty_interval_strategy: null }
    ]);
    assert.deepStrictEqual(await db('south_items').select('id', 'empty_interval_strategy').orderBy('id'), [
      { id: 'item1', empty_interval_strategy: 'keep' },
      { id: 'item2', empty_interval_strategy: null }
    ]);
  });

  it('should drop the empty interval strategy columns on down', async () => {
    await runStepsFrom(addEmptyIntervalStrategies, db);
    await down(db);

    assert.ok(!(await columnNames(db, 'south_items')).includes('empty_interval_strategy'));
    assert.ok(!(await columnNames(db, 'south_item_groups')).includes('empty_interval_strategy'));
    assert.strictEqual((await db('south_items').select('id')).length, 2);
  });
});

describe('Entity migration v3.10.0: addDatabaseConnectionSettings', () => {
  const harness = createMigrationSchemaHarness({
    buildSchema: db => buildSchemaBeforeStep(addDatabaseConnectionSettings, db)
  });
  let db: Knex;
  const settingsOf = async (table: string, column: string, id: string) =>
    JSON.parse((await db(table).where('id', id).first(column))[column]);
  const historyQuery = (id: string, southType: string, southSettings: object) => ({
    ...caching,
    id,
    name: id,
    start_time: NOW,
    end_time: NOW,
    south_type: southType,
    north_type: 'console',
    south_settings: JSON.stringify(southSettings),
    north_settings: '{}'
  });

  before(() => harness.before());
  after(() => harness.after());

  beforeEach(async () => {
    await harness.beforeEach();
    db = harness.getDb();
    await db('scan_modes').insert([{ id: 'sm1', name: 'Every minute', description: '', cron: '0 * * * * *' }]);
  });

  afterEach(() => harness.afterEach());

  it('should group the connection settings of the database souths and keep their queries sequential', async () => {
    await db('south_connectors').insert([
      {
        id: 'mssql',
        name: 'MSSQL',
        type: 'mssql',
        enabled: true,
        settings: JSON.stringify({ host: 'h', port: 1433, domain: null, requestTimeout: 5000 })
      },
      { id: 'influxdb', name: 'InfluxDB', type: 'influxdb', enabled: true, settings: JSON.stringify({ version: '3', url: 'u' }) },
      { id: 'odbc', name: 'ODBC', type: 'odbc', enabled: true, settings: JSON.stringify({ remoteAgent: true }) },
      { id: 'oledb', name: 'OLEDB', type: 'oledb', enabled: true, settings: JSON.stringify({ agentUrl: 'u' }) }
    ]);
    await db('history_queries').insert([
      historyQuery('hq-postgresql', 'postgresql', { host: 'h', sslMode: true }),
      historyQuery('hq-mysql', 'mysql', { host: 'h' }),
      historyQuery('hq-oracle', 'oracle', { thickMode: false, host: 'h', maxParallelRun: 3 }),
      historyQuery('hq-sqlite', 'sqlite', { databasePath: 'p' })
    ]);

    await db('south_items').insert([
      { id: 'mssql-item', name: 'MSSQL item', enabled: true, connector_id: 'mssql', scan_mode_id: 'sm1', settings: '{"query":"q"}' },
      { id: 'odbc-item', name: 'ODBC item', enabled: true, connector_id: 'odbc', scan_mode_id: 'sm1', settings: '{"query":"q"}' }
    ]);
    await db('history_items').insert([
      { id: 'postgresql-item', history_id: 'hq-postgresql', name: 'PostgreSQL item', enabled: true, settings: '{"query":"q"}' },
      { id: 'mysql-item', history_id: 'hq-mysql', name: 'MySQL item', enabled: true, settings: '{"query":"q","requestTimeout":2000}' }
    ]);

    await addDatabaseConnectionSettings(db);

    // The request timeout of the MSSQL and PostgreSQL connectors moves to their items, the default one when missing
    assert.deepStrictEqual(await settingsOf('south_items', 'settings', 'mssql-item'), { query: 'q', requestTimeout: 5000 });
    assert.deepStrictEqual(await settingsOf('history_items', 'settings', 'postgresql-item'), { query: 'q', requestTimeout: 15_000 });
    assert.deepStrictEqual(await settingsOf('south_items', 'settings', 'odbc-item'), { query: 'q' });
    assert.deepStrictEqual(await settingsOf('history_items', 'settings', 'mysql-item'), { query: 'q', requestTimeout: 2000 });
    assert.deepStrictEqual(await settingsOf('south_connectors', 'settings', 'mssql'), {
      connectionSettings: { host: 'h', port: 1433, domain: null, idleTimeout: 30_000 },
      maxParallelRun: 1
    });
    // No connection pool for InfluxDB
    assert.deepStrictEqual(await settingsOf('south_connectors', 'settings', 'influxdb'), {
      connectionSettings: { version: '3', url: 'u' },
      maxParallelRun: 1
    });
    assert.deepStrictEqual(await settingsOf('south_connectors', 'settings', 'odbc'), { remoteAgent: true, maxParallelRun: 1 });
    assert.deepStrictEqual(await settingsOf('south_connectors', 'settings', 'oledb'), { agentUrl: 'u' });
    assert.deepStrictEqual(await settingsOf('history_queries', 'south_settings', 'hq-postgresql'), {
      connectionSettings: { host: 'h', sslMode: true, idleTimeout: 30_000 },
      maxParallelRun: 1
    });
    // An already set value is kept
    assert.deepStrictEqual(await settingsOf('history_queries', 'south_settings', 'hq-oracle'), {
      connectionSettings: { thickMode: false, host: 'h', idleTimeout: 30_000 },
      maxParallelRun: 3
    });
    assert.deepStrictEqual(await settingsOf('history_queries', 'south_settings', 'hq-sqlite'), { databasePath: 'p' });
  });
});
