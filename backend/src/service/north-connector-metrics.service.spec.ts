import db from 'better-sqlite3';
import { NorthConnectorMetrics } from '../../../shared/model/engine.model';
import NorthConnectorMetricsService from './north-connector-metrics.service';

const getMetrics = jest.fn();
jest.mock(
  '../repository/north-connector-metrics.repository',
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
let service: NorthConnectorMetricsService;

const metrics = {
  numberOfValuesSent: 1,
  numberOfFilesSent: 1
} as NorthConnectorMetrics;
describe('NorthConnectorMetricsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(nowDateString));

    getMetrics.mockReturnValue(metrics);
    service = new NorthConnectorMetricsService('connectorId', 'south-cache');
  });

  it('should be properly initialized', () => {
    expect(db).toHaveBeenCalledWith('south-cache');
    expect(service.metricsRepository).toBeDefined();
  });

  it('should update metrics', () => {
    const newConnectorMetrics: NorthConnectorMetrics = {
      metricsStart: '2020-02-02T02:02:02.222Z',
      numberOfValuesSent: 22,
      numberOfFilesSent: 33,
      lastValueSent: {},
      lastFileSent: 'myFile',
      lastConnection: '2020-02-02T02:02:02.222Z',
      lastRunStart: '2020-02-02T02:02:02.222Z',
      lastRunDuration: 120
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
      numberOfValuesSent: 2,
      numberOfFilesSent: 2
    } as NorthConnectorMetrics);
    expect(stream.write).toHaveBeenCalledWith(
      `data: ${JSON.stringify({
        numberOfValuesSent: 2,
        numberOfFilesSent: 2
      })}\n\n`
    );

    service.stream;
  });
});
