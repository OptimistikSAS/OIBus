import EncryptionServiceMock from '../tests/__mocks__/service/encryption-service.mock';
import PinoLogger from '../tests/__mocks__/service/logger/logger.mock';
import pino from 'pino';
import SouthService from './south.service';
import JoiValidator from '../web-server/controllers/validators/joi.validator';
import ScanModeRepository from '../repository/config/scan-mode.repository';
import ScanModeRepositoryMock from '../tests/__mocks__/repository/config/scan-mode-repository.mock';
import LogRepository from '../repository/logs/log.repository';
import LogRepositoryMock from '../tests/__mocks__/repository/log/log-repository.mock';
import OIAnalyticsMessageService from './oia/oianalytics-message.service';
import OIAnalyticsMessageServiceMock from '../tests/__mocks__/service/oia/oianalytics-message-service.mock';
import SouthConnectorRepository from '../repository/config/south-connector.repository';
import SouthConnectorRepositoryMock from '../tests/__mocks__/repository/config/south-connector-repository.mock';
import SouthConnectorMetricsRepository from '../repository/metrics/south-connector-metrics.repository';
import SouthMetricsRepositoryMock from '../tests/__mocks__/repository/metrics/south-metrics-repository.mock';
import SouthCacheRepository from '../repository/cache/south-cache.repository';
import SouthCacheRepositoryMock from '../tests/__mocks__/repository/cache/south-cache-repository.mock';
import testData from '../tests/utils/test-data';
import CertificateRepository from '../repository/config/certificate.repository';
import OIAnalyticsRegistrationRepository from '../repository/config/oianalytics-registration.repository';
import OIAnalyticsRegistrationRepositoryMock from '../tests/__mocks__/repository/config/oianalytics-registration-repository.mock';
import CertificateRepositoryMock from '../tests/__mocks__/repository/config/certificate-repository.mock';
import DataStreamEngine from '../engine/data-stream-engine';
import DataStreamEngineMock from '../tests/__mocks__/data-stream-engine.mock';
import fs from 'node:fs/promises';
import SouthConnectorMock from '../tests/__mocks__/south-connector.mock';
import { stringToBoolean } from './utils';
import multer from '@koa/multer';
import csv from 'papaparse';
import { buildSouth } from '../south/south-connector-factory';

jest.mock('../south/south-opcua/south-opcua');
jest.mock('./metrics/south-connector-metrics.service');
jest.mock('node:fs/promises');
jest.mock('papaparse');
jest.mock('./utils');
jest.mock('../south/south-connector-factory');
jest.mock('../web-server/controllers/validators/joi.validator');
jest.mock('./encryption.service', () => ({
  encryptionService: new EncryptionServiceMock('', '')
}));

const validator = new JoiValidator();
const logger: pino.Logger = new PinoLogger();
const southConnectorRepository: SouthConnectorRepository = new SouthConnectorRepositoryMock();
const logRepository: LogRepository = new LogRepositoryMock();
const southMetricsRepository: SouthConnectorMetricsRepository = new SouthMetricsRepositoryMock();
const southCacheRepository: SouthCacheRepository = new SouthCacheRepositoryMock();
const scanModeRepository: ScanModeRepository = new ScanModeRepositoryMock();
const oIAnalyticsRegistrationRepository: OIAnalyticsRegistrationRepository = new OIAnalyticsRegistrationRepositoryMock();
const certificateRepository: CertificateRepository = new CertificateRepositoryMock();
const oIAnalyticsMessageService: OIAnalyticsMessageService = new OIAnalyticsMessageServiceMock();
const engine: DataStreamEngine = new DataStreamEngineMock(logger);

const mockedSouth1 = new SouthConnectorMock(testData.south.list[0]);
let service: SouthService;

