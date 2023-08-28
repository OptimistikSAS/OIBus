import SouthCacheRepository from '../repository/south-cache.repository';

import { SouthCache } from '../../../shared/model/south-connector.model';
import { Instant } from '../../../shared/model/types';

export default class SouthCacheService {
  constructor(
    private readonly connectorId: string,
    private readonly _cacheRepository: SouthCacheRepository
  ) {}

  get cacheRepository(): SouthCacheRepository {
    return this._cacheRepository;
  }

  /**
   * Retrieve south cache or return a new one with startTime
   */
  getSouthCacheScanMode(southId: string, scanModeId: string, itemId: string, startTime: Instant): SouthCache {
    const southCache = this._cacheRepository.getSouthCacheScanMode(southId, scanModeId, itemId);
    if (!southCache) {
      return {
        southId,
        scanModeId,
        itemId,
        maxInstant: startTime
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
