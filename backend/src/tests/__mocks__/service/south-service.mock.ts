import { mock } from 'node:test';
import {
  OIBusSouthType,
  SouthConnectorCommandDTO,
  SouthConnectorItemCommandDTO,
  SouthConnectorItemDTO,
  SouthConnectorItemSearchParam,
  SouthConnectorManifest,
  SouthItemGroupCommandDTO,
  SouthItemLastValue
} from '../../../../shared/model/south-connector.model';
import {
  SouthConnectorEntity,
  SouthConnectorEntityLight,
  SouthConnectorItemEntity,
  SouthItemGroupEntity
} from '../../../model/south-connector.model';
import { SouthItemSettings, SouthSettings } from '../../../../shared/model/south-settings.model';
import { OIBusAnyContent, OIBusConnectionTestResult, OIBusContent } from '../../../../shared/model/engine.model';
import { Page } from '../../../../shared/model/types';
import { PassThrough } from 'node:stream';

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
  delete = mock.fn(async (_southId: string): Promise<void> => undefined);
  start = mock.fn(async (_southId: string): Promise<void> => undefined);
  stop = mock.fn(async (_southId: string): Promise<void> => undefined);
  getSouthDataStream = mock.fn((_southId: string): PassThrough | null => null);
  testSouth = mock.fn(
    async (_southId: string, _southType: OIBusSouthType, _settingsToTest: SouthSettings): Promise<OIBusConnectionTestResult> =>
      ({ items: [] }) as unknown as OIBusConnectionTestResult
  );
  testItem = mock.fn(async (): Promise<OIBusContent> => ({ type: 'any-content', content: '' }) as OIBusAnyContent);
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
  enableItem = mock.fn(async (_southId: string, _itemId: string): Promise<void> => undefined);
  disableItem = mock.fn(async (_southId: string, _itemId: string): Promise<void> => undefined);
  enableItems = mock.fn(async (_southId: string, _itemIds: Array<string>): Promise<void> => undefined);
  disableItems = mock.fn(async (_southId: string, _itemIds: Array<string>): Promise<void> => undefined);
  deleteItem = mock.fn(async (_southId: string, _itemId: string): Promise<void> => undefined);
  deleteItems = mock.fn(async (_southId: string, _itemIds: Array<string>): Promise<void> => undefined);
  deleteAllItems = mock.fn(async (_southId: string): Promise<void> => undefined);
  getItemLastValue = mock.fn((_southId: string, _itemId: string): SouthItemLastValue => ({}) as SouthItemLastValue);
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
  deleteGroup = mock.fn(async (_southId: string, _groupId: string): Promise<void> => undefined);
  moveItemsToGroup = mock.fn(async (_southId: string, _itemIds: Array<string>, _groupId: string | null): Promise<void> => undefined);
}
