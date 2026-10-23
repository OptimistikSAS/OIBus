import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { afterEach, before, beforeEach, describe, it, type Mock, mock } from 'node:test';

import { NorthConnectorCommandDTO } from '../../shared/model/api/north-connector.model';
import { TransformerDTO } from '../../shared/model/api/transformer.model';
import { OIBUS_NORTH_TYPES } from '../../shared/model/connector/north-manifest.model';

import type DataStreamEngine from '../engine/data-stream-engine';
import type { NorthConnectorEntityLight } from '../model/north-connector.model';
import type { SouthConnectorItemEntityLight, SouthItemGroupEntity } from '../model/south-connector.model';
import { NorthTransformerWithOptions } from '../model/transformer.model';
import { NotFoundError, OIBusValidationError } from '../model/types';
import type CertificateRepository from '../repository/config/certificate.repository';
import type NorthConnectorRepository from '../repository/config/north-connector.repository';
import type OIAnalyticsRegistrationRepository from '../repository/config/oianalytics-registration.repository';
import type ScanModeRepository from '../repository/config/scan-mode.repository';
import type SouthConnectorRepository from '../repository/config/south-connector.repository';
import type SouthItemGroupRepository from '../repository/config/south-item-group.repository';
import type LogRepository from '../repository/logs/log.repository';
import type NorthConnectorMetricsRepository from '../repository/metrics/north-connector-metrics.repository';
import NorthConnectorMock from '../tests/__mocks__/north-connector.mock';
import EncryptionServiceMock from '../tests/__mocks__/service/encryption-service.mock';
import LoggerMock from '../tests/__mocks__/service/logger/logger.mock';
import testData from '../tests/utils/test-data';
import { createMock, type Mocked, mockModule, reloadModule } from '../tests/utils/test-utils';
import type JoiValidator from '../web-server/controllers/validators/joi.validator';
import type NorthConnectorMetricsService from './metrics/north-connector-metrics.service';
import type NorthServiceType from './north.service';
import type {
  northManifestList as northManifestListType,
  toNorthConnectorDTO as toNorthConnectorDTOType,
  toNorthConnectorLightDTO as toNorthConnectorLightDTOType
} from './north.service';
import type OIAnalyticsMessageService from './oia/oianalytics-message.service';
import { toScanModeDTO } from './scan-mode.service';
import type TransformerService from './transformer.service';
import { toTransformerDTO } from './transformer.service';

const nodeRequire = createRequire(import.meta.url);

const encryptionService = new EncryptionServiceMock('', '');
const northConnectorFactoryExports: Record<string, unknown> = { __esModule: true, createNorthOrchestrator: mock.fn() };
const getUserInfo = (id: string) => ({ id, friendlyName: id });

const otherNorthLight = (name: string): NorthConnectorEntityLight => ({
  id: name === testData.north.command.name ? 'existing-id' : 'other-id',
  name,
  type: 'console',
  description: '',
  enabled: true,
  createdBy: '',
  updatedBy: '',
  createdAt: '',
  updatedAt: ''
});

/** A copy of the north command whose first transformer takes its data from a group of its south. */
const commandWithGroupSource = (groupId: string): NorthConnectorCommandDTO => {
  const command = JSON.parse(JSON.stringify(testData.north.command)) as NorthConnectorCommandDTO;
  const firstTransformerSource = command.transformers[0].source;
  if (firstTransformerSource.type !== 'south') {
    throw new Error('Expected south source in test data');
  }
  command.transformers = [
    { ...command.transformers[0], source: { type: 'south', southId: firstTransformerSource.southId, groupId, items: [] } }
  ];
  return command;
};

// The south of the first transformer source of the north command
const groupEntity = (): SouthItemGroupEntity => ({
  id: 'groupId1',
  name: '',
  southId: testData.south.list[0].id,
  scanMode: testData.scanMode.list[0],
  startTimeOffset: null,
  endTimeOffset: null,
  maxReadInterval: null,
  readDelay: 0,
  recoveryStrategy: null,
  cachingStrategy: null,
  createdBy: '',
  updatedBy: '',
  createdAt: '',
  updatedAt: '',
  items: []
});

