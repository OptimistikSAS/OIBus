import { mock } from 'node:test';
import { SouthItemLastValue } from '../../../../shared/model/south-connector.model';

/**
 * Create a mock object for South Cache Service
 */
export default class SouthCacheServiceMock {
  getSouthCache = mock.fn((_connectorId: string, _scanModeId: string, _itemId: string): unknown => null);
  saveSouthCache = mock.fn((): void => undefined);
  dropItemValueTable = mock.fn((_connectorId: string): void => undefined);
  createCustomTable = mock.fn((): void => undefined);
  createItemValueTable = mock.fn((_connectorId: string): void => undefined);
  getQueryOnCustomTable = mock.fn((): unknown => null);
  runQueryOnCustomTable = mock.fn((): void => undefined);
  getItemLastValue = mock.fn(
    (_connectorId: string, _groupId: string | null, _itemId: string): Omit<SouthItemLastValue, 'itemName' | 'groupName'> | null => null
  );
  saveItemLastValue = mock.fn((_connectorId: string, _value: Omit<SouthItemLastValue, 'itemName' | 'groupName'>): void => undefined);
  deleteItemValue = mock.fn((_connectorId: string, _groupId: string | null, _itemId: string | null): void => undefined);
}
