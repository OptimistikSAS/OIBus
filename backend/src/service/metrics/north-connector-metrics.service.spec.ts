import NorthConnectorMetricsService from './north-connector-metrics.service';
import NorthMetricsRepositoryMock from '../../tests/__mocks__/repository/log/north-metrics-repository.mock';
import NorthConnectorMetricsRepository from '../../repository/logs/north-connector-metrics.repository';
import testData from '../../tests/utils/test-data';
import NorthConnector from '../../north/north-connector';
import { NorthSettings } from '../../../../shared/model/north-settings.model';
import NorthConnectorMock from '../../tests/__mocks__/north-connector.mock';

const northConnectorMetricsRepository: NorthConnectorMetricsRepository = new NorthMetricsRepositoryMock();
const northMock: NorthConnector<NorthSettings> = new NorthConnectorMock(testData.north.list[0]);

describe('NorthConnectorMetricsService', () => {
  let service: NorthConnectorMetricsService;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));

    (northConnectorMetricsRepository.getMetrics as jest.Mock).mockReturnValue(JSON.parse(JSON.stringify(testData.north.metrics)));
    service = new NorthConnectorMetricsService(northMock, northConnectorMetricsRepository);
  });

  it('should be properly initialised', () => {
    expect(northConnectorMetricsRepository.initMetrics).toHaveBeenCalledWith(testData.north.list[0].id);
    expect(service.metrics).toEqual(testData.north.metrics);
  });

  it('should update metrics', () => {
    northMock.metricsEvent.emit('cache-size', { cacheSize: 999 });
    expect(northConnectorMetricsRepository.updateMetrics).toHaveBeenCalledWith(testData.north.list[0].id, {
      ...testData.north.metrics,
      cacheSize: 999
    });

    northMock.metricsEvent.emit('connect', { lastConnection: testData.constants.dates.DATE_1 });
    expect(northConnectorMetricsRepository.updateMetrics).toHaveBeenCalledWith(testData.north.list[0].id, {
      ...testData.north.metrics,
      cacheSize: 999,
      lastConnection: testData.constants.dates.DATE_1
    });

    northMock.metricsEvent.emit('run-start', { lastRunStart: testData.constants.dates.DATE_2 });
    expect(northConnectorMetricsRepository.updateMetrics).toHaveBeenCalledWith(testData.north.list[0].id, {
      ...testData.north.metrics,
      cacheSize: 999,
      lastConnection: testData.constants.dates.DATE_1,
      lastRunStart: testData.constants.dates.DATE_2
    });

    northMock.metricsEvent.emit('run-end', { lastRunDuration: 888 });
    expect(northConnectorMetricsRepository.updateMetrics).toHaveBeenCalledWith(testData.north.list[0].id, {
      ...testData.north.metrics,
      cacheSize: 999,
      lastConnection: testData.constants.dates.DATE_1,
      lastRunStart: testData.constants.dates.DATE_2,
      lastRunDuration: 888
    });

    northMock.metricsEvent.emit('send-values', { numberOfValuesSent: 10, lastValueSent: {} });
    expect(northConnectorMetricsRepository.updateMetrics).toHaveBeenCalledWith(testData.north.list[0].id, {
      ...testData.north.metrics,
      cacheSize: 999,
      lastConnection: testData.constants.dates.DATE_1,
      lastRunStart: testData.constants.dates.DATE_2,
      lastRunDuration: 888,
      numberOfValuesSent: testData.north.metrics.numberOfValuesSent + 10,
      lastValueSent: {}
    });

    northMock.metricsEvent.emit('send-file', { lastFileSent: 'last file sent' });
    expect(northConnectorMetricsRepository.updateMetrics).toHaveBeenCalledWith(testData.north.list[0].id, {
      ...testData.north.metrics,
      cacheSize: 999,
      lastConnection: testData.constants.dates.DATE_1,
      lastRunStart: testData.constants.dates.DATE_2,
      lastRunDuration: 888,
      numberOfValuesSent: testData.north.metrics.numberOfValuesSent + 10,
      lastValueSent: {},
      lastFileSent: 'last file sent',
      numberOfFilesSent: testData.north.metrics.numberOfFilesSent + 1
    });
  });

  it('should reset metrics', () => {
    service.resetMetrics();
    expect(northConnectorMetricsRepository.removeMetrics).toHaveBeenCalled();
    expect(northConnectorMetricsRepository.initMetrics).toHaveBeenCalledWith(testData.north.list[0].id);
  });

  it('should get stream', () => {
    const stream = service.stream;
    stream.write = jest.fn();
    jest.advanceTimersByTime(100);
    expect(stream.write).toHaveBeenCalledTimes(1);

    expect(service.stream).toBeDefined();
  });

  it('should write on stream', () => {
    const stream = service.stream;
    stream.write = jest.fn();

    service.updateMetrics();
    expect(stream.write).toHaveBeenCalledTimes(1);
    service.initMetrics();

    expect(stream.write).toHaveBeenCalledTimes(2);
  });
});
