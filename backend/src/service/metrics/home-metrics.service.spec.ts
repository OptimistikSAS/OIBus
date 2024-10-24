import HomeMetricsService from './home-metrics.service';
import OIBusService from '../oibus.service';
import OIBusServiceMock from '../../tests/__mocks__/service/oibus-service.mock';
import DataStreamEngine from '../../engine/data-stream-engine';
import DataStreamEngineMock from '../../tests/__mocks__/data-stream-engine.mock';
import testData from '../../tests/utils/test-data';

jest.mock('../utils');
jest.mock('../oibus.service');

const oIBusService: OIBusService = new OIBusServiceMock();
const dataStreamEngine: DataStreamEngine = new DataStreamEngineMock();

describe('HomeMetricsService', () => {
  let service: HomeMetricsService;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    service = new HomeMetricsService(oIBusService, dataStreamEngine);
  });

  it('should send metrics', () => {
    (dataStreamEngine.getSouthConnectorMetrics as jest.Mock).mockReturnValue({});
    (dataStreamEngine.getNorthConnectorMetrics as jest.Mock).mockReturnValue({});
    oIBusService.stream.emit('data', `data: ${JSON.stringify(testData.engine.metrics)}`);
    const stream = service.stream;
    stream.write = jest.fn();
    oIBusService.stream.emit('data', `data: ${JSON.stringify(testData.engine.metrics)}`);
    expect(stream.write).toHaveBeenCalledTimes(1);
    expect(stream.write).toHaveBeenCalledWith(
      `data: ${JSON.stringify({
        norths: {},
        engine: testData.engine.metrics,
        souths: {}
      })}\n\n`
    );
  });

  it('should get stream', () => {
    const stream = service.stream;
    stream.write = jest.fn();
    jest.advanceTimersByTime(100);
    expect(stream.write).toHaveBeenCalledTimes(1);

    expect(service.stream).toBeDefined();
  });
});
