import Database from 'better-sqlite3';
import SouthCacheRepository from '../repository/south-cache.repository';

import { SouthCache } from '../../../shared/model/south-connector.model';
import { Instant } from '../../../shared/model/types';

export default class SouthCacheService {
  private readonly _southCacheRepository: SouthCacheRepository;

  constructor(southCacheDatabasePath: string) {
    const southDatabase = Database(southCacheDatabasePath);

    this._southCacheRepository = new SouthCacheRepository(southDatabase);
  }

  get southCacheRepository(): SouthCacheRepository {
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
}
