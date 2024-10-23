import { Instant } from '../../../shared/model/types';
import { DateTime } from 'luxon';
import { PassThrough } from 'node:stream';
import SouthConnectorMetricsRepository from '../../repository/logs/south-connector-metrics.repository';
import { OIBusTimeValue, SouthConnectorMetrics } from '../../../shared/model/engine.model';
import SouthConnector from '../../south/south-connector';
import { SouthItemSettings, SouthSettings } from '../../../shared/model/south-settings.model';

export default class SouthConnectorMetricsService {
  private _stream: PassThrough | null = null;

  private _metrics: SouthConnectorMetrics = {
    metricsStart: DateTime.now().toUTC().toISO()!,
    numberOfValuesRetrieved: 0,
    numberOfFilesRetrieved: 0,
    lastValueRetrieved: null,
    lastFileRetrieved: null,
    lastConnection: null,
    lastRunStart: null,
    lastRunDuration: null
  };

  constructor(
    private readonly southConnector: SouthConnector<SouthSettings, SouthItemSettings>,
    private readonly southConnectorMetricsRepository: SouthConnectorMetricsRepository
  ) {
    this.initMetrics();
    this.southConnector.metricsEvent.on('connect', (data: { lastConnection: Instant }) => {
      this._metrics.lastConnection = data.lastConnection;
      this.updateMetrics();
    });
    this.southConnector.metricsEvent.on('run-start', (data: { lastRunStart: Instant }) => {
      this._metrics.lastRunStart = data.lastRunStart;
      this.updateMetrics();
    });
    this.southConnector.metricsEvent.on('run-end', (data: { lastRunDuration: number }) => {
      this._metrics.lastRunDuration = data.lastRunDuration;
      this.updateMetrics();
    });
    this.southConnector.metricsEvent.on('add-values', (data: { numberOfValuesRetrieved: number; lastValueRetrieved: OIBusTimeValue }) => {
      this._metrics.numberOfValuesRetrieved += data.numberOfValuesRetrieved;
      this._metrics.lastValueRetrieved = data.lastValueRetrieved;
      this.updateMetrics();
    });
    this.southConnector.metricsEvent.on('add-file', (data: { lastFileRetrieved: string }) => {
      this._metrics.numberOfFilesRetrieved += 1;
      this._metrics.lastFileRetrieved = data.lastFileRetrieved;
      this.updateMetrics();
    });
  }

  initMetrics(): void {
    this.southConnectorMetricsRepository.initMetrics(this.southConnector.settings.id);
    this._metrics = this.southConnectorMetricsRepository.getMetrics(this.southConnector.settings.id)!;
    this._stream?.write(`data: ${JSON.stringify(this._metrics)}\n\n`);
  }

  updateMetrics(): void {
    this.southConnectorMetricsRepository.updateMetrics(this.southConnector.settings.id, this._metrics);
    this._stream?.write(`data: ${JSON.stringify(this._metrics)}\n\n`);
  }

  resetMetrics(): void {
    this.southConnectorMetricsRepository.removeMetrics(this.southConnector.settings.id);
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
