import { before, after, beforeEach, afterEach, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { Database } from 'better-sqlite3';
import { emptyDatabase, initDatabase } from '../../tests/utils/test-utils';
import testData from '../../tests/utils/test-data';
import NorthConnectorMetricsRepository from './north-connector-metrics.repository';
import { NorthConnectorMetrics } from '../../../shared/model/engine.model';

const TEST_DB_PATH = 'src/tests/test-metrics-north.db';

let database: Database;
describe('NorthConnectorMetricsRepository with populated database', () => {
  before(async () => {
    database = await initDatabase('metrics', true, TEST_DB_PATH);
  });

  after(async () => {
    database.close();
    await emptyDatabase('metrics', TEST_DB_PATH);
  });

  let repository: NorthConnectorMetricsRepository;

  beforeEach(() => {
    mock.timers.enable({ apis: ['Date'], now: new Date(testData.constants.dates.FAKE_NOW) });
    repository = new NorthConnectorMetricsRepository(database);
  });

  afterEach(() => {
    mock.timers.reset();
  });

  it('should get metrics', () => {
    repository.initMetrics(testData.north.list[0].id);
    const result = repository.getMetrics(testData.north.list[0].id);
    assert.deepStrictEqual(result, testData.north.metrics);
  });

  it('should update metrics', () => {
    const newMetrics: NorthConnectorMetrics = JSON.parse(JSON.stringify(testData.north.metrics));
    newMetrics.metricsStart = testData.constants.dates.DATE_1;
    newMetrics.contentSentSize = 45;
    newMetrics.contentCachedSize = 90;
    newMetrics.lastContentSent = 'file.json';
    repository.updateMetrics(testData.north.list[0].id, newMetrics);

    const result = repository.getMetrics(testData.north.list[0].id)!;
    assert.strictEqual(result.metricsStart, newMetrics.metricsStart);
    assert.strictEqual(result.contentSentSize, newMetrics.contentSentSize);
    assert.strictEqual(result.contentCachedSize, newMetrics.contentCachedSize);
    assert.strictEqual(result.contentErroredSize, newMetrics.contentErroredSize);
    assert.strictEqual(result.contentArchivedSize, newMetrics.contentArchivedSize);
    assert.strictEqual(result.lastContentSent, newMetrics.lastContentSent);

    newMetrics.lastContentSent = null;
    repository.updateMetrics(testData.north.list[0].id, newMetrics);
    const resultWithoutValue = repository.getMetrics(testData.north.list[0].id)!;
    assert.strictEqual(resultWithoutValue.lastContentSent, null);
  });

  it('should remove metrics', () => {
    repository.removeMetrics(testData.north.list[0].id);
    assert.strictEqual(repository.getMetrics(testData.north.list[0].id), null);
  });
});

describe('NorthConnectorMetricsRepository with empty database', () => {
  before(async () => {
    database = await initDatabase('metrics', false, TEST_DB_PATH);
  });

  after(async () => {
    database.close();
    await emptyDatabase('metrics', TEST_DB_PATH);
  });

  let repository: NorthConnectorMetricsRepository;

  beforeEach(() => {
    mock.timers.enable({ apis: ['Date'], now: new Date(testData.constants.dates.FAKE_NOW) });
    repository = new NorthConnectorMetricsRepository(database);
  });

  afterEach(() => {
    mock.timers.reset();
  });

  it('should init and get metrics', () => {
    repository.initMetrics(testData.north.list[0].id);
    const result = repository.getMetrics(testData.north.list[0].id);
    assert.deepStrictEqual(result, {
      metricsStart: testData.constants.dates.FAKE_NOW,
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
    });
  });
});
