import { before, after, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Database } from 'better-sqlite3';
import { createAuditServiceMock, emptyDatabase, initDatabase, stripAuditFields } from '../../tests/utils/test-utils';
import testData from '../../tests/utils/test-data';
import SouthConnectorRepository, { toItemEntityFromJoinedRow, toSouthItemGroupLight } from './south-connector.repository';
import SouthItemGroupRepository from './south-item-group.repository';
import ConfigurationWorkflowRepository from './configuration-workflow.repository';
import { SouthConnectorEntity, SouthConnectorItemEntity, SouthItemGroupEntityLight } from '../../model/south-connector.model';
import { SouthItemSettings, SouthSettings } from '../../../shared/model/south-settings.model';
import { mock } from 'node:test';
import AuditService from '../../service/audit.service';
import { NotFoundError } from '../../model/types';

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
  let auditService: AuditService;

  beforeEach(() => {
    auditService = createAuditServiceMock();
    repository = new SouthConnectorRepository(database, auditService);
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

  it('should properly get full south connectors in a single bulk call', () => {
    // Exercises findAllSouthFull (used by config export instead of findAllSouth + one
    // findSouthById round-trip per connector) and confirms it returns exactly what
    // findSouthById would for every connector, items/groups included.
    const result = repository.findAllSouthFull();
    for (const element of testData.south.list) {
      const found = result.find(r => r.id === element.id);
      assert.ok(found, `South connector ${element.id} not found`);
      assert.deepStrictEqual(stripAuditFields(found), stripAuditFields(repository.findSouthById(element.id)));
    }
  });

  it('should properly get a south connector', () => {
    assert.deepStrictEqual(stripAuditFields(repository.findSouthById(testData.south.list[0].id)), stripAuditFields(testData.south.list[0]));
    assert.strictEqual(repository.findSouthById('badId'), null);
  });

  it('should reject an update whose target id does not exist, instead of silently creating it', () => {
    // Simulates the race this repository is meant to close: a caller believes it's updating an
    // existing connector (isNewConnector: false), but the row is gone — e.g. deleted by another
    // request during this caller's own earlier async validation. This must fail loudly rather than
    // resurrecting the connector under `isNewConnector`'s old "does a row exist" inference.
    const ghost: SouthConnectorEntity<SouthSettings, SouthItemSettings> = JSON.parse(JSON.stringify(testData.south.list[0]));
    ghost.id = 'south-id-that-does-not-exist';

    assert.throws(() => repository.saveSouth(ghost, false), NotFoundError);
    assert.strictEqual(repository.findSouthById('south-id-that-does-not-exist'), null);
  });

  it('should save a new south connector', () => {
    const newSouthConnector: SouthConnectorEntity<SouthSettings, SouthItemSettings> = JSON.parse(JSON.stringify(testData.south.list[0]));
    newSouthConnector.id = '';
    newSouthConnector.name = 'new connector';
    newSouthConnector.items = [];
    repository.saveSouth(newSouthConnector, true);

    assert.ok(newSouthConnector.id);
    const createdConnector = repository.findSouthById(newSouthConnector.id)!;
    assert.strictEqual(createdConnector.id, newSouthConnector.id);
    assert.strictEqual(createdConnector.name, 'new connector');
    assert.strictEqual(createdConnector.items.length, 0);

    const recordMock = auditService.record as unknown as ReturnType<typeof mock.fn>;
    const connectorCalls = recordMock.mock.calls.filter(call => call.arguments[0] === 'south_connector');
    assert.strictEqual(connectorCalls.length, 1);
    assert.deepStrictEqual(connectorCalls[0].arguments, [
      'south_connector',
      newSouthConnector.id,
      'CREATE',
      null,
      { ...createdConnector, settings: { ...createdConnector.settings, password: '' } },
      newSouthConnector.updatedBy
    ]);
    // The connector's secret settings field must never be persisted in the audit trail
    assert.notStrictEqual(
      (connectorCalls[0].arguments[4] as { settings: { password: string } }).settings.password,
      (createdConnector.settings as unknown as { password: string }).password
    );
  });

  it('should preserve caller-supplied ids for the connector, its groups and its items (config import)', () => {
    const southConnector: SouthConnectorEntity<SouthSettings, SouthItemSettings> = JSON.parse(JSON.stringify(testData.south.list[0]));
    southConnector.id = 'preserved-south-id';
    southConnector.name = 'preserved south connector';
    southConnector.groups = [
      {
        id: 'preserved-group-id',
        name: 'preserved group',
        scanMode: testData.scanMode.list[0],
        startTimeOffset: null,
        endTimeOffset: null,
        maxReadInterval: null,
        readDelay: 0,
        recoveryStrategy: null,
        cachingStrategy: null,
        createdBy: '',
        updatedBy: '',
        createdAt: '',
        updatedAt: ''
      }
    ];
    southConnector.items = [
      {
        id: 'preserved-item-id',
        name: 'preserved item',
        enabled: true,
        scanMode: testData.scanMode.list[0],
        settings: {} as SouthItemSettings,
        group: { id: 'preserved-group-id' } as SouthItemGroupEntityLight,
        syncWithGroup: true,
        maxReadInterval: null,
        readDelay: null,
        startTimeOffset: null,
        endTimeOffset: null,
        recoveryStrategy: null,
        cachingStrategy: null,
        thresholdType: null,
        threshold: null,
        rangeLow: null,
        rangeHigh: null,
        maxCachingInterval: null,
        createdBy: '',
        updatedBy: '',
        createdAt: '',
        updatedAt: ''
      }
    ];

    repository.saveSouth(southConnector, true);

    assert.strictEqual(southConnector.id, 'preserved-south-id');
    const created = repository.findSouthById('preserved-south-id');
    assert.ok(created);
    assert.strictEqual(created.groups.length, 1);
    assert.strictEqual(created.groups[0].id, 'preserved-group-id');
    assert.strictEqual(created.items.length, 1);
    assert.strictEqual(created.items[0].id, 'preserved-item-id');
    assert.strictEqual(created.items[0].group!.id, 'preserved-group-id');
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
      recoveryStrategy: null,
      cachingStrategy: null,
      thresholdType: null,
      threshold: null,
      rangeLow: null,
      rangeHigh: null,
      maxCachingInterval: null
    };
    newSouthConnector.items = [...testData.south.list[1].items, newItem];
    const beforeConnector = repository.findSouthById(newSouthConnector.id);
    repository.saveSouth(newSouthConnector, false);

    const updatedConnector = repository.findSouthById(newSouthConnector.id)!;
    assert.strictEqual(updatedConnector.items.length, 3);

    const recordMock = auditService.record as unknown as ReturnType<typeof mock.fn>;
    const connectorCalls = recordMock.mock.calls.filter(call => call.arguments[0] === 'south_connector');
    assert.strictEqual(connectorCalls.length, 1);
    assert.deepStrictEqual(connectorCalls[0].arguments, [
      'south_connector',
      newSouthConnector.id,
      'UPDATE',
      { ...beforeConnector, settings: { ...beforeConnector!.settings, password: '' } },
      { ...updatedConnector, settings: { ...updatedConnector.settings, password: '' } },
      newSouthConnector.updatedBy
    ]);
    // The connector's secret settings field must never be persisted in the audit trail, before or after
    assert.strictEqual((connectorCalls[0].arguments[3] as { settings: { password: string } }).settings.password, '');
    assert.strictEqual((connectorCalls[0].arguments[4] as { settings: { password: string } }).settings.password, '');
    assert.notStrictEqual(
      (connectorCalls[0].arguments[4] as { settings: { password: string } }).settings.password,
      (updatedConnector.settings as unknown as { password: string }).password
    );

    const itemCreateCalls = recordMock.mock.calls.filter(call => call.arguments[0] === 'south_item' && call.arguments[2] === 'CREATE');
    assert.strictEqual(itemCreateCalls.length, 1);
    assert.strictEqual(itemCreateCalls[0].arguments[1], newItem.id);
  });

  it('should update a south connector item with non-null historian fields', () => {
    const connector: SouthConnectorEntity<SouthSettings, SouthItemSettings> = JSON.parse(JSON.stringify(testData.south.list[0]));
    connector.items = connector.items.map((item, index) =>
      index === 0
        ? { ...item, maxReadInterval: 3600, readDelay: 200, startTimeOffset: 100, endTimeOffset: null, recoveryStrategy: null }
        : item
    );
    const beforeItem = repository.findItemById(connector.id, connector.items[0].id);
    repository.saveSouth(connector, false);

    const updatedConnector = repository.findSouthById(connector.id)!;
    const updatedItem = updatedConnector.items.find(item => item.id === connector.items[0].id)!;
    assert.strictEqual(updatedItem.maxReadInterval, 3600);
    assert.strictEqual(updatedItem.readDelay, 200);
    assert.strictEqual(updatedItem.startTimeOffset, 100);

    const recordMock = auditService.record as unknown as ReturnType<typeof mock.fn>;
    const itemUpdateCalls = recordMock.mock.calls.filter(
      call => call.arguments[0] === 'south_item' && call.arguments[1] === connector.items[0].id && call.arguments[2] === 'UPDATE'
    );
    assert.strictEqual(itemUpdateCalls.length, 1);
    assert.deepStrictEqual(itemUpdateCalls[0].arguments[3], beforeItem);

    // A second save of the same unchanged connector must not re-audit the untouched item
    recordMock.mock.resetCalls();
    const resaved: SouthConnectorEntity<SouthSettings, SouthItemSettings> = JSON.parse(JSON.stringify(updatedConnector));
    repository.saveSouth(resaved, false);
    const secondItemCalls = recordMock.mock.calls.filter(
      call => call.arguments[0] === 'south_item' && call.arguments[1] === connector.items[0].id
    );
    assert.strictEqual(secondItemCalls.length, 0);
  });

  it('should delete a south connector', () => {
    // Save a new connector first to delete it
    const newSouthConnector: SouthConnectorEntity<SouthSettings, SouthItemSettings> = JSON.parse(JSON.stringify(testData.south.list[0]));
    newSouthConnector.id = '';
    newSouthConnector.name = 'to be deleted';
    newSouthConnector.items = [];
    repository.saveSouth(newSouthConnector, true);

    assert.ok(repository.findSouthById(newSouthConnector.id));
    const before = repository.findSouthById(newSouthConnector.id);
    repository.deleteSouth(newSouthConnector.id, 'deleteUser');
    assert.strictEqual(repository.findSouthById(newSouthConnector.id), null);

    const recordMock = auditService.record as unknown as ReturnType<typeof mock.fn>;
    const deleteCall = recordMock.mock.calls.find(
      call => call.arguments[0] === 'south_connector' && call.arguments[1] === newSouthConnector.id && call.arguments[2] === 'DELETE'
    );
    assert.ok(deleteCall);
    assert.deepStrictEqual(deleteCall!.arguments, [
      'south_connector',
      newSouthConnector.id,
      'DELETE',
      { ...before, settings: { ...before!.settings, password: '' } },
      null,
      'deleteUser'
    ]);
  });

  it('should redact an unknown south connector type by returning it as-is (no manifest match)', () => {
    const newSouthConnector: SouthConnectorEntity<SouthSettings, SouthItemSettings> = JSON.parse(JSON.stringify(testData.south.list[0]));
    newSouthConnector.id = '';
    newSouthConnector.name = 'south with unknown type';
    newSouthConnector.type = 'not-a-real-south-type' as typeof newSouthConnector.type;
    newSouthConnector.items = [];
    repository.saveSouth(newSouthConnector, true);

    const recordMock = auditService.record as unknown as ReturnType<typeof mock.fn>;
    recordMock.mock.resetCalls();
    repository.deleteSouth(newSouthConnector.id, 'deleteUser');

    const deleteCall = recordMock.mock.calls.find(
      call => call.arguments[0] === 'south_connector' && call.arguments[1] === newSouthConnector.id && call.arguments[2] === 'DELETE'
    );
    assert.ok(deleteCall);
    // With no manifest for this type, redactConnector must return the entity untouched rather than filtering secrets.
    assert.strictEqual((deleteCall!.arguments[3] as { type: string }).type, 'not-a-real-south-type');
  });

  it('should redact an item under an unknown south connector type by returning it as-is (no manifest match)', () => {
    const newSouthConnector: SouthConnectorEntity<SouthSettings, SouthItemSettings> = JSON.parse(JSON.stringify(testData.south.list[1]));
    newSouthConnector.id = '';
    newSouthConnector.name = 'south with unknown type and an item';
    newSouthConnector.type = 'not-a-real-south-type' as typeof newSouthConnector.type;
    newSouthConnector.items = [
      { ...(testData.south.list[1].items[0] as SouthConnectorItemEntity<SouthItemSettings>), id: '', name: 'unknown-type-item' }
    ];
    repository.saveSouth(newSouthConnector, true);

    const created = repository.findSouthById(newSouthConnector.id)!;
    assert.strictEqual(created.items.length, 1);

    const recordMock = auditService.record as unknown as ReturnType<typeof mock.fn>;
    recordMock.mock.resetCalls();
    repository.deleteItem(newSouthConnector.id, created.items[0].id, 'deleteUser');

    const deleteCall = recordMock.mock.calls.find(
      call => call.arguments[0] === 'south_item' && call.arguments[1] === created.items[0].id && call.arguments[2] === 'DELETE'
    );
    assert.ok(deleteCall);
    // With no manifest for this type, redactItem must return the entity untouched rather than filtering secrets.
    assert.strictEqual((deleteCall!.arguments[3] as { name: string }).name, 'unknown-type-item');
  });

  it('should audit deleted items and groups when deleting a south connector', () => {
    // First save a bare connector to get a real generated id
    const newSouthConnector: SouthConnectorEntity<SouthSettings, SouthItemSettings> = JSON.parse(JSON.stringify(testData.south.list[0]));
    newSouthConnector.id = '';
    newSouthConnector.name = 'to be deleted with items and groups';
    newSouthConnector.groups = [];
    newSouthConnector.items = [];
    repository.saveSouth(newSouthConnector, true);

    // Attach a temp group (created with the correct southId as part of the save) and an item using it
    const tempGroup: SouthItemGroupEntityLight = {
      id: 'temp_deleteSouthAudit',
      name: 'Group For Delete South Audit',
      scanMode: testData.scanMode.list[0],
      startTimeOffset: null,
      endTimeOffset: null,
      recoveryStrategy: null,
      cachingStrategy: null,
      maxReadInterval: null,
      readDelay: 0,
      createdBy: '',
      updatedBy: '',
      createdAt: '',
      updatedAt: ''
    };
    newSouthConnector.groups = [tempGroup];
    newSouthConnector.items = [
      {
        id: '',
        name: 'item to delete with south',
        enabled: true,
        scanMode: testData.scanMode.list[0],
        settings: {} as SouthItemSettings,
        group: { ...tempGroup },
        syncWithGroup: false,
        maxReadInterval: null,
        readDelay: null,
        startTimeOffset: null,
        endTimeOffset: null,
        recoveryStrategy: null,
        cachingStrategy: null,
        thresholdType: null,
        threshold: null,
        rangeLow: null,
        rangeHigh: null,
        maxCachingInterval: null,
        createdBy: '',
        updatedBy: '',
        createdAt: '',
        updatedAt: ''
      }
    ];
    repository.saveSouth(newSouthConnector, false);
    const before = repository.findSouthById(newSouthConnector.id)!;
    assert.strictEqual(before.items.length, 1);
    assert.strictEqual(before.groups.length, 1);

    const recordMock = auditService.record as unknown as ReturnType<typeof mock.fn>;
    recordMock.mock.resetCalls();

    repository.deleteSouth(newSouthConnector.id, 'deleteUser');

    const itemDeleteCall = recordMock.mock.calls.find(
      call => call.arguments[0] === 'south_item' && call.arguments[1] === before.items[0].id && call.arguments[2] === 'DELETE'
    );
    assert.ok(itemDeleteCall);
    assert.strictEqual(itemDeleteCall!.arguments[5], 'deleteUser');

    const groupDeleteCall = recordMock.mock.calls.find(
      call => call.arguments[0] === 'south_item_group' && call.arguments[1] === before.groups[0].id && call.arguments[2] === 'DELETE'
    );
    assert.ok(groupDeleteCall);
    assert.strictEqual(groupDeleteCall!.arguments[5], 'deleteUser');

    const connectorDeleteCall = recordMock.mock.calls.find(
      call => call.arguments[0] === 'south_connector' && call.arguments[1] === newSouthConnector.id && call.arguments[2] === 'DELETE'
    );
    assert.ok(connectorDeleteCall);
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
    const before0 = repository.findItemById(testData.south.list[1].id, testData.south.list[1].items[0].id);
    repository.deleteItem(testData.south.list[1].id, testData.south.list[1].items[0].id, 'deleteUser');
    repository.deleteItem(testData.south.list[1].id, testData.south.list[1].items[1].id, 'deleteUser');
    assert.strictEqual(repository.findItemById(testData.south.list[1].id, testData.south.list[1].items[0].id), null);

    const recordMock = auditService.record as unknown as ReturnType<typeof mock.fn>;
    assert.deepStrictEqual(recordMock.mock.calls[0].arguments, [
      'south_item',
      testData.south.list[1].items[0].id,
      'DELETE',
      before0,
      null,
      'deleteUser'
    ]);
  });

  it('should delete all item by south', () => {
    const beforeItems = repository.findAllItemsForSouth(testData.south.list[1].id);
    repository.deleteAllItemsBySouth(testData.south.list[1].id, 'deleteUser');
    assert.strictEqual(repository.findAllItemsForSouth(testData.south.list[1].id).length, 0);

    const recordMock = auditService.record as unknown as ReturnType<typeof mock.fn>;
    const deleteCalls = recordMock.mock.calls.filter(call => call.arguments[0] === 'south_item' && call.arguments[2] === 'DELETE');
    assert.strictEqual(deleteCalls.length, beforeItems.length);
    for (const item of beforeItems) {
      assert.ok(
        deleteCalls.some(call => call.arguments[1] === item.id && call.arguments[3] !== null && call.arguments[5] === 'deleteUser')
      );
    }
  });

  it('should disable and enable item', () => {
    repository.disableItem(testData.south.list[0].items[0].id);
    assert.strictEqual(repository.findItemById(testData.south.list[0].id, testData.south.list[0].items[0].id)!.enabled, false);
    repository.enableItem(testData.south.list[0].items[0].id);
    assert.strictEqual(repository.findItemById(testData.south.list[0].id, testData.south.list[0].items[0].id)!.enabled, true);
  });

  it('should clear a workflow-set disabled_reason on manual enable/disable', () => {
    const southId = testData.south.list[0].id;
    const itemId = testData.south.list[0].items[0].id;
    repository.disableItemWithReason(southId, itemId, 'No longer found by discovery', 'workflowUser');
    assert.strictEqual(repository.findItemById(southId, itemId)!.disabledReason, 'No longer found by discovery');

    // A person's own manual disable/enable is not the workflow's reason — clear it either way.
    repository.disableItem(itemId);
    assert.strictEqual(repository.findItemById(southId, itemId)!.disabledReason, null);

    repository.disableItemWithReason(southId, itemId, 'No longer found by discovery', 'workflowUser');
    repository.enableItem(itemId);
    assert.strictEqual(repository.findItemById(southId, itemId)!.disabledReason, null);
    assert.strictEqual(repository.findItemById(southId, itemId)!.enabled, true);
  });

  it('should auto-disable an item with a reason and record the audit diff', () => {
    const southId = testData.south.list[0].id;
    const itemId = testData.south.list[0].items[0].id;

    repository.disableItemWithReason(southId, itemId, 'No longer found by discovery', 'workflowUser');

    const found = repository.findItemById(southId, itemId)!;
    assert.strictEqual(found.enabled, false);
    assert.strictEqual(found.disabledReason, 'No longer found by discovery');
    assert.strictEqual(found.updatedBy, 'workflowUser');

    const recordMock = auditService.record as unknown as ReturnType<typeof mock.fn>;
    const call = recordMock.mock.calls.at(-1)!;
    assert.deepStrictEqual(call.arguments.slice(0, 3), ['south_item', itemId, 'UPDATE']);
    assert.strictEqual(call.arguments[5], 'workflowUser');
  });

  it('should claim an item for a workflow and record the audit diff', () => {
    const southId = testData.south.list[0].id;
    const itemId = testData.south.list[0].items[1].id;
    const workflowRepository = new ConfigurationWorkflowRepository(database, auditService);
    const workflow = workflowRepository.create(
      {
        southId,
        targetItemId: null,
        discoveryScope: { rootNodeId: 'ns=1;s=Root' },
        identityKeyFields: ['nodeId'],
        eligibilityFilter: [],
        itemFieldMapping: { name: '{{name}}' },
        remoteFieldMapping: null,
        scanMode: null,
        enabled: true
      },
      'workflowUser'
    );

    repository.claimItemForWorkflow(southId, itemId, workflow.id, 'workflowUser');

    const found = repository.findItemById(southId, itemId)!;
    assert.strictEqual(found.createdByWorkflowId, workflow.id);

    const recordMock = auditService.record as unknown as ReturnType<typeof mock.fn>;
    const call = recordMock.mock.calls.at(-1)!;
    assert.deepStrictEqual(call.arguments.slice(0, 3), ['south_item', itemId, 'UPDATE']);
  });

  it('should clear created_by_workflow_id (not delete the item) when the owning workflow is deleted', () => {
    const southId = testData.south.list[0].id;
    const itemId = testData.south.list[0].items[0].id;
    const workflowRepository = new ConfigurationWorkflowRepository(database, auditService);
    const workflow = workflowRepository.create(
      {
        southId,
        targetItemId: null,
        discoveryScope: {},
        identityKeyFields: [],
        eligibilityFilter: [],
        itemFieldMapping: { name: '{{name}}' },
        remoteFieldMapping: null,
        scanMode: null,
        enabled: true
      },
      'workflowUser'
    );
    repository.claimItemForWorkflow(southId, itemId, workflow.id, 'workflowUser');

    workflowRepository.delete(workflow.id, 'workflowUser');

    const found = repository.findItemById(southId, itemId);
    assert.ok(found, 'the item must survive the owning workflow being deleted');
    assert.strictEqual(found!.createdByWorkflowId, null);
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
      recoveryStrategy: null,
      cachingStrategy: null,
      thresholdType: null,
      threshold: null,
      rangeLow: null,
      rangeHigh: null,
      maxCachingInterval: null
    };
    const itemsToSave: Array<SouthConnectorItemEntity<SouthItemSettings>> = JSON.parse(JSON.stringify(testData.south.list[0].items));
    itemsToSave.push(newItem);
    itemsToSave[0].name = 'updated name';

    repository.saveAllItems(testData.south.list[0].id, itemsToSave, false, 'userTest');

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
      recoveryStrategy: null,
      cachingStrategy: null,
      thresholdType: null,
      threshold: null,
      rangeLow: null,
      rangeHigh: null,
      maxCachingInterval: null
    };
    itemsToSave.push(newItem);

    repository.saveAllItems(testData.south.list[0].id, itemsToSave, true, 'userTest');

    const results = repository.findAllItemsForSouth(testData.south.list[0].id);
    assert.strictEqual(results.length, itemsToSave.length);
    // All items get their IDs set after saveAllItems
    for (const item of itemsToSave) {
      assert.ok(item.id);
      assert.ok(repository.findItemById(testData.south.list[0].id, item.id));
    }
  });

  it('should save south connector with items that have groups', () => {
    const groupRepository = new SouthItemGroupRepository(database, createAuditServiceMock());

    const group = groupRepository.create(
      {
        name: 'Test Group For South',
        southId: testData.south.list[0].id,
        scanMode: testData.scanMode.list[0],
        startTimeOffset: null,
        endTimeOffset: null,
        recoveryStrategy: null,
        cachingStrategy: null,
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
      cachingStrategy: null,
      thresholdType: null,
      threshold: null,
      rangeLow: null,
      rangeHigh: null,
      maxCachingInterval: null,
      createdBy: '',
      updatedBy: '',
      createdAt: '',
      updatedAt: ''
    };
    southWithGroups.items = [itemWithGroup];
    southWithGroups.groups = [group];

    repository.saveSouth(southWithGroups, false);

    // itemWithGroup.id is set after save
    assert.ok(itemWithGroup.id);
    const savedItem = repository.findItemById(southWithGroups.id, itemWithGroup.id);
    assert.ok(savedItem);
    assert.strictEqual(savedItem.group!.id, group.id);
  });

  it('should save item with groups', () => {
    const groupRepository = new SouthItemGroupRepository(database, createAuditServiceMock());

    const group = groupRepository.create(
      {
        name: 'Test Group 2 For South',
        southId: testData.south.list[0].id,
        scanMode: testData.scanMode.list[0],
        startTimeOffset: 10,
        endTimeOffset: null,
        recoveryStrategy: null,
        cachingStrategy: null,
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
      cachingStrategy: null,
      thresholdType: null,
      threshold: null,
      rangeLow: null,
      rangeHigh: null,
      maxCachingInterval: null,
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

    const recordMock = auditService.record as unknown as ReturnType<typeof mock.fn>;
    const createCall = recordMock.mock.calls.find(
      call => call.arguments[0] === 'south_item' && call.arguments[1] === itemWithGroup.id && call.arguments[2] === 'CREATE'
    );
    assert.ok(createCall);
    assert.strictEqual(createCall!.arguments[3], null);
  });

  it('should audit an update via saveItem', () => {
    const item: SouthConnectorItemEntity<SouthItemSettings> = {
      id: '',
      name: 'save-item-update-audit',
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
      cachingStrategy: null,
      thresholdType: null,
      threshold: null,
      rangeLow: null,
      rangeHigh: null,
      maxCachingInterval: null,
      createdBy: '',
      updatedBy: 'creatorUser',
      createdAt: '',
      updatedAt: ''
    };
    repository.saveItem(testData.south.list[0].id, item);
    assert.ok(item.id);
    const beforeUpdate = repository.findItemById(testData.south.list[0].id, item.id);

    const recordMock = auditService.record as unknown as ReturnType<typeof mock.fn>;
    recordMock.mock.resetCalls();

    item.name = 'save-item-update-audit-renamed';
    item.updatedBy = 'updaterUser';
    repository.saveItem(testData.south.list[0].id, item);

    const afterUpdate = repository.findItemById(testData.south.list[0].id, item.id);
    assert.strictEqual(recordMock.mock.calls.length, 1);
    assert.deepStrictEqual(recordMock.mock.calls[0].arguments, ['south_item', item.id, 'UPDATE', beforeUpdate, afterUpdate, 'updaterUser']);
  });

  it('should redact without a manifest (raw before/after) when saveItem is given a southConnectorId whose connector does not exist', () => {
    // saveItem's UPDATE query matches by item id alone (not connector_id), so passing a
    // southConnectorId that doesn't resolve to a real connector still updates the row while making
    // findSouthById(...)?.type resolve to undefined — the only way to reach the "no southType" side
    // of saveItem's audit redaction without breaking referential integrity.
    const item: SouthConnectorItemEntity<SouthItemSettings> = {
      id: '',
      name: 'save-item-unknown-connector',
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
      cachingStrategy: null,
      thresholdType: 'absolute',
      threshold: 10,
      rangeLow: 0,
      rangeHigh: 100,
      maxCachingInterval: 1000,
      createdBy: '',
      updatedBy: 'creatorUser',
      createdAt: '',
      updatedAt: ''
    };
    repository.saveItem(testData.south.list[0].id, item);
    assert.ok(item.id);

    const recordMock = auditService.record as unknown as ReturnType<typeof mock.fn>;
    recordMock.mock.resetCalls();

    item.name = 'save-item-unknown-connector-renamed';
    item.updatedBy = 'updaterUser';
    repository.saveItem('south-connector-id-that-does-not-exist', item);

    assert.strictEqual(recordMock.mock.calls.length, 1);
    const [, , , before, after] = recordMock.mock.calls[0].arguments as [string, string, string, unknown, unknown];
    // No connector resolves for this (wrong) southConnectorId => no southType => no manifest lookup;
    // findItemById(...) itself can't find the row via that same wrong id either, so both sides of the
    // audit entry come back null — the "no southType" ternary branch is what this test targets.
    assert.strictEqual(before, null);
    assert.strictEqual(after, null);
  });

  it('should redact without a manifest (null "before") when the pre-transaction item snapshot cannot resolve an updated item', () => {
    // beforeItemsById is captured via findAllItemsForSouth() *before* saveSouth's transaction opens;
    // the update-path lookup inside the transaction re-queries existingItemsById independently. The
    // only way to desynchronize the two without breaking referential integrity is to stub the
    // pre-transaction snapshot call so it reports no items despite the DB still holding one.
    const freshConnector: SouthConnectorEntity<SouthSettings, SouthItemSettings> = JSON.parse(JSON.stringify(testData.south.list[0]));
    freshConnector.id = '';
    freshConnector.name = 'south for desynced-before-items-snapshot test';
    freshConnector.items = [
      { ...(testData.south.list[0].items[0] as SouthConnectorItemEntity<SouthItemSettings>), id: '', name: 'item-to-desync' }
    ];
    repository.saveSouth(freshConnector, true);
    const southId = freshConnector.id;

    const existingItem = repository.findAllItemsForSouth(southId)[0];
    assert.ok(existingItem);

    const connector = repository.findSouthById(southId)!;
    const updatedConnector: SouthConnectorEntity<SouthSettings, SouthItemSettings> = JSON.parse(JSON.stringify(connector));
    const targetItem = updatedConnector.items.find(i => i.id === existingItem.id)!;
    targetItem.name = 'desynced-before-items-snapshot';

    const recordMock = auditService.record as unknown as ReturnType<typeof mock.fn>;
    recordMock.mock.resetCalls();

    const originalFindAllItemsForSouth = repository.findAllItemsForSouth.bind(repository);
    repository.findAllItemsForSouth = () => [];
    try {
      repository.saveSouth(updatedConnector, false);
    } finally {
      repository.findAllItemsForSouth = originalFindAllItemsForSouth;
    }

    const updateCall = recordMock.mock.calls.find(
      call => call.arguments[0] === 'south_item' && call.arguments[1] === existingItem.id && call.arguments[2] === 'UPDATE'
    );
    assert.ok(updateCall, 'expected an UPDATE audit entry for the desynced item');
    assert.strictEqual(updateCall!.arguments[3], null);
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
      cachingStrategy: null,
      thresholdType: null,
      threshold: null,
      rangeLow: null,
      rangeHigh: null,
      maxCachingInterval: null,
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

  it('should save and find an item with caching strategy fields', () => {
    const itemWithCachingStrategy: SouthConnectorItemEntity<SouthItemSettings> = {
      id: '',
      name: 'item-with-caching-strategy',
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
      cachingStrategy: 'threshold',
      thresholdType: 'percentage',
      threshold: 5,
      rangeLow: 0,
      rangeHigh: 100,
      maxCachingInterval: 60000,
      createdBy: '',
      updatedBy: '',
      createdAt: '',
      updatedAt: ''
    };

    repository.saveItem(testData.south.list[0].id, itemWithCachingStrategy);

    assert.ok(itemWithCachingStrategy.id);
    const savedItem = repository.findItemById(testData.south.list[0].id, itemWithCachingStrategy.id);
    assert.ok(savedItem);
    assert.strictEqual(savedItem.cachingStrategy, 'threshold');
    assert.strictEqual(savedItem.thresholdType, 'percentage');
    assert.strictEqual(savedItem.threshold, 5);
    assert.strictEqual(savedItem.rangeLow, 0);
    assert.strictEqual(savedItem.rangeHigh, 100);
    assert.strictEqual(savedItem.maxCachingInterval, 60000);

    // Updating the item's caching strategy fields must be persisted too
    savedItem.cachingStrategy = 'onChange';
    savedItem.thresholdType = null;
    savedItem.threshold = null;
    savedItem.rangeLow = null;
    savedItem.rangeHigh = null;
    savedItem.maxCachingInterval = null;
    repository.saveItem(testData.south.list[0].id, savedItem);

    const updatedItem = repository.findItemById(testData.south.list[0].id, itemWithCachingStrategy.id)!;
    assert.strictEqual(updatedItem.cachingStrategy, 'onChange');
    assert.strictEqual(updatedItem.thresholdType, null);
    assert.strictEqual(updatedItem.threshold, null);
    assert.strictEqual(updatedItem.rangeLow, null);
    assert.strictEqual(updatedItem.rangeHigh, null);
    assert.strictEqual(updatedItem.maxCachingInterval, null);
  });

  it('should fall back to the group cachingStrategy when the item is synced with its group', () => {
    const groupRepository = new SouthItemGroupRepository(database, createAuditServiceMock());
    const group = groupRepository.create(
      {
        name: 'Group With Caching Strategy',
        southId: testData.south.list[0].id,
        scanMode: testData.scanMode.list[0],
        startTimeOffset: null,
        endTimeOffset: null,
        maxReadInterval: null,
        readDelay: 0,
        recoveryStrategy: null,
        cachingStrategy: 'onChange'
      },
      'userTest'
    );

    const syncedItem: SouthConnectorItemEntity<SouthItemSettings> = {
      id: '',
      name: 'item-synced-with-group-caching-strategy',
      enabled: true,
      scanMode: testData.scanMode.list[0],
      settings: {} as SouthItemSettings,
      group,
      syncWithGroup: true,
      maxReadInterval: null,
      readDelay: null,
      startTimeOffset: null,
      endTimeOffset: null,
      recoveryStrategy: null,
      cachingStrategy: null,
      thresholdType: null,
      threshold: null,
      rangeLow: null,
      rangeHigh: null,
      maxCachingInterval: null,
      createdBy: '',
      updatedBy: '',
      createdAt: '',
      updatedAt: ''
    };
    repository.saveItem(testData.south.list[0].id, syncedItem);

    const savedSyncedItem = repository.findItemById(testData.south.list[0].id, syncedItem.id)!;
    // The item's own column is null, so it falls back to the group's cachingStrategy
    assert.strictEqual(savedSyncedItem.cachingStrategy, 'onChange');

    // An item with its own cachingStrategy set keeps it even when synced with a group
    const itemWithOwnStrategy: SouthConnectorItemEntity<SouthItemSettings> = {
      ...syncedItem,
      id: '',
      name: 'item-synced-but-with-own-caching-strategy',
      cachingStrategy: 'threshold',
      thresholdType: 'absolute',
      threshold: 1
    };
    repository.saveItem(testData.south.list[0].id, itemWithOwnStrategy);
    const savedItemWithOwnStrategy = repository.findItemById(testData.south.list[0].id, itemWithOwnStrategy.id)!;
    assert.strictEqual(savedItemWithOwnStrategy.cachingStrategy, 'threshold');

    // An item not synced with the group never falls back, even if its own value is null
    const unsyncedItem: SouthConnectorItemEntity<SouthItemSettings> = {
      ...syncedItem,
      id: '',
      name: 'item-not-synced-with-group',
      syncWithGroup: false
    };
    repository.saveItem(testData.south.list[0].id, unsyncedItem);
    const savedUnsyncedItem = repository.findItemById(testData.south.list[0].id, unsyncedItem.id)!;
    assert.strictEqual(savedUnsyncedItem.cachingStrategy, null);
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
      cachingStrategy: null,
      thresholdType: null,
      threshold: null,
      rangeLow: null,
      rangeHigh: null,
      maxCachingInterval: null,
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
    const groupRepository = new SouthItemGroupRepository(database, createAuditServiceMock());

    const group = groupRepository.create(
      {
        name: 'Move Group',
        southId: testData.south.list[0].id,
        scanMode: testData.scanMode.list[0],
        startTimeOffset: null,
        endTimeOffset: null,
        recoveryStrategy: null,
        cachingStrategy: null,
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
      // The item's own scan mode must be kept in sync with the group's: it stays a real FK to
      // scan_modes even though it is no longer used for scheduling, so a stale value would silently
      // block deleting the item's previous scan mode later on.
      assert.strictEqual(item.scanMode!.id, group.scanMode.id);
    }
  });

  it('should update an item scan mode to match the group scan mode when moved into a group', () => {
    const groupRepository = new SouthItemGroupRepository(database, createAuditServiceMock());

    const group = groupRepository.create(
      {
        name: 'Move Group With Different Scan Mode',
        southId: testData.south.list[0].id,
        scanMode: testData.scanMode.list[1],
        startTimeOffset: null,
        endTimeOffset: null,
        recoveryStrategy: null,
        maxReadInterval: null,
        cachingStrategy: null,
        readDelay: 0
      },
      'userTest'
    );

    const existingItems = repository.findAllItemsForSouth(testData.south.list[0].id);
    const item = existingItems.find(existingItem => existingItem.scanMode?.id === testData.scanMode.list[0].id);
    assert.ok(item);
    assert.notStrictEqual(item.scanMode!.id, group.scanMode.id);

    repository.moveItemsToGroup([item.id], group.id);

    const movedItem = repository.findItemById(testData.south.list[0].id, item.id);
    assert.ok(movedItem);
    assert.strictEqual(movedItem.scanMode!.id, group.scanMode.id);
  });

  it('should remove items from groups when groupId is null', () => {
    const groupRepository = new SouthItemGroupRepository(database, createAuditServiceMock());

    const group = groupRepository.create(
      {
        name: 'Remove Group',
        southId: testData.south.list[0].id,
        scanMode: testData.scanMode.list[0],
        startTimeOffset: null,
        endTimeOffset: null,
        recoveryStrategy: null,
        cachingStrategy: null,
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
      cachingStrategy: null,
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
      cachingStrategy: null,
      thresholdType: null,
      threshold: null,
      rangeLow: null,
      rangeHigh: null,
      maxCachingInterval: null,
      createdBy: '',
      updatedBy: '',
      createdAt: '',
      updatedAt: ''
    };

    south.groups = [tempGroup];
    south.items = [itemWithTempGroup];

    repository.saveSouth(south, false);

    // After save, the temp group ID is replaced with a real generated ID
    assert.ok(!itemWithTempGroup.group!.id.startsWith('temp_'));
    assert.ok(itemWithTempGroup.id);

    const savedItem = repository.findItemById(south.id, itemWithTempGroup.id);
    assert.ok(savedItem);
    assert.ok(savedItem.group);
    assert.notStrictEqual(savedItem.group.id, 'temp_newgroup');

    const recordMock = auditService.record as unknown as ReturnType<typeof mock.fn>;
    const groupCreateCall = recordMock.mock.calls.find(call => call.arguments[0] === 'south_item_group' && call.arguments[2] === 'CREATE');
    assert.ok(groupCreateCall);
    assert.strictEqual(groupCreateCall!.arguments[1], savedItem.group!.id);
  });

  it('should find scan mode for south', () => {
    const result = repository.findScanModeForSouth(testData.scanMode.list[0].id);

    assert.strictEqual(result.id, testData.scanMode.list[0].id);
    assert.strictEqual(result.name, testData.scanMode.list[0].name);
    assert.strictEqual(result.cron, testData.scanMode.list[0].cron);
  });

  it('should find groups by south id', () => {
    const groupRepository = new SouthItemGroupRepository(database, createAuditServiceMock());
    groupRepository.create(
      {
        name: 'Test Group For Find',
        southId: testData.south.list[0].id,
        scanMode: testData.scanMode.list[0],
        startTimeOffset: null,
        endTimeOffset: null,
        recoveryStrategy: null,
        cachingStrategy: null,
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
    const groupRepository = new SouthItemGroupRepository(database, createAuditServiceMock());

    // Create a real group with the first scan mode
    const group = groupRepository.create(
      {
        name: 'Group To Update',
        southId: testData.south.list[0].id,
        scanMode: testData.scanMode.list[0],
        startTimeOffset: null,
        endTimeOffset: null,
        recoveryStrategy: null,
        cachingStrategy: null,
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
      cachingStrategy: null,
      maxReadInterval: 3600,
      readDelay: 200
    };
    south.groups = [updatedGroup];
    south.updatedBy = 'updateUser';

    repository.saveSouth(south, false);

    const savedGroup = groupRepository.findById(group.id);
    assert.ok(savedGroup, 'Group should still exist after saveSouth');
    assert.strictEqual(savedGroup.name, 'Updated Group Name');
    assert.strictEqual(savedGroup.scanMode.id, testData.scanMode.list[1].id);
    assert.strictEqual(savedGroup.startTimeOffset, 500);
    assert.strictEqual(savedGroup.maxReadInterval, 3600);
    assert.strictEqual(savedGroup.readDelay, 200);

    const recordMock = auditService.record as unknown as ReturnType<typeof mock.fn>;
    const groupUpdateCall = recordMock.mock.calls.find(
      call => call.arguments[0] === 'south_item_group' && call.arguments[1] === group.id && call.arguments[2] === 'UPDATE'
    );
    assert.ok(groupUpdateCall);
    assert.strictEqual(groupUpdateCall!.arguments[5], 'updateUser');
  });

  it('should audit a removed group when saving the south connector without it', () => {
    const groupRepository = new SouthItemGroupRepository(database, createAuditServiceMock());
    const group = groupRepository.create(
      {
        name: 'Group To Remove Via Save',
        southId: testData.south.list[0].id,
        scanMode: testData.scanMode.list[0],
        startTimeOffset: null,
        endTimeOffset: null,
        recoveryStrategy: null,
        cachingStrategy: null,
        maxReadInterval: null,
        readDelay: 0
      },
      'userTest'
    );

    const south: SouthConnectorEntity<SouthSettings, SouthItemSettings> = JSON.parse(JSON.stringify(testData.south.list[0]));
    south.items = [];
    south.groups = [group];
    repository.saveSouth(south, false);

    const recordMock = auditService.record as unknown as ReturnType<typeof mock.fn>;
    recordMock.mock.resetCalls();

    const southWithoutGroup: SouthConnectorEntity<SouthSettings, SouthItemSettings> = JSON.parse(JSON.stringify(south));
    southWithoutGroup.groups = [];
    southWithoutGroup.updatedBy = 'removeUser';
    repository.saveSouth(southWithoutGroup, false);

    assert.strictEqual(groupRepository.findById(group.id), null);
    const groupDeleteCall = recordMock.mock.calls.find(
      call => call.arguments[0] === 'south_item_group' && call.arguments[1] === group.id && call.arguments[2] === 'DELETE'
    );
    assert.ok(groupDeleteCall);
    assert.strictEqual(groupDeleteCall!.arguments[5], 'removeUser');
  });

  it('should audit a removed item when saving the south connector without it', () => {
    const south: SouthConnectorEntity<SouthSettings, SouthItemSettings> = JSON.parse(JSON.stringify(testData.south.list[0]));
    south.id = '';
    south.name = 'connector for item removal audit';
    south.items = [
      {
        id: '',
        name: 'item to be removed',
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
        cachingStrategy: null,
        thresholdType: null,
        threshold: null,
        rangeLow: null,
        rangeHigh: null,
        maxCachingInterval: null,
        createdBy: '',
        updatedBy: '',
        createdAt: '',
        updatedAt: ''
      }
    ];
    repository.saveSouth(south, true);
    const itemId = south.items[0].id;
    const beforeItem = repository.findItemById(south.id, itemId);

    const recordMock = auditService.record as unknown as ReturnType<typeof mock.fn>;
    recordMock.mock.resetCalls();

    const southWithoutItem: SouthConnectorEntity<SouthSettings, SouthItemSettings> = JSON.parse(JSON.stringify(south));
    southWithoutItem.items = [];
    southWithoutItem.updatedBy = 'removeItemUser';
    repository.saveSouth(southWithoutItem, false);

    assert.strictEqual(repository.findItemById(south.id, itemId), null);
    const itemDeleteCall = recordMock.mock.calls.find(
      call => call.arguments[0] === 'south_item' && call.arguments[1] === itemId && call.arguments[2] === 'DELETE'
    );
    assert.ok(itemDeleteCall);
    assert.deepStrictEqual(itemDeleteCall!.arguments, ['south_item', itemId, 'DELETE', beforeItem, null, 'removeItemUser']);
  });

  it('should delete a group and fill empty scan mode and history fields on its items', () => {
    const groupRepository = new SouthItemGroupRepository(database, createAuditServiceMock());
    const group = groupRepository.create(
      {
        name: 'Group To Delete With Fallback',
        southId: testData.south.list[0].id,
        scanMode: testData.scanMode.list[0],
        startTimeOffset: 100,
        endTimeOffset: 50,
        maxReadInterval: 3600,
        readDelay: 200,
        recoveryStrategy: 'oldest',
        cachingStrategy: 'onChange'
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
      cachingStrategy: null,
      thresholdType: null,
      threshold: null,
      rangeLow: null,
      rangeHigh: null,
      maxCachingInterval: null,
      createdBy: '',
      updatedBy: '',
      createdAt: '',
      updatedAt: ''
    };
    repository.saveItem(testData.south.list[0].id, itemWithEmptyFields);

    repository.deleteGroupAndUpdateItems(testData.south.list[0].id, group, true, 'deleteUser');

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
    assert.strictEqual(savedItem.cachingStrategy, 'onChange');
  });

  it('should not overwrite an item own scan mode and history fields when deleting its group', () => {
    const groupRepository = new SouthItemGroupRepository(database, createAuditServiceMock());
    const group = groupRepository.create(
      {
        name: 'Group To Delete Without Fallback',
        southId: testData.south.list[0].id,
        scanMode: testData.scanMode.list[0],
        startTimeOffset: 100,
        endTimeOffset: 50,
        maxReadInterval: 3600,
        readDelay: 200,
        recoveryStrategy: 'oldest',
        cachingStrategy: 'onChange'
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
      cachingStrategy: 'threshold',
      thresholdType: 'absolute',
      threshold: 5,
      rangeLow: null,
      rangeHigh: null,
      maxCachingInterval: null,
      createdBy: '',
      updatedBy: '',
      createdAt: '',
      updatedAt: ''
    };
    repository.saveItem(testData.south.list[0].id, itemWithOwnFields);

    repository.deleteGroupAndUpdateItems(testData.south.list[0].id, group, true, 'deleteUser');

    const savedItem = repository.findItemById(testData.south.list[0].id, itemWithOwnFields.id)!;
    assert.strictEqual(savedItem.group, null);
    assert.strictEqual(savedItem.scanMode!.id, testData.scanMode.list[1].id);
    assert.strictEqual(savedItem.maxReadInterval, 60);
    assert.strictEqual(savedItem.readDelay, 50);
    assert.strictEqual(savedItem.startTimeOffset, 10);
    assert.strictEqual(savedItem.endTimeOffset, 20);
    assert.strictEqual(savedItem.recoveryStrategy, 'newest');
    assert.strictEqual(savedItem.cachingStrategy, 'threshold');
  });

  it('should not fill history fields when the connector does not support history', () => {
    const groupRepository = new SouthItemGroupRepository(database, createAuditServiceMock());
    const group = groupRepository.create(
      {
        name: 'Group To Delete No History',
        southId: testData.south.list[0].id,
        scanMode: testData.scanMode.list[0],
        startTimeOffset: 100,
        endTimeOffset: 50,
        maxReadInterval: 3600,
        readDelay: 200,
        recoveryStrategy: 'oldest',
        cachingStrategy: null
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
      cachingStrategy: null,
      thresholdType: null,
      threshold: null,
      rangeLow: null,
      rangeHigh: null,
      maxCachingInterval: null,
      createdBy: '',
      updatedBy: '',
      createdAt: '',
      updatedAt: ''
    };
    repository.saveItem(testData.south.list[0].id, itemWithEmptyFields);

    repository.deleteGroupAndUpdateItems(testData.south.list[0].id, group, false, 'deleteUser');

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
        cachingStrategy: null,
        thresholdType: null,
        threshold: null,
        rangeLow: null,
        rangeHigh: null,
        maxCachingInterval: null,
        createdBy: '',
        updatedBy: '',
        createdAt: '',
        updatedAt: ''
      }
    ];
    repository.saveSouth(newSouthConnector, true);
    const itemId = newSouthConnector.items[0].id;

    database.prepare(`UPDATE south_items SET updated_at = '2000-01-01T00:00:00Z' WHERE id = ?;`).run(itemId);

    const resavedSouthConnector: SouthConnectorEntity<SouthSettings, SouthItemSettings> = JSON.parse(JSON.stringify(newSouthConnector));
    repository.saveSouth(resavedSouthConnector, false);

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
        cachingStrategy: null,
        thresholdType: null,
        threshold: null,
        rangeLow: null,
        rangeHigh: null,
        maxCachingInterval: null,
        createdBy: '',
        updatedBy: '',
        createdAt: '',
        updatedAt: ''
      }
    ];
    repository.saveSouth(newSouthConnector, true);
    const itemId = newSouthConnector.items[0].id;

    database.prepare(`UPDATE south_items SET updated_at = '2000-01-01T00:00:00Z' WHERE id = ?;`).run(itemId);

    const changedSouthConnector: SouthConnectorEntity<SouthSettings, SouthItemSettings> = JSON.parse(JSON.stringify(newSouthConnector));
    changedSouthConnector.items[0].name = 'renamed item';
    repository.saveSouth(changedSouthConnector, false);

    const row = database.prepare(`SELECT updated_at FROM south_items WHERE id = ?;`).get(itemId) as { updated_at: string };
    assert.notStrictEqual(row.updated_at, '2000-01-01T00:00:00Z');
  });

  it('should insert and update items without a scan mode', () => {
    const newSouthConnector: SouthConnectorEntity<SouthSettings, SouthItemSettings> = JSON.parse(JSON.stringify(testData.south.list[0]));
    newSouthConnector.id = '';
    newSouthConnector.name = 'connector with scan-mode-less item';
    newSouthConnector.items = [
      {
        id: '',
        name: 'item without scan mode',
        enabled: true,
        scanMode: null,
        settings: {} as SouthItemSettings,
        group: null,
        syncWithGroup: false,
        maxReadInterval: null,
        readDelay: null,
        startTimeOffset: null,
        endTimeOffset: null,
        recoveryStrategy: null,
        cachingStrategy: null,
        thresholdType: null,
        threshold: null,
        rangeLow: null,
        rangeHigh: null,
        maxCachingInterval: null,
        createdBy: '',
        updatedBy: '',
        createdAt: '',
        updatedAt: ''
      }
    ];
    repository.saveSouth(newSouthConnector, true);
    const itemId = newSouthConnector.items[0].id;
    assert.ok(itemId);
    let saved = repository.findItemById(newSouthConnector.id, itemId)!;
    assert.strictEqual(saved.scanMode, null);

    // Now update it to have a scan mode (changes hasChanged/update.run branch), then clear it again
    const withScanMode: SouthConnectorEntity<SouthSettings, SouthItemSettings> = JSON.parse(JSON.stringify(newSouthConnector));
    withScanMode.items[0].scanMode = testData.scanMode.list[0];
    repository.saveSouth(withScanMode, false);
    saved = repository.findItemById(newSouthConnector.id, itemId)!;
    assert.strictEqual(saved.scanMode!.id, testData.scanMode.list[0].id);

    const backToNull: SouthConnectorEntity<SouthSettings, SouthItemSettings> = JSON.parse(JSON.stringify(withScanMode));
    backToNull.items[0].scanMode = null;
    repository.saveSouth(backToNull, false);
    saved = repository.findItemById(newSouthConnector.id, itemId)!;
    assert.strictEqual(saved.scanMode, null);
  });

  it('should update an item to clear its scan mode via saveItem', () => {
    const item: SouthConnectorItemEntity<SouthItemSettings> = {
      id: '',
      name: 'save-item-clear-scan-mode',
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
      cachingStrategy: null,
      thresholdType: null,
      threshold: null,
      rangeLow: null,
      rangeHigh: null,
      maxCachingInterval: null,
      createdBy: '',
      updatedBy: '',
      createdAt: '',
      updatedAt: ''
    };
    repository.saveItem(testData.south.list[0].id, item);
    assert.ok(item.id);

    item.scanMode = null;
    repository.saveItem(testData.south.list[0].id, item);

    const saved = repository.findItemById(testData.south.list[0].id, item.id)!;
    assert.strictEqual(saved.scanMode, null);
  });

  it('should persist a non-null recovery strategy when updating an existing group', () => {
    const groupRepository = new SouthItemGroupRepository(database, createAuditServiceMock());
    const group = groupRepository.create(
      {
        name: 'Group With Recovery Strategy',
        southId: testData.south.list[0].id,
        scanMode: testData.scanMode.list[0],
        startTimeOffset: null,
        endTimeOffset: null,
        recoveryStrategy: 'newest',
        cachingStrategy: null,
        maxReadInterval: null,
        readDelay: 0
      },
      'userTest'
    );
    assert.strictEqual(group.recoveryStrategy, 'newest');

    const south: SouthConnectorEntity<SouthSettings, SouthItemSettings> = JSON.parse(JSON.stringify(testData.south.list[0]));
    south.items = [];
    south.groups = [group];
    repository.saveSouth(south, false);

    const savedGroup = groupRepository.findById(group.id)!;
    assert.strictEqual(savedGroup.recoveryStrategy, 'newest');
  });

  it('should throw when an existing group is saved without a scan mode (NOT NULL constraint)', () => {
    const groupRepository = new SouthItemGroupRepository(database, createAuditServiceMock());
    const group = groupRepository.create(
      {
        name: 'Group Missing Scan Mode',
        southId: testData.south.list[0].id,
        scanMode: testData.scanMode.list[0],
        startTimeOffset: null,
        endTimeOffset: null,
        recoveryStrategy: null,
        cachingStrategy: null,
        maxReadInterval: null,
        readDelay: 0
      },
      'userTest'
    );

    const south: SouthConnectorEntity<SouthSettings, SouthItemSettings> = JSON.parse(JSON.stringify(testData.south.list[0]));
    south.items = [];
    south.groups = [{ ...group, scanMode: undefined as unknown as typeof group.scanMode }];

    assert.throws(() => repository.saveSouth(south, false));
  });
});

describe('toItemEntityFromJoinedRow / toSouthItemGroupLight helpers', () => {
  it('should default a joined item group readDelay to null when the column is missing', () => {
    const row: Record<string, string | number | null> = {
      id: 'itemId',
      name: 'item',
      enabled: 1,
      scan_mode_id: null,
      settings: '{}',
      sync_with_group: 0,
      max_read_interval: null,
      read_delay: null,
      start_time_offset: null,
      end_time_offset: null,
      recovery_strategy: null,
      created_by: '',
      updated_by: '',
      created_at: '',
      updated_at: '',
      sm_id: null,
      g_id: 'groupId',
      g_name: 'group',
      g_start_time_offset: null,
      g_end_time_offset: null,
      g_max_read_interval: null,
      g_read_delay: null,
      g_recovery_strategy: null,
      g_created_by: '',
      g_updated_by: '',
      g_created_at: '',
      g_updated_at: '',
      gsm_id: null
    };
    const entity = toItemEntityFromJoinedRow(row);
    assert.ok(entity.group);
    assert.strictEqual(entity.group!.readDelay, null);
  });

  it('should default a joined item group readDelay to a number when the column is present', () => {
    const row: Record<string, string | number | null> = {
      id: 'itemId',
      name: 'item',
      enabled: 1,
      scan_mode_id: null,
      settings: '{}',
      sync_with_group: 0,
      max_read_interval: null,
      read_delay: null,
      start_time_offset: null,
      end_time_offset: null,
      recovery_strategy: null,
      created_by: '',
      updated_by: '',
      created_at: '',
      updated_at: '',
      sm_id: null,
      g_id: 'groupId',
      g_name: 'group',
      g_start_time_offset: null,
      g_end_time_offset: null,
      g_max_read_interval: null,
      g_read_delay: 200,
      g_recovery_strategy: null,
      g_created_by: '',
      g_updated_by: '',
      g_created_at: '',
      g_updated_at: '',
      gsm_id: null
    };
    const entity = toItemEntityFromJoinedRow(row);
    assert.strictEqual(entity.group!.readDelay, 200);
  });

  it('should hydrate non-null historian fields for toSouthItemGroupLight', () => {
    const result: Record<string, string | number> = {
      id: 'groupId',
      name: 'group',
      start_time_offset: 10,
      end_time_offset: 20,
      max_read_interval: 3600,
      read_delay: 200,
      recovery_strategy: 'oldest',
      created_by: '',
      updated_by: '',
      created_at: '',
      updated_at: ''
    };
    const group = toSouthItemGroupLight(result);
    assert.strictEqual(group.startTimeOffset, 10);
    assert.strictEqual(group.endTimeOffset, 20);
    assert.strictEqual(group.maxReadInterval, 3600);
  });

  it('should default historian fields to null for toSouthItemGroupLight when absent', () => {
    const result: Record<string, string | number> = {
      id: 'groupId',
      name: 'group',
      read_delay: 0,
      created_by: '',
      updated_by: '',
      created_at: '',
      updated_at: ''
    };
    const group = toSouthItemGroupLight(result);
    assert.strictEqual(group.startTimeOffset, null);
    assert.strictEqual(group.endTimeOffset, null);
    assert.strictEqual(group.maxReadInterval, null);
  });
});
