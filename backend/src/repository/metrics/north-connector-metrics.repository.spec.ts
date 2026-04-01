import { Database } from 'better-sqlite3';
import { emptyDatabase, initDatabase } from '../../tests/utils/test-utils';
import testData from '../../tests/utils/test-data';
import NorthConnectorMetricsRepository from './north-connector-metrics.repository';
import { NorthConnectorMetrics } from '../../../shared/model/engine.model';

const TEST_DB_PATH = 'src/tests/test-metrics-north.db';

let database: Database;
describe('NorthConnectorMetricsRepository with populated database', () => {
  beforeAll(async () => {
    database = await initDatabase('metrics', true, TEST_DB_PATH);
  });

  afterAll(async () => {
    database.close();
    await emptyDatabase('metrics', TEST_DB_PATH);
  });

  let repository: NorthConnectorMetricsRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));
    repository = new NorthConnectorMetricsRepository(database);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should get metrics', () => {
    repository.initMetrics(testData.north.list[0].id);
    const result = repository.getMetrics(testData.north.list[0].id);
    expect(result).toEqual(testData.north.metrics);
  });

  it('should update metrics', () => {
    const newMetrics: NorthConnectorMetrics = JSON.parse(JSON.stringify(testData.north.metrics));
    newMetrics.metricsStart = testData.constants.dates.DATE_1;
    newMetrics.contentSentSize = 45;
    newMetrics.contentCachedSize = 90;
    newMetrics.lastContentSent = 'file.json';
    repository.updateMetrics(testData.north.list[0].id, newMetrics);

    const result = repository.getMetrics(testData.north.list[0].id)!;
    expect(result.metricsStart).toEqual(newMetrics.metricsStart);
    expect(result.contentSentSize).toEqual(newMetrics.contentSentSize);
    expect(result.contentCachedSize).toEqual(newMetrics.contentCachedSize);
    expect(result.contentErroredSize).toEqual(newMetrics.contentErroredSize);
    expect(result.contentArchivedSize).toEqual(newMetrics.contentArchivedSize);
    expect(result.lastContentSent).toEqual(newMetrics.lastContentSent);

    newMetrics.lastContentSent = null;
    repository.updateMetrics(testData.north.list[0].id, newMetrics);
    const resultWithoutValue = repository.getMetrics(testData.north.list[0].id)!;
    expect(resultWithoutValue.lastContentSent).toEqual(null);
  });

  it('should remove metrics', () => {
    repository.removeMetrics(testData.north.list[0].id);
    expect(repository.getMetrics(testData.north.list[0].id)).toEqual(null);
  });
});

describe('NorthConnectorMetricsRepository with empty database', () => {
  beforeAll(async () => {
    database = await initDatabase('metrics', false, TEST_DB_PATH);
  });

  afterAll(async () => {
    database.close();
    await emptyDatabase('metrics', TEST_DB_PATH);
  });

  let repository: NorthConnectorMetricsRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));
    repository = new NorthConnectorMetricsRepository(database);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should init and get metrics', () => {
    repository.initMetrics(testData.north.list[0].id);
    const result = repository.getMetrics(testData.north.list[0].id);
    expect(result).toEqual({
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
