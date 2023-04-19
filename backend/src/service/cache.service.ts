import Database from 'better-sqlite3';
import ConnectorCacheRepository from '../repository/connector-cache.repository';

import { SouthCache } from '../../../shared/model/south-connector.model';
import { Instant } from '../../../shared/model/types';
import { DateTime } from 'luxon';
import { ConnectorMetrics } from '../../../shared/model/engine.model';
import { PassThrough } from 'node:stream';

export default class CacheService {
  private readonly _southCacheRepository: ConnectorCacheRepository;
  private _stream: PassThrough | null = null;

  private _metrics: ConnectorMetrics = {
    metricsStart: DateTime.now().toUTC().toISO(),
    numberOfValues: 0,
    numberOfFiles: 0,
    lastValue: null,
    lastFile: null,
    lastConnection: null,
    lastRunStart: null,
    lastRunDuration: null
  };

  constructor(private readonly connectorId: string, cacheDatabasePath: string) {
    const database = Database(cacheDatabasePath);

    this._southCacheRepository = new ConnectorCacheRepository(database);
    this.createMetricsTable();
  }

  get southCacheRepository(): ConnectorCacheRepository {
    return this._southCacheRepository;
  }

  createCacheHistoryTable(): void {
    this._southCacheRepository.createCacheHistoryTable();
  }

  /**
   * Retrieve south cache or return a new one with startTime
   */
  getSouthCache(id: string, startTime: Instant): SouthCache {
    const southCache = this._southCacheRepository.getSouthCacheScanMode(id);
    if (!southCache) {
      return {
        scanModeId: id,
        maxInstant: startTime,
        intervalIndex: 0
      };
    }
    return southCache;
  }

  createOrUpdateCacheScanMode(command: SouthCache): void {
    this._southCacheRepository.createOrUpdateCacheScanMode(command);
  }

  resetCache(): void {
    this._southCacheRepository.resetDatabase();
  }

  createMetricsTable(): void {
    this._southCacheRepository.createMetricsTable(this.connectorId);
    const results = this._southCacheRepository.getMetrics(this.connectorId);
    if (results) {
      this._metrics = results;
      this._stream?.write(`data: ${JSON.stringify(this._metrics)}\n\n`);
    }
  }

  updateMetrics(newMetrics: ConnectorMetrics): void {
    this._southCacheRepository.updateMetrics(newMetrics);
    this._metrics = newMetrics;
    this._stream?.write(`data: ${JSON.stringify(this._metrics)}\n\n`);
  }

  get metrics(): ConnectorMetrics {
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
      this._stream?.write(`data: ${JSON.stringify(this._metrics)}\n\n`);
    }, 100);
    return this._stream;
  }
}
