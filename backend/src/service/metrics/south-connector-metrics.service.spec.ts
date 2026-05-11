import SouthConnectorMetricsService from './south-connector-metrics.service';
import SouthMetricsRepositoryMock from '../../tests/__mocks__/repository/metrics/south-metrics-repository.mock';
import SouthConnectorMetricsRepository from '../../repository/metrics/south-connector-metrics.repository';
import testData from '../../tests/utils/test-data';
import SouthConnector from '../../south/south-connector';
import { SouthItemSettings, SouthSettings } from '../../../shared/model/south-settings.model';
import SouthConnectorMock from '../../tests/__mocks__/south-connector.mock';

const southConnectorMetricsRepository: SouthConnectorMetricsRepository = new SouthMetricsRepositoryMock();
const southMock = new SouthConnectorMock(testData.south.list[0]) as unknown as SouthConnector<SouthSettings, SouthItemSettings>;

describe('SouthConnectorMetricsService', () => {
  let service: SouthConnectorMetricsService;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));

    (southConnectorMetricsRepository.getMetrics as jest.Mock).mockReturnValue(JSON.parse(JSON.stringify(testData.south.metrics)));
    service = new SouthConnectorMetricsService(southMock, southConnectorMetricsRepository);
  });

  afterEach(() => {
    // Detach event listeners and drain any pending flush before the next test.
    // The `southMock` is module-scoped, so without this, listeners from earlier
    // tests would still fire when later tests emit events — turning the
    // debounced flush into an N-way write per advanceTimersByTime call.
    service.destroy();
    jest.useRealTimers();
  });

  it('should be properly initialised', () => {
    service.initMetrics();
    expect(southConnectorMetricsRepository.initMetrics).toHaveBeenCalledWith(testData.south.list[0].id);
    expect(service.metrics).toEqual(testData.south.metrics);
  });

  it('should update in-memory metrics synchronously and coalesce DB writes', () => {
    // Five events fired in the same tick. In-memory metrics must update
    // synchronously after each, but the DB write is debounced so we expect
    // exactly one repository.updateMetrics call after the timer fires.
    southMock.metricsEvent.emit('connect', { lastConnection: testData.constants.dates.DATE_1 });
    expect(service.metrics.lastConnection).toBe(testData.constants.dates.DATE_1);

    southMock.metricsEvent.emit('run-start', { lastRunStart: testData.constants.dates.DATE_2 });
    expect(service.metrics.lastRunStart).toBe(testData.constants.dates.DATE_2);

    southMock.metricsEvent.emit('run-end', { lastRunDuration: 999 });
    expect(service.metrics.lastRunDuration).toBe(999);

    southMock.metricsEvent.emit('add-values', { numberOfValuesRetrieved: 10, lastValueRetrieved: {} });
    expect(service.metrics.numberOfValuesRetrieved).toBe(testData.south.metrics.numberOfValuesRetrieved + 10);
    expect(service.metrics.lastValueRetrieved).toEqual({});

    southMock.metricsEvent.emit('add-file', { lastFileRetrieved: 'last file retrieved' });
    expect(service.metrics.lastFileRetrieved).toBe('last file retrieved');

    // No DB write yet — the debounce timer hasn't fired.
    expect(southConnectorMetricsRepository.updateMetrics).not.toHaveBeenCalled();

    // Advance past the flush interval; one coalesced write should land.
    jest.advanceTimersByTime(1000);
    expect(southConnectorMetricsRepository.updateMetrics).toHaveBeenCalledTimes(1);
    expect(southConnectorMetricsRepository.updateMetrics).toHaveBeenLastCalledWith(testData.south.list[0].id, {
      ...testData.south.metrics,
      lastConnection: testData.constants.dates.DATE_1,
      lastRunStart: testData.constants.dates.DATE_2,
      lastRunDuration: 999,
      numberOfValuesRetrieved: testData.south.metrics.numberOfValuesRetrieved + 10,
      lastValueRetrieved: {},
      lastFileRetrieved: 'last file retrieved',
      numberOfFilesRetrieved: testData.south.metrics.numberOfValuesRetrieved + 1
    });
  });

  it('should flush pending metrics on destroy so the last state survives shutdown', () => {
    // Emit one event but don't advance timers — flush is pending.
    southMock.metricsEvent.emit('add-values', { numberOfValuesRetrieved: 5, lastValueRetrieved: {} });
    expect(southConnectorMetricsRepository.updateMetrics).not.toHaveBeenCalled();

    service.destroy();
    // destroy() must drain the pending flush — exactly one DB write.
    expect(southConnectorMetricsRepository.updateMetrics).toHaveBeenCalledTimes(1);
  });

  it('should cancel a pending flush on resetMetrics so it cannot race the re-init', () => {
    southMock.metricsEvent.emit('add-values', { numberOfValuesRetrieved: 1, lastValueRetrieved: {} });
    service.resetMetrics();
    jest.advanceTimersByTime(1000);
    // reset cleared the timer → no updateMetrics call against the old state.
    expect(southConnectorMetricsRepository.updateMetrics).not.toHaveBeenCalled();
  });

  it('should reset metrics', () => {
    service.resetMetrics();
    expect(southConnectorMetricsRepository.removeMetrics).toHaveBeenCalled();
    expect(southConnectorMetricsRepository.initMetrics).toHaveBeenCalledWith(testData.south.list[0].id);
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
    // The stream getter schedules a 100 ms initial-snapshot write — drain that
    // timer before installing the spy so it doesn't pollute the assertions.
    jest.advanceTimersByTime(100);
    stream.write = jest.fn();

    // updateMetrics() schedules a flush; no synchronous stream write.
    service.updateMetrics();
    expect(stream.write).not.toHaveBeenCalled();

    // After the debounce window the stream receives one coalesced snapshot.
    jest.advanceTimersByTime(1000);
    expect(stream.write).toHaveBeenCalledTimes(1);

    // initMetrics still pushes an immediate snapshot — that's the initial
    // hand-off when the dashboard first subscribes, not a per-event update.
    service.initMetrics();
    expect(stream.write).toHaveBeenCalledTimes(2);
  });

  it('should properly clean up listeners on destroy', () => {
    const metricsEventOffSpy = jest.spyOn(southMock.metricsEvent, 'off');
    const stream = service.stream;
    const streamDestroySpy = jest.spyOn(stream, 'destroy');

    service.destroy();

    expect(metricsEventOffSpy).toHaveBeenCalledWith('connect', expect.any(Function));
    expect(metricsEventOffSpy).toHaveBeenCalledWith('run-start', expect.any(Function));
    expect(metricsEventOffSpy).toHaveBeenCalledWith('run-end', expect.any(Function));
    expect(metricsEventOffSpy).toHaveBeenCalledWith('add-values', expect.any(Function));
    expect(metricsEventOffSpy).toHaveBeenCalledWith('add-file', expect.any(Function));
    expect(streamDestroySpy).toHaveBeenCalled();
    expect(service['_stream']).toBeNull();
  });
});
