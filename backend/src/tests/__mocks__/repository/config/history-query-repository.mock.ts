import { mock } from 'node:test';
import { HistoryQueryEntity, HistoryQueryEntityLight, HistoryQueryItemEntity } from '../../../../model/histor-query.model';
import { SouthItemSettings, SouthSettings } from '../../../../../shared/model/south-settings.model';
import { NorthSettings } from '../../../../../shared/model/north-settings.model';
import { HistoryQueryItemSearchParam, HistoryQueryStatus } from '../../../../../shared/model/history-query.model';
import { Page } from '../../../../../shared/model/types';
import { HistoryTransformerWithOptions } from '../../../../model/transformer.model';

/**
 * Create a mock object for History Query repository
 */
export default class HistoryQueryRepositoryMock {
  findAllHistoriesLight = mock.fn((): Array<HistoryQueryEntityLight> => []);
  findAllHistoriesFull = mock.fn((): Array<HistoryQueryEntity<SouthSettings, NorthSettings, SouthItemSettings>> => []);
  findHistoryById = mock.fn((_id: string): HistoryQueryEntity<SouthSettings, NorthSettings, SouthItemSettings> | null => null);
  saveHistory = mock.fn((_history: HistoryQueryEntity<SouthSettings, NorthSettings, SouthItemSettings>): void => undefined);
  updateHistoryStatus = mock.fn((_id: string, _status: HistoryQueryStatus): void => undefined);
  deleteHistory = mock.fn((_id: string): void => undefined);
  addOrEditTransformer = mock.fn((_historyId: string, _transformerWithOptions: HistoryTransformerWithOptions): void => undefined);
  removeTransformer = mock.fn((_id: string): void => undefined);
  removeTransformersByTransformerId = mock.fn((_transformerId: string): void => undefined);
  searchItems = mock.fn(
    (_historyId: string, _searchParams: HistoryQueryItemSearchParam): Page<HistoryQueryItemEntity<SouthItemSettings>> => ({
      content: [],
      size: 50,
      number: 0,
      totalElements: 0,
      totalPages: 0
    })
  );
  listItems = mock.fn(
    (_historyId: string, _searchParams: Omit<HistoryQueryItemSearchParam, 'page'>): Array<HistoryQueryItemEntity<SouthItemSettings>> => []
  );
  findAllItemsForHistory = mock.fn((_historyId: string): Array<HistoryQueryItemEntity<SouthItemSettings>> => []);
  findItemById = mock.fn((_historyId: string, _itemId: string): HistoryQueryItemEntity<SouthItemSettings> | null => null);
  saveItem = mock.fn((_historyId: string, _item: HistoryQueryItemEntity<SouthItemSettings>): void => undefined);
  saveAllItems = mock.fn(
    (_historyId: string, _items: Array<HistoryQueryItemEntity<SouthItemSettings>>, _deleteItemsNotPresent: boolean): void => undefined
  );
  deleteItem = mock.fn((_historyId: string, _itemId: string): void => undefined);
  deleteAllItemsByHistory = mock.fn((_historyId: string): void => undefined);
  enableItem = mock.fn((_id: string): void => undefined);
  disableItem = mock.fn((_id: string): void => undefined);
}
