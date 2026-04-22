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
    historyQueryMetricsRepository.getMetrics.mock.mockImplementation(() => JSON.parse(JSON.stringify(testData.historyQueries.metrics)));
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

  it('should update metrics', () => {
    historyQueryMock.metricsEvent.emit('north-cache-size', { cacheSize: 999, errorSize: 888, archiveSize: 777 });
    assert.deepStrictEqual(historyQueryMetricsRepository.updateMetrics.mock.calls[0].arguments, [testData.historyQueries.list[0].id, {
      ...testData.historyQueries.metrics,
      north: {
        ...testData.historyQueries.metrics.north,
        currentCacheSize: 999,
        currentErrorSize: 888,
        currentArchiveSize: 777
      }
    }]);

    historyQueryMock.metricsEvent.emit('north-connect', { lastConnection: testData.constants.dates.DATE_1 });
    assert.deepStrictEqual(historyQueryMetricsRepository.updateMetrics.mock.calls[1].arguments, [testData.historyQueries.list[0].id, {
      ...testData.historyQueries.metrics,
      north: {
        ...testData.historyQueries.metrics.north,
        currentCacheSize: 999,
        currentErrorSize: 888,
        currentArchiveSize: 777,
        lastConnection: testData.constants.dates.DATE_1
      }
    }]);

    historyQueryMock.metricsEvent.emit('north-run-start', { lastRunStart: testData.constants.dates.DATE_2 });
    assert.deepStrictEqual(historyQueryMetricsRepository.updateMetrics.mock.calls[2].arguments, [testData.historyQueries.list[0].id, {
      ...testData.historyQueries.metrics,
      north: {
        ...testData.historyQueries.metrics.north,
        currentCacheSize: 999,
        currentErrorSize: 888,
        currentArchiveSize: 777,
        lastConnection: testData.constants.dates.DATE_1,
        lastRunStart: testData.constants.dates.DATE_2
      }
    }]);

    historyQueryMock.metricsEvent.emit('north-run-end', {
      lastRunDuration: 888,
      metadata: { contentSize: 10, contentFile: 'file.csv' },
      action: 'sent'
    });
    assert.deepStrictEqual(historyQueryMetricsRepository.updateMetrics.mock.calls[3].arguments, [testData.historyQueries.list[0].id, {
      ...testData.historyQueries.metrics,
      north: {
        ...testData.historyQueries.metrics.north,
        currentCacheSize: 999,
        currentErrorSize: 888,
        currentArchiveSize: 777,
        lastConnection: testData.constants.dates.DATE_1,
        lastRunStart: testData.constants.dates.DATE_2,
        lastRunDuration: 888,
        contentSentSize: testData.historyQueries.metrics.north.contentSentSize + 10,
        lastContentSent: 'file.csv'
      }
    }]);

    historyQueryMock.metricsEvent.emit('north-run-end', {
      lastRunDuration: 888,
      metadata: { contentSize: 10, contentFile: 'file.csv' },
      action: 'archived'
    });
    assert.deepStrictEqual(historyQueryMetricsRepository.updateMetrics.mock.calls[4].arguments, [testData.historyQueries.list[0].id, {
      ...testData.historyQueries.metrics,
      north: {
        ...testData.historyQueries.metrics.north,
        currentCacheSize: 999,
        currentErrorSize: 888,
        currentArchiveSize: 777,
        lastConnection: testData.constants.dates.DATE_1,
        lastRunStart: testData.constants.dates.DATE_2,
        lastRunDuration: 888,
        contentSentSize: testData.historyQueries.metrics.north.contentSentSize + 20,
        contentArchivedSize: testData.historyQueries.metrics.north.contentArchivedSize + 10,
        lastContentSent: 'file.csv'
      }
    }]);

    historyQueryMock.metricsEvent.emit('north-run-end', {
      lastRunDuration: 888,
      metadata: { contentSize: 10, contentFile: 'file.csv' },
      action: 'errored'
    });
    assert.deepStrictEqual(historyQueryMetricsRepository.updateMetrics.mock.calls[5].arguments, [testData.historyQueries.list[0].id, {
      ...testData.historyQueries.metrics,
      north: {
        ...testData.historyQueries.metrics.north,
        currentCacheSize: 999,
        currentErrorSize: 888,
        currentArchiveSize: 777,
        lastConnection: testData.constants.dates.DATE_1,
        lastRunStart: testData.constants.dates.DATE_2,
        lastRunDuration: 888,
        contentSentSize: testData.historyQueries.metrics.north.contentSentSize + 20,
        contentArchivedSize: testData.historyQueries.metrics.north.contentArchivedSize + 10,
        contentErroredSize: testData.historyQueries.metrics.north.contentErroredSize + 10,
        lastContentSent: 'file.csv'
      }
    }]);

    historyQueryMock.metricsEvent.emit('north-cache-content-size', 123);
    assert.deepStrictEqual(historyQueryMetricsRepository.updateMetrics.mock.calls[6].arguments, [testData.historyQueries.list[0].id, {
      ...testData.historyQueries.metrics,
      north: {
        ...testData.historyQueries.metrics.north,
        currentCacheSize: 999,
        currentErrorSize: 888,
        currentArchiveSize: 777,
        lastConnection: testData.constants.dates.DATE_1,
        lastRunStart: testData.constants.dates.DATE_2,
        lastRunDuration: 888,
        contentCachedSize: testData.historyQueries.metrics.north.contentCachedSize + 123,
        contentSentSize: testData.historyQueries.metrics.north.contentSentSize + 20,
        contentArchivedSize: testData.historyQueries.metrics.north.contentArchivedSize + 10,
        contentErroredSize: testData.historyQueries.metrics.north.contentErroredSize + 10,
        lastContentSent: 'file.csv'
      }
    }]);

    historyQueryMock.metricsEvent.emit('south-connect', { lastConnection: testData.constants.dates.DATE_1 });
    assert.deepStrictEqual(historyQueryMetricsRepository.updateMetrics.mock.calls[7].arguments, [testData.historyQueries.list[0].id, {
      ...testData.historyQueries.metrics,
      north: {
        ...testData.historyQueries.metrics.north,
        currentCacheSize: 999,
        currentErrorSize: 888,
        currentArchiveSize: 777,
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
        lastConnection: testData.constants.dates.DATE_1
      }
    }]);

    historyQueryMock.metricsEvent.emit('south-run-start', { lastRunStart: testData.constants.dates.DATE_2 });
    assert.deepStrictEqual(historyQueryMetricsRepository.updateMetrics.mock.calls[8].arguments, [testData.historyQueries.list[0].id, {
      ...testData.historyQueries.metrics,
      north: {
        ...testData.historyQueries.metrics.north,
        currentCacheSize: 999,
        currentErrorSize: 888,
        currentArchiveSize: 777,
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
        lastRunStart: testData.constants.dates.DATE_2
      }
    }]);

    historyQueryMock.metricsEvent.emit('south-run-end', { lastRunDuration: 999 });
    assert.deepStrictEqual(historyQueryMetricsRepository.updateMetrics.mock.calls[9].arguments, [testData.historyQueries.list[0].id, {
      ...testData.historyQueries.metrics,
      north: {
        ...testData.historyQueries.metrics.north,
        currentCacheSize: 999,
        currentErrorSize: 888,
        currentArchiveSize: 777,
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
        lastRunDuration: 999
      }
    }]);

    historyQueryMock.metricsEvent.emit('south-add-values', { numberOfValuesRetrieved: 10, lastValueRetrieved: {} });
    assert.deepStrictEqual(historyQueryMetricsRepository.updateMetrics.mock.calls[10].arguments, [testData.historyQueries.list[0].id, {
      ...testData.historyQueries.metrics,
      north: {
        ...testData.historyQueries.metrics.north,
        currentCacheSize: 999,
        currentErrorSize: 888,
        currentArchiveSize: 777,
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
        lastValueRetrieved: {}
      }
    }]);

    historyQueryMock.metricsEvent.emit('south-add-file', { lastFileRetrieved: 'last file retrieved' });
    assert.deepStrictEqual(historyQueryMetricsRepository.updateMetrics.mock.calls[11].arguments, [testData.historyQueries.list[0].id, {
      ...testData.historyQueries.metrics,
      north: {
        ...testData.historyQueries.metrics.north,
        currentCacheSize: 999,
        currentErrorSize: 888,
        currentArchiveSize: 777,
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
      }
    }]);

    historyQueryMock.metricsEvent.emit('south-history-query-start', { running: true, intervalProgress: 20 });
    assert.deepStrictEqual(historyQueryMetricsRepository.updateMetrics.mock.calls[12].arguments, [testData.historyQueries.list[0].id, {
      ...testData.historyQueries.metrics,
      north: {
        ...testData.historyQueries.metrics.north,
        currentCacheSize: 999,
        currentErrorSize: 888,
        currentArchiveSize: 777,
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
        running: true,
        intervalProgress: 20
      }
    }]);

    historyQueryMock.metricsEvent.emit('south-history-query-interval', {
      running: true,
      intervalProgress: 25,
      currentIntervalStart: testData.constants.dates.DATE_1,
      currentIntervalEnd: testData.constants.dates.DATE_3,
      currentIntervalNumber: 2,
      numberOfIntervals: 10
    });
    assert.deepStrictEqual(historyQueryMetricsRepository.updateMetrics.mock.calls[13].arguments, [testData.historyQueries.list[0].id, {
      ...testData.historyQueries.metrics,
      north: {
        ...testData.historyQueries.metrics.north,
        currentCacheSize: 999,
        currentErrorSize: 888,
        currentArchiveSize: 777,
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
        running: true,
        intervalProgress: 25,
        currentIntervalStart: testData.constants.dates.DATE_1,
        currentIntervalEnd: testData.constants.dates.DATE_3,
        currentIntervalNumber: 2,
        numberOfIntervals: 10
      }
    }]);

    historyQueryMock.metricsEvent.emit('south-history-query-stop', { running: false });
    assert.deepStrictEqual(historyQueryMetricsRepository.updateMetrics.mock.calls[14].arguments, [testData.historyQueries.list[0].id, {
      ...testData.historyQueries.metrics,
      north: {
        ...testData.historyQueries.metrics.north,
        currentCacheSize: 999,
        currentErrorSize: 888,
        currentArchiveSize: 777,
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
    }]);
  });

  it('should reset metrics', () => {
    service.resetMetrics();
    assert.ok(historyQueryMetricsRepository.removeMetrics.mock.calls.length > 0);
    assert.ok(historyQueryMetricsRepository.initMetrics.mock.calls.length > 0);
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
