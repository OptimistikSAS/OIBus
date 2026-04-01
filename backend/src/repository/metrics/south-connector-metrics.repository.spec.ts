import { Database } from 'better-sqlite3';
import { emptyDatabase, initDatabase } from '../../tests/utils/test-utils';
import testData from '../../tests/utils/test-data';
import SouthConnectorMetricsRepository from './south-connector-metrics.repository';
import { SouthConnectorMetrics } from '../../../shared/model/engine.model';

const TEST_DB_PATH = 'src/tests/test-metrics-south.db';

let database: Database;
describe('SouthConnectorMetricsRepository with populated database', () => {
  beforeAll(async () => {
    database = await initDatabase('metrics', true, TEST_DB_PATH);
  });

  afterAll(async () => {
    database.close();
    await emptyDatabase('metrics', TEST_DB_PATH);
  });

  let repository: SouthConnectorMetricsRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));
    repository = new SouthConnectorMetricsRepository(database);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should get metrics', () => {
    repository.initMetrics(testData.south.list[0].id);
    const result = repository.getMetrics(testData.south.list[0].id);
    expect(result).toEqual(testData.south.metrics);
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
    expect(result.metricsStart).toEqual(newMetrics.metricsStart);
    expect(result.numberOfFilesRetrieved).toEqual(newMetrics.numberOfFilesRetrieved);
    expect(result.lastValueRetrieved).toEqual(newMetrics.lastValueRetrieved);

    newMetrics.lastValueRetrieved = null;
    repository.updateMetrics(testData.south.list[0].id, newMetrics);
    const resultWithoutValue = repository.getMetrics(testData.south.list[0].id)!;
    expect(resultWithoutValue.lastValueRetrieved).toEqual(null);
  });

  it('should remove metrics', () => {
    repository.removeMetrics(testData.south.list[0].id);
    expect(repository.getMetrics(testData.south.list[0].id)).toEqual(null);
  });
});

describe('SouthConnectorMetricsRepository with empty database', () => {
  beforeAll(async () => {
    database = await initDatabase('metrics', false, TEST_DB_PATH);
  });

  afterAll(async () => {
    database.close();
    await emptyDatabase('metrics', TEST_DB_PATH);
  });

  let repository: SouthConnectorMetricsRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));
    repository = new SouthConnectorMetricsRepository(database);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should init and get metrics', () => {
    repository.initMetrics(testData.south.list[0].id);
    const result = repository.getMetrics(testData.south.list[0].id);
    expect(result).toEqual({
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
