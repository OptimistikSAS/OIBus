import { before, after, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Database } from 'better-sqlite3';
import { emptyDatabase, initDatabase, stripAuditFields } from '../../tests/utils/test-utils';
import testData from '../../tests/utils/test-data';
import TransformerRepository from './transformer.repository';
import { CustomTransformer, StandardTransformer } from '../../model/transformer.model';
import OIBusTimeValuesToCsvTransformer from '../../transformers/time-values/oibus-time-values-to-csv/oibus-time-values-to-csv-transformer';
import IsoTransformer from '../../transformers/iso-transformer';
import OIBusTimeValuesToJSONTransformer from '../../transformers/time-values/oibus-time-values-to-json/oibus-time-values-to-json-transformer';
import OIBusTimeValuesToMQTTTransformer from '../../transformers/time-values/oibus-time-values-to-mqtt/oibus-time-values-to-mqtt-transformer';
import OIBusTimeValuesToOPCUATransformer from '../../transformers/time-values/oibus-time-values-to-opcua/oibus-time-values-to-opcua-transformer';
import OIBusTimeValuesToModbusTransformer from '../../transformers/time-values/oibus-time-values-to-modbus/oibus-time-values-to-modbus-transformer';
import IgnoreTransformer from '../../transformers/ignore-transformer';
import OIBusSetpointToModbusTransformer from '../../transformers/setpoint/oibus-setpoint-to-modbus/oibus-setpoint-to-modbus-transformer';
import OIBusSetpointToMQTTTransformer from '../../transformers/setpoint/oibus-setpoint-to-mqtt/oibus-setpoint-to-mqtt-transformer';
import OIBusSetpointToOPCUATransformer from '../../transformers/setpoint/oibus-setpoint-to-opcua/oibus-setpoint-to-opcua-transformer';
import OIBusTimeValuesToOIAnalyticsTransformer from '../../transformers/time-values/oibus-time-values-to-oianalytics/oibus-time-values-to-oianalytics-transformer';
import JSONToCSVTransformer from '../../transformers/any/json-to-csv/json-to-csv-transformer';
import CSVToMQTTTransformer from '../../transformers/any/csv-to-mqtt/csv-to-mqtt-transformer';
import CSVToTimeValuesTransformer from '../../transformers/any/csv-to-time-values/csv-to-time-values-transformer';

const TEST_DB_PATH = 'src/tests/test-config-transformer.db';

const standardTransformers: Array<StandardTransformer> = [
  { id: 'csvToMqtt', inputType: 'any', functionName: CSVToMQTTTransformer.transformerName, outputType: 'mqtt', type: 'standard' },
  {
    id: 'csvToTimeValues',
    inputType: 'any',
    functionName: CSVToTimeValuesTransformer.transformerName,
    outputType: 'time-values',
    type: 'standard'
  },
  { id: 'ignore', type: 'standard', functionName: IgnoreTransformer.transformerName, inputType: 'any', outputType: 'any' },
  { id: 'iso', type: 'standard', functionName: IsoTransformer.transformerName, inputType: 'any', outputType: 'any' },
  { id: 'jsonToCsv', inputType: 'any', functionName: JSONToCSVTransformer.transformerName, outputType: 'any', type: 'standard' },
  {
    id: 'oibusTimeValuesToCsv',
    type: 'standard',
    functionName: OIBusTimeValuesToCsvTransformer.transformerName,
    inputType: 'time-values',
    outputType: 'any'
  },
  {
    id: 'oibusTimeValuesToJson',
    type: 'standard',
    functionName: OIBusTimeValuesToJSONTransformer.transformerName,
    inputType: 'time-values',
    outputType: 'any'
  },
  {
    id: 'oibusTimeValuesToModbus',
    inputType: 'time-values',
    functionName: OIBusTimeValuesToModbusTransformer.transformerName,
    outputType: 'modbus',
    type: 'standard'
  },
  {
    id: 'oibusTimeValuesToMqtt',
    inputType: 'time-values',
    functionName: OIBusTimeValuesToMQTTTransformer.transformerName,
    outputType: 'mqtt',
    type: 'standard'
  },
  {
    id: 'oibusTimeValuesToOia',
    inputType: 'time-values',
    functionName: OIBusTimeValuesToOIAnalyticsTransformer.transformerName,
    outputType: 'oianalytics',
    type: 'standard'
  },
  {
    id: 'oibusTimeValuesToOpcua',
    inputType: 'time-values',
    functionName: OIBusTimeValuesToOPCUATransformer.transformerName,
    outputType: 'opcua',
    type: 'standard'
  },
  {
    id: 'oibusSetpointToModbus',
    inputType: 'setpoint',
    functionName: OIBusSetpointToModbusTransformer.transformerName,
    outputType: 'modbus',
    type: 'standard'
  },
  {
    id: 'oibusSetpointToMqtt',
    inputType: 'setpoint',
    functionName: OIBusSetpointToMQTTTransformer.transformerName,
    outputType: 'mqtt',
    type: 'standard'
  },
  {
    id: 'oibusSetpointToOpcua',
    inputType: 'setpoint',
    functionName: OIBusSetpointToOPCUATransformer.transformerName,
    outputType: 'opcua',
    type: 'standard'
  }
];

