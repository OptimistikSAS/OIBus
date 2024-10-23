import { EngineMetrics, HomeMetrics } from '../../../shared/model/engine.model';
import { PassThrough } from 'node:stream';
import OIBusService from '../oibus.service';
import DataStreamEngine from '../../engine/data-stream-engine';
import { DateTime } from 'luxon';

/**
 * Class HomeMetricsService - sends metrics
 */
export default class HomeMetricsService {
  private _stream: PassThrough | null = null;
  private _metrics: HomeMetrics = {
    norths: {},
    engine: {
      metricsStart: DateTime.now().toUTC().toISO()!,
      processCpuUsageInstant: 0,
      processCpuUsageAverage: 0,
      processUptime: 0,
      freeMemory: 0,
      totalMemory: 0,
      minRss: 0,
      currentRss: 0,
      maxRss: 0,
      minHeapTotal: 0,
      currentHeapTotal: 0,
      maxHeapTotal: 0,
      minHeapUsed: 0,
      currentHeapUsed: 0,
      maxHeapUsed: 0,
      minExternal: 0,
      currentExternal: 0,
      maxExternal: 0,
      minArrayBuffers: 0,
      currentArrayBuffers: 0,
      maxArrayBuffers: 0
    },
    souths: {}
  };

  constructor(
    private readonly oIBusService: OIBusService,
    private readonly dataStreamEngine: DataStreamEngine
  ) {
    this.oIBusService.stream.on('data', data => {
      const engineMetrics: EngineMetrics = JSON.parse(data.toString().substring(6));

      this._metrics = {
        norths: this.dataStreamEngine.getNorthConnectorMetrics(),
        engine: engineMetrics,
        souths: this.dataStreamEngine.getSouthConnectorMetrics()
      };
      this._stream?.write(`data: ${JSON.stringify(this._metrics)}\n\n`);
    });
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
