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

  it('should update metrics', () => {
    southMock.metricsEvent.emit('connect', { lastConnection: testData.constants.dates.DATE_1 });
    assert.deepStrictEqual(southConnectorMetricsRepository.updateMetrics.mock.calls[0].arguments, [
      testData.south.list[0].id,
      {
        ...testData.south.metrics,
        lastConnection: testData.constants.dates.DATE_1
      }
    ]);

    southMock.metricsEvent.emit('run-start', { lastRunStart: testData.constants.dates.DATE_2 });
    assert.deepStrictEqual(southConnectorMetricsRepository.updateMetrics.mock.calls[1].arguments, [
      testData.south.list[0].id,
      {
        ...testData.south.metrics,
        lastConnection: testData.constants.dates.DATE_1,
        lastRunStart: testData.constants.dates.DATE_2
      }
    ]);

    southMock.metricsEvent.emit('run-end', { lastRunDuration: 999 });
    assert.deepStrictEqual(southConnectorMetricsRepository.updateMetrics.mock.calls[2].arguments, [
      testData.south.list[0].id,
      {
        ...testData.south.metrics,
        lastConnection: testData.constants.dates.DATE_1,
        lastRunStart: testData.constants.dates.DATE_2,
        lastRunDuration: 999
      }
    ]);

    southMock.metricsEvent.emit('add-values', { numberOfValuesRetrieved: 10, lastValueRetrieved: {} });
    assert.deepStrictEqual(southConnectorMetricsRepository.updateMetrics.mock.calls[3].arguments, [
      testData.south.list[0].id,
      {
        ...testData.south.metrics,
        lastConnection: testData.constants.dates.DATE_1,
        lastRunStart: testData.constants.dates.DATE_2,
        lastRunDuration: 999,
        numberOfValuesRetrieved: testData.south.metrics.numberOfValuesRetrieved + 10,
        lastValueRetrieved: {}
      }
    ]);

    southMock.metricsEvent.emit('add-file', { lastFileRetrieved: 'last file retrieved' });
    assert.deepStrictEqual(southConnectorMetricsRepository.updateMetrics.mock.calls[4].arguments, [
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

  it('should reset metrics', () => {
    service.resetMetrics();
    assert.ok(southConnectorMetricsRepository.removeMetrics.mock.calls.length > 0);
    assert.deepStrictEqual(southConnectorMetricsRepository.initMetrics.mock.calls[0].arguments, [testData.south.list[0].id]);
  });

  it('should get stream', () => {
    const stream = service.stream;
    stream.write = mock.fn();
    mock.timers.tick(100);
    assert.strictEqual((stream.write as ReturnType<typeof mock.fn>).mock.calls.length, 1);
    assert.ok(service.stream);
  });

  it('should write on stream', () => {
    const stream = service.stream;
    stream.write = mock.fn();

    service.updateMetrics();
    assert.strictEqual((stream.write as ReturnType<typeof mock.fn>).mock.calls.length, 1);
    service.initMetrics();
    assert.strictEqual((stream.write as ReturnType<typeof mock.fn>).mock.calls.length, 2);
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
