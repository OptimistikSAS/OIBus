import { beforeEach, afterEach, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import NorthConnectorMetricsService from './north-connector-metrics.service';
import NorthMetricsRepositoryMock from '../../tests/__mocks__/repository/metrics/north-metrics-repository.mock';
import NorthConnectorMetricsRepository from '../../repository/metrics/north-connector-metrics.repository';
import testData from '../../tests/utils/test-data';
import NorthConnector from '../../north/north-connector';
import { NorthSettings } from '../../../shared/model/north-settings.model';
import NorthConnectorMock from '../../tests/__mocks__/north-connector.mock';

let northConnectorMetricsRepository: NorthMetricsRepositoryMock;
let northMock: NorthConnectorMock;
let service: NorthConnectorMetricsService;

describe('NorthConnectorMetricsService', () => {
  beforeEach(() => {
    northConnectorMetricsRepository = new NorthMetricsRepositoryMock();
    northMock = new NorthConnectorMock(testData.north.list[0]);
    mock.timers.enable({ apis: ['Date', 'setInterval', 'setTimeout'], now: new Date(testData.constants.dates.FAKE_NOW) });
    northConnectorMetricsRepository.getMetrics.mock.mockImplementation(() => JSON.parse(JSON.stringify(testData.north.metrics)));
    service = new NorthConnectorMetricsService(
      northMock as unknown as NorthConnector<NorthSettings>,
      northConnectorMetricsRepository as unknown as NorthConnectorMetricsRepository
    );
  });

  afterEach(() => {
    mock.timers.reset();
    mock.restoreAll();
  });

  it('should be properly initialised', () => {
    assert.deepStrictEqual(northConnectorMetricsRepository.initMetrics.mock.calls[0].arguments, [testData.north.list[0].id]);
    assert.deepStrictEqual(service.metrics, testData.north.metrics);
  });

  it('should update in-memory metrics synchronously and coalesce DB writes', () => {
    // Fire the full sequence of events in a single tick. In-memory metrics
    // update synchronously after each event, while the DB write is debounced —
    // we expect exactly one repository.updateMetrics call after the timer.
    // Current sizes are pulled live from the cache service (getCacheSizes), not carried
    // by the event payload — so we drive them through the mock and the 'cache-size' event
    // only acts as a flush trigger.
    northMock.getCacheSizes.mock.mockImplementation(() => ({ cache: 999, error: 888, archive: 777 }));
    northMock.metricsEvent.emit('cache-size', { cache: 999, error: 888, archive: 777 });
    assert.strictEqual(service.metrics.currentCacheSize, 999);
    assert.strictEqual(service.metrics.currentErrorSize, 888);
    assert.strictEqual(service.metrics.currentArchiveSize, 777);

    northMock.metricsEvent.emit('connect', { lastConnection: testData.constants.dates.DATE_1 });
    assert.strictEqual(service.metrics.lastConnection, testData.constants.dates.DATE_1);

    northMock.metricsEvent.emit('run-start', { lastRunStart: testData.constants.dates.DATE_2 });
    assert.strictEqual(service.metrics.lastRunStart, testData.constants.dates.DATE_2);

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
    assert.strictEqual(northConnectorMetricsRepository.updateMetrics.mock.calls.length, 0);

    // Advance past the flush interval; one coalesced write with the
    // final cumulative state.
    mock.timers.tick(1000);
    assert.strictEqual(northConnectorMetricsRepository.updateMetrics.mock.calls.length, 1);
    assert.deepStrictEqual(northConnectorMetricsRepository.updateMetrics.mock.calls[0].arguments, [
      testData.north.list[0].id,
      {
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
      }
    ]);
  });

  it('should flush pending metrics on destroy so the last state survives shutdown', () => {
    northMock.metricsEvent.emit('cache-content-size', 50);
    assert.strictEqual(northConnectorMetricsRepository.updateMetrics.mock.calls.length, 0);
    service.destroy();
    assert.strictEqual(northConnectorMetricsRepository.updateMetrics.mock.calls.length, 1);
  });

  it('should cancel a pending flush on resetMetrics so it cannot race the re-init', () => {
    northMock.metricsEvent.emit('cache-content-size', 50);
    service.resetMetrics();
    mock.timers.tick(1000);
    assert.strictEqual(northConnectorMetricsRepository.updateMetrics.mock.calls.length, 0);
  });

  it('should reset metrics', () => {
    service.resetMetrics();
    assert.ok(northConnectorMetricsRepository.removeMetrics.mock.calls.length > 0);
    assert.deepStrictEqual(northConnectorMetricsRepository.initMetrics.mock.calls[0].arguments, [testData.north.list[0].id]);
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
    const metricsEventOffSpy = mock.method(northMock.metricsEvent, 'off');
    const stream = service.stream;
    const streamDestroySpy = mock.method(stream, 'destroy');

    service.destroy();

    const offEvents = metricsEventOffSpy.mock.calls.map(c => c.arguments[0]);
    assert.ok(offEvents.includes('cache-size'));
    assert.ok(offEvents.includes('cache-content-size'));
    assert.ok(offEvents.includes('connect'));
    assert.ok(offEvents.includes('run-start'));
    assert.ok(offEvents.includes('run-end'));
    assert.ok(streamDestroySpy.mock.calls.length > 0);
    assert.strictEqual(service['_stream'], null);
  });
});
