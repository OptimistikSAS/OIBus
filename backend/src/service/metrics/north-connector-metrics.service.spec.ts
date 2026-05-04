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

  it('should update metrics', () => {
    northMock.metricsEvent.emit('cache-size', { cacheSize: 999, errorSize: 888, archiveSize: 777 });
    assert.deepStrictEqual(northConnectorMetricsRepository.updateMetrics.mock.calls[0].arguments, [
      testData.north.list[0].id,
      {
        ...testData.north.metrics,
        currentCacheSize: 999,
        currentErrorSize: 888,
        currentArchiveSize: 777
      }
    ]);

    northMock.metricsEvent.emit('connect', { lastConnection: testData.constants.dates.DATE_1 });
    northMock.metricsEvent.emit('run-start', { lastRunStart: testData.constants.dates.DATE_2 });

    northMock.metricsEvent.emit('run-end', {
      lastRunDuration: 888,
      metadata: { contentSize: 10, contentFile: 'file.csv' },
      action: 'sent'
    });
    const call3 = northConnectorMetricsRepository.updateMetrics.mock.calls[3].arguments[1];
    assert.strictEqual(call3.contentSentSize, testData.north.metrics.contentSentSize + 10);
    assert.strictEqual(call3.lastContentSent, 'file.csv');

    northMock.metricsEvent.emit('run-end', {
      lastRunDuration: 888,
      metadata: { contentSize: 10, contentFile: 'file.csv' },
      action: 'archived'
    });
    const call4 = northConnectorMetricsRepository.updateMetrics.mock.calls[4].arguments[1];
    assert.strictEqual(call4.contentArchivedSize, testData.north.metrics.contentArchivedSize + 10);

    northMock.metricsEvent.emit('run-end', {
      lastRunDuration: 888,
      metadata: { contentSize: 10, contentFile: 'file.csv' },
      action: 'errored'
    });
    const call5 = northConnectorMetricsRepository.updateMetrics.mock.calls[5].arguments[1];
    assert.strictEqual(call5.contentErroredSize, testData.north.metrics.contentErroredSize + 10);

    northMock.metricsEvent.emit('cache-content-size', 123);
    const call6 = northConnectorMetricsRepository.updateMetrics.mock.calls[6].arguments[1];
    assert.strictEqual(call6.contentCachedSize, testData.north.metrics.contentCachedSize + 123);
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

  it('should write on stream', () => {
    const stream = service.stream;
    const writeSpy = mock.method(stream, 'write', () => true);

    service.updateMetrics();
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
