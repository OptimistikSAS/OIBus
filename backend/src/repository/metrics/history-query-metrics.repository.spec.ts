import { Database } from 'better-sqlite3';
import { emptyDatabase, initDatabase } from '../../tests/utils/test-utils';
import testData from '../../tests/utils/test-data';
import HistoryQueryMetricsRepository from './history-query-metrics.repository';
import { HistoryQueryMetrics } from '../../../shared/model/engine.model';

const TEST_DB_PATH = 'src/tests/test-metrics-history-query.db';

let database: Database;
describe('HistoryQueryMetricsRepository with populated database', () => {
  beforeAll(async () => {
    database = await initDatabase('metrics', true, TEST_DB_PATH);
  });

  afterAll(async () => {
    database.close();
    await emptyDatabase('metrics', TEST_DB_PATH);
  });

  let repository: HistoryQueryMetricsRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));
    repository = new HistoryQueryMetricsRepository(database);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should get metrics', () => {
    repository.initMetrics(testData.historyQueries.list[0].id);
    const result = repository.getMetrics(testData.historyQueries.list[0].id);
    expect(result).toEqual(testData.historyQueries.metrics);
  });

  it('should update metrics', () => {
    const newMetrics: HistoryQueryMetrics = JSON.parse(JSON.stringify(testData.historyQueries.metrics));
    newMetrics.metricsStart = testData.constants.dates.DATE_1;
    newMetrics.south.numberOfFilesRetrieved = 45;
    newMetrics.south.lastValueRetrieved = {
      pointId: 'my reference',
      timestamp: testData.constants.dates.DATE_3,
      data: { value: 'my value' }
    };
    newMetrics.north.lastContentSent = 'file.csv';
    repository.updateMetrics(testData.historyQueries.list[0].id, newMetrics);

    const result = repository.getMetrics(testData.historyQueries.list[0].id)!;
    expect(result.metricsStart).toEqual(newMetrics.metricsStart);
    expect(result.south.numberOfFilesRetrieved).toEqual(newMetrics.south.numberOfFilesRetrieved);
    expect(result.south.lastValueRetrieved).toEqual(newMetrics.south.lastValueRetrieved);

    newMetrics.south.lastValueRetrieved = null;
    newMetrics.north.lastContentSent = null;
    repository.updateMetrics(testData.historyQueries.list[0].id, newMetrics);
    const resultWithoutValue = repository.getMetrics(testData.historyQueries.list[0].id)!;
    expect(resultWithoutValue.south.lastValueRetrieved).toEqual(null);
    expect(resultWithoutValue.north.lastContentSent).toEqual(null);
  });

  it('should remove metrics', () => {
    repository.removeMetrics(testData.historyQueries.list[0].id);
    expect(repository.getMetrics(testData.historyQueries.list[0].id)).toEqual(null);
  });
});

describe('HistoryQueryMetricsRepository with empty database', () => {
  beforeAll(async () => {
    database = await initDatabase('metrics', false, TEST_DB_PATH);
  });

  afterAll(async () => {
    database.close();
    await emptyDatabase('metrics', TEST_DB_PATH);
  });

  let repository: HistoryQueryMetricsRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));
    repository = new HistoryQueryMetricsRepository(database);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should init and get metrics', () => {
    repository.initMetrics(testData.historyQueries.list[0].id);
    const result = repository.getMetrics(testData.historyQueries.list[0].id);
    expect(result).toEqual({
      metricsStart: testData.constants.dates.FAKE_NOW,
      north: {
        lastConnection: null,
        lastRunStart: null,
        lastRunDuration: null,
        contentSentSize: 0,
        contentCachedSize: 0,
        contentErroredSize: 0,
        contentArchivedSize: 0,
        lastContentSent: null,
        currentCacheSize: 0,
        currentErrorSize: 0,
        currentArchiveSize: 0
      },
      south: {
        lastConnection: null,
        lastRunStart: null,
        lastRunDuration: null,
        numberOfValuesRetrieved: 0,
        numberOfFilesRetrieved: 0,
        lastValueRetrieved: null,
        lastFileRetrieved: null
      },
      historyMetrics: {
        running: false,
        intervalProgress: 0,
        currentIntervalStart: null,
        currentIntervalEnd: null,
        currentIntervalNumber: 0,
        numberOfIntervals: 0
      }
    });
  });
});
