import PinoLogger from '../tests/__mocks__/service/logger/logger.mock';
import SouthServiceMock from '../tests/__mocks__/service/south-service.mock';
import NorthServiceMock from '../tests/__mocks__/service/north-service.mock';

import SouthService from '../service/south.service';
import NorthService from '../service/north.service';

import pino from 'pino';
import HistoryQueryEngine from './history-query-engine';
import fs from 'node:fs/promises';
import path from 'node:path';
import { filesExists } from '../service/utils';
import testData from '../tests/utils/test-data';
import HistoryQueryRepository from '../repository/config/history-query.repository';
import HistoryQueryRepositoryMock from '../tests/__mocks__/repository/config/history-query-repository.mock';
import HistoryQueryMock from '../tests/__mocks__/history-query.mock';
import HistoryQueryMetricsRepository from '../repository/logs/history-query-metrics.repository';
import HistoryQueryMetricsRepositoryMock from '../tests/__mocks__/repository/log/history-query-metrics-repository.mock';

jest.mock('../service/south.service');
jest.mock('../service/north.service');
jest.mock('../service/history-query.service');
jest.mock('../service/repository.service');
jest.mock('../service/encryption.service');
jest.mock('node:fs/promises');

jest.mock('../service/utils');

const logger: pino.Logger = new PinoLogger();
const anotherLogger: pino.Logger = new PinoLogger();

const southService: SouthService = new SouthServiceMock();
const northService: NorthService = new NorthServiceMock();
const historyQueryMetricsRepository: HistoryQueryMetricsRepository = new HistoryQueryMetricsRepositoryMock();
const historyQueryRepository: HistoryQueryRepository = new HistoryQueryRepositoryMock();

describe('HistoryQueryEngine', () => {
  let engine: HistoryQueryEngine;

  const mockedHistoryQuery1 = new HistoryQueryMock(
    testData.historyQueries.list[0],
    southService,
    northService,
    historyQueryRepository,
    'baseFolder',
    logger
  );
  const mockedHistoryQuery2 = new HistoryQueryMock(
    testData.historyQueries.list[1],
    southService,
    northService,
    historyQueryRepository,
    'baseFolder',
    logger
  );

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));
    (logger.child as jest.Mock).mockReturnValue(logger);

    engine = new HistoryQueryEngine(historyQueryMetricsRepository, logger);
  });

  it('it should start connectors and stop all', async () => {
    await engine.start([mockedHistoryQuery1, mockedHistoryQuery2]);

    expect(engine.logger).toBeDefined();
    expect(engine.baseFolder).toBeDefined();

    (mockedHistoryQuery1.start as jest.Mock).mockImplementationOnce(() => Promise.reject(new Error('start fail')));
    await engine.startHistoryQuery(testData.historyQueries.list[0].id);
    expect(logger.error).toHaveBeenCalledWith(
      `Error while starting History Query "${mockedHistoryQuery1.settings.name}" (${mockedHistoryQuery1.settings.id}): start fail`
    );
    await engine.stop();
    expect(mockedHistoryQuery1.stop).toHaveBeenCalledTimes(1);
    await engine.stopHistoryQuery('anotherId');
    expect(mockedHistoryQuery1.stop).toHaveBeenCalledTimes(1);
    await engine.resetCache('anotherId');
    expect(mockedHistoryQuery1.resetCache).not.toHaveBeenCalled();
  });

  it('should reload history query', async () => {
    await engine.start([mockedHistoryQuery1]);

    await engine.reloadHistoryQuery({ ...testData.historyQueries.list[0], id: 'bad id' }, false);

    await engine.reloadHistoryQuery(testData.historyQueries.list[0], true);

    expect(mockedHistoryQuery1.stop).toHaveBeenCalled();
    expect(mockedHistoryQuery1.resetCache).toHaveBeenCalledTimes(1);
    expect(mockedHistoryQuery1.setLogger).toHaveBeenCalledTimes(1);
    expect(logger.child).toHaveBeenCalledTimes(1);
    expect(mockedHistoryQuery1.start).toHaveBeenCalled();
  });

  it('should not start history query if not set', async () => {
    await engine.startHistoryQuery('bad id');
    expect(logger.trace).toHaveBeenCalledWith(`History Query "bad id" not set`);
  });

  it('should properly set logger', async () => {
    await engine.start([mockedHistoryQuery1, mockedHistoryQuery2]);
    engine.setLogger(anotherLogger);
    expect(anotherLogger.child).toHaveBeenCalledWith({
      scopeType: 'history-query',
      scopeId: testData.historyQueries.list[1].id,
      scopeName: testData.historyQueries.list[1].name
    });
  });

  it('should delete History Query', async () => {
    (filesExists as jest.Mock).mockImplementationOnce(() => Promise.resolve(true)).mockImplementationOnce(() => Promise.resolve(false));
    const stopHistoryQuerySpy = jest.spyOn(engine, 'stopHistoryQuery');

    await engine.start([mockedHistoryQuery1, mockedHistoryQuery2]);
    const baseFolder = path.resolve('./cache/history-query', `history-${testData.historyQueries.list[0].id}`);
    await engine.deleteHistoryQuery(testData.historyQueries.list[0]);

    expect(stopHistoryQuerySpy).toHaveBeenCalled();
    expect(filesExists).toHaveBeenCalledWith(baseFolder);
    expect(fs.rm).toHaveBeenCalledWith(baseFolder, { recursive: true });
    expect(logger.trace).toHaveBeenCalledWith(
      `Deleting base folder "${baseFolder}" of History query "${testData.historyQueries.list[0].name}" (${testData.historyQueries.list[0].id})`
    );
    expect(logger.info).toHaveBeenCalledWith(
      `Deleted History query "${testData.historyQueries.list[0].name}" (${testData.historyQueries.list[0].id})`
    );

    // Removing again should not call rm, meaning that it's actually removed
    await engine.deleteHistoryQuery(testData.historyQueries.list[0]);
    expect(fs.rm).toHaveBeenCalledTimes(1);
  });

  it('should handle deletion errors', async () => {
    (filesExists as jest.Mock).mockImplementation(() => Promise.resolve(true));
    const stopHistoryQuerySpy = jest.spyOn(engine, 'stopHistoryQuery');

    await engine.start([mockedHistoryQuery1, mockedHistoryQuery2]);

    const error = new Error(`Can't remove folder`);
    (fs.rm as jest.Mock).mockImplementation(() => {
      throw error;
    });

    const baseFolder = path.resolve('./cache/history-query', `history-${testData.historyQueries.list[0].id}`);
    await engine.deleteHistoryQuery(testData.historyQueries.list[0]);

    expect(stopHistoryQuerySpy).toHaveBeenCalled();
    expect(filesExists).toHaveBeenCalled();
    expect(logger.trace).toHaveBeenCalledWith(
      `Deleting base folder "${baseFolder}" of History query "${testData.historyQueries.list[0].name}" (${testData.historyQueries.list[0].id})`
    );
    expect(logger.error).toHaveBeenCalledWith(
      `Unable to delete History query "${testData.historyQueries.list[0].name}" (${testData.historyQueries.list[0].id}) base folder: ${error}`
    );
  });

  it('should get data stream', async () => {
    await engine.start([mockedHistoryQuery1]);

    expect(engine.getHistoryQueryDataStream(testData.historyQueries.list[0].id)).not.toBeNull();
    expect(engine.getHistoryQueryDataStream('bad id')).toBeNull();
  });
});
