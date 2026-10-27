import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { afterEach, before, beforeEach, describe, it, mock } from 'node:test';

import type DataStreamEngine from '../engine/data-stream-engine';
import { CustomTransformer, StandardTransformer } from '../model/transformer.model';
import { NotFoundError, OIBusValidationError } from '../model/types';
import type TransformerRepository from '../repository/config/transformer.repository';
import LoggerMock from '../tests/__mocks__/service/logger/logger.mock';
import testData from '../tests/utils/test-data';
import { createMock, Mocked, mockModule, reloadModule } from '../tests/utils/test-utils';
import fileManifest from '../transformers/file/file/manifest';
import FileToFileTransformer from '../transformers/file/file-to-file/file-to-file-transformer';
import fileToFileManifest from '../transformers/file/file-to-file/manifest';
import FileToModbusTransformer from '../transformers/file/file-to-modbus/file-to-modbus-transformer';
import fileToModbusManifest from '../transformers/file/file-to-modbus/manifest';
import FileToMQTTTransformer from '../transformers/file/file-to-mqtt/file-to-mqtt-transformer';
import fileToMqttManifest from '../transformers/file/file-to-mqtt/manifest';
import FileToOIAnalyticsTransformer from '../transformers/file/file-to-oianalytics/file-to-oianalytics-transformer';
import fileToOianalyticsManifest from '../transformers/file/file-to-oianalytics/manifest';
import FileToOPCUATransformer from '../transformers/file/file-to-opcua/file-to-opcua-transformer';
import fileToOpcuaManifest from '../transformers/file/file-to-opcua/manifest';
import FileToRecordListTransformer from '../transformers/file/file-to-record-list/file-to-record-list-transformer';
import fileToRecordListManifest from '../transformers/file/file-to-record-list/manifest';
// Import transformer manifests
import recordListToFileManifest from '../transformers/record-list/record-list-to-file/manifest';
// Import concrete transformer classes for instanceof checks
import RecordListToFileTransformer from '../transformers/record-list/record-list-to-file/record-list-to-file-transformer';
import recordListToModbusManifest from '../transformers/record-list/record-list-to-modbus/manifest';
import RecordListToModbusTransformer from '../transformers/record-list/record-list-to-modbus/record-list-to-modbus-transformer';
import recordListToMqttManifest from '../transformers/record-list/record-list-to-mqtt/manifest';
import RecordListToMQTTTransformer from '../transformers/record-list/record-list-to-mqtt/record-list-to-mqtt-transformer';
import recordListToOianalyticsManifest from '../transformers/record-list/record-list-to-oianalytics/manifest';
import RecordListToOIAnalyticsTransformer from '../transformers/record-list/record-list-to-oianalytics/record-list-to-oianalytics-transformer';
import recordListToOpcuaManifest from '../transformers/record-list/record-list-to-opcua/manifest';
import RecordListToOPCUATransformer from '../transformers/record-list/record-list-to-opcua/record-list-to-opcua-transformer';
import JoiValidator from '../web-server/controllers/validators/joi.validator';
import type OIAnalyticsMessageService from './oia/oianalytics-message.service';
import type TransformerServiceType from './transformer.service';
import type {
  createTransformer as createTransformerType,
  getStandardManifest as getStandardManifestType,
  runTransformerOnContent as runTransformerOnContentType,
  toTransformedContent as toTransformedContentType,
  toTransformerDTO as toTransformerDTOType
} from './transformer.service';

const nodeRequire = createRequire(import.meta.url);

// OIBusCustomTransformer is used with `new`: each instance gets a fresh transform mock
class MockOIBusCustomTransformer {
  transform = mock.fn(async () => ({
    metadata: { contentType: 'file', numberOfElement: 1 },
    output: JSON.stringify({ data: [{ pointId: 'test', timestamp: '2023-01-01T00:00:00Z', value: 42 }] })
  }));
}

let TransformerService: typeof TransformerServiceType;
let createTransformer: typeof createTransformerType;
let getStandardManifest: typeof getStandardManifestType;
let runTransformerOnContent: typeof runTransformerOnContentType;
let toTransformedContent: typeof toTransformedContentType;
let toTransformerDTO: typeof toTransformerDTOType;

