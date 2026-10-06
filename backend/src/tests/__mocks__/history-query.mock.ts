import { EventEmitter } from 'node:events';
import { mock } from 'node:test';

import type {
  CacheContentUpdateCommand,
  CacheSearchParam,
  CacheSearchResult,
  DataFolderType,
  FileCacheContent
} from '../../../shared/model/api/engine.model';
import { NorthSettings } from '../../../shared/model/connector/north-settings.model';
import { SouthItemSettings, SouthSettings } from '../../../shared/model/connector/south-settings.model';

import HistoryQuery from '../../engine/history-query';
import type { CacheSize } from '../../model/engine.model';
import { HistoryQueryEntity } from '../../model/histor-query.model';
import type NorthConnector from '../../north/north-connector';
import type SouthConnector from '../../south/south-connector';

/**
 * Create a mock object for History Query
 */
export default class HistoryQueryMock extends HistoryQuery {
  constructor(connector: HistoryQueryEntity<SouthSettings, NorthSettings, SouthItemSettings>) {
    super(connector, null! as NorthConnector<NorthSettings>, null! as SouthConnector<SouthSettings, SouthItemSettings>);
  }

  override get historyQueryConfiguration() {
    return super.historyQueryConfiguration;
  }
  override set historyQueryConfiguration(_v: HistoryQueryEntity<SouthSettings, NorthSettings, SouthItemSettings>) {
    // south and north are null in this mock — skip the connector propagation
  }

  override start = mock.fn(async (): Promise<void> => undefined);
  override stop = mock.fn(async (): Promise<void> => undefined);
  override resetCache = mock.fn(async (): Promise<void> => undefined);
  override finish = mock.fn(async (): Promise<void> => undefined);
  override refreshLogger = mock.fn((): void => undefined);
  override getNorthCacheSizes = mock.fn((): CacheSize => ({ cache: 10, error: 20, archive: 30 }));
  override triggerNorth = mock.fn((): void => undefined);
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
