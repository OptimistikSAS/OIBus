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
  saveItemsLastValues = mock.fn((_southId: string, _values: Array<{ itemId: string; value: unknown; instant: string }>): void => undefined);
  getItemsLastValues = mock.fn(
    (_southId: string, _itemIds: Array<string>): Map<string, { value: unknown; trackedInstant: string }> => new Map()
  );
  getItemCachedValue = mock.fn((_southId: string, _itemId: string): { value: unknown; trackedInstant: string } | null => null);
}