before(() => {
  mockModule(nodeRequire, './utils', { generateRandomId: () => 'random-id' });
  mockModule(nodeRequire, '../transformers/oibus-custom-transformer', { __esModule: true, default: MockOIBusCustomTransformer });

  const mod = reloadModule<{
    default: typeof TransformerServiceType;
    createTransformer: typeof createTransformerType;
    getStandardManifest: typeof getStandardManifestType;
    runTransformerOnContent: typeof runTransformerOnContentType;
    toTransformedContent: typeof toTransformedContentType;
    toTransformerDTO: typeof toTransformerDTOType;
  }>(nodeRequire, './transformer.service');
  TransformerService = mod.default;
  createTransformer = mod.createTransformer;
  getStandardManifest = mod.getStandardManifest;
  runTransformerOnContent = mod.runTransformerOnContent;
  toTransformedContent = mod.toTransformedContent;
  toTransformerDTO = mod.toTransformerDTO;
});

describe('Transformer Service', () => {
  const customTransformer = testData.transformers.list[0] as CustomTransformer;
  let service: TransformerServiceType;
  let transformerRepository: Mocked<TransformerRepository>;
  let oiAnalyticsMessageService: Mocked<OIAnalyticsMessageService>;
  let engine: Mocked<DataStreamEngine>;
  // JoiValidator is not mocked as a module — its validate method is a no-op (async, returns undefined)
  // We use a real instance but spy on it via mock.method
  let validator: JoiValidator;
  let validatorValidateMock: ReturnType<typeof mock.method>;

  beforeEach(() => {
    transformerRepository = createMock<TransformerRepository>();
    oiAnalyticsMessageService = createMock<OIAnalyticsMessageService>();
    engine = createMock<DataStreamEngine>({ logger: new LoggerMock() });
    validator = new JoiValidator();
    validatorValidateMock = mock.method(validator, 'validate', async () => undefined);

    transformerRepository.list.mock.mockImplementation(() => []);

    // Reset custom transformer mock — keep the same stable class reference so
    // that the already-loaded SUT module still sees a valid constructor.
    // The class creates fresh mock.fn instances per construction, so no reset needed.

    service = new TransformerService(validator, transformerRepository, oiAnalyticsMessageService, engine);
  });

  afterEach(() => {
    mock.restoreAll();
  });

  it('should search transformers', () => {
    const searchPage = {
      content: testData.transformers.list,
      totalElements: testData.transformers.list.length,
      size: 10,
      number: 0,
      totalPages: 1
    };
    transformerRepository.search.mock.mockImplementation(() => searchPage);

    const result = service.search({
      type: undefined,
      inputType: undefined,
      outputType: undefined,
      page: 0
    });

    assert.strictEqual(transformerRepository.search.mock.calls.length, 1);
    assert.deepStrictEqual(transformerRepository.search.mock.calls[0].arguments, [
      { type: undefined, inputType: undefined, outputType: undefined, page: 0 }
    ]);
    assert.deepStrictEqual(result, searchPage);
  });

  it('should list all transformers', () => {
    transformerRepository.list.mock.mockImplementation(() => testData.transformers.list);

    const result = service.findAll();

    assert.strictEqual(transformerRepository.list.mock.calls.length, 1);
    assert.deepStrictEqual(result, testData.transformers.list);
  });

  it('should find a transformer by id', () => {
    transformerRepository.findById.mock.mockImplementation(() => testData.transformers.list[0]);

    const result = service.findById(testData.transformers.list[0].id);

    assert.strictEqual(transformerRepository.findById.mock.calls.length, 1);
    assert.deepStrictEqual(transformerRepository.findById.mock.calls[0].arguments, [testData.transformers.list[0].id]);
    assert.deepStrictEqual(result, testData.transformers.list[0]);
  });

  it('should not get if the transformer is not found', () => {
    transformerRepository.findById.mock.mockImplementation(() => null);

    assert.throws(
      () => service.findById(testData.transformers.list[0].id),
      new NotFoundError(`Transformer "${testData.transformers.list[0].id}" not found`)
    );
    assert.strictEqual(transformerRepository.findById.mock.calls.length, 1);
    assert.deepStrictEqual(transformerRepository.findById.mock.calls[0].arguments, [testData.transformers.list[0].id]);
  });

  it('should create a transformer', async () => {
    transformerRepository.list.mock.mockImplementation(() => []);
    const result = await service.create(testData.transformers.command, 'userTest');

    assert.strictEqual(validatorValidateMock.mock.calls.length, 1);
    assert.deepStrictEqual(result, { ...testData.transformers.command, createdBy: 'userTest', updatedBy: 'userTest' });
  });

  it('should not create a transformer with duplicate name', async () => {
    transformerRepository.list.mock.mockImplementation(() => [
      { ...testData.transformers.list[0], name: testData.transformers.command.name }
    ]);

    await assert.rejects(
      () => service.create(testData.transformers.command, 'userTest'),
      new OIBusValidationError(`Transformer name "${testData.transformers.command.name}" already exists`)
    );
  });

  it('should update a transformer', async () => {
    transformerRepository.findById.mock.mockImplementation(() => JSON.parse(JSON.stringify(testData.transformers.list[0])));
    transformerRepository.list.mock.mockImplementation(() => testData.transformers.list);

    await service.update(testData.transformers.list[0].id, testData.transformers.command, 'userTest');

    assert.strictEqual(validatorValidateMock.mock.calls.length, 1);
    assert.strictEqual(transformerRepository.findById.mock.calls.length, 1);
    assert.deepStrictEqual(transformerRepository.findById.mock.calls[0].arguments, [testData.transformers.list[0].id]);
    assert.strictEqual(transformerRepository.save.mock.calls.length, 1);
    assert.deepStrictEqual(transformerRepository.save.mock.calls[0].arguments[0], {
      ...testData.transformers.command,
      id: testData.transformers.list[0].id,
      type: 'custom',
      createdBy: customTransformer.createdBy,
      updatedBy: 'userTest',
      createdAt: customTransformer.createdAt,
      updatedAt: customTransformer.updatedAt
    });
  });

  it('should update a transformer without changing the name', async () => {
    const command = JSON.parse(JSON.stringify(testData.transformers.command));
    command.name = customTransformer.name;
    transformerRepository.findById.mock.mockImplementation(() => JSON.parse(JSON.stringify(testData.transformers.list[0])));

    await service.update(testData.transformers.list[0].id, command, 'userTest');

    assert.strictEqual(transformerRepository.save.mock.calls.length, 1);
    assert.deepStrictEqual(transformerRepository.save.mock.calls[0].arguments[0], {
      ...command,
      id: testData.transformers.list[0].id,
      type: 'custom',
      createdBy: customTransformer.createdBy,
      updatedBy: 'userTest',
      createdAt: customTransformer.createdAt,
      updatedAt: customTransformer.updatedAt
    });
    // list should not be called when name is unchanged
    assert.strictEqual(transformerRepository.list.mock.calls.length, 0);
  });

  it('should update a transformer with a new unique name', async () => {
    const command = JSON.parse(JSON.stringify(testData.transformers.command));
    command.name = 'Updated Transformer Name';
    transformerRepository.findById.mock.mockImplementation(() => JSON.parse(JSON.stringify(testData.transformers.list[0])));
    transformerRepository.list.mock.mockImplementation(() => testData.transformers.list);

    await service.update(testData.transformers.list[0].id, command, 'userTest');

    assert.strictEqual(transformerRepository.save.mock.calls.length, 1);
    assert.deepStrictEqual(transformerRepository.save.mock.calls[0].arguments[0], {
      ...command,
      id: testData.transformers.list[0].id,
      type: 'custom',
      createdBy: customTransformer.createdBy,
      updatedBy: 'userTest',
      createdAt: customTransformer.createdAt,
      updatedAt: customTransformer.updatedAt
    });
  });

  it('should not update if the transformer is not found', async () => {
    transformerRepository.findById.mock.mockImplementation(() => null);

    await assert.rejects(
      () => service.update(testData.transformers.list[0].id, testData.transformers.command, 'userTest'),
      new Error(`Transformer "${testData.transformers.list[0].id}" not found`)
    );

    assert.strictEqual(transformerRepository.findById.mock.calls.length, 1);
    assert.deepStrictEqual(transformerRepository.findById.mock.calls[0].arguments, [testData.transformers.list[0].id]);
    assert.strictEqual(transformerRepository.save.mock.calls.length, 0);
  });

  it('should not update a transformer with duplicate name', async () => {
    const command = JSON.parse(JSON.stringify(testData.transformers.command));
    command.name = 'Duplicate Name';
    transformerRepository.findById.mock.mockImplementation(() => testData.transformers.list[0]);
    transformerRepository.list.mock.mockImplementation(() => [
      { ...testData.transformers.list[0], id: 'other-id', name: 'Duplicate Name' }
    ]);

    await assert.rejects(
      () => service.update(testData.transformers.list[0].id, command, 'userTest'),
      new OIBusValidationError(`Transformer name "Duplicate Name" already exists`)
    );
  });

  it('should not update if the transformer is a standard one', async () => {
    const standardTransformer: StandardTransformer = {
      id: 'id',
      type: 'standard'
    } as StandardTransformer;
    transformerRepository.findById.mock.mockImplementation(() => standardTransformer);

    await assert.rejects(
      () => service.update(standardTransformer.id, testData.transformers.command, 'userTest'),
      new Error(`Cannot edit standard transformer "${standardTransformer.id}"`)
    );

    assert.strictEqual(transformerRepository.findById.mock.calls.length, 1);
    assert.deepStrictEqual(transformerRepository.findById.mock.calls[0].arguments, [standardTransformer.id]);
    assert.strictEqual(transformerRepository.save.mock.calls.length, 0);
  });

  it('should call reloadTransformer when custom code changes', async () => {
    const command = JSON.parse(JSON.stringify(testData.transformers.command));
    command.name = customTransformer.name;
    command.customCode = 'console.log("updated code");';
    transformerRepository.findById.mock.mockImplementation(() => JSON.parse(JSON.stringify(testData.transformers.list[0])));

    await service.update(testData.transformers.list[0].id, command, 'userTest');

    assert.strictEqual(transformerRepository.save.mock.calls.length, 1);
    assert.strictEqual(engine.reloadTransformer.mock.calls.length, 1);
    assert.deepStrictEqual(engine.reloadTransformer.mock.calls[0].arguments, [testData.transformers.list[0].id]);
    assert.strictEqual(engine.removeAndReloadTransformer.mock.calls.length, 0);
  });

  it('should call removeAndReloadTransformer when manifest changes', async () => {
    const command = JSON.parse(JSON.stringify(testData.transformers.command));
    command.name = customTransformer.name;
    command.customManifest = { ...command.customManifest, key: 'transformers.updated' };
    transformerRepository.findById.mock.mockImplementation(() => JSON.parse(JSON.stringify(testData.transformers.list[0])));

    await service.update(testData.transformers.list[0].id, command, 'userTest');

    assert.strictEqual(transformerRepository.save.mock.calls.length, 1);
    assert.strictEqual(engine.removeAndReloadTransformer.mock.calls.length, 1);
    assert.deepStrictEqual(engine.removeAndReloadTransformer.mock.calls[0].arguments, [testData.transformers.list[0].id, 'userTest']);
    assert.strictEqual(engine.reloadTransformer.mock.calls.length, 0);
  });

  it('should not call engine reload when only name or description changes', async () => {
    const command = JSON.parse(JSON.stringify(testData.transformers.command));
    command.name = customTransformer.name;
    command.description = 'Updated description only';
    transformerRepository.findById.mock.mockImplementation(() => JSON.parse(JSON.stringify(testData.transformers.list[0])));

    await service.update(testData.transformers.list[0].id, command, 'userTest');

    assert.strictEqual(transformerRepository.save.mock.calls.length, 1);
    assert.strictEqual(engine.reloadTransformer.mock.calls.length, 0);
    assert.strictEqual(engine.removeAndReloadTransformer.mock.calls.length, 0);
  });

  it('should delete a transformer', async () => {
    transformerRepository.findById.mock.mockImplementation(() => testData.transformers.list[0]);

    await service.delete(testData.transformers.list[0].id, 'userTest');

    assert.strictEqual(transformerRepository.findById.mock.calls.length, 1);
    assert.deepStrictEqual(transformerRepository.findById.mock.calls[0].arguments, [testData.transformers.list[0].id]);
    assert.strictEqual(engine.removeAndReloadTransformer.mock.calls.length, 1);
    assert.deepStrictEqual(engine.removeAndReloadTransformer.mock.calls[0].arguments, [testData.transformers.list[0].id, 'userTest']);
    assert.strictEqual(transformerRepository.delete.mock.calls.length, 1);
    assert.deepStrictEqual(transformerRepository.delete.mock.calls[0].arguments, [testData.transformers.list[0].id, 'userTest']);
  });

  it('should not delete if the transformer is not found', async () => {
    transformerRepository.findById.mock.mockImplementation(() => null);

    await assert.rejects(
      () => service.delete(testData.transformers.list[0].id, 'userTest'),
      new Error(`Transformer "${testData.transformers.list[0].id}" not found`)
    );

    assert.strictEqual(transformerRepository.findById.mock.calls.length, 1);
    assert.deepStrictEqual(transformerRepository.findById.mock.calls[0].arguments, [testData.transformers.list[0].id]);
    assert.strictEqual(transformerRepository.delete.mock.calls.length, 0);
  });

  it('should not delete if the transformer is a standard one', async () => {
    const standardTransformer: StandardTransformer = {
      id: 'id',
      type: 'standard'
    } as StandardTransformer;
    transformerRepository.findById.mock.mockImplementation(() => standardTransformer);

    await assert.rejects(
      () => service.delete(standardTransformer.id, 'userTest'),
      new Error(`Cannot delete standard transformer "${standardTransformer.id}"`)
    );

    assert.strictEqual(transformerRepository.findById.mock.calls.length, 1);
    assert.deepStrictEqual(transformerRepository.findById.mock.calls[0].arguments, [standardTransformer.id]);
    assert.strictEqual(transformerRepository.save.mock.calls.length, 0);
  });

  it('should create standard transformers', () => {
    const logger = new LoggerMock();
    const transformer: StandardTransformer = JSON.parse(JSON.stringify(testData.transformers.list[0]));
    transformer.type = 'standard';
    const create = () =>
      createTransformer(
        { id: 'northTransformerId1', transformer, options: {}, source: { type: 'oianalytics-setpoint' } },
        testData.north.list[0],
        logger
      );

    const expectedClasses: Array<[string, abstract new (...args: Array<never>) => unknown]> = [
      ['file-to-mqtt', FileToMQTTTransformer],
      ['file-to-record-list', FileToRecordListTransformer],
      ['file-to-file', FileToFileTransformer],
      ['file-to-modbus', FileToModbusTransformer],
      ['file-to-opcua', FileToOPCUATransformer],
      ['file-to-oianalytics', FileToOIAnalyticsTransformer],
      ['record-list-to-file', RecordListToFileTransformer],
      ['record-list-to-modbus', RecordListToModbusTransformer],
      ['record-list-to-mqtt', RecordListToMQTTTransformer],
      ['record-list-to-oianalytics', RecordListToOIAnalyticsTransformer],
      ['record-list-to-opcua', RecordListToOPCUATransformer]
    ];
    for (const [functionName, expectedClass] of expectedClasses) {
      transformer.functionName = functionName;
      assert.ok(create() instanceof expectedClass, functionName);
    }

    transformer.functionName = 'bad-id';
    assert.throws(() => create(), /not implemented/);
  });

  it('createTransformer() should create a custom transformer', () => {
    const logger = new LoggerMock();

    const transformer: CustomTransformer = JSON.parse(JSON.stringify(testData.transformers.list[0]));

    // createTransformer with custom transformer uses the mocked OIBusCustomTransformer constructor
    const result = createTransformer(
      { id: 'northTransformerId1', transformer, options: {}, source: { type: 'oianalytics-setpoint' } },
      testData.north.list[0],
      logger
    );
    // The mock class provides a transform method
    assert.ok(result !== null && result !== undefined && 'transform' in result);
  });

  describe('runTransformerOnContent', () => {
    const metadata = { contentFile: 'f', contentType: 'file', numberOfElement: 1, contentSize: 0, createdAt: '' };
    // Loosely-typed wrapper to avoid verbose OIBusContent casts in each call.
    const run = () =>
      runTransformerOnContent as unknown as (
        transformer: unknown,
        data: unknown,
        source: unknown,
        maxElements?: number
      ) => Promise<Array<{ output: Buffer; metadata: unknown }>>;
    const buildTransformer = () => ({
      transformInMemory: mock.fn(async (_data: unknown, _source: unknown, _filename: string | null) => ({
        output: Buffer.from('imem'),
        metadata
      })),
      transform: mock.fn(async (_data: unknown, _source: unknown, _filename: string | null) => ({
        output: Buffer.from('stream'),
        metadata
      }))
    });

    it('runs a single batch for time-values without chunking', async () => {
      const t = buildTransformer();
      const content = [{ pointId: 'p1' }, { pointId: 'p2' }];
      const results = await run()(t, { type: 'record-list', content }, { source: 'test' });
      assert.strictEqual(t.transformInMemory.mock.calls.length, 1);
      assert.deepStrictEqual(t.transformInMemory.mock.calls[0].arguments[0], content);
      assert.strictEqual(results.length, 1);
    });

    it('chunks time-values when maxElements is exceeded', async () => {
      const t = buildTransformer();
      const content = [{ pointId: 'p1' }, { pointId: 'p2' }, { pointId: 'p3' }];
      const results = await run()(t, { type: 'record-list', content }, { source: 'test' }, 2);
      assert.strictEqual(t.transformInMemory.mock.calls.length, 2);
      assert.deepStrictEqual(t.transformInMemory.mock.calls[0].arguments[0], content.slice(0, 2));
      assert.deepStrictEqual(t.transformInMemory.mock.calls[1].arguments[0], content.slice(2));
      assert.strictEqual(results.length, 2);
    });

    it('runs the files held in memory in memory', async () => {
      const t = buildTransformer();
      await run()(t, { type: 'file', content: 'raw' }, { source: 'test' });
      assert.strictEqual(t.transformInMemory.mock.calls.length, 1);
      assert.strictEqual(t.transformInMemory.mock.calls[0].arguments[0], 'raw');
    });

    it('streams any file content through transform', async () => {
      const createReadStreamMock = mock.method(fs, 'createReadStream', (_path: string) => 'stream');
      const t = buildTransformer();
      const results = await run()(t, { type: 'file', filePath: '/tmp/data.csv' }, { source: 'test' });
      assert.strictEqual(createReadStreamMock.mock.calls.length, 1);
      assert.strictEqual(createReadStreamMock.mock.calls[0].arguments[0], '/tmp/data.csv');
      assert.strictEqual(t.transform.mock.calls.length, 1);
      assert.strictEqual(t.transform.mock.calls[0].arguments[0], 'stream');
      assert.ok((t.transform.mock.calls[0].arguments[2] as string).includes('random-id'));
      assert.strictEqual(results.length, 1);
    });

    it('runs any content in memory when no file was written to filePath', async () => {
      const createReadStreamMock = mock.method(fs, 'createReadStream', () => 'stream');
      const t = buildTransformer();
      const results = await run()(t, { type: 'file', filePath: 'does-not-exist.csv', content: 'a;b\n1;2' }, { source: 'test' });
      assert.strictEqual(createReadStreamMock.mock.calls.length, 0);
      assert.strictEqual(t.transformInMemory.mock.calls.length, 1);
      assert.strictEqual(t.transformInMemory.mock.calls[0].arguments[0], 'a;b\n1;2');
      assert.ok((t.transformInMemory.mock.calls[0].arguments[2] as string).includes('random-id'));
      assert.strictEqual(results.length, 1);
    });
  });

  describe('toTransformedContent', () => {
    it('parses time-values output into a time-values content', () => {
      const tv = [{ pointId: 'p', timestamp: '2024-01-01T00:00:00.000Z', value: '1' }];
      assert.deepStrictEqual(toTransformedContent(JSON.stringify(tv), 'record-list', 'out.json'), { type: 'record-list', content: tv });
    });

    it('falls back to a file held in memory when time-values output is not valid JSON', () => {
      assert.deepStrictEqual(toTransformedContent('not-json', 'record-list', 'out.json'), { type: 'file', content: 'not-json' });
    });

    it('wraps "file" output as a file so a table can be rendered', () => {
      assert.deepStrictEqual(toTransformedContent('a;b\n1;2', 'file', 'result.csv'), {
        type: 'file',
        filePath: 'result.csv',
        content: 'a;b\n1;2'
      });
      // defaults the file name when none provided
      assert.deepStrictEqual(toTransformedContent('x', 'file', undefined), { type: 'file', filePath: 'output', content: 'x' });
    });

    it('returns a file held in memory for every other output type', () => {
      assert.deepStrictEqual(toTransformedContent('payload', 'mqtt', 'f'), { type: 'file', content: 'payload' });
      assert.deepStrictEqual(toTransformedContent('payload', undefined, undefined), { type: 'file', content: 'payload' });
    });
  });

  describe('testTransformer', () => {
    it('wraps time-values input and delegates to runTransformer with the resolved transformer', async () => {
      const tv = [{ pointId: 'p', timestamp: '2024-01-01T00:00:00.000Z', value: '1' }];
      transformerRepository.findById.mock.mockImplementation(() => ({ id: 't1', type: 'standard', inputType: 'record-list' }) as never);
      const runSpy = mock.method(service, 'runTransformer', async () => ({ type: 'file', content: 'done' }) as never);

      const result = await service.testTransformer('t1', { foo: 'bar' }, JSON.stringify(tv));

      assert.deepStrictEqual(runSpy.mock.calls[0].arguments, ['t1', { foo: 'bar' }, { type: 'record-list', content: tv }]);
      assert.deepStrictEqual(result, {
        raw: { type: 'record-list', content: tv },
        transformed: { type: 'file', content: 'done' },
        connectionDuration: 0,
        queryDuration: 0
      });
    });

    it('wraps non-structured input as a file held in memory', async () => {
      transformerRepository.findById.mock.mockImplementation(() => ({ id: 't2', type: 'standard', inputType: 'file' }) as never);
      const runSpy = mock.method(service, 'runTransformer', async () => ({ type: 'file', content: '' }) as never);

      await service.testTransformer('t2', {}, 'raw text');

      assert.deepStrictEqual(runSpy.mock.calls[0].arguments, ['t2', {}, { type: 'file', content: 'raw text' }]);
    });
  });

  describe('runTransformer', () => {
    it('runs a standard transformer end to end and wraps the result as OIBusContent', async () => {
      const standardTransformer: StandardTransformer = {
        id: 'std-json',
        type: 'standard',
        inputType: 'record-list',
        outputType: 'file',
        functionName: 'record-list-to-file'
      } as StandardTransformer;
      transformerRepository.findById.mock.mockImplementation(() => standardTransformer);

      const content = {
        type: 'record-list' as const,
        content: [{ pointId: 'p1', timestamp: '2024-01-01T00:00:00.000Z', value: '1' }]
      };
      const result = await service.runTransformer('std-json', {}, content);

      assert.strictEqual(transformerRepository.findById.mock.calls[0].arguments[0], 'std-json');
      assert.strictEqual(result.type, 'file');
      assert.match((result as { filePath: string }).filePath, /^[\d_]+\.json$/);
      assert.strictEqual(result.content, JSON.stringify(content.content));
    });

    it('runs the file transformer, writing a payload as a file', async () => {
      transformerRepository.findById.mock.mockImplementation(
        () => ({ id: 'file', type: 'standard', inputType: 'file', outputType: 'file', functionName: 'file' }) as StandardTransformer
      );

      const result = await service.runTransformer('file', {}, { type: 'file', content: '{"a":1}' });

      assert.strictEqual(result.type, 'file');
      assert.strictEqual(result.content, '{"a":1}');
    });

    it('throws a NotFoundError when the transformer to run does not exist', async () => {
      transformerRepository.findById.mock.mockImplementation(() => null);

      await assert.rejects(
        async () => service.runTransformer('bad-id', {}, { type: 'file', content: 'x' }),
        new NotFoundError('Transformer "bad-id" not found')
      );
    });
  });

  describe('test a custom transformer', () => {
    const customCode = `
      function transform(data, source, filename, options) {
        return {
          data: JSON.parse(data),
          filename: 'test-output.json',
          numberOfElement: 1
        };
      }
    `;

    const customManifest = {
      type: 'object' as const,
      key: 'options',
      translationKey: 'test',
      attributes: [] as [],
      enablingConditions: [] as [],
      validators: [] as [],
      displayProperties: { visible: true, wrapInBox: false }
    };

    const baseCommand = {
      type: 'custom' as const,
      name: 'Test Transformer',
      description: 'Test transformer for testing',
      inputType: 'record-list' as const,
      outputType: 'file' as const,
      customCode,
      language: 'javascript' as const,
      timeout: 2000,
      customManifest
    };

    it('should test a custom transformer successfully', async () => {
      const testRequest = {
        inputData: JSON.stringify([{ pointId: 'test', timestamp: '2023-01-01T00:00:00Z', value: 42 }]),
        options: { testOption: 'value' }
      };

      const result = await service.test(baseCommand, testRequest);

      assert.ok('output' in result);
      assert.ok('metadata' in result);
      assert.strictEqual(result.metadata.contentType, 'file');
      assert.strictEqual(result.metadata.numberOfElement, 1);
    });

    it('should test a custom transformer with undefined options', async () => {
      const testRequest = {
        inputData: JSON.stringify([{ pointId: 'test', timestamp: '2023-01-01T00:00:00Z', value: 42 }])
        // options is undefined
      };

      const result = await service.test(baseCommand, testRequest);

      assert.ok('output' in result);
      assert.ok('metadata' in result);
      assert.strictEqual(result.metadata.contentType, 'file');
      assert.strictEqual(result.metadata.numberOfElement, 1);
    });

    it('should return output as a string', async () => {
      const testRequest = { inputData: 'data' };

      const result = await service.test(baseCommand, testRequest);

      assert.strictEqual(typeof result.output, 'string');
    });
  });

  describe('generateRecordListTemplate', () => {
    it('should generate a record-list template of point records', () => {
      const template = service.generateTemplate('record-list');

      assert.strictEqual(template.type, 'record-list');
      const data = JSON.parse(template.data);
      assert.strictEqual(data.length, 3);
      assert.deepStrictEqual(
        { ...data[0], timestamp: undefined },
        {
          pointId: 'temperature_sensor_01',
          timestamp: undefined,
          value: 23.5,
          quality: 'good'
        }
      );
      assert.ok(!Number.isNaN(Date.parse(data[0].timestamp)));
    });
  });

  describe('generateFileTemplate', () => {
    it('should generate file template with sample data', () => {
      const template = service.generateTemplate('file');

      assert.strictEqual(template.type, 'file');
      assert.strictEqual(template.description, 'Sample file content with structured data');

      const data = JSON.parse(template.data);
      assert.ok('timestamp' in data);
      assert.strictEqual(data.source, 'test_device');
      assert.ok('measurements' in data);
      assert.ok('metadata' in data);

      assert.strictEqual(data.measurements.temperature, 23.5);
      assert.strictEqual(data.measurements.humidity, 65.2);
      assert.strictEqual(data.measurements.pressure, 1013.25);

      assert.strictEqual(data.metadata.device_id, 'sensor_001');
      assert.strictEqual(data.metadata.location, 'building_a_floor_2');
      assert.strictEqual(data.metadata.firmware_version, '1.2.3');
    });
  });

  it('should retrieve a list of transformer manifests', () => {
    const list = service.listManifest();
    assert.ok(list !== undefined && list !== null);
    assert.ok(list.length > 0);
  });

  it('should retrieve a transformer manifest', () => {
    const manifest = service.getManifest('file');
    assert.deepStrictEqual(manifest, fileManifest);
  });

  it('should throw an error if transformer manifest is not found', () => {
    assert.throws(() => service.getManifest('bad'), new NotFoundError(`Transformer manifest "bad" not found`));
  });

  it('should get standard manifest', () => {
    assert.deepStrictEqual(getStandardManifest('file-to-mqtt'), fileToMqttManifest.settings);
    assert.deepStrictEqual(getStandardManifest('file-to-record-list'), fileToRecordListManifest.settings);
    assert.deepStrictEqual(getStandardManifest('file'), fileManifest.settings);
    assert.deepStrictEqual(getStandardManifest('file-to-file'), fileToFileManifest.settings);
    assert.deepStrictEqual(getStandardManifest('file-to-modbus'), fileToModbusManifest.settings);
    assert.deepStrictEqual(getStandardManifest('file-to-opcua'), fileToOpcuaManifest.settings);
    assert.deepStrictEqual(getStandardManifest('file-to-oianalytics'), fileToOianalyticsManifest.settings);
    assert.deepStrictEqual(getStandardManifest('record-list-to-file'), recordListToFileManifest.settings);
    assert.deepStrictEqual(getStandardManifest('record-list-to-modbus'), recordListToModbusManifest.settings);
    assert.deepStrictEqual(getStandardManifest('record-list-to-mqtt'), recordListToMqttManifest.settings);
    assert.deepStrictEqual(getStandardManifest('record-list-to-oianalytics'), recordListToOianalyticsManifest.settings);
    assert.deepStrictEqual(getStandardManifest('record-list-to-opcua'), recordListToOpcuaManifest.settings);
    assert.throws(() => getStandardManifest('bad-id'), /Could not find manifest for "bad-id" transformer/);
  });

  it('should properly convert to DTO with empty createdBy/updatedBy', () => {
    const getUserInfo = (id: string) => ({ id, friendlyName: id });
    const customTransformerNoAudit = { ...customTransformer, createdBy: '', updatedBy: '' };
    const result = toTransformerDTO(customTransformerNoAudit, getUserInfo);
    assert.ok(result.type === 'custom');
    assert.deepStrictEqual(result.createdBy, { id: '', friendlyName: '' });
    assert.deepStrictEqual(result.updatedBy, { id: '', friendlyName: '' });
  });

  it('should properly convert to DTO with non-empty createdBy/updatedBy', () => {
    const getUserInfo = (id: string) => ({ id, friendlyName: id });
    const customTransformerWithAudit = { ...customTransformer, createdBy: 'user1', updatedBy: 'user2' };
    const result = toTransformerDTO(customTransformerWithAudit, getUserInfo);
    assert.ok(result.type === 'custom');
    assert.deepStrictEqual(result.createdBy, { id: 'user1', friendlyName: 'user1' });
    assert.deepStrictEqual(result.updatedBy, { id: 'user2', friendlyName: 'user2' });
  });

  it('should properly convert to DTO', () => {
    const customTransformer = testData.transformers.list[0] as CustomTransformer;
    const getUserInfo = (id: string) => ({ id, friendlyName: id });
    assert.deepStrictEqual(toTransformerDTO(testData.transformers.list[0], getUserInfo), {
      id: customTransformer.id,
      type: customTransformer.type,
      name: customTransformer.name,
      description: customTransformer.description,
      inputType: customTransformer.inputType,
      language: customTransformer.language,
      outputType: customTransformer.outputType,
      customCode: customTransformer.customCode,
      timeout: customTransformer.timeout,
      manifest: customTransformer.customManifest,
      createdBy: getUserInfo(customTransformer.createdBy),
      updatedBy: getUserInfo(customTransformer.updatedBy),
      createdAt: customTransformer.createdAt,
      updatedAt: customTransformer.updatedAt
    });
    const standardTransformer: StandardTransformer = {
      id: 'standardId',
      inputType: 'record-list',
      outputType: 'record-list',
      type: 'standard',
      functionName: 'file'
    };
    assert.deepStrictEqual(toTransformerDTO(standardTransformer, getUserInfo), {
      id: standardTransformer.id,
      type: standardTransformer.type,
      inputType: standardTransformer.inputType,
      outputType: standardTransformer.outputType,
      functionName: standardTransformer.functionName,
      manifest: fileManifest.settings
    });
  });
});
