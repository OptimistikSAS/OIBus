import { before, after, beforeEach, afterEach, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { Database } from 'better-sqlite3';
import { emptyDatabase, initDatabase } from '../../tests/utils/test-utils';
import testData from '../../tests/utils/test-data';
import SouthConnectorMetricsRepository from './south-connector-metrics.repository';
import { SouthConnectorMetrics } from '../../../shared/model/engine.model';

const TEST_DB_PATH = 'src/tests/test-metrics-south.db';

let database: Database;
describe('SouthConnectorMetricsRepository with populated database', () => {
  before(async () => {
    database = await initDatabase('metrics', true, TEST_DB_PATH);
  });

  after(async () => {
    database.close();
    await emptyDatabase('metrics', TEST_DB_PATH);
  });

  let repository: SouthConnectorMetricsRepository;

  beforeEach(() => {
    mock.timers.enable({ apis: ['Date'], now: new Date(testData.constants.dates.FAKE_NOW) });
    repository = new SouthConnectorMetricsRepository(database);
  });

  afterEach(() => {
    mock.timers.reset();
  });

  it('should get metrics', () => {
    repository.initMetrics(testData.south.list[0].id);
    const result = repository.getMetrics(testData.south.list[0].id);
    assert.deepStrictEqual(result, testData.south.metrics);
  });

  it('should update metrics', () => {
    const newMetrics: SouthConnectorMetrics = JSON.parse(JSON.stringify(testData.south.metrics));
    newMetrics.metricsStart = testData.constants.dates.DATE_1;
    newMetrics.numberOfFilesRetrieved = 45;
    newMetrics.lastValueRetrieved = {
      pointId: 'my reference',
      timestamp: testData.constants.dates.DATE_3,
      data: { value: 'my value' }
    };
    repository.updateMetrics(testData.south.list[0].id, newMetrics);

    const result = repository.getMetrics(testData.south.list[0].id)!;
    assert.strictEqual(result.metricsStart, newMetrics.metricsStart);
    assert.strictEqual(result.numberOfFilesRetrieved, newMetrics.numberOfFilesRetrieved);
    assert.deepStrictEqual(result.lastValueRetrieved, newMetrics.lastValueRetrieved);

    newMetrics.lastValueRetrieved = null;
    repository.updateMetrics(testData.south.list[0].id, newMetrics);
    const resultWithoutValue = repository.getMetrics(testData.south.list[0].id)!;
    assert.strictEqual(resultWithoutValue.lastValueRetrieved, null);
  });

  it('should remove metrics', () => {
    repository.removeMetrics(testData.south.list[0].id);
    assert.strictEqual(repository.getMetrics(testData.south.list[0].id), null);
  });
});

describe('SouthConnectorMetricsRepository with empty database', () => {
  before(async () => {
    database = await initDatabase('metrics', false, TEST_DB_PATH);
  });

  after(async () => {
    database.close();
    await emptyDatabase('metrics', TEST_DB_PATH);
  });

  let repository: SouthConnectorMetricsRepository;

  beforeEach(() => {
    mock.timers.enable({ apis: ['Date'], now: new Date(testData.constants.dates.FAKE_NOW) });
    repository = new SouthConnectorMetricsRepository(database);
  });

  afterEach(() => {
    mock.timers.reset();
  });

  it('should init and get metrics', () => {
    repository.initMetrics(testData.south.list[0].id);
    const result = repository.getMetrics(testData.south.list[0].id);
    assert.deepStrictEqual(result, {
      metricsStart: testData.constants.dates.FAKE_NOW,
      lastConnection: null,
      lastRunStart: null,
      lastRunDuration: null,
      numberOfValuesRetrieved: 0,
      numberOfFilesRetrieved: 0,
      lastValueRetrieved: null,
      lastFileRetrieved: null
    });
  });
});
