import Database from 'better-sqlite3';
import SouthCacheRepository from '../repository/south-cache.repository';

import { SouthCache } from '../../shared/model/south-connector.model';
import { DateTime } from 'luxon';

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

  getSouthCache(id: string): SouthCache {
    const southCache = this._southCacheRepository.getSouthCacheScanMode(id);
    if (!southCache) {
      return {
        scanModeId: id,
        maxInstant: DateTime.now().toUTC().toISO(),
        intervalIndex: 0
      };
    }
    return southCache;
  }

  createOrUpdateCacheScanMode(command: SouthCache): void {
    this._southCacheRepository.createOrUpdateCacheScanMode(command);
  }
}
