import { HistoryMetrics } from '../../../shared/model/engine.model';
import { PassThrough } from 'node:stream';
import SouthConnectorMetricsRepository from '../repository/south-connector-metrics.repository';
import NorthConnectorMetricsRepository from '../repository/north-connector-metrics.repository';

export default class HistoryMetricsService {
  private _stream: PassThrough | null = null;
  private _metrics: HistoryMetrics;

  constructor(
    private readonly historyId: string,
    private readonly southMetricsRepository: SouthConnectorMetricsRepository,
    private readonly northMetricsRepository: NorthConnectorMetricsRepository
  ) {
    this.southMetricsRepository.createMetricsTable(this.historyId);
    const southMetrics = this.southMetricsRepository.getMetrics(this.historyId)!;
    this.northMetricsRepository.createMetricsTable(this.historyId);
    const northMetrics = this.northMetricsRepository.getMetrics(this.historyId)!;
    this._metrics = {
      north: northMetrics,
      south: southMetrics
    };
  }

  updateMetrics(newMetrics: HistoryMetrics): void {
    this._metrics = newMetrics;
    this._stream?.write(`data: ${JSON.stringify(this._metrics)}\n\n`);
  }

  get metrics(): HistoryMetrics {
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
