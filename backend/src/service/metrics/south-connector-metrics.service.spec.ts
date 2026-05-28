import { beforeEach, afterEach, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import SouthConnectorMetricsService from './south-connector-metrics.service';
import SouthMetricsRepositoryMock from '../../tests/__mocks__/repository/metrics/south-metrics-repository.mock';
import SouthConnectorMetricsRepository from '../../repository/metrics/south-connector-metrics.repository';
import testData from '../../tests/utils/test-data';
import SouthConnector from '../../south/south-connector';
import { SouthItemSettings, SouthSettings } from '../../../shared/model/south-settings.model';
import SouthConnectorMock from '../../tests/__mocks__/south-connector.mock';

let southConnectorMetricsRepository: SouthMetricsRepositoryMock;
let southMock: SouthConnectorMock;
let service: SouthConnectorMetricsService;

describe('SouthConnectorMetricsService', () => {
  beforeEach(() => {
    southConnectorMetricsRepository = new SouthMetricsRepositoryMock();
    southMock = new SouthConnectorMock(testData.south.list[0]);
    mock.timers.enable({ apis: ['Date', 'setInterval', 'setTimeout'], now: new Date(testData.constants.dates.FAKE_NOW) });
    southConnectorMetricsRepository.getMetrics.mock.mockImplementation(() => JSON.parse(JSON.stringify(testData.south.metrics)));
    service = new SouthConnectorMetricsService(
      southMock as unknown as SouthConnector<SouthSettings, SouthItemSettings>,
      southConnectorMetricsRepository as unknown as SouthConnectorMetricsRepository
    );
  });

  afterEach(() => {
    mock.timers.reset();
    mock.restoreAll();
  });

  it('should be properly initialised', () => {
    service.initMetrics();
    assert.deepStrictEqual(southConnectorMetricsRepository.initMetrics.mock.calls[0].arguments, [testData.south.list[0].id]);
    assert.deepStrictEqual(service.metrics, testData.south.metrics);
  });

  it('should update in-memory metrics synchronously and coalesce DB writes', () => {
    // Five events fired in the same tick. In-memory metrics must update
    // synchronously after each, but the DB write is debounced so we expect
    // exactly one repository.updateMetrics call after the timer fires.
    southMock.metricsEvent.emit('connect', { lastConnection: testData.constants.dates.DATE_1 });
    assert.strictEqual(service.metrics.lastConnection, testData.constants.dates.DATE_1);

    southMock.metricsEvent.emit('run-start', { lastRunStart: testData.constants.dates.DATE_2 });
    assert.strictEqual(service.metrics.lastRunStart, testData.constants.dates.DATE_2);

    southMock.metricsEvent.emit('run-end', { lastRunDuration: 999 });
    assert.strictEqual(service.metrics.lastRunDuration, 999);

    southMock.metricsEvent.emit('add-values', { numberOfValuesRetrieved: 10, lastValueRetrieved: {} });
    assert.strictEqual(service.metrics.numberOfValuesRetrieved, testData.south.metrics.numberOfValuesRetrieved + 10);
    assert.deepStrictEqual(service.metrics.lastValueRetrieved, {});

    southMock.metricsEvent.emit('add-file', { lastFileRetrieved: 'last file retrieved' });
    assert.strictEqual(service.metrics.lastFileRetrieved, 'last file retrieved');

    // No DB write yet — the debounce timer hasn't fired.
    assert.strictEqual(southConnectorMetricsRepository.updateMetrics.mock.calls.length, 0);

    // Advance past the flush interval; one coalesced write should land.
    mock.timers.tick(1000);
    assert.strictEqual(southConnectorMetricsRepository.updateMetrics.mock.calls.length, 1);
    assert.deepStrictEqual(southConnectorMetricsRepository.updateMetrics.mock.calls[0].arguments, [
      testData.south.list[0].id,
      {
        ...testData.south.metrics,
        lastConnection: testData.constants.dates.DATE_1,
        lastRunStart: testData.constants.dates.DATE_2,
        lastRunDuration: 999,
        numberOfValuesRetrieved: testData.south.metrics.numberOfValuesRetrieved + 10,
        lastValueRetrieved: {},
        lastFileRetrieved: 'last file retrieved',
        numberOfFilesRetrieved: testData.south.metrics.numberOfValuesRetrieved + 1
      }
    ]);
  });

  it('should flush pending metrics on destroy so the last state survives shutdown', () => {
    // Emit one event but don't advance timers — flush is pending.
    southMock.metricsEvent.emit('add-values', { numberOfValuesRetrieved: 5, lastValueRetrieved: {} });
    assert.strictEqual(southConnectorMetricsRepository.updateMetrics.mock.calls.length, 0);

    service.destroy();
    // destroy() must drain the pending flush — exactly one DB write.
    assert.strictEqual(southConnectorMetricsRepository.updateMetrics.mock.calls.length, 1);
  });

  it('should cancel a pending flush on resetMetrics so it cannot race the re-init', () => {
    southMock.metricsEvent.emit('add-values', { numberOfValuesRetrieved: 1, lastValueRetrieved: {} });
    service.resetMetrics();
    mock.timers.tick(1000);
    // reset cleared the timer → no updateMetrics call against the old state.
    assert.strictEqual(southConnectorMetricsRepository.updateMetrics.mock.calls.length, 0);
  });

  it('should reset metrics', () => {
    service.resetMetrics();
    assert.ok(southConnectorMetricsRepository.removeMetrics.mock.calls.length > 0);
    assert.deepStrictEqual(southConnectorMetricsRepository.initMetrics.mock.calls[0].arguments, [testData.south.list[0].id]);
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
    const metricsEventOffSpy = mock.method(southMock.metricsEvent, 'off');
    const stream = service.stream;
    const streamDestroySpy = mock.method(stream, 'destroy');

    service.destroy();

    const offEvents = metricsEventOffSpy.mock.calls.map(c => c.arguments[0]);
    assert.ok(offEvents.includes('connect'));
    assert.ok(offEvents.includes('run-start'));
    assert.ok(offEvents.includes('run-end'));
    assert.ok(offEvents.includes('add-values'));
    assert.ok(offEvents.includes('add-file'));
    assert.ok(streamDestroySpy.mock.calls.length > 0);
    assert.strictEqual(service['_stream'], null);
  });
});
