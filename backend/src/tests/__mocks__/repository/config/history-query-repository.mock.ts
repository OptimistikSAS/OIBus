import { mock } from 'node:test';
import type { Database } from 'better-sqlite3';
import { HistoryQueryEntity, HistoryQueryEntityLight, HistoryQueryItemEntity } from '../../../../model/histor-query.model';
import { SouthItemSettings, SouthSettings } from '../../../../../shared/model/south-settings.model';
import { NorthSettings } from '../../../../../shared/model/north-settings.model';
import { HistoryQueryItemSearchParam, HistoryQueryStatus } from '../../../../../shared/model/history-query.model';
import { Page } from '../../../../../shared/model/types';
import { HistoryTransformerWithOptions } from '../../../../model/transformer.model';
import HistoryQueryRepository from '../../../../repository/config/history-query.repository';

/**
 * Create a mock object for History Query repository
 */
export default class HistoryQueryRepositoryMock extends HistoryQueryRepository {
  constructor() {
    super({} as Database);
  }
  override findAllHistoriesLight = mock.fn((): Array<HistoryQueryEntityLight> => []);
  override findAllHistoriesFull = mock.fn((): Array<HistoryQueryEntity<SouthSettings, NorthSettings, SouthItemSettings>> => []);
  override findHistoryById = mock.fn((_id: string): HistoryQueryEntity<SouthSettings, NorthSettings, SouthItemSettings> | null => null);
  override saveHistory = mock.fn((_history: HistoryQueryEntity<SouthSettings, NorthSettings, SouthItemSettings>): void => undefined);
  override updateHistoryStatus = mock.fn((_id: string, _status: HistoryQueryStatus): void => undefined);
  override deleteHistory = mock.fn((_id: string): void => undefined);
  override addOrEditTransformer = mock.fn((_historyId: string, _transformerWithOptions: HistoryTransformerWithOptions): void => undefined);
  override removeTransformer = mock.fn((_id: string): void => undefined);
  override removeTransformersByTransformerId = mock.fn((_transformerId: string): void => undefined);
  override searchItems = mock.fn(
    (_historyId: string, _searchParams: HistoryQueryItemSearchParam): Page<HistoryQueryItemEntity<SouthItemSettings>> => ({
      content: [],
      size: 50,
      number: 0,
      totalElements: 0,
      totalPages: 0
    })
  );
  override listItems = mock.fn(
    (_historyId: string, _searchParams: Omit<HistoryQueryItemSearchParam, 'page'>): Array<HistoryQueryItemEntity<SouthItemSettings>> => []
  );
  override findAllItemsForHistory = mock.fn((_historyId: string): Array<HistoryQueryItemEntity<SouthItemSettings>> => []);
  override findItemById = mock.fn((_historyId: string, _itemId: string): HistoryQueryItemEntity<SouthItemSettings> | null => null);
  override saveItem = mock.fn((_historyId: string, _item: HistoryQueryItemEntity<SouthItemSettings>): void => undefined);
  override saveAllItems = mock.fn(
    (_historyId: string, _items: Array<HistoryQueryItemEntity<SouthItemSettings>>, _deleteItemsNotPresent: boolean): void => undefined
  );
  override deleteItem = mock.fn((_historyId: string, _itemId: string): void => undefined);
  override deleteAllItemsByHistory = mock.fn((_historyId: string): void => undefined);
  override enableItem = mock.fn((_id: string): void => undefined);
  override disableItem = mock.fn((_id: string): void => undefined);
}
