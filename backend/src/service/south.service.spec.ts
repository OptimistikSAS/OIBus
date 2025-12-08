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
import { buildSouth } from '../south/south-connector-factory';
import { NotFoundError, OIBusValidationError } from '../model/types';
import csv from 'papaparse';
import { stringToBoolean } from './utils';
import { SouthConnectorEntityLight } from '../model/south-connector.model';

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
      throw new Error(`validation error`);
    });

    const result = await service.checkImportItems(testData.south.list[0].type, 'file content', ',', testData.south.list[0].items as any);
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
    const result = await service.checkImportItems(testData.south.list[1].type, 'file content', ',', testData.south.list[1].items as any);
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
});
