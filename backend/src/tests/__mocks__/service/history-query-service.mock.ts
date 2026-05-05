import { mock } from 'node:test';
import { HistoryQueryEntity, HistoryQueryEntityLight, HistoryQueryItemEntity } from '../../../model/histor-query.model';
import { SouthItemSettings, SouthSettings } from '../../../../shared/model/south-settings.model';
import { NorthSettings } from '../../../../shared/model/north-settings.model';
import {
  HistoryQueryCommandDTO,
  HistoryQueryItemCommandDTO,
  HistoryQueryItemDTO,
  HistoryQueryItemSearchParam
} from '../../../../shared/model/history-query.model';
import { HistoryTransformerWithOptions } from '../../../model/transformer.model';
import { OIBusAnyContent, OIBusConnectionTestResult, OIBusContent } from '../../../../shared/model/engine.model';
import { HistoryQueryMetrics } from '../../../../shared/model/engine.model';
import { Page } from '../../../../shared/model/types';
import { PassThrough } from 'node:stream';

/**
 * Create a mock object for History Query Service
 */
export default class HistoryQueryServiceMock {
  list = mock.fn((): Array<HistoryQueryEntityLight> => []);
  findById = mock.fn(
    (_historyId: string): HistoryQueryEntity<SouthSettings, NorthSettings, SouthItemSettings> | null =>
      ({}) as HistoryQueryEntity<SouthSettings, NorthSettings, SouthItemSettings>
  );
  create = mock.fn(
    async (): Promise<HistoryQueryEntity<SouthSettings, NorthSettings, SouthItemSettings>> =>
      ({}) as HistoryQueryEntity<SouthSettings, NorthSettings, SouthItemSettings>
  );
  update = mock.fn(
    async (_historyId: string, _command: HistoryQueryCommandDTO, _resetCache: boolean, _updatedBy: string): Promise<void> => undefined
  );
  delete = mock.fn(async (_historyId: string): Promise<void> => undefined);
  start = mock.fn(async (_historyId: string): Promise<void> => undefined);
  pause = mock.fn(async (_historyId: string): Promise<void> => undefined);
  getHistoryDataStream = mock.fn((_historyId: string): PassThrough | null => null);
  getHistoryMetric = mock.fn((_historyId: string): HistoryQueryMetrics | null => null);
  getHistoryMetrics = mock.fn((_historyId: string): HistoryQueryMetrics | null => null);
  getAllHistoryMetrics = mock.fn((): unknown => ({}));
  testNorth = mock.fn(async (): Promise<OIBusConnectionTestResult> => ({ items: [] }) as unknown as OIBusConnectionTestResult);
  testSouth = mock.fn(async (): Promise<OIBusConnectionTestResult> => ({ items: [] }) as unknown as OIBusConnectionTestResult);
  testItem = mock.fn(async (): Promise<OIBusContent> => ({ type: 'any-content', content: '' }) as OIBusAnyContent);
  listItems = mock.fn((_historyId: string): Array<HistoryQueryItemEntity<SouthItemSettings>> => []);
  searchItems = mock.fn(
    (_historyId: string, _searchParams: HistoryQueryItemSearchParam): Page<HistoryQueryItemEntity<SouthItemSettings>> => ({
      content: [],
      size: 50,
      number: 0,
      totalElements: 0,
      totalPages: 0
    })
  );
  findItemById = mock.fn(
    (_historyId: string, _itemId: string): HistoryQueryItemEntity<SouthItemSettings> => ({}) as HistoryQueryItemEntity<SouthItemSettings>
  );
  createItem = mock.fn(async (): Promise<HistoryQueryItemEntity<SouthItemSettings>> => ({}) as HistoryQueryItemEntity<SouthItemSettings>);
  updateItem = mock.fn(
    async (_historyId: string, _itemId: string, _command: HistoryQueryItemCommandDTO, _updatedBy: string): Promise<void> => undefined
  );
  enableItem = mock.fn(async (_historyId: string, _itemId: string): Promise<void> => undefined);
  disableItem = mock.fn(async (_historyId: string, _itemId: string): Promise<void> => undefined);
  enableItems = mock.fn(async (_historyId: string, _itemIds: Array<string>): Promise<void> => undefined);
  disableItems = mock.fn(async (_historyId: string, _itemIds: Array<string>): Promise<void> => undefined);
  deleteItem = mock.fn(async (_historyId: string, _itemId: string): Promise<void> => undefined);
  deleteItems = mock.fn(async (_historyId: string, _itemIds: Array<string>): Promise<void> => undefined);
  deleteAllItems = mock.fn(async (_historyId: string): Promise<void> => undefined);
  checkImportItems = mock.fn(
    async (
      _southType: string,
      _fileContent: string,
      _delimiter: string,
      _existingItems: Array<Omit<HistoryQueryItemDTO, 'createdBy' | 'updatedBy'>>
    ): Promise<{ items: Array<HistoryQueryItemDTO>; errors: Array<{ item: Record<string, string>; error: string }> }> => ({
      items: [],
      errors: []
    })
  );
  importItems = mock.fn(async (): Promise<void> => undefined);
  addOrEditTransformer = mock.fn(
    async (_historyId: string, _transformerWithOptions: HistoryTransformerWithOptions): Promise<void> => undefined
  );
  removeTransformer = mock.fn(async (_historyId: string, _historyTransformerId: string): Promise<void> => undefined);
  retrieveSecrets = mock.fn((): HistoryQueryEntity<SouthSettings, NorthSettings, SouthItemSettings> | null => null);
}
