import { mock } from 'node:test';
import { SouthCacheEntry } from '../../../../repository/cache/south-cache.repository';

/**
 * Create a mock object for South Cache Repository
 */
export default class SouthCacheRepositoryMock {
  getItemLastValue = mock.fn((_connectorId: string, _itemId: string): SouthCacheEntry | null => null);
  getGroupLastValue = mock.fn((_connectorId: string, _groupId: string): SouthCacheEntry | null => null);
  saveItemLastValue = mock.fn((_connectorId: string, _command: SouthCacheEntry & { itemId: string }): void => undefined);
  saveGroupLastValue = mock.fn(
    (_connectorId: string, _groupId: string, _command: Omit<SouthCacheEntry, 'itemId' | 'groupId'>): void => undefined
  );
  deleteItemValue = mock.fn((_connectorId: string, _itemId: string): void => undefined);
  deleteItemsBySouth = mock.fn((_connectorId: string): void => undefined);
}
