import { before, after, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mock } from 'node:test';
import { Database } from 'better-sqlite3';
import AuditService from '../../service/audit.service';
import { createAuditServiceMock, emptyDatabase, initDatabase, stripAuditFields } from '../../tests/utils/test-utils';
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
  let auditService: AuditService;
  let createdTransformerId: string;

  beforeEach(() => {
    auditService = createAuditServiceMock();
    repository = new TransformerRepository(database, auditService);
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
    repository.save(createTransformer, true);
    createdTransformerId = createTransformer.id;
    assert.ok(createdTransformerId);

    const found = repository.findById(createdTransformerId);
    assert.ok(found);
    assert.strictEqual(found.inputType, createTransformer.inputType);
    assert.strictEqual(found.outputType, createTransformer.outputType);

    const recordMock = auditService.record as unknown as ReturnType<typeof mock.fn>;
    assert.strictEqual(recordMock.mock.calls.length, 1);
    assert.deepStrictEqual(recordMock.mock.calls[0].arguments, [
      'transformer',
      createdTransformerId,
      'CREATE',
      null,
      found,
      (found as CustomTransformer).createdBy
    ]);
  });

  it('should preserve a caller-supplied id when creating a transformer (config import)', () => {
    const importedTransformer: CustomTransformer = JSON.parse(JSON.stringify(testData.transformers.list[0]));
    importedTransformer.id = 'preserved-transformer-id';
    importedTransformer.name = 'imported transformer';
    repository.save(importedTransformer, true);

    assert.strictEqual(importedTransformer.id, 'preserved-transformer-id');
    const found = repository.findById('preserved-transformer-id');
    assert.ok(found);
    assert.strictEqual((found as CustomTransformer).name, 'imported transformer');

    // Clean up so later count/pagination assertions in this suite are unaffected.
    repository.delete('preserved-transformer-id', 'importUser');
  });

  it('should reject a create whose id collides with an existing row, instead of silently overwriting it', () => {
    // Standard and custom transformers share one id space (see createStandardTransformers), so a
    // config-import create under a preserved id that happens to collide with any existing row —
    // standard or custom — must fail loudly (a real INSERT constraint error) rather than being
    // reinterpreted as "must be an update" and silently overwriting that unrelated row's columns.
    const original: CustomTransformer = JSON.parse(JSON.stringify(testData.transformers.list[0]));
    original.id = 'colliding-transformer-id';
    original.name = 'original transformer';
    repository.save(original, true);

    const colliding: CustomTransformer = JSON.parse(JSON.stringify(testData.transformers.list[0]));
    colliding.id = 'colliding-transformer-id';
    colliding.name = 'a completely different transformer';

    assert.throws(() => repository.save(colliding, true));

    // The original row must be untouched — not silently overwritten by the failed "create".
    const stillOriginal = repository.findById('colliding-transformer-id') as CustomTransformer;
    assert.strictEqual(stillOriginal.name, 'original transformer');

    repository.delete('colliding-transformer-id', 'importUser');
  });

  it('should reject an update whose target id does not exist, instead of silently creating it', () => {
    const ghost: CustomTransformer = JSON.parse(JSON.stringify(testData.transformers.list[0]));
    ghost.id = 'transformer-id-that-does-not-exist';
    ghost.name = 'ghost transformer';

    assert.throws(() => repository.save(ghost, false));
    assert.strictEqual(repository.findById('transformer-id-that-does-not-exist'), null);
  });

  it('should update a transformer', () => {
    const existing = repository.findById(createdTransformerId);
    assert.ok(existing, 'Transformer should exist from previous create test');

    const updateTransformer = JSON.parse(JSON.stringify(existing));
    updateTransformer.name = 'new name updated';
    updateTransformer.description = 'new description updated';
    repository.save(updateTransformer, false);

    const result = repository.findById(updateTransformer.id)!;
    assert.strictEqual((result as CustomTransformer).name, 'new name updated');
    assert.strictEqual((result as CustomTransformer).description, 'new description updated');

    const recordMock = auditService.record as unknown as ReturnType<typeof mock.fn>;
    assert.strictEqual(recordMock.mock.calls.length, 1);
    assert.deepStrictEqual(recordMock.mock.calls[0].arguments, [
      'transformer',
      updateTransformer.id,
      'UPDATE',
      existing,
      result,
      updateTransformer.updatedBy
    ]);
  });

  it('should delete transformer', () => {
    const before = repository.findById(createdTransformerId);
    repository.delete(createdTransformerId, 'userTest');
    assert.strictEqual(repository.findById(createdTransformerId), null);

    const recordMock = auditService.record as unknown as ReturnType<typeof mock.fn>;
    assert.strictEqual(recordMock.mock.calls.length, 1);
    assert.deepStrictEqual(recordMock.mock.calls[0].arguments, ['transformer', createdTransformerId, 'DELETE', before, null, 'userTest']);
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
    assert.strictEqual(result.totalElements, 19);
    // First page contains standard transformers (10 per page)
    for (const t of result.content.map(stripAuditFields)) {
      assert.strictEqual(t.type, 'standard');
    }
  });

  it('should search with only type filter', () => {
    const result = repository.search({ type: 'custom', inputType: undefined, outputType: undefined, page: 0 });
    assert.ok(result.totalElements >= 1);
    for (const t of result.content) {
      assert.strictEqual(t.type, 'custom');
    }
  });

  it('should search with only inputType filter', () => {
    const result = repository.search({ type: undefined, inputType: 'time-values', outputType: undefined, page: 0 });
    assert.ok(result.totalElements >= 1);
  });

  it('should search with only outputType filter', () => {
    const result = repository.search({ type: undefined, inputType: undefined, outputType: 'any', page: 0 });
    assert.ok(result.totalElements >= 1);
  });

  it('should skip creating standard transformers that already exist', () => {
    const secondRepo = new TransformerRepository(database, createAuditServiceMock());
    const all = secondRepo.list().filter(t => t.type === 'standard');
    assert.strictEqual(all.length, 16);
    // Explicitly pin the last standard transformer registered by createStandardTransformers()
    // (setpoint-to-opcua) to make sure it was not duplicated on this second construction.
    const setpointToOpcuaEntries = all.filter(
      t => (t as StandardTransformer).functionName === OIBusSetpointToOPCUATransformer.transformerName
    );
    assert.strictEqual(setpointToOpcuaEntries.length, 1);
  });

  it('should create all standard transformers when none exist', () => {
    // Remove all standard transformers to force createStandardTransformers() to insert them all
    database.prepare("DELETE FROM transformers WHERE type = 'standard'").run();
    const freshRepo = new TransformerRepository(database, createAuditServiceMock());
    const standardTransformers = freshRepo.list().filter(t => t.type === 'standard');
    assert.strictEqual(standardTransformers.length, 16);
    // Explicitly pin the last standard transformer registered by createStandardTransformers()
    // (setpoint-to-opcua) to make sure the creation branch is exercised for it specifically,
    // not just implicitly via the aggregate count above.
    const setpointToOpcua = standardTransformers.find(
      t => (t as StandardTransformer).functionName === OIBusSetpointToOPCUATransformer.transformerName
    );
    assert.ok(setpointToOpcua, 'setpoint-to-opcua standard transformer was not created');
    assert.strictEqual(setpointToOpcua!.inputType, 'setpoint');
    assert.strictEqual((setpointToOpcua as StandardTransformer).outputType, 'opcua');

    // And re-constructing once more against the now fully-populated table should skip it again,
    // covering the false branch of that same last if-check without disturbing other tests' state.
    database.prepare('DELETE FROM transformers WHERE function_name = ?').run(OIBusSetpointToOPCUATransformer.transformerName);
    const repoMissingLastOne = new TransformerRepository(database, createAuditServiceMock());
    const recreated = repoMissingLastOne
      .list()
      .filter(t => t.type === 'standard' && (t as StandardTransformer).functionName === OIBusSetpointToOPCUATransformer.transformerName);
    assert.strictEqual(recreated.length, 1);
    const repoWithAllPresent = new TransformerRepository(database, createAuditServiceMock());
    const stillOne = repoWithAllPresent
      .list()
      .filter(t => t.type === 'standard' && (t as StandardTransformer).functionName === OIBusSetpointToOPCUATransformer.transformerName);
    assert.strictEqual(stillOne.length, 1);
  });
});
