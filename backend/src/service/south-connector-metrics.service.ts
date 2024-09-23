import { Instant } from '../../../shared/model/types';
import { DateTime } from 'luxon';
import { PassThrough } from 'node:stream';
import SouthConnectorMetricsRepository from '../repository/logs/south-connector-metrics.repository';
import { SouthConnectorMetrics } from '../../../shared/model/engine.model';

export default class SouthConnectorMetricsService {
  private _stream: PassThrough | null = null;

  private _metrics: SouthConnectorMetrics = {
    metricsStart: DateTime.now().toUTC().toISO() as Instant,
    numberOfValuesRetrieved: 0,
    numberOfFilesRetrieved: 0,
    lastValueRetrieved: null,
    lastFileRetrieved: null,
    lastConnection: null,
    lastRunStart: null,
    lastRunDuration: null
  };

  constructor(
    private readonly connectorId: string,
    private readonly metricsRepository: SouthConnectorMetricsRepository
  ) {}

  initMetrics(): void {
    this.metricsRepository.initMetrics(this.connectorId);
    const results = this.metricsRepository.getMetrics(this.connectorId);
    this._metrics = results!;
    this._stream?.write(`data: ${JSON.stringify(this._metrics)}\n\n`);
  }

  updateMetrics(southId: string, newMetrics: SouthConnectorMetrics): void {
    this.metricsRepository.updateMetrics(southId, newMetrics);
    this._metrics = newMetrics;
    this._stream?.write(`data: ${JSON.stringify(this._metrics)}\n\n`);
  }

  resetMetrics(): void {
    this.metricsRepository.removeMetrics(this.connectorId);
    this.initMetrics();
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
      this._stream!.write(`data: ${JSON.stringify(this._metrics)}\n\n`);
    }, 100);
    return this._stream;
  }
}
