import { Database } from 'better-sqlite3';
import { emptyDatabase, initDatabase } from '../../tests/utils/test-utils';
import testData from '../../tests/utils/test-data';
import EngineMetricsRepository from './engine-metrics.repository';
import { EngineMetrics } from '../../../shared/model/engine.model';

const TEST_DB_PATH = 'src/tests/test-metrics-engine.db';

let database: Database;
describe('EngineMetricsRepository with populated database', () => {
  beforeAll(async () => {
    database = await initDatabase('metrics', true, TEST_DB_PATH);
  });

  afterAll(async () => {
    database.close();
    await emptyDatabase('metrics', TEST_DB_PATH);
  });

  let repository: EngineMetricsRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));
    repository = new EngineMetricsRepository(database);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should get metrics', () => {
    repository.initMetrics(testData.engine.settings.id);
    const result = repository.getMetrics(testData.engine.settings.id);
    expect(result).toEqual(testData.engine.metrics);
  });

  it('should update metrics', () => {
    const newMetrics: EngineMetrics = JSON.parse(JSON.stringify(testData.engine.metrics));
    newMetrics.metricsStart = testData.constants.dates.DATE_1;
    newMetrics.freeMemory = 3_000_000;
    newMetrics.maxHeapUsed = 10;
    repository.updateMetrics(testData.engine.settings.id, newMetrics);

    const result = repository.getMetrics(testData.engine.settings.id)!;
    expect(result.metricsStart).toEqual(newMetrics.metricsStart);
    expect(result.freeMemory).toEqual(newMetrics.freeMemory);
    expect(result.maxHeapUsed).toEqual(newMetrics.maxHeapUsed);
  });

  it('should remove metrics', () => {
    repository.removeMetrics(testData.engine.settings.id);
    expect(repository.getMetrics(testData.engine.settings.id)).toEqual(null);
  });
});

describe('EngineMetricsRepository with empty database', () => {
  beforeAll(async () => {
    database = await initDatabase('metrics', false, TEST_DB_PATH);
  });

  afterAll(async () => {
    database.close();
    await emptyDatabase('metrics', TEST_DB_PATH);
  });

  let repository: EngineMetricsRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));
    repository = new EngineMetricsRepository(database);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should init and get metrics', () => {
    repository.initMetrics(testData.engine.settings.id);
    const result = repository.getMetrics(testData.engine.settings.id);
    expect(result).toEqual({
      metricsStart: testData.constants.dates.FAKE_NOW,
      processCpuUsageInstant: 0,
      processCpuUsageAverage: 0,
      processUptime: 0,
      freeMemory: 0,
      totalMemory: 0,
      minRss: 0,
      currentRss: 0,
      maxRss: 0,
      minHeapTotal: 0,
      currentHeapTotal: 0,
      maxHeapTotal: 0,
      minHeapUsed: 0,
      currentHeapUsed: 0,
      maxHeapUsed: 0,
      minExternal: 0,
      currentExternal: 0,
      maxExternal: 0,
      minArrayBuffers: 0,
      currentArrayBuffers: 0,
      maxArrayBuffers: 0
    });
  });
});
