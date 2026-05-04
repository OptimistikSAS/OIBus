import { mock } from 'node:test';
import {
  SouthConnectorEntity,
  SouthConnectorEntityLight,
  SouthConnectorItemEntity,
  SouthItemGroupEntityLight
} from '../../../../model/south-connector.model';
import { SouthItemSettings, SouthSettings } from '../../../../../shared/model/south-settings.model';
import { SouthConnectorItemSearchParam } from '../../../../../shared/model/south-connector.model';
import { Page } from '../../../../../shared/model/types';
import { ScanMode } from '../../../../model/scan-mode.model';

/**
 * Create a mock object for South Connector repository
 */
export default class SouthConnectorRepositoryMock {
  findAllSouth = mock.fn((): Array<SouthConnectorEntityLight> => []);
  findSouthById = mock.fn((_id: string): SouthConnectorEntity<SouthSettings, SouthItemSettings> | null => null);
  saveSouth = mock.fn((_south: SouthConnectorEntity<SouthSettings, SouthItemSettings>): void => undefined);
  start = mock.fn((_id: string): void => undefined);
  stop = mock.fn((_id: string): void => undefined);
  deleteSouth = mock.fn((_id: string): void => undefined);
  listItems = mock.fn(
    (_southId: string, _searchParams: Omit<SouthConnectorItemSearchParam, 'page'>): Array<SouthConnectorItemEntity<SouthItemSettings>> => []
  );
  searchItems = mock.fn(
    (_southId: string, _searchParams: SouthConnectorItemSearchParam): Page<SouthConnectorItemEntity<SouthItemSettings>> => ({
      content: [],
      size: 50,
      number: 0,
      totalElements: 0,
      totalPages: 0
    })
  );
  findAllItemsForSouth = mock.fn((_southId: string): Array<SouthConnectorItemEntity<SouthItemSettings>> => []);
  findItemById = mock.fn((_southConnectorId: string, _itemId: string): SouthConnectorItemEntity<SouthItemSettings> | null => null);
  saveItem = mock.fn((_southConnectorId: string, _southItem: SouthConnectorItemEntity<SouthItemSettings>): void => undefined);
  saveAllItems = mock.fn(
    (_southConnectorId: string, _southItems: Array<SouthConnectorItemEntity<SouthItemSettings>>, _deleteItemsNotPresent: boolean): void =>
      undefined
  );
  deleteItem = mock.fn((_southId: string, _id: string): void => undefined);
  deleteAllItemsBySouth = mock.fn((_southId: string): void => undefined);
  enableItem = mock.fn((_id: string): void => undefined);
  disableItem = mock.fn((_id: string): void => undefined);
  moveItemsToGroup = mock.fn((_itemIds: Array<string>, _groupId: string | null): void => undefined);
  findScanModeForSouth = mock.fn((_scanModeId: string): ScanMode => ({}) as ScanMode);
  findGroupBySouthId = mock.fn((_southId: string): Array<SouthItemGroupEntityLight> => []);
}
