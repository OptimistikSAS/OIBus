import SouthCacheRepository from '../repository/cache/south-cache.repository';

import { SouthItemLastValue } from '../../shared/model/south-connector.model';

export default class SouthCacheService {
  constructor(private readonly cacheRepository: SouthCacheRepository) {}

  getItemLastValue(connectorId: string, itemId: string): Omit<SouthItemLastValue, 'itemName' | 'groupName'> | null {
    return this.cacheRepository.getItemLastValue(connectorId, itemId);
  }

  saveItemLastValue(connectorId: string, value: Omit<SouthItemLastValue, 'itemName' | 'groupName'>): void {
    this.cacheRepository.saveItemLastValue(connectorId, value);
  }

  deleteItemValue(connectorId: string, itemId: string): void {
    this.cacheRepository.deleteItemValue(connectorId, itemId);
  }

  deleteItemsBySouth(connectorId: string): void {
    this.cacheRepository.deleteItemsBySouth(connectorId);
  }
}
