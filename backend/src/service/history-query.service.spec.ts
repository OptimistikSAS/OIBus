import HistoryQueryService from './history-query.service';
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
import EncryptionService from './encryption.service';
import EncryptionServiceMock from '../tests/__mocks__/service/encryption-service.mock';
import JoiValidator from '../web-server/controllers/validators/joi.validator';
import HistoryQueryEngine from '../engine/history-query-engine';
import HistoryQueryEngineMock from '../tests/__mocks__/history-query-engine.mock';
import HistoryQueryMetricsRepository from '../repository/logs/history-query-metrics.repository';
import HistoryQueryMetricsRepositoryMock from '../tests/__mocks__/repository/log/history-query-metrics-repository.mock';
import PinoLogger from '../tests/__mocks__/service/logger/logger.mock';
import testData from '../tests/utils/test-data';
import { mockBaseFolders } from '../tests/utils/test-utils';
import { BaseFolders } from '../model/types';
import fs from 'node:fs/promises';
import csv from 'papaparse';
import multer from '@koa/multer';
jest.mock('papaparse');
jest.mock('node:fs/promises');
jest.mock('../web-server/controllers/validators/joi.validator');

const validator = new JoiValidator();
const logger: pino.Logger = new PinoLogger();
const historyQueryRepository: HistoryQueryRepository = new HistoryQueryRepositoryMock();
const scanModeRepository: ScanModeRepository = new ScanModeRepositoryMock();
const logRepository: LogRepository = new LogRepositoryMock();
const historyQueryMetricsRepository: HistoryQueryMetricsRepository = new HistoryQueryMetricsRepositoryMock();
const southService: SouthService = new SouthServiceMock();
const northService: NorthService = new NorthServiceMock();
const oIAnalyticsMessageService: OIAnalyticsMessageService = new OIAnalyticsMessageServiceMock();
const encryptionService: EncryptionService = new EncryptionServiceMock('', '');
const historyQueryEngine: HistoryQueryEngine = new HistoryQueryEngineMock(logger);

