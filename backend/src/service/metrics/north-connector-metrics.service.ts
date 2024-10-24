import { Instant } from '../../../shared/model/types';
import { DateTime } from 'luxon';
import { PassThrough } from 'node:stream';
import { NorthConnectorMetrics, OIBusTimeValue } from '../../../shared/model/engine.model';
import NorthConnectorMetricsRepository from '../../repository/logs/north-connector-metrics.repository';
import NorthConnector from '../../north/north-connector';
import { NorthSettings } from '../../../shared/model/north-settings.model';

export default class NorthConnectorMetricsService {
  private _stream: PassThrough | null = null;

  private _metrics: NorthConnectorMetrics = {
    metricsStart: DateTime.now().toUTC().toISO() as Instant,
    numberOfValuesSent: 0,
    numberOfFilesSent: 0,
    lastValueSent: null,
    lastFileSent: null,
    lastConnection: null,
    lastRunStart: null,
    lastRunDuration: null,
    cacheSize: 0
  };

  constructor(
    private readonly northConnector: NorthConnector<NorthSettings>,
    private readonly northConnectorMetricsRepository: NorthConnectorMetricsRepository
  ) {
    this.initMetrics();
    this.northConnector.metricsEvent.on('cache-size', (data: { cacheSize: number }) => {
      this._metrics.cacheSize = data.cacheSize;
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
    this.northConnector.metricsEvent.on('run-end', (data: { lastRunDuration: number }) => {
      this._metrics.lastRunDuration = data.lastRunDuration;
      this.updateMetrics();
    });
    this.northConnector.metricsEvent.on('send-values', (data: { numberOfValuesSent: number; lastValueSent: OIBusTimeValue }) => {
      this._metrics.numberOfValuesSent += data.numberOfValuesSent;
      this._metrics.lastValueSent = data.lastValueSent;
      this.updateMetrics();
    });
    this.northConnector.metricsEvent.on('send-file', (data: { lastFileSent: string }) => {
      this._metrics.numberOfFilesSent += 1;
      this._metrics.lastFileSent = data.lastFileSent;
      this.updateMetrics();
    });
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
      this._stream!.write(`data: ${JSON.stringify(this._metrics)}\n\n`);
    }, 100);
    return this._stream;
  }
}
