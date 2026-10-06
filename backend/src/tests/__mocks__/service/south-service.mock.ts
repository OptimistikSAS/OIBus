import { mock } from 'node:test';

import { OIBusConnectionTestResult } from '../../../../shared/model/api/engine.model';
import {
  SouthConnectorCommandDTO,
  SouthConnectorItemCommandDTO,
  SouthConnectorItemDTO,
  SouthConnectorItemSearchParam,
  SouthConnectorItemTestResult,
  SouthExploreBrowseResult,
  SouthExploreStartResult,
  SouthItemGroupCommandDTO,
  SouthItemLastValueResponse
} from '../../../../shared/model/api/south-connector.model';
import { OIBusAnyContent, OIBusRecord } from '../../../../shared/model/common/content.model';
import { Page } from '../../../../shared/model/common/types';
import { OIBusSouthType, SouthConnectorManifest } from '../../../../shared/model/connector/south-manifest.model';
import { SouthItemSettings, SouthSettings } from '../../../../shared/model/connector/south-settings.model';

import {
  SouthConnectorEntity,
  SouthConnectorEntityLight,
  SouthConnectorItemEntity,
  SouthItemGroupEntity
} from '../../../model/south-connector.model';

/**
 * Create a mock object for South Service
 */
export default class SouthServiceMock {
  listManifest = mock.fn((): Array<SouthConnectorManifest> => []);
  getManifest = mock.fn((_type: string): SouthConnectorManifest => ({}) as SouthConnectorManifest);
  list = mock.fn((): Array<SouthConnectorEntityLight> => []);
  findById = mock.fn(
    (_southId: string): SouthConnectorEntity<SouthSettings, SouthItemSettings> =>
      ({}) as SouthConnectorEntity<SouthSettings, SouthItemSettings>
  );
  create = mock.fn(
    async (
      _command: SouthConnectorCommandDTO,
      _retrieveSecretsFromSouth: string | null,
      _createdBy: string
    ): Promise<SouthConnectorEntity<SouthSettings, SouthItemSettings>> => ({}) as SouthConnectorEntity<SouthSettings, SouthItemSettings>
  );
  update = mock.fn(async (): Promise<void> => undefined);
  delete = mock.fn(async (_southId: string, _userId: string): Promise<void> => undefined);
  start = mock.fn(async (_southId: string): Promise<void> => undefined);
  stop = mock.fn(async (_southId: string): Promise<void> => undefined);
  getSouthMetric = mock.fn((_southId: string): SouthConnectorMetrics => ({}) as SouthConnectorMetrics);
  testSouth = mock.fn(
    async (_southId: string, _southType: OIBusSouthType, _settingsToTest: SouthSettings): Promise<OIBusConnectionTestResult> =>
      ({ items: [] }) as unknown as OIBusConnectionTestResult
  );
  testItem = mock.fn(async (): Promise<SouthConnectorItemTestResult> => ({
    raw: { type: 'any-content', content: '' } as OIBusAnyContent,
    transformed: null,
    connectionDuration: 0,
    queryDuration: 0
  }));
  startExplore = mock.fn(
    async (_southId: string, _southType: OIBusSouthType, _settingsToTest: SouthSettings): Promise<SouthExploreStartResult> => ({
      sessionId: 'sessionId',
      entries: []
    })
  );
  browseExplore = mock.fn(async (_sessionId: string, _parentId: string | null): Promise<SouthExploreBrowseResult> => ({ entries: [] }));
  closeExplore = mock.fn(async (_sessionId: string): Promise<void> => undefined);
  closeAllExploreSessions = mock.fn(async (): Promise<void> => undefined);
  listItems = mock.fn((_southId: string): Array<SouthConnectorItemEntity<SouthItemSettings>> => []);
  searchItems = mock.fn(
    (_southId: string, _searchParams: SouthConnectorItemSearchParam): Page<SouthConnectorItemEntity<SouthItemSettings>> => ({
      content: [],
      size: 50,
      number: 0,
      totalElements: 0,
      totalPages: 0
    })
  );
  findItemById = mock.fn(
    (_southId: string, _itemId: string): SouthConnectorItemEntity<SouthItemSettings> => ({}) as SouthConnectorItemEntity<SouthItemSettings>
  );
  createItem = mock.fn(
    async (
      _southId: string,
      _command: SouthConnectorItemCommandDTO,
      _createdBy: string
    ): Promise<SouthConnectorItemEntity<SouthItemSettings>> => ({}) as SouthConnectorItemEntity<SouthItemSettings>
  );
  updateItem = mock.fn(
    async (_southId: string, _itemId: string, _command: SouthConnectorItemCommandDTO, _updatedBy: string): Promise<void> => undefined
  );
  discover = mock.fn(
    async (_southId: string, _southType: string, _settings: unknown, _scope: Record<string, unknown>): Promise<Array<OIBusRecord>> => []
  );
  enableItem = mock.fn(async (_southId: string, _itemId: string): Promise<void> => undefined);
  disableItem = mock.fn(async (_southId: string, _itemId: string): Promise<void> => undefined);
  enableItems = mock.fn(async (_southId: string, _itemIds: Array<string>): Promise<void> => undefined);
  disableItems = mock.fn(async (_southId: string, _itemIds: Array<string>): Promise<void> => undefined);
  deleteItem = mock.fn(async (_southId: string, _itemId: string, _userId: string): Promise<void> => undefined);
  deleteItems = mock.fn(async (_southId: string, _itemIds: Array<string>, _userId: string): Promise<void> => undefined);
  deleteAllItems = mock.fn(async (_southId: string, _userId: string): Promise<void> => undefined);
  getItemLastValue = mock.fn((_southId: string, _itemId: string): SouthItemLastValueResponse => ({
    itemLastValue: null,
    groupLastValue: null
  }));
  checkImportItems = mock.fn(
    async (
      _southType: string,
      _fileContent: string,
      _delimiter: string,
      _existingItems: Array<{ name: string }>
    ): Promise<{ items: Array<SouthConnectorItemDTO>; errors: Array<{ item: Record<string, string>; error: string }> }> => ({
      items: [],
      errors: []
    })
  );
  importItems = mock.fn(async (): Promise<void> => undefined);
  retrieveSecretsFromSouth = mock.fn(
    (
      _retrieveSecretsFromSouth: string | null,
      _manifest: SouthConnectorManifest
    ): SouthConnectorEntity<SouthSettings, SouthItemSettings> | null => null
  );
  getGroups = mock.fn((_southId: string): Array<SouthItemGroupEntity> => []);
  getGroup = mock.fn((_southId: string, _groupId: string): SouthItemGroupEntity => ({}) as SouthItemGroupEntity);
  createGroup = mock.fn(
    (_southId: string, _command: SouthItemGroupCommandDTO, _user: string): SouthItemGroupEntity => ({}) as SouthItemGroupEntity
  );
  updateGroup = mock.fn(
    (_southId: string, _groupId: string, _user: string, _command: SouthItemGroupCommandDTO): SouthItemGroupEntity =>
      ({}) as SouthItemGroupEntity
  );
  deleteGroup = mock.fn(async (_southId: string, _groupId: string, _userId: string): Promise<void> => undefined);
  moveItemsToGroup = mock.fn(async (_southId: string, _itemIds: Array<string>, _groupId: string | null): Promise<void> => undefined);
}
