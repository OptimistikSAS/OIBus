import { Instant } from '../../../shared/model/types';
import { DateTime } from 'luxon';
import { PassThrough } from 'node:stream';
import { NorthConnectorMetrics } from '../../../shared/model/engine.model';
import NorthConnectorMetricsRepository from '../repository/north-connector-metrics.repository';

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
    lastRunDuration: null
  };

  constructor(private readonly connectorId: string, private readonly _metricsRepository: NorthConnectorMetricsRepository) {
    this.createMetricsTable();
  }

  get metricsRepository(): NorthConnectorMetricsRepository {
    return this._metricsRepository;
  }

  createMetricsTable(): void {
    this._metricsRepository.createMetricsTable(this.connectorId);
    const results = this._metricsRepository.getMetrics(this.connectorId);
    this._metrics = results!;
    this._stream?.write(`data: ${JSON.stringify(this._metrics)}\n\n`);
  }

  updateMetrics(newMetrics: NorthConnectorMetrics): void {
    this._metricsRepository.updateMetrics(newMetrics);
    this._metrics = newMetrics;
    this._stream?.write(`data: ${JSON.stringify(this._metrics)}\n\n`);
  }

  resetMetrics(): void {
    this._metricsRepository.removeMetrics(this.connectorId);
    this.createMetricsTable();
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
