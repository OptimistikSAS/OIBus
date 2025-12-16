import { Instant } from '../../../shared/model/types';
import { DateTime } from 'luxon';
import { PassThrough } from 'node:stream';
import { CacheMetadata, NorthConnectorMetrics } from '../../../shared/model/engine.model';
import NorthConnectorMetricsRepository from '../../repository/metrics/north-connector-metrics.repository';
import NorthConnector from '../../north/north-connector';
import { NorthSettings } from '../../../shared/model/north-settings.model';

export default class NorthConnectorMetricsService {
  private _stream: PassThrough | null = null;

  private _metrics: NorthConnectorMetrics = {
    metricsStart: DateTime.now().toUTC().toISO() as Instant,
    contentSentSize: 0,
    contentCachedSize: 0,
    contentErroredSize: 0,
    contentArchivedSize: 0,
    lastConnection: null,
    lastContentSent: null,
    lastRunStart: null,
    lastRunDuration: null,
    currentCacheSize: 0,
    currentErrorSize: 0,
    currentArchiveSize: 0
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

  private onCacheSize = (data: { cacheSize: number; errorSize: number; archiveSize: number }) => {
    this._metrics.currentCacheSize = data.cacheSize;
    this._metrics.currentErrorSize = data.errorSize;
    this._metrics.currentArchiveSize = data.archiveSize;
    this.updateMetrics();
  };

  private onCacheContentSize = (cachedSize: number) => {
    this._metrics.contentCachedSize += cachedSize;
    this.updateMetrics();
  };

  private onConnect = (data: { lastConnection: Instant }) => {
    this._metrics.lastConnection = data.lastConnection;
    this.updateMetrics();
  };

  private onRunStart = (data: { lastRunStart: Instant }) => {
    this._metrics.lastRunStart = data.lastRunStart;
    this.updateMetrics();
  };

  private onRunEnd = (data: { lastRunDuration: number; metadata: CacheMetadata; action: 'sent' | 'errored' | 'archived' }) => {
    this._metrics.lastRunDuration = data.lastRunDuration;
    if (data.action === 'sent') {
      this._metrics.lastContentSent = data.metadata.contentFile;
      this._metrics.contentSentSize += data.metadata.contentSize;
    } else if (data.action === 'archived') {
      this._metrics.lastContentSent = data.metadata.contentFile;
      this._metrics.contentArchivedSize += data.metadata.contentSize;
      this._metrics.contentSentSize += data.metadata.contentSize;
    } else {
      this._metrics.contentErroredSize += data.metadata.contentSize;
    }
    this.updateMetrics();
  };

  initMetrics(): void {
    this.northConnectorMetricsRepository.initMetrics(this.northConnector.connectorConfiguration.id);
    this._metrics = this.northConnectorMetricsRepository.getMetrics(this.northConnector.connectorConfiguration.id)!;
    this._stream?.write(`data: ${JSON.stringify(this._metrics)}\n\n`);
  }

  updateMetrics(): void {
    this.northConnectorMetricsRepository.updateMetrics(this.northConnector.connectorConfiguration.id, this._metrics);
    this._stream?.write(`data: ${JSON.stringify(this._metrics)}\n\n`);
  }

  resetMetrics(): void {
    this.northConnectorMetricsRepository.removeMetrics(this.northConnector.connectorConfiguration.id);
    this.initMetrics();
  }

  destroy(): void {
    this.northConnector.metricsEvent.off('cache-size', this.onCacheSize);
    this.northConnector.metricsEvent.off('cache-content-size', this.onCacheContentSize);
    this.northConnector.metricsEvent.off('connect', this.onConnect);
    this.northConnector.metricsEvent.off('run-start', this.onRunStart);
    this.northConnector.metricsEvent.off('run-end', this.onRunEnd);
    this._stream?.destroy();
    this._stream = null;
  }

  get metrics(): NorthConnectorMetrics {
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
