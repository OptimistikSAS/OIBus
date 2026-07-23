import { before, after, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Database } from 'better-sqlite3';
import { emptyDatabase, initDatabase, stripAuditFields } from '../../tests/utils/test-utils';
import testData from '../../tests/utils/test-data';
import SouthConnectorRepository from './south-connector.repository';
import SouthItemGroupRepository from './south-item-group.repository';
import { SouthConnectorEntity, SouthConnectorItemEntity, SouthItemGroupEntityLight } from '../../model/south-connector.model';
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
    assert.deepStrictEqual(stripAuditFields(repository.findSouthById(testData.south.list[0].id)), stripAuditFields(testData.south.list[0]));
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
      startTimeOffset: null,
      endTimeOffset: null,
      recoveryStrategy: null
    };
    newSouthConnector.items = [...testData.south.list[1].items, newItem];
    repository.saveSouth(newSouthConnector);

    const updatedConnector = repository.findSouthById(newSouthConnector.id)!;
    assert.strictEqual(updatedConnector.items.length, 3);
  });

  it('should update a south connector item with non-null historian fields', () => {
    const connector: SouthConnectorEntity<SouthSettings, SouthItemSettings> = JSON.parse(JSON.stringify(testData.south.list[0]));
    connector.items = connector.items.map((item, index) =>
      index === 0
        ? { ...item, maxReadInterval: 3600, readDelay: 200, startTimeOffset: 100, endTimeOffset: null, recoveryStrategy: null }
        : item
    );
    repository.saveSouth(connector);

    const updatedConnector = repository.findSouthById(connector.id)!;
    const updatedItem = updatedConnector.items.find(item => item.id === connector.items[0].id)!;
    assert.strictEqual(updatedItem.maxReadInterval, 3600);
    assert.strictEqual(updatedItem.readDelay, 200);
    assert.strictEqual(updatedItem.startTimeOffset, 100);
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
      repository.searchItems(testData.south.list[1].id, { name: undefined, scanModeId: undefined, enabled: undefined, page: 0 })
        .totalElements,
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
      startTimeOffset: null,
      endTimeOffset: null,
      recoveryStrategy: null
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
      startTimeOffset: null,
      endTimeOffset: null,
      recoveryStrategy: null
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
        startTimeOffset: null,
        endTimeOffset: null,
        recoveryStrategy: null,
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
      startTimeOffset: null,
      endTimeOffset: null,
      recoveryStrategy: null,
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
        startTimeOffset: 10,
        endTimeOffset: null,
        recoveryStrategy: null,
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
      startTimeOffset: null,
      endTimeOffset: null,
      recoveryStrategy: null,
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
      startTimeOffset: 100,
      endTimeOffset: null,
      recoveryStrategy: null,
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
    assert.strictEqual(savedItem.startTimeOffset, 100);
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
      startTimeOffset: null,
      endTimeOffset: null,
      recoveryStrategy: null,
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
        startTimeOffset: null,
        endTimeOffset: null,
        recoveryStrategy: null,
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
        startTimeOffset: null,
        endTimeOffset: null,
        recoveryStrategy: null,
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

  it('should save south connector and replace temp group IDs with real IDs', () => {
    const south: SouthConnectorEntity<SouthSettings, SouthItemSettings> = JSON.parse(JSON.stringify(testData.south.list[0]));

    const tempGroup: SouthItemGroupEntityLight = {
      id: 'temp_newgroup',
      name: 'Temp Created Group',
      scanMode: testData.scanMode.list[0],
      startTimeOffset: null,
      endTimeOffset: null,
      recoveryStrategy: null,
      maxReadInterval: null,
      readDelay: 0,
      createdBy: '',
      updatedBy: '',
      createdAt: '',
      updatedAt: ''
    };

    const itemWithTempGroup: SouthConnectorItemEntity<SouthItemSettings> = {
      id: '',
      name: 'item-with-temp-group',
      enabled: true,
      scanMode: testData.scanMode.list[0],
      settings: {} as SouthItemSettings,
      group: { ...tempGroup },
      syncWithGroup: true,
      maxReadInterval: null,
      readDelay: null,
      startTimeOffset: null,
      endTimeOffset: null,
      recoveryStrategy: null,
      createdBy: '',
      updatedBy: '',
      createdAt: '',
      updatedAt: ''
    };

    south.groups = [tempGroup];
    south.items = [itemWithTempGroup];

    repository.saveSouth(south);

    // After save, the temp group ID is replaced with a real generated ID
    assert.ok(!itemWithTempGroup.group!.id.startsWith('temp_'));
    assert.ok(itemWithTempGroup.id);

    const savedItem = repository.findItemById(south.id, itemWithTempGroup.id);
    assert.ok(savedItem);
    assert.ok(savedItem.group);
    assert.notStrictEqual(savedItem.group.id, 'temp_newgroup');
  });

  it('should find scan mode for south', () => {
    const result = repository.findScanModeForSouth(testData.scanMode.list[0].id);

    assert.strictEqual(result.id, testData.scanMode.list[0].id);
    assert.strictEqual(result.name, testData.scanMode.list[0].name);
    assert.strictEqual(result.cron, testData.scanMode.list[0].cron);
  });

  it('should find groups by south id', () => {
    const groupRepository = new SouthItemGroupRepository(database);
    groupRepository.create(
      {
        name: 'Test Group For Find',
        southId: testData.south.list[0].id,
        scanMode: testData.scanMode.list[0],
        startTimeOffset: null,
        endTimeOffset: null,
        recoveryStrategy: null,
        maxReadInterval: null,
        readDelay: 0
      },
      'userTest'
    );

    const groups = repository.findGroupBySouthId(testData.south.list[0].id);

    assert.ok(Array.isArray(groups));
    assert.ok(groups.length > 0);
    assert.ok(groups.some(g => g.name === 'Test Group For Find'));
    assert.ok(groups.every(g => g.scanMode !== null));
  });

  it('should update existing group properties when saving the south connector', () => {
    const groupRepository = new SouthItemGroupRepository(database);

    // Create a real group with the first scan mode
    const group = groupRepository.create(
      {
        name: 'Group To Update',
        southId: testData.south.list[0].id,
        scanMode: testData.scanMode.list[0],
        startTimeOffset: null,
        endTimeOffset: null,
        recoveryStrategy: null,
        maxReadInterval: null,
        readDelay: 0
      },
      'userTest'
    );

    const south: SouthConnectorEntity<SouthSettings, SouthItemSettings> = JSON.parse(JSON.stringify(testData.south.list[0]));
    south.items = [];

    // Mutate the group (new name, different scan mode, new history settings)
    const updatedGroup: SouthItemGroupEntityLight = {
      ...group,
      name: 'Updated Group Name',
      scanMode: testData.scanMode.list[1],
      startTimeOffset: 500,
      endTimeOffset: null,
      recoveryStrategy: null,
      maxReadInterval: 3600,
      readDelay: 200
    };
    south.groups = [updatedGroup];
    south.updatedBy = 'updateUser';

    repository.saveSouth(south);

    const savedGroup = groupRepository.findById(group.id);
    assert.ok(savedGroup, 'Group should still exist after saveSouth');
    assert.strictEqual(savedGroup.name, 'Updated Group Name');
    assert.strictEqual(savedGroup.scanMode.id, testData.scanMode.list[1].id);
    assert.strictEqual(savedGroup.startTimeOffset, 500);
    assert.strictEqual(savedGroup.maxReadInterval, 3600);
    assert.strictEqual(savedGroup.readDelay, 200);
  });

  it('should delete a group and fill empty scan mode and history fields on its items', () => {
    const groupRepository = new SouthItemGroupRepository(database);
    const group = groupRepository.create(
      {
        name: 'Group To Delete With Fallback',
        southId: testData.south.list[0].id,
        scanMode: testData.scanMode.list[0],
        startTimeOffset: 100,
        endTimeOffset: 50,
        maxReadInterval: 3600,
        readDelay: 200,
        recoveryStrategy: 'oldest'
      },
      'userTest'
    );

    const itemWithEmptyFields: SouthConnectorItemEntity<SouthItemSettings> = {
      id: '',
      name: 'item-inheriting-from-group',
      enabled: true,
      scanMode: null,
      settings: {} as SouthItemSettings,
      group,
      syncWithGroup: true,
      maxReadInterval: null,
      readDelay: null,
      startTimeOffset: null,
      endTimeOffset: null,
      recoveryStrategy: null,
      createdBy: '',
      updatedBy: '',
      createdAt: '',
      updatedAt: ''
    };
    repository.saveItem(testData.south.list[0].id, itemWithEmptyFields);

    repository.deleteGroupAndUpdateItems(testData.south.list[0].id, group, true);

    assert.strictEqual(groupRepository.findById(group.id), null);
    const savedItem = repository.findItemById(testData.south.list[0].id, itemWithEmptyFields.id)!;
    assert.strictEqual(savedItem.group, null);
    assert.strictEqual(savedItem.syncWithGroup, false);
    assert.strictEqual(savedItem.scanMode!.id, group.scanMode.id);
    assert.strictEqual(savedItem.startTimeOffset, 100);
    assert.strictEqual(savedItem.endTimeOffset, 50);
    assert.strictEqual(savedItem.maxReadInterval, 3600);
    assert.strictEqual(savedItem.readDelay, 200);
    assert.strictEqual(savedItem.recoveryStrategy, 'oldest');
  });

  it('should not overwrite an item own scan mode and history fields when deleting its group', () => {
    const groupRepository = new SouthItemGroupRepository(database);
    const group = groupRepository.create(
      {
        name: 'Group To Delete Without Fallback',
        southId: testData.south.list[0].id,
        scanMode: testData.scanMode.list[0],
        startTimeOffset: 100,
        endTimeOffset: 50,
        maxReadInterval: 3600,
        readDelay: 200,
        recoveryStrategy: 'oldest'
      },
      'userTest'
    );

    const itemWithOwnFields: SouthConnectorItemEntity<SouthItemSettings> = {
      id: '',
      name: 'item-with-own-fields',
      enabled: true,
      scanMode: testData.scanMode.list[1],
      settings: {} as SouthItemSettings,
      group,
      syncWithGroup: false,
      maxReadInterval: 60,
      readDelay: 50,
      startTimeOffset: 10,
      endTimeOffset: 20,
      recoveryStrategy: 'newest',
      createdBy: '',
      updatedBy: '',
      createdAt: '',
      updatedAt: ''
    };
    repository.saveItem(testData.south.list[0].id, itemWithOwnFields);

    repository.deleteGroupAndUpdateItems(testData.south.list[0].id, group, true);

    const savedItem = repository.findItemById(testData.south.list[0].id, itemWithOwnFields.id)!;
    assert.strictEqual(savedItem.group, null);
    assert.strictEqual(savedItem.scanMode!.id, testData.scanMode.list[1].id);
    assert.strictEqual(savedItem.maxReadInterval, 60);
    assert.strictEqual(savedItem.readDelay, 50);
    assert.strictEqual(savedItem.startTimeOffset, 10);
    assert.strictEqual(savedItem.endTimeOffset, 20);
    assert.strictEqual(savedItem.recoveryStrategy, 'newest');
  });

  it('should not fill history fields when the connector does not support history', () => {
    const groupRepository = new SouthItemGroupRepository(database);
    const group = groupRepository.create(
      {
        name: 'Group To Delete No History',
        southId: testData.south.list[0].id,
        scanMode: testData.scanMode.list[0],
        startTimeOffset: 100,
        endTimeOffset: 50,
        maxReadInterval: 3600,
        readDelay: 200,
        recoveryStrategy: 'oldest'
      },
      'userTest'
    );

    const itemWithEmptyFields: SouthConnectorItemEntity<SouthItemSettings> = {
      id: '',
      name: 'item-no-history-connector',
      enabled: true,
      scanMode: null,
      settings: {} as SouthItemSettings,
      group,
      syncWithGroup: true,
      maxReadInterval: null,
      readDelay: null,
      startTimeOffset: null,
      endTimeOffset: null,
      recoveryStrategy: null,
      createdBy: '',
      updatedBy: '',
      createdAt: '',
      updatedAt: ''
    };
    repository.saveItem(testData.south.list[0].id, itemWithEmptyFields);

    repository.deleteGroupAndUpdateItems(testData.south.list[0].id, group, false);

    const savedItem = repository.findItemById(testData.south.list[0].id, itemWithEmptyFields.id)!;
    assert.strictEqual(savedItem.scanMode!.id, group.scanMode.id);
    assert.strictEqual(savedItem.maxReadInterval, null);
    assert.strictEqual(savedItem.readDelay, null);
    assert.strictEqual(savedItem.startTimeOffset, null);
    assert.strictEqual(savedItem.endTimeOffset, null);
    assert.strictEqual(savedItem.recoveryStrategy, null);
  });

  it('should not bump updated_at when saving a south connector with an item that has not changed', () => {
    const newSouthConnector: SouthConnectorEntity<SouthSettings, SouthItemSettings> = JSON.parse(JSON.stringify(testData.south.list[0]));
    newSouthConnector.id = '';
    newSouthConnector.name = 'unchanged item connector';
    newSouthConnector.items = [
      {
        id: '',
        name: 'stable item',
        enabled: true,
        scanMode: testData.scanMode.list[0],
        settings: {} as SouthItemSettings,
        group: null,
        syncWithGroup: false,
        maxReadInterval: null,
        readDelay: null,
        startTimeOffset: null,
        endTimeOffset: null,
        recoveryStrategy: null,
        createdBy: '',
        updatedBy: '',
        createdAt: '',
        updatedAt: ''
      }
    ];
    repository.saveSouth(newSouthConnector);
    const itemId = newSouthConnector.items[0].id;

    database.prepare(`UPDATE south_items SET updated_at = '2000-01-01T00:00:00Z' WHERE id = ?;`).run(itemId);

    const resavedSouthConnector: SouthConnectorEntity<SouthSettings, SouthItemSettings> = JSON.parse(JSON.stringify(newSouthConnector));
    repository.saveSouth(resavedSouthConnector);

    const row = database.prepare(`SELECT updated_at FROM south_items WHERE id = ?;`).get(itemId) as { updated_at: string };
    assert.strictEqual(row.updated_at, '2000-01-01T00:00:00Z');
  });

  it('should bump updated_at when saving a south connector with an item that has changed', () => {
    const newSouthConnector: SouthConnectorEntity<SouthSettings, SouthItemSettings> = JSON.parse(JSON.stringify(testData.south.list[0]));
    newSouthConnector.id = '';
    newSouthConnector.name = 'changed item connector';
    newSouthConnector.items = [
      {
        id: '',
        name: 'item to rename',
        enabled: true,
        scanMode: testData.scanMode.list[0],
        settings: {} as SouthItemSettings,
        group: null,
        syncWithGroup: false,
        maxReadInterval: null,
        readDelay: null,
        startTimeOffset: null,
        endTimeOffset: null,
        recoveryStrategy: null,
        createdBy: '',
        updatedBy: '',
        createdAt: '',
        updatedAt: ''
      }
    ];
    repository.saveSouth(newSouthConnector);
    const itemId = newSouthConnector.items[0].id;

    database.prepare(`UPDATE south_items SET updated_at = '2000-01-01T00:00:00Z' WHERE id = ?;`).run(itemId);

    const changedSouthConnector: SouthConnectorEntity<SouthSettings, SouthItemSettings> = JSON.parse(JSON.stringify(newSouthConnector));
    changedSouthConnector.items[0].name = 'renamed item';
    repository.saveSouth(changedSouthConnector);

    const row = database.prepare(`SELECT updated_at FROM south_items WHERE id = ?;`).get(itemId) as { updated_at: string };
    assert.notStrictEqual(row.updated_at, '2000-01-01T00:00:00Z');
  });
});
