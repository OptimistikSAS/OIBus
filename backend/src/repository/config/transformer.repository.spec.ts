import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';

import { Database } from 'better-sqlite3';

import { CustomTransformer, StandardTransformer, Transformer } from '../../model/transformer.model';
import AuditService from '../../service/audit.service';
import { emptyDatabase, initDatabase } from '../../tests/utils/database-utils';
import testData from '../../tests/utils/test-data';
import { createAuditServiceMock, Mocked, stripAuditFields } from '../../tests/utils/test-utils';
import FileTransformer from '../../transformers/file/file/file-transformer';
import FileToFileTransformer from '../../transformers/file/file-to-file/file-to-file-transformer';
import FileToModbusTransformer from '../../transformers/file/file-to-modbus/file-to-modbus-transformer';
import FileToMQTTTransformer from '../../transformers/file/file-to-mqtt/file-to-mqtt-transformer';
import FileToOIAnalyticsTransformer from '../../transformers/file/file-to-oianalytics/file-to-oianalytics-transformer';
import FileToOPCUATransformer from '../../transformers/file/file-to-opcua/file-to-opcua-transformer';
import FileToRecordListTransformer from '../../transformers/file/file-to-record-list/file-to-record-list-transformer';
import RecordListToFileTransformer from '../../transformers/record-list/record-list-to-file/record-list-to-file-transformer';
import RecordListToModbusTransformer from '../../transformers/record-list/record-list-to-modbus/record-list-to-modbus-transformer';
import RecordListToMQTTTransformer from '../../transformers/record-list/record-list-to-mqtt/record-list-to-mqtt-transformer';
import RecordListToOIAnalyticsTransformer from '../../transformers/record-list/record-list-to-oianalytics/record-list-to-oianalytics-transformer';
import RecordListToOPCUATransformer from '../../transformers/record-list/record-list-to-opcua/record-list-to-opcua-transformer';
import OIBusSetpointToJSONTransformer from '../../transformers/setpoint/oibus-setpoint-to-json/oibus-setpoint-to-json-transformer';
import OIBusSetpointToModbusTransformer from '../../transformers/setpoint/oibus-setpoint-to-modbus/oibus-setpoint-to-modbus-transformer';
import OIBusSetpointToMQTTTransformer from '../../transformers/setpoint/oibus-setpoint-to-mqtt/oibus-setpoint-to-mqtt-transformer';
import OIBusSetpointToOPCUATransformer from '../../transformers/setpoint/oibus-setpoint-to-opcua/oibus-setpoint-to-opcua-transformer';
import TransformerRepository from './transformer.repository';

const TEST_DB_PATH = 'src/tests/test-config-transformer.db';

