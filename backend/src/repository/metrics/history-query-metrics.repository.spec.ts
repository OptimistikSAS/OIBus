import { before, after, beforeEach, afterEach, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { Database } from 'better-sqlite3';
import { emptyDatabase, initDatabase } from '../../tests/utils/test-utils';
import testData from '../../tests/utils/test-data';
import HistoryQueryMetricsRepository from './history-query-metrics.repository';
import { HistoryQueryMetrics } from '../../../shared/model/engine.model';

const TEST_DB_PATH = 'src/tests/test-metrics-history-query.db';

let database: Database;
describe('HistoryQueryMetricsRepository with populated database', () => {
  before(async () => {
    database = await initDatabase('metrics', true, TEST_DB_PATH);
  });

  after(async () => {
    database.close();
    await emptyDatabase('metrics', TEST_DB_PATH);
  });

  let repository: HistoryQueryMetricsRepository;

  beforeEach(() => {
    mock.timers.enable({ apis: ['Date'], now: new Date(testData.constants.dates.FAKE_NOW) });
    repository = new HistoryQueryMetricsRepository(database);
  });

  afterEach(() => {
    mock.timers.reset();
  });

  it('should get metrics', () => {
    repository.initMetrics(testData.historyQueries.list[0].id);
    const result = repository.getMetrics(testData.historyQueries.list[0].id);
    assert.deepStrictEqual(result, testData.historyQueries.metrics);
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
    assert.strictEqual(result.metricsStart, newMetrics.metricsStart);
    assert.strictEqual(result.south.numberOfFilesRetrieved, newMetrics.south.numberOfFilesRetrieved);
    assert.deepStrictEqual(result.south.lastValueRetrieved, newMetrics.south.lastValueRetrieved);

    newMetrics.south.lastValueRetrieved = null;
    newMetrics.north.lastContentSent = null;
    repository.updateMetrics(testData.historyQueries.list[0].id, newMetrics);
    const resultWithoutValue = repository.getMetrics(testData.historyQueries.list[0].id)!;
    assert.strictEqual(resultWithoutValue.south.lastValueRetrieved, null);
    assert.strictEqual(resultWithoutValue.north.lastContentSent, null);
  });

  it('should remove metrics', () => {
    repository.removeMetrics(testData.historyQueries.list[0].id);
    assert.strictEqual(repository.getMetrics(testData.historyQueries.list[0].id), null);
  });
});

describe('HistoryQueryMetricsRepository with empty database', () => {
  before(async () => {
    database = await initDatabase('metrics', false, TEST_DB_PATH);
  });

  after(async () => {
    database.close();
    await emptyDatabase('metrics', TEST_DB_PATH);
  });

  let repository: HistoryQueryMetricsRepository;

  beforeEach(() => {
    mock.timers.enable({ apis: ['Date'], now: new Date(testData.constants.dates.FAKE_NOW) });
    repository = new HistoryQueryMetricsRepository(database);
  });

  afterEach(() => {
    mock.timers.reset();
  });

  it('should init and get metrics', () => {
    repository.initMetrics(testData.historyQueries.list[0].id);
    const result = repository.getMetrics(testData.historyQueries.list[0].id);
    assert.deepStrictEqual(result, {
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
