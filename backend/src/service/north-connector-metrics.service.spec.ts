import { NorthConnectorMetrics } from '../../../shared/model/engine.model';
import NorthConnectorMetricsService from './north-connector-metrics.service';
import NorthMetricsRepositoryMock from '../tests/__mocks__/repository/log/north-metrics-repository.mock';
import NorthConnectorMetricsRepository from '../repository/logs/north-connector-metrics.repository';
import testData from '../tests/utils/test-data';

const northRepositoryMock: NorthConnectorMetricsRepository = new NorthMetricsRepositoryMock();

let service: NorthConnectorMetricsService;

const metrics = {
  numberOfValuesSent: 1,
  numberOfFilesSent: 1
} as NorthConnectorMetrics;
describe('NorthConnectorMetricsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));

    (northRepositoryMock.getMetrics as jest.Mock).mockReturnValue(metrics);
    service = new NorthConnectorMetricsService('connectorId', northRepositoryMock);
  });

  it('should update metrics', () => {
    const newConnectorMetrics: NorthConnectorMetrics = {
      metricsStart: testData.constants.dates.FAKE_NOW,
      numberOfValuesSent: 22,
      numberOfFilesSent: 33,
      lastValueSent: { pointId: 'pointId', timestamp: testData.constants.dates.FAKE_NOW, data: { value: '13' } },
      lastFileSent: 'myFile',
      lastConnection: testData.constants.dates.FAKE_NOW,
      lastRunStart: testData.constants.dates.FAKE_NOW,
      lastRunDuration: 120,
      cacheSize: 123
    };
    service.updateMetrics('northId', newConnectorMetrics);
    expect(northRepositoryMock.updateMetrics).toHaveBeenCalledWith('northId', newConnectorMetrics);
  });

  it('should reset metrics', () => {
    service.resetMetrics();
    expect(northRepositoryMock.removeMetrics).toHaveBeenCalled();
    expect(northRepositoryMock.initMetrics).toHaveBeenCalledWith('connectorId');
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

    expect(service.stream).toBeDefined();
  });
});
