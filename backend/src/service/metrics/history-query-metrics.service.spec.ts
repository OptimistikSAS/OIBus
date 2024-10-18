import HistoryQueryMetricsService from './history-query-metrics.service';
import testData from '../../tests/utils/test-data';
import HistoryQueryMetricsRepository from '../../repository/logs/history-query-metrics.repository';
import HistoryQueryMetricsRepositoryMock from '../../tests/__mocks__/repository/log/history-query-metrics-repository.mock';
import HistoryQuery from '../../engine/history-query';
import HistoryQueryMock from '../../tests/__mocks__/history-query.mock';

const historyQueryMetricsRepository: HistoryQueryMetricsRepository = new HistoryQueryMetricsRepositoryMock();
const historyQueryMock: HistoryQuery = new HistoryQueryMock(testData.historyQueries.list[0]);

describe('HistoryMetricsService', () => {
  let service: HistoryQueryMetricsService;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));

    (historyQueryMetricsRepository.getMetrics as jest.Mock).mockReturnValue(JSON.parse(JSON.stringify(testData.historyQueries.metrics)));
    service = new HistoryQueryMetricsService(historyQueryMock, historyQueryMetricsRepository);
  });

  it('should be properly initialised', () => {
    expect(historyQueryMetricsRepository.initMetrics).toHaveBeenCalledWith(testData.historyQueries.list[0].id);
    expect(service.metrics).toEqual(testData.historyQueries.metrics);
  });

  it('should update metrics', () => {
    historyQueryMock.metricsEvent.emit('north-cache-size', { cacheSize: 999 });
    expect(historyQueryMetricsRepository.updateMetrics).toHaveBeenCalledWith(testData.historyQueries.list[0].id, {
      ...testData.historyQueries.metrics,
      north: {
        ...testData.historyQueries.metrics.north,
        cacheSize: 999
      }
    });

    historyQueryMock.metricsEvent.emit('north-connect', { lastConnection: testData.constants.dates.DATE_1 });
    expect(historyQueryMetricsRepository.updateMetrics).toHaveBeenCalledWith(testData.historyQueries.list[0].id, {
      ...testData.historyQueries.metrics,
      north: {
        ...testData.historyQueries.metrics.north,
        cacheSize: 999,
        lastConnection: testData.constants.dates.DATE_1
      }
    });

    historyQueryMock.metricsEvent.emit('north-run-start', { lastRunStart: testData.constants.dates.DATE_2 });
    expect(historyQueryMetricsRepository.updateMetrics).toHaveBeenCalledWith(testData.historyQueries.list[0].id, {
      ...testData.historyQueries.metrics,
      north: {
        ...testData.historyQueries.metrics.north,
        cacheSize: 999,
        lastConnection: testData.constants.dates.DATE_1,
        lastRunStart: testData.constants.dates.DATE_2
      }
    });

    historyQueryMock.metricsEvent.emit('north-run-end', { lastRunDuration: 888 });
    expect(historyQueryMetricsRepository.updateMetrics).toHaveBeenCalledWith(testData.historyQueries.list[0].id, {
      ...testData.historyQueries.metrics,
      north: {
        ...testData.historyQueries.metrics.north,
        cacheSize: 999,
        lastConnection: testData.constants.dates.DATE_1,
        lastRunStart: testData.constants.dates.DATE_2,
        lastRunDuration: 888
      }
    });

    historyQueryMock.metricsEvent.emit('north-send-values', { numberOfValuesSent: 10, lastValueSent: {} });
    expect(historyQueryMetricsRepository.updateMetrics).toHaveBeenCalledWith(testData.historyQueries.list[0].id, {
      ...testData.historyQueries.metrics,
      north: {
        ...testData.historyQueries.metrics.north,
        cacheSize: 999,
        lastConnection: testData.constants.dates.DATE_1,
        lastRunStart: testData.constants.dates.DATE_2,
        lastRunDuration: 888,
        numberOfValuesSent: testData.historyQueries.metrics.north.numberOfValuesSent + 10,
        lastValueSent: {}
      }
    });

    historyQueryMock.metricsEvent.emit('north-send-file', { lastFileSent: 'last file sent' });
    expect(historyQueryMetricsRepository.updateMetrics).toHaveBeenCalledWith(testData.historyQueries.list[0].id, {
      ...testData.historyQueries.metrics,
      north: {
        ...testData.historyQueries.metrics.north,
        cacheSize: 999,
        lastConnection: testData.constants.dates.DATE_1,
        lastRunStart: testData.constants.dates.DATE_2,
        lastRunDuration: 888,
        numberOfValuesSent: testData.historyQueries.metrics.north.numberOfValuesSent + 10,
        lastValueSent: {},
        lastFileSent: 'last file sent',
        numberOfFilesSent: testData.historyQueries.metrics.north.numberOfFilesSent + 1
      }
    });

    historyQueryMock.metricsEvent.emit('south-connect', { lastConnection: testData.constants.dates.DATE_1 });
    expect(historyQueryMetricsRepository.updateMetrics).toHaveBeenCalledWith(testData.historyQueries.list[0].id, {
      ...testData.historyQueries.metrics,
      north: {
        ...testData.historyQueries.metrics.north,
        cacheSize: 999,
        lastConnection: testData.constants.dates.DATE_1,
        lastRunStart: testData.constants.dates.DATE_2,
        lastRunDuration: 888,
        numberOfValuesSent: testData.historyQueries.metrics.north.numberOfValuesSent + 10,
        lastValueSent: {},
        lastFileSent: 'last file sent',
        numberOfFilesSent: testData.historyQueries.metrics.north.numberOfFilesSent + 1
      },
      south: {
        ...testData.historyQueries.metrics.south,
        lastConnection: testData.constants.dates.DATE_1
      }
    });

    historyQueryMock.metricsEvent.emit('south-run-start', { lastRunStart: testData.constants.dates.DATE_2 });
    expect(historyQueryMetricsRepository.updateMetrics).toHaveBeenCalledWith(testData.historyQueries.list[0].id, {
      ...testData.historyQueries.metrics,
      north: {
        ...testData.historyQueries.metrics.north,
        cacheSize: 999,
        lastConnection: testData.constants.dates.DATE_1,
        lastRunStart: testData.constants.dates.DATE_2,
        lastRunDuration: 888,
        numberOfValuesSent: testData.historyQueries.metrics.north.numberOfValuesSent + 10,
        lastValueSent: {},
        lastFileSent: 'last file sent',
        numberOfFilesSent: testData.historyQueries.metrics.north.numberOfFilesSent + 1
      },
      south: {
        ...testData.historyQueries.metrics.south,
        lastConnection: testData.constants.dates.DATE_1,
        lastRunStart: testData.constants.dates.DATE_2
      }
    });

    historyQueryMock.metricsEvent.emit('south-run-end', { lastRunDuration: 999 });
    expect(historyQueryMetricsRepository.updateMetrics).toHaveBeenCalledWith(testData.historyQueries.list[0].id, {
      ...testData.historyQueries.metrics,
      north: {
        ...testData.historyQueries.metrics.north,
        cacheSize: 999,
        lastConnection: testData.constants.dates.DATE_1,
        lastRunStart: testData.constants.dates.DATE_2,
        lastRunDuration: 888,
        numberOfValuesSent: testData.historyQueries.metrics.north.numberOfValuesSent + 10,
        lastValueSent: {},
        lastFileSent: 'last file sent',
        numberOfFilesSent: testData.historyQueries.metrics.north.numberOfFilesSent + 1
      },
      south: {
        ...testData.historyQueries.metrics.south,
        lastConnection: testData.constants.dates.DATE_1,
        lastRunStart: testData.constants.dates.DATE_2,
        lastRunDuration: 999
      }
    });

    historyQueryMock.metricsEvent.emit('south-add-values', { numberOfValuesRetrieved: 10, lastValueRetrieved: {} });
    expect(historyQueryMetricsRepository.updateMetrics).toHaveBeenCalledWith(testData.historyQueries.list[0].id, {
      ...testData.historyQueries.metrics,
      north: {
        ...testData.historyQueries.metrics.north,
        cacheSize: 999,
        lastConnection: testData.constants.dates.DATE_1,
        lastRunStart: testData.constants.dates.DATE_2,
        lastRunDuration: 888,
        numberOfValuesSent: testData.historyQueries.metrics.north.numberOfValuesSent + 10,
        lastValueSent: {},
        lastFileSent: 'last file sent',
        numberOfFilesSent: testData.historyQueries.metrics.north.numberOfFilesSent + 1
      },
      south: {
        ...testData.historyQueries.metrics.south,
        lastConnection: testData.constants.dates.DATE_1,
        lastRunStart: testData.constants.dates.DATE_2,
        lastRunDuration: 999,
        numberOfValuesRetrieved: testData.historyQueries.metrics.south.numberOfValuesRetrieved + 10,
        lastValueRetrieved: {}
      }
    });

    historyQueryMock.metricsEvent.emit('south-add-file', { lastFileRetrieved: 'last file retrieved' });
    expect(historyQueryMetricsRepository.updateMetrics).toHaveBeenCalledWith(testData.historyQueries.list[0].id, {
      ...testData.historyQueries.metrics,
      north: {
        ...testData.historyQueries.metrics.north,
        cacheSize: 999,
        lastConnection: testData.constants.dates.DATE_1,
        lastRunStart: testData.constants.dates.DATE_2,
        lastRunDuration: 888,
        numberOfValuesSent: testData.historyQueries.metrics.north.numberOfValuesSent + 10,
        lastValueSent: {},
        lastFileSent: 'last file sent',
        numberOfFilesSent: testData.historyQueries.metrics.north.numberOfFilesSent + 1
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
      }
    });

    historyQueryMock.metricsEvent.emit('south-history-query-start', { running: true, intervalProgress: 20 });
    expect(historyQueryMetricsRepository.updateMetrics).toHaveBeenCalledWith(testData.historyQueries.list[0].id, {
      ...testData.historyQueries.metrics,
      north: {
        ...testData.historyQueries.metrics.north,
        cacheSize: 999,
        lastConnection: testData.constants.dates.DATE_1,
        lastRunStart: testData.constants.dates.DATE_2,
        lastRunDuration: 888,
        numberOfValuesSent: testData.historyQueries.metrics.north.numberOfValuesSent + 10,
        lastValueSent: {},
        lastFileSent: 'last file sent',
        numberOfFilesSent: testData.historyQueries.metrics.north.numberOfFilesSent + 1
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
        running: true,
        intervalProgress: 20
      }
    });

    historyQueryMock.metricsEvent.emit('south-history-query-interval', {
      running: true,
      intervalProgress: 25,
      currentIntervalStart: testData.constants.dates.DATE_1,
      currentIntervalEnd: testData.constants.dates.DATE_3,
      currentIntervalNumber: 2,
      numberOfIntervals: 10
    });
    expect(historyQueryMetricsRepository.updateMetrics).toHaveBeenCalledWith(testData.historyQueries.list[0].id, {
      ...testData.historyQueries.metrics,
      north: {
        ...testData.historyQueries.metrics.north,
        cacheSize: 999,
        lastConnection: testData.constants.dates.DATE_1,
        lastRunStart: testData.constants.dates.DATE_2,
        lastRunDuration: 888,
        numberOfValuesSent: testData.historyQueries.metrics.north.numberOfValuesSent + 10,
        lastValueSent: {},
        lastFileSent: 'last file sent',
        numberOfFilesSent: testData.historyQueries.metrics.north.numberOfFilesSent + 1
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
        running: true,
        intervalProgress: 25,
        currentIntervalStart: testData.constants.dates.DATE_1,
        currentIntervalEnd: testData.constants.dates.DATE_3,
        currentIntervalNumber: 2,
        numberOfIntervals: 10
      }
    });

    historyQueryMock.metricsEvent.emit('south-history-query-stop', {
      running: false
    });
    expect(historyQueryMetricsRepository.updateMetrics).toHaveBeenCalledWith(testData.historyQueries.list[0].id, {
      ...testData.historyQueries.metrics,
      north: {
        ...testData.historyQueries.metrics.north,
        cacheSize: 999,
        lastConnection: testData.constants.dates.DATE_1,
        lastRunStart: testData.constants.dates.DATE_2,
        lastRunDuration: 888,
        numberOfValuesSent: testData.historyQueries.metrics.north.numberOfValuesSent + 10,
        lastValueSent: {},
        lastFileSent: 'last file sent',
        numberOfFilesSent: testData.historyQueries.metrics.north.numberOfFilesSent + 1
      },
      south: {
        ...testData.historyQueries.metrics.south,
        lastConnection: testData.constants.dates.DATE_1,
        lastRunStart: testData.constants.dates.DATE_2,
        lastRunDuration: 999,
        numberOfValuesRetrieved: testData.historyQueries.metrics.south.numberOfValuesRetrieved + 10,
        lastValueRetrieved: {},
        lastFileRetrieved: 'last file retrieved',
        numberOfFilesRetrieved: testData.historyQueries.metrics.south.numberOfValuesRetrieved + 1
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
    });
  });

  it('should reset metrics', () => {
    service.resetMetrics();

    expect(historyQueryMetricsRepository.removeMetrics).toHaveBeenCalled();
    expect(historyQueryMetricsRepository.initMetrics).toHaveBeenCalled();
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