const assertSavedGroupSource = (northConnectorRepository: Mocked<NorthConnectorRepository>) => {
  const savedSource = northConnectorRepository.saveNorth.mock.calls[0].arguments[0].transformers[0].source;
  assert.strictEqual(savedSource.type, 'south');
  if (savedSource.type !== 'south') throw new Error('Expected south source');
  assert.ok(savedSource.group?.id === 'groupId1');
  assert.ok(savedSource.group?.name === '');
  assert.ok(savedSource.group?.createdBy === '');
  assert.ok(savedSource.group?.updatedBy === '');
  assert.ok(savedSource.group?.createdAt === '');
  assert.ok(savedSource.group?.updatedAt === '');
};

let NorthService: typeof NorthServiceType;
let northManifestList: typeof northManifestListType;
let toNorthConnectorDTO: typeof toNorthConnectorDTOType;
let toNorthConnectorLightDTO: typeof toNorthConnectorLightDTOType;

before(() => {
  mockModule(nodeRequire, '../north/north-connector-factory', northConnectorFactoryExports);
  mockModule(nodeRequire, '../south/south-connector-factory', { __esModule: true, buildSouth: mock.fn() });
  mockModule(nodeRequire, './encryption.service', { __esModule: true, encryptionService });

  const mod = reloadModule<{
    default: typeof NorthServiceType;
    northManifestList: typeof northManifestListType;
    toNorthConnectorDTO: typeof toNorthConnectorDTOType;
    toNorthConnectorLightDTO: typeof toNorthConnectorLightDTOType;
  }>(nodeRequire, './north.service');
  NorthService = mod.default;
  northManifestList = mod.northManifestList;
  toNorthConnectorDTO = mod.toNorthConnectorDTO;
  toNorthConnectorLightDTO = mod.toNorthConnectorLightDTO;
});

