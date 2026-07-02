import { beforeEach, afterEach, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import HistoryQueryMetricsService from './history-query-metrics.service';
import testData from '../../tests/utils/test-data';
import HistoryQueryMetricsRepository from '../../repository/metrics/history-query-metrics.repository';
import HistoryQueryMetricsRepositoryMock from '../../tests/__mocks__/repository/metrics/history-query-metrics-repository.mock';
import HistoryQuery from '../../engine/history-query';
import HistoryQueryMock from '../../tests/__mocks__/history-query.mock';

let historyQueryMetricsRepository: HistoryQueryMetricsRepositoryMock;
let historyQueryMock: HistoryQueryMock;
let service: HistoryQueryMetricsService;

describe('HistoryMetricsService', () => {
  beforeEach(() => {
    historyQueryMetricsRepository = new HistoryQueryMetricsRepositoryMock();
    historyQueryMock = new HistoryQueryMock(testData.historyQueries.list[0]);
    mock.timers.enable({ apis: ['Date', 'setInterval', 'setTimeout'], now: new Date(testData.constants.dates.FAKE_NOW) });
    // The repository returns the persisted subset (no north current* sizes) — mirror that in the mock.
    const { currentCacheSize: _c, currentErrorSize: _e, currentArchiveSize: _a, ...northPersisted } = testData.historyQueries.metrics.north;
    historyQueryMetricsRepository.getMetrics.mock.mockImplementation(() =>
      JSON.parse(JSON.stringify({ ...testData.historyQueries.metrics, north: northPersisted }))
    );
    service = new HistoryQueryMetricsService(
      historyQueryMock as unknown as HistoryQuery,
      historyQueryMetricsRepository as unknown as HistoryQueryMetricsRepository
    );
  });

  afterEach(() => {
    mock.timers.reset();
    mock.restoreAll();
  });

  it('should be properly initialised', () => {
    service.initMetrics();
    assert.deepStrictEqual(historyQueryMetricsRepository.initMetrics.mock.calls[0].arguments, [testData.historyQueries.list[0].id]);
    assert.deepStrictEqual(service.metrics, testData.historyQueries.metrics);
  });

  it('should update in-memory metrics synchronously and coalesce DB writes', () => {
    // Fire the full sequence of events in a single tick. In-memory metrics
    // must update synchronously after each emit, but the DB write is debounced
    // — we expect exactly one repository.updateMetrics call after the timer.
    // North current sizes are pulled live from the cache service (getNorthCacheSizes), not
    // carried by the event payload — so we drive them through the mock; the 'north-cache-size'
    // event only acts as a flush trigger.
    historyQueryMock.getNorthCacheSizes.mock.mockImplementation(() => ({ cache: 999, error: 888, archive: 777 }));
    historyQueryMock.metricsEvent.emit('north-cache-size', { cache: 999, error: 888, archive: 777 });
    assert.strictEqual(service.metrics.north.currentCacheSize, 999);
    assert.strictEqual(service.metrics.north.currentErrorSize, 888);
    assert.strictEqual(service.metrics.north.currentArchiveSize, 777);

    historyQueryMock.metricsEvent.emit('north-connect', { lastConnection: testData.constants.dates.DATE_1 });
    assert.strictEqual(service.metrics.north.lastConnection, testData.constants.dates.DATE_1);

    historyQueryMock.metricsEvent.emit('north-run-start', { lastRunStart: testData.constants.dates.DATE_2 });
    assert.strictEqual(service.metrics.north.lastRunStart, testData.constants.dates.DATE_2);

    historyQueryMock.metricsEvent.emit('north-run-end', {
      lastRunDuration: 888,
      metadata: { contentSize: 10, contentFile: 'file.csv' },
      action: 'sent'
    });
    historyQueryMock.metricsEvent.emit('north-run-end', {
      lastRunDuration: 888,
      metadata: { contentSize: 10, contentFile: 'file.csv' },
      action: 'archived'
    });
    historyQueryMock.metricsEvent.emit('north-run-end', {
      lastRunDuration: 888,
      metadata: { contentSize: 10, contentFile: 'file.csv' },
      action: 'errored'
    });
    historyQueryMock.metricsEvent.emit('north-cache-content-size', 123);

    historyQueryMock.metricsEvent.emit('south-connect', { lastConnection: testData.constants.dates.DATE_1 });
    historyQueryMock.metricsEvent.emit('south-run-start', { lastRunStart: testData.constants.dates.DATE_2 });
    historyQueryMock.metricsEvent.emit('south-run-end', { lastRunDuration: 999 });
    historyQueryMock.metricsEvent.emit('south-add-values', { numberOfValuesRetrieved: 10, lastValueRetrieved: {} });
    historyQueryMock.metricsEvent.emit('south-add-file', { lastFileRetrieved: 'last file retrieved' });
    historyQueryMock.metricsEvent.emit('south-history-query-start', { running: true });
    historyQueryMock.metricsEvent.emit('south-history-query-interval', {
      running: true,
      intervalProgress: 25,
      currentIntervalStart: testData.constants.dates.DATE_1,
      currentIntervalEnd: testData.constants.dates.DATE_3,
      currentIntervalNumber: 2,
      numberOfIntervals: 10
    });
    historyQueryMock.metricsEvent.emit('south-history-query-stop', { running: false });

    // Still no DB write — debounce timer hasn't fired.
    assert.strictEqual(historyQueryMetricsRepository.updateMetrics.mock.calls.length, 0);

    // Advance past the flush interval; one coalesced write with the final
    // cumulative state.
    mock.timers.tick(1000);
    assert.strictEqual(historyQueryMetricsRepository.updateMetrics.mock.calls.length, 1);
    // updateMetrics persists only the persisted subset — north current* sizes are not written (read live).
    const { currentCacheSize: _c, currentErrorSize: _e, currentArchiveSize: _a, ...northBase } = testData.historyQueries.metrics.north;
    assert.deepStrictEqual(historyQueryMetricsRepository.updateMetrics.mock.calls[0].arguments, [
      testData.historyQueries.list[0].id,
      {
        ...testData.historyQueries.metrics,
        north: {
          ...northBase,
          lastConnection: testData.constants.dates.DATE_1,
          lastRunStart: testData.constants.dates.DATE_2,
          lastRunDuration: 888,
          contentCachedSize: testData.historyQueries.metrics.north.contentCachedSize + 123,
          contentSentSize: testData.historyQueries.metrics.north.contentSentSize + 20,
          contentArchivedSize: testData.historyQueries.metrics.north.contentArchivedSize + 10,
          contentErroredSize: testData.historyQueries.metrics.north.contentErroredSize + 10,
          lastContentSent: 'file.csv'
        },
        south: {
          ...testData.historyQueries.metrics.south,
          lastConnection: testData.constants.dates.DATE_1,
          lastRunStart: testData.constants.dates.DATE_2,
          lastRunDuration: 999,
          numberOfValuesRetrieved: testData.historyQueries.metrics.south.numberOfValuesRetrieved + 10,
          lastValueRetrieved: {},
          lastFileRetrieved: 'last file retrieved',
          numberOfFilesRetrieved: testData.historyQueries.metrics.south.numberOfFilesRetrieved + 1
        },
        historyMetrics: {
          ...testData.historyQueries.metrics.historyMetrics,
          running: false,
          intervalProgress: 25,
          currentIntervalStart: testData.constants.dates.DATE_1,
          currentIntervalEnd: testData.constants.dates.DATE_3,
          currentIntervalNumber: 2,
          numberOfIntervals: 10
        }
      }
    ]);
  });

  it('should flush pending metrics on destroy so the last state survives shutdown', () => {
    historyQueryMock.metricsEvent.emit('north-cache-content-size', 99);
    assert.strictEqual(historyQueryMetricsRepository.updateMetrics.mock.calls.length, 0);
    service.destroy();
    assert.strictEqual(historyQueryMetricsRepository.updateMetrics.mock.calls.length, 1);
  });

  it('should cancel a pending flush on resetMetrics so it cannot race the re-init', () => {
    historyQueryMock.metricsEvent.emit('north-cache-content-size', 99);
    service.resetMetrics();
    mock.timers.tick(1000);
    assert.strictEqual(historyQueryMetricsRepository.updateMetrics.mock.calls.length, 0);
  });

  it('should reset metrics', () => {
    service.resetMetrics();
    assert.ok(historyQueryMetricsRepository.removeMetrics.mock.calls.length > 0);
    assert.ok(historyQueryMetricsRepository.initMetrics.mock.calls.length > 0);
  });

  it('should get stream', () => {
    const stream = service.stream;
    const writeSpy = mock.method(stream, 'write', () => true);
    mock.timers.tick(100);
    assert.strictEqual(writeSpy.mock.calls.length, 1);
    assert.ok(service.stream);
  });

  it('should debounce stream writes alongside DB writes', () => {
    const stream = service.stream;
    const writeSpy = mock.method(stream, 'write', () => true);

    mock.timers.tick(100); // drain the stream-init write
    writeSpy.mock.resetCalls(); // start counting from 0

    service.updateMetrics();
    mock.timers.tick(1000);
    assert.strictEqual(writeSpy.mock.calls.length, 1);
    service.initMetrics();
    assert.strictEqual(writeSpy.mock.calls.length, 2);
  });

  it('should properly clean up listeners on destroy', () => {
    const metricsEventOffSpy = mock.method(historyQueryMock.metricsEvent, 'off');
    const stream = service.stream;
    const streamDestroySpy = mock.method(stream, 'destroy');

    service.destroy();

    const offEvents = metricsEventOffSpy.mock.calls.map(c => c.arguments[0]);
    assert.ok(offEvents.includes('north-connect'));
    assert.ok(offEvents.includes('north-run-start'));
    assert.ok(offEvents.includes('north-run-end'));
    assert.ok(offEvents.includes('north-cache-size'));
    assert.ok(offEvents.includes('north-cache-content-size'));
    assert.ok(offEvents.includes('south-connect'));
    assert.ok(offEvents.includes('south-run-start'));
    assert.ok(offEvents.includes('south-run-end'));
    assert.ok(offEvents.includes('south-history-query-start'));
    assert.ok(offEvents.includes('south-history-query-interval'));
    assert.ok(offEvents.includes('south-history-query-stop'));
    assert.ok(offEvents.includes('south-add-values'));
    assert.ok(offEvents.includes('south-add-file'));
    assert.ok(streamDestroySpy.mock.calls.length > 0);
    assert.strictEqual(service['_stream'], null);
  });
});
