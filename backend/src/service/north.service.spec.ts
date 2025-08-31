import EncryptionServiceMock from '../tests/__mocks__/service/encryption-service.mock';
import PinoLogger from '../tests/__mocks__/service/logger/logger.mock';
import NorthService, { getTransformer } from './north.service';
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
import { NorthSettings } from '../../shared/model/north-settings.model';
import { buildNorth } from '../north/north-connector-factory';

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

  it('should get a North connector settings', () => {
    service.findById('northId');
    expect(northConnectorRepository.findNorthById).toHaveBeenCalledTimes(1);
    expect(northConnectorRepository.findNorthById).toHaveBeenCalledWith('northId');
  });

  it('should get all North connector settings', () => {
    service.findAll();
    expect(northConnectorRepository.findAllNorth).toHaveBeenCalledTimes(1);
  });

  it('testNorth() should test North connector in creation mode', async () => {
    await service.testNorth('create', testData.north.command.type, testData.north.command.settings, logger);
    expect(buildNorth).toHaveBeenCalledTimes(1);
    expect(mockedNorth1.testConnection).toHaveBeenCalled();
  });

  it('testNorth() should throw an error if manifest type is bad', async () => {
    const badCommand = JSON.parse(JSON.stringify(testData.north.command));
    badCommand.type = 'bad';
    await expect(service.testNorth('create', badCommand.type, badCommand.settings, logger)).rejects.toThrow(
      'North manifest "bad" not found'
    );
    expect(buildNorth).not.toHaveBeenCalled();
  });

  it('testNorth() should test North connector in edit mode', async () => {
    (northConnectorRepository.findNorthById as jest.Mock).mockReturnValueOnce(testData.north.list[0]);
    await service.testNorth(testData.north.list[0].id, testData.north.command.type, testData.north.command.settings, logger);
    expect(buildNorth).toHaveBeenCalledTimes(1);
    expect(mockedNorth1.testConnection).toHaveBeenCalled();
  });

  it('testNorth() should fail to test North connector in edit mode if north connector not found', async () => {
    (northConnectorRepository.findNorthById as jest.Mock).mockReturnValueOnce(null);
    await expect(
      service.testNorth(testData.north.list[0].id, testData.north.command.type, testData.north.command.settings, logger)
    ).rejects.toThrow(`North connector "${testData.north.list[0].id}" not found`);
    expect(buildNorth).not.toHaveBeenCalled();
  });

  it('createNorth() should not create North if manifest is not found', async () => {
    const badCommand = JSON.parse(JSON.stringify(testData.north.command));
    badCommand.type = 'bad';
    await expect(service.createNorth(badCommand, null)).rejects.toThrow('North manifest does not exist for type bad');
    expect(northConnectorRepository.saveNorthConnector).not.toHaveBeenCalled();
    expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).not.toHaveBeenCalled();
    expect(engine.createNorth).not.toHaveBeenCalled();
  });

  it('createNorth() should create North connector', async () => {
    (scanModeRepository.findAll as jest.Mock).mockReturnValueOnce(testData.scanMode.list);
    (transformerService.findAll as jest.Mock).mockReturnValueOnce(testData.transformers.list);
    (southConnectorRepository.findAllSouth as jest.Mock).mockReturnValueOnce(
      testData.south.list.map(element => ({
        id: element.id,
        name: element.name,
        type: element.type,
        description: element.description,
        enabled: element.enabled
      }))
    );
    await service.createNorth(testData.north.command, null);
    expect(northConnectorRepository.saveNorthConnector).toHaveBeenCalledTimes(1);
    expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).toHaveBeenCalledTimes(1);
    expect(engine.createNorth).toHaveBeenCalledTimes(1);
    expect(engine.startNorth).toHaveBeenCalledTimes(1);
  });

  it('createNorth() should create North connector and not start it if disabled', async () => {
    (scanModeRepository.findAll as jest.Mock).mockReturnValueOnce(testData.scanMode.list);
    (transformerService.findAll as jest.Mock).mockReturnValueOnce(testData.transformers.list);
    (southConnectorRepository.findAllSouth as jest.Mock).mockReturnValueOnce([]);
    const command = JSON.parse(JSON.stringify(testData.north.command)) as NorthConnectorCommandDTO<NorthSettings>;
    command.enabled = false;
    command.subscriptions = [];
    await service.createNorth(command, null);
    expect(northConnectorRepository.saveNorthConnector).toHaveBeenCalledTimes(1);
    expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).toHaveBeenCalledTimes(1);
    expect(engine.createNorth).toHaveBeenCalledTimes(1);
    expect(engine.startNorth).not.toHaveBeenCalled();
  });

  it('createNorth() should not create North connector if subscription not found', async () => {
    (scanModeRepository.findAll as jest.Mock).mockReturnValueOnce(testData.scanMode.list);
    (southConnectorRepository.findAllSouth as jest.Mock).mockReturnValueOnce(
      testData.south.list.map(element => ({
        id: element.id,
        name: element.name,
        type: element.type,
        description: element.description,
        enabled: element.enabled
      }))
    );
    const command = JSON.parse(JSON.stringify(testData.north.command));
    command.subscriptions = [testData.south.list[0].id, 'bad'];
    await expect(service.createNorth(command, null)).rejects.toThrow(`Could not find South connector "bad"`);
  });

  it('createNorth() should not create North connector if transformer is not found', async () => {
    (scanModeRepository.findAll as jest.Mock).mockReturnValueOnce(testData.scanMode.list);
    (transformerService.findAll as jest.Mock).mockReturnValueOnce([]);
    (southConnectorRepository.findAllSouth as jest.Mock).mockReturnValueOnce(
      testData.south.list.map(element => ({
        id: element.id,
        name: element.name,
        type: element.type,
        description: element.description,
        enabled: element.enabled
      }))
    );
    await expect(service.createNorth(testData.north.command, null)).rejects.toThrow(
      `Could not find OIBus Transformer "${testData.transformers.list[0].id}"`
    );
  });

  it('should get North data stream', () => {
    service.getNorthDataStream(testData.north.list[0].id);
    expect(engine.getNorthDataStream).toHaveBeenCalledWith(testData.north.list[0].id);
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
    await service.getCacheContentFileStream(testData.north.list[0].id, 'cache', 'filename');
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

  it('should retrieve a list of north manifest', () => {
    const list = service.getInstalledNorthManifests();
    expect(list).toBeDefined();
  });

  it('updateNorth() should update North connector', async () => {
    (northConnectorRepository.findNorthById as jest.Mock).mockReturnValueOnce(testData.north.list[0]);
    (transformerService.findAll as jest.Mock).mockReturnValueOnce(testData.transformers.list);
    (southConnectorRepository.findAllSouth as jest.Mock).mockReturnValueOnce(testData.south.list);
    (scanModeRepository.findAll as jest.Mock).mockReturnValueOnce(testData.scanMode.list);
    await service.updateNorth(testData.north.list[0].id, testData.north.command);

    expect(northConnectorRepository.saveNorthConnector).toHaveBeenCalledTimes(1);
    expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).toHaveBeenCalledTimes(1);
    expect(engine.reloadNorth).toHaveBeenCalledTimes(1);
  });

  it('updateNorth() should throw an error if connector not found', async () => {
    (northConnectorRepository.findNorthById as jest.Mock).mockReturnValueOnce(null);
    await expect(service.updateNorth(testData.north.list[0].id, testData.north.command)).rejects.toThrow(
      `North connector ${testData.north.list[0].id} does not exist`
    );
    expect(northConnectorRepository.saveNorthConnector).not.toHaveBeenCalled();
  });

  it('updateNorth() should throw an error if connector not found', async () => {
    (northConnectorRepository.findNorthById as jest.Mock).mockReturnValueOnce(testData.north.list[0]);
    const command = JSON.parse(JSON.stringify(testData.north.command));
    command.type = 'bad';
    await expect(service.updateNorth(testData.north.list[0].id, command)).rejects.toThrow(`North manifest does not exist for type bad`);
    expect(northConnectorRepository.saveNorthConnector).not.toHaveBeenCalled();
  });

  it('deleteNorth() should delete north', async () => {
    (northConnectorRepository.findNorthById as jest.Mock).mockReturnValueOnce(testData.north.list[0]);

    await service.deleteNorth(testData.north.list[0].id);
    expect(engine.deleteNorth).toHaveBeenCalledWith(testData.north.list[0]);
    expect(northConnectorRepository.deleteNorth).toHaveBeenCalledWith(testData.north.list[0].id);
    expect(logRepository.deleteLogsByScopeId).toHaveBeenCalledWith('north', testData.north.list[0].id);
    expect(northMetricsRepository.removeMetrics).toHaveBeenCalledWith(testData.north.list[0].id);
    expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).toHaveBeenCalled();
  });

  it('deleteNorth() should throw an error if north not found', async () => {
    (northConnectorRepository.findNorthById as jest.Mock).mockReturnValueOnce(null);

    await expect(service.deleteNorth(testData.north.list[0].id)).rejects.toThrow(
      `North connector ${testData.north.list[0].id} does not exist`
    );
    expect(engine.deleteNorth).not.toHaveBeenCalled();
  });

  it('startNorth() should start north', async () => {
    (northConnectorRepository.findNorthById as jest.Mock).mockReturnValueOnce(testData.north.list[0]);

    await service.startNorth(testData.north.list[0].id);
    expect(northConnectorRepository.startNorth).toHaveBeenCalledWith(testData.north.list[0].id);
    expect(engine.startNorth).toHaveBeenCalledWith(testData.north.list[0].id);
    expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).toHaveBeenCalled();
  });

  it('startNorth() should throw an error if north not found', async () => {
    (northConnectorRepository.findNorthById as jest.Mock).mockReturnValueOnce(null);

    await expect(service.startNorth(testData.north.list[0].id)).rejects.toThrow(
      `North connector ${testData.north.list[0].id} does not exist`
    );
    expect(northConnectorRepository.startNorth).not.toHaveBeenCalled();
  });

  it('stopNorth() should stop north', async () => {
    (northConnectorRepository.findNorthById as jest.Mock).mockReturnValueOnce(testData.north.list[0]);

    await service.stopNorth(testData.north.list[0].id);
    expect(northConnectorRepository.stopNorth).toHaveBeenCalledWith(testData.north.list[0].id);
    expect(engine.stopNorth).toHaveBeenCalledWith(testData.north.list[0].id);
    expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).toHaveBeenCalled();
  });

  it('stopNorth() should throw an error if north not found', async () => {
    (northConnectorRepository.findNorthById as jest.Mock).mockReturnValueOnce(null);

    await expect(service.stopNorth(testData.north.list[0].id)).rejects.toThrow(
      `North connector ${testData.north.list[0].id} does not exist`
    );
    expect(northConnectorRepository.stopNorth).not.toHaveBeenCalled();
  });

  it('findByNorth() should list Subscription by North', async () => {
    (northConnectorRepository.listNorthSubscriptions as jest.Mock).mockReturnValueOnce(testData.north.list[0].subscriptions);
    (northConnectorRepository.findNorthById as jest.Mock).mockReturnValueOnce(testData.north.list[0]);

    const result = await service.findSubscriptionsByNorth(testData.north.list[0].id);

    expect(northConnectorRepository.findNorthById).toHaveBeenCalledWith(testData.north.list[0].id);
    expect(northConnectorRepository.listNorthSubscriptions).toHaveBeenCalledWith(testData.north.list[0].id);
    expect(result).toEqual(testData.north.list[0].subscriptions);
  });

  it('findByNorth() should throw an error if North not found', async () => {
    (northConnectorRepository.findNorthById as jest.Mock).mockReturnValueOnce(null);

    await expect(service.findSubscriptionsByNorth(testData.north.list[0].id)).rejects.toThrow('North connector not found');
    expect(northConnectorRepository.findNorthById).toHaveBeenCalledWith(testData.north.list[0].id);
    expect(northConnectorRepository.listNorthSubscriptions).not.toHaveBeenCalled();
  });

  it('checkSubscription() should check if subscription is set', () => {
    (northConnectorRepository.checkSubscription as jest.Mock).mockReturnValueOnce(true);

    expect(service.checkSubscription(testData.north.list[0].id, testData.south.list[0].id)).toEqual(true);

    expect(northConnectorRepository.checkSubscription).toHaveBeenCalledWith(testData.north.list[0].id, testData.south.list[0].id);
  });

  it('create() should create a subscription', async () => {
    (northConnectorRepository.findNorthById as jest.Mock).mockReturnValueOnce(testData.north.list[0]);
    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValueOnce(testData.south.list[0]);
    (northConnectorRepository.checkSubscription as jest.Mock).mockReturnValueOnce(false);

    await service.createSubscription(testData.north.list[0].id, testData.south.list[0].id);

    expect(northConnectorRepository.findNorthById).toHaveBeenCalledWith(testData.north.list[0].id);
    expect(southConnectorRepository.findSouthById).toHaveBeenCalledWith(testData.south.list[0].id);
    expect(northConnectorRepository.checkSubscription).toHaveBeenCalledWith(testData.north.list[0].id, testData.south.list[0].id);
    expect(northConnectorRepository.createSubscription).toHaveBeenCalledWith(testData.north.list[0].id, testData.south.list[0].id);
    expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).toHaveBeenCalled();
  });

  it('create() should throw if subscription already exists', async () => {
    (northConnectorRepository.findNorthById as jest.Mock).mockReturnValueOnce(testData.north.list[0]);
    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValueOnce(testData.south.list[0]);
    (northConnectorRepository.checkSubscription as jest.Mock).mockReturnValueOnce(true);

    await expect(service.createSubscription(testData.north.list[0].id, testData.south.list[0].id)).rejects.toThrow(
      'Subscription already exists'
    );

    expect(northConnectorRepository.createSubscription).not.toHaveBeenCalled();
    expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).not.toHaveBeenCalled();
  });

  it('create() should throw if South not found', async () => {
    (northConnectorRepository.findNorthById as jest.Mock).mockReturnValueOnce(testData.north.list[0]);
    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValueOnce(null);

    await expect(service.createSubscription(testData.north.list[0].id, testData.south.list[0].id)).rejects.toThrow(
      'South connector not found'
    );

    expect(northConnectorRepository.checkSubscription).not.toHaveBeenCalled();
    expect(northConnectorRepository.createSubscription).not.toHaveBeenCalled();
    expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).not.toHaveBeenCalled();
  });

  it('create() should throw if North not found', async () => {
    (northConnectorRepository.findNorthById as jest.Mock).mockReturnValueOnce(null);

    await expect(service.createSubscription(testData.north.list[0].id, testData.south.list[0].id)).rejects.toThrow(
      'North connector not found'
    );

    expect(southConnectorRepository.findSouthById).not.toHaveBeenCalled();
    expect(northConnectorRepository.checkSubscription).not.toHaveBeenCalled();
    expect(northConnectorRepository.createSubscription).not.toHaveBeenCalled();
    expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).not.toHaveBeenCalled();
  });

  it('delete() should delete a subscription', async () => {
    (northConnectorRepository.findNorthById as jest.Mock).mockReturnValueOnce(testData.north.list[0]);
    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValueOnce(testData.south.list[0]);

    await service.deleteSubscription(testData.north.list[0].id, testData.south.list[0].id);

    expect(northConnectorRepository.findNorthById).toHaveBeenCalledWith(testData.north.list[0].id);
    expect(southConnectorRepository.findSouthById).toHaveBeenCalledWith(testData.south.list[0].id);
    expect(northConnectorRepository.deleteSubscription).toHaveBeenCalledWith(testData.north.list[0].id, testData.south.list[0].id);
    expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).toHaveBeenCalled();
  });

  it('delete() should throw if South not found', async () => {
    (northConnectorRepository.findNorthById as jest.Mock).mockReturnValueOnce(testData.north.list[0]);
    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValueOnce(null);

    await expect(service.deleteSubscription(testData.north.list[0].id, testData.south.list[0].id)).rejects.toThrow(
      'South connector not found'
    );

    expect(northConnectorRepository.deleteSubscription).not.toHaveBeenCalled();
    expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).not.toHaveBeenCalled();
  });

  it('delete() should throw if North not found', async () => {
    (northConnectorRepository.findNorthById as jest.Mock).mockReturnValueOnce(null);

    await expect(service.deleteSubscription(testData.north.list[0].id, testData.south.list[0].id)).rejects.toThrow(
      'North connector not found'
    );

    expect(southConnectorRepository.findSouthById).not.toHaveBeenCalled();
    expect(northConnectorRepository.deleteSubscription).not.toHaveBeenCalled();
    expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).not.toHaveBeenCalled();
  });

  it('deleteAllByNorth() should delete all subscriptions by North', async () => {
    (northConnectorRepository.findNorthById as jest.Mock).mockReturnValueOnce(testData.north.list[0]);

    await service.deleteAllSubscriptionsByNorth(testData.north.list[0].id);

    expect(northConnectorRepository.findNorthById).toHaveBeenCalledWith(testData.north.list[0].id);
    expect(northConnectorRepository.deleteAllSubscriptionsByNorth).toHaveBeenCalledWith(testData.north.list[0].id);
    expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).toHaveBeenCalled();
  });

  it('deleteAllByNorth() should throw if North not found', async () => {
    (northConnectorRepository.findNorthById as jest.Mock).mockReturnValueOnce(null);

    await expect(service.deleteAllSubscriptionsByNorth(testData.north.list[0].id)).rejects.toThrow('North connector not found');

    expect(northConnectorRepository.deleteAllSubscriptionsByNorth).not.toHaveBeenCalled();
    expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).not.toHaveBeenCalled();
  });

  it('should retrieve secrets from north', () => {
    (northConnectorRepository.findNorthById as jest.Mock).mockReturnValueOnce(testData.north.list[0]);
    const manifest = JSON.parse(JSON.stringify(testData.north.manifest));
    manifest.id = testData.north.list[0].type;
    expect(service.retrieveSecretsFromNorth('northId', manifest)).toEqual(testData.north.list[0]);
  });

  it('should throw error if connector not found when retrieving secrets from north', () => {
    (northConnectorRepository.findNorthById as jest.Mock).mockReturnValueOnce(null);
    expect(() => service.retrieveSecretsFromNorth('northId', testData.north.manifest)).toThrow(
      `Could not find north connector northId to retrieve secrets from`
    );
  });

  it('should throw error if connector not found when retrieving secrets from north', () => {
    (northConnectorRepository.findNorthById as jest.Mock).mockReturnValueOnce(testData.north.list[0]);
    expect(() => service.retrieveSecretsFromNorth('northId', testData.north.manifest)).toThrow(
      `North connector northId (type ${testData.north.list[0].type}) must be of the type ${testData.north.manifest.id}`
    );
  });

  it('getTransformer() should return transformer', () => {
    const transformers = testData.transformers.list.map(element => toTransformerDTO(element));
    expect(getTransformer(null, transformers)).toBeNull();
    expect(getTransformer(transformers[0].id, transformers)).toEqual(transformers[0]);
    expect(() => getTransformer('bad id', transformers)).toThrow(`Could not find OIBus Transformer bad id`);
  });

  it('executeSetpoint() should cache content in north', async () => {
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

  it('executeSetpoint() should not cache content if north disabled', async () => {
    const northMock = new NorthConnectorMock(testData.north.list[0]);
    (northMock.isEnabled as jest.Mock).mockReturnValueOnce(false);
    (engine.getNorth as jest.Mock).mockReturnValue(northMock);
    const callback = jest.fn();
    await expect(service.executeSetpoint('northId', [{ reference: 'reference', value: '123456' }], callback)).rejects.toThrow(
      `North connector northId disabled`
    );
    expect(callback).not.toHaveBeenCalled();
  });

  it('executeSetpoint() should not cache content if north not found', async () => {
    (engine.getNorth as jest.Mock).mockReturnValue(null);
    const callback = jest.fn();
    await expect(service.executeSetpoint('badId', [{ reference: 'reference', value: '123456' }], callback)).rejects.toThrow(
      `North connector badId not found`
    );
    expect(callback).not.toHaveBeenCalled();
  });
});
