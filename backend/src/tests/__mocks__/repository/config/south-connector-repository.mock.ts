import { mock } from 'node:test';
import type { Database } from 'better-sqlite3';
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
import SouthConnectorRepository from '../../../../repository/config/south-connector.repository';

/**
 * Create a mock object for South Connector repository
 */
export default class SouthConnectorRepositoryMock extends SouthConnectorRepository {
  constructor() {
    super({} as Database);
  }
  override findAllSouth = mock.fn((): Array<SouthConnectorEntityLight> => []);
  override findSouthById = mock.fn((_id: string): SouthConnectorEntity<SouthSettings, SouthItemSettings> | null => null);
  override saveSouth = mock.fn((_south: SouthConnectorEntity<SouthSettings, SouthItemSettings>): void => undefined);
  override start = mock.fn((_id: string): void => undefined);
  override stop = mock.fn((_id: string): void => undefined);
  override deleteSouth = mock.fn((_id: string): void => undefined);
  override listItems = mock.fn(
    (_southId: string, _searchParams: Omit<SouthConnectorItemSearchParam, 'page'>): Array<SouthConnectorItemEntity<SouthItemSettings>> => []
  );
  override searchItems = mock.fn(
    (_southId: string, _searchParams: SouthConnectorItemSearchParam): Page<SouthConnectorItemEntity<SouthItemSettings>> => ({
      content: [],
      size: 50,
      number: 0,
      totalElements: 0,
      totalPages: 0
    })
  );
  override findAllItemsForSouth = mock.fn((_southId: string): Array<SouthConnectorItemEntity<SouthItemSettings>> => []);
  override findItemById = mock.fn((_southConnectorId: string, _itemId: string): SouthConnectorItemEntity<SouthItemSettings> | null => null);
  override saveItem = mock.fn((_southConnectorId: string, _southItem: SouthConnectorItemEntity<SouthItemSettings>): void => undefined);
  override saveAllItems = mock.fn(
    (_southConnectorId: string, _southItems: Array<SouthConnectorItemEntity<SouthItemSettings>>, _deleteItemsNotPresent: boolean): void =>
      undefined
  );
  override deleteItem = mock.fn((_southId: string, _id: string): void => undefined);
  override deleteAllItemsBySouth = mock.fn((_southId: string): void => undefined);
  override enableItem = mock.fn((_id: string): void => undefined);
  override disableItem = mock.fn((_id: string): void => undefined);
  override moveItemsToGroup = mock.fn((_itemIds: Array<string>, _groupId: string | null): void => undefined);
  override findScanModeForSouth = mock.fn((_scanModeId: string): ScanMode => ({}) as ScanMode);
  override findGroupBySouthId = mock.fn((_southId: string): Array<SouthItemGroupEntityLight> => []);
}
