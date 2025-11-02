import EncryptionServiceMock from '../tests/__mocks__/service/encryption-service.mock';
import PinoLogger from '../tests/__mocks__/service/logger/logger.mock';
import NorthService, { northManifestList, toNorthConnectorDTO, toNorthConnectorLightDTO } from './north.service';
import pino from 'pino';
import JoiValidator from '../web-server/controllers/validators/joi.validator';
import SouthConnectorRepository from '../repository/config/south-connector.repository';
import SouthConnectorRepositoryMock from '../tests/__mocks__/repository/config/south-connector-repository.mock';
import LogRepository from '../repository/logs/log.repository';
import LogRepositoryMock from '../tests/__mocks__/repository/log/log-repository.mock';
import ScanModeRepository from '../repository/config/scan-mode.repository';
import ScanModeRepositoryMock from '../tests/__mocks__/repository/config/scan-mode-repository.mock';
import OIAnalyticsMessageService from './oia/oianalytics-message.service';
import OIAnalyticsMessageServiceMock from '../tests/__mocks__/service/oia/oianalytics-message-service.mock';
import NorthConnectorRepository from '../repository/config/north-connector.repository';
import NorthConnectorRepositoryMock from '../tests/__mocks__/repository/config/north-connector-repository.mock';
import NorthConnectorMetricsRepository from '../repository/metrics/north-connector-metrics.repository';
import NorthMetricsRepositoryMock from '../tests/__mocks__/repository/metrics/north-metrics-repository.mock';
import testData from '../tests/utils/test-data';
import CertificateRepository from '../repository/config/certificate.repository';
import CertificateRepositoryMock from '../tests/__mocks__/repository/config/certificate-repository.mock';
import OIAnalyticsRegistrationRepository from '../repository/config/oianalytics-registration.repository';
import OianalyticsRegistrationRepositoryMock from '../tests/__mocks__/repository/config/oianalytics-registration-repository.mock';
import DataStreamEngine from '../engine/data-stream-engine';
import DataStreamEngineMock from '../tests/__mocks__/data-stream-engine.mock';
import NorthConnectorMock from '../tests/__mocks__/north-connector.mock';
import TransformerServiceMock from '../tests/__mocks__/service/transformer-service.mock';
import TransformerService, { toTransformerDTO } from './transformer.service';
import { NorthConnectorCommandDTO } from '../../shared/model/north-connector.model';
import { buildNorth } from '../north/north-connector-factory';
import { TransformerDTO } from '../../shared/model/transformer.model';
import { NotFoundError, OIBusValidationError } from '../model/types';
import { encryptionService } from './encryption.service';
import { toScanModeDTO } from './scan-mode.service';

jest.mock('./encryption.service');
jest.mock('./utils');
jest.mock('./metrics/north-connector-metrics.service');
jest.mock('node:fs/promises');
jest.mock('../web-server/controllers/validators/joi.validator');
jest.mock('../north/north-connector-factory');
jest.mock('./encryption.service', () => ({
  encryptionService: new EncryptionServiceMock('', '')
}));

const validator = new JoiValidator();
const logger: pino.Logger = new PinoLogger();
const northConnectorRepository: NorthConnectorRepository = new NorthConnectorRepositoryMock();
const southConnectorRepository: SouthConnectorRepository = new SouthConnectorRepositoryMock();
const northMetricsRepository: NorthConnectorMetricsRepository = new NorthMetricsRepositoryMock();
const scanModeRepository: ScanModeRepository = new ScanModeRepositoryMock();
const logRepository: LogRepository = new LogRepositoryMock();
const certificateRepository: CertificateRepository = new CertificateRepositoryMock();
const oIAnalyticsRegistrationRepository: OIAnalyticsRegistrationRepository = new OianalyticsRegistrationRepositoryMock();
const oIAnalyticsMessageService: OIAnalyticsMessageService = new OIAnalyticsMessageServiceMock();
const engine: DataStreamEngine = new DataStreamEngineMock(logger);
const transformerService: TransformerService = new TransformerServiceMock();

const mockedNorth1 = new NorthConnectorMock(testData.north.list[0]);

