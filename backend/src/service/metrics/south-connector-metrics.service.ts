import { Instant } from '../../../shared/model/types';
import { DateTime } from 'luxon';
import { PassThrough } from 'node:stream';
import SouthConnectorMetricsRepository from '../../repository/metrics/south-connector-metrics.repository';
import { OIBusTimeValue, SouthConnectorMetrics } from '../../../shared/model/engine.model';
import SouthConnector from '../../south/south-connector';
import { SouthItemSettings, SouthSettings } from '../../../shared/model/south-settings.model';

/**
 * Coalesce DB writes for metrics updates. With a high-rate South (MQTT msg
 * after-flush, OPC UA HA continuation reads), every event used to trigger a
 * synchronous SQLite UPDATE; the in-memory metrics + the SSE stream stay
 * live, while the persisted copy is flushed at most once per interval.
 */
const METRICS_FLUSH_INTERVAL_MS = 1000;

export default class SouthConnectorMetricsService {
  private _stream: PassThrough | null = null;
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
    this._stream?.write(`data: ${JSON.stringify(this._metrics)}\n\n`);
  }

  /**
   * Called by every metric event handler. Both the DB write and the SSE push
   * are debounced through the same timer — there's no point streaming a value
   * to the dashboard 100 times when the underlying persisted state only gets
   * one snapshot per window. `_metrics` is always current in memory so
   * `get metrics()` callers (REST polls, etc.) never lag.
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
    this._stream?.write(`data: ${JSON.stringify(this._metrics)}\n\n`);
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
    this._stream?.destroy();
    this._stream = null;
  }

  get metrics(): SouthConnectorMetrics {
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
