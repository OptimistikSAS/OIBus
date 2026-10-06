import { DateTime } from 'luxon';

import { CacheMetadata, NorthConnectorMetrics } from '../../../shared/model/api/engine.model';
import { Instant } from '../../../shared/model/common/types';
import { NorthSettings } from '../../../shared/model/connector/north-settings.model';

import NorthConnector from '../../north/north-connector';
import NorthConnectorMetricsRepository, {
  PersistedNorthConnectorMetrics
} from '../../repository/metrics/north-connector-metrics.repository';
import { applyNorthCacheContentSize, applyNorthConnect, applyNorthRunEnd, applyNorthRunStart } from './north-metrics-accumulator';

const METRICS_FLUSH_INTERVAL_MS = 1000;

export default class NorthConnectorMetricsService {
  private metricsFlushTimer: NodeJS.Timeout | null = null;

  // Persisted fields only; the current cache/error/archive sizes are added live in snapshot().
  private _metrics: PersistedNorthConnectorMetrics = {
    metricsStart: DateTime.now().toUTC().toISO() as Instant,
    contentSentSize: 0,
    contentCachedSize: 0,
    contentErroredSize: 0,
    contentArchivedSize: 0,
    lastConnection: null,
    lastContentSent: null,
    lastRunStart: null,
    lastRunDuration: null
  };

  constructor(
    private readonly northConnector: NorthConnector<NorthSettings>,
    private readonly northConnectorMetricsRepository: NorthConnectorMetricsRepository
  ) {
    this.initMetrics();
    this.northConnector.metricsEvent.on('cache-size', this.onCacheSize);
    this.northConnector.metricsEvent.on('cache-content-size', this.onCacheContentSize);
    this.northConnector.metricsEvent.on('connect', this.onConnect);
    this.northConnector.metricsEvent.on('run-start', this.onRunStart);
    this.northConnector.metricsEvent.on('run-end', this.onRunEnd);
  }

  private onCacheSize = () => {
    // Current sizes are read live from the cache service at serialization time
    // (see snapshot()); this listener only triggers a debounced flush so the
    // persisted row reflects a cache-size change promptly.
    this.updateMetrics();
  };

  private onCacheContentSize = (cachedSize: number) => {
    applyNorthCacheContentSize(this._metrics, cachedSize);
    this.updateMetrics();
  };

  private onConnect = (data: { lastConnection: Instant }) => {
    applyNorthConnect(this._metrics, data);
    this.updateMetrics();
  };

  private onRunStart = (data: { lastRunStart: Instant }) => {
    applyNorthRunStart(this._metrics, data);
    this.updateMetrics();
  };

  private onRunEnd = (data: { lastRunDuration: number; metadata: CacheMetadata; action: 'sent' | 'errored' | 'archived' }) => {
    applyNorthRunEnd(this._metrics, data);
    this.updateMetrics();
  };

  /**
   * The metrics as exposed/persisted: cumulative counters from `_metrics`, with the
   * current cache/error/archive sizes pulled live from the cache service (the
   * authoritative source) so the gauges can never drift or go stale.
   */
  private snapshot(): NorthConnectorMetrics {
    const { cache, error, archive } = this.northConnector.getCacheSizes();
    return { ...this._metrics, currentCacheSize: cache, currentErrorSize: error, currentArchiveSize: archive };
  }

  initMetrics(): void {
    this.northConnectorMetricsRepository.initMetrics(this.northConnector.connectorConfiguration.id);
    this._metrics = this.northConnectorMetricsRepository.getMetrics(this.northConnector.connectorConfiguration.id)!;
  }

  /** The DB write is debounced; the in-memory metrics stay current. */
  updateMetrics(): void {
    if (this.metricsFlushTimer) return;
    this.metricsFlushTimer = setTimeout(() => {
      this.metricsFlushTimer = null;
      this.flushMetrics();
    }, METRICS_FLUSH_INTERVAL_MS);
  }

  private flushMetrics(): void {
    // Persist only the persisted fields; the live cache sizes are added when the metrics are read (snapshot()).
    this.northConnectorMetricsRepository.updateMetrics(this.northConnector.connectorConfiguration.id, this._metrics);
  }

  resetMetrics(): void {
    // Cancel any pending debounced flush — the metrics row is about to be
    // removed and re-initialised, so a stale flush would be wasted work.
    if (this.metricsFlushTimer) {
      clearTimeout(this.metricsFlushTimer);
      this.metricsFlushTimer = null;
    }
    this.northConnectorMetricsRepository.removeMetrics(this.northConnector.connectorConfiguration.id);
    this.initMetrics();
  }

  destroy(): void {
    this.northConnector.metricsEvent.off('cache-size', this.onCacheSize);
    this.northConnector.metricsEvent.off('cache-content-size', this.onCacheContentSize);
    this.northConnector.metricsEvent.off('connect', this.onConnect);
    this.northConnector.metricsEvent.off('run-start', this.onRunStart);
    this.northConnector.metricsEvent.off('run-end', this.onRunEnd);
    // Drain any pending flush so the last seen metrics aren't lost on shutdown.
    if (this.metricsFlushTimer) {
      clearTimeout(this.metricsFlushTimer);
      this.metricsFlushTimer = null;
      this.flushMetrics();
    }
  }

  get metrics(): NorthConnectorMetrics {
    return this.snapshot();
  }
}
