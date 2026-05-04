import { mock } from 'node:test';
import { SouthItemLastValue } from '../../../../../shared/model/south-connector.model';

/**
 * Create a mock object for South Cache Repository
 */
export default class SouthCacheRepositoryMock {
  createItemValueTable = mock.fn((_connectorId: string): void => undefined);
  dropItemValueTable = mock.fn((_connectorId: string): void => undefined);
  getItemLastValue = mock.fn(
    (_connectorId: string, _groupId: string | null, _itemId: string): Omit<SouthItemLastValue, 'itemName' | 'groupName'> | null => null
  );
  saveItemLastValue = mock.fn((_connectorId: string, _command: Omit<SouthItemLastValue, 'itemName' | 'groupName'>): void => undefined);
  deleteItemValue = mock.fn((_connectorId: string, _groupId: string | null, _itemId: string | null): void => undefined);
}
