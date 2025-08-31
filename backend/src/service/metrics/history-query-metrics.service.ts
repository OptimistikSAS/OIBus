import { CacheMetadata, HistoryQueryMetrics, OIBusTimeValue } from '../../../shared/model/engine.model';
import { PassThrough } from 'node:stream';
import HistoryQuery from '../../engine/history-query';
import HistoryQueryMetricsRepository from '../../repository/metrics/history-query-metrics.repository';
import { DateTime } from 'luxon';
import { Instant } from '../../model/types';

export default class HistoryQueryMetricsService {
  private _stream: PassThrough | null = null;
  private _metrics: HistoryQueryMetrics = {
    metricsStart: DateTime.now().toUTC().toISO()!,
    north: {
      contentSentSize: 0,
      contentCachedSize: 0,
      contentErroredSize: 0,
      contentArchivedSize: 0,
      lastContentSent: null,
      lastConnection: null,
      lastRunStart: null,
      lastRunDuration: null,
      currentCacheSize: 0,
      currentErrorSize: 0,
      currentArchiveSize: 0
    },
    south: {
      numberOfValuesRetrieved: 0,
      numberOfFilesRetrieved: 0,
      lastValueRetrieved: null,
      lastFileRetrieved: null,
      lastConnection: null,
      lastRunStart: null,
      lastRunDuration: null
    },
    historyMetrics: {
      running: false,
      intervalProgress: 0,
      currentIntervalStart: null,
      currentIntervalEnd: null,
      currentIntervalNumber: 0,
      numberOfIntervals: 0
    }
  };

  constructor(
    private readonly historyQuery: HistoryQuery,
    private readonly historyQueryMetricsRepository: HistoryQueryMetricsRepository
  ) {
    this.initMetrics();
    this.historyQuery.metricsEvent.on('north-connect', (data: { lastConnection: Instant }) => {
      this._metrics.north.lastConnection = data.lastConnection;
      this.updateMetrics();
    });
    this.historyQuery.metricsEvent.on('north-run-start', (data: { lastRunStart: Instant }) => {
      this._metrics.north.lastRunStart = data.lastRunStart;
      this.updateMetrics();
    });
    this.historyQuery.metricsEvent.on(
      'north-run-end',
      (data: { lastRunDuration: number; metadata: CacheMetadata; action: 'sent' | 'errored' | 'archived' }) => {
        this._metrics.north.lastRunDuration = data.lastRunDuration;
        if (data.action === 'sent') {
          this._metrics.north.lastContentSent = data.metadata.contentFile;
          this._metrics.north.contentSentSize += data.metadata.contentSize;
        } else if (data.action === 'archived') {
          this._metrics.north.lastContentSent = data.metadata.contentFile;
          this._metrics.north.contentArchivedSize += data.metadata.contentSize;
          this._metrics.north.contentSentSize += data.metadata.contentSize;
        } else {
          this._metrics.north.contentErroredSize += data.metadata.contentSize;
        }
        this.updateMetrics();
      }
    );
    this.historyQuery.metricsEvent.on('north-cache-size', (data: { cacheSize: number; errorSize: number; archiveSize: number }) => {
      this._metrics.north.currentCacheSize = data.cacheSize;
      this._metrics.north.currentErrorSize = data.errorSize;
      this._metrics.north.currentArchiveSize = data.archiveSize;
      this.updateMetrics();
    });
    this.historyQuery.metricsEvent.on('north-cache-content-size', (cachedSize: number) => {
      this._metrics.north.contentCachedSize += cachedSize;
      this.updateMetrics();
    });

    this.historyQuery.metricsEvent.on('south-connect', (data: { lastConnection: Instant }) => {
      this._metrics.south.lastConnection = data.lastConnection;
      this.updateMetrics();
    });
    this.historyQuery.metricsEvent.on('south-run-start', (data: { lastRunStart: Instant }) => {
      this._metrics.south.lastRunStart = data.lastRunStart;
      this.updateMetrics();
    });
    this.historyQuery.metricsEvent.on('south-run-end', (data: { lastRunDuration: number }) => {
      this._metrics.south.lastRunDuration = data.lastRunDuration;
      this.updateMetrics();
    });
    this.historyQuery.metricsEvent.on('south-history-query-start', (data: { running: boolean; intervalProgress: number }) => {
      this._metrics.historyMetrics.running = data.running;
      this._metrics.historyMetrics.intervalProgress = data.intervalProgress;
      this.updateMetrics();
    });
    this.historyQuery.metricsEvent.on(
      'south-history-query-interval',
      (data: {
        running: boolean;
        intervalProgress: number;
        currentIntervalStart: Instant;
        currentIntervalEnd: Instant;
        currentIntervalNumber: number;
        numberOfIntervals: number;
      }) => {
        this._metrics.historyMetrics.running = data.running;
        this._metrics.historyMetrics.intervalProgress = data.intervalProgress;
        this._metrics.historyMetrics.currentIntervalStart = data.currentIntervalStart;
        this._metrics.historyMetrics.currentIntervalEnd = data.currentIntervalEnd;
        this._metrics.historyMetrics.currentIntervalNumber = data.currentIntervalNumber;
        this._metrics.historyMetrics.numberOfIntervals = data.numberOfIntervals;
        this.updateMetrics();
      }
    );
    this.historyQuery.metricsEvent.on('south-history-query-stop', (data: { running: boolean }) => {
      this._metrics.historyMetrics.running = data.running;
      this.updateMetrics();
    });
    this.historyQuery.metricsEvent.on(
      'south-add-values',
      (data: { numberOfValuesRetrieved: number; lastValueRetrieved: OIBusTimeValue }) => {
        this._metrics.south.numberOfValuesRetrieved += data.numberOfValuesRetrieved;
        this._metrics.south.lastValueRetrieved = data.lastValueRetrieved;
        this.updateMetrics();
      }
    );
    this.historyQuery.metricsEvent.on('south-add-file', (data: { lastFileRetrieved: string }) => {
      this._metrics.south.numberOfFilesRetrieved += 1;
      this._metrics.south.lastFileRetrieved = data.lastFileRetrieved;
      this.updateMetrics();
    });
  }

  initMetrics(): void {
    this.historyQueryMetricsRepository.initMetrics(this.historyQuery.historyQueryConfiguration.id);
    this._metrics = this.historyQueryMetricsRepository.getMetrics(this.historyQuery.historyQueryConfiguration.id)!;
    this._stream?.write(`data: ${JSON.stringify(this._metrics)}\n\n`);
  }

  updateMetrics(): void {
    this.historyQueryMetricsRepository.updateMetrics(this.historyQuery.historyQueryConfiguration.id, this._metrics);
    this._stream?.write(`data: ${JSON.stringify(this._metrics)}\n\n`);
  }

  resetMetrics(): void {
    this.historyQueryMetricsRepository.removeMetrics(this.historyQuery.historyQueryConfiguration.id);
    this.initMetrics();
  }

  get metrics(): HistoryQueryMetrics {
    return this._metrics;
  }

  /**
   * Create a PassThrough object used to send a data to a stream to the frontend
   * The timeout is used to auto-initialize the stream at creation
   */
  get stream(): PassThrough {
    this._stream?.destroy();
    this._stream = new PassThrough();
    setTimeout(() => {
      this._stream?.write(`data: ${JSON.stringify(this._metrics)}\n\n`);
    }, 100);
    return this._stream;
  }
}
