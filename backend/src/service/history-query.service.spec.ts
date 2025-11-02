import EncryptionServiceMock from '../tests/__mocks__/service/encryption-service.mock';
import HistoryQueryService, { toHistoryQueryDTO, toHistoryQueryItemDTO, toHistoryQueryLightDTO } from './history-query.service';
import ScanModeRepository from '../repository/config/scan-mode.repository';
import ScanModeRepositoryMock from '../tests/__mocks__/repository/config/scan-mode-repository.mock';
import HistoryQueryRepository from '../repository/config/history-query.repository';
import HistoryQueryRepositoryMock from '../tests/__mocks__/repository/config/history-query-repository.mock';
import LogRepository from '../repository/logs/log.repository';
import LogRepositoryMock from '../tests/__mocks__/repository/log/log-repository.mock';
import SouthService, { southManifestList } from './south.service';
import NorthService, { northManifestList } from './north.service';
import pino from 'pino';
import SouthServiceMock from '../tests/__mocks__/service/south-service.mock';
import NorthServiceMock from '../tests/__mocks__/service/north-service.mock';
import OIAnalyticsMessageService from './oia/oianalytics-message.service';
import OIAnalyticsMessageServiceMock from '../tests/__mocks__/service/oia/oianalytics-message-service.mock';
import JoiValidator from '../web-server/controllers/validators/joi.validator';
import HistoryQueryMetricsRepository from '../repository/metrics/history-query-metrics.repository';
import HistoryQueryMetricsRepositoryMock from '../tests/__mocks__/repository/metrics/history-query-metrics-repository.mock';
import PinoLogger from '../tests/__mocks__/service/logger/logger.mock';
import testData from '../tests/utils/test-data';
import csv from 'papaparse';
import SouthConnectorRepository from '../repository/config/south-connector.repository';
import NorthConnectorRepository from '../repository/config/north-connector.repository';
import SouthConnectorRepositoryMock from '../tests/__mocks__/repository/config/south-connector-repository.mock';
import NorthConnectorRepositoryMock from '../tests/__mocks__/repository/config/north-connector-repository.mock';
import TransformerService from './transformer.service';
import TransformerServiceMock from '../tests/__mocks__/service/transformer-service.mock';
import DataStreamEngine from '../engine/data-stream-engine';
import DataStreamEngineMock from '../tests/__mocks__/data-stream-engine.mock';
import { TransformerDTO } from '../../shared/model/transformer.model';
import { stringToBoolean } from './utils';
import { HistoryQueryEntityLight } from '../model/histor-query.model';
import { NotFoundError, OIBusValidationError } from '../model/types';
import manifest from '../south/south-mssql/manifest';

jest.mock('papaparse');
jest.mock('node:fs/promises');
jest.mock('../web-server/controllers/validators/joi.validator');
jest.mock('./utils');
jest.mock('./encryption.service', () => ({
  encryptionService: new EncryptionServiceMock('', '')
}));
jest.mock('./transformer.service', () => ({
  toTransformerDTO: jest.fn().mockImplementation(transformer => transformer)
}));

const validator = new JoiValidator();
const logger: pino.Logger = new PinoLogger();
const historyQueryRepository: HistoryQueryRepository = new HistoryQueryRepositoryMock();
const northConnectorRepository: NorthConnectorRepository = new NorthConnectorRepositoryMock();
const southConnectorRepository: SouthConnectorRepository = new SouthConnectorRepositoryMock();
const scanModeRepository: ScanModeRepository = new ScanModeRepositoryMock();
const logRepository: LogRepository = new LogRepositoryMock();
const historyQueryMetricsRepository: HistoryQueryMetricsRepository = new HistoryQueryMetricsRepositoryMock();
const southService: SouthService = new SouthServiceMock();
const northService: NorthService = new NorthServiceMock();
const oIAnalyticsMessageService: OIAnalyticsMessageService = new OIAnalyticsMessageServiceMock();
const engine: DataStreamEngine = new DataStreamEngineMock(logger);
const transformerService: TransformerService = new TransformerServiceMock();

