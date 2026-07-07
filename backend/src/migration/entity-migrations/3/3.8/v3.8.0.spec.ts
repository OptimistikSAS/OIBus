import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { readdirSync } from 'node:fs';
import knex, { Knex } from 'knex';
import { up, down } from './v3.8.0';

/**
 * Collect every entity migration file (excluding specs) under the entity-migrations root,
 * sorted lexicographically by filename — the same order OIBus's migration runner uses.
 */
function entityMigrationFiles(): Array<{ file: string; full: string }> {
  const root = path.resolve(__dirname, '..', '..'); // .../entity-migrations
  const collect = (base: string): Array<{ file: string; full: string }> => {
    const out: Array<{ file: string; full: string }> = [];
    for (const entry of readdirSync(base, { withFileTypes: true })) {
      const full = path.join(base, entry.name);
      if (entry.isDirectory()) {
        out.push(...collect(full));
      } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts')) {
        out.push({ file: entry.name, full });
      }
    }
    return out;
  };
  return collect(root).sort((a, b) => (a.file > b.file ? 1 : a.file < b.file ? -1 : 0));
}

/** Build the real schema as it exists just before v3.8.0 by running every prior migration in order. */
async function buildPreV380Schema(db: Knex): Promise<void> {
  const priorFiles = entityMigrationFiles().filter(f => f.file < 'v3.8.0');
  for (const { full } of priorFiles) {
    const migration = (await import(full)) as { up: (k: Knex) => Promise<void> };
    await migration.up(db);
  }
}

