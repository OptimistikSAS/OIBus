import SouthCacheRepository from '../repository/cache/south-cache.repository';

import { SouthCache } from '../../shared/model/south-connector.model';
import { Instant } from '../../shared/model/types';

export default class SouthCacheService {
  constructor(private readonly cacheRepository: SouthCacheRepository) {}

  /**
   * Retrieve south cache or return a new one with startTime
   */
  getSouthCache(southId: string, scanModeId: string, itemId: string, startTime: Instant): SouthCache {
    const tableName = `south_item_cache_${southId}`;
    const southCache = this.cacheRepository.getSouthCache(tableName, scanModeId, itemId);
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

  saveSouthCache(command: SouthCache): void {
    const tableName = `south_item_cache_${command.southId}`;
    this.cacheRepository.save(tableName, command);
  }

  resetSouthCache(id: string): void {
    const tableName = `south_item_cache_${id}`;
    this.cacheRepository.deleteAllBySouthConnector(tableName);
  }

  createCustomTable(tableName: string, fields: string): void {
    this.cacheRepository.createCustomTable(tableName, fields);
  }

  getQueryOnCustomTable(query: string, params: Array<string | number>): unknown {
    return this.cacheRepository.getQueryOnCustomTable(query, params);
  }

  runQueryOnCustomTable(query: string, params: Array<string | number>): void {
    this.cacheRepository.runQueryOnCustomTable(query, params);
  }
}
