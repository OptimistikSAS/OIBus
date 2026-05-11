import NorthConnectorMetricsService from './north-connector-metrics.service';
import NorthMetricsRepositoryMock from '../../tests/__mocks__/repository/metrics/north-metrics-repository.mock';
import NorthConnectorMetricsRepository from '../../repository/metrics/north-connector-metrics.repository';
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

  afterEach(() => {
    // Detach event listeners and drain any pending flush before the next test.
    // The `northMock` is module-scoped, so without this, listeners from earlier
    // tests would still fire when later tests emit events.
    service.destroy();
    jest.useRealTimers();
  });

  it('should be properly initialised', () => {
    expect(northConnectorMetricsRepository.initMetrics).toHaveBeenCalledWith(testData.north.list[0].id);
    expect(service.metrics).toEqual(testData.north.metrics);
  });

  it('should update in-memory metrics synchronously and coalesce DB writes', () => {
    // Fire the full sequence of events in a single tick. In-memory metrics
    // update synchronously after each event, while the DB write is debounced —
    // we expect exactly one repository.updateMetrics call after the timer.
    northMock.metricsEvent.emit('cache-size', { cacheSize: 999, errorSize: 888, archiveSize: 777 });
    expect(service.metrics.currentCacheSize).toBe(999);
    expect(service.metrics.currentErrorSize).toBe(888);
    expect(service.metrics.currentArchiveSize).toBe(777);

    northMock.metricsEvent.emit('connect', { lastConnection: testData.constants.dates.DATE_1 });
    expect(service.metrics.lastConnection).toBe(testData.constants.dates.DATE_1);

    northMock.metricsEvent.emit('run-start', { lastRunStart: testData.constants.dates.DATE_2 });
    expect(service.metrics.lastRunStart).toBe(testData.constants.dates.DATE_2);

    northMock.metricsEvent.emit('run-end', {
      lastRunDuration: 888,
      metadata: { contentSize: 10, contentFile: 'file.csv' },
      action: 'sent'
    });
    northMock.metricsEvent.emit('run-end', {
      lastRunDuration: 888,
      metadata: { contentSize: 10, contentFile: 'file.csv' },
      action: 'archived'
    });
    northMock.metricsEvent.emit('run-end', {
      lastRunDuration: 888,
      metadata: { contentSize: 10, contentFile: 'file.csv' },
      action: 'errored'
    });
    northMock.metricsEvent.emit('cache-content-size', 123);

    // Still no DB write — debounce timer hasn't fired.
    expect(northConnectorMetricsRepository.updateMetrics).not.toHaveBeenCalled();

    // Advance past the flush interval; one coalesced write with the
    // final cumulative state.
    jest.advanceTimersByTime(1000);
    expect(northConnectorMetricsRepository.updateMetrics).toHaveBeenCalledTimes(1);
    expect(northConnectorMetricsRepository.updateMetrics).toHaveBeenLastCalledWith(testData.north.list[0].id, {
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

  it('should flush pending metrics on destroy so the last state survives shutdown', () => {
    northMock.metricsEvent.emit('cache-content-size', 50);
    expect(northConnectorMetricsRepository.updateMetrics).not.toHaveBeenCalled();
    service.destroy();
    expect(northConnectorMetricsRepository.updateMetrics).toHaveBeenCalledTimes(1);
  });

  it('should cancel a pending flush on resetMetrics so it cannot race the re-init', () => {
    northMock.metricsEvent.emit('cache-content-size', 50);
    service.resetMetrics();
    jest.advanceTimersByTime(1000);
    expect(northConnectorMetricsRepository.updateMetrics).not.toHaveBeenCalled();
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

  it('should debounce stream writes alongside DB writes', () => {
    const stream = service.stream;
    // Drain the 100 ms initial-snapshot timer scheduled by `get stream()`
    // before installing the spy.
    jest.advanceTimersByTime(100);
    stream.write = jest.fn();

    service.updateMetrics();
    expect(stream.write).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1000);
    expect(stream.write).toHaveBeenCalledTimes(1);

    // Initial-snapshot push on subscribe still bypasses the debounce.
    service.initMetrics();
    expect(stream.write).toHaveBeenCalledTimes(2);
  });

  it('should properly clean up listeners on destroy', () => {
    const metricsEventOffSpy = jest.spyOn(northMock.metricsEvent, 'off');
    const stream = service.stream;
    const streamDestroySpy = jest.spyOn(stream, 'destroy');

    service.destroy();

    expect(metricsEventOffSpy).toHaveBeenCalledWith('cache-size', expect.any(Function));
    expect(metricsEventOffSpy).toHaveBeenCalledWith('cache-content-size', expect.any(Function));
    expect(metricsEventOffSpy).toHaveBeenCalledWith('connect', expect.any(Function));
    expect(metricsEventOffSpy).toHaveBeenCalledWith('run-start', expect.any(Function));
    expect(metricsEventOffSpy).toHaveBeenCalledWith('run-end', expect.any(Function));
    expect(streamDestroySpy).toHaveBeenCalled();
    expect(service['_stream']).toBeNull();
  });
});
