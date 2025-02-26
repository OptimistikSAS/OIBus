import { Instant } from '../../../shared/model/types';
import { DateTime } from 'luxon';
import { PassThrough } from 'node:stream';
import { CacheMetadata, NorthConnectorMetrics } from '../../../shared/model/engine.model';
import NorthConnectorMetricsRepository from '../../repository/logs/north-connector-metrics.repository';
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
    this.northConnector.metricsEvent.on('cache-size', (data: { cacheSize: number; errorSize: number; archiveSize: number }) => {
      this._metrics.currentCacheSize = data.cacheSize;
      this._metrics.currentErrorSize = data.errorSize;
      this._metrics.currentArchiveSize = data.archiveSize;
      this.updateMetrics();
    });
    this.northConnector.metricsEvent.on('cache-content-size', (cachedSize: number) => {
      this._metrics.contentCachedSize += cachedSize;
      this.updateMetrics();
    });
    this.northConnector.metricsEvent.on('connect', (data: { lastConnection: Instant }) => {
      this._metrics.lastConnection = data.lastConnection;
      this.updateMetrics();
    });
    this.northConnector.metricsEvent.on('run-start', (data: { lastRunStart: Instant }) => {
      this._metrics.lastRunStart = data.lastRunStart;
      this.updateMetrics();
    });
    this.northConnector.metricsEvent.on(
      'run-end',
      (data: { lastRunDuration: number; metadata: CacheMetadata; action: 'sent' | 'errored' | 'archived' }) => {
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
      }
    );
  }

  initMetrics(): void {
    this.northConnectorMetricsRepository.initMetrics(this.northConnector.settings.id);
    this._metrics = this.northConnectorMetricsRepository.getMetrics(this.northConnector.settings.id)!;
    this._stream?.write(`data: ${JSON.stringify(this._metrics)}\n\n`);
  }

  updateMetrics(): void {
    this.northConnectorMetricsRepository.updateMetrics(this.northConnector.settings.id, this._metrics);
    this._stream?.write(`data: ${JSON.stringify(this._metrics)}\n\n`);
  }

  resetMetrics(): void {
    this.northConnectorMetricsRepository.removeMetrics(this.northConnector.settings.id);
    this.initMetrics();
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