let database: Database;
describe('TransformerRepository', () => {
  before(async () => {
    database = await initDatabase('config', true, TEST_DB_PATH);
  });

  after(async () => {
    database.close();
    await emptyDatabase('config', TEST_DB_PATH);
  });

  let repository: TransformerRepository;
  let createdTransformerId: string;

  beforeEach(() => {
    repository = new TransformerRepository(database);
  });

  it('should properly find all transformers', () => {
    const allTransformers = repository.list().map(stripAuditFields);
    // Standard transformers come first, then custom ones from test data
    for (const standard of standardTransformers) {
      const found = allTransformers.find(t => t.type === 'standard' && (t as StandardTransformer).functionName === standard.functionName);
      assert.ok(found, `Standard transformer ${standard.functionName} not found`);
      assert.strictEqual(found.inputType, standard.inputType);
      assert.strictEqual(found.outputType, standard.outputType);
    }
    for (const custom of testData.transformers.list.map(stripAuditFields)) {
      const found = allTransformers.find(t => t.id === custom.id);
      assert.ok(found, `Custom transformer ${custom.id} not found`);
    }
  });

  it('should properly find a transformer by its ID', () => {
    const result = stripAuditFields(repository.findById(testData.transformers.list[0].id));
    assert.ok(result);
    assert.strictEqual(result.id, testData.transformers.list[0].id);
    assert.strictEqual(result.type, testData.transformers.list[0].type);
    assert.strictEqual(result.inputType, testData.transformers.list[0].inputType);
    assert.strictEqual(result.outputType, testData.transformers.list[0].outputType);
    assert.strictEqual(repository.findById('bad id'), null);
  });

  it('should create a transformer', () => {
    const createTransformer = JSON.parse(JSON.stringify(testData.transformers.list[0]));
    createTransformer.id = '';
    createTransformer.name = 'new name';
    repository.save(createTransformer);
    createdTransformerId = createTransformer.id;
    assert.ok(createdTransformerId);

    const found = stripAuditFields(repository.findById(createdTransformerId));
    assert.ok(found);
    assert.strictEqual(found.inputType, createTransformer.inputType);
    assert.strictEqual(found.outputType, createTransformer.outputType);
  });

  it('should update a transformer', () => {
    const existing = repository.findById(createdTransformerId);
    assert.ok(existing, 'Transformer should exist from previous create test');

    const updateTransformer = JSON.parse(JSON.stringify(existing));
    updateTransformer.name = 'new name updated';
    updateTransformer.description = 'new description updated';
    repository.save(updateTransformer);

    const result = repository.findById(updateTransformer.id)!;
    assert.strictEqual((result as CustomTransformer).name, 'new name updated');
    assert.strictEqual((result as CustomTransformer).description, 'new description updated');
  });

  it('should delete transformer', () => {
    repository.delete(createdTransformerId);
    assert.strictEqual(repository.findById(createdTransformerId), null);
  });

  it('should properly search transformers with search params and page them', () => {
    const result = repository.search({
      type: testData.transformers.list[0].type,
      inputType: testData.transformers.list[0].inputType,
      outputType: testData.transformers.list[0].outputType,
      page: 0
    });
    assert.strictEqual(result.totalElements, 1);
    const found = result.content.map(stripAuditFields)[0];
    assert.strictEqual(found.id, testData.transformers.list[0].id);
    assert.strictEqual(found.type, testData.transformers.list[0].type);
  });

  it('should properly search transformers and page them', () => {
    const result = repository.search({ type: undefined, inputType: undefined, outputType: undefined, page: 0 });
    assert.strictEqual(result.totalElements, 17);
    // First page contains standard transformers (10 per page)
    for (const t of result.content.map(stripAuditFields)) {
      assert.strictEqual(t.type, 'standard');
    }
  });
});
