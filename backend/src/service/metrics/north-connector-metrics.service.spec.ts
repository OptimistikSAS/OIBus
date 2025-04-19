import NorthConnectorMetricsService from './north-connector-metrics.service';
import NorthMetricsRepositoryMock from '../../tests/__mocks__/repository/log/north-metrics-repository.mock';
import NorthConnectorMetricsRepository from '../../repository/logs/north-connector-metrics.repository';
import testData from '../../tests/utils/test-data';
import NorthConnector from '../../north/north-connector';
import { NorthSettings } from '../../../shared/model/north-settings.model';
import NorthConnectorMock from '../../tests/__mocks__/north-connector.mock';

const northConnectorMetricsRepository: NorthConnectorMetricsRepository = new NorthMetricsRepositoryMock();
const northMock = new NorthConnectorMock(testData.north.list[0]) as unknown as NorthConnector<NorthSettings>;

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
    northMock.metricsEvent.emit('cache-size', { cacheSize: 999, errorSize: 888, archiveSize: 777 });
    expect(northConnectorMetricsRepository.updateMetrics).toHaveBeenCalledWith(testData.north.list[0].id, {
      ...testData.north.metrics,
      currentCacheSize: 999,
      currentErrorSize: 888,
      currentArchiveSize: 777
    });

    northMock.metricsEvent.emit('connect', { lastConnection: testData.constants.dates.DATE_1 });
    expect(northConnectorMetricsRepository.updateMetrics).toHaveBeenCalledWith(testData.north.list[0].id, {
      ...testData.north.metrics,
      currentCacheSize: 999,
      currentErrorSize: 888,
      currentArchiveSize: 777,
      lastConnection: testData.constants.dates.DATE_1
    });

    northMock.metricsEvent.emit('run-start', { lastRunStart: testData.constants.dates.DATE_2 });
    expect(northConnectorMetricsRepository.updateMetrics).toHaveBeenCalledWith(testData.north.list[0].id, {
      ...testData.north.metrics,
      currentCacheSize: 999,
      currentErrorSize: 888,
      currentArchiveSize: 777,
      lastConnection: testData.constants.dates.DATE_1,
      lastRunStart: testData.constants.dates.DATE_2
    });

    northMock.metricsEvent.emit('run-end', {
      lastRunDuration: 888,
      metadata: { contentSize: 10, contentFile: 'file.csv' },
      action: 'sent'
    });
    expect(northConnectorMetricsRepository.updateMetrics).toHaveBeenCalledWith(testData.north.list[0].id, {
      ...testData.north.metrics,
      currentCacheSize: 999,
      currentErrorSize: 888,
      currentArchiveSize: 777,
      lastConnection: testData.constants.dates.DATE_1,
      lastRunStart: testData.constants.dates.DATE_2,
      lastRunDuration: 888,
      contentSentSize: testData.north.metrics.contentSentSize + 10,
      lastContentSent: 'file.csv'
    });

    northMock.metricsEvent.emit('run-end', {
      lastRunDuration: 888,
      metadata: { contentSize: 10, contentFile: 'file.csv' },
      action: 'archived'
    });
    expect(northConnectorMetricsRepository.updateMetrics).toHaveBeenCalledWith(testData.north.list[0].id, {
      ...testData.north.metrics,
      currentCacheSize: 999,
      currentErrorSize: 888,
      currentArchiveSize: 777,
      lastConnection: testData.constants.dates.DATE_1,
      lastRunStart: testData.constants.dates.DATE_2,
      lastRunDuration: 888,
      contentSentSize: testData.north.metrics.contentSentSize + 20,
      contentArchivedSize: testData.north.metrics.contentArchivedSize + 10,
      lastContentSent: 'file.csv'
    });

    northMock.metricsEvent.emit('run-end', {
      lastRunDuration: 888,
      metadata: { contentSize: 10, contentFile: 'file.csv' },
      action: 'errored'
    });
    expect(northConnectorMetricsRepository.updateMetrics).toHaveBeenCalledWith(testData.north.list[0].id, {
      ...testData.north.metrics,
      currentCacheSize: 999,
      currentErrorSize: 888,
      currentArchiveSize: 777,
      lastConnection: testData.constants.dates.DATE_1,
      lastRunStart: testData.constants.dates.DATE_2,
      lastRunDuration: 888,
      contentSentSize: testData.north.metrics.contentSentSize + 20,
      contentArchivedSize: testData.north.metrics.contentArchivedSize + 10,
      contentErroredSize: testData.north.metrics.contentErroredSize + 10,
      lastContentSent: 'file.csv'
    });

    northMock.metricsEvent.emit('cache-content-size', 123);
    expect(northConnectorMetricsRepository.updateMetrics).toHaveBeenCalledWith(testData.north.list[0].id, {
      ...testData.north.metrics,
      currentCacheSize: 999,
      currentErrorSize: 888,
      currentArchiveSize: 777,
      lastConnection: testData.constants.dates.DATE_1,
      lastRunStart: testData.constants.dates.DATE_2,
      lastRunDuration: 888,
      contentCachedSize: testData.north.metrics.contentCachedSize + 123,
      contentSentSize: testData.north.metrics.contentSentSize + 20,
      contentArchivedSize: testData.north.metrics.contentArchivedSize + 10,
      contentErroredSize: testData.north.metrics.contentErroredSize + 10,
      lastContentSent: 'file.csv'
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
