import { mock } from 'node:test';
import { SouthItemLastValue } from '../../../../../shared/model/south-connector.model';

/**
 * Create a mock object for South Cache Repository
 */
export default class SouthCacheRepositoryMock {
  getItemLastValue = mock.fn((_connectorId: string, _itemId: string): Omit<SouthItemLastValue, 'itemName' | 'groupName'> | null => null);
  saveItemLastValue = mock.fn((_connectorId: string, _command: Omit<SouthItemLastValue, 'itemName' | 'groupName'>): void => undefined);
  deleteItemValue = mock.fn((_connectorId: string, _itemId: string): void => undefined);
  deleteItemsBySouth = mock.fn((_connectorId: string): void => undefined);
}
