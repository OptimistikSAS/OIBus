import { EventEmitter } from 'node:events';
import { mock } from 'node:test';
import {
  CacheContentUpdateCommand,
  CacheSearchParam,
  CacheSearchResult,
  DataFolderType,
  EngineSettingsCommandDTO,
  EngineSettingsUpdateResultDTO,
  FileCacheContent,
  OIBusContent,
  OIBusInfo
} from '../../../../shared/model/engine.model';
import { EngineSettings } from '../../../model/engine.model';
/**
 * Create a mock object for OIBus Service
 */
export default class OIBusServiceMock {
  start = mock.fn(async (): Promise<void> => undefined);
  getEngineSettings = mock.fn((): EngineSettings => ({}) as EngineSettings);
  getInfo = mock.fn((): OIBusInfo => ({}) as OIBusInfo);
  getProxyServer = mock.fn((): unknown => null);
  updateEngineSettings = mock.fn(
    async (_command: EngineSettingsCommandDTO, _updatedBy: string): Promise<EngineSettingsUpdateResultDTO> =>
      ({}) as EngineSettingsUpdateResultDTO
  );
  updateOIBusVersion = mock.fn((_version: string, _launcherVersion: string): void => undefined);
  restart = mock.fn(async (): Promise<void> => undefined);
  stop = mock.fn(async (): Promise<void> => undefined);
  addExternalContent = mock.fn(async (_northId: string, _dataSourceId: string, _content: OIBusContent): Promise<void> => undefined);
  setLogger = mock.fn((): void => undefined);
  logHealthSignal = mock.fn((): void => undefined);
  updateEngineMetrics = mock.fn((): void => undefined);
  resetEngineMetrics = mock.fn((): void => undefined);
  resetNorthMetrics = mock.fn((_northId: string): void => undefined);
  resetSouthMetrics = mock.fn((_southId: string): void => undefined);
  searchCacheContent = mock.fn(
    async (_type: 'north' | 'history', _id: string, _searchParams: CacheSearchParam): Promise<CacheSearchResult> =>
      ({}) as CacheSearchResult
  );
  getFileFromCache = mock.fn(
    async (_type: 'north' | 'history', _id: string, _folder: DataFolderType, _filename: string): Promise<FileCacheContent> =>
      ({}) as FileCacheContent
  );
  updateCacheContent = mock.fn(
    async (_type: 'north' | 'history', _id: string, _updateCommand: CacheContentUpdateCommand): Promise<void> => undefined
  );
  stream = new EventEmitter();
  loggerEvent = new EventEmitter();
  portChangeEvent = new EventEmitter();
}
