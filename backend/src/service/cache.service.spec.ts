import db from 'better-sqlite3';
import CacheService from './cache.service';
import { ConnectorMetrics } from '../../../shared/model/engine.model';

const getMetrics = jest.fn();
jest.mock(
  '../repository/connector-cache.repository',
  () =>
    function () {
      return {
        createMetricsTable: jest.fn(),
        createCacheHistoryTable: jest.fn(),
        createOrUpdateCacheScanMode: jest.fn(),
        getSouthCacheScanMode: jest.fn(),
        resetDatabase: jest.fn(),
        getMetrics,
        updateMetrics: jest.fn(),
        removeMetrics: jest.fn()
      };
    }
);
jest.mock('better-sqlite3', () => jest.fn(() => 'sqlite database'));

const nowDateString = '2020-02-02T02:02:02.222Z';
let service: CacheService;

const metrics = {
  numberOfValues: 1,
  numberOfFiles: 1
} as ConnectorMetrics;
describe('South cache service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(nowDateString));

    getMetrics.mockReturnValue(metrics);
    service = new CacheService('connectorId', 'south-cache');
  });

  it('should be properly initialized', () => {
    expect(db).toHaveBeenCalledWith('south-cache');
    expect(service.cacheRepository).toBeDefined();
  });

  it('should create cache history table', () => {
    service.createCacheHistoryTable();
    expect(service.cacheRepository.createCacheHistoryTable).toHaveBeenCalledTimes(1);
  });

  it('should create or update cache scan mode', () => {
    const command = {
      scanModeId: 'id1',
      itemId: 'itemId',
      intervalIndex: 1,
      maxInstant: ''
    };
    service.createOrUpdateCacheScanMode(command);
    expect(service.cacheRepository.createOrUpdateCacheScanMode).toHaveBeenCalledTimes(1);
  });

  it('should get scan mode', () => {
    const scanMode = {
      scanModeId: 'id1',
      itemId: 'itemId',
      intervalIndex: 1,
      maxInstant: ''
    };
    (service.cacheRepository.getSouthCacheScanMode as jest.Mock).mockReturnValueOnce(scanMode).mockReturnValue(null);
    const result = service.getSouthCache('id1', 'itemId', nowDateString);
    expect(result).toEqual(scanMode);

    const defaultResult = service.getSouthCache('id1', 'itemId', nowDateString);
    expect(defaultResult).toEqual({
      scanModeId: 'id1',
      itemId: 'itemId',
      maxInstant: nowDateString,
      intervalIndex: 0
    });
  });

  it('should reset cache', () => {
    service.resetCache();
    expect(service.cacheRepository.resetDatabase).toHaveBeenCalledTimes(1);
  });

  it('should reset cache', () => {
    service.resetCache();
    expect(service.cacheRepository.resetDatabase).toHaveBeenCalledTimes(1);
  });

  it('should update metrics', () => {
    const newConnectorMetrics: ConnectorMetrics = {
      metricsStart: '2020-02-02T02:02:02.222Z',
      numberOfValues: 22,
      numberOfFiles: 33,
      lastValue: {},
      lastFile: 'myFile',
      lastConnection: '2020-02-02T02:02:02.222Z',
      lastRunStart: '2020-02-02T02:02:02.222Z',
      lastRunDuration: 120
    };
    service.updateMetrics(newConnectorMetrics);
    expect(service.cacheRepository.updateMetrics).toHaveBeenCalledWith(newConnectorMetrics);
  });

  it('should reset metrics', () => {
    service.resetMetrics();
    expect(service.cacheRepository.removeMetrics).toHaveBeenCalled();
    expect(service.cacheRepository.createMetricsTable).toHaveBeenCalledWith('connectorId');
    expect(service.metrics).toEqual(metrics);
  });

  it('should get stream', () => {
    const stream = service.stream;
    stream.write = jest.fn();
    jest.advanceTimersByTime(100);
    expect(stream.write).toHaveBeenCalledTimes(1);

    service.createMetricsTable();
    expect(stream.write).toHaveBeenCalledWith(`data: ${JSON.stringify(metrics)}\n\n`);

    service.updateMetrics({
      numberOfValues: 2,
      numberOfFiles: 2
    } as ConnectorMetrics);
    expect(stream.write).toHaveBeenCalledWith(
      `data: ${JSON.stringify({
        numberOfValues: 2,
        numberOfFiles: 2
      })}\n\n`
    );

    service.stream;
  });
});
