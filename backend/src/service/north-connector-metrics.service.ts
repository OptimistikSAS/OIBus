import { Instant } from '../../../shared/model/types';
import { DateTime } from 'luxon';
import { PassThrough } from 'node:stream';
import { NorthConnectorMetrics } from '../../../shared/model/engine.model';
import NorthConnectorMetricsRepository from '../repository/logs/north-connector-metrics.repository';

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
    private readonly connectorId: string,
    private readonly northConnectorMetricsRepository: NorthConnectorMetricsRepository
  ) {}

  initMetrics(): void {
    this.northConnectorMetricsRepository.initMetrics(this.connectorId);
    const results = this.northConnectorMetricsRepository.getMetrics(this.connectorId);
    this._metrics = results!;
    this._stream?.write(`data: ${JSON.stringify(this._metrics)}\n\n`);
  }

  updateMetrics(northId: string, newMetrics: NorthConnectorMetrics): void {
    this.northConnectorMetricsRepository.updateMetrics(northId, newMetrics);
    this._metrics = newMetrics;
    this._stream?.write(`data: ${JSON.stringify(this._metrics)}\n\n`);
  }

  resetMetrics(): void {
    this.northConnectorMetricsRepository.removeMetrics(this.connectorId);
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
