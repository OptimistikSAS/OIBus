import { HomeMetrics } from '../../../shared/model/engine.model';
import { PassThrough } from 'node:stream';
import EngineMetricsRepository from '../repository/logs/engine-metrics.repository';
import SouthConnector from '../south/south-connector';
import NorthConnector from '../north/north-connector';
import NorthConnectorMetricsRepository from '../repository/logs/north-connector-metrics.repository';
import SouthConnectorMetricsRepository from '../repository/logs/south-connector-metrics.repository';
import { SouthItemSettings, SouthSettings } from '../../../shared/model/south-settings.model';
import { NorthSettings } from '../../../shared/model/north-settings.model';

/**
 * Class HomeMetricsService - sends metrics
 */
export default class HomeMetricsService {
  private _stream: PassThrough | null = null;

  private _metrics: HomeMetrics;
  private souths = new Map<string, SouthConnector<SouthSettings, SouthItemSettings>>();
  private norths = new Map<string, NorthConnector<NorthSettings>>();

  constructor(
    private readonly engineId: string,
    private readonly engineMetricsRepository: EngineMetricsRepository,
    private readonly northConnectorMetricsRepository: NorthConnectorMetricsRepository,
    private readonly southConnectorMetricsRepository: SouthConnectorMetricsRepository
  ) {
    this._metrics = {
      norths: {},
      engine: this.engineMetricsRepository.getMetrics(engineId)!,
      souths: {}
    };
  }

  addNorth(north: NorthConnector<NorthSettings>, id: string) {
    const metrics = this.northConnectorMetricsRepository.getMetrics(id);
    if (metrics) {
      this._metrics.norths[id] = metrics;
    }
    this._stream?.write(`data: ${JSON.stringify(this._metrics)}\n\n`);
    this.norths.set(id, north);
  }

  removeNorth(id: string) {
    delete this._metrics.norths[id];
    this.norths.delete(id);
  }

  addSouth(south: SouthConnector<SouthSettings, SouthItemSettings>, id: string) {
    const metrics = this.southConnectorMetricsRepository.getMetrics(id);
    if (metrics) {
      this._metrics.souths[id] = metrics;
    }
    this._stream?.write(`data: ${JSON.stringify(this._metrics)}\n\n`);
    this.souths.set(id, south);
  }

  removeSouth(id: string) {
    delete this._metrics.souths[id];
    this.souths.delete(id);
  }

  /**
   * Create a PassThrough object used to send a data to a stream to the frontend
   * The timeout is used to auto-initialize the stream at creation
   */
  get stream(): PassThrough {
    this._stream?.destroy();
    this._stream = new PassThrough();

    // for (const [id, north] of this.norths.entries()) {
    //   north.getMetricsDataStream().on('data', data => {
    //     this._metrics.norths[id] = JSON.parse(data.toString().substring(6));
    //     this._stream!.write(`data: ${JSON.stringify(this._metrics)}\n\n`);
    //   });
    // }

    // for (const [id, south] of this.souths.entries()) {
    //   south.getMetricsDataStream().on('data', data => {
    //     this._metrics.souths[id] = JSON.parse(data.toString().substring(6));
    //     this._stream!.write(`data: ${JSON.stringify(this._metrics)}\n\n`);
    //   });
    // }
    setTimeout(() => {
      this._stream!.write(`data: ${JSON.stringify(this._metrics)}\n\n`);
    }, 100);
    return this._stream;
  }
}
