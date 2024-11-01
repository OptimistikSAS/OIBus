import HistoryQueryService from './history-query.service';
import ScanModeRepository from '../repository/config/scan-mode.repository';
import ScanModeRepositoryMock from '../tests/__mocks__/repository/config/scan-mode-repository.mock';
import HistoryQueryRepository from '../repository/config/history-query.repository';
import HistoryQueryRepositoryMock from '../tests/__mocks__/repository/config/history-query-repository.mock';
import LogRepository from '../repository/logs/log.repository';
import LogRepositoryMock from '../tests/__mocks__/repository/log/log-repository.mock';
import SouthService from './south.service';
import NorthService from './north.service';
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

jest.mock('node:fs/promises');

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
describe('history query service', () => {
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

  it('should create History query', () => {
    const historyQuery = service.runHistoryQuery(testData.historyQueries.list[0], mockBaseFolders(testData.historyQueries.list[0].id));
    expect(historyQuery).toBeDefined();
    expect(historyQuery['baseFolders']).toEqual(mockBaseFolders(testData.historyQueries.list[0].id));
  });

  it('shold create History query with default base folders', () => {
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
});
