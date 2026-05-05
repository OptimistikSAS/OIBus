import { mock } from 'node:test';
import { PassThrough } from 'node:stream';
import { mockBaseFolders } from '../utils/test-utils';
import type NorthConnector from '../../north/north-connector';
import type { NorthSettings } from '../../../shared/model/north-settings.model';
import type { SouthSettings, SouthItemSettings } from '../../../shared/model/south-settings.model';
import type NorthConnectorMetricsService from '../../service/metrics/north-connector-metrics.service';
import type SouthConnectorMetricsService from '../../service/metrics/south-connector-metrics.service';
import type SouthConnector from '../../south/south-connector';
import type HistoryQuery from '../../engine/history-query';
import type HistoryQueryMetricsService from '../../service/metrics/history-query-metrics.service';
import type { NorthConnectorEntity } from '../../model/north-connector.model';
import type { SouthConnectorEntity } from '../../model/south-connector.model';
import type { HistoryQueryEntity } from '../../model/histor-query.model';
import type {
  NorthConnectorMetrics,
  SouthConnectorMetrics,
  HistoryQueryMetrics,
  CacheSearchResult,
  FileCacheContent
} from '../../../shared/model/engine.model';
import type { ILogger } from '../../model/logger.model';
import LoggerMock from './service/logger/logger.mock';

/**
 * Create a mock object for Data Stream engine
 */
export default class DataStreamEngineMock {
  cacheFolders = mockBaseFolders('');
  logger: ILogger = new LoggerMock();

  constructor(_logger: unknown) {
    void _logger;
  }

  start = mock.fn(async (): Promise<void> => undefined);
  stop = mock.fn(async (): Promise<void> => undefined);
  createNorth = mock.fn(async (_northId: string): Promise<NorthConnector<NorthSettings>> => ({}) as NorthConnector<NorthSettings>);
  startNorth = mock.fn(async (_northId: string): Promise<void> => undefined);
  getNorth = mock.fn(
    (_northId: string): { north: NorthConnector<NorthSettings>; metrics: NorthConnectorMetricsService } =>
      ({}) as { north: NorthConnector<NorthSettings>; metrics: NorthConnectorMetricsService }
  );
  getNorthSSE = mock.fn((_northId: string): PassThrough => new PassThrough());
  getNorthMetrics = mock.fn((_northId: string): NorthConnectorMetrics => ({}) as NorthConnectorMetrics);
  getAllNorthMetrics = mock.fn((): Record<string, NorthConnectorMetrics> => ({}));
  resetNorthMetrics = mock.fn((_northId: string): void => undefined);
  reloadNorth = mock.fn(async (_northEntity: NorthConnectorEntity<NorthSettings>): Promise<void> => undefined);
  stopNorth = mock.fn(async (_northId: string): Promise<void> => undefined);
  deleteNorth = mock.fn(async (_northEntity: NorthConnectorEntity<NorthSettings>): Promise<void> => undefined);
  createSouth = mock.fn(
    async (_southId: string): Promise<SouthConnector<SouthSettings, SouthItemSettings>> =>
      ({}) as SouthConnector<SouthSettings, SouthItemSettings>
  );
  startSouth = mock.fn(async (_southId: string): Promise<void> => undefined);
  getSouth = mock.fn(
    (_southId: string): { south: SouthConnector<SouthSettings, SouthItemSettings>; metrics: SouthConnectorMetricsService } =>
      ({}) as { south: SouthConnector<SouthSettings, SouthItemSettings>; metrics: SouthConnectorMetricsService }
  );
  getSouthSSE = mock.fn((_southId: string): PassThrough => new PassThrough());
  getAllSouthMetrics = mock.fn((): Record<string, SouthConnectorMetrics> => ({}));
  resetSouthMetrics = mock.fn((_southId: string): void => undefined);
  reloadSouth = mock.fn(async (_southConnector: SouthConnectorEntity<SouthSettings, SouthItemSettings>): Promise<void> => undefined);
  reloadSouthItems = mock.fn(async (_southConnector: SouthConnectorEntity<SouthSettings, SouthItemSettings>): Promise<void> => undefined);
  stopSouth = mock.fn(async (_southId: string): Promise<void> => undefined);
  deleteSouth = mock.fn(async (_southEntity: SouthConnectorEntity<SouthSettings, SouthItemSettings>): Promise<void> => undefined);
  createHistoryQuery = mock.fn(async (_historyId: string): Promise<HistoryQuery> => ({}) as HistoryQuery);
  startHistoryQuery = mock.fn(async (_historyId: string): Promise<void> => undefined);
  getHistoryQuery = mock.fn(
    (_historyId: string): { historyQuery: HistoryQuery; metrics: HistoryQueryMetricsService } =>
      ({}) as { historyQuery: HistoryQuery; metrics: HistoryQueryMetricsService }
  );
  getHistoryQuerySSE = mock.fn((_historyId: string): PassThrough => new PassThrough());
  getHistoryMetrics = mock.fn((_historyId: string): HistoryQueryMetrics => ({}) as HistoryQueryMetrics);
  reloadHistoryQuery = mock.fn(
    async (_historyQueryConfig: HistoryQueryEntity<SouthSettings, NorthSettings, SouthItemSettings>, _resetCache: boolean): Promise<void> =>
      undefined
  );
  stopHistoryQuery = mock.fn(async (_historyId: string): Promise<void> => undefined);
  resetHistoryQueryCache = mock.fn(async (_historyId: string): Promise<void> => undefined);
  deleteHistoryQuery = mock.fn(
    async (_historyEntity: HistoryQueryEntity<SouthSettings, NorthSettings, SouthItemSettings>): Promise<void> => undefined
  );
  setLogger = mock.fn((_logger: ILogger): void => undefined);
  addContent = mock.fn(async (): Promise<void> => undefined);
  addExternalContent = mock.fn(async (): Promise<void> => undefined);
  searchCacheContent = mock.fn(async (): Promise<CacheSearchResult> => ({}) as CacheSearchResult);
  getFileFromCache = mock.fn(async (): Promise<FileCacheContent> => ({}) as FileCacheContent);
  updateCacheContent = mock.fn(async (): Promise<void> => undefined);
  updateScanMode = mock.fn(async (): Promise<void> => undefined);
  updateNorthTransformerBySouth = mock.fn((_southId: string): void => undefined);
  updateNorthConfiguration = mock.fn((_northId: string): void => undefined);
  reloadTransformer = mock.fn(async (_transformerId: string): Promise<void> => undefined);
  removeAndReloadTransformer = mock.fn(async (_transformerId: string): Promise<void> => undefined);
}
