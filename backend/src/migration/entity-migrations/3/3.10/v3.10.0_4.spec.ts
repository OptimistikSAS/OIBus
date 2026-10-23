import assert from 'node:assert/strict';
import path from 'node:path';
import { after, afterEach, before, beforeEach, describe, it } from 'node:test';

import { Knex } from 'knex';

import { buildSchemaBefore, createMigrationSchemaHarness } from '../../../../tests/utils/migration-test-utils';
import { down, up } from './v3.10.0_4';

const ENTITY_MIGRATIONS_ROOT = path.resolve(__dirname, '..', '..');
const NOW = '2026-01-01T00:00:00.000Z';

describe('Entity migration v3.10.0_4', () => {
  const harness = createMigrationSchemaHarness({
    buildSchema: db => buildSchemaBefore(ENTITY_MIGRATIONS_ROOT, 'v3.10.0_4.ts', db)
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
    await up(db);

    const customs = await db('transformers').where('type', 'custom').orderBy('id').select('id', 'input_type', 'output_type');
    assert.deepStrictEqual(customs, [
      { id: 'custom1', input_type: 'record-list', output_type: 'any' },
      { id: 'custom2', input_type: 'any', output_type: 'record-list' }
    ]);
  });

  it('should rename the time-values standard transformers into their record-list replacements', async () => {
    await up(db);

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
    await up(db);

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
    await up(db);

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
    await up(db);

    assert.strictEqual((await optionsOf('north_transformers', 'ntCsv')).options.keepOtherFields, true);
    assert.strictEqual((await optionsOf('north_transformers', 'ntCsvKept')).options.keepOtherFields, false);
  });

  it('should rename time-values-to-csv when there is no record-list-to-csv yet', async () => {
    await db('north_transformers').where('transformer_id', 'csv').del();
    await db('transformers').where('id', 'csv').del();

    await up(db);

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
      await up(db);

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
      await up(db);

      const links = await linksOf('oia', 'opcua2');
      assert.deepStrictEqual(
        links.map(link => link.function_name),
        ['record-list-to-oianalytics', 'record-list-to-oianalytics']
      );
      assert.ok(links.some(link => link.id === 'isoItem'));
      assert.ok(await db('north_transformers_items').where('id', 'isoItem').first());
    });

    it('should keep an existing south-level link, and leave the other souths and norths alone', async () => {
      await up(db);

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

      await up(db);

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

      await up(db);

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

  it('should do nothing on down', async () => {
    await assert.doesNotReject(down());
  });
});