let service: NorthService;
describe('North Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));

    (buildNorth as jest.Mock).mockReturnValue(mockedNorth1);
    (northConnectorRepository.findAllNorth as jest.Mock).mockReturnValue(testData.north.list);
    (northConnectorRepository.findNorthById as jest.Mock).mockReturnValue(testData.north.list[0]);
    (scanModeRepository.findAll as jest.Mock).mockReturnValue(testData.scanMode.list);
    (transformerService.findAll as jest.Mock).mockReturnValue(testData.transformers.list);
    (southConnectorRepository.findAllSouth as jest.Mock).mockReturnValue(
      testData.south.list.map(element => ({
        id: element.id,
        name: element.name,
        type: element.type,
        description: element.description,
        enabled: element.enabled
      }))
    );
    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValue(testData.south.list[0]);

    service = new NorthService(
      validator,
      northConnectorRepository,
      southConnectorRepository,
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

  it('should retrieve a list of north manifest', () => {
    const list = service.listManifest();
    expect(list).toBeDefined();
  });

  it('should retrieve a manifest', () => {
    const consoleManifest = service.getManifest('console');
    expect(consoleManifest).toEqual(northManifestList[0]);
  });

  it('should throw an error if manifest is not found', () => {
    expect(() => service.getManifest('bad')).toThrow(new NotFoundError(`North manifest "bad" not found`));
  });

  it('should get all north connector settings', () => {
    service.list();
    expect(northConnectorRepository.findAllNorth).toHaveBeenCalledTimes(1);
  });

  it('should get a north connector', () => {
    service.findById(testData.north.list[0].id);

    expect(northConnectorRepository.findNorthById).toHaveBeenCalledTimes(1);
    expect(northConnectorRepository.findNorthById).toHaveBeenCalledWith(testData.north.list[0].id);
  });

  it('should throw an error when north connector does not exist', () => {
    (northConnectorRepository.findNorthById as jest.Mock).mockReturnValue(null);

    expect(() => service.findById(testData.north.list[0].id)).toThrow(new NotFoundError(`North "${testData.north.list[0].id}" not found`));

    expect(northConnectorRepository.findNorthById).toHaveBeenCalledTimes(1);
    expect(northConnectorRepository.findNorthById).toHaveBeenCalledWith(testData.north.list[0].id);
  });

  it('should create a north connector', async () => {
    await service.create(testData.north.command, null);

    expect(northConnectorRepository.saveNorthConnector).toHaveBeenCalledTimes(1);
    expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).toHaveBeenCalledTimes(1);
    expect(engine.createNorth).toHaveBeenCalledTimes(1);
    expect(engine.startNorth).toHaveBeenCalledTimes(1);
  });

  it('should create a north connector and not start it if disabled', async () => {
    const command = JSON.parse(JSON.stringify(testData.north.command)) as NorthConnectorCommandDTO;
    command.enabled = false;
    command.subscriptions = [];
    await service.create(command, null);
    expect(northConnectorRepository.saveNorthConnector).toHaveBeenCalledTimes(1);
    expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).toHaveBeenCalledTimes(1);
    expect(engine.createNorth).toHaveBeenCalledTimes(1);
    expect(engine.startNorth).not.toHaveBeenCalled();
  });

  it('should not create a north connector if subscription not found', async () => {
    const command = JSON.parse(JSON.stringify(testData.north.command));
    command.subscriptions = [testData.south.list[0].id, 'bad'];

    await expect(service.create(command, null)).rejects.toThrow(`Could not find south connector "bad"`);
  });

  it('should not create a north connector if transformer is not found', async () => {
    (transformerService.findAll as jest.Mock).mockReturnValueOnce([]);
    await expect(service.create(testData.north.command, null)).rejects.toThrow(
      `Could not find OIBus transformer "${testData.transformers.list[0].id}"`
    );
  });

  it('should update a north connector', async () => {
    await service.update(testData.north.list[0].id, testData.north.command);

    expect(northConnectorRepository.saveNorthConnector).toHaveBeenCalledTimes(1);
    expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).toHaveBeenCalledTimes(1);
    expect(engine.reloadNorth).toHaveBeenCalledTimes(1);
  });

  it('should delete a north connector', async () => {
    await service.delete(testData.north.list[0].id);

    expect(engine.deleteNorth).toHaveBeenCalledWith(testData.north.list[0]);
    expect(northConnectorRepository.deleteNorth).toHaveBeenCalledWith(testData.north.list[0].id);
    expect(logRepository.deleteLogsByScopeId).toHaveBeenCalledWith('north', testData.north.list[0].id);
    expect(northMetricsRepository.removeMetrics).toHaveBeenCalledWith(testData.north.list[0].id);
    expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).toHaveBeenCalled();
  });

  it('should start north', async () => {
    await service.start(testData.north.list[0].id);
    expect(northConnectorRepository.startNorth).toHaveBeenCalledWith(testData.north.list[0].id);
    expect(engine.startNorth).toHaveBeenCalledWith(testData.north.list[0].id);
    expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).toHaveBeenCalled();
  });

  it('should stop north', async () => {
    await service.stop(testData.north.list[0].id);
    expect(northConnectorRepository.stopNorth).toHaveBeenCalledWith(testData.north.list[0].id);
    expect(engine.stopNorth).toHaveBeenCalledWith(testData.north.list[0].id);
    expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).toHaveBeenCalled();
  });

  it('should get a north stream for metrics', () => {
    service.getNorthDataStream(testData.north.list[0].id);
    expect(engine.getNorthDataStream).toHaveBeenCalledWith(testData.north.list[0].id);
  });

  it('should test a north connector in creation mode', async () => {
    await service.testNorth('create', testData.north.command.type, testData.north.command.settings);

    expect(buildNorth).toHaveBeenCalledTimes(1);
    expect(mockedNorth1.testConnection).toHaveBeenCalled();
  });

  it('should test a north connector in edit mode', async () => {
    await service.testNorth(testData.north.list[0].id, testData.north.command.type, testData.north.command.settings);

    expect(buildNorth).toHaveBeenCalledTimes(1);
    expect(mockedNorth1.testConnection).toHaveBeenCalled();
  });

  it('should add or edit transformer', () => {
    const transformerWithOptions = {
      inputType: 'input',
      transformer: testData.transformers.list[0] as TransformerDTO,
      options: {}
    };
    service.addOrEditTransformer(testData.north.list[0].id, transformerWithOptions);

    expect(northConnectorRepository.addOrEditTransformer).toHaveBeenCalledWith(testData.north.list[0].id, transformerWithOptions);
    expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).toHaveBeenCalled();
    expect(engine.updateNorthConfiguration).toHaveBeenCalledWith(testData.north.list[0].id);
  });

  it('should remove transformer', () => {
    service.removeTransformer(testData.north.list[0].id, testData.transformers.list[0].id);

    expect(northConnectorRepository.removeTransformer).toHaveBeenCalledWith(testData.north.list[0].id, testData.transformers.list[0].id);
    expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).toHaveBeenCalled();
    expect(engine.updateNorthConfiguration).toHaveBeenCalledWith(testData.north.list[0].id);
  });

  it('should check if subscription is set', () => {
    (northConnectorRepository.checkSubscription as jest.Mock).mockReturnValueOnce(true);

    expect(service.checkSubscription(testData.north.list[0].id, testData.south.list[0].id)).toEqual(true);

    expect(northConnectorRepository.checkSubscription).toHaveBeenCalledWith(testData.north.list[0].id, testData.south.list[0].id);
  });

  it('should subscribe to south', async () => {
    (northConnectorRepository.checkSubscription as jest.Mock).mockReturnValueOnce(false);

    await service.subscribeToSouth(testData.north.list[0].id, testData.south.list[0].id);

    expect(northConnectorRepository.findNorthById).toHaveBeenCalledWith(testData.north.list[0].id);
    expect(southConnectorRepository.findSouthById).toHaveBeenCalledWith(testData.south.list[0].id);
    expect(northConnectorRepository.checkSubscription).toHaveBeenCalledWith(testData.north.list[0].id, testData.south.list[0].id);
    expect(northConnectorRepository.createSubscription).toHaveBeenCalledWith(testData.north.list[0].id, testData.south.list[0].id);
    expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).toHaveBeenCalled();
  });

  it('should throw if subscription already exists', async () => {
    (northConnectorRepository.checkSubscription as jest.Mock).mockReturnValueOnce(true);

    await expect(service.subscribeToSouth(testData.north.list[0].id, testData.south.list[0].id)).rejects.toThrow(
      new OIBusValidationError(`North connector "${testData.north.list[0].name}" already subscribed to "${testData.south.list[0].name}"`)
    );

    expect(northConnectorRepository.createSubscription).not.toHaveBeenCalled();
    expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).not.toHaveBeenCalled();
  });

  it('should throw if south not found when subscribing', async () => {
    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValueOnce(null);

    await expect(service.subscribeToSouth(testData.north.list[0].id, testData.south.list[0].id)).rejects.toThrow(
      new NotFoundError(`South connector "${testData.south.list[0].id}" not found`)
    );

    expect(northConnectorRepository.checkSubscription).not.toHaveBeenCalled();
    expect(northConnectorRepository.createSubscription).not.toHaveBeenCalled();
    expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).not.toHaveBeenCalled();
  });

  it('should unsubscribe from south', async () => {
    (northConnectorRepository.findNorthById as jest.Mock).mockReturnValueOnce(testData.north.list[0]);
    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValueOnce(testData.south.list[0]);

    await service.unsubscribeFromSouth(testData.north.list[0].id, testData.south.list[0].id);

    expect(northConnectorRepository.findNorthById).toHaveBeenCalledWith(testData.north.list[0].id);
    expect(southConnectorRepository.findSouthById).toHaveBeenCalledWith(testData.south.list[0].id);
    expect(northConnectorRepository.deleteSubscription).toHaveBeenCalledWith(testData.north.list[0].id, testData.south.list[0].id);
    expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).toHaveBeenCalled();
  });

  it('should throw if south not found when unsubscribing', async () => {
    (northConnectorRepository.findNorthById as jest.Mock).mockReturnValueOnce(testData.north.list[0]);
    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValueOnce(null);

    await expect(service.unsubscribeFromSouth(testData.north.list[0].id, testData.south.list[0].id)).rejects.toThrow(
      new NotFoundError(`South connector "${testData.south.list[0].id}" not found`)
    );

    expect(northConnectorRepository.deleteSubscription).not.toHaveBeenCalled();
    expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).not.toHaveBeenCalled();
  });

  it('should unsubscribe from all south', async () => {
    await service.unsubscribeFromAllSouth(testData.north.list[0].id);
    expect(northConnectorRepository.findNorthById).toHaveBeenCalledWith(testData.north.list[0].id);
    expect(northConnectorRepository.deleteAllSubscriptionsByNorth).toHaveBeenCalledWith(testData.north.list[0].id);
    expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).toHaveBeenCalled();
  });

  it('should search cache content', async () => {
    await service.searchCacheContent(
      testData.north.list[0].id,
      { start: testData.constants.dates.DATE_1, end: testData.constants.dates.DATE_2, nameContains: 'file' },
      'cache'
    );
    expect(engine.searchCacheContent).toHaveBeenCalledWith(
      'north',
      testData.north.list[0].id,
      { start: testData.constants.dates.DATE_1, end: testData.constants.dates.DATE_2, nameContains: 'file' },
      'cache'
    );
  });

  it('should get cache content file stream', async () => {
    (engine.getCacheContentFileStream as jest.Mock).mockReturnValueOnce('file');
    const result = await service.getCacheFileContent(testData.north.list[0].id, 'cache', 'filename');
    expect(result).toEqual('file');
    expect(engine.getCacheContentFileStream).toHaveBeenCalledWith('north', testData.north.list[0].id, 'cache', 'filename');
  });

  it('should not get cache content file stream and throw not found', async () => {
    (engine.getCacheContentFileStream as jest.Mock).mockReturnValueOnce(null);
    await expect(service.getCacheFileContent(testData.north.list[0].id, 'cache', 'filename')).rejects.toThrow(
      new NotFoundError(`File "filename" not found in cache`)
    );
    expect(engine.getCacheContentFileStream).toHaveBeenCalledWith('north', testData.north.list[0].id, 'cache', 'filename');
  });

  it('should remove cache content', async () => {
    await service.removeCacheContent(testData.north.list[0].id, 'cache', ['filename']);
    expect(engine.removeCacheContent).toHaveBeenCalledWith('north', testData.north.list[0].id, 'cache', ['filename']);
  });

  it('should remove all cache content', async () => {
    await service.removeAllCacheContent(testData.north.list[0].id, 'cache');
    expect(engine.removeAllCacheContent).toHaveBeenCalledWith('north', testData.north.list[0].id, 'cache');
  });

  it('should move cache content', async () => {
    await service.moveCacheContent(testData.north.list[0].id, 'cache', 'error', ['filename']);
    expect(engine.moveCacheContent).toHaveBeenCalledWith('north', testData.north.list[0].id, 'cache', 'error', ['filename']);
  });

  it('should move all cache content', async () => {
    await service.moveAllCacheContent(testData.north.list[0].id, 'cache', 'archive');
    expect(engine.moveAllCacheContent).toHaveBeenCalledWith('north', testData.north.list[0].id, 'cache', 'archive');
  });

  it('should execute setpoint', async () => {
    const northMock = new NorthConnectorMock(testData.north.list[0]);
    (northMock.isEnabled as jest.Mock).mockReturnValueOnce(true);
    (engine.getNorth as jest.Mock).mockReturnValue(northMock);
    const callback = jest.fn();
    const commandContent = [{ reference: 'reference', value: '123456' }];
    await service.executeSetpoint('northId', commandContent, callback);
    expect(northMock.cacheContent).toHaveBeenCalledWith(
      {
        type: 'setpoint',
        content: [
          {
            reference: commandContent[0].reference,
            value: commandContent[0].value
          }
        ]
      },
      'oianalytics'
    );
    expect(callback).toHaveBeenCalledWith(
      `Setpoint ${JSON.stringify([{ reference: 'reference', value: '123456' }])} properly sent into the cache of northId`
    );
  });

  it('should not execute setpoint if north disabled', async () => {
    const northMock = new NorthConnectorMock(testData.north.list[0]);
    (northMock.isEnabled as jest.Mock).mockReturnValueOnce(false);
    (engine.getNorth as jest.Mock).mockReturnValue(northMock);
    const callback = jest.fn();
    await expect(service.executeSetpoint('northId', [{ reference: 'reference', value: '123456' }], callback)).rejects.toThrow(
      `North connector "northId" disabled`
    );
    expect(callback).not.toHaveBeenCalled();
  });

  it('should not execute setpoint content if north not found', async () => {
    (engine.getNorth as jest.Mock).mockReturnValue(null);
    const callback = jest.fn();
    await expect(service.executeSetpoint('badId', [{ reference: 'reference', value: '123456' }], callback)).rejects.toThrow(
      `North connector "badId" not found`
    );
    expect(callback).not.toHaveBeenCalled();
  });

  it('should retrieve secrets from north', () => {
    const manifest = JSON.parse(JSON.stringify(testData.north.manifest));
    manifest.id = testData.north.list[0].type;
    expect(service.retrieveSecretsFromNorth('northId', manifest)).toEqual(testData.north.list[0]);
  });

  it('should throw error if connector not proper type when retrieving secrets', () => {
    (northConnectorRepository.findNorthById as jest.Mock).mockReturnValueOnce(testData.north.list[0]);
    expect(() => service.retrieveSecretsFromNorth('northId', testData.north.manifest)).toThrow(
      `North connector "northId" (type "${testData.north.list[0].type}") must be of the type "${testData.north.manifest.id}"`
    );
  });

  it('should properly convert to DTOs', () => {
    const northEntity = testData.north.list[0];
    expect(toNorthConnectorDTO(northEntity)).toEqual({
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
          scanMode: toScanModeDTO(northEntity.caching.trigger.scanMode),
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
      subscriptions: northEntity.subscriptions,
      transformers: northEntity.transformers.map(transformerWithOptions => ({
        transformer: toTransformerDTO(transformerWithOptions.transformer),
        options: transformerWithOptions.options,
        inputType: transformerWithOptions.inputType
      }))
    });
    expect(toNorthConnectorLightDTO(northEntity)).toEqual({
      id: northEntity.id,
      name: northEntity.name,
      type: northEntity.type,
      description: northEntity.description,
      enabled: northEntity.enabled
    });
  });
});