const standardTransformers: Array<StandardTransformer> = [
  { id: 'csvToMqtt', inputType: 'file', functionName: FileToMQTTTransformer.transformerName, outputType: 'mqtt', type: 'standard' },
  {
    id: 'csvToRecordList',
    inputType: 'file',
    functionName: FileToRecordListTransformer.transformerName,
    outputType: 'record-list',
    type: 'standard'
  },
  { id: 'file', type: 'standard', functionName: FileTransformer.transformerName, inputType: 'file', outputType: 'file' },
  { id: 'jsonToCsv', inputType: 'file', functionName: FileToFileTransformer.transformerName, outputType: 'file', type: 'standard' },
  { id: 'fileToModbus', inputType: 'file', functionName: FileToModbusTransformer.transformerName, outputType: 'modbus', type: 'standard' },
  { id: 'fileToOpcua', inputType: 'file', functionName: FileToOPCUATransformer.transformerName, outputType: 'opcua', type: 'standard' },
  {
    id: 'jsonToOia',
    inputType: 'file',
    functionName: FileToOIAnalyticsTransformer.transformerName,
    outputType: 'oianalytics',
    type: 'standard'
  },
  {
    id: 'recordListToJson',
    type: 'standard',
    functionName: RecordListToFileTransformer.transformerName,
    inputType: 'record-list',
    outputType: 'file'
  },
  {
    id: 'recordListToModbus',
    inputType: 'record-list',
    functionName: RecordListToModbusTransformer.transformerName,
    outputType: 'modbus',
    type: 'standard'
  },
  {
    id: 'recordListToMqtt',
    inputType: 'record-list',
    functionName: RecordListToMQTTTransformer.transformerName,
    outputType: 'mqtt',
    type: 'standard'
  },
  {
    id: 'recordListToOia',
    inputType: 'record-list',
    functionName: RecordListToOIAnalyticsTransformer.transformerName,
    outputType: 'oianalytics',
    type: 'standard'
  },
  {
    id: 'recordListToOpcua',
    inputType: 'record-list',
    functionName: RecordListToOPCUATransformer.transformerName,
    outputType: 'opcua',
    type: 'standard'
  },
  {
    id: 'oibusSetpointToJson',
    inputType: 'setpoint',
    functionName: OIBusSetpointToJSONTransformer.transformerName,
    outputType: 'file',
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

/** A custom transformer cloned from the first fixture. */
const customTransformer = (id: string, name: string): CustomTransformer => ({
  ...(JSON.parse(JSON.stringify(testData.transformers.list[0])) as CustomTransformer),
  id,
  name
});

const isSetpointToOpcua = (transformer: Transformer) =>
  transformer.type === 'standard' && transformer.functionName === OIBusSetpointToOPCUATransformer.transformerName;

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
  let auditService: Mocked<AuditService>;
  let createdTransformerId: string;

  beforeEach(() => {
    auditService = createAuditServiceMock();
    repository = new TransformerRepository(database, auditService);
  });

  /** The arguments of every audit record made in the test. */
  const recorded = () => auditService.record.mock.calls.map(call => call.arguments);

  it('should properly find all transformers', () => {
    const allTransformers = repository.list().map(stripAuditFields);
    // Standard transformers come first, then custom ones from test data
    // Every seeded standard transformer is listed here, and nothing else
    assert.deepStrictEqual(
      allTransformers
        .filter(t => t.type === 'standard')
        .map(t => t.functionName)
        .sort(),
      standardTransformers.map(t => t.functionName).sort()
    );
    for (const standard of standardTransformers) {
      const found = allTransformers.find(t => t.type === 'standard' && t.functionName === standard.functionName);
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
    const createTransformer = customTransformer('', 'new name');
    repository.save(createTransformer, true);
    createdTransformerId = createTransformer.id;
    assert.ok(createdTransformerId);

    const found = repository.findById(createdTransformerId);
    assert.ok(found);
    assert.strictEqual(found.inputType, createTransformer.inputType);
    assert.strictEqual(found.outputType, createTransformer.outputType);

    assert.deepStrictEqual(recorded(), [
      ['transformer', createdTransformerId, 'CREATE', null, found, (found as CustomTransformer).createdBy]
    ]);
  });

  it('should preserve a caller-supplied id when creating a transformer (config import)', () => {
    const importedTransformer = customTransformer('preserved-transformer-id', 'imported transformer');
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
    const original = customTransformer('colliding-transformer-id', 'original transformer');
    repository.save(original, true);

    const colliding = customTransformer('colliding-transformer-id', 'a completely different transformer');

    assert.throws(() => repository.save(colliding, true));

    // The original row must be untouched — not silently overwritten by the failed "create".
    const stillOriginal = repository.findById('colliding-transformer-id') as CustomTransformer;
    assert.strictEqual(stillOriginal.name, 'original transformer');

    repository.delete('colliding-transformer-id', 'importUser');
  });

  it('should reject an update whose target id does not exist, instead of silently creating it', () => {
    const ghost = customTransformer('transformer-id-that-does-not-exist', 'ghost transformer');

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

    assert.deepStrictEqual(recorded(), [['transformer', updateTransformer.id, 'UPDATE', existing, result, updateTransformer.updatedBy]]);
  });

  it('should delete transformer', () => {
    const before = repository.findById(createdTransformerId);
    repository.delete(createdTransformerId, 'userTest');
    assert.strictEqual(repository.findById(createdTransformerId), null);

    assert.deepStrictEqual(recorded(), [['transformer', createdTransformerId, 'DELETE', before, null, 'userTest']]);
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
    const result = repository.search({ type: undefined, inputType: 'record-list', outputType: undefined, page: 0 });
    assert.ok(result.totalElements >= 1);
  });

  it('should search with only outputType filter', () => {
    const result = repository.search({ type: undefined, inputType: undefined, outputType: 'file', page: 0 });
    assert.ok(result.totalElements >= 1);
  });

  it('should skip creating standard transformers that already exist', () => {
    const secondRepo = new TransformerRepository(database, createAuditServiceMock());
    const all = secondRepo.list().filter(t => t.type === 'standard');
    assert.strictEqual(all.length, standardTransformers.length);
    // Explicitly pin the last standard transformer registered by createStandardTransformers()
    // (setpoint-to-opcua) to make sure it was not duplicated on this second construction.
    const setpointToOpcuaEntries = all.filter(isSetpointToOpcua);
    assert.strictEqual(setpointToOpcuaEntries.length, 1);
  });

  it('should create all standard transformers when none exist', () => {
    // Remove all standard transformers to force createStandardTransformers() to insert them all
    database.prepare("DELETE FROM transformers WHERE type = 'standard'").run();
    const freshRepo = new TransformerRepository(database, createAuditServiceMock());
    const created = freshRepo.list().filter(t => t.type === 'standard');
    assert.deepStrictEqual(created.map(t => t.functionName).sort(), standardTransformers.map(t => t.functionName).sort());
    // Explicitly pin the last standard transformer registered by createStandardTransformers()
    // (setpoint-to-opcua) to make sure the creation branch is exercised for it specifically,
    // not just implicitly via the aggregate count above.
    const setpointToOpcua = created.find(isSetpointToOpcua);
    assert.ok(setpointToOpcua, 'setpoint-to-opcua standard transformer was not created');
    assert.strictEqual(setpointToOpcua!.inputType, 'setpoint');
    assert.strictEqual(setpointToOpcua!.outputType, 'opcua');

    // And re-constructing once more against the now fully-populated table should skip it again,
    // covering the false branch of that same last if-check without disturbing other tests' state.
    database.prepare('DELETE FROM transformers WHERE function_name = ?').run(OIBusSetpointToOPCUATransformer.transformerName);
    const repoMissingLastOne = new TransformerRepository(database, createAuditServiceMock());
    const recreated = repoMissingLastOne.list().filter(isSetpointToOpcua);
    assert.strictEqual(recreated.length, 1);
    const repoWithAllPresent = new TransformerRepository(database, createAuditServiceMock());
    const stillOne = repoWithAllPresent.list().filter(isSetpointToOpcua);
    assert.strictEqual(stillOne.length, 1);
  });
});
