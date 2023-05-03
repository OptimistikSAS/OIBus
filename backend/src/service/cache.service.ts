import Database from 'better-sqlite3';
import ConnectorCacheRepository from '../repository/connector-cache.repository';

import { SouthCache } from '../../../shared/model/south-connector.model';
import { Instant } from '../../../shared/model/types';
import { DateTime } from 'luxon';
import { ConnectorMetrics } from '../../../shared/model/engine.model';
import { PassThrough } from 'node:stream';

export default class CacheService {
  private readonly _cacheRepository: ConnectorCacheRepository;
  private _stream: PassThrough | null = null;

  private _metrics: ConnectorMetrics = {
    metricsStart: DateTime.now().toUTC().toISO() as Instant,
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

    this._cacheRepository = new ConnectorCacheRepository(database);
    this.createMetricsTable();
  }

  get cacheRepository(): ConnectorCacheRepository {
    return this._cacheRepository;
  }

  createCacheHistoryTable(): void {
    this._cacheRepository.createCacheHistoryTable();
  }

  /**
   * Retrieve south cache or return a new one with startTime
   */
  getSouthCache(scanModeId: string, itemId: string, startTime: Instant): SouthCache {
    const southCache = this._cacheRepository.getSouthCacheScanMode(scanModeId, itemId);
    if (!southCache) {
      return {
        scanModeId,
        itemId,
        maxInstant: startTime,
        intervalIndex: 0
      };
    }
    return southCache;
  }

  createOrUpdateCacheScanMode(command: SouthCache): void {
    this._cacheRepository.createOrUpdateCacheScanMode(command);
  }

  resetCache(): void {
    this._cacheRepository.resetDatabase();
  }

  createMetricsTable(): void {
    this._cacheRepository.createMetricsTable(this.connectorId);
    const results = this._cacheRepository.getMetrics(this.connectorId);
    this._metrics = results!;
    this._stream?.write(`data: ${JSON.stringify(this._metrics)}\n\n`);
  }

  updateMetrics(newMetrics: ConnectorMetrics): void {
    this._cacheRepository.updateMetrics(newMetrics);
    this._metrics = newMetrics;
    this._stream?.write(`data: ${JSON.stringify(this._metrics)}\n\n`);
  }

  resetMetrics(): void {
    this._cacheRepository.removeMetrics(this.connectorId);
    this.createMetricsTable();
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
      this._stream!.write(`data: ${JSON.stringify(this._metrics)}\n\n`);
    }, 100);
    return this._stream;
  }
}
