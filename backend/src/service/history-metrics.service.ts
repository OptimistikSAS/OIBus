import { Instant } from '../../../shared/model/types';
import { DateTime } from 'luxon';
import { HistoryMetrics } from '../../../shared/model/engine.model';
import { PassThrough } from 'node:stream';

export default class HistoryMetricsService {
  private _stream: PassThrough | null = null;

  private _metrics: HistoryMetrics = {
    north: {
      metricsStart: DateTime.now().toUTC().toISO() as Instant,
      numberOfValuesSent: 0,
      numberOfFilesSent: 0,
      lastValueSent: null,
      lastFileSent: null,
      lastConnection: null,
      lastRunStart: null,
      lastRunDuration: null
    },
    south: {
      metricsStart: DateTime.now().toUTC().toISO() as Instant,
      numberOfValuesRetrieved: 0,
      numberOfFilesRetrieved: 0,
      lastValueRetrieved: null,
      lastFileRetrieved: null,
      lastConnection: null,
      lastRunStart: null,
      lastRunDuration: null,
      historyMetrics: {}
    }
  };

  constructor(private readonly historyId: string) {}

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
