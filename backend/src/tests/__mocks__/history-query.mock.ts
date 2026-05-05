import { EventEmitter } from 'node:events';
import { mock } from 'node:test';
import HistoryQuery from '../../engine/history-query';
import { SouthItemSettings, SouthSettings } from '../../../shared/model/south-settings.model';
import { HistoryQueryEntity } from '../../model/histor-query.model';
import { NorthSettings } from '../../../shared/model/north-settings.model';
import type { ILogger } from '../../model/logger.model';
import type NorthConnector from '../../north/north-connector';
import type SouthConnector from '../../south/south-connector';
import type {
  CacheSearchParam,
  CacheSearchResult,
  DataFolderType,
  FileCacheContent,
  CacheContentUpdateCommand
} from '../../../shared/model/engine.model';

/**
 * Create a mock object for History Query
 */
export default class HistoryQueryMock extends HistoryQuery {
  constructor(connector: HistoryQueryEntity<SouthSettings, NorthSettings, SouthItemSettings>) {
    super(connector, null! as NorthConnector<NorthSettings>, null! as SouthConnector<SouthSettings, SouthItemSettings>, null! as ILogger);
  }

  override start = mock.fn(async (): Promise<void> => undefined);
  override stop = mock.fn(async (): Promise<void> => undefined);
  override resetCache = mock.fn(async (): Promise<void> => undefined);
  override finish = mock.fn(async (): Promise<void> => undefined);
  override setLogger = mock.fn((_logger: ILogger): void => undefined);
  override metricsEvent = new EventEmitter();
  override finishEvent = new EventEmitter();
  override searchCacheContent = mock.fn(
    async (_searchParams: CacheSearchParam): Promise<Omit<CacheSearchResult, 'metrics'>> => ({}) as Omit<CacheSearchResult, 'metrics'>
  );
  override getFileFromCache = mock.fn(
    async (_folder: DataFolderType, _filename: string): Promise<FileCacheContent> => ({}) as FileCacheContent
  );
  override updateCacheContent = mock.fn(async (_updateCommand: CacheContentUpdateCommand): Promise<void> => undefined);
}
