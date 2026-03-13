import SouthCacheRepository from '../repository/cache/south-cache.repository';

import { SouthCache, SouthItemLastValue } from '../../shared/model/south-connector.model';
import { Instant } from '../../shared/model/types';

export default class SouthCacheService {
  constructor(private readonly cacheRepository: SouthCacheRepository) {}

  /**
   * Retrieve south cache or return a new one with startTime
   */
  getSouthCache(southId: string, scanModeId: string, itemId: string, startTime: Instant): SouthCache {
    const southCache = this.cacheRepository.getSouthCache(southId, scanModeId, itemId);
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
    this.cacheRepository.save(command);
  }

  resetSouthCache(id: string): void {
    this.cacheRepository.deleteAllBySouthConnector(id);
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

  createItemValueTable(connectorId: string): void {
    this.cacheRepository.createItemValueTable(connectorId);
  }

  getItemLastValue(connectorId: string, itemId: string) {
    return this.cacheRepository.getItemLastValue(connectorId, itemId);
  }

  getAllItemValues(connectorId: string) {
    return this.cacheRepository.getAllItemValues(connectorId);
  }

  saveItemLastValue(connectorId: string, value: Omit<SouthItemLastValue, 'itemName'>): void {
    this.cacheRepository.saveItemLastValue(connectorId, value);
  }

  deleteItemValue(connectorId: string, itemId: string): void {
    this.cacheRepository.deleteItemValue(connectorId, itemId);
  }

  dropItemValueTable(connectorId: string): void {
    this.cacheRepository.dropItemValueTable(connectorId);
  }
}
