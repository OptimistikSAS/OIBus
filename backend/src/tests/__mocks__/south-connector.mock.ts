import { EventEmitter } from 'node:events';
import { mock } from 'node:test';

import type { OIBusContent, OIBusRecord } from '../../../shared/model/common/content.model';
import type { Instant } from '../../../shared/model/common/types';
import { SouthItemSettings, SouthSettings } from '../../../shared/model/connector/south-settings.model';
import type { OIBusConnectionTestResult } from '../../../shared/model/domain/engine.model';
import type {
  SouthConnectorExploreEntry,
  SouthConnectorItemQueryResult,
  SouthConnectorItemTestingSettings
} from '../../../shared/model/domain/south-connector.model';

import type { ScanMode } from '../../model/scan-mode.model';
import type { SouthConnectorItemEntity } from '../../model/south-connector.model';
import { SouthConnectorEntity } from '../../model/south-connector.model';
import type SouthCacheRepository from '../../repository/cache/south-cache.repository';
import SouthConnector from '../../south/south-connector';

/**
 * Create a mock object for South Connector
 */
export default class SouthConnectorMock extends SouthConnector<SouthSettings, SouthItemSettings> {
  constructor(connector: SouthConnectorEntity<SouthSettings, SouthItemSettings>) {
    super(connector, async () => undefined, null! as SouthCacheRepository, '');
  }

  override start = mock.fn(async (): Promise<void> => undefined);
  override connect = mock.fn(async (): Promise<void> => undefined);
  override isEnabled = mock.fn((): boolean => false);
  override updateSubscriptions = mock.fn(async (): Promise<void> => undefined);
  override trigger = mock.fn((_scanMode: ScanMode): void => undefined);
  override historyQueryHandler = mock.fn(
    async (_items: Array<SouthConnectorItemEntity<SouthItemSettings>>, _startTime: Instant, _endTime: Instant): Promise<void> => undefined
  );
  override directQueryHandler = mock.fn(async (): Promise<void> => undefined);
  override addContent = mock.fn(
    async (_data: OIBusContent, _queryTime: Instant, _items: Array<SouthConnectorItemEntity<SouthItemSettings>>): Promise<void> => undefined
  );
  override disconnect = mock.fn(async (): Promise<void> => undefined);
  override stop = mock.fn(async (): Promise<void> => undefined);
  override refreshLogger = mock.fn((): void => undefined);
  override resetCache = mock.fn(async (): Promise<void> => undefined);
  override testConnection = mock.fn(async (): Promise<OIBusConnectionTestResult> => ({ items: [] }));
  override testItem = mock.fn(
    async (
      _item: SouthConnectorItemEntity<SouthItemSettings>,
      _testingSettings: SouthConnectorItemTestingSettings
    ): Promise<SouthConnectorItemQueryResult> => ({ result: {} as OIBusContent, connectionDuration: 0, queryDuration: 0 })
  );
  override getHistoryQuerySnapshot = mock.fn(
    (
      _items: Array<SouthConnectorItemEntity<SouthItemSettings>>
    ): {
      items: Array<{ itemId: string; itemName: string; trackedInstant: Instant | null; queryTime: Instant | null; value: unknown | null }>;
    } => ({ items: [] })
  );
  override connectedEvent = new EventEmitter();
  override metricsEvent = new EventEmitter();

  // Cast needed: mock.fn()'s inferred () => boolean isn't structurally assignable to the base
  // class's `this is X` type-predicate signatures, even though the runtime behavior (a boolean
  // return) is identical — the predicate narrowing only matters to callers, not this mock's body.
  hasHistoryQuery = mock.fn((): boolean => false) as unknown as SouthConnector<SouthSettings, SouthItemSettings>['hasHistoryQuery'];
  hasDirectQuery = mock.fn((): boolean => false) as unknown as SouthConnector<SouthSettings, SouthItemSettings>['hasDirectQuery'];
  hasSubscription = mock.fn((): boolean => false) as unknown as SouthConnector<SouthSettings, SouthItemSettings>['hasSubscription'];
  hasExplore = mock.fn((): boolean => false) as unknown as SouthConnector<SouthSettings, SouthItemSettings>['hasExplore'];
  explore = mock.fn(async (_parentId: string | null): Promise<Array<SouthConnectorExploreEntry>> => []);
  hasConfigurationDiscovery = mock.fn((): boolean => false);
  discover = mock.fn(async (_scope: Record<string, unknown>): Promise<Array<OIBusRecord>> => []);
}
