import SouthCacheRepository from '../repository/cache/south-cache.repository';

import { SouthItemLastValue } from '../../shared/model/south-connector.model';

export default class SouthCacheService {
  constructor(private readonly cacheRepository: SouthCacheRepository) {}

  createItemValueTable(connectorId: string): void {
    this.cacheRepository.createItemValueTable(connectorId);
  }

  getItemLastValue(connectorId: string, groupId: string | null, itemId: string): Omit<SouthItemLastValue, 'itemName' | 'groupName'> | null {
    return this.cacheRepository.getItemLastValue(connectorId, groupId, itemId);
  }

  saveItemLastValue(connectorId: string, value: Omit<SouthItemLastValue, 'itemName' | 'groupName'>): void {
    this.cacheRepository.saveItemLastValue(connectorId, value);
  }

  deleteItemValue(connectorId: string, groupId: string | null, itemId: string | null): void {
    this.cacheRepository.deleteItemValue(connectorId, groupId, itemId);
  }

  dropItemValueTable(connectorId: string): void {
    this.cacheRepository.dropItemValueTable(connectorId);
  }
}
