import SouthConnectorMetricsService from './south-connector-metrics.service';
import { SouthConnectorMetrics } from '../../../shared/model/engine.model';
import SouthMetricsRepositoryMock, { getMetrics } from '../tests/__mocks__/south-metrics-repository.mock';
import SouthConnectorMetricsRepository from '../repository/south-connector-metrics.repository';

const southRepositoryMock: SouthConnectorMetricsRepository = new SouthMetricsRepositoryMock();

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
    service = new SouthConnectorMetricsService('connectorId', southRepositoryMock);
  });

  it('should be properly initialized', () => {
    expect(service.metricsRepository).toBeDefined();
  });

  it('should update metrics', () => {
    const newConnectorMetrics: SouthConnectorMetrics = {
      metricsStart: '2020-02-02T02:02:02.222Z',
      numberOfValuesRetrieved: 22,
      numberOfFilesRetrieved: 33,
      lastValueRetrieved: { pointId: 'pointId', timestamp: '2020-02-02T02:02:02.222Z', data: { value: '13' } },
      lastFileRetrieved: 'myFile',
      lastConnection: '2020-02-02T02:02:02.222Z',
      lastRunStart: '2020-02-02T02:02:02.222Z',
      lastRunDuration: 120,
      historyMetrics: {}
    };
    service.updateMetrics('southId', newConnectorMetrics);
    expect(service.metricsRepository.updateMetrics).toHaveBeenCalledWith('southId', newConnectorMetrics);
  });

  it('should reset metrics', () => {
    service.resetMetrics();
    expect(service.metricsRepository.removeMetrics).toHaveBeenCalled();
    expect(service.metricsRepository.initMetrics).toHaveBeenCalledWith('connectorId');
    expect(service.metrics).toEqual(metrics);
  });

  it('should get stream', () => {
    const stream = service.stream;
    stream.write = jest.fn();
    jest.advanceTimersByTime(100);
    expect(stream.write).toHaveBeenCalledTimes(1);

    service.initMetrics();
    expect(stream.write).toHaveBeenCalledWith(`data: ${JSON.stringify(metrics)}\n\n`);

    service.updateMetrics('southId', {
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
