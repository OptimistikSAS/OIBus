import SouthConnectorMetricsService from './south-connector-metrics.service';
import SouthMetricsRepositoryMock from '../../tests/__mocks__/repository/log/south-metrics-repository.mock';
import SouthConnectorMetricsRepository from '../../repository/logs/south-connector-metrics.repository';
import testData from '../../tests/utils/test-data';
import SouthConnector from '../../south/south-connector';
import { SouthItemSettings, SouthSettings } from '../../../../shared/model/south-settings.model';
import SouthConnectorMock from '../../tests/__mocks__/south-connector.mock';

const southConnectorMetricsRepository: SouthConnectorMetricsRepository = new SouthMetricsRepositoryMock();
const southMock: SouthConnector<SouthSettings, SouthItemSettings> = new SouthConnectorMock(testData.south.list[0]);

describe('SouthConnectorMetricsService', () => {
  let service: SouthConnectorMetricsService;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));

    (southConnectorMetricsRepository.getMetrics as jest.Mock).mockReturnValue(JSON.parse(JSON.stringify(testData.south.metrics)));
    service = new SouthConnectorMetricsService(southMock, southConnectorMetricsRepository);
  });

  it('should be properly initialised', () => {
    expect(southConnectorMetricsRepository.initMetrics).toHaveBeenCalledWith(testData.south.list[0].id);
    expect(service.metrics).toEqual(testData.south.metrics);
  });

  it('should update metrics', () => {
    southMock.metricsEvent.emit('connect', { lastConnection: testData.constants.dates.DATE_1 });
    expect(southConnectorMetricsRepository.updateMetrics).toHaveBeenCalledWith(testData.south.list[0].id, {
      ...testData.south.metrics,
      lastConnection: testData.constants.dates.DATE_1
    });

    southMock.metricsEvent.emit('run-start', { lastRunStart: testData.constants.dates.DATE_2 });
    expect(southConnectorMetricsRepository.updateMetrics).toHaveBeenCalledWith(testData.south.list[0].id, {
      ...testData.south.metrics,
      lastConnection: testData.constants.dates.DATE_1,
      lastRunStart: testData.constants.dates.DATE_2
    });

    southMock.metricsEvent.emit('run-end', { lastRunDuration: 999 });
    expect(southConnectorMetricsRepository.updateMetrics).toHaveBeenCalledWith(testData.south.list[0].id, {
      ...testData.south.metrics,
      lastConnection: testData.constants.dates.DATE_1,
      lastRunStart: testData.constants.dates.DATE_2,
      lastRunDuration: 999
    });

    southMock.metricsEvent.emit('add-values', { numberOfValuesRetrieved: 10, lastValueRetrieved: {} });
    expect(southConnectorMetricsRepository.updateMetrics).toHaveBeenCalledWith(testData.south.list[0].id, {
      ...testData.south.metrics,
      lastConnection: testData.constants.dates.DATE_1,
      lastRunStart: testData.constants.dates.DATE_2,
      lastRunDuration: 999,
      numberOfValuesRetrieved: testData.south.metrics.numberOfValuesRetrieved + 10,
      lastValueRetrieved: {}
    });

    southMock.metricsEvent.emit('add-file', { lastFileRetrieved: 'last file retrieved' });
    expect(southConnectorMetricsRepository.updateMetrics).toHaveBeenCalledWith(testData.south.list[0].id, {
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

  it('should write on stream', () => {
    const stream = service.stream;
    stream.write = jest.fn();

    service.updateMetrics();
    expect(stream.write).toHaveBeenCalledTimes(1);
    service.initMetrics();

    expect(stream.write).toHaveBeenCalledTimes(2);
  });
});
