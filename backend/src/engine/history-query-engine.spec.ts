import PinoLogger from '../tests/__mocks__/service/logger/logger.mock';
import SouthServiceMock from '../tests/__mocks__/service/south-service.mock';
import NorthServiceMock from '../tests/__mocks__/service/north-service.mock';

import SouthService from '../service/south.service';
import NorthService from '../service/north.service';

import pino from 'pino';
import HistoryQueryEngine from './history-query-engine';
import testData from '../tests/utils/test-data';
import HistoryQueryRepository from '../repository/config/history-query.repository';
import HistoryQueryRepositoryMock from '../tests/__mocks__/repository/config/history-query-repository.mock';
import HistoryQueryMock from '../tests/__mocks__/history-query.mock';
import HistoryQueryMetricsRepository from '../repository/metrics/history-query-metrics.repository';
import HistoryQueryMetricsRepositoryMock from '../tests/__mocks__/repository/metrics/history-query-metrics-repository.mock';

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
    expect(engine.baseFolders).toBeDefined();

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
    const stopHistoryQuerySpy = jest.spyOn(engine, 'stopHistoryQuery');

    await engine.start([mockedHistoryQuery1, mockedHistoryQuery2]);
    await engine.deleteHistoryQuery(testData.historyQueries.list[0]);

    expect(stopHistoryQuerySpy).toHaveBeenCalled();
  });

  it('should get data stream', async () => {
    await engine.start([mockedHistoryQuery1]);

    expect(engine.getHistoryQueryDataStream(testData.historyQueries.list[0].id)).not.toBeNull();
    expect(engine.getHistoryQueryDataStream('bad id')).toBeNull();
  });

  it('should manage content files', async () => {
    await engine.start([mockedHistoryQuery1]);

    await engine.searchCacheContent(
      'bad id',
      { start: testData.constants.dates.DATE_1, end: testData.constants.dates.DATE_2, nameContains: 'file' },
      'cache'
    );
    expect(mockedHistoryQuery1.searchCacheContent).not.toHaveBeenCalled();
    await engine.searchCacheContent(
      testData.historyQueries.list[0].id,
      { start: testData.constants.dates.DATE_1, end: testData.constants.dates.DATE_2, nameContains: 'file' },
      'cache'
    );
    expect(mockedHistoryQuery1.searchCacheContent).toHaveBeenCalledWith(
      { start: testData.constants.dates.DATE_1, end: testData.constants.dates.DATE_2, nameContains: 'file' },
      'cache'
    );

    await engine.getCacheContentFileStream('bad id', 'cache', 'file');
    expect(mockedHistoryQuery1.getCacheContentFileStream).not.toHaveBeenCalled();
    await engine.getCacheContentFileStream(testData.historyQueries.list[0].id, 'cache', 'file');
    expect(mockedHistoryQuery1.getCacheContentFileStream).toHaveBeenCalledWith('cache', 'file');

    await engine.removeCacheContent('bad id', 'cache', ['file']);
    expect(mockedHistoryQuery1.removeCacheContent).not.toHaveBeenCalled();
    await engine.removeCacheContent(testData.historyQueries.list[0].id, 'cache', ['file']);
    expect(mockedHistoryQuery1.removeCacheContent).toHaveBeenCalledWith('cache', ['file']);

    await engine.removeAllCacheContent('bad id', 'cache');
    expect(mockedHistoryQuery1.removeAllCacheContent).not.toHaveBeenCalled();
    await engine.removeAllCacheContent(testData.historyQueries.list[0].id, 'cache');
    expect(mockedHistoryQuery1.removeAllCacheContent).toHaveBeenCalled();

    await engine.moveCacheContent('bad id', 'cache', 'error', ['file']);
    expect(mockedHistoryQuery1.moveCacheContent).not.toHaveBeenCalled();
    await engine.moveCacheContent(testData.historyQueries.list[0].id, 'cache', 'error', ['file']);
    expect(mockedHistoryQuery1.moveCacheContent).toHaveBeenCalledWith('cache', 'error', ['file']);

    await engine.moveAllCacheContent('bad id', 'cache', 'error');
    expect(mockedHistoryQuery1.moveAllCacheContent).not.toHaveBeenCalled();
    await engine.moveAllCacheContent(testData.historyQueries.list[0].id, 'cache', 'error');
    expect(mockedHistoryQuery1.moveAllCacheContent).toHaveBeenCalledWith('cache', 'error');
  });
});
