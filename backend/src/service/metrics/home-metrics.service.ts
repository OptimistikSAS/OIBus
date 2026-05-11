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
    this.oIBusService.stream.on('data', this.onEngineMetrics);
  }

  /**
   * Forwarder for every engine-metrics tick. Skip the JSON.parse + per-connector
   * aggregation + JSON.stringify entirely when no dashboard is subscribed —
   * `home-metrics` has no DB write or other side-effect, so the work is purely
   * for the SSE consumer. Bound as an arrow-property so it can be `off()`'d
   * cleanly in `destroy()`.
   */
  private onEngineMetrics = (data: Buffer) => {
    if (!this._stream) {
      // No consumer connected → nothing to do.
      return;
    }
    const engineMetrics: EngineMetrics = JSON.parse(data.toString().substring(6));
    this._metrics = {
      norths: this.dataStreamEngine.getAllNorthMetrics(),
      engine: engineMetrics,
      souths: this.dataStreamEngine.getAllSouthMetrics()
    };
    this._stream.write(`data: ${JSON.stringify(this._metrics)}\n\n`);
  };

  /**
   * Detach the upstream listener and tear down the SSE stream. Defensive
   * cleanup — this service is currently a singleton, but if it's ever
   * re-instantiated the old listener would keep running and capturing a stale
   * `this`.
   */
  destroy(): void {
    this.oIBusService.stream.off('data', this.onEngineMetrics);
    this._stream?.destroy();
    this._stream = null;
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