describe('South Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (buildSouth as jest.Mock).mockReturnValue(mockedSouth1);

    service = new SouthService(
      validator,
      southConnectorRepository,
      logRepository,
      southMetricsRepository,
      southCacheRepository,
      scanModeRepository,
      oIAnalyticsRegistrationRepository,
      certificateRepository,
      oIAnalyticsMessageService,
      engine
    );
  });

  it('should get a South connector settings', () => {
    service.findById('southId');
    expect(southConnectorRepository.findSouthById).toHaveBeenCalledTimes(1);
    expect(southConnectorRepository.findSouthById).toHaveBeenCalledWith('southId');
  });

  it('should get a South connector items', () => {
    service.getSouthItems('southId');
    expect(southConnectorRepository.findAllItemsForSouth).toHaveBeenCalledTimes(1);
    expect(southConnectorRepository.findAllItemsForSouth).toHaveBeenCalledWith('southId');
  });

  it('should get all South connector settings', () => {
    service.findAll();
    expect(southConnectorRepository.findAllSouth).toHaveBeenCalledTimes(1);
  });

  it('testSouth() should test South connector in creation mode', async () => {
    await service.testSouth('create', testData.south.command.type, testData.south.command.settings, logger);
    expect(buildSouth).toHaveBeenCalledTimes(1);
    expect(mockedSouth1.testConnection).toHaveBeenCalled();
  });

  it('testSouth() should throw an error if manifest type is bad', async () => {
    const badCommand = JSON.parse(JSON.stringify(testData.south.command));
    badCommand.type = 'bad';
    await expect(service.testSouth('create', badCommand.type, badCommand.settings, logger)).rejects.toThrow(
      'South manifest "bad" not found'
    );
    expect(buildSouth).not.toHaveBeenCalled();
  });

  it('testSouth() should test South connector in edit mode', async () => {
    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValueOnce(testData.south.list[0]);
    await service.testSouth(testData.south.list[0].id, testData.south.command.type, testData.south.command.settings, logger);
    expect(buildSouth).toHaveBeenCalledTimes(1);
    expect(mockedSouth1.testConnection).toHaveBeenCalled();
  });

  it('testSouth() should fail to test South connector in edit mode if south connector not found', async () => {
    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValueOnce(null);
    await expect(
      service.testSouth(testData.south.list[0].id, testData.south.command.type, testData.south.command.settings, logger)
    ).rejects.toThrow(`South connector "${testData.south.list[0].id}" not found`);
    expect(buildSouth).not.toHaveBeenCalled();
  });

  it('testSouthItem() should test South connector in creation mode', async () => {
    const callback = jest.fn();
    const itemCommand = JSON.parse(JSON.stringify(testData.south.itemCommand));
    itemCommand.settings = {
      regex: '*',
      preserveFiles: true,
      ignoreModifiedDate: false,
      minAge: 100
    };
    await service.testSouthItem(
      'create',
      testData.south.command.type,
      testData.south.command.settings,
      itemCommand,
      testData.south.itemTestingSettings,
      callback,
      logger
    );
    expect(buildSouth).toHaveBeenCalledTimes(1);
    expect(mockedSouth1.testItem).toHaveBeenCalled();
  });

  it('testSouthItem() should throw an error if manifest type is bad', async () => {
    const callback = jest.fn();
    const badCommand = JSON.parse(JSON.stringify(testData.south.command));
    badCommand.type = 'bad';
    await expect(
      service.testSouthItem(
        'create',
        badCommand.type,
        badCommand.settings,
        testData.south.itemCommand.settings,
        testData.south.itemTestingSettings,
        callback,
        logger
      )
    ).rejects.toThrow('South manifest "bad" not found');
    expect(buildSouth).not.toHaveBeenCalled();
  });

  it('testSouthItem() should test South connector in edit mode', async () => {
    const callback = jest.fn();
    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValueOnce(testData.south.list[0]);
    const itemCommand = JSON.parse(JSON.stringify(testData.south.itemCommand));
    itemCommand.settings = {
      regex: '*',
      preserveFiles: true,
      ignoreModifiedDate: false,
      minAge: 100
    };
    await service.testSouthItem(
      testData.south.list[0].id,
      testData.south.command.type,
      testData.south.command.settings,
      itemCommand,
      testData.south.itemTestingSettings,
      callback,
      logger
    );
    expect(buildSouth).toHaveBeenCalledTimes(1);
    expect(mockedSouth1.testItem).toHaveBeenCalled();
  });

  it('testSouthItem() should fail to test South connector in edit mode if south connector not found', async () => {
    const callback = jest.fn();
    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValueOnce(null);
    await expect(
      service.testSouthItem(
        testData.south.list[0].id,
        testData.south.command.type,
        testData.south.command.settings,
        testData.south.itemCommand.settings,
        testData.south.itemTestingSettings,
        callback,
        logger
      )
    ).rejects.toThrow(`South connector "${testData.south.list[0].id}" not found`);
    expect(buildSouth).not.toHaveBeenCalled();
  });

  it('should retrieve a list of south manifest', () => {
    const list = service.getInstalledSouthManifests();
    expect(list).toBeDefined();
  });

  it('createSouth() should not create South if manifest is not found', async () => {
    const badCommand = JSON.parse(JSON.stringify(testData.south.command));
    badCommand.type = 'bad';
    await expect(service.createSouth(badCommand, null)).rejects.toThrow('South manifest does not exist for type "bad"');
    expect(southConnectorRepository.saveSouthConnector).not.toHaveBeenCalled();
    expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).not.toHaveBeenCalled();
    expect(engine.createSouth).not.toHaveBeenCalled();
  });

  it('createSouth() should create South connector', async () => {
    (scanModeRepository.findAll as jest.Mock).mockReturnValue(testData.scanMode.list);
    const command = JSON.parse(JSON.stringify(testData.south.command));
    command.items = [
      {
        id: null,
        enabled: false,
        name: 'item',
        settings: {
          regex: '*',
          preserveFiles: true,
          ignoreModifiedDate: false,
          minAge: 100
        },
        scanModeId: 'scanModeId',
        scanModeName: null
      }
    ];
    await service.createSouth(command, null);
    expect(southConnectorRepository.saveSouthConnector).toHaveBeenCalledTimes(1);
    expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).toHaveBeenCalledTimes(1);
    expect(engine.createSouth).toHaveBeenCalledTimes(1);
    expect(engine.startSouth).toHaveBeenCalledTimes(1);
  });

  it('createSouth() should not create South connector if disabled', async () => {
    (scanModeRepository.findAll as jest.Mock).mockReturnValue(testData.scanMode.list);
    const command = JSON.parse(JSON.stringify(testData.south.command));
    command.items = [];
    command.enabled = false;
    await service.createSouth(command, null);
    expect(southConnectorRepository.saveSouthConnector).toHaveBeenCalledTimes(1);
    expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).toHaveBeenCalledTimes(1);
    expect(engine.createSouth).toHaveBeenCalledTimes(1);
    expect(engine.startSouth).not.toHaveBeenCalled();
  });

  it('createSouth() should create South connector and retrieve secrets from another connector', async () => {
    (scanModeRepository.findAll as jest.Mock).mockReturnValue(testData.scanMode.list);
    service.retrieveSecretsFromSouth = jest.fn();
    const command = JSON.parse(JSON.stringify(testData.south.command));
    command.items = [
      {
        id: null,
        enabled: false,
        name: 'item',
        settings: {
          regex: '*',
          preserveFiles: true,
          ignoreModifiedDate: false,
          minAge: 100
        },
        scanModeId: 'scanModeId',
        scanModeName: null
      }
    ];
    await service.createSouth(command, testData.south.list[0].id);
    expect(service.retrieveSecretsFromSouth).toHaveBeenCalledTimes(1);
  });

  it('should get South data stream', () => {
    service.getSouthDataStream(testData.south.list[0].id);
    expect(engine.getSouthDataStream).toHaveBeenCalledWith(testData.south.list[0].id);
  });

  it('updateSouth() should update South connector', async () => {
    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValueOnce(testData.south.list[0]);
    const command = JSON.parse(JSON.stringify(testData.south.command));
    command.items = [
      {
        id: null,
        enabled: false,
        name: 'item',
        settings: {
          regex: '*',
          preserveFiles: true,
          ignoreModifiedDate: false,
          minAge: 100
        },
        scanModeId: 'scanModeId',
        scanModeName: null
      }
    ];
    await service.updateSouth(testData.south.list[0].id, command);

    expect(southConnectorRepository.saveSouthConnector).toHaveBeenCalledTimes(1);
    expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).toHaveBeenCalledTimes(1);
    expect(engine.reloadSouth).toHaveBeenCalledTimes(1);
  });

  it('updateSouth() should throw an error if connector not found', async () => {
    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValueOnce(null);
    await expect(service.updateSouth(testData.south.list[0].id, testData.south.command)).rejects.toThrow(
      `South connector ${testData.south.list[0].id} does not exist`
    );
    expect(southConnectorRepository.saveSouthConnector).not.toHaveBeenCalled();
  });

  it('updateSouth() should throw an error if connector not found', async () => {
    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValueOnce(testData.south.list[0]);
    const command = JSON.parse(JSON.stringify(testData.south.command));
    command.type = 'bad';
    await expect(service.updateSouth(testData.south.list[0].id, command)).rejects.toThrow(`South manifest does not exist for type bad`);
    expect(southConnectorRepository.saveSouthConnector).not.toHaveBeenCalled();
  });

  it('deleteSouth() should delete south', async () => {
    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValueOnce(testData.south.list[0]);

    await service.deleteSouth(testData.south.list[0].id);
    expect(engine.deleteSouth).toHaveBeenCalledWith(testData.south.list[0]);
    expect(southConnectorRepository.deleteSouth).toHaveBeenCalledWith(testData.south.list[0].id);
    expect(logRepository.deleteLogsByScopeId).toHaveBeenCalledWith('south', testData.south.list[0].id);
    expect(southMetricsRepository.removeMetrics).toHaveBeenCalledWith(testData.south.list[0].id);
    expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).toHaveBeenCalled();
  });

  it('deleteSouth() should throw an error if south not found', async () => {
    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValueOnce(null);

    await expect(service.deleteSouth(testData.south.list[0].id)).rejects.toThrow(
      `South connector ${testData.south.list[0].id} does not exist`
    );
    expect(engine.deleteSouth).not.toHaveBeenCalled();
  });

  it('startSouth() should start south', async () => {
    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValueOnce(testData.south.list[0]);

    await service.startSouth(testData.south.list[0].id);
    expect(southConnectorRepository.start).toHaveBeenCalledWith(testData.south.list[0].id);
    expect(engine.startSouth).toHaveBeenCalledWith(testData.south.list[0].id);
    expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).toHaveBeenCalled();
  });

  it('startSouth() should throw an error if south not found', async () => {
    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValueOnce(null);

    await expect(service.startSouth(testData.south.list[0].id)).rejects.toThrow(
      `South connector "${testData.south.list[0].id}" does not exist`
    );
    expect(southConnectorRepository.start).not.toHaveBeenCalled();
  });

  it('stopSouth() should stop south', async () => {
    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValueOnce(testData.south.list[0]);

    await service.stopSouth(testData.south.list[0].id);
    expect(southConnectorRepository.stop).toHaveBeenCalledWith(testData.south.list[0].id);
    expect(engine.stopSouth).toHaveBeenCalledWith(testData.south.list[0].id);
    expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).toHaveBeenCalled();
  });

  it('stopSouth() should throw an error if south not found', async () => {
    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValueOnce(null);

    await expect(service.stopSouth(testData.south.list[0].id)).rejects.toThrow(
      `South connector "${testData.south.list[0].id}" does not exist`
    );
    expect(southConnectorRepository.stop).not.toHaveBeenCalled();
  });

  it('searchSouthItems() should search south items', () => {
    service.searchSouthItems(testData.south.list[0].id, {});
    expect(southConnectorRepository.searchItems).toHaveBeenCalledWith(testData.south.list[0].id, {});
  });

  it('findSouthConnectorItemById() should find an item by id', () => {
    service.findSouthConnectorItemById(testData.south.list[0].id, testData.south.list[0].items[0].id);
    expect(southConnectorRepository.findItemById).toHaveBeenCalledWith(testData.south.list[0].id, testData.south.list[0].items[0].id);
  });

  it('createItem() should create an item', async () => {
    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValueOnce(testData.south.list[0]);
    const itemCommand = JSON.parse(JSON.stringify(testData.south.itemCommand));
    itemCommand.settings = {
      regex: '*',
      preserveFiles: true,
      ignoreModifiedDate: false,
      minAge: 100
    };
    await service.createItem(testData.south.list[0].id, itemCommand);
    expect(southConnectorRepository.findSouthById).toHaveBeenCalledWith(testData.south.list[0].id);
    expect(southConnectorRepository.saveItem).toHaveBeenCalledTimes(1);
    expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).toHaveBeenCalledTimes(1);
    expect(engine.reloadSouthItems).toHaveBeenCalledWith(testData.south.list[0]);
  });

  it('createItem() should throw an error if connector does not exist', async () => {
    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValueOnce(null);
    const itemCommand = JSON.parse(JSON.stringify(testData.south.itemCommand));
    itemCommand.settings = {
      regex: '*',
      preserveFiles: true,
      ignoreModifiedDate: false,
      minAge: 100
    };
    await expect(service.createItem(testData.south.list[0].id, itemCommand)).rejects.toThrow(
      `South connector "${testData.south.list[0].id}" does not exist`
    );
  });

  it('createItem() should throw an error if manifest is not found', async () => {
    const badSouth = JSON.parse(JSON.stringify(testData.south.list[0]));
    badSouth.type = 'bad';
    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValueOnce(badSouth);
    const itemCommand = JSON.parse(JSON.stringify(testData.south.itemCommand));
    itemCommand.settings = {
      regex: '*',
      preserveFiles: true,
      ignoreModifiedDate: false,
      minAge: 100
    };
    await expect(service.createItem(testData.south.list[0].id, itemCommand)).rejects.toThrow(
      `South manifest does not exist for type "bad"`
    );
  });

  it('updateItem() should update an item', async () => {
    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValueOnce(testData.south.list[0]);
    (southConnectorRepository.findItemById as jest.Mock).mockReturnValueOnce(testData.south.list[0].items[0]);
    const itemCommand = JSON.parse(JSON.stringify(testData.south.itemCommand));
    itemCommand.settings = {
      regex: '*',
      preserveFiles: true,
      ignoreModifiedDate: false,
      minAge: 100
    };
    await service.updateItem(testData.south.list[0].id, 'itemId', itemCommand);
    expect(southConnectorRepository.findItemById).toHaveBeenCalledWith(testData.south.list[0].id, 'itemId');
    expect(southConnectorRepository.saveItem).toHaveBeenCalledTimes(1);
    expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).toHaveBeenCalledTimes(1);
    expect(engine.reloadSouthItems).toHaveBeenCalledWith(testData.south.list[0]);
  });

  it('updateItem() should throw an error if item does not exist', async () => {
    (southConnectorRepository.findItemById as jest.Mock).mockReturnValueOnce(null);
    const itemCommand = JSON.parse(JSON.stringify(testData.south.itemCommand));
    itemCommand.settings = {
      regex: '*',
      preserveFiles: true,
      ignoreModifiedDate: false,
      minAge: 100
    };
    await expect(service.updateItem(testData.south.list[0].id, 'itemId', itemCommand)).rejects.toThrow(
      `South item with ID "itemId" does not exist`
    );
  });

  it('updateItem() should throw an error if manifest is not found', async () => {
    const badSouth = JSON.parse(JSON.stringify(testData.south.list[0]));
    badSouth.type = 'bad';
    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValueOnce(badSouth);
    (southConnectorRepository.findItemById as jest.Mock).mockReturnValueOnce(testData.south.list[0].items[0]);

    const itemCommand = JSON.parse(JSON.stringify(testData.south.itemCommand));
    itemCommand.settings = {
      regex: '*',
      preserveFiles: true,
      ignoreModifiedDate: false,
      minAge: 100
    };
    await expect(service.updateItem(testData.south.list[0].id, 'itemId', itemCommand)).rejects.toThrow(
      `South manifest does not exist for type "bad"`
    );
  });

  it('deleteItem() should delete an item', async () => {
    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValueOnce(testData.south.list[0]);
    (southConnectorRepository.findItemById as jest.Mock).mockReturnValueOnce(testData.south.list[0].items[0]);
    await service.deleteItem(testData.south.list[0].id, 'itemId');
    expect(southConnectorRepository.findItemById).toHaveBeenCalledWith(testData.south.list[0].id, 'itemId');
    expect(southConnectorRepository.deleteItem).toHaveBeenCalledWith(testData.south.list[0].items[0].id);
    expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).toHaveBeenCalledTimes(1);
    expect(engine.reloadSouthItems).toHaveBeenCalledWith(testData.south.list[0]);
  });

  it('deleteItem() should throw an error if item does not exist', async () => {
    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValueOnce(testData.south.list[0]);
    (southConnectorRepository.findItemById as jest.Mock).mockReturnValueOnce(null);

    await expect(service.deleteItem(testData.south.list[0].id, 'itemId')).rejects.toThrow(`South item "itemId" not found`);
  });

  it('deleteItem() should throw an error if connector does not exist', async () => {
    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValueOnce(null);

    await expect(service.deleteItem(testData.south.list[0].id, 'itemId')).rejects.toThrow(
      `South connector "${testData.south.list[0].id}" does not exist`
    );
  });

  it('deleteAllItemsForSouthConnector() should delete all items', async () => {
    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValueOnce(testData.south.list[0]);
    await service.deleteAllItemsForSouthConnector(testData.south.list[0].id);
    expect(southConnectorRepository.deleteAllItemsBySouth).toHaveBeenCalledWith(testData.south.list[0].id);
    expect(southCacheRepository.deleteAllBySouthConnector).toHaveBeenCalledWith(testData.south.list[0].id);
    expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).toHaveBeenCalledTimes(1);
    expect(engine.reloadSouthItems).toHaveBeenCalledWith(testData.south.list[0]);
  });

  it('deleteAllItemsForSouthConnector() should throw an error if connector does not exist', async () => {
    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValueOnce(null);

    await expect(service.deleteAllItemsForSouthConnector(testData.south.list[0].id)).rejects.toThrow(
      `South connector "${testData.south.list[0].id}" does not exist`
    );
  });

  it('enableItem() should enable an item', async () => {
    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValueOnce(testData.south.list[0]);
    (southConnectorRepository.findItemById as jest.Mock).mockReturnValueOnce(testData.south.list[0].items[0]);
    await service.enableItem(testData.south.list[0].id, 'itemId');
    expect(southConnectorRepository.findItemById).toHaveBeenCalledWith(testData.south.list[0].id, 'itemId');
    expect(southConnectorRepository.enableItem).toHaveBeenCalledWith(testData.south.list[0].items[0].id);
    expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).toHaveBeenCalledTimes(1);
    expect(engine.reloadSouthItems).toHaveBeenCalledWith(testData.south.list[0]);
  });

  it('enableItem() should throw an error if item is not found', async () => {
    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValueOnce(testData.south.list[0]);
    (southConnectorRepository.findItemById as jest.Mock).mockReturnValueOnce(null);
    await expect(service.enableItem(testData.south.list[0].id, 'itemId')).rejects.toThrow('South item "itemId" not found');
  });

  it('enableItem() should throw an error if south is not found', async () => {
    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValueOnce(null);
    await expect(service.enableItem(testData.south.list[0].id, 'itemId')).rejects.toThrow('South connector "southId1" does not exist');
  });

  it('disableItem() should enable an item', async () => {
    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValueOnce(testData.south.list[0]);
    (southConnectorRepository.findItemById as jest.Mock).mockReturnValueOnce(testData.south.list[0].items[0]);
    await service.disableItem(testData.south.list[0].id, 'itemId');
    expect(southConnectorRepository.findItemById).toHaveBeenCalledWith(testData.south.list[0].id, 'itemId');
    expect(southConnectorRepository.disableItem).toHaveBeenCalledWith(testData.south.list[0].items[0].id);
    expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).toHaveBeenCalledTimes(1);
    expect(engine.reloadSouthItems).toHaveBeenCalledWith(testData.south.list[0]);
  });

  it('disableItem() should throw an error if item is not found', async () => {
    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValueOnce(testData.south.list[0]);
    (southConnectorRepository.findItemById as jest.Mock).mockReturnValueOnce(null);
    await expect(service.disableItem(testData.south.list[0].id, 'itemId')).rejects.toThrow('South item "itemId" not found');
  });

  it('disableItem() should throw an error if south is not found', async () => {
    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValueOnce(null);
    await expect(service.disableItem(testData.south.list[0].id, 'itemId')).rejects.toThrow('South connector "southId1" does not exist');
  });

  it('checkCsvImport() should properly parse csv and check items', async () => {
    const csvData = [
      {
        name: 'item1',
        enabled: 'true',
        settings_regex: '*',
        settings_preserveFiles: 'true',
        settings_ignoreModifiedDate: 'false',
        settings_minAge: 100,
        scanMode: testData.scanMode.list[0].name
      },
      {
        name: 'item2bis',
        enabled: 'true',
        settings_regex: '*',
        settings_preserveFiles: 'true',
        settings_ignoreModifiedDate: 'false',
        settings_minAge: 100,
        scanMode: 'bad scan mode'
      },
      {
        name: 'item3',
        enabled: 'true',
        settings_regex: '*',
        settings_preserveFiles: 'true',
        settings_ignoreModifiedDate: 'false',
        settings_minAge: 100,
        settings_badItem: 100,
        scanMode: testData.scanMode.list[0].name
      },
      {
        name: 'item4',
        enabled: 'true',
        settings_regex: '*',
        settings_preserveFiles: 'true',
        settings_ignoreModifiedDate: 12, // bad type
        settings_minAge: 100,
        scanMode: testData.scanMode.list[0].name
      },
      {
        name: 'item5',
        enabled: 'true',
        settings_regex: '*',
        settings_preserveFiles: 'true',
        settings_ignoreModifiedDate: 'false',
        settings_minAge: 100,
        scanMode: testData.scanMode.list[0].name
      }
    ];
    (fs.readFile as jest.Mock).mockReturnValueOnce('file content').mockReturnValueOnce(JSON.stringify(testData.south.list[0].items));
    (csv.parse as jest.Mock).mockReturnValueOnce({
      meta: { delimiter: ',' },
      data: csvData
    });
    (validator.validateSettings as jest.Mock).mockImplementationOnce(() => {
      throw new Error(`validation error`);
    });
    (stringToBoolean as jest.Mock).mockReturnValue(true);
    const result = await service.checkCsvFileImport(testData.south.list[0].type, { path: 'file/path.csv' } as multer.File, ',', {
      path: 'items.json'
    } as multer.File);
    expect(result).toEqual({
      items: [
        {
          id: '',
          name: csvData[4].name,
          enabled: true,
          scanMode: testData.scanMode.list[0],
          settings: {
            ignoreModifiedDate: true,
            minAge: 100,
            preserveFiles: true,
            regex: '*'
          }
        }
      ],
      errors: [
        {
          error: 'Item name "item1" already used',
          item: {
            name: csvData[0].name,
            enabled: csvData[0].enabled,
            scanMode: csvData[0].scanMode,
            settings_ignoreModifiedDate: 'false',
            settings_minAge: 100,
            settings_preserveFiles: 'true',
            settings_regex: '*'
          }
        },
        {
          error: 'Scan mode "bad scan mode" not found for item "item2bis"',
          item: {
            name: csvData[1].name,
            enabled: csvData[1].enabled,
            scanMode: csvData[1].scanMode,
            settings_ignoreModifiedDate: 'false',
            settings_minAge: 100,
            settings_preserveFiles: 'true',
            settings_regex: '*'
          }
        },
        {
          error: 'Settings "badItem" not accepted in manifest',
          item: {
            name: csvData[2].name,
            enabled: csvData[2].enabled,
            scanMode: csvData[2].scanMode,
            settings_badItem: 100,
            settings_ignoreModifiedDate: 'false',
            settings_minAge: 100,
            settings_preserveFiles: 'true',
            settings_regex: '*'
          }
        },
        {
          error: 'validation error',
          item: {
            name: csvData[3].name,
            enabled: csvData[3].enabled,
            scanMode: csvData[3].scanMode,
            settings_ignoreModifiedDate: 12,
            settings_minAge: 100,
            settings_preserveFiles: 'true',
            settings_regex: '*'
          }
        }
      ]
    });
  });

  it('checkCsvImport() should properly parse csv and check items with array or object', async () => {
    const csvData = [
      {
        name: 'item',
        enabled: 'true',
        settings_query: 'query1',
        settings_dateTimeFields: '[]',
        settings_serialization: JSON.stringify({
          type: 'csv',
          filename: 'filename',
          delimiter: 'SEMI_COLON',
          compression: true,
          outputTimestampFormat: 'YYYY-MM-DD HH:mm:ss.SSS',
          outputTimezone: 'Europe/Paris'
        }),
        scanMode: testData.scanMode.list[0].name
      }
    ];
    (fs.readFile as jest.Mock).mockReturnValueOnce('file content').mockReturnValueOnce(JSON.stringify(testData.south.list[0].items));
    (csv.parse as jest.Mock).mockReturnValueOnce({
      meta: { delimiter: ',' },
      data: csvData
    });
    (stringToBoolean as jest.Mock).mockReturnValue(true);
    const result = await service.checkCsvFileImport(testData.south.list[1].type, { path: 'file/path.csv' } as multer.File, ',', {
      path: 'items.json'
    } as multer.File);
    expect(result).toEqual({
      items: [
        {
          id: '',
          name: csvData[0].name,
          enabled: csvData[0].enabled.toLowerCase() === 'true',
          scanMode: testData.scanMode.list[0],
          settings: {
            query: 'query1',
            dateTimeFields: [],
            serialization: {
              type: 'csv',
              filename: 'filename',
              delimiter: 'SEMI_COLON',
              compression: true,
              outputTimestampFormat: 'YYYY-MM-DD HH:mm:ss.SSS',
              outputTimezone: 'Europe/Paris'
            }
          }
        }
      ],
      errors: []
    });
  });

  it('checkCsvContentImport() should throw error if manifest not found', async () => {
    await expect(service.checkCsvContentImport('bad', 'fileContent', ',', testData.south.list[0].items)).rejects.toThrow(
      `South manifest does not exist for type "bad"`
    );
  });

  it('checkCsvImport() should throw error if delimiter does not match', async () => {
    (fs.readFile as jest.Mock).mockReturnValueOnce('file content').mockReturnValueOnce(JSON.stringify(testData.south.list[0].items));
    (csv.parse as jest.Mock).mockReturnValueOnce({
      meta: { delimiter: ';' },
      data: []
    });

    await expect(
      service.checkCsvFileImport(testData.south.list[0].type, { path: 'file/path.csv' } as multer.File, ',', {
        path: 'items.json'
      } as multer.File)
    ).rejects.toThrow(`The entered delimiter "," does not correspond to the file delimiter ";"`);
  });

  it('importItems() should import items', async () => {
    const itemCommand = JSON.parse(JSON.stringify(testData.south.itemCommand));
    itemCommand.settings = {
      regex: '*',
      preserveFiles: true,
      ignoreModifiedDate: false,
      minAge: 100
    };
    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValueOnce(testData.south.list[0]);

    await service.importItems(testData.south.list[0].id, [itemCommand]);
    expect(southConnectorRepository.saveAllItems).toHaveBeenCalledTimes(1);
    expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).toHaveBeenCalledTimes(1);
    expect(engine.reloadSouthItems).toHaveBeenCalledWith(testData.south.list[0]);
  });

  it('importItems() should not import items if connector does not exist', async () => {
    const itemCommand = JSON.parse(JSON.stringify(testData.south.itemCommand));
    itemCommand.settings = {
      regex: '*',
      preserveFiles: true,
      ignoreModifiedDate: false,
      minAge: 100
    };
    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValueOnce(null);

    await expect(service.importItems(testData.south.list[0].id, [itemCommand])).rejects.toThrow(
      `South connector "${testData.south.list[0].id}" does not exist`
    );
  });

  it('should retrieve secrets from south', () => {
    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValueOnce(testData.south.list[0]);
    const manifest = JSON.parse(JSON.stringify(testData.south.manifest));
    manifest.id = testData.south.list[0].type;
    expect(service.retrieveSecretsFromSouth('southId', manifest)).toEqual(testData.south.list[0]);
  });

  it('should throw error if connector not found when retrieving secrets from south', () => {
    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValueOnce(null);
    expect(() => service.retrieveSecretsFromSouth('southId', testData.south.manifest)).toThrow(
      `Could not find South connector "southId" to retrieve secrets from`
    );
  });

  it('should throw error if connector not found when retrieving secrets from bad south type', () => {
    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValueOnce(testData.south.list[1]);
    expect(() => service.retrieveSecretsFromSouth('southId', testData.south.manifest)).toThrow(
      `South connector "southId" (type "${testData.south.list[1].type}") must be of the type "${testData.south.manifest.id}"`
    );
  });
});
