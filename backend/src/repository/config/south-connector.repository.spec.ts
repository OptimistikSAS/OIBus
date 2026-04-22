import { before, after, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Database } from 'better-sqlite3';
import { emptyDatabase, initDatabase, stripAuditFields } from '../../tests/utils/test-utils';
import testData from '../../tests/utils/test-data';
import SouthConnectorRepository from './south-connector.repository';
import SouthItemGroupRepository from './south-item-group.repository';
import { SouthConnectorEntity, SouthConnectorItemEntity } from '../../model/south-connector.model';
import { SouthItemSettings, SouthSettings } from '../../../shared/model/south-settings.model';

const TEST_DB_PATH = 'src/tests/test-config-south.db';

let database: Database;
describe('SouthConnectorRepository', () => {
  before(async () => {
    database = await initDatabase('config', true, TEST_DB_PATH);
  });

  after(async () => {
    database.close();
    await emptyDatabase('config', TEST_DB_PATH);
  });

  let repository: SouthConnectorRepository;

  beforeEach(() => {
    repository = new SouthConnectorRepository(database);
  });

  it('should properly get south connectors', () => {
    const result = repository.findAllSouth();
    for (const element of testData.south.list) {
      const found = result.find(r => r.id === element.id);
      assert.ok(found, `South connector ${element.id} not found`);
      assert.strictEqual(found.name, element.name);
      assert.strictEqual(found.type, element.type);
      assert.strictEqual(found.description, element.description);
      assert.strictEqual(found.enabled, element.enabled);
    }
  });

  it('should properly get a south connector', () => {
    assert.deepStrictEqual(
      stripAuditFields(repository.findSouthById(testData.south.list[0].id)),
      stripAuditFields(testData.south.list[0])
    );
    assert.strictEqual(repository.findSouthById('badId'), null);
  });

  it('should save a new south connector', () => {
    const newSouthConnector: SouthConnectorEntity<SouthSettings, SouthItemSettings> = JSON.parse(JSON.stringify(testData.south.list[0]));
    newSouthConnector.id = '';
    newSouthConnector.name = 'new connector';
    newSouthConnector.items = [];
    repository.saveSouth(newSouthConnector);

    assert.ok(newSouthConnector.id);
    const createdConnector = repository.findSouthById(newSouthConnector.id)!;
    assert.strictEqual(createdConnector.id, newSouthConnector.id);
    assert.strictEqual(createdConnector.name, 'new connector');
    assert.strictEqual(createdConnector.items.length, 0);
  });

  it('should update a south connector', () => {
    const newSouthConnector: SouthConnectorEntity<SouthSettings, SouthItemSettings> = JSON.parse(JSON.stringify(testData.south.list[1]));
    const newItem: SouthConnectorItemEntity<SouthItemSettings> = {
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
    };
    newSouthConnector.items = [...testData.south.list[1].items, newItem];
    repository.saveSouth(newSouthConnector);

    const updatedConnector = repository.findSouthById(newSouthConnector.id)!;
    assert.strictEqual(updatedConnector.items.length, 3);
  });

  it('should update a south connector item with non-null historian fields', () => {
    const connector: SouthConnectorEntity<SouthSettings, SouthItemSettings> = JSON.parse(JSON.stringify(testData.south.list[0]));
    connector.items = connector.items.map((item, index) =>
      index === 0 ? { ...item, maxReadInterval: 3600, readDelay: 200, overlap: 100 } : item
    );
    repository.saveSouth(connector);

    const updatedConnector = repository.findSouthById(connector.id)!;
    const updatedItem = updatedConnector.items.find(item => item.id === connector.items[0].id)!;
    assert.strictEqual(updatedItem.maxReadInterval, 3600);
    assert.strictEqual(updatedItem.readDelay, 200);
    assert.strictEqual(updatedItem.overlap, 100);
  });

  it('should delete a south connector', () => {
    // Save a new connector first to delete it
    const newSouthConnector: SouthConnectorEntity<SouthSettings, SouthItemSettings> = JSON.parse(JSON.stringify(testData.south.list[0]));
    newSouthConnector.id = '';
    newSouthConnector.name = 'to be deleted';
    newSouthConnector.items = [];
    repository.saveSouth(newSouthConnector);

    assert.ok(repository.findSouthById(newSouthConnector.id));
    repository.deleteSouth(newSouthConnector.id);
    assert.strictEqual(repository.findSouthById(newSouthConnector.id), null);
  });

  it('should stop south connector', () => {
    repository.stop(testData.south.list[0].id);
    assert.strictEqual(repository.findSouthById(testData.south.list[0].id)!.enabled, false);
  });

  it('should start south connector', () => {
    repository.start(testData.south.list[0].id);
    assert.strictEqual(repository.findSouthById(testData.south.list[0].id)!.enabled, true);
  });

  it('should list items', () => {
    assert.strictEqual(
      repository.listItems(testData.south.list[1].id, {
        scanModeId: testData.scanMode.list[0].id,
        enabled: true,
        name: 'item'
      }).length,
      3
    );
    assert.strictEqual(
      repository.listItems(testData.south.list[1].id, { name: undefined, scanModeId: undefined, enabled: undefined }).length,
      3
    );
  });

  it('should search items', () => {
    assert.strictEqual(
      repository.searchItems(testData.south.list[1].id, {
        scanModeId: testData.scanMode.list[0].id,
        enabled: true,
        name: 'item',
        page: 0
      }).totalElements,
      3
    );
    assert.strictEqual(
      repository.searchItems(testData.south.list[1].id, { name: undefined, scanModeId: undefined, enabled: undefined, page: 0 }).totalElements,
      3
    );
  });

  it('should find items', () => {
    const results = repository.findAllItemsForSouth(testData.south.list[1].id);
    assert.strictEqual(results.length, 3);
  });

  it('should find item', () => {
    const result = repository.findItemById(testData.south.list[1].id, testData.south.list[1].items[0].id);
    const stripped = stripAuditFields(result);
    assert.ok(stripped);
    assert.strictEqual(stripped.id, testData.south.list[1].items[0].id);
    assert.strictEqual(repository.findItemById(testData.south.list[0].id, testData.south.list[1].items[0].id), null);
  });

  it('should delete item', () => {
    repository.deleteItem(testData.south.list[1].id, testData.south.list[1].items[0].id);
    repository.deleteItem(testData.south.list[1].id, testData.south.list[1].items[1].id);
    assert.strictEqual(repository.findItemById(testData.south.list[1].id, testData.south.list[1].items[0].id), null);
  });

  it('should delete all item by south', () => {
    repository.deleteAllItemsBySouth(testData.south.list[1].id);
    assert.strictEqual(repository.findAllItemsForSouth(testData.south.list[1].id).length, 0);
  });

  it('should disable and enable item', () => {
    repository.disableItem(testData.south.list[0].items[0].id);
    assert.strictEqual(repository.findItemById(testData.south.list[0].id, testData.south.list[0].items[0].id)!.enabled, false);
    repository.enableItem(testData.south.list[0].items[0].id);
    assert.strictEqual(repository.findItemById(testData.south.list[0].id, testData.south.list[0].items[0].id)!.enabled, true);
  });

  it('should save all items without removing existing items', () => {
    const newItem: SouthConnectorItemEntity<SouthItemSettings> = {
      id: '',
      name: 'new item save-all-test',
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
    };
    const itemsToSave: Array<SouthConnectorItemEntity<SouthItemSettings>> = JSON.parse(JSON.stringify(testData.south.list[0].items));
    itemsToSave.push(newItem);
    itemsToSave[0].name = 'updated name';

    repository.saveAllItems(testData.south.list[0].id, itemsToSave, false);

    const results = repository.findAllItemsForSouth(testData.south.list[0].id);
    assert.strictEqual(results.length, 3);

    assert.strictEqual(repository.findItemById(testData.south.list[0].id, testData.south.list[0].items[0].id)!.name, 'updated name');
    // newItem.id is set by saveAllItems
    assert.ok(newItem.id);
    assert.ok(repository.findItemById(testData.south.list[0].id, newItem.id));
  });

  it('should save all items and remove existing items', () => {
    const itemsToSave: Array<SouthConnectorItemEntity<SouthItemSettings>> = JSON.parse(JSON.stringify(testData.south.list[0].items)).map(
      (item: SouthConnectorItemEntity<SouthItemSettings>) => ({ ...item, id: '' })
    );
    const newItem: SouthConnectorItemEntity<SouthItemSettings> = {
      id: '',
      name: 'new item for replace',
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
    };
    itemsToSave.push(newItem);

    repository.saveAllItems(testData.south.list[0].id, itemsToSave, true);

    const results = repository.findAllItemsForSouth(testData.south.list[0].id);
    assert.strictEqual(results.length, itemsToSave.length);
    // All items get their IDs set after saveAllItems
    for (const item of itemsToSave) {
      assert.ok(item.id);
      assert.ok(repository.findItemById(testData.south.list[0].id, item.id));
    }
  });

  it('should save south connector with items that have groups', () => {
    const groupRepository = new SouthItemGroupRepository(database);

    const group = groupRepository.create(
      {
        name: 'Test Group For South',
        southId: testData.south.list[0].id,
        scanMode: testData.scanMode.list[0],
        overlap: null,
        maxReadInterval: null,
        readDelay: 0
      },
      'userTest'
    );

    const southWithGroups: SouthConnectorEntity<SouthSettings, SouthItemSettings> = JSON.parse(JSON.stringify(testData.south.list[0]));
    const itemWithGroup: SouthConnectorItemEntity<SouthItemSettings> = {
      id: '',
      name: 'item with group test',
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
    southWithGroups.items = [itemWithGroup];
    southWithGroups.groups = [group];

    repository.saveSouth(southWithGroups);

    // itemWithGroup.id is set after save
    assert.ok(itemWithGroup.id);
    const savedItem = repository.findItemById(southWithGroups.id, itemWithGroup.id);
    assert.ok(savedItem);
    assert.strictEqual(savedItem.group!.id, group.id);
  });

  it('should save item with groups', () => {
    const groupRepository = new SouthItemGroupRepository(database);

    const group = groupRepository.create(
      {
        name: 'Test Group 2 For South',
        southId: testData.south.list[0].id,
        scanMode: testData.scanMode.list[0],
        overlap: 10,
        maxReadInterval: null,
        readDelay: 0
      },
      'userTest'
    );

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

    // itemWithGroup.id is set after saveItem
    assert.ok(itemWithGroup.id);
    const savedItem = repository.findItemById(testData.south.list[0].id, itemWithGroup.id);
    assert.ok(savedItem);
    assert.strictEqual(savedItem.group!.id, group.id);
  });

  it('should save and find item with historian fields', () => {
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

    assert.ok(itemWithHistorian.id);
    const savedItem = repository.findItemById(testData.south.list[0].id, itemWithHistorian.id);
    assert.ok(savedItem);
    assert.strictEqual(savedItem.maxReadInterval, 3600);
    assert.strictEqual(savedItem.readDelay, 200);
    assert.strictEqual(savedItem.overlap, 100);
  });

  it('should save item with empty groups array', () => {
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

    assert.ok(itemWithEmptyGroups.id);
    const savedItem = repository.findItemById(testData.south.list[0].id, itemWithEmptyGroups.id);
    assert.ok(savedItem);
    assert.strictEqual(savedItem.group, null);
  });

  it('should move items to a group', () => {
    const groupRepository = new SouthItemGroupRepository(database);

    const group = groupRepository.create(
      {
        name: 'Move Group',
        southId: testData.south.list[0].id,
        scanMode: testData.scanMode.list[0],
        overlap: null,
        maxReadInterval: null,
        readDelay: 0
      },
      'userTest'
    );

    const existingItems = repository.findAllItemsForSouth(testData.south.list[0].id);
    assert.ok(existingItems.length > 0);

    const itemIds = existingItems.slice(0, 2).map(item => item.id);
    repository.moveItemsToGroup(itemIds, group.id);

    const itemsAfterMove = repository.findAllItemsForSouth(testData.south.list[0].id);
    const movedItems = itemsAfterMove.filter(item => itemIds.includes(item.id));
    for (const item of movedItems) {
      assert.strictEqual(item.group!.id, group.id);
    }
  });

  it('should remove items from groups when groupId is null', () => {
    const groupRepository = new SouthItemGroupRepository(database);

    const group = groupRepository.create(
      {
        name: 'Remove Group',
        southId: testData.south.list[0].id,
        scanMode: testData.scanMode.list[0],
        overlap: null,
        maxReadInterval: null,
        readDelay: 0
      },
      'userTest'
    );

    const existingItems = repository.findAllItemsForSouth(testData.south.list[0].id);
    assert.ok(existingItems.length > 0);

    const itemIds = existingItems.slice(0, 1).map(item => item.id);
    repository.moveItemsToGroup(itemIds, group.id);

    let itemsInGroup = repository.findAllItemsForSouth(testData.south.list[0].id);
    let itemInGroup = itemsInGroup.find(item => itemIds.includes(item.id));
    assert.notStrictEqual(itemInGroup!.group, null);

    repository.moveItemsToGroup(itemIds, null);

    itemsInGroup = repository.findAllItemsForSouth(testData.south.list[0].id);
    itemInGroup = itemsInGroup.find(item => itemIds.includes(item.id));
    assert.strictEqual(itemInGroup!.group, null);
  });

  it('should handle empty itemIds array in moveItemsToGroup', () => {
    assert.doesNotThrow(() => repository.moveItemsToGroup([], 'someGroupId'));
    assert.doesNotThrow(() => repository.moveItemsToGroup([], null));
  });
});
