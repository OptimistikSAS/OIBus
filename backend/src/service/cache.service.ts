import Database from 'better-sqlite3';
import ConnectorCacheRepository from '../repository/connector-cache.repository';

import { SouthCache } from '../../../shared/model/south-connector.model';
import { Instant } from '../../../shared/model/types';
import { DateTime } from 'luxon';
import { ConnectorMetrics } from '../../../shared/model/engine.model';

export default class CacheService {
  private readonly _southCacheRepository: ConnectorCacheRepository;

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
    }
  }

  updateMetrics(newMetrics: ConnectorMetrics): void {
    this._southCacheRepository.updateMetrics(newMetrics);
    this._metrics = newMetrics;
  }

  get metrics(): ConnectorMetrics {
    return this._metrics;
  }
}
