import { beforeEach, afterEach, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import HomeMetricsService from './home-metrics.service';
import OIBusService from '../oibus.service';
import OIBusServiceMock from '../../tests/__mocks__/service/oibus-service.mock';
import DataStreamEngine from '../../engine/data-stream-engine';
import DataStreamEngineMock from '../../tests/__mocks__/data-stream-engine.mock';
import testData from '../../tests/utils/test-data';

let oIBusService: OIBusServiceMock;
let dataStreamEngine: DataStreamEngineMock;
let service: HomeMetricsService;

describe('HomeMetricsService', () => {
  beforeEach(() => {
    oIBusService = new OIBusServiceMock();
    dataStreamEngine = new DataStreamEngineMock(null);
    mock.timers.enable({ apis: ['setInterval', 'setTimeout'] });
    service = new HomeMetricsService(
      oIBusService as unknown as OIBusService,
      dataStreamEngine as unknown as DataStreamEngine
    );
  });

  afterEach(() => {
    mock.timers.reset();
    mock.restoreAll();
  });

  it('should send metrics', () => {
    dataStreamEngine.getAllSouthMetrics.mock.mockImplementation(() => ({}));
    dataStreamEngine.getAllNorthMetrics.mock.mockImplementation(() => ({}));
    oIBusService.stream.emit('data', `data: ${JSON.stringify(testData.engine.metrics)}`);
    const stream = service.stream;
    stream.write = mock.fn();
    oIBusService.stream.emit('data', `data: ${JSON.stringify(testData.engine.metrics)}`);
    assert.strictEqual((stream.write as ReturnType<typeof mock.fn>).mock.calls.length, 1);
    assert.deepStrictEqual((stream.write as ReturnType<typeof mock.fn>).mock.calls[0].arguments, [
      `data: ${JSON.stringify({
        norths: {},
        engine: testData.engine.metrics,
        souths: {}
      })}\n\n`
    ]);
  });

  it('should get stream', () => {
    const stream = service.stream;
    stream.write = mock.fn();
    mock.timers.tick(100);
    assert.strictEqual((stream.write as ReturnType<typeof mock.fn>).mock.calls.length, 1);
    assert.ok(service.stream);
  });
});