let service: HistoryQueryService;
describe('History Query service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    service = new HistoryQueryService(
      validator,
      historyQueryRepository,
      scanModeRepository,
      logRepository,
      historyQueryMetricsRepository,
      southService,
      northService,
      oIAnalyticsMessageService,
      encryptionService,
      historyQueryEngine
    );
  });

  it('testNorth() should test North settings in creation mode', async () => {
    (northService.getInstalledNorthManifests as jest.Mock).mockReturnValueOnce([
      {
        ...northManifestList[4] // file-writer
      }
    ]);
    await service.testNorth('create', testData.north.command, logger);
    expect(northService.testNorth).toHaveBeenCalledWith('create', testData.north.command, logger);
  });

  it('testNorth() should throw an error if manifest type is bad', async () => {
    (northService.getInstalledNorthManifests as jest.Mock).mockReturnValueOnce([]);
    const badCommand = JSON.parse(JSON.stringify(testData.north.command));
    badCommand.type = 'bad';
    await expect(service.testNorth('create', badCommand, logger)).rejects.toThrow('North manifest bad not found');
    expect(northService.testNorth).not.toHaveBeenCalled();
  });

  it('testNorth() should test North connector in edit mode', async () => {
    (northService.getInstalledNorthManifests as jest.Mock).mockReturnValueOnce([
      {
        ...northManifestList[4] // file-writer
      }
    ]);
    (historyQueryRepository.findHistoryQueryById as jest.Mock).mockReturnValueOnce(testData.historyQueries.list[0]);
    await service.testNorth(testData.historyQueries.list[0].id, testData.north.command, logger);
    expect(northService.testNorth).toHaveBeenCalled();
  });

  it('testNorth() should fail to test North connector in edit mode if north connector not found', async () => {
    (historyQueryRepository.findHistoryQueryById as jest.Mock).mockReturnValueOnce(null);
    await expect(service.testNorth(testData.historyQueries.list[0].id, testData.north.command, logger)).rejects.toThrow(
      `History query ${testData.historyQueries.list[0].id} not found`
    );
    expect(northService.testNorth).not.toHaveBeenCalled();
  });

  it('testSouth() should test South settings in creation mode', async () => {
    (southService.getInstalledSouthManifests as jest.Mock).mockReturnValueOnce([
      {
        ...southManifestList[0] // folder-scanner
      }
    ]);
    await service.testSouth('create', testData.south.command, logger);
    expect(southService.testSouth).toHaveBeenCalledWith('create', testData.south.command, logger);
  });

  it('testSouth() should throw an error if manifest type is bad', async () => {
    (southService.getInstalledSouthManifests as jest.Mock).mockReturnValueOnce([]);
    const badCommand = JSON.parse(JSON.stringify(testData.south.command));
    badCommand.type = 'bad';
    await expect(service.testSouth('create', badCommand, logger)).rejects.toThrow('South manifest bad not found');
    expect(southService.testSouth).not.toHaveBeenCalled();
  });

  it('testSouth() should test South connector in edit mode', async () => {
    (southService.getInstalledSouthManifests as jest.Mock).mockReturnValueOnce([
      {
        ...southManifestList[0] // folder-scanner
      }
    ]);
    (historyQueryRepository.findHistoryQueryById as jest.Mock).mockReturnValueOnce(testData.historyQueries.list[0]);
    await service.testSouth(testData.historyQueries.list[0].id, testData.south.command, logger);
    expect(southService.testSouth).toHaveBeenCalled();
  });

  it('testSouth() should fail to test South connector in edit mode if south connector not found', async () => {
    (historyQueryRepository.findHistoryQueryById as jest.Mock).mockReturnValueOnce(null);
    await expect(service.testSouth(testData.historyQueries.list[0].id, testData.south.command, logger)).rejects.toThrow(
      `History query ${testData.historyQueries.list[0].id} not found`
    );
    expect(southService.testSouth).not.toHaveBeenCalled();
  });

  it('testSouthItem() should test South settings in creation mode', async () => {
    (southService.getInstalledSouthManifests as jest.Mock).mockReturnValueOnce([
      {
        ...southManifestList[0] // folder-scanner
      }
    ]);
    const callback = jest.fn();
    await service.testSouthItem('create', testData.south.command, testData.south.itemCommand, callback, logger);
    expect(southService.testSouthItem).toHaveBeenCalledWith(
      'create',
      testData.south.command,
      { ...testData.south.itemCommand, scanModeId: 'history', scanModeName: null },
      callback,
      logger
    );
  });

  it('testSouthItem() should throw an error if manifest type is bad', async () => {
    (southService.getInstalledSouthManifests as jest.Mock).mockReturnValueOnce([]);
    const badCommand = JSON.parse(JSON.stringify(testData.south.command));
    badCommand.type = 'bad';
    const callback = jest.fn();
    await expect(service.testSouthItem('create', badCommand, testData.south.itemCommand, callback, logger)).rejects.toThrow(
      'South manifest bad not found'
    );

    expect(southService.testSouthItem).not.toHaveBeenCalled();
  });

  it('testSouthItem() should test South connector in edit mode', async () => {
    (southService.getInstalledSouthManifests as jest.Mock).mockReturnValueOnce([
      {
        ...southManifestList[0] // folder-scanner
      }
    ]);
    (historyQueryRepository.findHistoryQueryById as jest.Mock).mockReturnValueOnce(testData.historyQueries.list[0]);
    const callback = jest.fn();
    await service.testSouthItem(testData.historyQueries.list[0].id, testData.south.command, testData.south.itemCommand, callback, logger);
    expect(southService.testSouthItem).toHaveBeenCalled();
  });

  it('testSouthItem() should fail to test South connector in edit mode if south connector not found', async () => {
    (historyQueryRepository.findHistoryQueryById as jest.Mock).mockReturnValueOnce(null);
    const callback = jest.fn();

    await expect(
      service.testSouthItem(testData.historyQueries.list[0].id, testData.south.command, testData.south.itemCommand, callback, logger)
    ).rejects.toThrow(`History query ${testData.historyQueries.list[0].id} not found`);
    expect(southService.testSouthItem).not.toHaveBeenCalled();
  });

  it('should create History query', () => {
    const historyQuery = service.runHistoryQuery(testData.historyQueries.list[0], mockBaseFolders(testData.historyQueries.list[0].id));
    expect(historyQuery).toBeDefined();
    expect(historyQuery['baseFolders']).toEqual(mockBaseFolders(testData.historyQueries.list[0].id));
  });

  it('should create History query with default base folders', () => {
    const historyQuery = service.runHistoryQuery(testData.historyQueries.list[0]);
    expect(historyQuery).toBeDefined();
    expect(historyQuery['baseFolders']).toEqual(mockBaseFolders(`history-${testData.historyQueries.list[0].id}`));
  });

  it('should get a History query settings', () => {
    service.findById('historyId');
    expect(historyQueryRepository.findHistoryQueryById).toHaveBeenCalledTimes(1);
    expect(historyQueryRepository.findHistoryQueryById).toHaveBeenCalledWith('historyId');
  });

  it('should get all History queries settings', () => {
    service.findAll();
    expect(historyQueryRepository.findAllHistoryQueries).toHaveBeenCalledTimes(1);
  });

  it('should delete base folders', async () => {
    const historyQuery = service.runHistoryQuery(testData.historyQueries.list[0]);
    expect(historyQuery).toBeDefined();

    (fs.stat as jest.Mock).mockImplementation(() => ({}));

    const baseFolders = structuredClone(service['getDefaultBaseFolders'](testData.historyQueries.list[0].id));
    await service['deleteBaseFolders'](testData.historyQueries.list[0]);

    for (const type of Object.keys(baseFolders) as Array<keyof BaseFolders>) {
      expect(fs.stat).toHaveBeenCalledWith(baseFolders[type]);
      expect(fs.rm).toHaveBeenCalledWith(baseFolders[type], { recursive: true });
    }
  });

  it('should delete base folders if exists', async () => {
    const historyQuery = service.runHistoryQuery(testData.historyQueries.list[0]);
    expect(historyQuery).toBeDefined();

    (fs.stat as jest.Mock).mockImplementation(() => {
      throw new Error('stat error');
    });

    const baseFolders = structuredClone(service['getDefaultBaseFolders'](testData.historyQueries.list[0].id));
    await service['deleteBaseFolders'](testData.historyQueries.list[0]);

    for (const type of Object.keys(baseFolders) as Array<keyof BaseFolders>) {
      expect(fs.stat).toHaveBeenCalledWith(baseFolders[type]);
      expect(fs.rm).not.toHaveBeenCalled();
    }
  });

  it('should delete base folders and handle errors', async () => {
    const historyQuery = service.runHistoryQuery(testData.historyQueries.list[0]);
    expect(historyQuery).toBeDefined();

    const error = new Error('rm error');
    (fs.stat as jest.Mock).mockImplementation(() => ({}));
    (fs.rm as jest.Mock).mockImplementation(() => {
      throw error;
    });

    const baseFolders = structuredClone(service['getDefaultBaseFolders'](testData.historyQueries.list[0].id));
    await service['deleteBaseFolders'](testData.historyQueries.list[0]);

    for (const type of Object.keys(baseFolders) as Array<keyof BaseFolders>) {
      expect(fs.stat).toHaveBeenCalledWith(baseFolders[type]);
      expect(fs.rm).toHaveBeenCalledWith(baseFolders[type], { recursive: true });
      expect(historyQueryEngine.logger.error).toHaveBeenCalledWith(
        `Unable to delete History query "${testData.historyQueries.list[0].name}" (${testData.historyQueries.list[0].id}) "${type}" base folder: ${error}`
      );
    }
  });

  it('createHistoryQuery() should create a history query with items', async () => {
    (northService.getInstalledNorthManifests as jest.Mock).mockReturnValueOnce([
      {
        ...northManifestList[4] // file-writer
      }
    ]);
    (southService.getInstalledSouthManifests as jest.Mock).mockReturnValueOnce([
      {
        ...southManifestList[4] // mssql
      }
    ]);

    await service.createHistoryQuery(testData.historyQueries.command);
    expect(historyQueryRepository.saveHistoryQuery).toHaveBeenCalledTimes(1);
    expect(oIAnalyticsMessageService.createHistoryQueryMessage).toHaveBeenCalledTimes(1);
    expect(historyQueryEngine.createHistoryQuery).toHaveBeenCalledTimes(1);
  });

  it('createHistoryQuery() should fail to create if manifest South not found', async () => {
    (southService.getInstalledSouthManifests as jest.Mock).mockReturnValueOnce([
      {
        ...testData.south.manifest,
        id: 'another'
      }
    ]);

    await expect(service.createHistoryQuery(testData.historyQueries.command)).rejects.toThrow(
      `South manifest ${testData.historyQueries.command.southType} does not exist`
    );
  });

  it('createHistoryQuery() should fail to create if manifest North not found', async () => {
    (northService.getInstalledNorthManifests as jest.Mock).mockReturnValueOnce([
      {
        ...testData.south.manifest,
        id: 'another'
      }
    ]);
    (southService.getInstalledSouthManifests as jest.Mock).mockReturnValueOnce([
      {
        ...southManifestList[4] // mssql
      }
    ]);

    await expect(service.createHistoryQuery(testData.historyQueries.command)).rejects.toThrow(
      `North manifest ${testData.historyQueries.command.northType} does not exist`
    );
  });

  it('should get history query data stream', () => {
    service.getHistoryQueryDataStream(testData.historyQueries.list[0].id);
    expect(historyQueryEngine.getHistoryQueryDataStream).toHaveBeenCalledWith(testData.historyQueries.list[0].id);
  });

  it('updateHistoryQuery() should create a history query with items', async () => {
    (historyQueryRepository.findHistoryQueryById as jest.Mock).mockReturnValueOnce(testData.historyQueries.list[0]);
    (northService.getInstalledNorthManifests as jest.Mock).mockReturnValueOnce([
      {
        ...northManifestList[4] // file-writer
      }
    ]);
    (southService.getInstalledSouthManifests as jest.Mock).mockReturnValueOnce([
      {
        ...southManifestList[4] // mssql
      }
    ]);

    await service.updateHistoryQuery(testData.historyQueries.list[0].id, testData.historyQueries.command, false);
    expect(historyQueryRepository.saveHistoryQuery).toHaveBeenCalledTimes(1);
    expect(oIAnalyticsMessageService.createHistoryQueryMessage).toHaveBeenCalledTimes(1);
    expect(historyQueryEngine.reloadHistoryQuery).toHaveBeenCalledTimes(1);
  });

  it('updateHistoryQuery() should fail to update if history not found', async () => {
    (historyQueryRepository.findHistoryQueryById as jest.Mock).mockReturnValueOnce(null);

    await expect(service.updateHistoryQuery(testData.historyQueries.list[0].id, testData.historyQueries.command, false)).rejects.toThrow(
      `History query ${testData.historyQueries.list[0].id} not found`
    );
  });

  it('updateHistoryQuery() should fail to update if manifest South not found', async () => {
    (historyQueryRepository.findHistoryQueryById as jest.Mock).mockReturnValueOnce(testData.historyQueries.list[0]);
    (southService.getInstalledSouthManifests as jest.Mock).mockReturnValueOnce([
      {
        ...testData.south.manifest,
        id: 'another'
      }
    ]);

    await expect(service.updateHistoryQuery(testData.historyQueries.list[0].id, testData.historyQueries.command, false)).rejects.toThrow(
      `South manifest not found for type ${testData.historyQueries.command.southType}`
    );
  });

  it('updateHistoryQuery() should fail to update if manifest North not found', async () => {
    (historyQueryRepository.findHistoryQueryById as jest.Mock).mockReturnValueOnce(testData.historyQueries.list[0]);
    (southService.getInstalledSouthManifests as jest.Mock).mockReturnValueOnce([
      {
        ...southManifestList[4] // mssql
      }
    ]);
    (northService.getInstalledNorthManifests as jest.Mock).mockReturnValueOnce([
      {
        ...testData.south.manifest,
        id: 'another'
      }
    ]);

    await expect(service.updateHistoryQuery(testData.historyQueries.list[0].id, testData.historyQueries.command, false)).rejects.toThrow(
      `North manifest not found for type ${testData.historyQueries.command.northType}`
    );
  });

  it('deleteHistoryQuery() should fail to delete if history not found', async () => {
    (historyQueryRepository.findHistoryQueryById as jest.Mock).mockReturnValueOnce(null);

    await expect(service.deleteHistoryQuery(testData.historyQueries.list[0].id)).rejects.toThrow(
      `History query ${testData.historyQueries.list[0].id} not found`
    );
  });

  it('deleteHistoryQuery() should delete history query', async () => {
    (historyQueryRepository.findHistoryQueryById as jest.Mock).mockReturnValueOnce(testData.historyQueries.list[0]);

    await service.deleteHistoryQuery(testData.historyQueries.list[0].id);
    expect(historyQueryEngine.deleteHistoryQuery).toHaveBeenCalledWith(testData.historyQueries.list[0]);
    expect(historyQueryRepository.deleteHistoryQuery).toHaveBeenCalledWith(testData.historyQueries.list[0].id);
    expect(historyQueryMetricsRepository.removeMetrics).toHaveBeenCalledWith(testData.historyQueries.list[0].id);
    expect(oIAnalyticsMessageService.createHistoryQueryMessage).toHaveBeenCalledWith(testData.historyQueries.list[0]);
  });

  it('startHistoryQuery() should fail to start if history not found', async () => {
    (historyQueryRepository.findHistoryQueryById as jest.Mock).mockReturnValueOnce(null);

    await expect(service.startHistoryQuery(testData.historyQueries.list[0].id)).rejects.toThrow(
      `History query ${testData.historyQueries.list[0].id} not found`
    );
  });

  it('startHistoryQuery() should start history query', async () => {
    (historyQueryRepository.findHistoryQueryById as jest.Mock).mockReturnValueOnce(testData.historyQueries.list[0]);

    await service.startHistoryQuery(testData.historyQueries.list[0].id);
    expect(historyQueryRepository.updateHistoryQueryStatus).toHaveBeenCalledWith(testData.historyQueries.list[0].id, 'RUNNING');
    expect(historyQueryEngine.reloadHistoryQuery).toHaveBeenCalledWith(testData.historyQueries.list[0], false);
  });

  it('pauseHistoryQuery() should fail to pause if history not found', async () => {
    (historyQueryRepository.findHistoryQueryById as jest.Mock).mockReturnValueOnce(null);

    await expect(service.pauseHistoryQuery(testData.historyQueries.list[0].id)).rejects.toThrow(
      `History query ${testData.historyQueries.list[0].id} not found`
    );
  });

  it('pauseHistoryQuery() should pause history query', async () => {
    (historyQueryRepository.findHistoryQueryById as jest.Mock).mockReturnValueOnce(testData.historyQueries.list[0]);

    await service.pauseHistoryQuery(testData.historyQueries.list[0].id);
    expect(historyQueryRepository.updateHistoryQueryStatus).toHaveBeenCalledWith(testData.historyQueries.list[0].id, 'PAUSED');
    expect(historyQueryEngine.stopHistoryQuery).toHaveBeenCalledWith(testData.historyQueries.list[0].id);
  });

  it('listItems() should list history query items', async () => {
    service.listItems(testData.historyQueries.list[0].id, {});
    expect(historyQueryRepository.listHistoryQueryItems).toHaveBeenCalledWith(testData.historyQueries.list[0].id, {});
  });

  it('searchHistoryQueryItems() should list history query items', async () => {
    service.searchHistoryQueryItems(testData.historyQueries.list[0].id, {});
    expect(historyQueryRepository.searchHistoryQueryItems).toHaveBeenCalledWith(testData.historyQueries.list[0].id, {});
  });

  it('findAllItemsForHistoryQuery() should list history query items', async () => {
    service.findAllItemsForHistoryQuery(testData.historyQueries.list[0].id);
    expect(historyQueryRepository.findAllItemsForHistoryQuery).toHaveBeenCalledWith(testData.historyQueries.list[0].id);
  });

  it('findHistoryQueryItem() should find a history query item', async () => {
    service.findHistoryQueryItem(testData.historyQueries.list[0].id, testData.historyQueries.list[0].items[0].id);
    expect(historyQueryRepository.findHistoryQueryItemById).toHaveBeenCalledWith(
      testData.historyQueries.list[0].id,
      testData.historyQueries.list[0].items[0].id
    );
  });

  it('createHistoryQueryItem() should create an item', async () => {
    (southService.getInstalledSouthManifests as jest.Mock).mockReturnValueOnce([
      {
        ...southManifestList[0], // folder-scanner
        id: testData.historyQueries.list[0].southType
      }
    ]);
    (historyQueryRepository.findHistoryQueryById as jest.Mock).mockReturnValueOnce(testData.historyQueries.list[0]);
    const itemCommand = JSON.parse(JSON.stringify(testData.south.itemCommand));
    itemCommand.settings = {
      regex: '*',
      preserveFiles: true,
      ignoreModifiedDate: false,
      minAge: 100
    };
    await service.createHistoryQueryItem(testData.historyQueries.list[0].id, itemCommand);
    expect(historyQueryRepository.findHistoryQueryById).toHaveBeenCalledWith(testData.historyQueries.list[0].id);
    expect(historyQueryRepository.saveHistoryQueryItem).toHaveBeenCalledTimes(1);
    expect(oIAnalyticsMessageService.createHistoryQueryMessage).toHaveBeenCalledTimes(1);
    expect(historyQueryEngine.reloadHistoryQuery).toHaveBeenCalledWith(testData.historyQueries.list[0], false);
  });

  it('createHistoryQueryItem() should throw an error if connector does not exist', async () => {
    (historyQueryRepository.findHistoryQueryById as jest.Mock).mockReturnValueOnce(null);
    const itemCommand = JSON.parse(JSON.stringify(testData.south.itemCommand));
    itemCommand.settings = {
      regex: '*',
      preserveFiles: true,
      ignoreModifiedDate: false,
      minAge: 100
    };
    await expect(service.createHistoryQueryItem(testData.historyQueries.list[0].id, itemCommand)).rejects.toThrow(
      `History Query ${testData.historyQueries.list[0].id} does not exist`
    );
  });

  it('createHistoryQueryItem() should throw an error if manifest is not found', async () => {
    (southService.getInstalledSouthManifests as jest.Mock).mockReturnValueOnce([
      {
        ...southManifestList[4] // mssql
      }
    ]);
    const badSouth = JSON.parse(JSON.stringify(testData.historyQueries.list[0]));
    badSouth.southType = 'bad';
    (historyQueryRepository.findHistoryQueryById as jest.Mock).mockReturnValueOnce(badSouth);
    const itemCommand = JSON.parse(JSON.stringify(testData.historyQueries.itemCommand));
    itemCommand.settings = {
      regex: '*',
      preserveFiles: true,
      ignoreModifiedDate: false,
      minAge: 100
    };
    await expect(service.createHistoryQueryItem(testData.historyQueries.list[0].id, itemCommand)).rejects.toThrow(
      `South manifest does not exist for type bad`
    );
  });

  it('updateHistoryQueryItem() should update an item', async () => {
    (southService.getInstalledSouthManifests as jest.Mock).mockReturnValueOnce([
      {
        ...southManifestList[4] // mssql
      }
    ]);
    (historyQueryRepository.findHistoryQueryById as jest.Mock).mockReturnValueOnce(testData.historyQueries.list[0]);
    (historyQueryRepository.findHistoryQueryItemById as jest.Mock).mockReturnValueOnce(testData.historyQueries.list[0].items[0]);
    const itemCommand = JSON.parse(JSON.stringify(testData.south.itemCommand));
    itemCommand.settings = {
      regex: '*',
      preserveFiles: true,
      ignoreModifiedDate: false,
      minAge: 100
    };
    await service.updateHistoryQueryItem(testData.historyQueries.list[0].id, 'itemId', itemCommand);
    expect(historyQueryRepository.findHistoryQueryItemById).toHaveBeenCalledWith(testData.historyQueries.list[0].id, 'itemId');
    expect(historyQueryRepository.saveHistoryQueryItem).toHaveBeenCalledTimes(1);
    expect(historyQueryEngine.reloadHistoryQuery).toHaveBeenCalledWith(testData.historyQueries.list[0], false);
  });

  it('updateHistoryQueryItem() should throw an error if item does not exist', async () => {
    (historyQueryRepository.findHistoryQueryItemById as jest.Mock).mockReturnValueOnce(null);
    const itemCommand = JSON.parse(JSON.stringify(testData.south.itemCommand));
    itemCommand.settings = {
      regex: '*',
      preserveFiles: true,
      ignoreModifiedDate: false,
      minAge: 100
    };
    await expect(service.updateHistoryQueryItem(testData.historyQueries.list[0].id, 'itemId', itemCommand)).rejects.toThrow(
      `History query item with ID itemId does not exist`
    );
  });

  it('updateHistoryQueryItem() should throw an error if history query does not exist', async () => {
    (historyQueryRepository.findHistoryQueryById as jest.Mock).mockReturnValueOnce(null);
    (historyQueryRepository.findHistoryQueryItemById as jest.Mock).mockReturnValueOnce(testData.historyQueries.list[0].items[0]);

    const itemCommand = JSON.parse(JSON.stringify(testData.south.itemCommand));
    itemCommand.settings = {
      regex: '*',
      preserveFiles: true,
      ignoreModifiedDate: false,
      minAge: 100
    };
    await expect(service.updateHistoryQueryItem(testData.historyQueries.list[0].id, 'itemId', itemCommand)).rejects.toThrow(
      `History query ${testData.historyQueries.list[0].id} does not exist`
    );
  });

  it('updateHistoryQueryItem() should throw an error if manifest is not found', async () => {
    (southService.getInstalledSouthManifests as jest.Mock).mockReturnValueOnce([
      {
        ...southManifestList[4] // mssql
      }
    ]);
    const badSouth = JSON.parse(JSON.stringify(testData.historyQueries.list[0]));
    badSouth.southType = 'bad';
    (historyQueryRepository.findHistoryQueryById as jest.Mock).mockReturnValueOnce(badSouth);
    (historyQueryRepository.findHistoryQueryItemById as jest.Mock).mockReturnValueOnce(testData.historyQueries.list[0].items[0]);

    const itemCommand = JSON.parse(JSON.stringify(testData.south.itemCommand));
    itemCommand.settings = {
      regex: '*',
      preserveFiles: true,
      ignoreModifiedDate: false,
      minAge: 100
    };
    await expect(service.updateHistoryQueryItem(testData.historyQueries.list[0].id, 'itemId', itemCommand)).rejects.toThrow(
      `South manifest does not exist for type bad`
    );
  });

  it('deleteHistoryQueryItem() should delete an item', async () => {
    (historyQueryRepository.findHistoryQueryById as jest.Mock).mockReturnValueOnce(testData.historyQueries.list[0]);
    (historyQueryRepository.findHistoryQueryItemById as jest.Mock).mockReturnValueOnce(testData.historyQueries.list[0].items[0]);
    await service.deleteHistoryQueryItem(testData.historyQueries.list[0].id, 'itemId');
    expect(historyQueryRepository.findHistoryQueryItemById).toHaveBeenCalledWith(testData.historyQueries.list[0].id, 'itemId');
    expect(historyQueryRepository.deleteHistoryQueryItem).toHaveBeenCalledWith(testData.historyQueries.list[0].items[0].id);
    expect(historyQueryEngine.reloadHistoryQuery).toHaveBeenCalledWith(testData.historyQueries.list[0], false);
  });

  it('deleteHistoryQueryItem() should throw an error if item does not exist', async () => {
    (historyQueryRepository.findHistoryQueryById as jest.Mock).mockReturnValueOnce(testData.historyQueries.list[0]);
    (historyQueryRepository.findHistoryQueryItemById as jest.Mock).mockReturnValueOnce(null);

    await expect(service.deleteHistoryQueryItem(testData.historyQueries.list[0].id, 'itemId')).rejects.toThrow(
      `History query item itemId not found`
    );
  });

  it('deleteHistoryQueryItem() should throw an error if connector does not exist', async () => {
    (historyQueryRepository.findHistoryQueryById as jest.Mock).mockReturnValueOnce(null);

    await expect(service.deleteHistoryQueryItem(testData.historyQueries.list[0].id, 'itemId')).rejects.toThrow(
      `History query ${testData.historyQueries.list[0].id} does not exist`
    );
  });

  it('deleteAllItemsForHistoryQuery() should delete all items', async () => {
    (historyQueryRepository.findHistoryQueryById as jest.Mock).mockReturnValueOnce(testData.historyQueries.list[0]);
    await service.deleteAllItemsForHistoryQuery(testData.historyQueries.list[0].id);
    expect(historyQueryRepository.deleteAllHistoryQueryItemsByHistoryQuery).toHaveBeenCalledWith(testData.historyQueries.list[0].id);
    expect(historyQueryEngine.reloadHistoryQuery).toHaveBeenCalledWith(testData.historyQueries.list[0], true);
  });

  it('deleteAllItemsForHistoryQuery() should throw an error if connector does not exist', async () => {
    (historyQueryRepository.findHistoryQueryById as jest.Mock).mockReturnValueOnce(null);

    await expect(service.deleteAllItemsForHistoryQuery(testData.historyQueries.list[0].id)).rejects.toThrow(
      `History query ${testData.historyQueries.list[0].id} not found`
    );
  });

  it('enableHistoryQueryItem() should enable an item', async () => {
    (historyQueryRepository.findHistoryQueryById as jest.Mock).mockReturnValueOnce(testData.historyQueries.list[0]);
    (historyQueryRepository.findHistoryQueryItemById as jest.Mock).mockReturnValueOnce(testData.historyQueries.list[0].items[0]);
    await service.enableHistoryQueryItem(testData.historyQueries.list[0].id, 'itemId');
    expect(historyQueryRepository.findHistoryQueryItemById).toHaveBeenCalledWith(testData.historyQueries.list[0].id, 'itemId');
    expect(historyQueryRepository.enableHistoryQueryItem).toHaveBeenCalledWith(testData.historyQueries.list[0].items[0].id);
    expect(historyQueryEngine.reloadHistoryQuery).toHaveBeenCalledWith(testData.historyQueries.list[0], false);
  });

  it('enableHistoryQueryItem() should throw an error if item is not found', async () => {
    (historyQueryRepository.findHistoryQueryItemById as jest.Mock).mockReturnValueOnce(null);
    await expect(service.enableHistoryQueryItem(testData.historyQueries.list[0].id, 'itemId')).rejects.toThrow(
      'History query item itemId not found'
    );
  });

  it('disableHistoryQueryItem() should disable an item', async () => {
    (historyQueryRepository.findHistoryQueryById as jest.Mock).mockReturnValueOnce(testData.historyQueries.list[0]);
    (historyQueryRepository.findHistoryQueryItemById as jest.Mock).mockReturnValueOnce(testData.historyQueries.list[0].items[0]);
    await service.disableHistoryQueryItem(testData.historyQueries.list[0].id, 'itemId');
    expect(historyQueryRepository.findHistoryQueryItemById).toHaveBeenCalledWith(testData.historyQueries.list[0].id, 'itemId');
    expect(historyQueryRepository.disableHistoryQueryItem).toHaveBeenCalledWith(testData.historyQueries.list[0].items[0].id);
    expect(historyQueryEngine.reloadHistoryQuery).toHaveBeenCalledWith(testData.historyQueries.list[0], false);
  });

  it('disableHistoryQueryItem() should throw an error if item is not found', async () => {
    (historyQueryRepository.findHistoryQueryItemById as jest.Mock).mockReturnValueOnce(null);
    await expect(service.disableHistoryQueryItem(testData.historyQueries.list[0].id, 'itemId')).rejects.toThrow(
      'History query item itemId not found'
    );
  });

  it('checkCsvImport() should properly parse csv and check items', async () => {
    (southService.getInstalledSouthManifests as jest.Mock).mockReturnValueOnce([
      {
        ...southManifestList[0], // folder scanner
        id: testData.historyQueries.command.southType
      }
    ]);
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
    (fs.readFile as jest.Mock).mockReturnValueOnce('file content');
    (csv.parse as jest.Mock).mockReturnValueOnce({
      meta: { delimiter: ',' },
      data: csvData
    });
    (validator.validateSettings as jest.Mock).mockImplementationOnce(() => {
      throw new Error(`"ignoreModifiedDate" must be a boolean`);
    });
    const result = await service.checkCsvFileImport(
      testData.historyQueries.command.southType,
      { path: 'file/path.csv' } as multer.File,
      ',',
      testData.south.list[0].items
    );
    expect(result).toEqual({
      items: [
        {
          id: '',
          name: csvData[3].name,
          enabled: csvData[3].enabled.toLowerCase() === 'true',
          settings: {
            ignoreModifiedDate: 'false',
            minAge: 100,
            preserveFiles: 'true',
            regex: '*'
          }
        }
      ],
      errors: [
        {
          error: 'Item name "item1" already used',
          item: {
            id: '',
            name: csvData[0].name,
            enabled: csvData[0].enabled.toLowerCase() === 'true',
            settings: {}
          }
        },
        {
          error: 'Settings "badItem" not accepted in manifest',
          item: {
            id: '',
            name: csvData[1].name,
            enabled: csvData[1].enabled.toLowerCase() === 'true',
            settings: {}
          }
        },
        {
          error: '"ignoreModifiedDate" must be a boolean',
          item: {
            id: '',
            name: csvData[2].name,
            enabled: csvData[2].enabled.toLowerCase() === 'true',
            settings: {
              ignoreModifiedDate: 12,
              minAge: 100,
              preserveFiles: 'true',
              regex: '*'
            }
          }
        }
      ]
    });
  });

  it('checkCsvImport() should properly parse csv and check items with array or object', async () => {
    (southService.getInstalledSouthManifests as jest.Mock).mockReturnValueOnce([
      {
        ...southManifestList[4], // mssql
        id: testData.historyQueries.command.southType
      }
    ]);
    const csvData = [
      {
        name: 'item',
        enabled: 'true',
        settings_query: 'SELECT * FROM table',
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
    (fs.readFile as jest.Mock).mockReturnValueOnce('file content');
    (csv.parse as jest.Mock).mockReturnValueOnce({
      meta: { delimiter: ',' },
      data: csvData
    });
    const result = await service.checkCsvFileImport(
      testData.historyQueries.command.southType,
      { path: 'file/path.csv' } as multer.File,
      ',',
      testData.south.list[1].items
    );
    expect(result).toEqual({
      items: [
        {
          id: '',
          name: csvData[0].name,
          enabled: csvData[0].enabled.toLowerCase() === 'true',
          settings: {
            query: 'SELECT * FROM table',
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
    (southService.getInstalledSouthManifests as jest.Mock).mockReturnValueOnce([
      {
        ...testData.south.manifest,
        id: testData.historyQueries.command.southType
      }
    ]);
    await expect(service.checkCsvContentImport('bad', 'fileContent', ',', testData.south.list[0].items)).rejects.toThrow(
      `South manifest does not exist for type bad`
    );
  });

  it('checkCsvImport() should throw error if delimiter does not match', async () => {
    (southService.getInstalledSouthManifests as jest.Mock).mockReturnValueOnce([
      {
        ...testData.south.manifest,
        id: testData.historyQueries.command.southType
      }
    ]);
    (fs.readFile as jest.Mock).mockReturnValueOnce('file content');
    (csv.parse as jest.Mock).mockReturnValueOnce({
      meta: { delimiter: ';' },
      data: []
    });

    await expect(
      service.checkCsvFileImport(
        testData.historyQueries.command.southType,
        { path: 'file/path.csv' } as multer.File,
        ',',
        testData.south.list[0].items
      )
    ).rejects.toThrow(`The entered delimiter "," does not correspond to the file delimiter ";"`);
  });

  it('importItems() should import items', async () => {
    (southService.getInstalledSouthManifests as jest.Mock).mockReturnValueOnce([
      {
        ...testData.south.manifest,
        id: testData.historyQueries.command.southType
      }
    ]);
    const itemCommand = JSON.parse(JSON.stringify(testData.historyQueries.itemCommand));
    itemCommand.id = null;
    itemCommand.settings = {
      regex: '*',
      preserveFiles: true,
      ignoreModifiedDate: false,
      minAge: 100
    };
    (historyQueryRepository.findHistoryQueryById as jest.Mock).mockReturnValueOnce(testData.historyQueries.list[0]);

    await service.importItems(testData.historyQueries.list[0].id, [itemCommand]);
    expect(historyQueryRepository.saveAllItems).toHaveBeenCalledTimes(1);
    expect(historyQueryEngine.reloadHistoryQuery).toHaveBeenCalledWith(testData.historyQueries.list[0], false);
  });

  it('importItems() should import items', async () => {
    (southService.getInstalledSouthManifests as jest.Mock).mockReturnValueOnce([
      {
        ...testData.south.manifest,
        id: testData.historyQueries.command.southType
      }
    ]);
    const itemCommand = JSON.parse(JSON.stringify(testData.historyQueries.itemCommand));
    itemCommand.settings = {
      regex: '*',
      preserveFiles: true,
      ignoreModifiedDate: false,
      minAge: 100
    };
    (historyQueryRepository.findHistoryQueryById as jest.Mock).mockReturnValueOnce(null);

    await expect(service.importItems(testData.historyQueries.list[0].id, [itemCommand])).rejects.toThrow(
      `History query ${testData.historyQueries.list[0].id} does not exist`
    );
  });
});
