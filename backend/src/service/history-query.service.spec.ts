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
import SouthConnectorRepository from '../repository/config/south-connector.repository';
import NorthConnectorRepository from '../repository/config/north-connector.repository';
import SouthConnectorRepositoryMock from '../tests/__mocks__/repository/config/south-connector-repository.mock';
import NorthConnectorRepositoryMock from '../tests/__mocks__/repository/config/north-connector-repository.mock';
jest.mock('papaparse');
jest.mock('node:fs/promises');
jest.mock('../web-server/controllers/validators/joi.validator');

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
const encryptionService: EncryptionService = new EncryptionServiceMock('', '');
const historyQueryEngine: HistoryQueryEngine = new HistoryQueryEngineMock(logger);

let service: HistoryQueryService;
describe('History Query service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
    await service.testNorth('create', null, testData.north.command, logger);
    expect(northService.testNorth).toHaveBeenCalledWith('create', testData.north.command, logger);
  });

  it('testNorth() should throw an error if manifest type is bad', async () => {
    (northService.getInstalledNorthManifests as jest.Mock).mockReturnValueOnce([]);
    (northConnectorRepository.findNorthById as jest.Mock).mockReturnValueOnce(testData.north.list[0]);
    const badCommand = JSON.parse(JSON.stringify(testData.north.command));
    badCommand.type = 'bad';
    await expect(service.testNorth('create', testData.north.list[0].id, badCommand, logger)).rejects.toThrow(
      'North manifest bad not found'
    );
    expect(northService.testNorth).not.toHaveBeenCalled();
  });

  it('testNorth() should throw an error if north is not found', async () => {
    (northConnectorRepository.findNorthById as jest.Mock).mockReturnValueOnce(null);

    await expect(service.testNorth('create', testData.north.list[0].id, testData.north.command, logger)).rejects.toThrow(
      `North connector ${testData.north.list[0].id} not found`
    );
    expect(northService.testNorth).not.toHaveBeenCalled();
  });

  it('testNorth() should test North connector in edit mode', async () => {
    (northService.getInstalledNorthManifests as jest.Mock).mockReturnValueOnce([
      {
        ...northManifestList[4] // file-writer
      }
    ]);
    (historyQueryRepository.findHistoryQueryById as jest.Mock).mockReturnValueOnce(testData.historyQueries.list[0]);
    await service.testNorth(testData.historyQueries.list[0].id, null, testData.north.command, logger);
    expect(northService.testNorth).toHaveBeenCalled();
  });

  it('testNorth() should fail to test North connector in edit mode if north connector not found', async () => {
    (historyQueryRepository.findHistoryQueryById as jest.Mock).mockReturnValueOnce(null);
    await expect(service.testNorth(testData.historyQueries.list[0].id, null, testData.north.command, logger)).rejects.toThrow(
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
    await service.testSouth('create', null, testData.south.command, logger);
    expect(southService.testSouth).toHaveBeenCalledWith('create', testData.south.command, logger);
  });

  it('testSouth() should throw an error if manifest type is bad', async () => {
    (southService.getInstalledSouthManifests as jest.Mock).mockReturnValueOnce([]);
    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValueOnce(testData.south.list[0]);

    const badCommand = JSON.parse(JSON.stringify(testData.south.command));
    badCommand.type = 'bad';
    await expect(service.testSouth('create', testData.south.list[0].id, badCommand, logger)).rejects.toThrow(
      'South manifest bad not found'
    );
    expect(southService.testSouth).not.toHaveBeenCalled();
  });

  it('testSouth() should throw an error if south connector is not found', async () => {
    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValueOnce(null);

    await expect(service.testSouth('create', testData.south.list[0].id, testData.south.command, logger)).rejects.toThrow(
      `South connector ${testData.south.list[0].id} not found`
    );
    expect(southService.testSouth).not.toHaveBeenCalled();
  });

  it('testSouth() should test South connector in edit mode', async () => {
    (southService.getInstalledSouthManifests as jest.Mock).mockReturnValueOnce([
      {
        ...southManifestList[0] // folder-scanner
      }
    ]);
    (historyQueryRepository.findHistoryQueryById as jest.Mock).mockReturnValueOnce(testData.historyQueries.list[0]);
    await service.testSouth(testData.historyQueries.list[0].id, null, testData.south.command, logger);
    expect(southService.testSouth).toHaveBeenCalled();
  });

  it('testSouth() should fail to test South connector in edit mode if history query not found', async () => {
    (historyQueryRepository.findHistoryQueryById as jest.Mock).mockReturnValueOnce(null);
    await expect(service.testSouth(testData.historyQueries.list[0].id, null, testData.south.command, logger)).rejects.toThrow(
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
    await service.testSouthItem(
      'create',
      null,
      testData.south.command,
      testData.south.itemCommand,
      testData.south.itemTestingSettings,
      callback,
      logger
    );
    expect(southService.testSouthItem).toHaveBeenCalledWith(
      'create',
      testData.south.command,
      { ...testData.south.itemCommand, scanModeId: 'history', scanModeName: null },
      testData.south.itemTestingSettings,
      callback,
      logger
    );
  });

  it('testSouthItem() should throw an error if manifest type is bad', async () => {
    (southService.getInstalledSouthManifests as jest.Mock).mockReturnValueOnce([]);
    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValueOnce(testData.south.list[0]);
    const badCommand = JSON.parse(JSON.stringify(testData.south.command));
    badCommand.type = 'bad';
    const callback = jest.fn();
    await expect(
      service.testSouthItem(
        'create',
        testData.south.list[0].id,
        badCommand,
        testData.south.itemCommand,
        testData.south.itemTestingSettings,
        callback,
        logger
      )
    ).rejects.toThrow('South manifest bad not found');

    expect(southService.testSouthItem).not.toHaveBeenCalled();
  });

  it('testSouthItem() should throw an error if south connector not found', async () => {
    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValueOnce(null);
    const callback = jest.fn();
    await expect(
      service.testSouthItem(
        'create',
        testData.south.list[0].id,
        testData.south.command,
        testData.south.itemCommand,
        testData.south.itemTestingSettings,
        callback,
        logger
      )
    ).rejects.toThrow(`South connector ${testData.south.list[0].id} not found`);

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
    await service.testSouthItem(
      testData.historyQueries.list[0].id,
      null,
      testData.south.command,
      testData.south.itemCommand,
      testData.south.itemTestingSettings,
      callback,
      logger
    );
    expect(southService.testSouthItem).toHaveBeenCalled();
  });

  it('testSouthItem() should fail to test South connector in edit mode if history querynot found', async () => {
    (historyQueryRepository.findHistoryQueryById as jest.Mock).mockReturnValueOnce(null);
    const callback = jest.fn();

    await expect(
      service.testSouthItem(
        testData.historyQueries.list[0].id,
        null,
        testData.south.command,
        testData.south.itemCommand,
        testData.south.itemTestingSettings,
        callback,
        logger
      )
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
    expect(historyQueryRepository.findAllHistoryQueriesLight).toHaveBeenCalledTimes(1);
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

  it('createHistoryQuery() should create a history query', async () => {
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
    service.retrieveSecrets = jest.fn();

    await service.createHistoryQuery(testData.historyQueries.command, testData.historyQueries.list[0].id, null, null);
    expect(service.retrieveSecrets).toHaveBeenCalledTimes(1);
    expect(historyQueryRepository.saveHistoryQuery).toHaveBeenCalledTimes(1);
    expect(oIAnalyticsMessageService.createFullHistoryQueriesMessageIfNotPending).toHaveBeenCalledTimes(1);
    expect(historyQueryEngine.createHistoryQuery).toHaveBeenCalledTimes(1);
  });

  it('createHistoryQuery() should fail to create if manifest South not found', async () => {
    (southService.getInstalledSouthManifests as jest.Mock).mockReturnValueOnce([
      {
        ...testData.south.manifest,
        id: 'another'
      }
    ]);

    await expect(service.createHistoryQuery(testData.historyQueries.command, null, null, null)).rejects.toThrow(
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

    await expect(service.createHistoryQuery(testData.historyQueries.command, null, null, null)).rejects.toThrow(
      `North manifest ${testData.historyQueries.command.northType} does not exist`
    );
  });

  it('should get history query data stream', () => {
    service.getHistoryQueryDataStream(testData.historyQueries.list[0].id);
    expect(historyQueryEngine.getHistoryQueryDataStream).toHaveBeenCalledWith(testData.historyQueries.list[0].id);
  });

  it('updateHistoryQuery() should create a history query', async () => {
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
    expect(oIAnalyticsMessageService.createFullHistoryQueriesMessageIfNotPending).toHaveBeenCalledTimes(1);
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
    expect(oIAnalyticsMessageService.createFullHistoryQueriesMessageIfNotPending).toHaveBeenCalled();
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
    expect(oIAnalyticsMessageService.createFullHistoryQueriesMessageIfNotPending).toHaveBeenCalledTimes(1);
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
    expect(oIAnalyticsMessageService.createFullHistoryQueriesMessageIfNotPending).toHaveBeenCalledTimes(1);
    expect(historyQueryEngine.stopHistoryQuery).toHaveBeenCalledWith(testData.historyQueries.list[0].id);
  });

  it('listSouthHistoryQueryItems() should list history query south items', async () => {
    service.listSouthHistoryQueryItems(testData.historyQueries.list[0].id, {});
    expect(historyQueryRepository.listSouthHistoryQueryItems).toHaveBeenCalledWith(testData.historyQueries.list[0].id, {});
  });

  it('listNorthHistoryQueryItems() should list history query north items', async () => {
    service.listNorthHistoryQueryItems(testData.historyQueries.list[0].id, {});
    expect(historyQueryRepository.listNorthHistoryQueryItems).toHaveBeenCalledWith(testData.historyQueries.list[0].id, {});
  });

  it('searchSouthHistoryQueryItems() should list history query south items', async () => {
    service.searchSouthHistoryQueryItems(testData.historyQueries.list[0].id, {});
    expect(historyQueryRepository.searchSouthHistoryQueryItems).toHaveBeenCalledWith(testData.historyQueries.list[0].id, {});
  });

  it('searchNorthHistoryQueryItems() should list history query north items', async () => {
    service.searchNorthHistoryQueryItems(testData.historyQueries.list[0].id, {});
    expect(historyQueryRepository.searchNorthHistoryQueryItems).toHaveBeenCalledWith(testData.historyQueries.list[0].id, {});
  });

  it('findAllSouthItemsForHistoryQuery() should list history query south items', async () => {
    service.findAllSouthItemsForHistoryQuery(testData.historyQueries.list[0].id);
    expect(historyQueryRepository.findAllSouthItemsForHistoryQuery).toHaveBeenCalledWith(testData.historyQueries.list[0].id);
  });

  it('findAllNorthItemsForHistoryQuery() should list history query north items', async () => {
    service.findAllNorthItemsForHistoryQuery(testData.historyQueries.list[0].id);
    expect(historyQueryRepository.findAllNorthItemsForHistoryQuery).toHaveBeenCalledWith(testData.historyQueries.list[0].id);
  });

  it('findSouthHistoryQueryItem() should find a history query south item', async () => {
    service.findSouthHistoryQueryItem(testData.historyQueries.list[0].id, testData.historyQueries.list[0].southItems[0].id);
    expect(historyQueryRepository.findSouthHistoryQueryItemById).toHaveBeenCalledWith(
      testData.historyQueries.list[0].id,
      testData.historyQueries.list[0].southItems[0].id
    );
  });

  it('findNorthHistoryQueryItem() should find a history query north item', async () => {
    service.findNorthHistoryQueryItem(testData.historyQueries.list[0].id, testData.historyQueries.list[0].northItems[0].id);
    expect(historyQueryRepository.findNorthHistoryQueryItemById).toHaveBeenCalledWith(
      testData.historyQueries.list[0].id,
      testData.historyQueries.list[0].northItems[0].id
    );
  });

  it('createSouthHistoryQueryItem() should create a south item', async () => {
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
    await service.createSouthHistoryQueryItem(testData.historyQueries.list[0].id, itemCommand);
    expect(historyQueryRepository.findHistoryQueryById).toHaveBeenCalledWith(testData.historyQueries.list[0].id);
    expect(historyQueryRepository.saveSouthHistoryQueryItem).toHaveBeenCalledTimes(1);
    expect(oIAnalyticsMessageService.createFullHistoryQueriesMessageIfNotPending).toHaveBeenCalledTimes(1);
    expect(historyQueryEngine.reloadHistoryQuery).toHaveBeenCalledWith(testData.historyQueries.list[0], false);
  });

  it('createSouthHistoryQueryItem() should throw an error if connector does not exist', async () => {
    (historyQueryRepository.findHistoryQueryById as jest.Mock).mockReturnValueOnce(null);
    const itemCommand = JSON.parse(JSON.stringify(testData.south.itemCommand));
    itemCommand.settings = {
      regex: '*',
      preserveFiles: true,
      ignoreModifiedDate: false,
      minAge: 100
    };
    await expect(service.createSouthHistoryQueryItem(testData.historyQueries.list[0].id, itemCommand)).rejects.toThrow(
      `History Query ${testData.historyQueries.list[0].id} does not exist`
    );
  });

  it('createSouthHistoryQueryItem() should throw an error if manifest is not found', async () => {
    (southService.getInstalledSouthManifests as jest.Mock).mockReturnValueOnce([
      {
        ...southManifestList[4] // mssql
      }
    ]);
    const badSouth = JSON.parse(JSON.stringify(testData.historyQueries.list[0]));
    badSouth.southType = 'bad';
    (historyQueryRepository.findHistoryQueryById as jest.Mock).mockReturnValueOnce(badSouth);
    const itemCommand = JSON.parse(JSON.stringify(testData.historyQueries.southItemCommand));
    itemCommand.settings = {
      regex: '*',
      preserveFiles: true,
      ignoreModifiedDate: false,
      minAge: 100
    };
    await expect(service.createSouthHistoryQueryItem(testData.historyQueries.list[0].id, itemCommand)).rejects.toThrow(
      `South manifest does not exist for type bad`
    );
  });

  it('createNorthHistoryQueryItem() should create a north item', async () => {
    (northService.getInstalledNorthManifests as jest.Mock).mockReturnValueOnce([
      {
        ...northManifestList[0], // console
        id: testData.historyQueries.list[0].northType
      }
    ]);
    (historyQueryRepository.findHistoryQueryById as jest.Mock).mockReturnValueOnce(testData.historyQueries.list[0]);
    const itemCommand = JSON.parse(JSON.stringify(testData.north.itemCommand));
    itemCommand.settings = {};
    await service.createNorthHistoryQueryItem(testData.historyQueries.list[0].id, itemCommand);
    expect(historyQueryRepository.findHistoryQueryById).toHaveBeenCalledWith(testData.historyQueries.list[0].id);
    expect(historyQueryRepository.saveNorthHistoryQueryItem).toHaveBeenCalledTimes(1);
    expect(oIAnalyticsMessageService.createHistoryQueryMessage).toHaveBeenCalledTimes(1);
    expect(historyQueryEngine.reloadHistoryQuery).toHaveBeenCalledWith(testData.historyQueries.list[0], false);
  });

  it('createNorthHistoryQueryItem() should throw an error if connector does not exist', async () => {
    (historyQueryRepository.findHistoryQueryById as jest.Mock).mockReturnValueOnce(null);
    const itemCommand = JSON.parse(JSON.stringify(testData.south.itemCommand));
    itemCommand.settings = {};
    await expect(service.createNorthHistoryQueryItem(testData.historyQueries.list[0].id, itemCommand)).rejects.toThrow(
      `History Query ${testData.historyQueries.list[0].id} does not exist`
    );
  });

  it('createNorthHistoryQueryItem() should throw an error if manifest is not found', async () => {
    (northService.getInstalledNorthManifests as jest.Mock).mockReturnValueOnce([
      {
        ...northManifestList[4], // file writer
        id: testData.historyQueries.list[0].northType
      }
    ]);
    const badNorth = JSON.parse(JSON.stringify(testData.historyQueries.list[0]));
    badNorth.northType = 'bad';
    (historyQueryRepository.findHistoryQueryById as jest.Mock).mockReturnValueOnce(badNorth);
    const itemCommand = JSON.parse(JSON.stringify(testData.historyQueries.southItemCommand));
    itemCommand.settings = {};
    await expect(service.createNorthHistoryQueryItem(testData.historyQueries.list[0].id, itemCommand)).rejects.toThrow(
      `North manifest does not exist for type bad`
    );
  });

  it('updateSouthHistoryQueryItem() should update an item', async () => {
    (southService.getInstalledSouthManifests as jest.Mock).mockReturnValueOnce([
      {
        ...southManifestList[4] // mssql
      }
    ]);
    (historyQueryRepository.findHistoryQueryById as jest.Mock).mockReturnValueOnce(testData.historyQueries.list[0]);
    (historyQueryRepository.findSouthHistoryQueryItemById as jest.Mock).mockReturnValueOnce(testData.historyQueries.list[0].southItems[0]);
    const itemCommand = JSON.parse(JSON.stringify(testData.south.itemCommand));
    itemCommand.settings = {
      regex: '*',
      preserveFiles: true,
      ignoreModifiedDate: false,
      minAge: 100
    };
    await service.updateSouthHistoryQueryItem(testData.historyQueries.list[0].id, 'itemId', itemCommand);
    expect(historyQueryRepository.findSouthHistoryQueryItemById).toHaveBeenCalledWith(testData.historyQueries.list[0].id, 'itemId');
    expect(historyQueryRepository.saveSouthHistoryQueryItem).toHaveBeenCalledTimes(1);
    expect(oIAnalyticsMessageService.createFullHistoryQueriesMessageIfNotPending).toHaveBeenCalledTimes(1);
    expect(historyQueryEngine.reloadHistoryQuery).toHaveBeenCalledWith(testData.historyQueries.list[0], false);
  });

  it('updateSouthHistoryQueryItem() should throw an error if item does not exist', async () => {
    (historyQueryRepository.findSouthHistoryQueryItemById as jest.Mock).mockReturnValueOnce(null);
    const itemCommand = JSON.parse(JSON.stringify(testData.south.itemCommand));
    itemCommand.settings = {
      regex: '*',
      preserveFiles: true,
      ignoreModifiedDate: false,
      minAge: 100
    };
    await expect(service.updateSouthHistoryQueryItem(testData.historyQueries.list[0].id, 'itemId', itemCommand)).rejects.toThrow(
      `History query south item with ID itemId does not exist`
    );
  });

  it('updateSouthHistoryQueryItem() should throw an error if history query does not exist', async () => {
    (historyQueryRepository.findHistoryQueryById as jest.Mock).mockReturnValueOnce(null);
    (historyQueryRepository.findSouthHistoryQueryItemById as jest.Mock).mockReturnValueOnce(testData.historyQueries.list[0].southItems[0]);

    const itemCommand = JSON.parse(JSON.stringify(testData.south.itemCommand));
    itemCommand.settings = {
      regex: '*',
      preserveFiles: true,
      ignoreModifiedDate: false,
      minAge: 100
    };
    await expect(service.updateSouthHistoryQueryItem(testData.historyQueries.list[0].id, 'itemId', itemCommand)).rejects.toThrow(
      `History query ${testData.historyQueries.list[0].id} does not exist`
    );
  });

  it('updateSouthHistoryQueryItem() should throw an error if manifest is not found', async () => {
    (southService.getInstalledSouthManifests as jest.Mock).mockReturnValueOnce([
      {
        ...southManifestList[4] // mssql
      }
    ]);
    const badSouth = JSON.parse(JSON.stringify(testData.historyQueries.list[0]));
    badSouth.southType = 'bad';
    (historyQueryRepository.findHistoryQueryById as jest.Mock).mockReturnValueOnce(badSouth);
    (historyQueryRepository.findSouthHistoryQueryItemById as jest.Mock).mockReturnValueOnce(testData.historyQueries.list[0].southItems[0]);

    const itemCommand = JSON.parse(JSON.stringify(testData.south.itemCommand));
    itemCommand.settings = {
      regex: '*',
      preserveFiles: true,
      ignoreModifiedDate: false,
      minAge: 100
    };
    await expect(service.updateSouthHistoryQueryItem(testData.historyQueries.list[0].id, 'itemId', itemCommand)).rejects.toThrow(
      `South manifest does not exist for type bad`
    );
  });

  it('updateNorthHistoryQueryItem() should update an item', async () => {
    (northService.getInstalledNorthManifests as jest.Mock).mockReturnValueOnce([
      {
        ...northManifestList[4], // file-writer
        id: testData.historyQueries.list[0].northType
      }
    ]);
    (historyQueryRepository.findHistoryQueryById as jest.Mock).mockReturnValueOnce(testData.historyQueries.list[0]);
    (historyQueryRepository.findNorthHistoryQueryItemById as jest.Mock).mockReturnValueOnce(testData.historyQueries.list[0].northItems[0]);
    const itemCommand = JSON.parse(JSON.stringify(testData.north.itemCommand));
    itemCommand.settings = {};
    await service.updateNorthHistoryQueryItem(testData.historyQueries.list[0].id, 'itemId', itemCommand);
    expect(historyQueryRepository.findNorthHistoryQueryItemById).toHaveBeenCalledWith(testData.historyQueries.list[0].id, 'itemId');
    expect(historyQueryRepository.saveNorthHistoryQueryItem).toHaveBeenCalledTimes(1);
    expect(historyQueryEngine.reloadHistoryQuery).toHaveBeenCalledWith(testData.historyQueries.list[0], false);
  });

  it('updateNorthHistoryQueryItem() should throw an error if item does not exist', async () => {
    (historyQueryRepository.findNorthHistoryQueryItemById as jest.Mock).mockReturnValueOnce(null);
    const itemCommand = JSON.parse(JSON.stringify(testData.north.itemCommand));
    itemCommand.settings = {};
    await expect(service.updateNorthHistoryQueryItem(testData.historyQueries.list[0].id, 'itemId', itemCommand)).rejects.toThrow(
      `History query north item with ID itemId does not exist`
    );
  });

  it('updateNorthHistoryQueryItem() should throw an error if history query does not exist', async () => {
    (historyQueryRepository.findHistoryQueryById as jest.Mock).mockReturnValueOnce(null);
    (historyQueryRepository.findNorthHistoryQueryItemById as jest.Mock).mockReturnValueOnce(testData.historyQueries.list[0].northItems[0]);

    const itemCommand = JSON.parse(JSON.stringify(testData.north.itemCommand));
    itemCommand.settings = {};
    await expect(service.updateNorthHistoryQueryItem(testData.historyQueries.list[0].id, 'itemId', itemCommand)).rejects.toThrow(
      `History query ${testData.historyQueries.list[0].id} does not exist`
    );
  });

  it('updateNorthHistoryQueryItem() should throw an error if manifest is not found', async () => {
    (northService.getInstalledNorthManifests as jest.Mock).mockReturnValueOnce([
      {
        ...northManifestList[4], // file-writer
        id: testData.historyQueries.list[0].northType
      }
    ]);
    const badNorth = JSON.parse(JSON.stringify(testData.historyQueries.list[0]));
    badNorth.northType = 'bad';
    (historyQueryRepository.findHistoryQueryById as jest.Mock).mockReturnValueOnce(badNorth);
    (historyQueryRepository.findNorthHistoryQueryItemById as jest.Mock).mockReturnValueOnce(testData.historyQueries.list[0].northItems[0]);

    const itemCommand = JSON.parse(JSON.stringify(testData.north.itemCommand));
    itemCommand.settings = {};
    await expect(service.updateNorthHistoryQueryItem(testData.historyQueries.list[0].id, 'itemId', itemCommand)).rejects.toThrow(
      `North manifest does not exist for type bad`
    );
  });

  it('deleteSouthHistoryQueryItem() should delete an item', async () => {
    (historyQueryRepository.findHistoryQueryById as jest.Mock).mockReturnValueOnce(testData.historyQueries.list[0]);
    (historyQueryRepository.findSouthHistoryQueryItemById as jest.Mock).mockReturnValueOnce(testData.historyQueries.list[0].southItems[0]);
    await service.deleteSouthHistoryQueryItem(testData.historyQueries.list[0].id, 'itemId');
    expect(historyQueryRepository.findSouthHistoryQueryItemById).toHaveBeenCalledWith(testData.historyQueries.list[0].id, 'itemId');
    expect(historyQueryRepository.deleteSouthHistoryQueryItem).toHaveBeenCalledWith(testData.historyQueries.list[0].southItems[0].id);
    expect(oIAnalyticsMessageService.createFullHistoryQueriesMessageIfNotPending).toHaveBeenCalledTimes(1);
    expect(historyQueryEngine.reloadHistoryQuery).toHaveBeenCalledWith(testData.historyQueries.list[0], false);
  });

  it('deleteSouthHistoryQueryItem() should throw an error if item does not exist', async () => {
    (historyQueryRepository.findHistoryQueryById as jest.Mock).mockReturnValueOnce(testData.historyQueries.list[0]);
    (historyQueryRepository.findSouthHistoryQueryItemById as jest.Mock).mockReturnValueOnce(null);

    await expect(service.deleteSouthHistoryQueryItem(testData.historyQueries.list[0].id, 'itemId')).rejects.toThrow(
      `History query south item itemId not found`
    );
  });

  it('deleteSouthHistoryQueryItem() should throw an error if connector does not exist', async () => {
    (historyQueryRepository.findHistoryQueryById as jest.Mock).mockReturnValueOnce(null);

    await expect(service.deleteSouthHistoryQueryItem(testData.historyQueries.list[0].id, 'itemId')).rejects.toThrow(
      `History query ${testData.historyQueries.list[0].id} does not exist`
    );
  });

  it('deleteNorthHistoryQueryItem() should delete an item', async () => {
    (historyQueryRepository.findHistoryQueryById as jest.Mock).mockReturnValueOnce(testData.historyQueries.list[0]);
    (historyQueryRepository.findNorthHistoryQueryItemById as jest.Mock).mockReturnValueOnce(testData.historyQueries.list[0].northItems[0]);
    await service.deleteNorthHistoryQueryItem(testData.historyQueries.list[0].id, 'itemId');
    expect(historyQueryRepository.findNorthHistoryQueryItemById).toHaveBeenCalledWith(testData.historyQueries.list[0].id, 'itemId');
    expect(historyQueryRepository.deleteNorthHistoryQueryItem).toHaveBeenCalledWith(testData.historyQueries.list[0].northItems[0].id);
    expect(historyQueryEngine.reloadHistoryQuery).toHaveBeenCalledWith(testData.historyQueries.list[0], false);
  });

  it('deleteNorthHistoryQueryItem() should throw an error if item does not exist', async () => {
    (historyQueryRepository.findHistoryQueryById as jest.Mock).mockReturnValueOnce(testData.historyQueries.list[0]);
    (historyQueryRepository.findNorthHistoryQueryItemById as jest.Mock).mockReturnValueOnce(null);

    await expect(service.deleteNorthHistoryQueryItem(testData.historyQueries.list[0].id, 'itemId')).rejects.toThrow(
      `History query north item itemId not found`
    );
  });

  it('deleteNorthHistoryQueryItem() should throw an error if connector does not exist', async () => {
    (historyQueryRepository.findHistoryQueryById as jest.Mock).mockReturnValueOnce(null);

    await expect(service.deleteNorthHistoryQueryItem(testData.historyQueries.list[0].id, 'itemId')).rejects.toThrow(
      `History query ${testData.historyQueries.list[0].id} does not exist`
    );
  });

  it('deleteAllSouthItemsForHistoryQuery() should delete all items', async () => {
    (historyQueryRepository.findHistoryQueryById as jest.Mock).mockReturnValueOnce(testData.historyQueries.list[0]);
    await service.deleteAllSouthItemsForHistoryQuery(testData.historyQueries.list[0].id);
    expect(historyQueryRepository.deleteAllSouthHistoryQueryItemsByHistoryQuery).toHaveBeenCalledWith(testData.historyQueries.list[0].id);
    expect(oIAnalyticsMessageService.createFullHistoryQueriesMessageIfNotPending).toHaveBeenCalledTimes(1);
    expect(historyQueryEngine.reloadHistoryQuery).toHaveBeenCalledWith(testData.historyQueries.list[0], true);
  });

  it('deleteAllSouthItemsForHistoryQuery() should throw an error if connector does not exist', async () => {
    (historyQueryRepository.findHistoryQueryById as jest.Mock).mockReturnValueOnce(null);

    await expect(service.deleteAllSouthItemsForHistoryQuery(testData.historyQueries.list[0].id)).rejects.toThrow(
      `History query ${testData.historyQueries.list[0].id} not found`
    );
  });

  it('deleteAllNorthItemsForHistoryQuery() should delete all items', async () => {
    (historyQueryRepository.findHistoryQueryById as jest.Mock).mockReturnValueOnce(testData.historyQueries.list[0]);
    await service.deleteAllNorthItemsForHistoryQuery(testData.historyQueries.list[0].id);
    expect(historyQueryRepository.deleteAllNorthHistoryQueryItemsByHistoryQuery).toHaveBeenCalledWith(testData.historyQueries.list[0].id);
    expect(historyQueryEngine.reloadHistoryQuery).toHaveBeenCalledWith(testData.historyQueries.list[0], true);
  });

  it('deleteAllNorthItemsForHistoryQuery() should throw an error if connector does not exist', async () => {
    (historyQueryRepository.findHistoryQueryById as jest.Mock).mockReturnValueOnce(null);

    await expect(service.deleteAllNorthItemsForHistoryQuery(testData.historyQueries.list[0].id)).rejects.toThrow(
      `History query ${testData.historyQueries.list[0].id} not found`
    );
  });

  it('enableSouthHistoryQueryItem() should enable an item', async () => {
    (historyQueryRepository.findHistoryQueryById as jest.Mock).mockReturnValueOnce(testData.historyQueries.list[0]);
    (historyQueryRepository.findSouthHistoryQueryItemById as jest.Mock).mockReturnValueOnce(testData.historyQueries.list[0].southItems[0]);
    await service.enableSouthHistoryQueryItem(testData.historyQueries.list[0].id, 'itemId');
    expect(historyQueryRepository.findSouthHistoryQueryItemById).toHaveBeenCalledWith(testData.historyQueries.list[0].id, 'itemId');
    expect(historyQueryRepository.enableSouthHistoryQueryItem).toHaveBeenCalledWith(testData.historyQueries.list[0].southItems[0].id);
    expect(oIAnalyticsMessageService.createFullHistoryQueriesMessageIfNotPending).toHaveBeenCalledTimes(1);
    expect(historyQueryEngine.reloadHistoryQuery).toHaveBeenCalledWith(testData.historyQueries.list[0], false);
  });

  it('enableSouthHistoryQueryItem() should throw an error if item is not found', async () => {
    (historyQueryRepository.findSouthHistoryQueryItemById as jest.Mock).mockReturnValueOnce(null);
    await expect(service.enableSouthHistoryQueryItem(testData.historyQueries.list[0].id, 'itemId')).rejects.toThrow(
      'History query south item itemId not found'
    );
  });

  it('enableNorthHistoryQueryItem() should enable an item', async () => {
    (historyQueryRepository.findHistoryQueryById as jest.Mock).mockReturnValueOnce(testData.historyQueries.list[0]);
    (historyQueryRepository.findNorthHistoryQueryItemById as jest.Mock).mockReturnValueOnce(testData.historyQueries.list[0].southItems[0]);
    await service.enableNorthHistoryQueryItem(testData.historyQueries.list[0].id, 'itemId');
    expect(historyQueryRepository.findNorthHistoryQueryItemById).toHaveBeenCalledWith(testData.historyQueries.list[0].id, 'itemId');
    expect(historyQueryRepository.enableNorthHistoryQueryItem).toHaveBeenCalledWith(testData.historyQueries.list[0].southItems[0].id);
    expect(historyQueryEngine.reloadHistoryQuery).toHaveBeenCalledWith(testData.historyQueries.list[0], false);
  });

  it('enableNorthHistoryQueryItem() should throw an error if item is not found', async () => {
    (historyQueryRepository.findNorthHistoryQueryItemById as jest.Mock).mockReturnValueOnce(null);
    await expect(service.enableNorthHistoryQueryItem(testData.historyQueries.list[0].id, 'itemId')).rejects.toThrow(
      'History query north item itemId not found'
    );
  });

  it('disableSouthHistoryQueryItem() should disable an item', async () => {
    (historyQueryRepository.findHistoryQueryById as jest.Mock).mockReturnValueOnce(testData.historyQueries.list[0]);
    (historyQueryRepository.findSouthHistoryQueryItemById as jest.Mock).mockReturnValueOnce(testData.historyQueries.list[0].southItems[0]);
    await service.disableSouthHistoryQueryItem(testData.historyQueries.list[0].id, 'itemId');
    expect(historyQueryRepository.findSouthHistoryQueryItemById).toHaveBeenCalledWith(testData.historyQueries.list[0].id, 'itemId');
    expect(historyQueryRepository.disableSouthHistoryQueryItem).toHaveBeenCalledWith(testData.historyQueries.list[0].southItems[0].id);
    expect(oIAnalyticsMessageService.createFullHistoryQueriesMessageIfNotPending).toHaveBeenCalledTimes(1);
    expect(historyQueryEngine.reloadHistoryQuery).toHaveBeenCalledWith(testData.historyQueries.list[0], false);
  });

  it('disableSouthHistoryQueryItem() should throw an error if item is not found', async () => {
    (historyQueryRepository.findSouthHistoryQueryItemById as jest.Mock).mockReturnValueOnce(null);
    await expect(service.disableSouthHistoryQueryItem(testData.historyQueries.list[0].id, 'itemId')).rejects.toThrow(
      'History query south item itemId not found'
    );
  });

  it('disableNorthHistoryQueryItem() should disable an item', async () => {
    (historyQueryRepository.findHistoryQueryById as jest.Mock).mockReturnValueOnce(testData.historyQueries.list[0]);
    (historyQueryRepository.findNorthHistoryQueryItemById as jest.Mock).mockReturnValueOnce(testData.historyQueries.list[0].northItems[0]);
    await service.disableNorthHistoryQueryItem(testData.historyQueries.list[0].id, 'itemId');
    expect(historyQueryRepository.findNorthHistoryQueryItemById).toHaveBeenCalledWith(testData.historyQueries.list[0].id, 'itemId');
    expect(historyQueryRepository.disableNorthHistoryQueryItem).toHaveBeenCalledWith(testData.historyQueries.list[0].northItems[0].id);
    expect(historyQueryEngine.reloadHistoryQuery).toHaveBeenCalledWith(testData.historyQueries.list[0], false);
  });

  it('disableNorthHistoryQueryItem() should throw an error if item is not found', async () => {
    (historyQueryRepository.findNorthHistoryQueryItemById as jest.Mock).mockReturnValueOnce(null);
    await expect(service.disableNorthHistoryQueryItem(testData.historyQueries.list[0].id, 'itemId')).rejects.toThrow(
      'History query north item itemId not found'
    );
  });

  it('checkSouthCsvFileImport() should properly parse csv and check items', async () => {
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
    const result = await service.checkSouthCsvFileImport(
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

  it('checkSouthCsvFileImport() should properly parse csv and check items with array or object', async () => {
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
    const result = await service.checkSouthCsvFileImport(
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

  it('checkSouthCsvContentImport() should throw error if manifest not found', async () => {
    (southService.getInstalledSouthManifests as jest.Mock).mockReturnValueOnce([
      {
        ...testData.south.manifest,
        id: testData.historyQueries.command.southType
      }
    ]);
    await expect(service.checkSouthCsvContentImport('bad', 'fileContent', ',', testData.south.list[0].items)).rejects.toThrow(
      `South manifest does not exist for type bad`
    );
  });

  it('checkSouthCsvFileImport() should throw error if delimiter does not match', async () => {
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
      service.checkSouthCsvFileImport(
        testData.historyQueries.command.southType,
        { path: 'file/path.csv' } as multer.File,
        ',',
        testData.south.list[0].items
      )
    ).rejects.toThrow(`The entered delimiter "," does not correspond to the file delimiter ";"`);
  });

  it('checkNorthCsvFileImport() should properly parse csv and check items with array or object', async () => {
    (northService.getInstalledNorthManifests as jest.Mock).mockReturnValueOnce([
      {
        ...northManifestList[4], // file-writer
        id: testData.historyQueries.command.northType
      }
    ]);
    const csvData = [
      {
        name: 'item',
        enabled: 'true'
      }
    ];
    (fs.readFile as jest.Mock).mockReturnValueOnce('file content');
    (csv.parse as jest.Mock).mockReturnValueOnce({
      meta: { delimiter: ',' },
      data: csvData
    });
    const result = await service.checkNorthCsvFileImport(
      testData.historyQueries.command.northType,
      { path: 'file/path.csv' } as multer.File,
      ',',
      testData.north.list[1].items
    );
    expect(result).toEqual({
      items: [
        {
          id: '',
          name: csvData[0].name,
          enabled: csvData[0].enabled.toLowerCase() === 'true',
          settings: {}
        }
      ],
      errors: []
    });
  });

  it('checkNorthCsvContentImport() should throw error if manifest not found', async () => {
    (northService.getInstalledNorthManifests as jest.Mock).mockReturnValueOnce([
      {
        ...testData.north.manifest,
        id: testData.historyQueries.command.northType
      }
    ]);
    await expect(service.checkNorthCsvContentImport('bad', 'fileContent', ',', testData.north.list[0].items)).rejects.toThrow(
      `North manifest does not exist for type bad`
    );
  });

  it('checkNorthCsvFileImport() should throw error if delimiter does not match', async () => {
    (northService.getInstalledNorthManifests as jest.Mock).mockReturnValueOnce([
      {
        ...testData.north.manifest,
        id: testData.historyQueries.command.northType
      }
    ]);
    (fs.readFile as jest.Mock).mockReturnValueOnce('file content');
    (csv.parse as jest.Mock).mockReturnValueOnce({
      meta: { delimiter: ';' },
      data: []
    });

    await expect(
      service.checkNorthCsvFileImport(
        testData.historyQueries.command.northType,
        { path: 'file/path.csv' } as multer.File,
        ',',
        testData.north.list[0].items
      )
    ).rejects.toThrow(`The entered delimiter "," does not correspond to the file delimiter ";"`);
  });

  it('importSouthItems() should import items', async () => {
    (southService.getInstalledSouthManifests as jest.Mock).mockReturnValueOnce([
      {
        ...testData.south.manifest,
        id: testData.historyQueries.command.southType
      }
    ]);
    const itemCommand = JSON.parse(JSON.stringify(testData.historyQueries.southItemCommand));
    itemCommand.id = null;
    itemCommand.settings = {
      regex: '*',
      preserveFiles: true,
      ignoreModifiedDate: false,
      minAge: 100
    };
    (historyQueryRepository.findHistoryQueryById as jest.Mock).mockReturnValueOnce(testData.historyQueries.list[0]);

    await service.importSouthItems(testData.historyQueries.list[0].id, [itemCommand]);
    expect(historyQueryRepository.saveAllSouthItems).toHaveBeenCalledTimes(1);
    expect(oIAnalyticsMessageService.createFullHistoryQueriesMessageIfNotPending).toHaveBeenCalledTimes(1);
    expect(historyQueryEngine.reloadHistoryQuery).toHaveBeenCalledWith(testData.historyQueries.list[0], false);
  });

  it('importSouthItems() should import items', async () => {
    (southService.getInstalledSouthManifests as jest.Mock).mockReturnValueOnce([
      {
        ...testData.south.manifest,
        id: testData.historyQueries.command.southType
      }
    ]);
    const itemCommand = JSON.parse(JSON.stringify(testData.historyQueries.southItemCommand));
    itemCommand.settings = {
      regex: '*',
      preserveFiles: true,
      ignoreModifiedDate: false,
      minAge: 100
    };
    (historyQueryRepository.findHistoryQueryById as jest.Mock).mockReturnValueOnce(null);

    await expect(service.importSouthItems(testData.historyQueries.list[0].id, [itemCommand])).rejects.toThrow(
      `History query ${testData.historyQueries.list[0].id} does not exist`
    );
  });

  it('importNorthItems() should import items', async () => {
    (northService.getInstalledNorthManifests as jest.Mock).mockReturnValueOnce([
      {
        ...testData.north.manifest,
        id: testData.historyQueries.list[0].northType
      }
    ]);
    const itemCommand = JSON.parse(JSON.stringify(testData.historyQueries.northItemCommand));
    itemCommand.id = null;
    itemCommand.settings = {};
    (historyQueryRepository.findHistoryQueryById as jest.Mock).mockReturnValueOnce(testData.historyQueries.list[0]);

    await service.importNorthItems(testData.historyQueries.list[0].id, [itemCommand]);
    expect(historyQueryRepository.saveAllNorthItems).toHaveBeenCalledTimes(1);
    expect(historyQueryEngine.reloadHistoryQuery).toHaveBeenCalledWith(testData.historyQueries.list[0], false);
  });

  it('importNorthItems() should import items', async () => {
    (northService.getInstalledNorthManifests as jest.Mock).mockReturnValueOnce([
      {
        ...testData.north.manifest,
        id: testData.historyQueries.command.northType
      }
    ]);
    const itemCommand = JSON.parse(JSON.stringify(testData.historyQueries.northItemCommand));
    itemCommand.settings = {};
    (historyQueryRepository.findHistoryQueryById as jest.Mock).mockReturnValueOnce(null);

    await expect(service.importNorthItems(testData.historyQueries.list[0].id, [itemCommand])).rejects.toThrow(
      `History query ${testData.historyQueries.list[0].id} does not exist`
    );
  });

  it('retrieveSecrets() should retrieve secrets from history query', () => {
    const historySource = JSON.parse(JSON.stringify(testData.historyQueries.list[0]));
    historySource.southType = southManifestList[4].id;
    historySource.northType = northManifestList[4].id;
    (historyQueryRepository.findHistoryQueryById as jest.Mock).mockReturnValueOnce(historySource);
    const result = service.retrieveSecrets(null, null, testData.historyQueries.list[0].id, southManifestList[4], northManifestList[4]);
    expect(historyQueryRepository.findHistoryQueryById).toHaveBeenCalledWith(testData.historyQueries.list[0].id);
    expect(result).toEqual(historySource);
  });

  it('retrieveSecrets() should throw an error if history query not found', () => {
    (historyQueryRepository.findHistoryQueryById as jest.Mock).mockReturnValueOnce(null);
    expect(() =>
      service.retrieveSecrets(null, null, testData.historyQueries.list[0].id, southManifestList[4], northManifestList[4])
    ).toThrow(`Could not find history query ${testData.historyQueries.list[0].id} to retrieve secrets from`);
    expect(historyQueryRepository.findHistoryQueryById).toHaveBeenCalledWith(testData.historyQueries.list[0].id);
  });

  it('retrieveSecrets() should throw an error if history query south type does not match manifest', () => {
    const historySource = JSON.parse(JSON.stringify(testData.historyQueries.list[0]));
    historySource.southType = 'bad';
    (historyQueryRepository.findHistoryQueryById as jest.Mock).mockReturnValueOnce(historySource);

    expect(() =>
      service.retrieveSecrets(null, null, testData.historyQueries.list[0].id, southManifestList[4], northManifestList[4])
    ).toThrow(
      `History query ${historySource.id} (south type ${historySource.southType}) must be of the south type ${southManifestList[4].id}`
    );
    expect(historyQueryRepository.findHistoryQueryById).toHaveBeenCalledWith(testData.historyQueries.list[0].id);
  });

  it('retrieveSecrets() should throw an error if history query north type does not match manifest', () => {
    const historySource = JSON.parse(JSON.stringify(testData.historyQueries.list[0]));
    historySource.southType = southManifestList[4].id;
    (historyQueryRepository.findHistoryQueryById as jest.Mock).mockReturnValueOnce(historySource);

    expect(() =>
      service.retrieveSecrets(null, null, testData.historyQueries.list[0].id, southManifestList[4], northManifestList[4])
    ).toThrow(
      `History query ${historySource.id} (north type ${historySource.northType}) must be of the north type ${northManifestList[4].id}`
    );
    expect(historyQueryRepository.findHistoryQueryById).toHaveBeenCalledWith(testData.historyQueries.list[0].id);
  });

  it('retrieveSecrets() should retrieve secrets from south and north connectors', () => {
    const south = JSON.parse(JSON.stringify(testData.south.list[0]));
    south.type = southManifestList[4].id;
    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValueOnce(south);

    const north = JSON.parse(JSON.stringify(testData.north.list[0]));
    north.type = northManifestList[4].id;
    (northConnectorRepository.findNorthById as jest.Mock).mockReturnValueOnce(north);

    const result = service.retrieveSecrets(
      testData.south.list[0].id,
      testData.north.list[0].id,
      null,
      southManifestList[4],
      northManifestList[4]
    );

    expect(result).toEqual({
      southType: south.type,
      southSettings: south.settings,
      southItems: south.items,
      northType: north.type,
      northSettings: north.settings,
      northItems: north.items
    });
  });

  it('retrieveSecrets() should fail to retrieve secrets from south if does not match type', () => {
    const south = JSON.parse(JSON.stringify(testData.south.list[0]));
    south.type = 'bad';
    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValueOnce(south);

    expect(() =>
      service.retrieveSecrets(testData.south.list[0].id, testData.north.list[0].id, null, southManifestList[4], northManifestList[4])
    ).toThrow(`South connector ${testData.south.list[0].id} (type ${south.type}) must be of the type ${southManifestList[4].id}`);
  });

  it('retrieveSecrets() should fail to retrieve secrets from south if not found', () => {
    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValueOnce(null);

    expect(() =>
      service.retrieveSecrets(testData.south.list[0].id, testData.north.list[0].id, null, southManifestList[4], northManifestList[4])
    ).toThrow(`Could not find south connector ${testData.south.list[0].id} to retrieve secrets from`);
  });

  it('retrieveSecrets() should fail to retrieve secrets from north if does not match type', () => {
    const south = JSON.parse(JSON.stringify(testData.south.list[0]));
    south.type = southManifestList[4].id;
    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValueOnce(south);
    const north = JSON.parse(JSON.stringify(testData.north.list[0]));
    north.type = 'bad';
    (northConnectorRepository.findNorthById as jest.Mock).mockReturnValueOnce(north);

    expect(() =>
      service.retrieveSecrets(testData.north.list[0].id, testData.north.list[0].id, null, southManifestList[4], northManifestList[4])
    ).toThrow(`North connector ${testData.north.list[0].id} (type ${north.type}) must be of the type ${northManifestList[4].id}`);
  });

  it('retrieveSecrets() should fail to retrieve secrets from north if not found', () => {
    const south = JSON.parse(JSON.stringify(testData.south.list[0]));
    south.type = southManifestList[4].id;
    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValueOnce(south);
    (northConnectorRepository.findNorthById as jest.Mock).mockReturnValueOnce(null);

    expect(() =>
      service.retrieveSecrets(testData.north.list[0].id, testData.north.list[0].id, null, southManifestList[4], northManifestList[4])
    ).toThrow(`Could not find north connector ${testData.north.list[0].id} to retrieve secrets from`);
  });

  it('retrieveSecrets() should return null', () => {
    expect(service.retrieveSecrets(null, null, null, southManifestList[4], northManifestList[4])).toEqual(null);
  });
});
