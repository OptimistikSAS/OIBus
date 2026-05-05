import { EventEmitter } from 'node:events';
import { mock } from 'node:test';
import type { ReadStream } from 'node:fs';
import NorthConnector from '../../north/north-connector';
import { NorthConnectorEntity } from '../../model/north-connector.model';
import { NorthSettings } from '../../../shared/model/north-settings.model';
import type { ILogger } from '../../model/logger.model';
import type { ICacheService } from '../../model/cache.service.model';
import type {
  OIBusConnectionTestResult,
  CacheMetadata,
  CacheSearchParam,
  CacheSearchResult,
  DataFolderType,
  FileCacheContent,
  CacheContentUpdateCommand
} from '../../../shared/model/engine.model';
import type { ScanMode } from '../../model/scan-mode.model';

/**
 * Create a mock object for North Connector
 */
export default class NorthConnectorMock extends NorthConnector<NorthSettings> {
  constructor(connector: NorthConnectorEntity<NorthSettings>) {
    super(connector, null! as ILogger, null! as ICacheService);
  }

  override start = mock.fn(async (): Promise<void> => undefined);
  override isEnabled = mock.fn((): boolean => false);
  override connect = mock.fn(async (): Promise<void> => undefined);
  override createCronJob = mock.fn((_scanMode: ScanMode): void => undefined);
  override addTaskToQueue = mock.fn((): void => undefined);
  override run = mock.fn(async (): Promise<void> => undefined);
  override handleContentWrapper = mock.fn(async (): Promise<void> => undefined);
  override resetCache = mock.fn(async (): Promise<void> => undefined);
  override cacheContent = mock.fn(async (): Promise<void> => undefined);
  override isCacheEmpty = mock.fn((): boolean => true);
  override disconnect = mock.fn(async (): Promise<void> => undefined);
  override stop = mock.fn(async (): Promise<void> => undefined);
  override setLogger = mock.fn((_logger: ILogger): void => undefined);
  override updateScanMode = mock.fn(async (): Promise<void> => undefined);
  override searchCacheContent = mock.fn(
    async (_searchParams: CacheSearchParam): Promise<Omit<CacheSearchResult, 'metrics'>> => ({}) as Omit<CacheSearchResult, 'metrics'>
  );
  override getFileFromCache = mock.fn(
    async (_folder: DataFolderType, _filename: string): Promise<FileCacheContent> => ({}) as FileCacheContent
  );
  override updateCacheContent = mock.fn(async (_updateCommand: CacheContentUpdateCommand): Promise<void> => undefined);
  override testConnection = mock.fn(async (): Promise<OIBusConnectionTestResult> => ({ items: [] }));
  override metricsEvent = new EventEmitter();

  override supportedTypes = mock.fn((): Array<string> => []);
  override handleContent = mock.fn(async (_fileStream: ReadStream, _cacheMetadata: CacheMetadata): Promise<void> => undefined);
}