async function tableExists(db: Knex, table: string): Promise<boolean> {
  const row = await db.raw(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`, [table]);
  return (row as Array<unknown>).length > 0;
}

async function columnNames(db: Knex, table: string): Promise<Array<string>> {
  const cols = (await db.raw(`PRAGMA table_info(${table})`)) as Array<{ name: string }>;
  return cols.map(c => c.name);
}

const STANDARD_TRANSFORMER_FUNCTIONS = [
  'csv-to-mqtt',
  'csv-to-time-values',
  'ignore',
  'iso',
  'json-to-csv',
  'time-values-to-csv',
  'time-values-to-json',
  'time-values-to-modbus',
  'time-values-to-mqtt',
  'time-values-to-oianalytics',
  'time-values-to-opcua',
  'setpoint-to-modbus',
  'setpoint-to-mqtt',
  'setpoint-to-opcua'
];

// --- Row builders matching the evolved pre-3.8.0 schema (see v3.7.8 recreations) --- //
function scanModeRow(id: string, name: string): Record<string, unknown> {
  return { id, name, description: '', cron: '* * * * * *' };
}

function southRow(fields: Record<string, unknown>): Record<string, unknown> {
  return { description: '', enabled: 0, settings: '{}', ...fields };
}

function southItemRow(fields: Record<string, unknown>): Record<string, unknown> {
  return { enabled: 0, settings: '{}', ...fields };
}

function northRow(fields: Record<string, unknown>): Record<string, unknown> {
  return {
    description: '',
    enabled: 0,
    settings: '{}',
    caching_trigger_schedule: 'unused',
    caching_trigger_number_of_elements: 0,
    caching_trigger_number_of_files: 0,
    caching_throttling_cache_max_size: 0,
    caching_throttling_max_number_of_elements: 0,
    caching_error_retry_interval: 0,
    caching_error_retry_count: 0,
    caching_archive_enabled: 0,
    caching_archive_retention_duration: 0,
    ...fields
  };
}

function historyRow(fields: Record<string, unknown>): Record<string, unknown> {
  return {
    status: 'PENDING',
    description: '',
    start_time: '2024-01-01T00:00:00.000Z',
    end_time: '2024-01-02T00:00:00.000Z',
    south_type: 'opcua',
    north_type: 'file-writer',
    south_settings: JSON.stringify({ throttling: { maxReadInterval: 1000, readDelay: 200, overlap: 0 } }),
    north_settings: '{}',
    caching_trigger_schedule: 'unused',
    caching_trigger_number_of_elements: 0,
    caching_trigger_number_of_files: 0,
    caching_throttling_cache_max_size: 0,
    caching_throttling_max_number_of_elements: 0,
    caching_error_retry_interval: 0,
    caching_error_retry_count: 0,
    caching_archive_enabled: 0,
    caching_archive_retention_duration: 0,
    ...fields
  };
}

describe('Entity migration v3.8.0', () => {
  let db: Knex;
  let tmpDir: string;
  let dbFile: string;

  before(async () => {
    // File-based SQLite is required: several steps recreate tables (dropColumns / drop+create),
    // which need a real file connection.
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'oibus-entity-v380-'));
    dbFile = path.join(tmpDir, 'test.db');
  });

  after(async () => {
    await db?.destroy();
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  beforeEach(async () => {
    await db?.destroy();
    await fs.rm(dbFile, { force: true });
    db = knex({ client: 'better-sqlite3', connection: { filename: dbFile }, useNullAsDefault: true });
    await buildPreV380Schema(db);
  });

  describe('schema and default transformers', () => {
    it('runs end-to-end on a realistic pre-3.8.0 schema', async () => {
      await up(db); // must not throw
    });

    it('seeds all standard transformers', async () => {
      await up(db);
      const rows = await db('transformers').where('type', 'standard').select('function_name');
      const names = new Set(rows.map(r => r.function_name));
      for (const fn of STANDARD_TRANSFORMER_FUNCTIONS) {
        assert.ok(names.has(fn), `standard transformer "${fn}" should be seeded`);
      }
    });

    it('applies the expected schema changes', async () => {
      await up(db);

      // makeSouthItemScanModeIdNullable
      const southItemCols = (await db.raw('PRAGMA table_info(south_items)')) as Array<{ name: string; notnull: number }>;
      const scanModeCol = southItemCols.find(c => c.name === 'scan_mode_id');
      assert.ok(scanModeCol && scanModeCol.notnull === 0, 'south_items.scan_mode_id should be nullable');

      // addCreatedByAndUpdatedBy
      assert.ok((await columnNames(db, 'south_connectors')).includes('created_by'), 'south_connectors.created_by added');
      assert.ok((await columnNames(db, 'south_connectors')).includes('updated_by'), 'south_connectors.updated_by added');

      // createSouthItemGroupsTable / addTransformersItems
      assert.ok(await tableExists(db, 'south_item_groups'), 'south_item_groups table created');
      assert.ok(await tableExists(db, 'north_transformers_items'), 'north_transformers_items table created');

      // migrateSubscriptionsToTransformers: subscription table dropped, north_transformers reshaped
      assert.ok(!(await tableExists(db, 'subscription')), 'old subscription table dropped');
      const northTransformerCols = await columnNames(db, 'north_transformers');
      assert.ok(northTransformerCols.includes('source_south_south_id'), 'north_transformers gains source_south_south_id');
      assert.ok(!northTransformerCols.includes('input_type'), 'north_transformers no longer has input_type');
    });
  });

  describe('seeded MQTT custom transformer', () => {
    beforeEach(async () => {
      // The custom "mqtt-transformer" is only created when at least one MQTT South exists.
      await db('south_connectors').insert({ id: 'mqttSo', name: 'MQTT', type: 'mqtt', enabled: 0, settings: '{}' });
    });

    it('creates the mqtt custom transformer with the correct argument order (regression guard)', async () => {
      await up(db);

      const transformer = await db('transformers').where({ type: 'custom', name: 'mqtt-transformer' }).first();
      assert.ok(transformer, 'a custom mqtt-transformer should be created');
      assert.strictEqual(transformer.input_type, 'any-content');
      assert.strictEqual(transformer.output_type, 'time-values');

      const code: string = transformer.custom_code;
      // The sandbox calls transforms as (content, source, filename, options). The seeded code MUST
      // match that order, otherwise `filename` receives the options object and a JSON value ends up
      // in lastContentSent / the metrics database (the bug this guards against).
      assert.ok(
        code.includes('content: string, source: any, filename: string, options: any'),
        'transform must use the (content, source, filename, options) signature'
      );
      assert.ok(
        !code.includes('content: string, options: any, source: any, filename: string'),
        'transform must NOT use the buggy (content, options, source, filename) signature'
      );
      // The engine reads `numberOfElement` (singular), not `numberOfElements`.
      assert.ok(!code.includes('numberOfElements'), 'return field must be numberOfElement, not numberOfElements');
    });
  });

  // Seed rows into the pre-3.8.0 tables with foreign-key checks disabled, so orphaned/cross-table
  // references (mirroring real-world data) can be inserted without tripping constraints. FK checks
  // are left off — matching the default better-sqlite3 connection state under which up() is exercised.
  const seed = async (fn: () => Promise<void>): Promise<void> => {
    await db.raw('PRAGMA foreign_keys = OFF');
    await fn();
  };

  describe('row-processing branches', () => {
    it('down is a no-op', async () => {
      await assert.doesNotReject(() => down(db));
    });

    it('stamps created_by/updated_by from the admin user, seeds registration flags and converts REST settings', async () => {
      const oldRest = {
        host: 'http://host',
        acceptUnauthorized: true,
        endpoint: '/api',
        testPath: '/test',
        timeout: 30,
        authType: 'basic' as const,
        bearerAuthToken: null,
        basicAuthUsername: 'user',
        basicAuthPassword: 'pass',
        queryParams: [{ key: 'a', value: 'b' }],
        useProxy: true,
        proxyUrl: 'http://proxy',
        proxyUsername: 'pu',
        proxyPassword: 'pp'
      };

      await seed(async () => {
        await db('scan_modes').insert(scanModeRow('sm1', 'sm1'));
        await db('users').insert({ id: 'admin-1', login: 'admin', password: 'secret' });
        await db('registrations').insert({ id: 'reg-1', host: 'http://localhost' });
        await db('north_connectors').insert(northRow({ id: 'n-rest', name: 'n-rest', type: 'rest', settings: JSON.stringify(oldRest) }));
        await db('history_queries').insert(
          historyRow({
            id: 'h-rest',
            name: 'h-rest',
            north_type: 'rest',
            south_type: 'opcua',
            north_settings: JSON.stringify({ ...oldRest, authType: 'bearer', bearerAuthToken: 'tok' }),
            south_settings: JSON.stringify({ throttling: { maxReadInterval: 3000, readDelay: 500, overlap: 0 }, sharedConnection: true })
          })
        );
      });

      await up(db);

      // addCreatedByAndUpdatedBy — admin user branch
      const north = await db('north_connectors').where('id', 'n-rest').first();
      assert.strictEqual(north.created_by, 'admin-1');
      assert.strictEqual(north.updated_by, 'admin-1');

      // updateRegistrationSettings — new command flags default to true (stored as 1)
      const reg = await db('registrations').where('id', 'reg-1').first();
      assert.strictEqual(reg.command_create_custom_transformer, 1);
      assert.strictEqual(reg.command_search_history_cache_content, 1);
      assert.strictEqual(reg.command_test_custom_transformer, 1);

      // updateNorthRestConnectors — north connector settings converted
      const newNorthSettings = JSON.parse(north.settings);
      assert.strictEqual(newNorthSettings.method, 'POST');
      assert.strictEqual(newNorthSettings.sendAs, 'file');
      assert.strictEqual(newNorthSettings.authentication.type, 'basic');
      assert.strictEqual(newNorthSettings.authentication.username, 'user');
      assert.strictEqual(newNorthSettings.proxy.useProxy, true);
      assert.strictEqual(newNorthSettings.queryParams.length, 1);
      assert.strictEqual(newNorthSettings.test.testEndpoint, '/test');

      // updateNorthRestConnectors — history query north settings converted
      const history = await db('history_queries').where('id', 'h-rest').first();
      const newHistoryNorth = JSON.parse(history.north_settings);
      assert.strictEqual(newHistoryNorth.method, 'POST');
      assert.strictEqual(newHistoryNorth.authentication.type, 'bearer');
      assert.strictEqual(newHistoryNorth.authentication.token, 'tok');

      // removeThrottlingFieldsInConnectorSettings — history throttling moved to columns, removed from settings
      assert.strictEqual(history.throttling_max_read_interval, 3000);
      assert.strictEqual(history.throttling_read_delay, 500);
      const newHistorySouth = JSON.parse(history.south_settings);
      assert.strictEqual(newHistorySouth.throttling, undefined);
      assert.strictEqual(newHistorySouth.sharedConnection, undefined);
    });

    it('migrates subscriptions into north/history transformers', async () => {
      await seed(async () => {
        await db('scan_modes').insert(scanModeRow('sm1', 'sm1'));
        await db('south_connectors').insert(
          southRow({
            id: 'so-opcua',
            name: 'so-opcua',
            type: 'opcua',
            settings: JSON.stringify({ throttling: { maxReadInterval: 1000, readDelay: 200, overlap: 0 }, sharedConnection: true })
          })
        );
        await db('south_connectors').insert(southRow({ id: 'so-file', name: 'so-file', type: 'folder-scanner' }));
        await db('north_connectors').insert(northRow({ id: 'no-1', name: 'no-1', type: 'file-writer' }));
        await db('transformers').insert({
          id: 'tr-1',
          type: 'custom',
          input_type: 'time-values',
          output_type: 'oianalytics',
          name: 'tr-1'
        });
        await db('north_transformers').insert({ north_id: 'no-1', transformer_id: 'tr-1', options: '{"k":1}', input_type: 'time-values' });
        await db('history_queries').insert(historyRow({ id: 'h-1', name: 'h-1' }));
        await db('history_query_transformers').insert({
          history_id: 'h-1',
          transformer_id: 'tr-1',
          options: '{"opt":1}',
          input_type: 'time-values'
        });
        // opcua south -> input_type 'time-values' -> matches existing north_transformer config
        await db('subscription').insert({ north_connector_id: 'no-1', south_connector_id: 'so-opcua' });
        // folder-scanner south -> input_type 'any' -> no matching config -> falls back to iso transformer
        await db('subscription').insert({ north_connector_id: 'no-1', south_connector_id: 'so-file' });
        // orphaned subscription -> south does not exist -> skipped
        await db('subscription').insert({ north_connector_id: 'no-1', south_connector_id: 'ghost-south' });
      });

      await up(db);

      const iso = await db('transformers').where('function_name', 'iso').first();

      const matched = await db('north_transformers').where('source_south_south_id', 'so-opcua').first();
      assert.ok(matched, 'a north_transformer should link to the opcua south');
      assert.strictEqual(matched.source_type, 'south');
      assert.strictEqual(matched.transformer_id, 'tr-1');
      assert.strictEqual(matched.options, '{"k":1}');

      const fallback = await db('north_transformers').where('source_south_south_id', 'so-file').first();
      assert.ok(fallback, 'a north_transformer should link to the folder-scanner south');
      assert.strictEqual(fallback.transformer_id, iso.id);
      assert.strictEqual(fallback.options, null);

      // orphaned subscription produced no row
      const rowsForGhost = await db('north_transformers').where('source_south_south_id', 'ghost-south');
      assert.strictEqual(rowsForGhost.length, 0);

      // history_query_transformers rebuilt with a fresh id, options preserved
      const hqt = await db('history_query_transformers').where('history_id', 'h-1').first();
      assert.ok(hqt, 'history query transformer row should be re-created');
      assert.strictEqual(hqt.transformer_id, 'tr-1');
      assert.strictEqual(hqt.options, '{"opt":1}');
      assert.ok(hqt.id, 'a new uuid id should be assigned');
    });

    it('rewrites file-connector item settings (recursive/maxFiles/maxSize)', async () => {
      await seed(async () => {
        await db('scan_modes').insert(scanModeRow('sm1', 'sm1'));
        await db('south_connectors').insert(southRow({ id: 'so-fs', name: 'so-fs', type: 'sftp' }));
        await db('south_items').insert(
          southItemRow({
            id: 'it-fs',
            connector_id: 'so-fs',
            scan_mode_id: 'sm1',
            name: 'it-fs',
            settings: JSON.stringify({ regex: '*.csv', preserveFiles: true })
          })
        );
      });

      await up(db);

      const item = await db('south_items').where('id', 'it-fs').first();
      const settings = JSON.parse(item.settings);
      assert.strictEqual(settings.recursive, false);
      assert.strictEqual(settings.maxFiles, 0);
      assert.strictEqual(settings.maxSize, 0);
      assert.strictEqual(settings.regex, '*.csv');

      // createFileCacheMigrationHints captured the original values
      const hint = await db('_migration_v380_file_connector_hints').where('item_id', 'it-fs').first();
      assert.ok(hint);
      assert.strictEqual(hint.preserve_files, 1);
      assert.strictEqual(hint.regex, '*.csv');
    });

    it('migrates MQTT south items into custom-transformer instances and strips item settings', async () => {
      const jsonPayload = {
        useArray: true,
        dataArrayPath: 'data.items',
        valuePath: 'value',
        pointIdOrigin: 'payload',
        pointIdPath: 'meta.0.id',
        timestampOrigin: 'payload',
        timestampPayload: { timestampPath: 'meta.ts', timestampType: 'iso-string' }
      };

      await seed(async () => {
        await db('scan_modes').insert(scanModeRow('sm1', 'sm1'));
        await db('south_connectors').insert(southRow({ id: 'so-mqtt', name: 'so-mqtt', type: 'mqtt' }));
        await db('south_items').insert(
          southItemRow({
            id: 'i1',
            connector_id: 'so-mqtt',
            scan_mode_id: 'sm1',
            name: 'i1',
            settings: JSON.stringify({
              topic: 't/1',
              valueType: 'json',
              jsonPayload: { ...jsonPayload, otherFields: [{ name: 'q', path: 'quality.0' }] }
            })
          })
        );
        await db('south_items').insert(
          southItemRow({
            id: 'i2',
            connector_id: 'so-mqtt',
            scan_mode_id: 'sm1',
            name: 'i2',
            // differs only by topic and otherFields (both stripped for grouping) -> groups with i1
            settings: JSON.stringify({
              topic: 't/2',
              valueType: 'json',
              jsonPayload: { ...jsonPayload, otherFields: [{ name: 'r', path: 'quality.1' }] }
            })
          })
        );
        await db('south_items').insert(
          southItemRow({
            id: 'i3',
            connector_id: 'so-mqtt',
            scan_mode_id: 'sm1',
            name: 'i3',
            settings: JSON.stringify({ topic: 't/3', valueType: 'number' })
          })
        );
        await db('north_connectors').insert(northRow({ id: 'no-explicit', name: 'no-explicit', type: 'file-writer' }));
        await db('north_connectors').insert(northRow({ id: 'no-implicit', name: 'no-implicit', type: 'file-writer' }));
        // no-explicit is explicitly subscribed; no-implicit has no subscription -> digests all mqtt souths
        await db('subscription').insert({ north_connector_id: 'no-explicit', south_connector_id: 'so-mqtt' });
      });

      await up(db);

      const mqttTransformer = await db('transformers').where({ type: 'custom', name: 'mqtt-transformer' }).first();
      assert.ok(mqttTransformer, 'mqtt custom transformer created');

      // 2 groups (json group of i1+i2, number group of i3) x 2 norths (explicit + implicit) = 4 instances
      const instances = await db('north_transformers').where('transformer_id', mqttTransformer.id);
      assert.strictEqual(instances.length, 4);
      for (const instance of instances) {
        assert.strictEqual(instance.source_south_south_id, 'so-mqtt');
        assert.strictEqual(instance.source_type, 'south');
      }

      // item links: json group (2 items) x2 + number group (1 item) x2 = 6
      const links = await db('north_transformers_items').select('*');
      assert.strictEqual(links.length, 6);

      // group settings stored as options must drop topic and jsonPayload.otherFields
      const jsonInstance = instances.find(i => JSON.parse(i.options).valueType === 'json');
      assert.ok(jsonInstance);
      const options = JSON.parse(jsonInstance.options);
      assert.strictEqual(options.topic, undefined);
      assert.ok(options.jsonPayload);
      assert.strictEqual(options.jsonPayload.otherFields, undefined);
      assert.strictEqual(options.jsonPayload.dataArrayPath, 'data.items');

      // south item settings reduced to just the topic
      const i1 = await db('south_items').where('id', 'i1').first();
      assert.deepEqual(JSON.parse(i1.settings), { topic: 't/1' });
      const i3 = await db('south_items').where('id', 'i3').first();
      assert.deepEqual(JSON.parse(i3.settings), { topic: 't/3' });
    });

    it('populates item historian fields and groups items for a historian south', async () => {
      await seed(async () => {
        await db('scan_modes').insert(scanModeRow('sm1', 'sm1'));
        await db('scan_modes').insert(scanModeRow('sm2', 'sm2'));
        await db('south_connectors').insert(
          southRow({
            id: 'so-oi',
            name: 'so-oi',
            type: 'opcua',
            settings: JSON.stringify({ throttling: { maxReadInterval: 5000, readDelay: 100, overlap: 10 }, sharedConnection: true })
          })
        );
        // it1/it2 share scan mode sm1 -> one group; it3 on sm2 -> a second group
        await db('south_items').insert(
          southItemRow({ id: 'it1', connector_id: 'so-oi', scan_mode_id: 'sm1', name: 'it1', settings: JSON.stringify({ nodeId: 'ns=1' }) })
        );
        await db('south_items').insert(
          southItemRow({ id: 'it2', connector_id: 'so-oi', scan_mode_id: 'sm1', name: 'it2', settings: JSON.stringify({ nodeId: 'ns=2' }) })
        );
        await db('south_items').insert(
          southItemRow({ id: 'it3', connector_id: 'so-oi', scan_mode_id: 'sm2', name: 'it3', settings: JSON.stringify({ nodeId: 'ns=3' }) })
        );
      });

      await up(db);

      // populateItemHistorianFields — historian throttling copied onto each item
      const it1 = await db('south_items').where('id', 'it1').first();
      assert.strictEqual(it1.max_read_interval, 5000);
      assert.strictEqual(it1.read_delay, 100);
      assert.strictEqual(it1.overlap, 10);
      assert.strictEqual(it1.sync_with_group, 1);

      // groupItems — two groups because of two scan modes
      const groups = await db('south_item_groups').where('south_id', 'so-oi');
      assert.strictEqual(groups.length, 2);
      for (const group of groups) {
        assert.strictEqual(group.max_read_interval, 5000);
        assert.strictEqual(group.read_delay, 100);
        assert.strictEqual(group.overlap, 10);
        assert.ok(group.name.startsWith('so-oi'));
      }
      const groupItemRows = await db('group_items').select('*');
      assert.strictEqual(groupItemRows.length, 3);

      // removeThrottlingFieldsInConnectorSettings — throttling and sharedConnection removed from connector settings
      const south = await db('south_connectors').where('id', 'so-oi').first();
      const southSettings = JSON.parse(south.settings);
      assert.strictEqual(southSettings.throttling, undefined);
      assert.strictEqual(southSettings.sharedConnection, undefined);
    });
  });
});
