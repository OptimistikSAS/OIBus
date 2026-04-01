import { Database } from 'better-sqlite3';
import { emptyDatabase, initDatabase, stripAuditFields } from '../../tests/utils/test-utils';
import testData from '../../tests/utils/test-data';
import { generateRandomId } from '../../service/utils';
import SouthConnectorRepository from './south-connector.repository';
import SouthItemGroupRepository from './south-item-group.repository';
import { SouthConnectorEntity, SouthConnectorItemEntity } from '../../model/south-connector.model';
import { SouthItemSettings, SouthSettings } from '../../../shared/model/south-settings.model';

jest.mock('../../service/utils');

const TEST_DB_PATH = 'src/tests/test-config-south.db';

let database: Database;
describe('SouthConnectorRepository', () => {
  beforeAll(async () => {
    database = await initDatabase('config', true, TEST_DB_PATH);
  });

  afterAll(async () => {
    database.close();
    await emptyDatabase('config', TEST_DB_PATH);
  });

  let repository: SouthConnectorRepository;

  beforeEach(() => {
    jest.resetAllMocks();
    repository = new SouthConnectorRepository(database);
  });

  it('should properly get south connectors', () => {
    expect(repository.findAllSouth()).toEqual(
      testData.south.list.map(element =>
        expect.objectContaining({
          id: element.id,
          name: element.name,
          type: element.type,
          description: element.description,
          enabled: element.enabled
        })
      )
    );
  });

  it('should properly get a south connector', () => {
    expect(stripAuditFields(repository.findSouthById(testData.south.list[0].id))).toEqual(stripAuditFields(testData.south.list[0]));
    expect(repository.findSouthById('badId')).toEqual(null);
  });

  it('should save a new south connector', () => {
    (generateRandomId as jest.Mock).mockReturnValueOnce('newId');

    const newSouthConnector: SouthConnectorEntity<SouthSettings, SouthItemSettings> = JSON.parse(JSON.stringify(testData.south.list[0]));
    newSouthConnector.id = '';
    newSouthConnector.name = 'new connector';
    newSouthConnector.items = [];
    repository.saveSouth(newSouthConnector);

    expect(newSouthConnector.id).toEqual('newId');
    const createdConnector = repository.findSouthById('newId')!;
    expect(createdConnector.id).toEqual('newId');
    expect(createdConnector.name).toEqual('new connector');
    expect(createdConnector.items.length).toEqual(0);
  });

  it('should update a south connector', () => {
    (generateRandomId as jest.Mock).mockReturnValueOnce('newItemId');

    const newSouthConnector: SouthConnectorEntity<SouthSettings, SouthItemSettings> = JSON.parse(JSON.stringify(testData.south.list[1]));
    newSouthConnector.items = [
      ...testData.south.list[1].items,
      {
        id: '',
        name: 'new item',
        enabled: true,
        scanMode: testData.scanMode.list[0],
        settings: {} as SouthItemSettings,
        createdBy: '',
        updatedBy: '',
        createdAt: '',
        updatedAt: '',
        group: null,
        syncWithGroup: false,
        maxReadInterval: null,
        readDelay: null,
        overlap: null
      }
    ];
    repository.saveSouth(newSouthConnector);

    const updatedConnector = repository.findSouthById(newSouthConnector.id)!;
    expect(updatedConnector.items.length).toEqual(3);
  });

  it('should update a south connector item with non-null historian fields', () => {
    const connector: SouthConnectorEntity<SouthSettings, SouthItemSettings> = JSON.parse(JSON.stringify(testData.south.list[0]));
    connector.items = connector.items.map((item, index) =>
      index === 0 ? { ...item, maxReadInterval: 3600, readDelay: 200, overlap: 100 } : item
    );
    repository.saveSouth(connector);

    const updatedConnector = repository.findSouthById(connector.id)!;
    const updatedItem = updatedConnector.items.find(item => item.id === connector.items[0].id)!;
    expect(updatedItem.maxReadInterval).toEqual(3600);
    expect(updatedItem.readDelay).toEqual(200);
    expect(updatedItem.overlap).toEqual(100);
  });

  it('should delete a south connector', () => {
    repository.deleteSouth('newId');
    expect(repository.findSouthById('newId')).toEqual(null);
  });

  it('should stop south connector', () => {
    repository.stop(testData.south.list[0].id);
    expect(repository.findSouthById(testData.south.list[0].id)!.enabled).toEqual(false);
  });

  it('should start south connector', () => {
    repository.start(testData.south.list[0].id);
    expect(repository.findSouthById(testData.south.list[0].id)!.enabled).toEqual(true);
  });

  it('should list items', () => {
    expect(
      repository.listItems(testData.south.list[1].id, {
        scanModeId: testData.scanMode.list[0].id,
        enabled: true,
        name: 'item'
      }).length
    ).toEqual(3);

    expect(repository.listItems(testData.south.list[1].id, { name: undefined, scanModeId: undefined, enabled: undefined }).length).toEqual(
      3
    );
  });

  it('should search items', () => {
    expect(
      repository.searchItems(testData.south.list[1].id, {
        scanModeId: testData.scanMode.list[0].id,
        enabled: true,
        name: 'item',
        page: 0
      }).totalElements
    ).toEqual(3);

    expect(
      repository.searchItems(testData.south.list[1].id, { name: undefined, scanModeId: undefined, enabled: undefined, page: 0 })
        .totalElements
    ).toEqual(3);
  });

  it('should find items', () => {
    const results = repository.findAllItemsForSouth(testData.south.list[1].id);
    expect(results.length).toEqual(3);
  });

  it('should find item', () => {
    const result = repository.findItemById(testData.south.list[1].id, testData.south.list[1].items[0].id);
    expect(stripAuditFields(result)).toEqual(expect.objectContaining(stripAuditFields(testData.south.list[1].items[0])));
    expect(repository.findItemById(testData.south.list[0].id, testData.south.list[1].items[0].id)).toEqual(null);
  });

  it('should delete item', () => {
    repository.deleteItem(testData.south.list[1].id, testData.south.list[1].items[0].id);
    repository.deleteItem(testData.south.list[1].id, testData.south.list[1].items[1].id);
    expect(repository.findItemById(testData.south.list[1].id, testData.south.list[1].items[0].id)).toEqual(null);
  });

  it('should delete all item by south', () => {
    repository.deleteAllItemsBySouth(testData.south.list[1].id);
    expect(repository.findAllItemsForSouth(testData.south.list[1].id).length).toEqual(0);
  });

  it('should disable and enable item', () => {
    repository.disableItem(testData.south.list[0].items[0].id);
    expect(repository.findItemById(testData.south.list[0].id, testData.south.list[0].items[0].id)!.enabled).toEqual(false);
    repository.enableItem(testData.south.list[0].items[0].id);
    expect(repository.findItemById(testData.south.list[0].id, testData.south.list[0].items[0].id)!.enabled).toEqual(true);
  });

  it('should save all items without removing existing items', () => {
    (generateRandomId as jest.Mock).mockReturnValueOnce('newItemIdSouth1');

    const itemsToSave: Array<SouthConnectorItemEntity<SouthItemSettings>> = JSON.parse(JSON.stringify(testData.south.list[0].items));
    itemsToSave.push({
      id: '',
      name: 'new item',
      enabled: false,
      scanMode: testData.scanMode.list[0],
      settings: {} as SouthItemSettings,
      createdBy: '',
      updatedBy: '',
      createdAt: '',
      updatedAt: '',
      group: null,
      syncWithGroup: false,
      maxReadInterval: null,
      readDelay: null,
      overlap: null
    });
    itemsToSave[0].name = 'updated name';

    repository.saveAllItems(testData.south.list[0].id, itemsToSave, false);

    const results = repository.findAllItemsForSouth(testData.south.list[0].id);
    expect(results.length).toEqual(3);

    expect(repository.findItemById(testData.south.list[0].id, testData.south.list[0].items[0].id)!.name).toEqual(itemsToSave[0].name);
    expect(repository.findItemById(testData.south.list[0].id, 'newItemIdSouth1')!.id).toEqual('newItemIdSouth1');
  });

  it('should save all items and remove existing items', () => {
    (generateRandomId as jest.Mock)
      .mockReturnValueOnce('newItemIdSouth1')
      .mockReturnValueOnce('newItemIdSouth2')
      .mockReturnValueOnce('newItemIdSouth3');

    const itemsToSave: Array<SouthConnectorItemEntity<SouthItemSettings>> = JSON.parse(JSON.stringify(testData.south.list[0].items)).map(
      (item: SouthConnectorItemEntity<SouthItemSettings>) => ({ ...item, id: '' })
    );
    itemsToSave.push({
      id: '',
      name: 'new item',
      enabled: false,
      scanMode: testData.scanMode.list[0],
      settings: {} as SouthItemSettings,
      createdBy: '',
      updatedBy: '',
      createdAt: '',
      updatedAt: '',
      group: null,
      syncWithGroup: false,
      maxReadInterval: null,
      readDelay: null,
      overlap: null
    });

    repository.saveAllItems(testData.south.list[0].id, itemsToSave, true);

    const results = repository.findAllItemsForSouth(testData.south.list[0].id);
    expect(results.length).toEqual(3);

    expect(repository.findItemById(testData.south.list[0].id, 'newItemIdSouth1')!.id).toEqual('newItemIdSouth1');
    expect(repository.findItemById(testData.south.list[0].id, 'newItemIdSouth2')!.id).toEqual('newItemIdSouth2');
    expect(repository.findItemById(testData.south.list[0].id, 'newItemIdSouth3')!.id).toEqual('newItemIdSouth3');
  });

  it('should save south connector with items that have groups', () => {
    const groupRepository = new SouthItemGroupRepository(database);
    (generateRandomId as jest.Mock).mockReturnValueOnce('testGroupId1').mockReturnValueOnce('newItemWithGroupId');

    const group = groupRepository.create({
      name: 'Test Group',
      southId: testData.south.list[0].id,
      scanMode: testData.scanMode.list[0],
      overlap: null,
      maxReadInterval: null,
      readDelay: 0,
      createdBy: '',
      updatedBy: ''
    });

    const southWithGroups: SouthConnectorEntity<SouthSettings, SouthItemSettings> = JSON.parse(JSON.stringify(testData.south.list[0]));
    southWithGroups.items = [
      {
        id: '',
        name: 'item with group',
        enabled: true,
        scanMode: testData.scanMode.list[0],
        settings: {} as SouthItemSettings,
        group,
        syncWithGroup: false,
        maxReadInterval: null,
        readDelay: null,
        overlap: null,
        createdBy: '',
        updatedBy: '',
        createdAt: '',
        updatedAt: ''
      }
    ];

    repository.saveSouth(southWithGroups);

    const savedItem = repository.findItemById(southWithGroups.id, 'newItemWithGroupId');
    expect(savedItem).toBeDefined();
    expect(savedItem!.group!.id).toEqual('testGroupId1');
  });

  it('should save item with groups', () => {
    const groupRepository = new SouthItemGroupRepository(database);
    (generateRandomId as jest.Mock).mockReturnValueOnce('testGroupId2').mockReturnValueOnce('newItemIdWithGroup');

    const group = groupRepository.create({
      name: 'Test Group 2',
      southId: testData.south.list[0].id,
      scanMode: testData.scanMode.list[0],
      overlap: 10,
      maxReadInterval: null,
      readDelay: 0,
      createdBy: '',
      updatedBy: ''
    });

    const itemWithGroup: SouthConnectorItemEntity<SouthItemSettings> = {
      id: '',
      name: 'unique-item-with-group-test',
      enabled: true,
      scanMode: testData.scanMode.list[0],
      settings: {} as SouthItemSettings,
      group,
      syncWithGroup: false,
      maxReadInterval: null,
      readDelay: null,
      overlap: null,
      createdBy: '',
      updatedBy: '',
      createdAt: '',
      updatedAt: ''
    };

    repository.saveItem(testData.south.list[0].id, itemWithGroup);

    const savedItem = repository.findItemById(testData.south.list[0].id, 'newItemIdWithGroup');
    expect(savedItem).toBeDefined();
    expect(savedItem!.group!.id).toEqual('testGroupId2');
  });

  it('should save and find item with historian fields', () => {
    (generateRandomId as jest.Mock).mockReturnValueOnce('newItemIdHistorian');

    const itemWithHistorian: SouthConnectorItemEntity<SouthItemSettings> = {
      id: '',
      name: 'item-with-historian-fields',
      enabled: true,
      scanMode: testData.scanMode.list[0],
      settings: {} as SouthItemSettings,
      group: null,
      syncWithGroup: false,
      maxReadInterval: 3600,
      readDelay: 200,
      overlap: 100,
      createdBy: '',
      updatedBy: '',
      createdAt: '',
      updatedAt: ''
    };

    repository.saveItem(testData.south.list[0].id, itemWithHistorian);

    const savedItem = repository.findItemById(testData.south.list[0].id, 'newItemIdHistorian');
    expect(savedItem).toBeDefined();
    expect(savedItem!.maxReadInterval).toEqual(3600);
    expect(savedItem!.readDelay).toEqual(200);
    expect(savedItem!.overlap).toEqual(100);
  });

  it('should save item with empty groups array', () => {
    (generateRandomId as jest.Mock).mockReturnValueOnce('newItemIdEmptyGroups');

    const itemWithEmptyGroups: SouthConnectorItemEntity<SouthItemSettings> = {
      id: '',
      name: 'item-with-empty-groups',
      enabled: true,
      scanMode: testData.scanMode.list[0],
      settings: {} as SouthItemSettings,
      group: null,
      syncWithGroup: false,
      maxReadInterval: null,
      readDelay: null,
      overlap: null,
      createdBy: '',
      updatedBy: '',
      createdAt: '',
      updatedAt: ''
    };

    repository.saveItem(testData.south.list[0].id, itemWithEmptyGroups);

    const savedItem = repository.findItemById(testData.south.list[0].id, 'newItemIdEmptyGroups');
    expect(savedItem).toBeDefined();
    expect(savedItem!.group).toBeNull();
  });

  it('should move items to a group', () => {
    const groupRepository = new SouthItemGroupRepository(database);
    (generateRandomId as jest.Mock).mockReturnValueOnce('testGroupId3');

    groupRepository.create({
      name: 'Move Group',
      southId: testData.south.list[0].id,
      scanMode: testData.scanMode.list[0],
      overlap: null,
      maxReadInterval: null,
      readDelay: 0,
      createdBy: '',
      updatedBy: ''
    });

    const existingItems = repository.findAllItemsForSouth(testData.south.list[0].id);
    expect(existingItems.length).toBeGreaterThan(0);

    const itemIds = existingItems.slice(0, 2).map(item => item.id);
    repository.moveItemsToGroup(itemIds, 'testGroupId3');

    const itemsAfterMove = repository.findAllItemsForSouth(testData.south.list[0].id);
    const movedItems = itemsAfterMove.filter(item => itemIds.includes(item.id));
    movedItems.forEach(item => {
      expect(item.group!.id).toEqual('testGroupId3');
    });
  });

  it('should remove items from groups when groupId is null', () => {
    const groupRepository = new SouthItemGroupRepository(database);
    (generateRandomId as jest.Mock).mockReturnValueOnce('testGroupId4');

    groupRepository.create({
      name: 'Remove Group',
      southId: testData.south.list[0].id,
      scanMode: testData.scanMode.list[0],
      overlap: null,
      maxReadInterval: null,
      readDelay: 0,
      createdBy: '',
      updatedBy: ''
    });

    const existingItems = repository.findAllItemsForSouth(testData.south.list[0].id);
    expect(existingItems.length).toBeGreaterThan(0);

    const itemIds = existingItems.slice(0, 1).map(item => item.id);
    repository.moveItemsToGroup(itemIds, 'testGroupId4');

    let itemsInGroup = repository.findAllItemsForSouth(testData.south.list[0].id);
    let itemInGroup = itemsInGroup.find(item => itemIds.includes(item.id));
    expect(itemInGroup!.group).not.toBeNull();

    repository.moveItemsToGroup(itemIds, null);

    itemsInGroup = repository.findAllItemsForSouth(testData.south.list[0].id);
    itemInGroup = itemsInGroup.find(item => itemIds.includes(item.id));
    expect(itemInGroup!.group).toBeNull();
  });

  it('should handle empty itemIds array in moveItemsToGroup', () => {
    expect(() => {
      repository.moveItemsToGroup([], 'someGroupId');
    }).not.toThrow();

    expect(() => {
      repository.moveItemsToGroup([], null);
    }).not.toThrow();
  });
});