describe('North Service', () => {
  let service: NorthServiceType;
  let northConnectorRepository: Mocked<NorthConnectorRepository>;
  let southConnectorRepository: Mocked<SouthConnectorRepository>;
  let northMetricsRepository: Mocked<NorthConnectorMetricsRepository>;
  let logRepository: Mocked<LogRepository>;
  let oIAnalyticsMessageService: Mocked<OIAnalyticsMessageService>;
  let engine: Mocked<DataStreamEngine>;
  let transformerService: Mocked<TransformerService>;
  let southItemGroupRepository: Mocked<SouthItemGroupRepository>;
  let mockedNorth1: NorthConnectorMock;
  let buildNorth: Mock<() => NorthConnectorMock>;

  beforeEach(() => {
    mock.timers.enable({
      apis: ['Date', 'setInterval', 'setImmediate', 'setTimeout'],
      now: new Date(testData.constants.dates.FAKE_NOW).getTime()
    });

    mockedNorth1 = new NorthConnectorMock(testData.north.list[0]);
    buildNorth = mock.fn(() => mockedNorth1);
    northConnectorFactoryExports.buildNorth = buildNorth;

    northConnectorRepository = createMock<NorthConnectorRepository>({
      findAllNorth: () => [],
      findNorthById: () => testData.north.list[0]
    });
    southConnectorRepository = createMock<SouthConnectorRepository>({
      findAllSouth: () =>
        testData.south.list.map(element => ({
          id: element.id,
          name: element.name,
          type: element.type,
          description: element.description,
          enabled: element.enabled,
          createdBy: element.createdBy,
          updatedBy: element.updatedBy,
          createdAt: element.createdAt,
          updatedAt: element.updatedAt
        })),
      findSouthById: () => testData.south.list[0],
      findAllItemsForSouth: () => testData.south.list[0].items
    });
    northMetricsRepository = createMock<NorthConnectorMetricsRepository>();
    logRepository = createMock<LogRepository>();
    oIAnalyticsMessageService = createMock<OIAnalyticsMessageService>();
    engine = createMock<DataStreamEngine>({ logger: new LoggerMock() });
    transformerService = createMock<TransformerService>({ findAll: () => testData.transformers.list });
    southItemGroupRepository = createMock<SouthItemGroupRepository>();

    service = new NorthService(
      createMock<JoiValidator>(),
      northConnectorRepository,
      southConnectorRepository,
      southItemGroupRepository,
      northMetricsRepository,
      createMock<ScanModeRepository>({ findAll: () => testData.scanMode.list }),
      logRepository,
      createMock<CertificateRepository>(),
      createMock<OIAnalyticsRegistrationRepository>(),
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

    assert.strictEqual(list, northManifestList);
    // One manifest per connector type
    assert.deepStrictEqual(list.map(manifest => manifest.id).sort(), [...OIBUS_NORTH_TYPES].sort());
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
    const command = commandWithGroupSource('groupId1');
    southItemGroupRepository.findById.mock.mockImplementationOnce(() => groupEntity());
    await service.create(command, null, 'userTest');

    assertSavedGroupSource(northConnectorRepository);
  });

  it('should not create a north connector if transformer source group is not found', async () => {
    southItemGroupRepository.findById.mock.mockImplementationOnce(() => null);

    await assert.rejects(
      () => service.create(commandWithGroupSource('unknownGroupId'), null, 'userTest'),
      new NotFoundError('Could not find Group "unknownGroupId"')
    );
  });

  it('should not create a north connector if transformer source item is not found', async () => {
    const command = JSON.parse(JSON.stringify(testData.north.command)) as NorthConnectorCommandDTO;
    const firstTransformerSource = command.transformers[0].source;
    if (firstTransformerSource.type !== 'south') {
      throw new Error('Expected south source in test data');
    }
    command.transformers = [
      {
        ...command.transformers[0],
        source: {
          type: 'south',
          southId: firstTransformerSource.southId,
          items: [{ id: 'unknownItemId', name: 'unknown item', enabled: true }]
        }
      }
    ];

    await assert.rejects(
      () => service.create(command, null, 'userTest'),
      new NotFoundError('Could not find South connector item "unknown item" (unknownItemId)')
    );
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
    northConnectorRepository.findAllNorth.mock.mockImplementation(() => [otherNorthLight(testData.north.command.name)]);

    await assert.rejects(
      () => service.create(testData.north.command, null, 'userTest'),
      new OIBusValidationError(`North connector name "${testData.north.command.name}" already exists`)
    );
  });

  it('should update a north connector', async () => {
    northConnectorRepository.findAllNorth.mock.mockImplementation(() => testData.north.list);
    await service.update(testData.north.list[0].id, testData.north.command, 'userTest');

    assert.strictEqual(northConnectorRepository.saveNorth.mock.calls.length, 1);
    assert.strictEqual(oIAnalyticsMessageService.createFullConfigMessageIfNotPending.mock.calls.length, 1);
    assert.strictEqual(engine.reloadNorth.mock.calls.length, 1);
  });

  it('should update a north connector with a transformer group', async () => {
    northConnectorRepository.findAllNorth.mock.mockImplementation(() => testData.north.list);
    const command = commandWithGroupSource('groupId1');
    southItemGroupRepository.findById.mock.mockImplementationOnce(() => groupEntity());
    await service.update(testData.north.list[0].id, command, 'userTest');

    assertSavedGroupSource(northConnectorRepository);
  });

  it('should update a north connector with a new unique name', async () => {
    const command = JSON.parse(JSON.stringify(testData.north.command));
    command.name = 'Updated North Name';
    northConnectorRepository.findAllNorth.mock.mockImplementation(() => testData.north.list);

    await service.update(testData.north.list[0].id, command, 'userTest');

    assert.strictEqual(northConnectorRepository.saveNorth.mock.calls.length, 1);
    assert.strictEqual(engine.reloadNorth.mock.calls.length, 1);
  });

  it('should not update a north connector with duplicate name', async () => {
    const command = JSON.parse(JSON.stringify(testData.north.command));
    command.name = 'Duplicate Name';
    northConnectorRepository.findAllNorth.mock.mockImplementation(() => [otherNorthLight('Duplicate Name')]);

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
    northConnectorRepository.findAllNorth.mock.mockImplementation(() => [otherNorthLight('Duplicate Name')]);
    southConnectorRepository.findSouthById.mock.mockImplementationOnce(() => null);

    await assert.rejects(
      () => service.update(testData.north.list[0].id, command, 'userTest'),
      new Error(`Could not find South connector "${testData.south.list[0].id}"`)
    );
  });

  it('should delete a north connector', async () => {
    await service.delete(testData.north.list[0].id, 'userTest');

    assert.deepStrictEqual(engine.deleteNorth.mock.calls[0].arguments, [testData.north.list[0]]);
    assert.deepStrictEqual(northConnectorRepository.deleteNorth.mock.calls[0].arguments, [testData.north.list[0].id, 'userTest']);
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
    service.addOrEditTransformer(testData.north.list[0].id, transformerWithOptions, 'userTest');

    assert.deepStrictEqual(northConnectorRepository.addOrEditTransformer.mock.calls[0].arguments, [
      testData.north.list[0].id,
      transformerWithOptions,
      'userTest'
    ]);
    assert.strictEqual(oIAnalyticsMessageService.createFullConfigMessageIfNotPending.mock.calls.length, 1);
    assert.deepStrictEqual(engine.updateNorthConfiguration.mock.calls[0].arguments, [testData.north.list[0].id]);
  });

  it('should remove transformer', () => {
    service.removeTransformer(testData.north.list[0].id, testData.north.list[0].transformers[0].id, 'userTest');

    assert.deepStrictEqual(northConnectorRepository.removeTransformer.mock.calls[0].arguments, [
      testData.north.list[0].transformers[0].id,
      'userTest'
    ]);
    assert.strictEqual(oIAnalyticsMessageService.createFullConfigMessageIfNotPending.mock.calls.length, 1);
    assert.deepStrictEqual(engine.updateNorthConfiguration.mock.calls[0].arguments, [testData.north.list[0].id]);
  });

  it('should execute setpoint', async () => {
    const northMock = new NorthConnectorMock(testData.north.list[0]);
    northMock.isEnabled.mock.mockImplementationOnce(() => true);
    engine.getNorth.mock.mockImplementation(() => ({ north: northMock, metrics: createMock<NorthConnectorMetricsService>() }));
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
    engine.getNorth.mock.mockImplementation(() => ({ north: northMock, metrics: createMock<NorthConnectorMetricsService>() }));
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
    const toItemDTO = (item: SouthConnectorItemEntityLight) => ({
      id: item.id,
      name: item.name,
      enabled: item.enabled,
      createdBy: getUserInfo(item.createdBy),
      updatedBy: getUserInfo(item.updatedBy),
      createdAt: item.createdAt,
      updatedAt: item.updatedAt
    });
    assert.deepStrictEqual(toNorthConnectorDTO(northEntity, getUserInfo), {
      id: northEntity.id,
      name: northEntity.name,
      type: northEntity.type,
      description: northEntity.description,
      enabled: northEntity.enabled,
      settings: encryptionService.filterSecrets(
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
                items: transformerWithOptions.source.items.map(toItemDTO),
                excludedItems: (transformerWithOptions.source.excludedItems ?? []).map(toItemDTO)
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
    const group = { ...groupEntity(), id: 'group1', name: 'Group 1', southId: northEntity.transformers[0].source.south.id };
    northEntity.transformers = [
      {
        ...northEntity.transformers[0],
        source: {
          ...northEntity.transformers[0].source,
          group
        }
      }
    ];
    const dto = toNorthConnectorDTO(northEntity, getUserInfo);
    assert.strictEqual(dto.transformers[0].source.type, 'south');
    if (dto.transformers[0].source.type !== 'south') {
      throw new Error('Expected south source');
    }
    assert.deepStrictEqual(dto.transformers[0].source.group, {
      id: group.id,
      name: group.name
    });
  });

  it('should only keep the items left out of a transformer applying to all the items', () => {
    const south = testData.south.list[0];
    const item = south.items[0];
    const itemLight = { id: item.id, name: item.name, enabled: item.enabled };

    const allItems = service.transformerSourceFromCommand({ type: 'south', southId: south.id, items: [], excludedItems: [itemLight] });
    const someItems = service.transformerSourceFromCommand({
      type: 'south',
      southId: south.id,
      items: [itemLight],
      excludedItems: [itemLight]
    });

    assert.ok(allItems.type === 'south' && someItems.type === 'south');
    assert.deepStrictEqual(
      allItems.excludedItems?.map(excludedItem => excludedItem.id),
      [item.id]
    );
    assert.deepStrictEqual(someItems.excludedItems, []);
    assert.throws(
      () =>
        service.transformerSourceFromCommand({
          type: 'south',
          southId: south.id,
          items: [],
          excludedItems: [{ id: 'unknownItemId', name: 'unknown item', enabled: true }]
        }),
      new NotFoundError('Could not find South connector item "unknown item" (unknownItemId)')
    );
  });

  it('should return oianalytics-setpoint source command as-is from transformerSourceFromCommand', () => {
    const command = { type: 'oianalytics-setpoint' as const };
    const result = service.transformerSourceFromCommand(command);
    assert.deepStrictEqual(result, command);
  });

  it('should return oibus-api source command as-is from transformerSourceFromCommand', () => {
    const command = { type: 'oibus-api' as const, dataSourceId: 'ds1' };
    const result = service.transformerSourceFromCommand(command);
    assert.deepStrictEqual(result, command);
  });
});
