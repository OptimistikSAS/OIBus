import { describe, it, beforeEach, afterEach, before, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

import testData from '../tests/utils/test-data';
import { mockModule, reloadModule } from '../tests/utils/test-utils';
import EncryptionServiceMock from '../tests/__mocks__/service/encryption-service.mock';
import NorthConnectorRepositoryMock from '../tests/__mocks__/repository/config/north-connector-repository.mock';
import SouthConnectorRepositoryMock from '../tests/__mocks__/repository/config/south-connector-repository.mock';
import NorthMetricsRepositoryMock from '../tests/__mocks__/repository/metrics/north-metrics-repository.mock';
import ScanModeRepositoryMock from '../tests/__mocks__/repository/config/scan-mode-repository.mock';
import LogRepositoryMock from '../tests/__mocks__/repository/log/log-repository.mock';
import CertificateRepositoryMock from '../tests/__mocks__/repository/config/certificate-repository.mock';
import OianalyticsRegistrationRepositoryMock from '../tests/__mocks__/repository/config/oianalytics-registration-repository.mock';
import OIAnalyticsMessageServiceMock from '../tests/__mocks__/service/oia/oianalytics-message-service.mock';
import DataStreamEngineMock from '../tests/__mocks__/data-stream-engine.mock';
import NorthConnectorMock from '../tests/__mocks__/north-connector.mock';
import TransformerServiceMock from '../tests/__mocks__/service/transformer-service.mock';
import LoggerMock from '../tests/__mocks__/service/logger/logger.mock';
import type NorthServiceType from './north.service';
import type {
  northManifestList as northManifestListType,
  toNorthConnectorDTO as toNorthConnectorDTOType,
  toNorthConnectorLightDTO as toNorthConnectorLightDTOType
} from './north.service';
import { NorthConnectorCommandDTO } from '../../shared/model/north-connector.model';
import { TransformerDTO } from '../../shared/model/transformer.model';
import { NotFoundError, OIBusValidationError } from '../model/types';
import { NorthTransformerWithOptions } from '../model/transformer.model';
import { toScanModeDTO } from './scan-mode.service';
import type { toTransformerDTO as toTransformerDTOType } from './transformer.service';

const nodeRequire = createRequire(import.meta.url);

let mockUtils: Record<string, ReturnType<typeof mock.fn>>;
let mockNorthConnectorFactory: Record<string, ReturnType<typeof mock.fn>>;
let mockEncryptionService: Record<string, unknown>;

let NorthService: new (...args: Array<unknown>) => InstanceType<typeof NorthServiceType>;
let northManifestList: typeof northManifestListType;
let toNorthConnectorDTO: typeof toNorthConnectorDTOType;
let toNorthConnectorLightDTO: typeof toNorthConnectorLightDTOType;
let toTransformerDTO: typeof toTransformerDTOType;
let buildNorth: ReturnType<typeof mock.fn>;

before(() => {
  mockUtils = {
    checkScanMode: mock.fn(),
    resolveBypassingExports: mock.fn()
  };

  buildNorth = mock.fn();
  mockNorthConnectorFactory = { __esModule: true, buildNorth, createNorthOrchestrator: mock.fn() };

  const encryptionServiceMock = new EncryptionServiceMock('', '');
  mockEncryptionService = { __esModule: true, encryptionService: encryptionServiceMock };

  mockModule(nodeRequire, './utils', mockUtils);
  mockModule(nodeRequire, '../north/north-connector-factory', mockNorthConnectorFactory);
  mockModule(nodeRequire, './encryption.service', mockEncryptionService);

  const mod = reloadModule<{
    default: new (...args: Array<unknown>) => InstanceType<typeof NorthServiceType>;
    northManifestList: typeof northManifestListType;
    toNorthConnectorDTO: typeof toNorthConnectorDTOType;
    toNorthConnectorLightDTO: typeof toNorthConnectorLightDTOType;
  }>(nodeRequire, './north.service');
  NorthService = mod.default;
  northManifestList = mod.northManifestList;
  toNorthConnectorDTO = mod.toNorthConnectorDTO;
  toNorthConnectorLightDTO = mod.toNorthConnectorLightDTO;

  const transformerMod = reloadModule<{
    toTransformerDTO: typeof toTransformerDTOType;
  }>(nodeRequire, './transformer.service');
  toTransformerDTO = transformerMod.toTransformerDTO;
});

describe('North Service', () => {
  let service: InstanceType<typeof NorthServiceType>;
  let northConnectorRepository: NorthConnectorRepositoryMock;
  let southConnectorRepository: SouthConnectorRepositoryMock;
  let northMetricsRepository: NorthMetricsRepositoryMock;
  let scanModeRepository: ScanModeRepositoryMock;
  let logRepository: LogRepositoryMock;
  let certificateRepository: CertificateRepositoryMock;
  let oIAnalyticsRegistrationRepository: OianalyticsRegistrationRepositoryMock;
  let oIAnalyticsMessageService: OIAnalyticsMessageServiceMock;
  let engine: DataStreamEngineMock;
  let transformerService: TransformerServiceMock;
  let southItemGroupRepository: { findById: ReturnType<typeof mock.fn> };
  let validator: { validate: ReturnType<typeof mock.fn> };
  let logger: LoggerMock;
  let mockedNorth1: NorthConnectorMock;

  beforeEach(() => {
    mock.timers.enable({
      apis: ['Date', 'setInterval', 'setImmediate', 'setTimeout'],
      now: new Date(testData.constants.dates.FAKE_NOW).getTime()
    });

    logger = new LoggerMock();
    northConnectorRepository = new NorthConnectorRepositoryMock();
    southConnectorRepository = new SouthConnectorRepositoryMock();
    northMetricsRepository = new NorthMetricsRepositoryMock();
    scanModeRepository = new ScanModeRepositoryMock();
    logRepository = new LogRepositoryMock();
    certificateRepository = new CertificateRepositoryMock();
    oIAnalyticsRegistrationRepository = new OianalyticsRegistrationRepositoryMock();
    oIAnalyticsMessageService = new OIAnalyticsMessageServiceMock();
    engine = new DataStreamEngineMock(logger);
    transformerService = new TransformerServiceMock();
    southItemGroupRepository = { findById: mock.fn() };
    validator = {
      validate: mock.fn(async () => undefined),
      validateSettings: mock.fn(async () => undefined)
    };

    mockedNorth1 = new NorthConnectorMock(testData.north.list[0]);
    buildNorth.mock.resetCalls();
    buildNorth.mock.mockImplementation(() => mockedNorth1);

    northConnectorRepository.findAllNorth.mock.mockImplementation(() => []);
    northConnectorRepository.findNorthById.mock.mockImplementation(() => testData.north.list[0]);
    scanModeRepository.findAll.mock.mockImplementation(() => testData.scanMode.list);
    transformerService.findAll.mock.mockImplementation(() => testData.transformers.list);
    southConnectorRepository.findAllSouth.mock.mockImplementation(() =>
      testData.south.list.map(element => ({
        id: element.id,
        name: element.name,
        type: element.type,
        description: element.description,
        enabled: element.enabled
      }))
    );
    southConnectorRepository.findSouthById.mock.mockImplementation(() => testData.south.list[0]);
    southConnectorRepository.findAllItemsForSouth.mock.mockImplementation(() => testData.south.list[0].items);

    service = new NorthService(
      validator,
      northConnectorRepository,
      southConnectorRepository,
      southItemGroupRepository,
      northMetricsRepository,
      scanModeRepository,
      logRepository,
      certificateRepository,
      oIAnalyticsRegistrationRepository,
      oIAnalyticsMessageService,
      transformerService,
      engine
    );
  });

  afterEach(() => {
    mock.restoreAll();
    mock.timers.reset();
  });

  it('should retrieve a list of north manifest', () => {
    const list = service.listManifest();
    assert.ok(list !== undefined);
  });

  it('should retrieve a manifest', () => {
    const consoleManifest = service.getManifest('console');
    assert.deepStrictEqual(consoleManifest, northManifestList[0]);
  });

  it('should throw an error if manifest is not found', () => {
    assert.throws(() => service.getManifest('bad'), new NotFoundError(`North manifest "bad" not found`));
  });

  it('should get all north connector settings', () => {
    service.list();
    assert.strictEqual(northConnectorRepository.findAllNorth.mock.calls.length, 1);
  });

  it('should get a north connector', () => {
    service.findById(testData.north.list[0].id);

    assert.strictEqual(northConnectorRepository.findNorthById.mock.calls.length, 1);
    assert.deepStrictEqual(northConnectorRepository.findNorthById.mock.calls[0].arguments, [testData.north.list[0].id]);
  });

  it('should throw an error when north connector does not exist', () => {
    northConnectorRepository.findNorthById.mock.mockImplementation(() => null);

    assert.throws(() => service.findById(testData.north.list[0].id), new NotFoundError(`North "${testData.north.list[0].id}" not found`));

    assert.strictEqual(northConnectorRepository.findNorthById.mock.calls.length, 1);
    assert.deepStrictEqual(northConnectorRepository.findNorthById.mock.calls[0].arguments, [testData.north.list[0].id]);
  });

  it('should create a north connector', async () => {
    await service.create(testData.north.command, null, 'userTest');

    assert.strictEqual(northConnectorRepository.saveNorth.mock.calls.length, 1);
    assert.strictEqual(oIAnalyticsMessageService.createFullConfigMessageIfNotPending.mock.calls.length, 1);
    assert.strictEqual(engine.createNorth.mock.calls.length, 1);
    assert.strictEqual(engine.startNorth.mock.calls.length, 1);
  });

  it('should create a north connector with a transformer group', async () => {
    const command = JSON.parse(JSON.stringify(testData.north.command)) as NorthConnectorCommandDTO;
    if (command.transformers[0].source.type !== 'south') {
      throw new Error('Expected south source in test data');
    }
    southItemGroupRepository.findById.mock.mockImplementationOnce(() => ({
      id: 'groupId1',
      name: '',
      southId: command.transformers[0].source.southId,
      scanMode: testData.scanMode.list[0],
      overlap: null,
      maxReadInterval: null,
      readDelay: 0,
      createdBy: '',
      updatedBy: '',
      createdAt: '',
      updatedAt: '',
      items: []
    }));
    command.transformers = [
      {
        ...command.transformers[0],
        source: {
          type: 'south',
          southId: command.transformers[0].source.southId,
          groupId: 'groupId1',
          items: []
        }
      }
    ];
    await service.create(command, null, 'userTest');

    const savedEntity = northConnectorRepository.saveNorth.mock.calls[0].arguments[0] as Record<string, unknown>;
    const transformers = savedEntity.transformers as Array<{ source: { group: Record<string, unknown> } }>;
    assert.ok(transformers[0].source.group.id === 'groupId1');
    assert.ok(transformers[0].source.group.name === '');
    assert.ok(transformers[0].source.group.createdBy === '');
    assert.ok(transformers[0].source.group.updatedBy === '');
    assert.ok(transformers[0].source.group.createdAt === '');
    assert.ok(transformers[0].source.group.updatedAt === '');
  });

  it('should create a north connector and not start it if disabled', async () => {
    const command = JSON.parse(JSON.stringify(testData.north.command)) as NorthConnectorCommandDTO;
    command.enabled = false;
    await service.create(command, null, 'userTest');
    assert.strictEqual(northConnectorRepository.saveNorth.mock.calls.length, 1);
    assert.strictEqual(oIAnalyticsMessageService.createFullConfigMessageIfNotPending.mock.calls.length, 1);
    assert.strictEqual(engine.createNorth.mock.calls.length, 1);
    assert.strictEqual(engine.startNorth.mock.calls.length, 0);
  });

  it('should not create a north connector if transformer is not found', async () => {
    transformerService.findAll.mock.mockImplementationOnce(() => []);
    await assert.rejects(
      () => service.create(testData.north.command, null, 'userTest'),
      new Error(`Could not find OIBus transformer "${testData.transformers.list[0].id}"`)
    );
  });

  it('should not create a north connector if south is not found', async () => {
    southConnectorRepository.findSouthById.mock.mockImplementationOnce(() => null);
    await assert.rejects(
      () => service.create(testData.north.command, null, 'userTest'),
      new Error(`Could not find South connector "${testData.south.list[0].id}"`)
    );
  });

  it('should not create a north connector with duplicate name', async () => {
    northConnectorRepository.findAllNorth.mock.mockImplementation(() => [{ id: 'existing-id', name: testData.north.command.name }]);

    await assert.rejects(
      () => service.create(testData.north.command, null, 'userTest'),
      new OIBusValidationError(`North connector name "${testData.north.command.name}" already exists`)
    );
  });

  it('should update a north connector', async () => {
    northConnectorRepository.findAllNorth.mock.mockImplementation(() => testData.north.list);
    transformerService.findAll.mock.mockImplementation(() => testData.transformers.list);
    await service.update(testData.north.list[0].id, testData.north.command, 'userTest');

    assert.strictEqual(northConnectorRepository.saveNorth.mock.calls.length, 1);
    assert.strictEqual(oIAnalyticsMessageService.createFullConfigMessageIfNotPending.mock.calls.length, 1);
    assert.strictEqual(engine.reloadNorth.mock.calls.length, 1);
  });

  it('should update a north connector with a transformer group', async () => {
    northConnectorRepository.findAllNorth.mock.mockImplementation(() => testData.north.list);
    transformerService.findAll.mock.mockImplementation(() => testData.transformers.list);
    const command = JSON.parse(JSON.stringify(testData.north.command)) as NorthConnectorCommandDTO;
    if (command.transformers[0].source.type !== 'south') {
      throw new Error('Expected south source in test data');
    }
    southItemGroupRepository.findById.mock.mockImplementationOnce(() => ({
      id: 'groupId1',
      name: '',
      southId: command.transformers[0].source.southId,
      scanMode: testData.scanMode.list[0],
      overlap: null,
      maxReadInterval: null,
      readDelay: 0,
      createdBy: '',
      updatedBy: '',
      createdAt: '',
      updatedAt: '',
      items: []
    }));
    command.transformers = [
      {
        ...command.transformers[0],
        source: {
          type: 'south',
          southId: command.transformers[0].source.southId,
          groupId: 'groupId1',
          items: []
        }
      }
    ];
    await service.update(testData.north.list[0].id, command, 'userTest');

    const savedEntity = northConnectorRepository.saveNorth.mock.calls[0].arguments[0] as Record<string, unknown>;
    const transformers = savedEntity.transformers as Array<{ source: { group: Record<string, unknown> } }>;
    assert.ok(transformers[0].source.group.id === 'groupId1');
    assert.ok(transformers[0].source.group.name === '');
    assert.ok(transformers[0].source.group.createdBy === '');
    assert.ok(transformers[0].source.group.updatedBy === '');
    assert.ok(transformers[0].source.group.createdAt === '');
    assert.ok(transformers[0].source.group.updatedAt === '');
  });

  it('should update a north connector with a new unique name', async () => {
    const command = JSON.parse(JSON.stringify(testData.north.command));
    command.name = 'Updated North Name';
    northConnectorRepository.findAllNorth.mock.mockImplementation(() => testData.north.list);
    transformerService.findAll.mock.mockImplementation(() => testData.transformers.list);

    await service.update(testData.north.list[0].id, command, 'userTest');

    assert.strictEqual(northConnectorRepository.saveNorth.mock.calls.length, 1);
    assert.strictEqual(engine.reloadNorth.mock.calls.length, 1);
  });

  it('should not update a north connector with duplicate name', async () => {
    const command = JSON.parse(JSON.stringify(testData.north.command));
    command.name = 'Duplicate Name';
    northConnectorRepository.findAllNorth.mock.mockImplementation(() => [{ id: 'other-id', name: 'Duplicate Name' }]);
    transformerService.findAll.mock.mockImplementation(() => testData.transformers.list);

    await assert.rejects(
      () => service.update(testData.north.list[0].id, command, 'userTest'),
      new OIBusValidationError(`North connector name "Duplicate Name" already exists`)
    );
  });

  it('should not update a north connector if transformer not found', async () => {
    const command = JSON.parse(JSON.stringify(testData.north.command));
    command.name = 'New Name';
    transformerService.findAll.mock.mockImplementationOnce(() => []);

    await assert.rejects(
      () => service.update(testData.north.list[0].id, command, 'userTest'),
      new Error(`Could not find OIBus transformer "${testData.transformers.list[0].id}"`)
    );
  });

  it('should not update a north connector if south not found', async () => {
    const command = JSON.parse(JSON.stringify(testData.north.command));
    command.name = 'New Name';
    northConnectorRepository.findAllNorth.mock.mockImplementation(() => [{ id: 'other-id', name: 'Duplicate Name' }]);
    transformerService.findAll.mock.mockImplementation(() => testData.transformers.list);
    southConnectorRepository.findSouthById.mock.mockImplementationOnce(() => null);

    await assert.rejects(
      () => service.update(testData.north.list[0].id, command, 'userTest'),
      new Error(`Could not find South connector "${testData.south.list[0].id}"`)
    );
  });

  it('should delete a north connector', async () => {
    await service.delete(testData.north.list[0].id);

    assert.deepStrictEqual(engine.deleteNorth.mock.calls[0].arguments, [testData.north.list[0]]);
    assert.deepStrictEqual(northConnectorRepository.deleteNorth.mock.calls[0].arguments, [testData.north.list[0].id]);
    assert.deepStrictEqual(logRepository.deleteLogsByScopeId.mock.calls[0].arguments, ['north', testData.north.list[0].id]);
    assert.deepStrictEqual(northMetricsRepository.removeMetrics.mock.calls[0].arguments, [testData.north.list[0].id]);
    assert.strictEqual(oIAnalyticsMessageService.createFullConfigMessageIfNotPending.mock.calls.length, 1);
  });

  it('should start north', async () => {
    await service.start(testData.north.list[0].id);
    assert.deepStrictEqual(northConnectorRepository.startNorth.mock.calls[0].arguments, [testData.north.list[0].id]);
    assert.deepStrictEqual(engine.startNorth.mock.calls[0].arguments, [testData.north.list[0].id]);
    assert.strictEqual(oIAnalyticsMessageService.createFullConfigMessageIfNotPending.mock.calls.length, 1);
  });

  it('should stop north', async () => {
    await service.stop(testData.north.list[0].id);
    assert.deepStrictEqual(northConnectorRepository.stopNorth.mock.calls[0].arguments, [testData.north.list[0].id]);
    assert.deepStrictEqual(engine.stopNorth.mock.calls[0].arguments, [testData.north.list[0].id]);
    assert.strictEqual(oIAnalyticsMessageService.createFullConfigMessageIfNotPending.mock.calls.length, 1);
  });

  it('should get a north stream for metrics', () => {
    service.getNorthDataStream(testData.north.list[0].id);
    assert.deepStrictEqual(engine.getNorthSSE.mock.calls[0].arguments, [testData.north.list[0].id]);
  });

  it('should get a north metric', () => {
    service.getNorthMetric(testData.north.list[0].id);
    assert.deepStrictEqual(engine.getNorthMetrics.mock.calls[0].arguments, [testData.north.list[0].id]);
  });

  it('should test a north connector in creation mode', async () => {
    await service.testNorth('create', testData.north.command.type, testData.north.command.settings);

    assert.strictEqual(buildNorth.mock.calls.length, 1);
    assert.strictEqual(mockedNorth1.testConnection.mock.calls.length, 1);
  });

  it('should test a north connector in edit mode', async () => {
    await service.testNorth(testData.north.list[0].id, testData.north.command.type, testData.north.command.settings);

    assert.strictEqual(buildNorth.mock.calls.length, 1);
    assert.strictEqual(mockedNorth1.testConnection.mock.calls.length, 1);
  });

  it('should add or edit transformer', () => {
    const transformerWithOptions = {
      id: 'northTransformerId1',
      transformer: testData.transformers.list[0] as TransformerDTO,
      options: {},
      source: { type: 'oianalytics-setpoint' }
    } as NorthTransformerWithOptions;
    service.addOrEditTransformer(testData.north.list[0].id, transformerWithOptions);

    assert.deepStrictEqual(northConnectorRepository.addOrEditTransformer.mock.calls[0].arguments, [
      testData.north.list[0].id,
      transformerWithOptions
    ]);
    assert.strictEqual(oIAnalyticsMessageService.createFullConfigMessageIfNotPending.mock.calls.length, 1);
    assert.deepStrictEqual(engine.updateNorthConfiguration.mock.calls[0].arguments, [testData.north.list[0].id]);
  });

  it('should remove transformer', () => {
    service.removeTransformer(testData.north.list[0].id, testData.north.list[0].transformers[0].id);

    assert.deepStrictEqual(northConnectorRepository.removeTransformer.mock.calls[0].arguments, [testData.north.list[0].transformers[0].id]);
    assert.strictEqual(oIAnalyticsMessageService.createFullConfigMessageIfNotPending.mock.calls.length, 1);
    assert.deepStrictEqual(engine.updateNorthConfiguration.mock.calls[0].arguments, [testData.north.list[0].id]);
  });

  it('should execute setpoint', async () => {
    const northMock = new NorthConnectorMock(testData.north.list[0]);
    northMock.isEnabled.mock.mockImplementationOnce(() => true);
    engine.getNorth.mock.mockImplementation(() => ({ north: northMock }));
    const callback = mock.fn();
    const commandContent = [{ reference: 'reference', value: '123456' }];
    await service.executeSetpoint('northId', commandContent, callback);
    assert.deepStrictEqual(northMock.cacheContent.mock.calls[0].arguments, [
      {
        type: 'setpoint',
        content: [
          {
            reference: commandContent[0].reference,
            value: commandContent[0].value
          }
        ]
      },
      { source: 'oianalytics-setpoints' }
    ]);
    assert.deepStrictEqual(callback.mock.calls[0].arguments, [
      `Setpoint ${JSON.stringify([{ reference: 'reference', value: '123456' }])} properly sent into the cache of northId`
    ]);
  });

  it('should not execute setpoint if north disabled', async () => {
    const northMock = new NorthConnectorMock(testData.north.list[0]);
    northMock.isEnabled.mock.mockImplementationOnce(() => false);
    engine.getNorth.mock.mockImplementation(() => ({ north: northMock }));
    const callback = mock.fn();
    await assert.rejects(
      () => service.executeSetpoint('northId', [{ reference: 'reference', value: '123456' }], callback),
      new Error(`North connector "northId" disabled`)
    );
    assert.strictEqual(callback.mock.calls.length, 0);
  });

  it('should retrieve secrets from north', () => {
    const manifest = JSON.parse(JSON.stringify(testData.north.manifest));
    manifest.id = testData.north.list[0].type;
    assert.deepStrictEqual(service.retrieveSecretsFromNorth('northId', manifest), testData.north.list[0]);
  });

  it('should throw error if connector not proper type when retrieving secrets', () => {
    northConnectorRepository.findNorthById.mock.mockImplementationOnce(() => testData.north.list[0]);
    assert.throws(
      () => service.retrieveSecretsFromNorth('northId', testData.north.manifest),
      new Error(`North connector "northId" (type "${testData.north.list[0].type}") must be of the type "${testData.north.manifest.id}"`)
    );
  });

  it('should properly convert to DTOs', () => {
    const northEntity = testData.north.list[0];
    const getUserInfo = (id: string) => ({ id, friendlyName: id });
    const encryptionMock = mockEncryptionService.encryptionService as EncryptionServiceMock;
    assert.deepStrictEqual(toNorthConnectorDTO(northEntity, getUserInfo), {
      id: northEntity.id,
      name: northEntity.name,
      type: northEntity.type,
      description: northEntity.description,
      enabled: northEntity.enabled,
      settings: encryptionMock.filterSecrets(
        northEntity.settings,
        northManifestList.find(element => element.id === northEntity.type)!.settings
      ),
      caching: {
        trigger: {
          scanMode: toScanModeDTO(northEntity.caching.trigger.scanMode, getUserInfo),
          numberOfElements: northEntity.caching.trigger.numberOfElements,
          numberOfFiles: northEntity.caching.trigger.numberOfFiles
        },
        throttling: {
          runMinDelay: northEntity.caching.throttling.runMinDelay,
          maxSize: northEntity.caching.throttling.maxSize,
          maxNumberOfElements: northEntity.caching.throttling.maxNumberOfElements
        },
        error: {
          retryInterval: northEntity.caching.error.retryInterval,
          retryCount: northEntity.caching.error.retryCount,
          retentionDuration: northEntity.caching.error.retentionDuration
        },
        archive: {
          enabled: northEntity.caching.archive.enabled,
          retentionDuration: northEntity.caching.archive.retentionDuration
        }
      },
      transformers: northEntity.transformers.map(transformerWithOptions => ({
        id: transformerWithOptions.id,
        transformer: toTransformerDTO(transformerWithOptions.transformer, getUserInfo),
        options: transformerWithOptions.options,
        source:
          transformerWithOptions.source.type === 'south'
            ? {
                type: 'south',
                south: {
                  id: transformerWithOptions.source.south.id,
                  name: transformerWithOptions.source.south.name,
                  type: transformerWithOptions.source.south.type,
                  description: transformerWithOptions.source.south.description,
                  enabled: transformerWithOptions.source.south.enabled,
                  createdBy: getUserInfo(transformerWithOptions.source.south.createdBy),
                  updatedBy: getUserInfo(transformerWithOptions.source.south.updatedBy),
                  createdAt: transformerWithOptions.source.south.createdAt,
                  updatedAt: transformerWithOptions.source.south.updatedAt
                },
                group: transformerWithOptions.source.group
                  ? {
                      id: transformerWithOptions.source.group.id,
                      name: transformerWithOptions.source.group.name,
                      createdBy: getUserInfo(transformerWithOptions.source.group.createdBy),
                      updatedBy: getUserInfo(transformerWithOptions.source.group.updatedBy),
                      createdAt: transformerWithOptions.source.group.createdAt,
                      updatedAt: transformerWithOptions.source.group.updatedAt
                    }
                  : undefined,
                items: transformerWithOptions.source.items.map(item => ({
                  id: item.id,
                  name: item.name,
                  enabled: item.enabled,
                  createdBy: getUserInfo(item.createdBy),
                  updatedBy: getUserInfo(item.updatedBy),
                  createdAt: item.createdAt,
                  updatedAt: item.updatedAt
                }))
              }
            : transformerWithOptions.source
      })),
      createdBy: getUserInfo(northEntity.createdBy),
      updatedBy: getUserInfo(northEntity.updatedBy),
      createdAt: northEntity.createdAt,
      updatedAt: northEntity.updatedAt
    });
    assert.deepStrictEqual(toNorthConnectorLightDTO(northEntity, getUserInfo), {
      id: northEntity.id,
      name: northEntity.name,
      type: northEntity.type,
      description: northEntity.description,
      enabled: northEntity.enabled,
      createdBy: getUserInfo(northEntity.createdBy),
      updatedBy: getUserInfo(northEntity.updatedBy),
      createdAt: northEntity.createdAt,
      updatedAt: northEntity.updatedAt
    });
  });

  it('should include group in toNorthConnectorDTO when group is defined', () => {
    const northEntity = { ...testData.north.list[0] };
    if (northEntity.transformers[0].source.type !== 'south') {
      throw new Error('Expected south source in test data');
    }
    const group = {
      id: 'group1',
      name: 'Group 1',
      southId: northEntity.transformers[0].source.south.id,
      scanMode: testData.scanMode.list[0],
      overlap: null,
      maxReadInterval: null,
      readDelay: 0,
      createdBy: '',
      updatedBy: '',
      createdAt: '',
      updatedAt: '',
      items: []
    };
    northEntity.transformers = [
      {
        ...northEntity.transformers[0],
        source: {
          ...northEntity.transformers[0].source,
          group
        }
      }
    ];
    const dto = toNorthConnectorDTO(northEntity, id => ({ id, friendlyName: id }));
    assert.strictEqual(dto.transformers[0].source.type, 'south');
    if (dto.transformers[0].source.type !== 'south') {
      throw new Error('Expected south source');
    }
    assert.deepStrictEqual(dto.transformers[0].source.group, {
      id: group.id,
      name: group.name
    });
  });
});
