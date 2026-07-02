import { CacheMetadata, HistoryQueryMetrics, OIBusTimeValue } from '../../../shared/model/engine.model';
import { PassThrough } from 'node:stream';
import HistoryQuery from '../../engine/history-query';
import HistoryQueryMetricsRepository, { PersistedHistoryQueryMetrics } from '../../repository/metrics/history-query-metrics.repository';
import { DateTime } from 'luxon';
import { Instant } from '../../model/types';
import { applyNorthCacheContentSize, applyNorthConnect, applyNorthRunEnd, applyNorthRunStart } from './north-metrics-accumulator';

/**
 * Coalesce DB + SSE writes. Same rationale as south/north metrics services:
 * high-rate HA reads emit many metric events per second; we collapse them into
 * a single coalesced write per window. In-memory `_metrics` is always current.
 */
const METRICS_FLUSH_INTERVAL_MS = 1000;

export default class HistoryQueryMetricsService {
  private _stream: PassThrough | null = null;
  private metricsFlushTimer: NodeJS.Timeout | null = null;
  // Persisted fields only; the north current cache/error/archive sizes are added live in snapshot().
  private _metrics: PersistedHistoryQueryMetrics = {
    metricsStart: DateTime.now().toUTC().toISO()!,
    north: {
      contentSentSize: 0,
      contentCachedSize: 0,
      contentErroredSize: 0,
      contentArchivedSize: 0,
      lastContentSent: null,
      lastConnection: null,
      lastRunStart: null,
      lastRunDuration: null
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
    this.historyQuery.metricsEvent.on('north-connect', this.onNorthConnect);
    this.historyQuery.metricsEvent.on('north-run-start', this.onNorthRunStart);
    this.historyQuery.metricsEvent.on('north-run-end', this.onNorthRunEnd);
    this.historyQuery.metricsEvent.on('north-cache-size', this.onNorthCacheSize);
    this.historyQuery.metricsEvent.on('north-cache-content-size', this.onNorthCacheContentSize);

    this.historyQuery.metricsEvent.on('south-connect', this.onSouthConnect);
    this.historyQuery.metricsEvent.on('south-run-start', this.onSouthRunStart);
    this.historyQuery.metricsEvent.on('south-run-end', this.onSouthRunEnd);
    this.historyQuery.metricsEvent.on('south-history-query-start', this.onSouthHistoryQueryStart);
    this.historyQuery.metricsEvent.on('south-history-query-interval', this.onSouthHistoryQueryInterval);
    this.historyQuery.metricsEvent.on('south-history-query-stop', this.onSouthHistoryQueryStop);
    this.historyQuery.metricsEvent.on('south-add-values', this.onSouthAddValues);
    this.historyQuery.metricsEvent.on('south-add-file', this.onSouthAddFile);
  }

  private onNorthConnect = (data: { lastConnection: Instant }) => {
    applyNorthConnect(this._metrics.north, data);
    this.updateMetrics();
  };

  private onNorthRunStart = (data: { lastRunStart: Instant }) => {
    applyNorthRunStart(this._metrics.north, data);
    this.updateMetrics();
  };

  private onNorthRunEnd = (data: { lastRunDuration: number; metadata: CacheMetadata; action: 'sent' | 'errored' | 'archived' }) => {
    applyNorthRunEnd(this._metrics.north, data);
    this.updateMetrics();
  };

  private onNorthCacheSize = () => {
    // Current sizes are read live from the cache service at serialization time
    // (see snapshot()); this listener only triggers a debounced flush so the SSE
    // stream and the persisted row reflect a cache-size change promptly.
    this.updateMetrics();
  };

  private onNorthCacheContentSize = (cachedSize: number) => {
    applyNorthCacheContentSize(this._metrics.north, cachedSize);
    this.updateMetrics();
  };

  private onSouthConnect = (data: { lastConnection: Instant }) => {
    this._metrics.south.lastConnection = data.lastConnection;
    this.updateMetrics();
  };

  private onSouthRunStart = (data: { lastRunStart: Instant }) => {
    this._metrics.south.lastRunStart = data.lastRunStart;
    this.updateMetrics();
  };

  private onSouthRunEnd = (data: { lastRunDuration: number }) => {
    this._metrics.south.lastRunDuration = data.lastRunDuration;
    this.updateMetrics();
  };

  private onSouthHistoryQueryStart = (data: { running: boolean }) => {
    this._metrics.historyMetrics.running = data.running;
    this.updateMetrics();
  };

  private onSouthHistoryQueryInterval = (data: {
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
  };

  private onSouthHistoryQueryStop = (data: { running: boolean }) => {
    this._metrics.historyMetrics.running = data.running;
    this.updateMetrics();
  };

  private onSouthAddValues = (data: { numberOfValuesRetrieved: number; lastValueRetrieved: OIBusTimeValue | null }) => {
    this._metrics.south.numberOfValuesRetrieved += data.numberOfValuesRetrieved;
    this._metrics.south.lastValueRetrieved = data.lastValueRetrieved;
    this.updateMetrics();
  };

  private onSouthAddFile = (data: { lastFileRetrieved: string }) => {
    this._metrics.south.numberOfFilesRetrieved += 1;
    this._metrics.south.lastFileRetrieved = data.lastFileRetrieved;
    this.updateMetrics();
  };

  /**
   * The metrics as exposed/persisted: cumulative counters from `_metrics`, with the
   * north's current cache/error/archive sizes pulled live from the cache service (the
   * authoritative source) so the gauges can never drift or go stale.
   */
  private snapshot(): HistoryQueryMetrics {
    const { cache, error, archive } = this.historyQuery.getNorthCacheSizes();
    return {
      ...this._metrics,
      north: { ...this._metrics.north, currentCacheSize: cache, currentErrorSize: error, currentArchiveSize: archive }
    };
  }

  initMetrics(): void {
    this.historyQueryMetricsRepository.initMetrics(this.historyQuery.historyQueryConfiguration.id);
    this._metrics = this.historyQueryMetricsRepository.getMetrics(this.historyQuery.historyQueryConfiguration.id)!;
    this._stream?.write(`data: ${JSON.stringify(this.snapshot())}\n\n`);
  }

  /** Debounced flush. See METRICS_FLUSH_INTERVAL_MS. */
  updateMetrics(): void {
    if (this.metricsFlushTimer) return;
    this.metricsFlushTimer = setTimeout(() => {
      this.metricsFlushTimer = null;
      this.flushMetrics();
    }, METRICS_FLUSH_INTERVAL_MS);
  }

  private flushMetrics(): void {
    // Persist only the persisted fields; the SSE push carries the full snapshot (with live sizes).
    this.historyQueryMetricsRepository.updateMetrics(this.historyQuery.historyQueryConfiguration.id, this._metrics);
    this._stream?.write(`data: ${JSON.stringify(this.snapshot())}\n\n`);
  }

  resetMetrics(): void {
    // Cancel any pending flush — the row is about to be removed and re-init'd.
    if (this.metricsFlushTimer) {
      clearTimeout(this.metricsFlushTimer);
      this.metricsFlushTimer = null;
    }
    this.historyQueryMetricsRepository.removeMetrics(this.historyQuery.historyQueryConfiguration.id);
    this.initMetrics();
  }

  destroy(): void {
    this.historyQuery.metricsEvent.off('north-connect', this.onNorthConnect);
    this.historyQuery.metricsEvent.off('north-run-start', this.onNorthRunStart);
    this.historyQuery.metricsEvent.off('north-run-end', this.onNorthRunEnd);
    this.historyQuery.metricsEvent.off('north-cache-size', this.onNorthCacheSize);
    this.historyQuery.metricsEvent.off('north-cache-content-size', this.onNorthCacheContentSize);

    this.historyQuery.metricsEvent.off('south-connect', this.onSouthConnect);
    this.historyQuery.metricsEvent.off('south-run-start', this.onSouthRunStart);
    this.historyQuery.metricsEvent.off('south-run-end', this.onSouthRunEnd);
    this.historyQuery.metricsEvent.off('south-history-query-start', this.onSouthHistoryQueryStart);
    this.historyQuery.metricsEvent.off('south-history-query-interval', this.onSouthHistoryQueryInterval);
    this.historyQuery.metricsEvent.off('south-history-query-stop', this.onSouthHistoryQueryStop);
    this.historyQuery.metricsEvent.off('south-add-values', this.onSouthAddValues);
    this.historyQuery.metricsEvent.off('south-add-file', this.onSouthAddFile);
    // Drain any pending flush so the last seen metrics aren't lost on shutdown.
    if (this.metricsFlushTimer) {
      clearTimeout(this.metricsFlushTimer);
      this.metricsFlushTimer = null;
      this.flushMetrics();
    }
    this._stream?.destroy();
    this._stream = null;
  }

  get metrics(): HistoryQueryMetrics {
    return this.snapshot();
  }

  /**
   * Create a PassThrough object used to send a data to a stream to the frontend
   * The timeout is used to auto-initialize the stream at creation
   */
  get stream(): PassThrough {
    this._stream?.destroy();
    this._stream = new PassThrough();
    setTimeout(() => {
      this._stream?.write(`data: ${JSON.stringify(this.snapshot())}\n\n`);
    }, 100);
    return this._stream;
  }
}
