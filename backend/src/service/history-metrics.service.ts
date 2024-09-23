import { HistoryMetrics, SouthHistoryMetrics } from '../../../shared/model/engine.model';
import { PassThrough } from 'node:stream';
import SouthConnectorMetricsRepository from '../repository/logs/south-connector-metrics.repository';
import NorthConnectorMetricsRepository from '../repository/logs/north-connector-metrics.repository';

export default class HistoryMetricsService {
  private _stream: PassThrough | null = null;
  private _metrics: HistoryMetrics;

  constructor(
    private readonly historyId: string,
    private readonly southMetricsRepository: SouthConnectorMetricsRepository,
    private readonly northMetricsRepository: NorthConnectorMetricsRepository
  ) {
    this.southMetricsRepository.initMetrics(this.historyId);
    const southMetrics = this.southMetricsRepository.getMetrics(this.historyId)!;
    this.northMetricsRepository.initMetrics(this.historyId);
    const northMetrics = this.northMetricsRepository.getMetrics(this.historyId)!;
    this._metrics = {
      north: northMetrics,
      south: southMetrics,
      historyMetrics: {} as SouthHistoryMetrics
    };
  }

  updateMetrics(newMetrics: HistoryMetrics): void {
    this._metrics = newMetrics;
    this._stream?.write(`data: ${JSON.stringify(this._metrics)}\n\n`);
  }

  resetMetrics(): void {
    this.southMetricsRepository.removeMetrics(this.historyId);
    this.southMetricsRepository.initMetrics(this.historyId);

    this.northMetricsRepository.removeMetrics(this.historyId);
    this.northMetricsRepository.initMetrics(this.historyId);

    this.updateMetrics({
      north: this.northMetricsRepository.getMetrics(this.historyId)!,
      south: this.southMetricsRepository.getMetrics(this.historyId)!,
      historyMetrics: {} as SouthHistoryMetrics
    });
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
