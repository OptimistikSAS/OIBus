import { EventEmitter } from 'node:events';
import { mock } from 'node:test';
import SouthConnector from '../../south/south-connector';
import { SouthConnectorEntity } from '../../model/south-connector.model';
import { SouthItemSettings, SouthSettings } from '../../../shared/model/south-settings.model';
import type { ILogger } from '../../model/logger.model';
import type SouthCacheRepository from '../../repository/cache/south-cache.repository';
import type { OIBusConnectionTestResult, OIBusContent } from '../../../shared/model/engine.model';
import type { ScanMode } from '../../model/scan-mode.model';
import type { Instant } from '../../../shared/model/types';
import type { SouthConnectorItemEntity } from '../../model/south-connector.model';
import type { SouthConnectorItemTestingSettings } from '../../../shared/model/south-connector.model';

/**
 * Create a mock object for South Connector
 */
export default class SouthConnectorMock extends SouthConnector<SouthSettings, SouthItemSettings> {
  constructor(connector: SouthConnectorEntity<SouthSettings, SouthItemSettings>) {
    super(connector, async () => undefined, null! as SouthCacheRepository, null! as ILogger, '');
  }

  override start = mock.fn(async (): Promise<void> => undefined);
  override connect = mock.fn(async (): Promise<void> => undefined);
  override updateScanModeIfUsed = mock.fn((_scanMode: ScanMode): void => undefined);
  override isEnabled = mock.fn((): boolean => false);
  override updateCronJobs = mock.fn((): void => undefined);
  override updateSubscriptions = mock.fn(async (): Promise<void> => undefined);
  override addToQueue = mock.fn((_scanMode: ScanMode): void => undefined);
  override run = mock.fn(async (): Promise<void> => undefined);
  override createDeferredPromise = mock.fn((): void => undefined);
  override resolveDeferredPromise = mock.fn((): void => undefined);
  override historyQueryHandler = mock.fn(async (): Promise<void> => undefined);
  override directQueryHandler = mock.fn(async (): Promise<void> => undefined);
  override addContent = mock.fn(async (_data: OIBusContent, _queryTime: Instant, _items: Array<SouthConnectorItemEntity<SouthItemSettings>>): Promise<void> => undefined);
  override disconnect = mock.fn(async (): Promise<void> => undefined);
  override stop = mock.fn(async (): Promise<void> => undefined);
  override setLogger = mock.fn((_logger: ILogger): void => undefined);
  override resetCache = mock.fn(async (): Promise<void> => undefined);
  override testConnection = mock.fn(async (): Promise<OIBusConnectionTestResult> => ({ items: [] }));
  override testItem = mock.fn(async (_item: SouthConnectorItemEntity<SouthItemSettings>, _testingSettings: SouthConnectorItemTestingSettings): Promise<OIBusContent> => ({}) as OIBusContent);
  override connectedEvent = new EventEmitter();
  override metricsEvent = new EventEmitter();

  hasHistoryQuery = mock.fn((): boolean => false);
  hasDirectQuery = mock.fn((): boolean => false);
  hasSubscription = mock.fn((): boolean => false);
}
