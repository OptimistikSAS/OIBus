import { describe, it, beforeEach, afterEach, before, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

import testData from '../tests/utils/test-data';
import { mockModule, reloadModule } from '../tests/utils/test-utils';
import type TransformerServiceType from './transformer.service';
import type {
  createTransformer as createTransformerType,
  getStandardManifest as getStandardManifestType,
  toTransformerDTO as toTransformerDTOType
} from './transformer.service';
import TransformerRepositoryMock from '../tests/__mocks__/repository/config/transformer-repository.mock';
import OianalyticsMessageServiceMock from '../tests/__mocks__/service/oia/oianalytics-message-service.mock';
import DataStreamEngineMock from '../tests/__mocks__/data-stream-engine.mock';
import type LoggerMock from '../tests/__mocks__/service/logger/logger.mock';
import { CustomTransformer, StandardTransformer } from '../model/transformer.model';
import { NotFoundError, OIBusValidationError } from '../model/types';

// Import transformer manifests
import isoManifest from '../transformers/iso-transformer/manifest';
import ignoreManifest from '../transformers/ignore-transformer/manifest';
import csvToMqttManifest from '../transformers/any/csv-to-mqtt/manifest';
import csvToTimeValuesManifest from '../transformers/any/csv-to-time-values/manifest';
import jsonToCsvManifest from '../transformers/any/json-to-csv/manifest';
import timeValuesToCsvManifest from '../transformers/time-values/oibus-time-values-to-csv/manifest';
import timeValuesToJsonManifest from '../transformers/time-values/oibus-time-values-to-json/manifest';
import timeValuesToModbusManifest from '../transformers/time-values/oibus-time-values-to-modbus/manifest';
import timeValuesToMqttManifest from '../transformers/time-values/oibus-time-values-to-mqtt/manifest';
import timeValuesToOianalyticsManifest from '../transformers/time-values/oibus-time-values-to-oianalytics/manifest';
import timeValuesToOpcuaManifest from '../transformers/time-values/oibus-time-values-to-opcua/manifest';
import setpointToModbusManifest from '../transformers/setpoint/oibus-setpoint-to-modbus/manifest';
import setpointToMqttManifest from '../transformers/setpoint/oibus-setpoint-to-mqtt/manifest';
import setpointToOpcuaManifest from '../transformers/setpoint/oibus-setpoint-to-opcua/manifest';

// Import concrete transformer classes for instanceof checks
import OIBusTimeValuesToJSONTransformer from '../transformers/time-values/oibus-time-values-to-json/oibus-time-values-to-json-transformer';
import OIBusTimeValuesToCsvTransformer from '../transformers/time-values/oibus-time-values-to-csv/oibus-time-values-to-csv-transformer';
import OIBusTimeValuesToModbusTransformer from '../transformers/time-values/oibus-time-values-to-modbus/oibus-time-values-to-modbus-transformer';
import OIBusTimeValuesToOPCUATransformer from '../transformers/time-values/oibus-time-values-to-opcua/oibus-time-values-to-opcua-transformer';
import OIBusTimeValuesToMQTTTransformer from '../transformers/time-values/oibus-time-values-to-mqtt/oibus-time-values-to-mqtt-transformer';
import OIBusSetpointToMQTTTransformer from '../transformers/setpoint/oibus-setpoint-to-mqtt/oibus-setpoint-to-mqtt-transformer';
import OIBusSetpointToModbusTransformer from '../transformers/setpoint/oibus-setpoint-to-modbus/oibus-setpoint-to-modbus-transformer';
import OIBusSetpointToOPCUATransformer from '../transformers/setpoint/oibus-setpoint-to-opcua/oibus-setpoint-to-opcua-transformer';
import OIBusTimeValuesToOIAnalyticsTransformer from '../transformers/time-values/oibus-time-values-to-oianalytics/oibus-time-values-to-oianalytics-transformer';
import JSONToCSVTransformer from '../transformers/any/json-to-csv/json-to-csv-transformer';
import CSVToMQTTTransformer from '../transformers/any/csv-to-mqtt/csv-to-mqtt-transformer';
import CSVToTimeValuesTransformer from '../transformers/any/csv-to-time-values/csv-to-time-values-transformer';

const nodeRequire = createRequire(import.meta.url);

// Mocked module exports — mutated in-place between tests
let mockUtils: Record<string, ReturnType<typeof mock.fn>>;
let mockPapaparse: Record<string, ReturnType<typeof mock.fn>>;
let mockIsolatedVm: Record<string, unknown>;
let mockCustomTransformer: Record<string, unknown>;

let TransformerService: new (...args: Array<unknown>) => InstanceType<typeof TransformerServiceType>;
let createTransformer: typeof createTransformerType;
let getStandardManifest: typeof getStandardManifestType;
let toTransformerDTO: typeof toTransformerDTOType;

before(() => {
  mockUtils = {
    generateRandomId: mock.fn(() => 'random-id')
  };
  mockPapaparse = {
    parse: mock.fn(),
    unparse: mock.fn()
  };
  mockIsolatedVm = { default: { Isolate: mock.fn() } };
  // OIBusCustomTransformer is used with `new`, so the mock must be a class.
  // We keep a stable class that delegates to a replaceable factory so that
  // in-place mutation of mockCustomTransformer.default works across tests.
  class MockOIBusCustomTransformer {
    transform: ReturnType<typeof mock.fn>;
    constructor() {
      this.transform = mock.fn(async () => ({
        metadata: { contentType: 'any', numberOfElement: 1 },
        output: JSON.stringify({ data: [{ pointId: 'test', timestamp: '2023-01-01T00:00:00Z', data: { value: 42 } }] })
      }));
    }
  }
  mockCustomTransformer = { __esModule: true, default: MockOIBusCustomTransformer };

  mockModule(nodeRequire, './utils', mockUtils);
  mockModule(nodeRequire, 'papaparse', mockPapaparse);
  mockModule(nodeRequire, 'isolated-vm', mockIsolatedVm);
  mockModule(nodeRequire, '../transformers/oibus-custom-transformer', mockCustomTransformer);

  const mod = reloadModule<{
    default: new (...args: Array<unknown>) => InstanceType<typeof TransformerServiceType>;
    createTransformer: typeof createTransformerType;
    getStandardManifest: typeof getStandardManifestType;
    toTransformerDTO: typeof toTransformerDTOType;
  }>(nodeRequire, './transformer.service');
  TransformerService = mod.default;
  createTransformer = mod.createTransformer;
  getStandardManifest = mod.getStandardManifest;
  toTransformerDTO = mod.toTransformerDTO;
});

describe('Transformer Service', () => {
  let service: InstanceType<typeof TransformerServiceType>;
  let transformerRepository: TransformerRepositoryMock;
  let oiAnalyticsMessageService: OianalyticsMessageServiceMock;
  let engine: DataStreamEngineMock;
  // JoiValidator is not mocked as a module — its validate method is a no-op (async, returns undefined)
  // We use a real instance but spy on it via mock.method
  let validator: { validate: ReturnType<typeof mock.fn> };

  beforeEach(() => {
    transformerRepository = new TransformerRepositoryMock();
    oiAnalyticsMessageService = new OianalyticsMessageServiceMock();
    engine = new DataStreamEngineMock(null);
    validator = { validate: mock.fn(async () => undefined) };

    transformerRepository.list.mock.mockImplementation(() => []);

    // Reset custom transformer mock — keep the same stable class reference so
    // that the already-loaded SUT module still sees a valid constructor.
    // The class creates fresh mock.fn instances per construction, so no reset needed.

    service = new TransformerService(
      validator as unknown as Parameters<typeof TransformerService>[0],
      transformerRepository,
      oiAnalyticsMessageService,
      engine
    );
  });

  afterEach(() => {
    mock.restoreAll();
  });

  it('should search transformers', () => {
    transformerRepository.search.mock.mockImplementation(() => testData.transformers.list);

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
    assert.deepStrictEqual(result, testData.transformers.list);
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

    assert.strictEqual(validator.validate.mock.calls.length, 1);
    assert.deepStrictEqual(result, { ...testData.transformers.command, createdBy: 'userTest', updatedBy: 'userTest' });
  });

  it('should not create a transformer with duplicate name', async () => {
    transformerRepository.list.mock.mockImplementation(() => [
      { id: 'existing-id', type: 'custom', name: testData.transformers.command.name }
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

    assert.strictEqual(validator.validate.mock.calls.length, 1);
    assert.strictEqual(transformerRepository.findById.mock.calls.length, 1);
    assert.deepStrictEqual(transformerRepository.findById.mock.calls[0].arguments, [testData.transformers.list[0].id]);
    assert.strictEqual(transformerRepository.save.mock.calls.length, 1);
    assert.deepStrictEqual(transformerRepository.save.mock.calls[0].arguments[0], {
      ...testData.transformers.command,
      id: testData.transformers.list[0].id,
      type: 'custom',
      createdBy: (testData.transformers.list[0] as CustomTransformer).createdBy,
      updatedBy: 'userTest',
      createdAt: (testData.transformers.list[0] as CustomTransformer).createdAt,
      updatedAt: (testData.transformers.list[0] as CustomTransformer).updatedAt
    });
  });

  it('should update a transformer without changing the name', async () => {
    const command = JSON.parse(JSON.stringify(testData.transformers.command));
    command.name = (testData.transformers.list[0] as CustomTransformer).name;
    transformerRepository.findById.mock.mockImplementation(() => JSON.parse(JSON.stringify(testData.transformers.list[0])));

    await service.update(testData.transformers.list[0].id, command, 'userTest');

    assert.strictEqual(transformerRepository.save.mock.calls.length, 1);
    assert.deepStrictEqual(transformerRepository.save.mock.calls[0].arguments[0], {
      ...command,
      id: testData.transformers.list[0].id,
      type: 'custom',
      createdBy: (testData.transformers.list[0] as CustomTransformer).createdBy,
      updatedBy: 'userTest',
      createdAt: (testData.transformers.list[0] as CustomTransformer).createdAt,
      updatedAt: (testData.transformers.list[0] as CustomTransformer).updatedAt
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
      createdBy: (testData.transformers.list[0] as CustomTransformer).createdBy,
      updatedBy: 'userTest',
      createdAt: (testData.transformers.list[0] as CustomTransformer).createdAt,
      updatedAt: (testData.transformers.list[0] as CustomTransformer).updatedAt
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
    transformerRepository.list.mock.mockImplementation(() => [{ id: 'other-id', type: 'custom', name: 'Duplicate Name' }]);

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
    command.name = (testData.transformers.list[0] as CustomTransformer).name;
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
    command.name = (testData.transformers.list[0] as CustomTransformer).name;
    command.customManifest = { ...command.customManifest, key: 'transformers.updated' };
    transformerRepository.findById.mock.mockImplementation(() => JSON.parse(JSON.stringify(testData.transformers.list[0])));

    await service.update(testData.transformers.list[0].id, command, 'userTest');

    assert.strictEqual(transformerRepository.save.mock.calls.length, 1);
    assert.strictEqual(engine.removeAndReloadTransformer.mock.calls.length, 1);
    assert.deepStrictEqual(engine.removeAndReloadTransformer.mock.calls[0].arguments, [testData.transformers.list[0].id]);
    assert.strictEqual(engine.reloadTransformer.mock.calls.length, 0);
  });

  it('should not call engine reload when only name or description changes', async () => {
    const command = JSON.parse(JSON.stringify(testData.transformers.command));
    command.name = (testData.transformers.list[0] as CustomTransformer).name;
    command.description = 'Updated description only';
    transformerRepository.findById.mock.mockImplementation(() => JSON.parse(JSON.stringify(testData.transformers.list[0])));

    await service.update(testData.transformers.list[0].id, command, 'userTest');

    assert.strictEqual(transformerRepository.save.mock.calls.length, 1);
    assert.strictEqual(engine.reloadTransformer.mock.calls.length, 0);
    assert.strictEqual(engine.removeAndReloadTransformer.mock.calls.length, 0);
  });

  it('should delete a transformer', async () => {
    transformerRepository.findById.mock.mockImplementation(() => testData.transformers.list[0]);

    await service.delete(testData.transformers.list[0].id);

    assert.strictEqual(transformerRepository.findById.mock.calls.length, 1);
    assert.deepStrictEqual(transformerRepository.findById.mock.calls[0].arguments, [testData.transformers.list[0].id]);
    assert.strictEqual(engine.removeAndReloadTransformer.mock.calls.length, 1);
    assert.deepStrictEqual(engine.removeAndReloadTransformer.mock.calls[0].arguments, [testData.transformers.list[0].id]);
    assert.strictEqual(transformerRepository.delete.mock.calls.length, 1);
    assert.deepStrictEqual(transformerRepository.delete.mock.calls[0].arguments, [testData.transformers.list[0].id]);
  });

  it('should not delete if the transformer is not found', async () => {
    transformerRepository.findById.mock.mockImplementation(() => null);

    await assert.rejects(
      () => service.delete(testData.transformers.list[0].id),
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
      () => service.delete(standardTransformer.id),
      new Error(`Cannot delete standard transformer "${standardTransformer.id}"`)
    );

    assert.strictEqual(transformerRepository.findById.mock.calls.length, 1);
    assert.deepStrictEqual(transformerRepository.findById.mock.calls[0].arguments, [standardTransformer.id]);
    assert.strictEqual(transformerRepository.save.mock.calls.length, 0);
  });

  it('should create standard transformers', () => {
    const PinoLogger = nodeRequire('../tests/__mocks__/service/logger/logger.mock') as { default: new () => LoggerMock };
    const logger = new PinoLogger.default();

    const transformer: StandardTransformer = JSON.parse(JSON.stringify(testData.transformers.list[0]));
    transformer.type = 'standard';

    transformer.functionName = 'csv-to-mqtt';
    assert.ok(
      createTransformer(
        { id: 'northTransformerId1', transformer, options: {}, source: { type: 'oianalytics-setpoint' } },
        testData.north.list[0],
        logger
      ) instanceof CSVToMQTTTransformer
    );

    transformer.functionName = 'csv-to-time-values';
    assert.ok(
      createTransformer(
        { id: 'northTransformerId1', transformer, options: {}, source: { type: 'oianalytics-setpoint' } },
        testData.north.list[0],
        logger
      ) instanceof CSVToTimeValuesTransformer
    );

    transformer.functionName = 'json-to-csv';
    assert.ok(
      createTransformer(
        { id: 'northTransformerId1', transformer, options: {}, source: { type: 'oianalytics-setpoint' } },
        testData.north.list[0],
        logger
      ) instanceof JSONToCSVTransformer
    );

    transformer.functionName = 'time-values-to-csv';
    assert.ok(
      createTransformer(
        { id: 'northTransformerId1', transformer, options: {}, source: { type: 'oianalytics-setpoint' } },
        testData.north.list[0],
        logger
      ) instanceof OIBusTimeValuesToCsvTransformer
    );

    transformer.functionName = 'time-values-to-json';
    assert.ok(
      createTransformer(
        { id: 'northTransformerId1', transformer, options: {}, source: { type: 'oianalytics-setpoint' } },
        testData.north.list[0],
        logger
      ) instanceof OIBusTimeValuesToJSONTransformer
    );

    transformer.functionName = 'time-values-to-modbus';
    assert.ok(
      createTransformer(
        { id: 'northTransformerId1', transformer, options: {}, source: { type: 'oianalytics-setpoint' } },
        testData.north.list[0],
        logger
      ) instanceof OIBusTimeValuesToModbusTransformer
    );

    transformer.functionName = 'time-values-to-mqtt';
    assert.ok(
      createTransformer(
        { id: 'northTransformerId1', transformer, options: {}, source: { type: 'oianalytics-setpoint' } },
        testData.north.list[0],
        logger
      ) instanceof OIBusTimeValuesToMQTTTransformer
    );

    transformer.functionName = 'time-values-to-oianalytics';
    assert.ok(
      createTransformer(
        { id: 'northTransformerId1', transformer, options: {}, source: { type: 'oianalytics-setpoint' } },
        testData.north.list[0],
        logger
      ) instanceof OIBusTimeValuesToOIAnalyticsTransformer
    );

    transformer.functionName = 'time-values-to-opcua';
    assert.ok(
      createTransformer(
        { id: 'northTransformerId1', transformer, options: {}, source: { type: 'oianalytics-setpoint' } },
        testData.north.list[0],
        logger
      ) instanceof OIBusTimeValuesToOPCUATransformer
    );

    transformer.functionName = 'setpoint-to-modbus';
    assert.ok(
      createTransformer(
        { id: 'northTransformerId1', transformer, options: {}, source: { type: 'oianalytics-setpoint' } },
        testData.north.list[0],
        logger
      ) instanceof OIBusSetpointToModbusTransformer
    );

    transformer.functionName = 'setpoint-to-mqtt';
    assert.ok(
      createTransformer(
        { id: 'northTransformerId1', transformer, options: {}, source: { type: 'oianalytics-setpoint' } },
        testData.north.list[0],
        logger
      ) instanceof OIBusSetpointToMQTTTransformer
    );

    transformer.functionName = 'setpoint-to-opcua';
    assert.ok(
      createTransformer(
        { id: 'northTransformerId1', transformer, options: {}, source: { type: 'oianalytics-setpoint' } },
        testData.north.list[0],
        logger
      ) instanceof OIBusSetpointToOPCUATransformer
    );

    transformer.functionName = 'bad-id';
    assert.throws(
      () =>
        createTransformer(
          { id: 'northTransformerId1', transformer, options: {}, source: { type: 'oianalytics-setpoint' } },
          testData.north.list[0],
          logger
        ),
      /not implemented/
    );
  });

  it('createTransformer() should create a custom transformer', () => {
    const PinoLogger = nodeRequire('../tests/__mocks__/service/logger/logger.mock') as { default: new () => LoggerMock };
    const logger = new PinoLogger.default();

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
      inputType: 'time-values',
      outputType: 'any',
      customCode,
      language: 'javascript' as const,
      timeout: 2000,
      customManifest
    };

    it('should test a custom transformer successfully', async () => {
      const testRequest = {
        inputData: JSON.stringify([{ pointId: 'test', timestamp: '2023-01-01T00:00:00Z', data: { value: 42 } }]),
        options: { testOption: 'value' }
      };

      const result = await service.test(baseCommand, testRequest);

      assert.ok('output' in result);
      assert.ok('metadata' in result);
      assert.strictEqual(result.metadata.contentType, 'any');
      assert.strictEqual(result.metadata.numberOfElement, 1);
    });

    it('should test a custom transformer with undefined options', async () => {
      const testRequest = {
        inputData: JSON.stringify([{ pointId: 'test', timestamp: '2023-01-01T00:00:00Z', data: { value: 42 } }])
        // options is undefined
      };

      const result = await service.test(baseCommand, testRequest);

      assert.ok('output' in result);
      assert.ok('metadata' in result);
      assert.strictEqual(result.metadata.contentType, 'any');
      assert.strictEqual(result.metadata.numberOfElement, 1);
    });

    it('should return output as a string', async () => {
      const testRequest = { inputData: 'data' };

      const result = await service.test(baseCommand, testRequest);

      assert.strictEqual(typeof result.output, 'string');
    });
  });

  describe('generateTimeValuesTemplate', () => {
    it('should generate time-values template with sample data', () => {
      const template = service.generateTemplate('time-values');

      assert.strictEqual(template.type, 'time-values');
      assert.strictEqual(template.description, 'Sample time-series data with multiple sensor readings');

      const data = JSON.parse(template.data);
      assert.ok(Array.isArray(data));
      assert.strictEqual(data.length, 3);

      assert.strictEqual(data[0].pointId, 'temperature_sensor_01');
      assert.ok('timestamp' in data[0]);
      assert.ok('data' in data[0]);
      assert.strictEqual(data[0].data.value, 23.5);
      assert.strictEqual(data[0].data.unit, '°C');
      assert.strictEqual(data[0].data.quality, 'good');
    });
  });

  describe('generateSetpointTemplate', () => {
    it('should generate setpoint template with sample data', () => {
      const template = service.generateTemplate('setpoint');

      assert.strictEqual(template.type, 'setpoint');
      assert.strictEqual(template.description, 'Sample setpoint commands for various parameters');

      const data = JSON.parse(template.data);
      assert.ok(Array.isArray(data));
      assert.strictEqual(data.length, 4);

      assert.strictEqual(data[0].reference, 'setpoint_temperature');
      assert.strictEqual(data[0].value, 22.0);

      assert.strictEqual(data[2].reference, 'setpoint_enabled');
      assert.strictEqual(data[2].value, true);
    });
  });

  describe('generateFileTemplate', () => {
    it('should generate file template with sample data', () => {
      const template = service.generateTemplate('any');

      assert.strictEqual(template.type, 'any');
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
    const manifest = service.getManifest('iso');
    assert.deepStrictEqual(manifest, isoManifest);
  });

  it('should throw an error if transformer manifest is not found', () => {
    assert.throws(() => service.getManifest('bad'), new NotFoundError(`Transformer manifest "bad" not found`));
  });

  it('should get standard manifest', () => {
    assert.deepStrictEqual(getStandardManifest('csv-to-mqtt'), csvToMqttManifest.settings);
    assert.deepStrictEqual(getStandardManifest('csv-to-time-values'), csvToTimeValuesManifest.settings);
    assert.deepStrictEqual(getStandardManifest('iso'), isoManifest.settings);
    assert.deepStrictEqual(getStandardManifest('ignore'), ignoreManifest.settings);
    assert.deepStrictEqual(getStandardManifest('json-to-csv'), jsonToCsvManifest.settings);
    assert.deepStrictEqual(getStandardManifest('time-values-to-csv'), timeValuesToCsvManifest.settings);
    assert.deepStrictEqual(getStandardManifest('time-values-to-json'), timeValuesToJsonManifest.settings);
    assert.deepStrictEqual(getStandardManifest('time-values-to-modbus'), timeValuesToModbusManifest.settings);
    assert.deepStrictEqual(getStandardManifest('time-values-to-mqtt'), timeValuesToMqttManifest.settings);
    assert.deepStrictEqual(getStandardManifest('time-values-to-oianalytics'), timeValuesToOianalyticsManifest.settings);
    assert.deepStrictEqual(getStandardManifest('time-values-to-opcua'), timeValuesToOpcuaManifest.settings);
    assert.deepStrictEqual(getStandardManifest('setpoint-to-modbus'), setpointToModbusManifest.settings);
    assert.deepStrictEqual(getStandardManifest('setpoint-to-mqtt'), setpointToMqttManifest.settings);
    assert.deepStrictEqual(getStandardManifest('setpoint-to-opcua'), setpointToOpcuaManifest.settings);
    assert.throws(() => getStandardManifest('bad-id'), /Could not find manifest for "bad-id" transformer/);
  });

  it('should properly convert to DTO with empty createdBy/updatedBy', () => {
    const getUserInfo = (id: string) => ({ id, friendlyName: id });
    const customTransformerNoAudit = { ...(testData.transformers.list[0] as CustomTransformer), createdBy: '', updatedBy: '' };
    const result = toTransformerDTO(customTransformerNoAudit, getUserInfo);
    assert.deepStrictEqual(result.createdBy, { id: '', friendlyName: '' });
    assert.deepStrictEqual(result.updatedBy, { id: '', friendlyName: '' });
  });

  it('should properly convert to DTO with non-empty createdBy/updatedBy', () => {
    const getUserInfo = (id: string) => ({ id, friendlyName: id });
    const customTransformerWithAudit = { ...(testData.transformers.list[0] as CustomTransformer), createdBy: 'user1', updatedBy: 'user2' };
    const result = toTransformerDTO(customTransformerWithAudit, getUserInfo);
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
      inputType: 'time-values',
      outputType: 'time-values',
      type: 'standard',
      functionName: 'iso'
    };
    assert.deepStrictEqual(toTransformerDTO(standardTransformer, getUserInfo), {
      id: standardTransformer.id,
      type: standardTransformer.type,
      inputType: standardTransformer.inputType,
      outputType: standardTransformer.outputType,
      functionName: standardTransformer.functionName,
      manifest: ignoreManifest.settings
    });
  });
});
