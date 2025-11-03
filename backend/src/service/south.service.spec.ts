import EncryptionServiceMock from '../tests/__mocks__/service/encryption-service.mock';
import PinoLogger from '../tests/__mocks__/service/logger/logger.mock';
import pino from 'pino';
import SouthService, { southManifestList, toSouthConnectorDTO, toSouthConnectorItemDTO, toSouthConnectorLightDTO } from './south.service';
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
import SouthConnectorMock from '../tests/__mocks__/south-connector.mock';
import { stringToBoolean, arrayToFlattenedCSV, validateArrayCSVImport } from './utils';
import multer from '@koa/multer';
import csv from 'papaparse';
import fs from 'node:fs/promises';
import { buildSouth } from '../south/south-connector-factory';
import { NotFoundError, OIBusValidationError } from '../model/types';
import { OIBusSouthType, SouthConnectorEntityLight, SouthConnectorManifest } from '../model/south-connector.model';

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
    (southConnectorRepository.findAllSouth as jest.Mock).mockReturnValue([]);
    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValue(testData.south.list[0]);
    (southConnectorRepository.findItemById as jest.Mock).mockReturnValue(testData.south.list[0].items[0]);
    (scanModeRepository.findAll as jest.Mock).mockReturnValue(testData.scanMode.list);
    (stringToBoolean as jest.Mock).mockReturnValue(true);

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

  it('should retrieve a list of north manifest', () => {
    const list = service.listManifest();
    expect(list).toBeDefined();
  });

  it('should retrieve a manifest', () => {
    const consoleManifest = service.getManifest('folder-scanner');
    expect(consoleManifest).toEqual(southManifestList[0]);
  });

  it('should throw an error if manifest is not found', () => {
    expect(() => service.getManifest('bad')).toThrow(new NotFoundError(`South manifest "bad" not found`));
  });

  it('should get all south connector settings', () => {
    service.list();
    expect(southConnectorRepository.findAllSouth).toHaveBeenCalledTimes(1);
  });

  it('should get a south connector', () => {
    service.findById(testData.south.list[0].id);

    expect(southConnectorRepository.findSouthById).toHaveBeenCalledTimes(1);
    expect(southConnectorRepository.findSouthById).toHaveBeenCalledWith(testData.south.list[0].id);
  });

  it('should throw an error when south connector does not exist', () => {
    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValue(null);

    expect(() => service.findById(testData.south.list[0].id)).toThrow(new NotFoundError(`South "${testData.south.list[0].id}" not found`));

    expect(southConnectorRepository.findSouthById).toHaveBeenCalledTimes(1);
    expect(southConnectorRepository.findSouthById).toHaveBeenCalledWith(testData.south.list[0].id);
  });

  it('should create a south connector', async () => {
    service.retrieveSecretsFromSouth = jest.fn();

    await service.create(testData.south.command, testData.south.list[0].id);

    expect(southConnectorRepository.saveSouthConnector).toHaveBeenCalledTimes(1);
    expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).toHaveBeenCalledTimes(1);
    expect(service.retrieveSecretsFromSouth).toHaveBeenCalledTimes(1);
    expect(engine.createSouth).toHaveBeenCalledTimes(1);
    expect(engine.startSouth).toHaveBeenCalledTimes(1);
  });

  it('should not create south connector if disabled', async () => {
    service.retrieveSecretsFromSouth = jest.fn();

    const command = JSON.parse(JSON.stringify(testData.south.command));
    command.enabled = false;
    await service.create(command, null);
    expect(southConnectorRepository.saveSouthConnector).toHaveBeenCalledTimes(1);
    expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).toHaveBeenCalledTimes(1);
    expect(engine.createSouth).toHaveBeenCalledTimes(1);
    expect(engine.startSouth).not.toHaveBeenCalled();
  });

  it('should not create a south connector with duplicate name', async () => {
    service.retrieveSecretsFromSouth = jest.fn();
    (southConnectorRepository.findAllSouth as jest.Mock).mockReturnValue([{ id: 'existing-id', name: testData.south.command.name }]);

    await expect(service.create(testData.south.command, null)).rejects.toThrow(
      new OIBusValidationError(`South connector name "${testData.south.command.name}" already exists`)
    );
  });

  it('should update a south connector', async () => {
    (southConnectorRepository.findAllSouth as jest.Mock).mockReturnValue(testData.south.list);
    await service.update(testData.south.list[0].id, testData.south.command);

    expect(southConnectorRepository.saveSouthConnector).toHaveBeenCalledTimes(1);
    expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).toHaveBeenCalledTimes(1);
    expect(engine.reloadSouth).toHaveBeenCalledTimes(1);
  });

  it('should update a south connector with a new unique name', async () => {
    const command = JSON.parse(JSON.stringify(testData.south.command));
    command.name = 'Updated South Name';
    (southConnectorRepository.findAllSouth as jest.Mock).mockReturnValue(testData.south.list);

    await service.update(testData.south.list[0].id, command);

    expect(southConnectorRepository.saveSouthConnector).toHaveBeenCalledTimes(1);
    expect(engine.reloadSouth).toHaveBeenCalledTimes(1);
  });

  it('should not update a south connector with duplicate name', async () => {
    const command = JSON.parse(JSON.stringify(testData.south.command));
    command.name = 'Duplicate Name';
    (southConnectorRepository.findAllSouth as jest.Mock).mockReturnValue([{ id: 'other-id', name: 'Duplicate Name' }]);

    await expect(service.update(testData.south.list[0].id, command)).rejects.toThrow(
      new OIBusValidationError(`South connector name "Duplicate Name" already exists`)
    );
  });

  it('should delete a south connector', async () => {
    await service.delete(testData.south.list[0].id);

    expect(engine.deleteSouth).toHaveBeenCalledWith(testData.south.list[0]);
    expect(southConnectorRepository.deleteSouth).toHaveBeenCalledWith(testData.south.list[0].id);
    expect(logRepository.deleteLogsByScopeId).toHaveBeenCalledWith('south', testData.south.list[0].id);
    expect(southMetricsRepository.removeMetrics).toHaveBeenCalledWith(testData.south.list[0].id);
    expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).toHaveBeenCalled();
  });

  it('should start south', async () => {
    await service.start(testData.south.list[0].id);

    expect(southConnectorRepository.start).toHaveBeenCalledWith(testData.south.list[0].id);
    expect(engine.startSouth).toHaveBeenCalledWith(testData.south.list[0].id);
    expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).toHaveBeenCalled();
  });

  it('should stop south', async () => {
    await service.stop(testData.south.list[0].id);

    expect(southConnectorRepository.stop).toHaveBeenCalledWith(testData.south.list[0].id);
    expect(engine.stopSouth).toHaveBeenCalledWith(testData.south.list[0].id);
    expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).toHaveBeenCalled();
  });

  it('should get a south data stream for metrics', () => {
    service.getSouthDataStream(testData.south.list[0].id);
    expect(engine.getSouthDataStream).toHaveBeenCalledWith(testData.south.list[0].id);
  });

  it('should test a south connector in creation mode', async () => {
    await service.testSouth('create', testData.south.command.type, testData.south.command.settings);

    expect(buildSouth).toHaveBeenCalledTimes(1);
    expect(mockedSouth1.testConnection).toHaveBeenCalled();
  });

  it('should test a south connector in edit mode', async () => {
    await service.testSouth(testData.south.list[0].id, testData.south.command.type, testData.south.command.settings);

    expect(buildSouth).toHaveBeenCalledTimes(1);
    expect(mockedSouth1.testConnection).toHaveBeenCalled();
  });

  it('should test item in creation mode', async () => {
    await service.testItem(
      'create',
      testData.south.command.type,
      testData.south.itemCommand.name,
      testData.south.command.settings,
      testData.south.itemCommand.settings,
      testData.south.itemTestingSettings
    );

    expect(buildSouth).toHaveBeenCalledTimes(1);
    expect(mockedSouth1.testItem).toHaveBeenCalled();
  });

  it('should test item in edit mode', async () => {
    await service.testItem(
      testData.south.list[0].id,
      testData.south.command.type,
      testData.south.itemCommand.name,
      testData.south.command.settings,
      testData.south.itemCommand.settings,
      testData.south.itemTestingSettings
    );

    expect(buildSouth).toHaveBeenCalledTimes(1);
    expect(mockedSouth1.testItem).toHaveBeenCalled();
  });

  it('should list items', () => {
    service.listItems(testData.south.list[0].id);
    expect(southConnectorRepository.findAllItemsForSouth).toHaveBeenCalledWith(testData.south.list[0].id);
  });

  it('should search items', () => {
    service.searchItems(testData.south.list[0].id, { name: undefined, scanModeId: undefined, enabled: undefined, page: 0 });
    expect(southConnectorRepository.searchItems).toHaveBeenCalledWith(testData.south.list[0].id, {
      name: undefined,
      scanModeId: undefined,
      enabled: undefined,
      page: 0
    });
  });

  it('should find an item', () => {
    service.findItemById(testData.south.list[0].id, testData.south.list[0].items[0].id);
    expect(southConnectorRepository.findItemById).toHaveBeenCalledWith(testData.south.list[0].id, testData.south.list[0].items[0].id);
  });

  it('should throw not found error if item does not exist', async () => {
    (southConnectorRepository.findItemById as jest.Mock).mockReturnValueOnce(null);

    expect(() => service.findItemById(testData.south.list[0].id, testData.south.list[0].items[0].id)).toThrow(
      new NotFoundError(`Item "${testData.south.list[0].items[0].id}" not found`)
    );

    expect(southConnectorRepository.findItemById).toHaveBeenCalledWith(testData.south.list[0].id, testData.south.list[0].items[0].id);
  });

  it('should create an item', async () => {
    await service.createItem(testData.south.list[0].id, testData.south.itemCommand);

    expect(southConnectorRepository.findSouthById).toHaveBeenCalledWith(testData.south.list[0].id);
    expect(southConnectorRepository.saveItem).toHaveBeenCalledTimes(1);
    expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).toHaveBeenCalledTimes(1);
    expect(engine.reloadSouthItems).toHaveBeenCalledWith(testData.south.list[0]);
  });

  it('should update an item', async () => {
    await service.updateItem(testData.south.list[0].id, testData.south.list[0].items[0].id, testData.south.itemCommand);

    expect(southConnectorRepository.findItemById).toHaveBeenCalledWith(testData.south.list[0].id, testData.south.list[0].items[0].id);
    expect(southConnectorRepository.saveItem).toHaveBeenCalledTimes(1);
    expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).toHaveBeenCalledTimes(1);
    expect(engine.reloadSouthItems).toHaveBeenCalledWith(testData.south.list[0]);
  });

  it('should enable an item', async () => {
    await service.enableItem(testData.south.list[0].id, testData.south.list[0].items[0].id);

    expect(southConnectorRepository.findItemById).toHaveBeenCalledWith(testData.south.list[0].id, testData.south.list[0].items[0].id);
    expect(southConnectorRepository.enableItem).toHaveBeenCalledWith(testData.south.list[0].items[0].id);
    expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).toHaveBeenCalledTimes(1);
    expect(engine.reloadSouthItems).toHaveBeenCalledWith(testData.south.list[0]);
  });

  it('should disable an item', async () => {
    await service.disableItem(testData.south.list[0].id, testData.south.list[0].items[0].id);

    expect(southConnectorRepository.findItemById).toHaveBeenCalledWith(testData.south.list[0].id, testData.south.list[0].items[0].id);
    expect(southConnectorRepository.disableItem).toHaveBeenCalledWith(testData.south.list[0].items[0].id);
    expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).toHaveBeenCalledTimes(1);
    expect(engine.reloadSouthItems).toHaveBeenCalledWith(testData.south.list[0]);
  });

  it('should enable multiple south items', async () => {
    const southConnectorId = testData.south.list[0].id;
    const itemIds = [testData.south.list[0].items[0].id, testData.south.list[0].items[1].id];

    (southConnectorRepository.findItemById as jest.Mock)
      .mockReturnValueOnce(testData.south.list[0].items[0])
      .mockReturnValueOnce(testData.south.list[0].items[1]);

    await service.enableItems(southConnectorId, itemIds);

    expect(southConnectorRepository.enableItem).toHaveBeenCalledWith(testData.south.list[0].items[0].id);
    expect(southConnectorRepository.enableItem).toHaveBeenCalledWith(testData.south.list[0].items[1].id);
    expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).toHaveBeenCalled();
    expect(engine.reloadSouthItems).toHaveBeenCalledWith(testData.south.list[0]);
  });

  it('should disable multiple south items', async () => {
    const southConnectorId = testData.south.list[0].id;
    const itemIds = [testData.south.list[0].items[0].id, testData.south.list[0].items[1].id];

    (southConnectorRepository.findItemById as jest.Mock)
      .mockReturnValueOnce(testData.south.list[0].items[0])
      .mockReturnValueOnce(testData.south.list[0].items[1]);

    await service.disableItems(southConnectorId, itemIds);

    expect(southConnectorRepository.disableItem).toHaveBeenCalledWith(testData.south.list[0].items[0].id);
    expect(southConnectorRepository.disableItem).toHaveBeenCalledWith(testData.south.list[0].items[1].id);
    expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).toHaveBeenCalled();
    expect(engine.reloadSouthItems).toHaveBeenCalledWith(testData.south.list[0]);
  });

  it('should delete an item', async () => {
    await service.deleteItem(testData.south.list[0].id, testData.south.list[0].items[0].id);

    expect(southConnectorRepository.findItemById).toHaveBeenCalledWith(testData.south.list[0].id, testData.south.list[0].items[0].id);
    expect(southConnectorRepository.deleteItem).toHaveBeenCalledWith(testData.south.list[0].items[0].id);
    expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).toHaveBeenCalledTimes(1);
    expect(engine.reloadSouthItems).toHaveBeenCalledWith(testData.south.list[0]);
  });

  it('should delete multiple south items', async () => {
    const southConnectorId = testData.south.list[0].id;
    const itemIds = [testData.south.list[0].items[0].id, testData.south.list[0].items[1].id];

    (southConnectorRepository.findItemById as jest.Mock)
      .mockReturnValueOnce(testData.south.list[0].items[0])
      .mockReturnValueOnce(testData.south.list[0].items[1]);

    await service.deleteItems(southConnectorId, itemIds);

    expect(southConnectorRepository.deleteItem).toHaveBeenCalledWith(testData.south.list[0].items[0].id);
    expect(southConnectorRepository.deleteItem).toHaveBeenCalledWith(testData.south.list[0].items[1].id);
    expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).toHaveBeenCalled();
    expect(engine.reloadSouthItems).toHaveBeenCalledWith(testData.south.list[0]);
  });

  it('should delete all items', async () => {
    await service.deleteAllItems(testData.south.list[0].id);

    expect(southConnectorRepository.deleteAllItemsBySouth).toHaveBeenCalledWith(testData.south.list[0].id);
    expect(southCacheRepository.deleteAllBySouthConnector).toHaveBeenCalledWith(testData.south.list[0].id);
    expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).toHaveBeenCalledTimes(1);
    expect(engine.reloadSouthItems).toHaveBeenCalledWith(testData.south.list[0]);
  });

  it('should properly check items', async () => {
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
    (csv.parse as jest.Mock).mockReturnValueOnce({
      meta: { delimiter: ',' },
      data: csvData
    });
    (validator.validateSettings as jest.Mock).mockImplementationOnce(() => {
      throw new Error('validation error');
    });

    const result = await service.checkImportItems(testData.south.list[0].type, 'file content', ',', testData.south.list[0].items);
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
            enabled: 'true',
            scanMode: testData.scanMode.list[0].name,
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
            enabled: 'true',
            scanMode: 'bad scan mode',
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
            enabled: 'true',
            scanMode: testData.scanMode.list[0].name,
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
            enabled: 'true',
            scanMode: testData.scanMode.list[0].name,
            settings_ignoreModifiedDate: 12,
            settings_minAge: 100,
            settings_preserveFiles: 'true',
            settings_regex: '*'
          }
        }
      ]
    });
  });

  it('should properly check items with array or object', async () => {
    const csvData = [
      {
        name: 'item',
        enabled: 'true',
        settings_query: 'query',
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
    (csv.parse as jest.Mock).mockReturnValueOnce({
      meta: { delimiter: ',' },
      data: csvData
    });
    const result = await service.checkImportItems(testData.south.list[1].type, 'file content', ',', testData.south.list[1].items);
    expect(result).toEqual({
      items: [
        {
          id: '',
          name: csvData[0].name,
          scanMode: testData.scanMode.list[0],
          enabled: true,
          settings: {
            query: 'query',
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

  it('should throw error if delimiter does not match', async () => {
    (csv.parse as jest.Mock).mockReturnValueOnce({
      meta: { delimiter: ';' },
      data: []
    });

    await expect(service.checkImportItems(testData.south.command.type, '', ',', [])).rejects.toThrow(
      new OIBusValidationError(`The entered delimiter "," does not correspond to the file delimiter ";"`)
    );
  });

  it('should import items', async () => {
    await service.importItems(testData.south.list[0].id, [testData.south.itemCommand]);

    expect(southConnectorRepository.saveAllItems).toHaveBeenCalledTimes(1);
    expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).toHaveBeenCalledTimes(1);
    expect(engine.reloadSouthItems).toHaveBeenCalledWith(testData.south.list[0]);
  });

  it('should retrieve secrets from south', () => {
    const manifest = JSON.parse(JSON.stringify(testData.south.manifest));
    manifest.id = testData.south.list[0].type;
    expect(service.retrieveSecretsFromSouth('southId', manifest)).toEqual(testData.south.list[0]);
  });

  it('should not retrieve secrets from south', () => {
    expect(service.retrieveSecretsFromSouth(null, testData.south.manifest)).toEqual(null);
  });

  it('should throw error if connector not found when retrieving secrets from bad south type', () => {
    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValueOnce(testData.south.list[1]);
    expect(() => service.retrieveSecretsFromSouth('southId', testData.south.manifest)).toThrow(
      `South connector "southId" (type "${testData.south.list[1].type}") must be of the type "${testData.south.manifest.id}"`
    );
  });

  it('should properly convert to DTO', () => {
    const southEntity = testData.south.list[0];
    const southLight: SouthConnectorEntityLight = {
      id: southEntity.id,
      name: southEntity.name,
      type: southEntity.type,
      description: southEntity.description,
      enabled: southEntity.enabled
    };
    expect(toSouthConnectorLightDTO(southLight)).toEqual({
      id: southLight.id,
      name: southLight.name,
      type: southLight.type,
      description: southLight.description,
      enabled: southLight.enabled
    });
    expect(toSouthConnectorDTO(southEntity)).toEqual({
      id: southEntity.id,
      name: southEntity.name,
      type: southEntity.type,
      description: southEntity.description,
      enabled: southEntity.enabled,
      settings: southEntity.settings,
      items: southEntity.items.map(item => toSouthConnectorItemDTO(item, southEntity.type))
    });
  });

  describe('Array export/import functionality', () => {
    const mockArrayAttribute = {
      type: 'array' as const,
      key: 'items',
      translationKey: 'test.items',
      validators: [],
      rootAttribute: {
        type: 'object' as const,
        key: 'item',
        translationKey: 'test.item',
        validators: [],
        attributes: [
          {
            type: 'string' as const,
            key: 'name',
            translationKey: 'test.name',
            validators: [],
            defaultValue: null,
            displayProperties: { visible: true, wrapInBox: false, row: 0, columns: 12, displayInViewMode: true }
          }
        ],
        enablingConditions: [],
        displayProperties: { visible: true, wrapInBox: false }
      },
      paginate: false,
      numberOfElementPerPage: 25
    };

    const mockManifest = {
      id: 'folder-scanner' as const,
      category: 'file' as const,
      modes: {
        subscription: false,
        lastPoint: false,
        lastFile: true,
        history: false
      },
      items: {
        type: 'array' as const,
        key: 'items',
        translationKey: 'test.items',
        validators: [],
        rootAttribute: {
          type: 'object' as const,
          key: 'settings',
          translationKey: 'test.settings',
          validators: [],
          attributes: [],
          enablingConditions: [],
          displayProperties: { visible: true, wrapInBox: false }
        },
        paginate: false,
        numberOfElementPerPage: 25
      },
      settings: {
        type: 'object' as const,
        key: 'settings',
        translationKey: 'test.settings',
        validators: [],
        attributes: [mockArrayAttribute],
        enablingConditions: [],
        displayProperties: { visible: true, wrapInBox: false }
      }
    } as SouthConnectorManifest;

    beforeEach(() => {
      jest.spyOn(service, 'getInstalledSouthManifests').mockReturnValue([mockManifest]);
    });

    describe('exportArrayToCSV', () => {
      it('should export array data to CSV', () => {
        (arrayToFlattenedCSV as jest.Mock).mockReturnValue('name\ntest1\ntest2');

        const arrayData = [{ name: 'test1' }, { name: 'test2' }];
        const delimiter = ',';
        const arrayKey = 'items';

        const result = service.exportArrayToCSV(arrayData, delimiter, arrayKey, 'folder-scanner');

        expect(arrayToFlattenedCSV).toHaveBeenCalledWith(arrayData, delimiter, mockArrayAttribute);
        expect(result).toBe('name\ntest1\ntest2');
      });

      it('should throw error if array field not found in manifest', () => {
        const arrayData = [{ name: 'test1' }];
        const delimiter = ',';
        const arrayKey = 'nonexistent';

        expect(() => service.exportArrayToCSV(arrayData, delimiter, arrayKey, 'folder-scanner')).toThrow(
          'Array field "nonexistent" not found in manifest'
        );
      });

      it('should throw error if field is not an array', () => {
        // Create a manifest with a non-array field
        const nonArrayManifest = {
          ...mockManifest,
          settings: {
            ...mockManifest.settings,
            attributes: [
              {
                type: 'string' as const,
                key: 'items',
                translationKey: 'test.items',
                validators: [],
                defaultValue: null,
                displayProperties: { visible: true, wrapInBox: false, row: 0, columns: 12, displayInViewMode: true }
              }
            ]
          }
        } as unknown as SouthConnectorManifest;

        jest.spyOn(service, 'getInstalledSouthManifests').mockReturnValue([nonArrayManifest]);

        const arrayData = [{ name: 'test1' }];
        const delimiter = ',';
        const arrayKey = 'items';

        expect(() => service.exportArrayToCSV(arrayData, delimiter, arrayKey, 'folder-scanner')).toThrow('Field "items" is not an array');
      });

      it('should export array data to CSV when array attribute is in manifest.items.rootAttribute.attributes', () => {
        (arrayToFlattenedCSV as jest.Mock).mockReturnValue('name\ntest1\ntest2');

        const manifestWithItemsAttribute = {
          ...mockManifest,
          settings: {
            ...mockManifest.settings,
            attributes: []
          },
          items: {
            ...mockManifest.items!,
            rootAttribute: {
              ...mockManifest.items!.rootAttribute,
              attributes: [mockArrayAttribute]
            }
          }
        } as SouthConnectorManifest;

        jest.spyOn(service, 'getInstalledSouthManifests').mockReturnValue([manifestWithItemsAttribute]);

        const arrayData = [{ name: 'test1' }, { name: 'test2' }];
        const delimiter = ',';
        const arrayKey = 'items';

        const result = service.exportArrayToCSV(arrayData, delimiter, arrayKey, 'folder-scanner');

        expect(arrayToFlattenedCSV).toHaveBeenCalledWith(arrayData, delimiter, mockArrayAttribute);
        expect(result).toBe('name\ntest1\ntest2');
      });

      it('should export array data to CSV when array attribute is nested in a settings object attribute', () => {
        (arrayToFlattenedCSV as jest.Mock).mockReturnValue('fieldName\ntest1\ntest2');

        const nestedArrayAttribute = {
          type: 'array' as const,
          key: 'dateTimeFields',
          translationKey: 'test.dateTimeFields',
          validators: [],
          rootAttribute: {
            type: 'object' as const,
            key: 'dateTimeField',
            translationKey: 'test.dateTimeField',
            validators: [],
            attributes: [
              {
                type: 'string' as const,
                key: 'fieldName',
                translationKey: 'test.fieldName',
                validators: [],
                defaultValue: null,
                displayProperties: { visible: true, wrapInBox: false, row: 0, columns: 12, displayInViewMode: true }
              }
            ],
            enablingConditions: [],
            displayProperties: { visible: true, wrapInBox: false }
          },
          paginate: false,
          numberOfElementPerPage: 25
        };

        const manifestWithNestedArray = {
          ...mockManifest,
          settings: {
            ...mockManifest.settings,
            attributes: [
              {
                type: 'object' as const,
                key: 'nestedSettings',
                translationKey: 'test.nestedSettings',
                validators: [],
                enablingConditions: [],
                displayProperties: { visible: true, wrapInBox: false },
                attributes: [nestedArrayAttribute]
              }
            ]
          }
        } as SouthConnectorManifest;

        jest.spyOn(service, 'getInstalledSouthManifests').mockReturnValue([manifestWithNestedArray]);

        const arrayData = [{ fieldName: 'test1' }, { fieldName: 'test2' }];
        const delimiter = ',';
        const arrayKey = 'dateTimeFields';

        const result = service.exportArrayToCSV(arrayData, delimiter, arrayKey, 'folder-scanner');

        expect(arrayToFlattenedCSV).toHaveBeenCalledWith(arrayData, delimiter, nestedArrayAttribute);
        expect(result).toBe('fieldName\ntest1\ntest2');
      });

      it('should export array data to CSV when array attribute is nested deep in items rootAttribute', () => {
        (arrayToFlattenedCSV as jest.Mock).mockReturnValue('fieldName\ntest1\ntest2');

        const nestedArrayAttribute = {
          type: 'array' as const,
          key: 'dateTimeFields',
          translationKey: 'test.dateTimeFields',
          validators: [],
          rootAttribute: {
            type: 'object' as const,
            key: 'dateTimeField',
            translationKey: 'test.dateTimeField',
            validators: [],
            attributes: [
              {
                type: 'string' as const,
                key: 'fieldName',
                translationKey: 'test.fieldName',
                validators: [],
                defaultValue: null,
                displayProperties: { visible: true, wrapInBox: false, row: 0, columns: 12, displayInViewMode: true }
              }
            ],
            enablingConditions: [],
            displayProperties: { visible: true, wrapInBox: false }
          },
          paginate: false,
          numberOfElementPerPage: 25
        };

        const manifestWithDeepNestedArray = {
          ...mockManifest,
          settings: {
            ...mockManifest.settings,
            attributes: []
          },
          items: {
            ...mockManifest.items!,
            rootAttribute: {
              ...mockManifest.items!.rootAttribute,
              attributes: [
                {
                  type: 'object' as const,
                  key: 'settings',
                  translationKey: 'test.settings',
                  validators: [],
                  enablingConditions: [],
                  displayProperties: { visible: true, wrapInBox: false },
                  attributes: [nestedArrayAttribute]
                }
              ]
            }
          }
        } as SouthConnectorManifest;

        jest.spyOn(service, 'getInstalledSouthManifests').mockReturnValue([manifestWithDeepNestedArray]);

        const arrayData = [{ fieldName: 'test1' }, { fieldName: 'test2' }];
        const delimiter = ',';
        const arrayKey = 'dateTimeFields';

        const result = service.exportArrayToCSV(arrayData, delimiter, arrayKey, 'folder-scanner');

        expect(arrayToFlattenedCSV).toHaveBeenCalledWith(arrayData, delimiter, nestedArrayAttribute);
        expect(result).toBe('fieldName\ntest1\ntest2');
      });

      it('should throw error if south manifest not found', () => {
        jest.spyOn(service, 'getInstalledSouthManifests').mockReturnValue([]);

        const arrayData = [{ name: 'test1' }];
        const delimiter = ',';
        const arrayKey = 'items';

        expect(() => service.exportArrayToCSV(arrayData, delimiter, arrayKey, 'nonexistent-type' as OIBusSouthType)).toThrow(
          'South manifest "nonexistent-type" not found'
        );
      });

      it('should throw error if array field is nested but key matches a non-array field', () => {
        const manifestWithNonArrayInNested = {
          ...mockManifest,
          settings: {
            ...mockManifest.settings,
            attributes: [
              {
                type: 'object' as const,
                key: 'nestedSettings',
                translationKey: 'test.nestedSettings',
                validators: [],
                enablingConditions: [],
                displayProperties: { visible: true, wrapInBox: false },
                attributes: [
                  {
                    type: 'string' as const,
                    key: 'dateTimeFields',
                    translationKey: 'test.dateTimeFields',
                    validators: [],
                    defaultValue: null,
                    displayProperties: { row: 0, columns: 12, displayInViewMode: true }
                  }
                ]
              }
            ]
          }
        } as unknown as SouthConnectorManifest;

        jest.spyOn(service, 'getInstalledSouthManifests').mockReturnValue([manifestWithNonArrayInNested]);

        const arrayData = [{ name: 'test1' }];
        const delimiter = ',';
        const arrayKey = 'dateTimeFields';

        expect(() => service.exportArrayToCSV(arrayData, delimiter, arrayKey, 'folder-scanner')).toThrow(
          'Field "dateTimeFields" is not an array'
        );
      });

      it('should continue searching after checking nested object that does not contain the array', () => {
        (arrayToFlattenedCSV as jest.Mock).mockReturnValue('name\ntest1\ntest2');

        const arrayData = [{ name: 'test1' }, { name: 'test2' }];
        const delimiter = ',';
        const arrayKey = 'items';

        const manifestWithNestedObjectFirst = {
          ...mockManifest,
          settings: {
            ...mockManifest.settings,
            attributes: [
              {
                type: 'object' as const,
                key: 'otherSettings',
                translationKey: 'test.otherSettings',
                validators: [],
                enablingConditions: [],
                displayProperties: { visible: true, wrapInBox: false },
                attributes: [
                  {
                    type: 'string' as const,
                    key: 'otherField',
                    translationKey: 'test.otherField',
                    validators: [],
                    defaultValue: null,
                    displayProperties: { row: 0, columns: 12, displayInViewMode: true }
                  }
                ]
              },
              mockArrayAttribute
            ]
          }
        } as SouthConnectorManifest;

        jest.spyOn(service, 'getInstalledSouthManifests').mockReturnValue([manifestWithNestedObjectFirst]);

        const result = service.exportArrayToCSV(arrayData, delimiter, arrayKey, 'folder-scanner');

        expect(arrayToFlattenedCSV).toHaveBeenCalledWith(arrayData, delimiter, mockArrayAttribute);
        expect(result).toBe('name\ntest1\ntest2');
      });
    });

    describe('checkArrayCSVImport', () => {
      it('should validate CSV import', async () => {
        const mockFileContent = 'name\ntest1\ntest2';
        (fs.readFile as jest.Mock).mockResolvedValue(Buffer.from(mockFileContent));
        (validateArrayCSVImport as jest.Mock).mockReturnValue({
          items: [{ name: 'test1' }, { name: 'test2' }],
          errors: []
        });

        const mockFile = {
          path: '/tmp/test.csv'
        } as multer.File;
        const delimiter = ',';
        const arrayKey = 'items';

        const result = await service.checkArrayCSVImport(mockFile, delimiter, arrayKey, 'folder-scanner');

        expect(fs.readFile).toHaveBeenCalledWith('/tmp/test.csv');
        expect(validateArrayCSVImport).toHaveBeenCalledWith(mockFileContent, delimiter, mockArrayAttribute, []);
        expect(result).toHaveProperty('items');
        expect(result).toHaveProperty('errors');
        expect(result.items).toHaveLength(2);
        expect(result.items[0]).toEqual({ name: 'test1' });
        expect(result.items[1]).toEqual({ name: 'test2' });
      });

      it('should throw error if array field not found in manifest', async () => {
        const mockFile = {
          path: '/tmp/test.csv'
        } as multer.File;
        const delimiter = ',';
        const arrayKey = 'nonexistent';

        await expect(service.checkArrayCSVImport(mockFile, delimiter, arrayKey, 'folder-scanner')).rejects.toThrow(
          'Array field "nonexistent" not found in manifest'
        );
      });

      it('should throw error if field is not an array', async () => {
        // Create a manifest with a non-array field
        const nonArrayManifest = {
          ...mockManifest,
          settings: {
            ...mockManifest.settings,
            attributes: [
              {
                type: 'string' as const,
                key: 'items',
                translationKey: 'test.items',
                validators: [],
                defaultValue: null,
                displayProperties: { visible: true, wrapInBox: false, row: 0, columns: 12, displayInViewMode: true }
              }
            ]
          }
        } as unknown as SouthConnectorManifest;

        jest.spyOn(service, 'getInstalledSouthManifests').mockReturnValue([nonArrayManifest]);

        const mockFile = {
          path: '/tmp/test.csv'
        } as multer.File;
        const delimiter = ',';
        const arrayKey = 'items';

        await expect(service.checkArrayCSVImport(mockFile, delimiter, arrayKey, 'folder-scanner')).rejects.toThrow(
          'Field "items" is not an array'
        );
      });

      it('should validate CSV import when array attribute is in manifest.items.rootAttribute.attributes', async () => {
        const mockFileContent = 'name\ntest1\ntest2';
        (fs.readFile as jest.Mock).mockResolvedValue(Buffer.from(mockFileContent));
        (validateArrayCSVImport as jest.Mock).mockReturnValue({
          items: [{ name: 'test1' }, { name: 'test2' }],
          errors: []
        });

        const manifestWithItemsAttribute = {
          ...mockManifest,
          settings: {
            ...mockManifest.settings,
            attributes: []
          },
          items: {
            ...mockManifest.items!,
            rootAttribute: {
              ...mockManifest.items!.rootAttribute,
              attributes: [mockArrayAttribute]
            }
          }
        } as SouthConnectorManifest;

        jest.spyOn(service, 'getInstalledSouthManifests').mockReturnValue([manifestWithItemsAttribute]);

        const mockFile = {
          path: '/tmp/test.csv'
        } as multer.File;
        const delimiter = ',';
        const arrayKey = 'items';

        const result = await service.checkArrayCSVImport(mockFile, delimiter, arrayKey, 'folder-scanner');

        expect(fs.readFile).toHaveBeenCalledWith('/tmp/test.csv');
        expect(validateArrayCSVImport).toHaveBeenCalledWith(mockFileContent, delimiter, mockArrayAttribute, []);
        expect(result).toHaveProperty('items');
        expect(result).toHaveProperty('errors');
        expect(result.items).toHaveLength(2);
      });

      it('should validate CSV import when array attribute is nested in a settings object attribute', async () => {
        const mockFileContent = 'fieldName\ntest1\ntest2';
        (fs.readFile as jest.Mock).mockResolvedValue(Buffer.from(mockFileContent));
        (validateArrayCSVImport as jest.Mock).mockReturnValue({
          items: [{ fieldName: 'test1' }, { fieldName: 'test2' }],
          errors: []
        });

        const nestedArrayAttribute = {
          type: 'array' as const,
          key: 'dateTimeFields',
          translationKey: 'test.dateTimeFields',
          validators: [],
          rootAttribute: {
            type: 'object' as const,
            key: 'dateTimeField',
            translationKey: 'test.dateTimeField',
            validators: [],
            attributes: [
              {
                type: 'string' as const,
                key: 'fieldName',
                translationKey: 'test.fieldName',
                validators: [],
                defaultValue: null,
                displayProperties: { visible: true, wrapInBox: false, row: 0, columns: 12, displayInViewMode: true }
              }
            ],
            enablingConditions: [],
            displayProperties: { visible: true, wrapInBox: false }
          },
          paginate: false,
          numberOfElementPerPage: 25
        };

        const manifestWithNestedArray = {
          ...mockManifest,
          settings: {
            ...mockManifest.settings,
            attributes: [
              {
                type: 'object' as const,
                key: 'nestedSettings',
                translationKey: 'test.nestedSettings',
                validators: [],
                enablingConditions: [],
                displayProperties: { visible: true, wrapInBox: false },
                attributes: [nestedArrayAttribute]
              }
            ]
          }
        } as SouthConnectorManifest;

        jest.spyOn(service, 'getInstalledSouthManifests').mockReturnValue([manifestWithNestedArray]);

        const mockFile = {
          path: '/tmp/test.csv'
        } as multer.File;
        const delimiter = ',';
        const arrayKey = 'dateTimeFields';

        const result = await service.checkArrayCSVImport(mockFile, delimiter, arrayKey, 'folder-scanner');

        expect(fs.readFile).toHaveBeenCalledWith('/tmp/test.csv');
        expect(validateArrayCSVImport).toHaveBeenCalledWith(mockFileContent, delimiter, nestedArrayAttribute, []);
        expect(result).toHaveProperty('items');
        expect(result).toHaveProperty('errors');
        expect(result.items).toHaveLength(2);
      });

      it('should validate CSV import when array attribute is nested deep in items rootAttribute', async () => {
        const mockFileContent = 'fieldName\ntest1\ntest2';
        (fs.readFile as jest.Mock).mockResolvedValue(Buffer.from(mockFileContent));
        (validateArrayCSVImport as jest.Mock).mockReturnValue({
          items: [{ fieldName: 'test1' }, { fieldName: 'test2' }],
          errors: []
        });

        const nestedArrayAttribute = {
          type: 'array' as const,
          key: 'dateTimeFields',
          translationKey: 'test.dateTimeFields',
          validators: [],
          rootAttribute: {
            type: 'object' as const,
            key: 'dateTimeField',
            translationKey: 'test.dateTimeField',
            validators: [],
            attributes: [
              {
                type: 'string' as const,
                key: 'fieldName',
                translationKey: 'test.fieldName',
                validators: [],
                defaultValue: null,
                displayProperties: { visible: true, wrapInBox: false, row: 0, columns: 12, displayInViewMode: true }
              }
            ],
            enablingConditions: [],
            displayProperties: { visible: true, wrapInBox: false }
          },
          paginate: false,
          numberOfElementPerPage: 25
        };

        const manifestWithDeepNestedArray = {
          ...mockManifest,
          settings: {
            ...mockManifest.settings,
            attributes: []
          },
          items: {
            ...mockManifest.items!,
            rootAttribute: {
              ...mockManifest.items!.rootAttribute,
              attributes: [
                {
                  type: 'object' as const,
                  key: 'settings',
                  translationKey: 'test.settings',
                  validators: [],
                  enablingConditions: [],
                  displayProperties: { visible: true, wrapInBox: false },
                  attributes: [nestedArrayAttribute]
                }
              ]
            }
          }
        } as SouthConnectorManifest;

        jest.spyOn(service, 'getInstalledSouthManifests').mockReturnValue([manifestWithDeepNestedArray]);

        const mockFile = {
          path: '/tmp/test.csv'
        } as multer.File;
        const delimiter = ',';
        const arrayKey = 'dateTimeFields';

        const result = await service.checkArrayCSVImport(mockFile, delimiter, arrayKey, 'folder-scanner');

        expect(fs.readFile).toHaveBeenCalledWith('/tmp/test.csv');
        expect(validateArrayCSVImport).toHaveBeenCalledWith(mockFileContent, delimiter, nestedArrayAttribute, []);
        expect(result).toHaveProperty('items');
        expect(result).toHaveProperty('errors');
        expect(result.items).toHaveLength(2);
      });

      it('should throw error if south manifest not found', async () => {
        jest.spyOn(service, 'getInstalledSouthManifests').mockReturnValue([]);

        const mockFile = {
          path: '/tmp/test.csv'
        } as multer.File;
        const delimiter = ',';
        const arrayKey = 'items';

        await expect(service.checkArrayCSVImport(mockFile, delimiter, arrayKey, 'nonexistent-type' as OIBusSouthType)).rejects.toThrow(
          'South manifest "nonexistent-type" not found'
        );
      });

      it('should throw error if array field is nested but key matches a non-array field', async () => {
        const manifestWithNonArrayInNested = {
          ...mockManifest,
          settings: {
            ...mockManifest.settings,
            attributes: [
              {
                type: 'object' as const,
                key: 'nestedSettings',
                translationKey: 'test.nestedSettings',
                validators: [],
                enablingConditions: [],
                displayProperties: { visible: true, wrapInBox: false },
                attributes: [
                  {
                    type: 'string' as const,
                    key: 'dateTimeFields',
                    translationKey: 'test.dateTimeFields',
                    validators: [],
                    defaultValue: null,
                    displayProperties: { row: 0, columns: 12, displayInViewMode: true }
                  }
                ]
              }
            ]
          }
        } as unknown as SouthConnectorManifest;

        jest.spyOn(service, 'getInstalledSouthManifests').mockReturnValue([manifestWithNonArrayInNested]);

        const mockFile = {
          path: '/tmp/test.csv'
        } as multer.File;
        const delimiter = ',';
        const arrayKey = 'dateTimeFields';

        await expect(service.checkArrayCSVImport(mockFile, delimiter, arrayKey, 'folder-scanner')).rejects.toThrow(
          'Field "dateTimeFields" is not an array'
        );
      });

      it('should continue searching after checking nested object that does not contain the array', async () => {
        const mockFileContent = 'name\ntest1\ntest2';
        (fs.readFile as jest.Mock).mockResolvedValue(Buffer.from(mockFileContent));
        (validateArrayCSVImport as jest.Mock).mockReturnValue({
          items: [{ name: 'test1' }, { name: 'test2' }],
          errors: []
        });

        const mockFile = {
          path: '/tmp/test.csv'
        } as multer.File;
        const delimiter = ',';
        const arrayKey = 'items';

        const manifestWithNestedObjectFirst = {
          ...mockManifest,
          settings: {
            ...mockManifest.settings,
            attributes: [
              {
                type: 'object' as const,
                key: 'otherSettings',
                translationKey: 'test.otherSettings',
                validators: [],
                enablingConditions: [],
                displayProperties: { visible: true, wrapInBox: false },
                attributes: [
                  {
                    type: 'string' as const,
                    key: 'otherField',
                    translationKey: 'test.otherField',
                    validators: [],
                    defaultValue: null,
                    displayProperties: { row: 0, columns: 12, displayInViewMode: true }
                  }
                ]
              },
              mockArrayAttribute
            ]
          }
        } as SouthConnectorManifest;

        jest.spyOn(service, 'getInstalledSouthManifests').mockReturnValue([manifestWithNestedObjectFirst]);

        const result = await service.checkArrayCSVImport(mockFile, delimiter, arrayKey, 'folder-scanner');

        expect(fs.readFile).toHaveBeenCalledWith('/tmp/test.csv');
        expect(validateArrayCSVImport).toHaveBeenCalledWith(mockFileContent, delimiter, mockArrayAttribute, []);
        expect(result).toHaveProperty('items');
        expect(result).toHaveProperty('errors');
      });

      it('should handle manifest without items', async () => {
        const mockFile = {
          path: '/tmp/test.csv'
        } as multer.File;
        const delimiter = ',';
        const arrayKey = 'nonexistent';

        const manifestWithoutItems = {
          ...mockManifest,
          items: undefined
        } as unknown as SouthConnectorManifest;

        jest.spyOn(service, 'getInstalledSouthManifests').mockReturnValue([manifestWithoutItems]);

        await expect(service.checkArrayCSVImport(mockFile, delimiter, arrayKey, 'folder-scanner')).rejects.toThrow(
          'Array field "nonexistent" not found in manifest'
        );
      });

      it('should handle manifest with items but without rootAttribute', async () => {
        const mockFile = {
          path: '/tmp/test.csv'
        } as multer.File;
        const delimiter = ',';
        const arrayKey = 'nonexistent';

        const manifestWithoutRootAttribute = {
          ...mockManifest,
          items: {
            type: 'array' as const,
            key: 'items',
            translationKey: 'test.items',
            validators: [],
            rootAttribute: undefined,
            paginate: false,
            numberOfElementPerPage: 25
          }
        } as unknown as SouthConnectorManifest;

        jest.spyOn(service, 'getInstalledSouthManifests').mockReturnValue([manifestWithoutRootAttribute]);

        await expect(service.checkArrayCSVImport(mockFile, delimiter, arrayKey, 'folder-scanner')).rejects.toThrow(
          'Array field "nonexistent" not found in manifest'
        );
      });

      it('should pass existingItems to validateArrayCSVImport', async () => {
        const mockFileContent = 'name\ntest1\ntest2';
        (fs.readFile as jest.Mock).mockResolvedValue(Buffer.from(mockFileContent));
        (validateArrayCSVImport as jest.Mock).mockReturnValue({
          items: [{ name: 'test1' }, { name: 'test2' }],
          errors: []
        });

        const existingItems = [{ name: 'existing1' }];
        const mockFile = {
          path: '/tmp/test.csv'
        } as multer.File;
        const delimiter = ',';
        const arrayKey = 'items';

        const result = await service.checkArrayCSVImport(mockFile, delimiter, arrayKey, 'folder-scanner', existingItems);

        expect(validateArrayCSVImport).toHaveBeenCalledWith(mockFileContent, delimiter, mockArrayAttribute, existingItems);
        expect(result).toHaveProperty('items');
        expect(result).toHaveProperty('errors');
      });
    });

    describe('getArrayFieldItemsFromDatabase', () => {
      it('should return array from main connector settings', () => {
        const southId = 'test-south-id';
        const arrayKey = 'items';
        const arrayData = [{ name: 'item1' }, { name: 'item2' }];

        const southConnector = {
          ...testData.south.list[0],
          settings: {
            ...testData.south.list[0].settings,
            [arrayKey]: arrayData
          }
        };

        (southConnectorRepository.findSouthById as jest.Mock).mockReturnValueOnce(southConnector);

        const result = service.getArrayFieldItemsFromDatabase(southId, arrayKey);

        expect(result).toEqual(arrayData);
        expect(southConnectorRepository.findSouthById).toHaveBeenCalledWith(southId);
      });

      it('should return array from item settings when not in main settings', () => {
        const southId = 'test-south-id';
        const arrayKey = 'dateTimeFields';
        const arrayData1 = [{ fieldName: 'field1' }];
        const arrayData2 = [{ fieldName: 'field2' }];

        const southConnector = {
          ...testData.south.list[0],
          settings: {
            ...testData.south.list[0].settings
          }
        };

        const item1Settings = {
          ...testData.south.list[0].items[0].settings,
          [arrayKey]: arrayData1
        };
        const item2Settings = {
          ...testData.south.list[0].items[0].settings,
          [arrayKey]: arrayData2
        };

        const items = [
          {
            ...testData.south.list[0].items[0],
            settings: item1Settings
          },
          {
            ...testData.south.list[0].items[0],
            settings: item2Settings
          }
        ];

        (southConnectorRepository.findSouthById as jest.Mock).mockReturnValueOnce(southConnector);
        jest.spyOn(service, 'getSouthItems').mockReturnValueOnce(items as unknown as ReturnType<typeof service.getSouthItems>);

        const result = service.getArrayFieldItemsFromDatabase(southId, arrayKey);

        expect(result).toEqual([...arrayData1, ...arrayData2]);
        expect(service.getSouthItems).toHaveBeenCalledWith(southId);
      });

      it('should return empty array when array field not found in settings or items', () => {
        const southId = 'test-south-id';
        const arrayKey = 'nonexistent';

        const southConnector = {
          ...testData.south.list[0],
          settings: {
            ...testData.south.list[0].settings
          }
        };

        (southConnectorRepository.findSouthById as jest.Mock).mockReturnValueOnce(southConnector);
        jest.spyOn(service, 'getSouthItems').mockReturnValueOnce([]);

        const result = service.getArrayFieldItemsFromDatabase(southId, arrayKey);

        expect(result).toEqual([]);
      });

      it('should skip items where arrayKey exists but is not an array', () => {
        const southId = 'test-south-id';
        const arrayKey = 'items';
        const arrayData = [{ name: 'item1' }];

        const southConnector = {
          ...testData.south.list[0],
          settings: {
            ...testData.south.list[0].settings
          }
        };

        const items = [
          {
            ...testData.south.list[0].items[0],
            settings: {
              ...testData.south.list[0].items[0].settings,
              [arrayKey]: arrayData
            }
          },
          {
            ...testData.south.list[0].items[0],
            settings: {
              ...testData.south.list[0].items[0].settings,
              [arrayKey]: 'not an array' // This should be skipped
            }
          },
          {
            ...testData.south.list[0].items[0],
            settings: {
              ...testData.south.list[0].items[0].settings,
              [arrayKey]: 123 // This should be skipped
            }
          }
        ];

        (southConnectorRepository.findSouthById as jest.Mock).mockReturnValueOnce(southConnector);
        jest.spyOn(service, 'getSouthItems').mockReturnValueOnce(items as unknown as ReturnType<typeof service.getSouthItems>);

        const result = service.getArrayFieldItemsFromDatabase(southId, arrayKey);

        expect(result).toEqual(arrayData);
        expect(service.getSouthItems).toHaveBeenCalledWith(southId);
      });

      it('should filter out null and non-object items', () => {
        const southId = 'test-south-id';
        const arrayKey = 'items';
        const arrayData = [{ name: 'item1' }, null, 'string', { name: 'item2' }, 123];

        const southConnector = {
          ...testData.south.list[0],
          settings: {
            ...testData.south.list[0].settings,
            [arrayKey]: arrayData
          }
        };

        (southConnectorRepository.findSouthById as jest.Mock).mockReturnValueOnce(southConnector);

        const result = service.getArrayFieldItemsFromDatabase(southId, arrayKey);

        expect(result).toEqual([{ name: 'item1' }, { name: 'item2' }]);
      });

      it('should throw error if south connector not found', () => {
        const southId = 'nonexistent';
        const arrayKey = 'items';

        (southConnectorRepository.findSouthById as jest.Mock).mockReturnValueOnce(null);

        expect(() => service.getArrayFieldItemsFromDatabase(southId, arrayKey)).toThrow('South connector "nonexistent" does not exist');
      });
    });

    describe('checkArrayFileImport', () => {
      it('should validate CSV import with existing items', async () => {
        const mockFileContent = 'name\ntest1\ntest2';
        (fs.readFile as jest.Mock).mockResolvedValue(Buffer.from(mockFileContent));
        (validateArrayCSVImport as jest.Mock).mockReturnValue({
          items: [{ name: 'test1' }, { name: 'test2' }],
          errors: []
        });

        const southId = 'test-south-id';
        const arrayKey = 'items';
        const existingItems = [{ name: 'existing' }];
        const mockFile = {
          path: '/tmp/test.csv'
        } as multer.File;
        const delimiter = ',';

        const southConnector = testData.south.list[0];
        (southConnectorRepository.findSouthById as jest.Mock).mockReturnValueOnce(southConnector);
        jest.spyOn(service, 'getArrayFieldItemsFromDatabase').mockReturnValueOnce(existingItems);

        const result = await service.checkArrayFileImport(southId, mockFile, delimiter, arrayKey);

        expect(southConnectorRepository.findSouthById).toHaveBeenCalledWith(southId);
        expect(service.getArrayFieldItemsFromDatabase).toHaveBeenCalledWith(southId, arrayKey);
        expect(fs.readFile).toHaveBeenCalledWith('/tmp/test.csv');
        expect(validateArrayCSVImport).toHaveBeenCalledWith(mockFileContent, delimiter, mockArrayAttribute, existingItems);
        expect(result).toHaveProperty('items');
        expect(result).toHaveProperty('errors');
      });

      it('should throw error if south connector not found', async () => {
        const southId = 'nonexistent';
        const arrayKey = 'items';
        const mockFile = {
          path: '/tmp/test.csv'
        } as multer.File;
        const delimiter = ',';

        (southConnectorRepository.findSouthById as jest.Mock).mockReturnValueOnce(null);

        await expect(service.checkArrayFileImport(southId, mockFile, delimiter, arrayKey)).rejects.toThrow(
          'South connector "nonexistent" does not exist'
        );
      });
    });

    describe('importArrayField', () => {
      it('should import array field', async () => {
        const southId = 'test-south-id';
        const arrayKey = 'items';
        const items = [{ name: 'test1' }, { name: 'test2' }];

        (southConnectorRepository.findSouthById as jest.Mock).mockReturnValueOnce(testData.south.list[0]);

        await service.importArrayField(southId, arrayKey, items);

        expect(southConnectorRepository.saveSouthConnector).toHaveBeenCalledWith({
          ...testData.south.list[0],
          settings: {
            ...testData.south.list[0].settings,
            [arrayKey]: items
          }
        });
      });

      it('should throw error if south connector not found', async () => {
        const southId = 'nonexistent';
        const arrayKey = 'items';
        const items = [{ name: 'test1' }];

        (southConnectorRepository.findSouthById as jest.Mock).mockReturnValueOnce(null);

        await expect(service.importArrayField(southId, arrayKey, items)).rejects.toThrow('South connector "nonexistent" does not exist');
      });
    });
  });
});
