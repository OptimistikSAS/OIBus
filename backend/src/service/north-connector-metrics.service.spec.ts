import { NorthConnectorMetrics } from '../../../shared/model/engine.model';
import NorthConnectorMetricsService from './north-connector-metrics.service';
import NorthMetricsRepositoryMock, { getMetrics } from '../tests/__mocks__/north-metrics-repository.mock';
import NorthConnectorMetricsRepository from '../repository/north-connector-metrics.repository';

const northRepositoryMock: NorthConnectorMetricsRepository = new NorthMetricsRepositoryMock();

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
    service = new NorthConnectorMetricsService('connectorId', northRepositoryMock);
  });

  it('should be properly initialized', () => {
    expect(service.metricsRepository).toBeDefined();
  });

  it('should update metrics', () => {
    const newConnectorMetrics: NorthConnectorMetrics = {
      metricsStart: '2020-02-02T02:02:02.222Z',
      numberOfValuesSent: 22,
      numberOfFilesSent: 33,
      lastValueSent: { pointId: 'pointId', timestamp: '2020-02-02T02:02:02.222Z', data: { value: '13' } },
      lastFileSent: 'myFile',
      lastConnection: '2020-02-02T02:02:02.222Z',
      lastRunStart: '2020-02-02T02:02:02.222Z',
      lastRunDuration: 120,
      cacheSize: 123
    };
    service.updateMetrics('northId', newConnectorMetrics);
    expect(service.metricsRepository.updateMetrics).toHaveBeenCalledWith('northId', newConnectorMetrics);
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

    service.updateMetrics('northId', {
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
