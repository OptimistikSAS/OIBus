import assert from 'node:assert/strict';
import path from 'node:path';
import { after, afterEach, before, beforeEach, describe, it } from 'node:test';

import { Knex } from 'knex';

import { buildSchemaBefore, createMigrationSchemaHarness } from '../../../../tests/utils/migration-test-utils';
import { down, up } from './v3.10.0_13';

const ENTITY_MIGRATIONS_ROOT = path.resolve(__dirname, '..', '..');
const NOW = '2026-01-01T00:00:00.000Z';

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

describe('Entity migration v3.10.0_13', () => {
  const harness = createMigrationSchemaHarness({
    buildSchema: db => buildSchemaBefore(ENTITY_MIGRATIONS_ROOT, 'v3.10.0_13.ts', db)
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

    await up(db);

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

    await up(db);

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

    await up(db);
    await down();

    assert.deepStrictEqual(await db('transformers').select('id', 'input_type', 'output_type').orderBy('id'), [
      { id: 'other', input_type: 'file', output_type: 'file' },
      { id: 'reads', input_type: 'record-list', output_type: 'mqtt' },
      { id: 'writes', input_type: 'file', output_type: 'record-list' }
    ]);
  });
});