let service: HistoryQueryService;
describe('History Query service', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    (northService.getManifest as jest.Mock).mockReturnValue(northManifestList[4]); // file-writer
    (northService.findById as jest.Mock).mockReturnValue(testData.north.list[0]);
    (southService.getManifest as jest.Mock).mockReturnValue(southManifestList[0]); // folder-scanner
    (southService.findById as jest.Mock).mockReturnValue(testData.south.list[0]);
    (historyQueryRepository.findHistoryQueryById as jest.Mock).mockReturnValue(testData.historyQueries.list[0]);
    (historyQueryRepository.findHistoryQueryItemById as jest.Mock).mockReturnValue(testData.historyQueries.list[0].items[0]);
    (transformerService.findAll as jest.Mock).mockReturnValue(testData.transformers.list);
    (scanModeRepository.findAll as jest.Mock).mockReturnValue(testData.scanMode.list);
    (stringToBoolean as jest.Mock).mockReturnValue(true);

    service = new HistoryQueryService(
      validator,
      historyQueryRepository,
      northConnectorRepository,
      southConnectorRepository,
      scanModeRepository,
      logRepository,
      historyQueryMetricsRepository,
      southService,
      northService,
      transformerService,
      oIAnalyticsMessageService,
      engine
    );
  });

  it('should get all History queries', () => {
    (historyQueryRepository.findAllHistoryQueriesLight as jest.Mock).mockReturnValueOnce([]);
    const result = service.list();
    expect(historyQueryRepository.findAllHistoryQueriesLight).toHaveBeenCalledTimes(1);
    expect(result).toEqual([]);
  });

  it('should get a History query', () => {
    const result = service.findById(testData.historyQueries.list[0].id);
    expect(historyQueryRepository.findHistoryQueryById).toHaveBeenCalledTimes(1);
    expect(historyQueryRepository.findHistoryQueryById).toHaveBeenCalledWith(testData.historyQueries.list[0].id);
    expect(result).toEqual(testData.historyQueries.list[0]);
  });

  it('should throw not found error if history query does not exist', () => {
    (historyQueryRepository.findHistoryQueryById as jest.Mock).mockReturnValueOnce(null);

    expect(() => service.findById(testData.historyQueries.list[0].id)).toThrow(
      new NotFoundError(`History query "${testData.historyQueries.list[0].id}" not found`)
    );
    expect(historyQueryRepository.findHistoryQueryById).toHaveBeenCalledWith(testData.historyQueries.list[0].id);
  });

  it('should create a history query', async () => {
    service.retrieveSecrets = jest.fn();

    await service.create(testData.historyQueries.command, testData.south.list[0].id, undefined, undefined);
    expect(service.retrieveSecrets).toHaveBeenCalledTimes(1);
    expect(historyQueryRepository.saveHistoryQuery).toHaveBeenCalledTimes(1);
    expect(oIAnalyticsMessageService.createFullHistoryQueriesMessageIfNotPending).toHaveBeenCalledTimes(1);
    expect(engine.createHistoryQuery).toHaveBeenCalledTimes(1);
  });

  it('should fail to create a history query when transformer is not found', async () => {
    (transformerService.findAll as jest.Mock).mockReturnValueOnce([]);
    service.retrieveSecrets = jest.fn();

    await expect(service.create(testData.historyQueries.command, undefined, undefined, undefined)).rejects.toThrow(
      `Could not find OIBus Transformer "${testData.transformers.list[0].id}"`
    );
  });

  it('should update a history query', async () => {
    await service.update(testData.historyQueries.list[0].id, testData.historyQueries.command, false);

    expect(historyQueryRepository.saveHistoryQuery).toHaveBeenCalledTimes(1);
    expect(oIAnalyticsMessageService.createFullHistoryQueriesMessageIfNotPending).toHaveBeenCalledTimes(1);
    expect(engine.reloadHistoryQuery).toHaveBeenCalledTimes(1);
  });

  it('should delete history query', async () => {
    await service.delete(testData.historyQueries.list[0].id);

    expect(engine.deleteHistoryQuery).toHaveBeenCalledWith(testData.historyQueries.list[0]);
    expect(historyQueryRepository.deleteHistoryQuery).toHaveBeenCalledWith(testData.historyQueries.list[0].id);
    expect(historyQueryMetricsRepository.removeMetrics).toHaveBeenCalledWith(testData.historyQueries.list[0].id);
    expect(oIAnalyticsMessageService.createFullHistoryQueriesMessageIfNotPending).toHaveBeenCalled();
  });

  it('should start history query', async () => {
    await service.start(testData.historyQueries.list[0].id);

    expect(historyQueryRepository.updateHistoryQueryStatus).toHaveBeenCalledWith(testData.historyQueries.list[0].id, 'RUNNING');
    expect(oIAnalyticsMessageService.createFullHistoryQueriesMessageIfNotPending).toHaveBeenCalledTimes(1);
    expect(engine.reloadHistoryQuery).toHaveBeenCalledWith(testData.historyQueries.list[0], false);
  });

  it('should pause history query', async () => {
    await service.pause(testData.historyQueries.list[0].id);

    expect(historyQueryRepository.updateHistoryQueryStatus).toHaveBeenCalledWith(testData.historyQueries.list[0].id, 'PAUSED');
    expect(oIAnalyticsMessageService.createFullHistoryQueriesMessageIfNotPending).toHaveBeenCalledTimes(1);
    expect(engine.stopHistoryQuery).toHaveBeenCalledWith(testData.historyQueries.list[0].id);
  });

  it('should get history query data stream', () => {
    service.getHistoryDataStream(testData.historyQueries.list[0].id);

    expect(engine.getHistoryQueryDataStream).toHaveBeenCalledWith(testData.historyQueries.list[0].id);
  });

  it('should test north connection in creation mode', async () => {
    await service.testNorth('create', testData.north.command.type, undefined, testData.north.command.settings);

    expect(northService.testNorth).toHaveBeenCalledWith('create', testData.north.command.type, testData.north.command.settings);
  });

  it('should test north connection in creation mode and retrieve secrets', async () => {
    await service.testNorth('create', testData.north.command.type, testData.north.list[0].id, testData.north.command.settings);

    expect(northService.testNorth).toHaveBeenCalledWith('create', testData.north.command.type, testData.north.command.settings);
  });

  it('should test north connection in edit mode', async () => {
    await service.testNorth(testData.historyQueries.list[0].id, testData.north.command.type, undefined, testData.north.command.settings);

    expect(northService.testNorth).toHaveBeenCalledWith(
      testData.historyQueries.list[0].id,
      testData.north.command.type,
      testData.north.command.settings
    );
  });

  it('should test south connection in creation mode', async () => {
    await service.testSouth('create', testData.south.command.type, undefined, testData.south.command.settings);

    expect(southService.testSouth).toHaveBeenCalledWith('create', testData.south.command.type, testData.south.command.settings);
  });

  it('should test south connection in creation mode and retrieve secrets', async () => {
    await service.testSouth('create', testData.south.command.type, testData.south.list[0].id, testData.south.command.settings);

    expect(southService.testSouth).toHaveBeenCalledWith('create', testData.south.command.type, testData.south.command.settings);
  });

  it('should test south connection in edit mode', async () => {
    await service.testSouth(testData.historyQueries.list[0].id, testData.south.command.type, undefined, testData.south.command.settings);

    expect(southService.testSouth).toHaveBeenCalledWith(
      testData.historyQueries.list[0].id,
      testData.south.command.type,
      testData.south.command.settings
    );
  });

  it('should test item in creation mode', async () => {
    const callback = jest.fn();
    await service.testItem(
      'create',
      testData.south.command.type,
      testData.south.itemCommand.name,
      undefined,
      testData.south.command.settings,
      testData.south.itemCommand.settings,
      testData.south.itemTestingSettings,
      callback
    );

    expect(southService.testItem).toHaveBeenCalledWith(
      'create',
      testData.south.command.type,
      testData.south.itemCommand.name,
      testData.south.command.settings,
      testData.south.itemCommand.settings,
      testData.south.itemTestingSettings,
      callback
    );
  });

  it('should test item in creation mode and retrieve secrets', async () => {
    const callback = jest.fn();
    await service.testItem(
      'create',
      testData.south.command.type,
      testData.south.itemCommand.name,
      testData.south.list[0].id,
      testData.south.command.settings,
      testData.south.itemCommand.settings,
      testData.south.itemTestingSettings,
      callback
    );

    expect(southService.testItem).toHaveBeenCalledWith(
      'create',
      testData.south.command.type,
      testData.south.itemCommand.name,
      testData.south.command.settings,
      testData.south.itemCommand.settings,
      testData.south.itemTestingSettings,
      callback
    );
  });

  it('should test item in edit mode', async () => {
    const callback = jest.fn();
    await service.testItem(
      testData.historyQueries.list[0].id,
      testData.south.command.type,
      testData.south.itemCommand.name,
      undefined,
      testData.south.command.settings,
      testData.south.itemCommand.settings,
      testData.south.itemTestingSettings,
      callback
    );

    expect(southService.testItem).toHaveBeenCalled();
  });

  it('should list items', async () => {
    service.listItems(testData.historyQueries.list[0].id);
    expect(historyQueryRepository.findAllItemsForHistoryQuery).toHaveBeenCalledWith(testData.historyQueries.list[0].id);
  });

  it('should search items', async () => {
    service.searchItems(testData.historyQueries.list[0].id, {});
    expect(historyQueryRepository.searchHistoryQueryItems).toHaveBeenCalledWith(testData.historyQueries.list[0].id, {});
  });

  it('should find an item', async () => {
    service.findItemById(testData.historyQueries.list[0].id, testData.historyQueries.list[0].items[0].id);

    expect(historyQueryRepository.findHistoryQueryItemById).toHaveBeenCalledWith(
      testData.historyQueries.list[0].id,
      testData.historyQueries.list[0].items[0].id
    );
  });

  it('should throw not found error if item does not exist', async () => {
    (historyQueryRepository.findHistoryQueryItemById as jest.Mock).mockReturnValueOnce(null);

    expect(() => service.findItemById(testData.historyQueries.list[0].id, testData.historyQueries.list[0].items[0].id)).toThrow(
      new NotFoundError(`Item "${testData.historyQueries.list[0].items[0].id}" not found`)
    );

    expect(historyQueryRepository.findHistoryQueryItemById).toHaveBeenCalledWith(
      testData.historyQueries.list[0].id,
      testData.historyQueries.list[0].items[0].id
    );
  });

  it('should create an item', async () => {
    await service.createItem(testData.historyQueries.list[0].id, testData.historyQueries.itemCommand);

    expect(historyQueryRepository.findHistoryQueryById).toHaveBeenCalledWith(testData.historyQueries.list[0].id);
    expect(historyQueryRepository.saveHistoryQueryItem).toHaveBeenCalledTimes(1);
    expect(oIAnalyticsMessageService.createFullHistoryQueriesMessageIfNotPending).toHaveBeenCalledTimes(1);
    expect(engine.reloadHistoryQuery).toHaveBeenCalledWith(testData.historyQueries.list[0], false);
  });

  it('should update an item', async () => {
    await service.updateItem(
      testData.historyQueries.list[0].id,
      testData.historyQueries.list[0].items[0].id,
      testData.historyQueries.itemCommand
    );

    expect(historyQueryRepository.findHistoryQueryItemById).toHaveBeenCalledWith(
      testData.historyQueries.list[0].id,
      testData.historyQueries.list[0].items[0].id
    );
    expect(historyQueryRepository.saveHistoryQueryItem).toHaveBeenCalledTimes(1);
    expect(oIAnalyticsMessageService.createFullHistoryQueriesMessageIfNotPending).toHaveBeenCalledTimes(1);
    expect(engine.reloadHistoryQuery).toHaveBeenCalledWith(testData.historyQueries.list[0], false);
  });

  it('should enable an item', async () => {
    await service.enableItem(testData.historyQueries.list[0].id, testData.historyQueries.list[0].items[0].id);

    expect(historyQueryRepository.findHistoryQueryItemById).toHaveBeenCalledWith(
      testData.historyQueries.list[0].id,
      testData.historyQueries.list[0].items[0].id
    );
    expect(historyQueryRepository.enableHistoryQueryItem).toHaveBeenCalledWith(testData.historyQueries.list[0].items[0].id);
    expect(oIAnalyticsMessageService.createFullHistoryQueriesMessageIfNotPending).toHaveBeenCalledTimes(1);
    expect(engine.reloadHistoryQuery).toHaveBeenCalledWith(testData.historyQueries.list[0], false);
  });

  it('should disable an item', async () => {
    await service.disableItem(testData.historyQueries.list[0].id, testData.historyQueries.list[0].items[0].id);

    expect(historyQueryRepository.findHistoryQueryItemById).toHaveBeenCalledWith(
      testData.historyQueries.list[0].id,
      testData.historyQueries.list[0].items[0].id
    );
    expect(historyQueryRepository.disableHistoryQueryItem).toHaveBeenCalledWith(testData.historyQueries.list[0].items[0].id);
    expect(oIAnalyticsMessageService.createFullHistoryQueriesMessageIfNotPending).toHaveBeenCalledTimes(1);
    expect(engine.reloadHistoryQuery).toHaveBeenCalledWith(testData.historyQueries.list[0], false);
  });

  it('should enable multiple history query items', async () => {
    const historyQueryId = testData.historyQueries.list[0].id;
    const itemIds = [testData.historyQueries.list[0].items[0].id, testData.historyQueries.list[0].items[1].id];

    (historyQueryRepository.findHistoryQueryById as jest.Mock).mockReturnValue(testData.historyQueries.list[0]);
    (historyQueryRepository.findHistoryQueryItemById as jest.Mock)
      .mockReturnValueOnce(testData.historyQueries.list[0].items[0])
      .mockReturnValueOnce(testData.historyQueries.list[0].items[1]);

    await service.enableItems(historyQueryId, itemIds);

    expect(historyQueryRepository.enableHistoryQueryItem).toHaveBeenCalledWith(testData.historyQueries.list[0].items[0].id);
    expect(historyQueryRepository.enableHistoryQueryItem).toHaveBeenCalledWith(testData.historyQueries.list[0].items[1].id);
    expect(oIAnalyticsMessageService.createFullHistoryQueriesMessageIfNotPending).toHaveBeenCalled();
    expect(engine.reloadHistoryQuery).toHaveBeenCalledWith(testData.historyQueries.list[0], false);
  });

  it('should disable multiple history query items', async () => {
    const historyQueryId = testData.historyQueries.list[0].id;
    const itemIds = [testData.historyQueries.list[0].items[0].id, testData.historyQueries.list[0].items[1].id];

    (historyQueryRepository.findHistoryQueryItemById as jest.Mock)
      .mockReturnValueOnce(testData.historyQueries.list[0].items[0])
      .mockReturnValueOnce(testData.historyQueries.list[0].items[1]);

    await service.disableItems(historyQueryId, itemIds);

    expect(historyQueryRepository.disableHistoryQueryItem).toHaveBeenCalledWith(testData.historyQueries.list[0].items[0].id);
    expect(historyQueryRepository.disableHistoryQueryItem).toHaveBeenCalledWith(testData.historyQueries.list[0].items[1].id);
    expect(oIAnalyticsMessageService.createFullHistoryQueriesMessageIfNotPending).toHaveBeenCalled();
    expect(engine.reloadHistoryQuery).toHaveBeenCalledWith(testData.historyQueries.list[0], false);
  });

  it('should delete an item', async () => {
    await service.deleteItem(testData.historyQueries.list[0].id, testData.historyQueries.list[0].items[0].id);

    expect(historyQueryRepository.findHistoryQueryItemById).toHaveBeenCalledWith(
      testData.historyQueries.list[0].id,
      testData.historyQueries.list[0].items[0].id
    );
    expect(historyQueryRepository.deleteHistoryQueryItem).toHaveBeenCalledWith(testData.historyQueries.list[0].items[0].id);
    expect(oIAnalyticsMessageService.createFullHistoryQueriesMessageIfNotPending).toHaveBeenCalledTimes(1);
    expect(engine.reloadHistoryQuery).toHaveBeenCalledWith(testData.historyQueries.list[0], false);
  });

  it('should delete multiple history query items', async () => {
    const historyQueryId = testData.historyQueries.list[0].id;
    const itemIds = [testData.historyQueries.list[0].items[0].id, testData.historyQueries.list[0].items[1].id];

    (historyQueryRepository.findHistoryQueryItemById as jest.Mock)
      .mockReturnValueOnce(testData.historyQueries.list[0].items[0])
      .mockReturnValueOnce(testData.historyQueries.list[0].items[1]);

    await service.deleteItems(historyQueryId, itemIds);

    expect(historyQueryRepository.deleteHistoryQueryItem).toHaveBeenCalledWith(testData.historyQueries.list[0].items[0].id);
    expect(historyQueryRepository.deleteHistoryQueryItem).toHaveBeenCalledWith(testData.historyQueries.list[0].items[1].id);
    expect(oIAnalyticsMessageService.createFullHistoryQueriesMessageIfNotPending).toHaveBeenCalled();
    expect(engine.reloadHistoryQuery).toHaveBeenCalledWith(testData.historyQueries.list[0], false);
  });

  it('should delete all items', async () => {
    await service.deleteAllItems(testData.historyQueries.list[0].id);

    expect(historyQueryRepository.deleteAllHistoryQueryItemsByHistoryQuery).toHaveBeenCalledWith(testData.historyQueries.list[0].id);
    expect(oIAnalyticsMessageService.createFullHistoryQueriesMessageIfNotPending).toHaveBeenCalledTimes(1);
    expect(engine.reloadHistoryQuery).toHaveBeenCalledWith(testData.historyQueries.list[0], true);
  });

  it('should properly check items', async () => {
    const csvData = [
      {
        name: 'item1',
        enabled: 'true',
        settings_regex: '*',
        settings_preserveFiles: 'true',
        settings_ignoreModifiedDate: 'false',
        settings_minAge: 100
      },
      {
        name: 'item3',
        enabled: 'true',
        settings_regex: '*',
        settings_preserveFiles: 'true',
        settings_ignoreModifiedDate: 'false',
        settings_minAge: 100,
        settings_badItem: 100
      },
      {
        name: 'item4',
        enabled: 'true',
        settings_regex: '*',
        settings_preserveFiles: 'true',
        settings_ignoreModifiedDate: 12, // bad type
        settings_minAge: 100
      },
      {
        name: 'item5',
        enabled: 'true',
        settings_regex: '*',
        settings_preserveFiles: 'true',
        settings_ignoreModifiedDate: 'false',
        settings_minAge: 100
      }
    ];
    (csv.parse as jest.Mock).mockReturnValueOnce({
      meta: { delimiter: ',' },
      data: csvData
    });
    (validator.validateSettings as jest.Mock).mockImplementationOnce(() => {
      throw new Error(`validation error`);
    });

    const result = await service.checkImportItems(
      testData.historyQueries.command.southType,
      'file content',
      ',',
      testData.historyQueries.list[0].items
    );
    expect(result).toEqual({
      items: [
        {
          id: '',
          name: csvData[3].name,
          enabled: true,
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
            settings_ignoreModifiedDate: 'false',
            settings_minAge: 100,
            settings_preserveFiles: 'true',
            settings_regex: '*'
          }
        },
        {
          error: 'Settings "badItem" not accepted in manifest',
          item: {
            name: csvData[1].name,
            enabled: 'true',
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
            name: csvData[2].name,
            enabled: 'true',
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
    (southService.getManifest as jest.Mock).mockReturnValueOnce(manifest);
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
        })
      }
    ];
    (csv.parse as jest.Mock).mockReturnValueOnce({
      meta: { delimiter: ',' },
      data: csvData
    });
    const result = await service.checkImportItems(
      testData.historyQueries.command.southType,
      'file content',
      ',',
      testData.historyQueries.list[1].items
    );
    expect(result).toEqual({
      items: [
        {
          id: '',
          name: csvData[0].name,
          enabled: csvData[0].enabled.toLowerCase() === 'true',
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

    await expect(service.checkImportItems(testData.historyQueries.command.southType, '', ',', [])).rejects.toThrow(
      new OIBusValidationError(`The entered delimiter "," does not correspond to the file delimiter ";"`)
    );
  });

  it('should import items', async () => {
    await service.importItems(testData.historyQueries.list[0].id, [testData.historyQueries.itemCommand]);

    expect(historyQueryRepository.saveAllItems).toHaveBeenCalledTimes(1);
    expect(oIAnalyticsMessageService.createFullHistoryQueriesMessageIfNotPending).toHaveBeenCalledTimes(1);
    expect(engine.reloadHistoryQuery).toHaveBeenCalledWith(testData.historyQueries.list[0], false);
  });

  it('should add or edit transformer', async () => {
    const transformerWithOptions = {
      inputType: 'input',
      transformer: testData.transformers.list[0] as TransformerDTO,
      options: {}
    };

    await service.addOrEditTransformer(testData.historyQueries.list[0].id, transformerWithOptions);

    expect(historyQueryRepository.addOrEditTransformer).toHaveBeenCalledWith(testData.historyQueries.list[0].id, transformerWithOptions);
    expect(oIAnalyticsMessageService.createFullHistoryQueriesMessageIfNotPending).toHaveBeenCalled();
    expect(engine.stopHistoryQuery).toHaveBeenCalledWith(testData.historyQueries.list[0].id);
  });

  it('should remove transformer', async () => {
    await service.removeTransformer(testData.historyQueries.list[0].id, testData.transformers.list[0].id);

    expect(historyQueryRepository.removeTransformer).toHaveBeenCalledWith(
      testData.historyQueries.list[0].id,
      testData.transformers.list[0].id
    );
    expect(oIAnalyticsMessageService.createFullHistoryQueriesMessageIfNotPending).toHaveBeenCalled();
    expect(engine.stopHistoryQuery).toHaveBeenCalledWith(testData.historyQueries.list[0].id);
  });

  it('should search cache content', async () => {
    await service.searchCacheContent(
      testData.historyQueries.list[0].id,
      { start: testData.constants.dates.DATE_1, end: testData.constants.dates.DATE_2, nameContains: 'file' },
      'cache'
    );

    expect(engine.searchCacheContent).toHaveBeenCalledWith(
      'history',
      testData.historyQueries.list[0].id,
      { start: testData.constants.dates.DATE_1, end: testData.constants.dates.DATE_2, nameContains: 'file' },
      'cache'
    );
  });

  it('should get cache content file stream', async () => {
    (engine.getCacheContentFileStream as jest.Mock).mockReturnValueOnce('content');

    const result = await service.getCacheFileContent(testData.historyQueries.list[0].id, 'cache', 'filename');
    expect(result).toEqual('content');
    expect(engine.getCacheContentFileStream).toHaveBeenCalledWith('history', testData.historyQueries.list[0].id, 'cache', 'filename');
  });

  it('should throw an error if file not found with cache content', async () => {
    (engine.getCacheContentFileStream as jest.Mock).mockReturnValueOnce(null);

    await expect(service.getCacheFileContent(testData.historyQueries.list[0].id, 'cache', 'filename')).rejects.toThrow(
      new NotFoundError(`File "filename" not found in cache`)
    );

    expect(engine.getCacheContentFileStream).toHaveBeenCalledWith('history', testData.historyQueries.list[0].id, 'cache', 'filename');
  });

  it('should remove cache content', async () => {
    await service.removeCacheContent(testData.historyQueries.list[0].id, 'cache', ['filename']);
    expect(engine.removeCacheContent).toHaveBeenCalledWith('history', testData.historyQueries.list[0].id, 'cache', ['filename']);
  });

  it('should remove all cache content', async () => {
    await service.removeAllCacheContent(testData.historyQueries.list[0].id, 'cache');
    expect(engine.removeAllCacheContent).toHaveBeenCalledWith('history', testData.historyQueries.list[0].id, 'cache');
  });

  it('should move cache content', async () => {
    await service.moveCacheContent(testData.historyQueries.list[0].id, 'cache', 'error', ['filename']);
    expect(engine.moveCacheContent).toHaveBeenCalledWith('history', testData.historyQueries.list[0].id, 'cache', 'error', ['filename']);
  });

  it('should move all cache content', async () => {
    await service.moveAllCacheContent(testData.historyQueries.list[0].id, 'cache', 'archive');
    expect(engine.moveAllCacheContent).toHaveBeenCalledWith('history', testData.historyQueries.list[0].id, 'cache', 'archive');
  });

  it('should retrieve secrets from history query', () => {
    const historySource = JSON.parse(JSON.stringify(testData.historyQueries.list[0]));
    historySource.southType = southManifestList[4].id;
    historySource.northType = northManifestList[4].id;
    (historyQueryRepository.findHistoryQueryById as jest.Mock).mockReturnValueOnce(historySource);
    const result = service.retrieveSecrets(
      undefined,
      undefined,
      testData.historyQueries.list[0].id,
      southManifestList[4],
      northManifestList[4]
    );
    expect(historyQueryRepository.findHistoryQueryById).toHaveBeenCalledWith(testData.historyQueries.list[0].id);
    expect(result).toEqual(historySource);
  });

  it('should throw an error if history query south type does not match manifest', () => {
    const historySource = JSON.parse(JSON.stringify(testData.historyQueries.list[0]));
    historySource.southType = 'bad';
    (historyQueryRepository.findHistoryQueryById as jest.Mock).mockReturnValueOnce(historySource);

    expect(() =>
      service.retrieveSecrets(undefined, undefined, testData.historyQueries.list[0].id, southManifestList[4], northManifestList[4])
    ).toThrow(
      `History query "${historySource.id}" (South type "${historySource.southType}") must be of the South type "${southManifestList[4].id}"`
    );
  });

  it('should throw an error if history query north type does not match manifest', () => {
    const historySource = JSON.parse(JSON.stringify(testData.historyQueries.list[0]));
    historySource.southType = southManifestList[4].id;
    historySource.northType = 'bad';
    (historyQueryRepository.findHistoryQueryById as jest.Mock).mockReturnValueOnce(historySource);

    expect(() =>
      service.retrieveSecrets(undefined, undefined, testData.historyQueries.list[0].id, southManifestList[4], northManifestList[4])
    ).toThrow(
      `History query "${historySource.id}" (North type "${historySource.northType}") must be of the North type "${northManifestList[4].id}"`
    );
    expect(historyQueryRepository.findHistoryQueryById).toHaveBeenCalledWith(testData.historyQueries.list[0].id);
  });

  it('should retrieve secrets from south and north connectors', () => {
    (southService.findById as jest.Mock).mockReturnValueOnce(testData.south.list[1]); // retrieve the mssql connector
    const result = service.retrieveSecrets(
      testData.south.list[1].id,
      testData.north.list[0].id,
      undefined,
      southManifestList[4],
      northManifestList[4]
    );

    expect(result).toEqual({
      southType: testData.south.list[1].type,
      southSettings: testData.south.list[1].settings,
      items: testData.south.list[1].items,
      northType: testData.north.list[0].type,
      northSettings: testData.north.list[0].settings
    });
  });

  it('should retrieve secrets from south only', () => {
    (southService.findById as jest.Mock).mockReturnValueOnce(testData.south.list[1]); // retrieve the mssql connector

    const result = service.retrieveSecrets(testData.south.list[1].id, undefined, undefined, southManifestList[4], northManifestList[4]);

    expect(result).toEqual({
      southType: testData.south.list[1].type,
      southSettings: testData.south.list[1].settings,
      items: testData.south.list[1].items
    });
  });

  it('should retrieve secrets from north only', () => {
    const result = service.retrieveSecrets(undefined, testData.north.list[0].id, undefined, southManifestList[4], northManifestList[4]);

    expect(result).toEqual({
      items: [],
      northType: testData.north.list[0].type,
      northSettings: testData.north.list[0].settings
    });
  });

  it('should fail to retrieve secrets from south if does not match type', () => {
    const south = JSON.parse(JSON.stringify(testData.south.list[0]));
    south.type = 'bad';
    (southService.findById as jest.Mock).mockReturnValueOnce(south);

    expect(() =>
      service.retrieveSecrets(testData.south.list[0].id, testData.north.list[0].id, undefined, southManifestList[4], northManifestList[4])
    ).toThrow(`South connector "${testData.south.list[0].id}" (type "${south.type}") must be of the type "${southManifestList[4].id}"`);
  });

  it('should fail to retrieve secrets from north if does not match type', () => {
    (southService.findById as jest.Mock).mockReturnValueOnce(testData.south.list[1]); // retrieve the mssql connector

    const north = JSON.parse(JSON.stringify(testData.north.list[0]));
    north.type = 'bad';
    (northService.findById as jest.Mock).mockReturnValueOnce(north);

    expect(() =>
      service.retrieveSecrets(testData.north.list[0].id, testData.north.list[0].id, undefined, southManifestList[4], northManifestList[4])
    ).toThrow(`North connector "${testData.north.list[0].id}" (type "${north.type}") must be of the type "${northManifestList[4].id}"`);
  });

  it('should return null', () => {
    expect(service.retrieveSecrets(undefined, undefined, undefined, southManifestList[4], northManifestList[4])).toEqual(null);
  });

  it('should properly convert to DTO', () => {
    const historyQuery = testData.historyQueries.list[0];
    expect(toHistoryQueryDTO(historyQuery)).toEqual({
      id: historyQuery.id,
      name: historyQuery.name,
      description: historyQuery.description,
      status: historyQuery.status,
      startTime: historyQuery.startTime,
      endTime: historyQuery.endTime,
      southType: historyQuery.southType,
      northType: historyQuery.northType,
      southSettings: historyQuery.southSettings,
      northSettings: historyQuery.northSettings,
      caching: {
        trigger: {
          scanMode: historyQuery.caching.trigger.scanMode,
          numberOfElements: historyQuery.caching.trigger.numberOfElements,
          numberOfFiles: historyQuery.caching.trigger.numberOfFiles
        },
        throttling: {
          runMinDelay: historyQuery.caching.throttling.runMinDelay,
          maxSize: historyQuery.caching.throttling.maxSize,
          maxNumberOfElements: historyQuery.caching.throttling.maxNumberOfElements
        },
        error: {
          retryInterval: historyQuery.caching.error.retryInterval,
          retryCount: historyQuery.caching.error.retryCount,
          retentionDuration: historyQuery.caching.error.retentionDuration
        },
        archive: {
          enabled: historyQuery.caching.archive.enabled,
          retentionDuration: historyQuery.caching.archive.retentionDuration
        }
      },
      items: historyQuery.items.map(item => toHistoryQueryItemDTO(item, historyQuery.southType)),
      northTransformers: historyQuery.northTransformers.map(transformerWithOptions => ({
        transformer: transformerWithOptions.transformer,
        options: transformerWithOptions.options,
        inputType: transformerWithOptions.inputType
      }))
    });
    const historyQueryLight: HistoryQueryEntityLight = {
      id: historyQuery.id,
      name: historyQuery.name,
      description: historyQuery.description,
      status: historyQuery.status,
      startTime: historyQuery.startTime,
      endTime: historyQuery.endTime,
      southType: historyQuery.southType,
      northType: historyQuery.northType
    };
    expect(toHistoryQueryLightDTO(historyQueryLight)).toEqual({
      id: historyQuery.id,
      name: historyQuery.name,
      description: historyQuery.description,
      status: historyQuery.status,
      startTime: historyQuery.startTime,
      endTime: historyQuery.endTime,
      southType: historyQuery.southType,
      northType: historyQuery.northType
    });
  });
});
