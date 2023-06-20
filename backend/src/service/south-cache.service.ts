import Database from 'better-sqlite3';
import ConnectorCacheRepository from '../repository/connector-cache.repository';

import { SouthCache } from '../../../shared/model/south-connector.model';
import { Instant } from '../../../shared/model/types';

export default class SouthCacheService {
  private readonly _cacheRepository: ConnectorCacheRepository;

  constructor(private readonly connectorId: string, cacheDatabasePath: string) {
    const database = Database(cacheDatabasePath);

    this._cacheRepository = new ConnectorCacheRepository(database);
  }

  get cacheRepository(): ConnectorCacheRepository {
    return this._cacheRepository;
  }

  createSouthCacheScanModeTable(): void {
    this._cacheRepository.createSouthCacheScanModeTable();
  }

  /**
   * Retrieve south cache or return a new one with startTime
   */
  getSouthCacheScanMode(scanModeId: string, itemId: string, startTime: Instant): SouthCache {
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

  resetCacheScanMode(): void {
    this._cacheRepository.resetSouthCacheDatabase();
  }
}
