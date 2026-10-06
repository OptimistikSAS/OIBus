import { DateTime } from 'luxon';

import { OIBusTimeValue } from '../../../shared/model/common/content.model';
import { Instant } from '../../../shared/model/common/types';
import { SouthItemSettings, SouthSettings } from '../../../shared/model/connector/south-settings.model';
import { SouthConnectorMetrics } from '../../../shared/model/domain/engine.model';

import SouthConnectorMetricsRepository from '../../repository/metrics/south-connector-metrics.repository';
import SouthConnector from '../../south/south-connector';

/**
 * Coalesce DB writes for metrics updates. With a high-rate South (MQTT msg
 * after-flush, OPC UA HA continuation reads), every event used to trigger a
 * synchronous SQLite UPDATE; the in-memory metrics stay live (and are what
 * the web UI polls), while the persisted copy is flushed at most once per interval.
 */
const METRICS_FLUSH_INTERVAL_MS = 1000;

export default class SouthConnectorMetricsService {
  private metricsFlushTimer: NodeJS.Timeout | null = null;

  private _metrics: SouthConnectorMetrics = {
    metricsStart: DateTime.now().toUTC().toISO()!,
    numberOfValuesRetrieved: 0,
    numberOfFilesRetrieved: 0,
    lastValueRetrieved: null,
    lastFileRetrieved: null,
    lastConnection: null,
    lastRunStart: null,
    lastRunDuration: null
  };

  constructor(
    private readonly southConnector: SouthConnector<SouthSettings, SouthItemSettings>,
    private readonly southConnectorMetricsRepository: SouthConnectorMetricsRepository
  ) {
    this.initMetrics();
    this.southConnector.metricsEvent.on('connect', this.onConnect);
    this.southConnector.metricsEvent.on('run-start', this.onRunStart);
    this.southConnector.metricsEvent.on('run-end', this.onRunEnd);
    this.southConnector.metricsEvent.on('add-values', this.onAddValues);
    this.southConnector.metricsEvent.on('add-file', this.onAddFile);
  }

  private onConnect = (data: { lastConnection: Instant }) => {
    this._metrics.lastConnection = data.lastConnection;
    this.updateMetrics();
  };

  private onRunStart = (data: { lastRunStart: Instant }) => {
    this._metrics.lastRunStart = data.lastRunStart;
    this.updateMetrics();
  };

  private onRunEnd = (data: { lastRunDuration: number }) => {
    this._metrics.lastRunDuration = data.lastRunDuration;
    this.updateMetrics();
  };

  private onAddValues = (data: { numberOfValuesRetrieved: number; lastValueRetrieved: OIBusTimeValue | null }) => {
    this._metrics.numberOfValuesRetrieved += data.numberOfValuesRetrieved;
    this._metrics.lastValueRetrieved = data.lastValueRetrieved;
    this.updateMetrics();
  };

  private onAddFile = (data: { lastFileRetrieved: string }) => {
    this._metrics.numberOfFilesRetrieved += 1;
    this._metrics.lastFileRetrieved = data.lastFileRetrieved;
    this.updateMetrics();
  };

  initMetrics(): void {
    this.southConnectorMetricsRepository.initMetrics(this.southConnector.connectorConfiguration.id);
    this._metrics = this.southConnectorMetricsRepository.getMetrics(this.southConnector.connectorConfiguration.id)!;
  }

  /**
   * Called by every metric event handler. The DB write is debounced: the
   * persisted state only gets one snapshot per window. `_metrics` is always
   * current in memory so `get metrics()` callers (REST polls, etc.) never lag.
   */
  updateMetrics(): void {
    if (this.metricsFlushTimer) return;
    this.metricsFlushTimer = setTimeout(() => {
      this.metricsFlushTimer = null;
      this.flushMetrics();
    }, METRICS_FLUSH_INTERVAL_MS);
  }

  private flushMetrics(): void {
    this.southConnectorMetricsRepository.updateMetrics(this.southConnector.connectorConfiguration.id, this._metrics);
  }

  resetMetrics(): void {
    // Cancel any pending debounced flush — the metrics row is about to be
    // removed and re-initialised, so a stale flush against the old state
    // would be wasted work (and could race with the re-init).
    if (this.metricsFlushTimer) {
      clearTimeout(this.metricsFlushTimer);
      this.metricsFlushTimer = null;
    }
    this.southConnectorMetricsRepository.removeMetrics(this.southConnector.connectorConfiguration.id);
    this.initMetrics();
  }

  destroy(): void {
    this.southConnector.metricsEvent.off('connect', this.onConnect);
    this.southConnector.metricsEvent.off('run-start', this.onRunStart);
    this.southConnector.metricsEvent.off('run-end', this.onRunEnd);
    this.southConnector.metricsEvent.off('add-values', this.onAddValues);
    this.southConnector.metricsEvent.off('add-file', this.onAddFile);
    // Drain any pending flush so the last seen metrics aren't lost on shutdown.
    if (this.metricsFlushTimer) {
      clearTimeout(this.metricsFlushTimer);
      this.metricsFlushTimer = null;
      this.flushMetrics();
    }
  }

  get metrics(): SouthConnectorMetrics {
    return this._metrics;
  }
}
