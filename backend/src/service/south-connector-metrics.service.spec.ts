import db from 'better-sqlite3';
import SouthConnectorMetricsService from './south-connector-metrics.service';
import { SouthConnectorMetrics } from '../../../shared/model/engine.model';

const getMetrics = jest.fn();
jest.mock(
  '../repository/south-connector-metrics.repository',
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
let service: SouthConnectorMetricsService;

const metrics = {
  numberOfValuesRetrieved: 1,
  numberOfFilesRetrieved: 1
} as SouthConnectorMetrics;
describe('SouthConnectorMetricsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(nowDateString));

    getMetrics.mockReturnValue(metrics);
    service = new SouthConnectorMetricsService('connectorId', 'south-cache');
  });

  it('should be properly initialized', () => {
    expect(db).toHaveBeenCalledWith('south-cache');
    expect(service.metricsRepository).toBeDefined();
  });

  it('should update metrics', () => {
    const newConnectorMetrics: SouthConnectorMetrics = {
      metricsStart: '2020-02-02T02:02:02.222Z',
      numberOfValuesRetrieved: 22,
      numberOfFilesRetrieved: 33,
      lastValueRetrieved: {},
      lastFileRetrieved: 'myFile',
      lastConnection: '2020-02-02T02:02:02.222Z',
      lastRunStart: '2020-02-02T02:02:02.222Z',
      lastRunDuration: 120,
      historyMetrics: {}
    };
    service.updateMetrics(newConnectorMetrics);
    expect(service.metricsRepository.updateMetrics).toHaveBeenCalledWith(newConnectorMetrics);
  });

  it('should reset metrics', () => {
    service.resetMetrics();
    expect(service.metricsRepository.removeMetrics).toHaveBeenCalled();
    expect(service.metricsRepository.createMetricsTable).toHaveBeenCalledWith('connectorId');
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
      numberOfValuesRetrieved: 2,
      numberOfFilesRetrieved: 2
    } as SouthConnectorMetrics);
    expect(stream.write).toHaveBeenCalledWith(
      `data: ${JSON.stringify({
        numberOfValuesRetrieved: 2,
        numberOfFilesRetrieved: 2
      })}\n\n`
    );

    service.stream;
  });
});
