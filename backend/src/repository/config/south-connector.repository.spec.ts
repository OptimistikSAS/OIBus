import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it, mock } from 'node:test';

import { Database } from 'better-sqlite3';

import { SouthItemSettings, SouthSettings } from '../../../shared/model/connector/south-settings.model';

import { ConfigurationWorkflowCommand } from '../../model/configuration-workflow.model';
import { ScanMode } from '../../model/scan-mode.model';
import {
  SouthConnectorEntity,
  SouthConnectorItemEntity,
  SouthItemGroupCommand,
  SouthItemGroupEntityLight
} from '../../model/south-connector.model';
import { NotFoundError } from '../../model/types';
import AuditService from '../../service/audit.service';
import { emptyDatabase, initDatabase } from '../../tests/utils/database-utils';
import testData from '../../tests/utils/test-data';
import { createAuditServiceMock, Mocked, stripAuditFields } from '../../tests/utils/test-utils';
import ConfigurationWorkflowRepository from './configuration-workflow.repository';
import SouthConnectorRepository, { toItemEntityFromJoinedRow, toSouthItemGroupLight } from './south-connector.repository';
import SouthItemGroupRepository from './south-item-group.repository';

const TEST_DB_PATH = 'src/tests/test-config-south.db';

type South = SouthConnectorEntity<SouthSettings, SouthItemSettings>;
type SouthItem = SouthConnectorItemEntity<SouthItemSettings>;
type AuditCall = Parameters<AuditService['record']>;

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

/** A new connector (empty id) cloned from a fixture, without the fixture's items. */
const newSouth = (name: string, overrides: Partial<South> = {}, fixture = testData.south.list[0]): South => ({
  ...clone(fixture),
  id: '',
  name,
  items: [],
  ...overrides
});

const newItem = (name: string, overrides: Partial<SouthItem> = {}): SouthItem => ({
  id: '',
  name,
  description: null,
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
  updatedAt: '',
  ...overrides
});

/** A group sent along with a connector save (a "temp_" id creates it). */
const newGroup = (id: string, name: string, overrides: Partial<SouthItemGroupEntityLight> = {}): SouthItemGroupEntityLight => ({
  id,
  name,
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
  updatedAt: '',
  ...overrides
});

/** Group settings that fill the empty fields of its items when the group is deleted. */
const HISTORY_GROUP_SETTINGS: Partial<SouthItemGroupCommand> = {
  startTimeOffset: 100,
  endTimeOffset: 50,
  maxReadInterval: 3600,
  readDelay: 200,
  recoveryStrategy: 'oldest'
};

/** Matches the audit records on `entityType`, with `action` and on `entityId` when given. */
const isAudit =
  (entityType: string, action?: string, entityId?: string) =>
  ([type, id, act]: AuditCall): boolean =>
    type === entityType && (action === undefined || act === action) && (entityId === undefined || id === entityId);

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
  let auditService: Mocked<AuditService>;
  let groupRepository: SouthItemGroupRepository;
  let workflowRepository: ConfigurationWorkflowRepository;

  beforeEach(() => {
    auditService = createAuditServiceMock();
    repository = new SouthConnectorRepository(database, auditService);
    // Its own audit mock: the groups it creates are setup, not what the tests audit
    groupRepository = new SouthItemGroupRepository(database, createAuditServiceMock());
    workflowRepository = new ConfigurationWorkflowRepository(database, auditService);
  });

  /** The arguments of every audit record made in the test so far. */
  const recorded = (): Array<AuditCall> => auditService.record.mock.calls.map(call => call.arguments);

  /** The arguments of the audit records made while running `action`. */
  const auditsDuring = (action: () => void): Array<AuditCall> => {
    const start = recorded().length;
    action();
    return recorded().slice(start);
  };

  /** Creates a group of the first south connector. */
  const createGroup = (name: string, overrides: Partial<SouthItemGroupCommand> = {}) =>
    groupRepository.create(
      {
        name,
        southId: testData.south.list[0].id,
        scanMode: testData.scanMode.list[0],
        startTimeOffset: null,
        endTimeOffset: null,
        maxReadInterval: null,
        readDelay: 0,
        recoveryStrategy: null,
        cachingStrategy: null,
        ...overrides
      },
      'userTest'
    );

  /** Creates a workflow of the first south connector. */
  const createWorkflow = (name: string, overrides: Partial<ConfigurationWorkflowCommand> = {}) =>
    workflowRepository.create(
      {
        name,
        description: null,
        southId: testData.south.list[0].id,
        discoveryScope: {},
        identityKeyFields: ['nodeId'],
        eligibilityFilter: [],
        itemFieldMapping: { name: '{{name}}' },
        pushToOIAnalytics: false,
        scanMode: null,
        enabled: true,
        ...overrides
      },
      'workflowUser'
    );

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
    const ghost: South = { ...clone(testData.south.list[0]), id: 'south-id-that-does-not-exist' };

    assert.throws(() => repository.saveSouth(ghost, false), NotFoundError);
    assert.strictEqual(repository.findSouthById('south-id-that-does-not-exist'), null);
  });

  it('should save a new south connector', () => {
    const newSouthConnector = newSouth('new connector');
    repository.saveSouth(newSouthConnector, true);

    assert.ok(newSouthConnector.id);
    const createdConnector = repository.findSouthById(newSouthConnector.id)!;
    assert.strictEqual(createdConnector.id, newSouthConnector.id);
    assert.strictEqual(createdConnector.name, 'new connector');
    assert.strictEqual(createdConnector.items.length, 0);

    const connectorCalls = recorded().filter(isAudit('south_connector'));
    assert.strictEqual(connectorCalls.length, 1);
    assert.deepStrictEqual(connectorCalls[0], [
      'south_connector',
      newSouthConnector.id,
      'CREATE',
      null,
      { ...createdConnector, settings: { ...createdConnector.settings, password: '' } },
      newSouthConnector.updatedBy
    ]);
    // The connector's secret settings field must never be persisted in the audit trail
    assert.notStrictEqual(
      (connectorCalls[0][4] as { settings: { password: string } }).settings.password,
      (createdConnector.settings as { password: string }).password
    );
  });

  it('should save a new south connector with its configuration workflows, and leave them untouched when none are given', () => {
    const newSouthConnector = newSouth('connector with workflows', { groups: [] });
    const workflow = {
      id: null,
      name: 'workflow',
      description: null,
      discoveryScope: {},
      identityKeyFields: [],
      eligibilityFilter: [],
      itemFieldMapping: null,
      pushToOIAnalytics: true,
      scanMode: null,
      enabled: true
    };
    repository.saveSouth(newSouthConnector, true, [workflow]);

    const created = workflowRepository.findBySouthId(newSouthConnector.id);
    assert.deepStrictEqual(
      created.map(entity => entity.name),
      ['workflow']
    );

    repository.saveSouth({ ...newSouthConnector, description: 'updated' }, false);
    assert.deepStrictEqual(workflowRepository.findBySouthId(newSouthConnector.id), created);

    repository.saveSouth(newSouthConnector, false, []);
    assert.deepStrictEqual(workflowRepository.findBySouthId(newSouthConnector.id), []);
  });

  it('should remap a workflow mapping items to a group created in the same save onto that group', () => {
    const newSouthConnector = newSouth('connector with a workflow mapping to a new group', {
      groups: [newGroup('temp_1', 'new group', { readDelay: null })]
    });
    const workflow = {
      id: null,
      name: 'workflow',
      description: null,
      discoveryScope: {},
      identityKeyFields: ['name'],
      eligibilityFilter: [],
      itemFieldMapping: { name: '{{name}}', groupId: 'temp_1' },
      pushToOIAnalytics: false,
      scanMode: null,
      enabled: true
    };
    repository.saveSouth(newSouthConnector, true, [workflow]);

    const [group] = repository.findGroupBySouthId(newSouthConnector.id);
    assert.notStrictEqual(group.id, 'temp_1');
    const [created] = workflowRepository.findBySouthId(newSouthConnector.id);
    assert.deepStrictEqual(created.itemFieldMapping, { name: '{{name}}', groupId: group.id });
  });

  it('should preserve caller-supplied ids for the connector, its groups and its items (config import)', () => {
    const southConnector: South = {
      ...newSouth('preserved south connector'),
      id: 'preserved-south-id',
      groups: [newGroup('preserved-group-id', 'preserved group')],
      items: [
        newItem('preserved item', {
          id: 'preserved-item-id',
          group: { id: 'preserved-group-id' } as SouthItemGroupEntityLight,
          syncWithGroup: true
        })
      ]
    };

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
    const item = newItem('new item');
    const newSouthConnector: South = { ...clone(testData.south.list[1]), items: [...testData.south.list[1].items, item] };
    const beforeConnector = repository.findSouthById(newSouthConnector.id);
    repository.saveSouth(newSouthConnector, false);

    const updatedConnector = repository.findSouthById(newSouthConnector.id)!;
    assert.strictEqual(updatedConnector.items.length, 3);

    const connectorCalls = recorded().filter(isAudit('south_connector'));
    assert.strictEqual(connectorCalls.length, 1);
    assert.deepStrictEqual(connectorCalls[0], [
      'south_connector',
      newSouthConnector.id,
      'UPDATE',
      { ...beforeConnector, settings: { ...beforeConnector!.settings, password: '' } },
      { ...updatedConnector, settings: { ...updatedConnector.settings, password: '' } },
      newSouthConnector.updatedBy
    ]);
    // The connector's secret settings field must never be persisted in the audit trail, before or after
    assert.strictEqual((connectorCalls[0][3] as { settings: { password: string } }).settings.password, '');
    assert.strictEqual((connectorCalls[0][4] as { settings: { password: string } }).settings.password, '');
    assert.notStrictEqual(
      (connectorCalls[0][4] as { settings: { password: string } }).settings.password,
      (updatedConnector.settings as { password: string }).password
    );

    const itemCreateCalls = recorded().filter(isAudit('south_item', 'CREATE'));
    assert.strictEqual(itemCreateCalls.length, 1);
    assert.strictEqual(itemCreateCalls[0][1], item.id);
  });

  it('should update a south connector item with non-null historian fields', () => {
    const connector: South = clone(testData.south.list[0]);
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

    const itemUpdateCalls = recorded().filter(isAudit('south_item', 'UPDATE', connector.items[0].id));
    assert.strictEqual(itemUpdateCalls.length, 1);
    assert.deepStrictEqual(itemUpdateCalls[0][3], beforeItem);

    // A second save of the same unchanged connector must not re-audit the untouched item
    const secondCalls = auditsDuring(() => repository.saveSouth(clone(updatedConnector), false));
    assert.strictEqual(secondCalls.filter(isAudit('south_item', undefined, connector.items[0].id)).length, 0);
  });

  it('should delete a south connector', () => {
    // Save a new connector first to delete it
    const newSouthConnector = newSouth('to be deleted');
    repository.saveSouth(newSouthConnector, true);

    assert.ok(repository.findSouthById(newSouthConnector.id));
    const before = repository.findSouthById(newSouthConnector.id);
    const calls = auditsDuring(() => repository.deleteSouth(newSouthConnector.id, 'deleteUser'));
    assert.strictEqual(repository.findSouthById(newSouthConnector.id), null);

    const deleteCall = calls.find(isAudit('south_connector', 'DELETE', newSouthConnector.id));
    assert.ok(deleteCall);
    assert.deepStrictEqual(deleteCall, [
      'south_connector',
      newSouthConnector.id,
      'DELETE',
      { ...before, settings: { ...before!.settings, password: '' } },
      null,
      'deleteUser'
    ]);
  });

  it('should redact an unknown south connector type by returning it as-is (no manifest match)', () => {
    const newSouthConnector = newSouth('south with unknown type', { type: 'not-a-real-south-type' as South['type'] });
    repository.saveSouth(newSouthConnector, true);

    const calls = auditsDuring(() => repository.deleteSouth(newSouthConnector.id, 'deleteUser'));

    const deleteCall = calls.find(isAudit('south_connector', 'DELETE', newSouthConnector.id));
    assert.ok(deleteCall);
    // With no manifest for this type, redactConnector must return the entity untouched rather than filtering secrets.
    assert.strictEqual((deleteCall[3] as { type: string }).type, 'not-a-real-south-type');
  });

  it('should redact an item under an unknown south connector type by returning it as-is (no manifest match)', () => {
    const newSouthConnector = newSouth(
      'south with unknown type and an item',
      {
        type: 'not-a-real-south-type' as South['type'],
        items: [{ ...testData.south.list[1].items[0], id: '', name: 'unknown-type-item' }]
      },
      testData.south.list[1]
    );
    repository.saveSouth(newSouthConnector, true);

    const created = repository.findSouthById(newSouthConnector.id)!;
    assert.strictEqual(created.items.length, 1);

    const calls = auditsDuring(() => repository.deleteItem(newSouthConnector.id, created.items[0].id, 'deleteUser'));

    const deleteCall = calls.find(isAudit('south_item', 'DELETE', created.items[0].id));
    assert.ok(deleteCall);
    // With no manifest for this type, redactItem must return the entity untouched rather than filtering secrets.
    assert.strictEqual((deleteCall[3] as { name: string }).name, 'unknown-type-item');
  });

  it('should audit deleted items and groups when deleting a south connector', () => {
    // First save a bare connector to get a real generated id
    const newSouthConnector = newSouth('to be deleted with items and groups', { groups: [] });
    repository.saveSouth(newSouthConnector, true);

    // Attach a temp group (created with the correct southId as part of the save) and an item using it
    const tempGroup = newGroup('temp_deleteSouthAudit', 'Group For Delete South Audit');
    newSouthConnector.groups = [tempGroup];
    newSouthConnector.items = [newItem('item to delete with south', { group: { ...tempGroup } })];
    repository.saveSouth(newSouthConnector, false);
    const before = repository.findSouthById(newSouthConnector.id)!;
    assert.strictEqual(before.items.length, 1);
    assert.strictEqual(before.groups.length, 1);

    const calls = auditsDuring(() => repository.deleteSouth(newSouthConnector.id, 'deleteUser'));

    const itemDeleteCall = calls.find(isAudit('south_item', 'DELETE', before.items[0].id));
    assert.ok(itemDeleteCall);
    assert.strictEqual(itemDeleteCall[5], 'deleteUser');

    const groupDeleteCall = calls.find(isAudit('south_item_group', 'DELETE', before.groups[0].id));
    assert.ok(groupDeleteCall);
    assert.strictEqual(groupDeleteCall[5], 'deleteUser');

    assert.ok(calls.find(isAudit('south_connector', 'DELETE', newSouthConnector.id)));
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
    assert.strictEqual(stripped.description, 'Temperature of the reactor inlet');
    assert.strictEqual(repository.findItemById(testData.south.list[0].id, testData.south.list[1].items[0].id), null);
  });

  it('should delete item', () => {
    const southId = testData.south.list[1].id;
    const [item0, item1] = testData.south.list[1].items;
    const before0 = repository.findItemById(southId, item0.id);
    repository.deleteItem(southId, item0.id, 'deleteUser');
    repository.deleteItem(southId, item1.id, 'deleteUser');
    assert.strictEqual(repository.findItemById(southId, item0.id), null);

    assert.deepStrictEqual(recorded()[0], ['south_item', item0.id, 'DELETE', before0, null, 'deleteUser']);
  });

  it('should delete all item by south', () => {
    const beforeItems = repository.findAllItemsForSouth(testData.south.list[1].id);
    repository.deleteAllItemsBySouth(testData.south.list[1].id, 'deleteUser');
    assert.strictEqual(repository.findAllItemsForSouth(testData.south.list[1].id).length, 0);

    const deleteCalls = recorded().filter(isAudit('south_item', 'DELETE'));
    assert.strictEqual(deleteCalls.length, beforeItems.length);
    for (const item of beforeItems) {
      assert.ok(deleteCalls.some(([, id, , previous, , userId]) => id === item.id && previous !== null && userId === 'deleteUser'));
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

    const call = recorded().at(-1)!;
    assert.deepStrictEqual(call.slice(0, 3), ['south_item', itemId, 'UPDATE']);
    assert.strictEqual(call[5], 'workflowUser');
  });

  it('should claim an item for a workflow and record the audit diff', () => {
    const southId = testData.south.list[0].id;
    const itemId = testData.south.list[0].items[1].id;
    const workflow = createWorkflow(`Claim item workflow ${itemId}`, { discoveryScope: { rootNodeId: 'ns=1;s=Root' } });

    repository.claimItemForWorkflow(southId, itemId, workflow.id, 'workflowUser');

    const found = repository.findItemById(southId, itemId)!;
    assert.strictEqual(found.createdByWorkflowId, workflow.id);

    assert.deepStrictEqual(recorded().at(-1)!.slice(0, 3), ['south_item', itemId, 'UPDATE']);
  });

  it('should restore the workflow ownership and disabled reason of an item, without auditing it', () => {
    const southId = testData.south.list[0].id;
    const itemId = testData.south.list[0].items[0].id;
    const workflow = createWorkflow(`Restore ownership workflow ${itemId}`);

    const calls = auditsDuring(() => repository.restoreItemWorkflowOwnership(itemId, workflow.id, 'not found anymore'));

    const found = repository.findItemById(southId, itemId)!;
    assert.strictEqual(found.createdByWorkflowId, workflow.id);
    assert.strictEqual(found.disabledReason, 'not found anymore');
    assert.deepStrictEqual(calls, []);
  });

  it('should clear created_by_workflow_id (not delete the item) when the owning workflow is deleted', () => {
    const southId = testData.south.list[0].id;
    const itemId = testData.south.list[0].items[0].id;
    const workflow = createWorkflow(`Claim item workflow ${itemId}`, { identityKeyFields: [] });
    repository.claimItemForWorkflow(southId, itemId, workflow.id, 'workflowUser');

    workflowRepository.delete(workflow.id, 'workflowUser');

    const found = repository.findItemById(southId, itemId);
    assert.ok(found, 'the item must survive the owning workflow being deleted');
    assert.strictEqual(found.createdByWorkflowId, null);
  });

  it('should save all items without removing existing items', () => {
    const item = newItem('new item save-all-test', { enabled: false });
    const itemsToSave = [...clone(testData.south.list[0].items), item];
    itemsToSave[0].name = 'updated name';

    repository.saveAllItems(testData.south.list[0].id, itemsToSave, false, 'userTest');

    const results = repository.findAllItemsForSouth(testData.south.list[0].id);
    assert.strictEqual(results.length, 3);

    assert.strictEqual(repository.findItemById(testData.south.list[0].id, testData.south.list[0].items[0].id)!.name, 'updated name');
    // item.id is set by saveAllItems
    assert.ok(item.id);
    assert.ok(repository.findItemById(testData.south.list[0].id, item.id));
  });

  it('should save all items and remove existing items', () => {
    const itemsToSave: Array<SouthItem> = [
      ...clone(testData.south.list[0].items).map(item => ({ ...item, id: '' })),
      newItem('new item for replace', { enabled: false })
    ];

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
    const group = createGroup('Test Group For South');
    const itemWithGroup = newItem('item with group test', { group });
    const southWithGroups: South = { ...clone(testData.south.list[0]), items: [itemWithGroup], groups: [group] };

    repository.saveSouth(southWithGroups, false);

    // itemWithGroup.id is set after save
    assert.ok(itemWithGroup.id);
    const savedItem = repository.findItemById(southWithGroups.id, itemWithGroup.id);
    assert.ok(savedItem);
    assert.strictEqual(savedItem.group!.id, group.id);
  });

  it('should save item with groups', () => {
    const group = createGroup('Test Group 2 For South', { startTimeOffset: 10 });
    const itemWithGroup = newItem('unique-item-with-group-test', { group });

    repository.saveItem(testData.south.list[0].id, itemWithGroup);

    // itemWithGroup.id is set after saveItem
    assert.ok(itemWithGroup.id);
    const savedItem = repository.findItemById(testData.south.list[0].id, itemWithGroup.id);
    assert.ok(savedItem);
    assert.strictEqual(savedItem.group!.id, group.id);

    const createCall = recorded().find(isAudit('south_item', 'CREATE', itemWithGroup.id));
    assert.ok(createCall);
    assert.strictEqual(createCall[3], null);
  });

  it('should audit an update via saveItem', () => {
    const item = newItem('save-item-update-audit', { updatedBy: 'creatorUser' });
    repository.saveItem(testData.south.list[0].id, item);
    assert.ok(item.id);
    const beforeUpdate = repository.findItemById(testData.south.list[0].id, item.id);

    item.name = 'save-item-update-audit-renamed';
    item.description = 'save-item-update-audit description';
    item.updatedBy = 'updaterUser';
    const calls = auditsDuring(() => repository.saveItem(testData.south.list[0].id, item));

    const afterUpdate = repository.findItemById(testData.south.list[0].id, item.id);
    assert.strictEqual(afterUpdate?.description, 'save-item-update-audit description');
    assert.deepStrictEqual(calls, [['south_item', item.id, 'UPDATE', beforeUpdate, afterUpdate, 'updaterUser']]);
  });

  it('should redact without a manifest (raw before/after) when saveItem is given a southConnectorId whose connector does not exist', () => {
    // saveItem's UPDATE query matches by item id alone (not connector_id), so passing a
    // southConnectorId that doesn't resolve to a real connector still updates the row while making
    // findSouthById(...)?.type resolve to undefined — the only way to reach the "no southType" side
    // of saveItem's audit redaction without breaking referential integrity.
    const item = newItem('save-item-unknown-connector', {
      thresholdType: 'absolute',
      threshold: 10,
      rangeLow: 0,
      rangeHigh: 100,
      maxCachingInterval: 1000,
      updatedBy: 'creatorUser'
    });
    repository.saveItem(testData.south.list[0].id, item);
    assert.ok(item.id);

    item.name = 'save-item-unknown-connector-renamed';
    item.updatedBy = 'updaterUser';
    const calls = auditsDuring(() => repository.saveItem('south-connector-id-that-does-not-exist', item));

    assert.strictEqual(calls.length, 1);
    const [, , , before, after] = calls[0];
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
    const freshConnector = newSouth('south for desynced-before-items-snapshot test', {
      items: [{ ...testData.south.list[0].items[0], id: '', name: 'item-to-desync' }]
    });
    repository.saveSouth(freshConnector, true);
    const southId = freshConnector.id;

    const existingItem = repository.findAllItemsForSouth(southId)[0];
    assert.ok(existingItem);

    const updatedConnector: South = clone(repository.findSouthById(southId)!);
    updatedConnector.items.find(i => i.id === existingItem.id)!.name = 'desynced-before-items-snapshot';

    // The repository is rebuilt for each test: the stub needs no restore
    mock.method(repository, 'findAllItemsForSouth', () => []);
    const calls = auditsDuring(() => repository.saveSouth(updatedConnector, false));

    const updateCall = calls.find(isAudit('south_item', 'UPDATE', existingItem.id));
    assert.ok(updateCall, 'expected an UPDATE audit entry for the desynced item');
    assert.strictEqual(updateCall[3], null);
  });

  it('should save and find item with historian fields', () => {
    const itemWithHistorian = newItem('item-with-historian-fields', { maxReadInterval: 3600, readDelay: 200, startTimeOffset: 100 });

    repository.saveItem(testData.south.list[0].id, itemWithHistorian);

    assert.ok(itemWithHistorian.id);
    const savedItem = repository.findItemById(testData.south.list[0].id, itemWithHistorian.id);
    assert.ok(savedItem);
    assert.strictEqual(savedItem.maxReadInterval, 3600);
    assert.strictEqual(savedItem.readDelay, 200);
    assert.strictEqual(savedItem.startTimeOffset, 100);
  });

  it('should save and find an item with caching strategy fields', () => {
    const itemWithCachingStrategy = newItem('item-with-caching-strategy', {
      cachingStrategy: 'threshold',
      thresholdType: 'percentage',
      threshold: 5,
      rangeLow: 0,
      rangeHigh: 100,
      maxCachingInterval: 60000
    });

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
    const southId = testData.south.list[0].id;
    const group = createGroup('Group With Caching Strategy', { cachingStrategy: 'onChange' });

    const syncedItem = newItem('item-synced-with-group-caching-strategy', { group, syncWithGroup: true });
    repository.saveItem(southId, syncedItem);

    // The item's own column is null, so it falls back to the group's cachingStrategy
    assert.strictEqual(repository.findItemById(southId, syncedItem.id)!.cachingStrategy, 'onChange');

    // An item with its own cachingStrategy set keeps it even when synced with a group
    const itemWithOwnStrategy: SouthItem = {
      ...syncedItem,
      id: '',
      name: 'item-synced-but-with-own-caching-strategy',
      cachingStrategy: 'threshold',
      thresholdType: 'absolute',
      threshold: 1
    };
    repository.saveItem(southId, itemWithOwnStrategy);
    assert.strictEqual(repository.findItemById(southId, itemWithOwnStrategy.id)!.cachingStrategy, 'threshold');

    // An item not synced with the group never falls back, even if its own value is null
    const unsyncedItem: SouthItem = { ...syncedItem, id: '', name: 'item-not-synced-with-group', syncWithGroup: false };
    repository.saveItem(southId, unsyncedItem);
    assert.strictEqual(repository.findItemById(southId, unsyncedItem.id)!.cachingStrategy, null);
  });

  it('should save item with empty groups array', () => {
    const itemWithEmptyGroups = newItem('item-with-empty-groups');

    repository.saveItem(testData.south.list[0].id, itemWithEmptyGroups);

    assert.ok(itemWithEmptyGroups.id);
    const savedItem = repository.findItemById(testData.south.list[0].id, itemWithEmptyGroups.id);
    assert.ok(savedItem);
    assert.strictEqual(savedItem.group, null);
  });

  it('should move items to a group', () => {
    const group = createGroup('Move Group');

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
    const group = createGroup('Move Group With Different Scan Mode', { scanMode: testData.scanMode.list[1] });

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
    const group = createGroup('Remove Group');

    const existingItems = repository.findAllItemsForSouth(testData.south.list[0].id);
    assert.ok(existingItems.length > 0);

    const itemIds = existingItems.slice(0, 1).map(item => item.id);
    const findMovedItem = () => repository.findAllItemsForSouth(testData.south.list[0].id).find(item => itemIds.includes(item.id))!;
    repository.moveItemsToGroup(itemIds, group.id);
    assert.notStrictEqual(findMovedItem().group, null);

    repository.moveItemsToGroup(itemIds, null);
    assert.strictEqual(findMovedItem().group, null);
  });

  it('should handle empty itemIds array in moveItemsToGroup', () => {
    assert.doesNotThrow(() => repository.moveItemsToGroup([], 'someGroupId'));
    assert.doesNotThrow(() => repository.moveItemsToGroup([], null));
  });

  it('should save south connector and replace temp group IDs with real IDs', () => {
    const tempGroup = newGroup('temp_newgroup', 'Temp Created Group');
    const itemWithTempGroup = newItem('item-with-temp-group', { group: { ...tempGroup }, syncWithGroup: true });
    const south: South = { ...clone(testData.south.list[0]), groups: [tempGroup], items: [itemWithTempGroup] };

    repository.saveSouth(south, false);

    // After save, the temp group ID is replaced with a real generated ID
    assert.ok(!itemWithTempGroup.group!.id.startsWith('temp_'));
    assert.ok(itemWithTempGroup.id);

    const savedItem = repository.findItemById(south.id, itemWithTempGroup.id);
    assert.ok(savedItem);
    assert.ok(savedItem.group);
    assert.notStrictEqual(savedItem.group.id, 'temp_newgroup');

    const groupCreateCall = recorded().find(isAudit('south_item_group', 'CREATE'));
    assert.ok(groupCreateCall);
    assert.strictEqual(groupCreateCall[1], savedItem.group.id);
  });

  it('should find scan mode for south', () => {
    const result = repository.findScanModeForSouth(testData.scanMode.list[0].id);

    assert.strictEqual(result.id, testData.scanMode.list[0].id);
    assert.strictEqual(result.name, testData.scanMode.list[0].name);
    assert.strictEqual(result.cron, testData.scanMode.list[0].cron);
  });

  it('should find groups by south id', () => {
    createGroup('Test Group For Find');

    const groups = repository.findGroupBySouthId(testData.south.list[0].id);

    assert.ok(Array.isArray(groups));
    assert.ok(groups.length > 0);
    assert.ok(groups.some(g => g.name === 'Test Group For Find'));
    assert.ok(groups.every(g => g.scanMode !== null));
  });

  it('should update existing group properties when saving the south connector', () => {
    // Create a real group with the first scan mode
    const group = createGroup('Group To Update');

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
    const south: South = { ...clone(testData.south.list[0]), items: [], groups: [updatedGroup], updatedBy: 'updateUser' };

    repository.saveSouth(south, false);

    const savedGroup = groupRepository.findById(group.id);
    assert.ok(savedGroup, 'Group should still exist after saveSouth');
    assert.strictEqual(savedGroup.name, 'Updated Group Name');
    assert.strictEqual(savedGroup.scanMode.id, testData.scanMode.list[1].id);
    assert.strictEqual(savedGroup.startTimeOffset, 500);
    assert.strictEqual(savedGroup.maxReadInterval, 3600);
    assert.strictEqual(savedGroup.readDelay, 200);

    const groupUpdateCall = recorded().find(isAudit('south_item_group', 'UPDATE', group.id));
    assert.ok(groupUpdateCall);
    assert.strictEqual(groupUpdateCall[5], 'updateUser');
  });

  it('should audit a removed group when saving the south connector without it', () => {
    const group = createGroup('Group To Remove Via Save');

    const south: South = { ...clone(testData.south.list[0]), items: [], groups: [group] };
    repository.saveSouth(south, false);

    const calls = auditsDuring(() => repository.saveSouth({ ...clone(south), groups: [], updatedBy: 'removeUser' }, false));

    assert.strictEqual(groupRepository.findById(group.id), null);
    const groupDeleteCall = calls.find(isAudit('south_item_group', 'DELETE', group.id));
    assert.ok(groupDeleteCall);
    assert.strictEqual(groupDeleteCall[5], 'removeUser');
  });

  it('should audit a removed item when saving the south connector without it', () => {
    const south = newSouth('connector for item removal audit', { items: [newItem('item to be removed')] });
    repository.saveSouth(south, true);
    const itemId = south.items[0].id;
    const beforeItem = repository.findItemById(south.id, itemId);

    const calls = auditsDuring(() => repository.saveSouth({ ...clone(south), items: [], updatedBy: 'removeItemUser' }, false));

    assert.strictEqual(repository.findItemById(south.id, itemId), null);
    assert.deepStrictEqual(calls.find(isAudit('south_item', 'DELETE', itemId)), [
      'south_item',
      itemId,
      'DELETE',
      beforeItem,
      null,
      'removeItemUser'
    ]);
  });

  it('should delete a group and fill empty scan mode and history fields on its items', () => {
    const group = createGroup('Group To Delete With Fallback', { ...HISTORY_GROUP_SETTINGS, cachingStrategy: 'onChange' });

    const itemWithEmptyFields = newItem('item-inheriting-from-group', { scanMode: null, group, syncWithGroup: true });
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
    const group = createGroup('Group To Delete Without Fallback', { ...HISTORY_GROUP_SETTINGS, cachingStrategy: 'onChange' });

    const itemWithOwnFields = newItem('item-with-own-fields', {
      scanMode: testData.scanMode.list[1],
      group,
      maxReadInterval: 60,
      readDelay: 50,
      startTimeOffset: 10,
      endTimeOffset: 20,
      recoveryStrategy: 'newest',
      cachingStrategy: 'threshold',
      thresholdType: 'absolute',
      threshold: 5
    });
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
    const group = createGroup('Group To Delete No History', HISTORY_GROUP_SETTINGS);

    const itemWithEmptyFields = newItem('item-no-history-connector', { scanMode: null, group, syncWithGroup: true });
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

  /** Saves a new connector with one item, then backdates the item's updated_at. */
  const saveSouthWithBackdatedItem = (name: string, itemName: string): { south: South; itemId: string } => {
    const south = newSouth(name, { items: [newItem(itemName)] });
    repository.saveSouth(south, true);
    const itemId = south.items[0].id;
    database.prepare(`UPDATE south_items SET updated_at = '2000-01-01T00:00:00Z' WHERE id = ?;`).run(itemId);
    return { south, itemId };
  };
  const itemUpdatedAt = (itemId: string) =>
    (database.prepare(`SELECT updated_at FROM south_items WHERE id = ?;`).get(itemId) as { updated_at: string }).updated_at;

  it('should not bump updated_at when saving a south connector with an item that has not changed', () => {
    const { south, itemId } = saveSouthWithBackdatedItem('unchanged item connector', 'stable item');

    repository.saveSouth(clone(south), false);

    assert.strictEqual(itemUpdatedAt(itemId), '2000-01-01T00:00:00Z');
  });

  it('should bump updated_at when saving a south connector with an item that has changed', () => {
    const { south, itemId } = saveSouthWithBackdatedItem('changed item connector', 'item to rename');

    const changedSouthConnector = clone(south);
    changedSouthConnector.items[0].name = 'renamed item';
    repository.saveSouth(changedSouthConnector, false);

    assert.notStrictEqual(itemUpdatedAt(itemId), '2000-01-01T00:00:00Z');
  });

  it('should insert and update items without a scan mode', () => {
    const newSouthConnector = newSouth('connector with scan-mode-less item', {
      items: [newItem('item without scan mode', { scanMode: null })]
    });
    repository.saveSouth(newSouthConnector, true);
    const itemId = newSouthConnector.items[0].id;
    assert.ok(itemId);
    assert.strictEqual(repository.findItemById(newSouthConnector.id, itemId)!.scanMode, null);

    // Now update it to have a scan mode (changes hasChanged/update.run branch), then clear it again
    const withScanMode = clone(newSouthConnector);
    withScanMode.items[0].scanMode = testData.scanMode.list[0];
    repository.saveSouth(withScanMode, false);
    assert.strictEqual(repository.findItemById(newSouthConnector.id, itemId)!.scanMode!.id, testData.scanMode.list[0].id);

    const backToNull = clone(withScanMode);
    backToNull.items[0].scanMode = null;
    repository.saveSouth(backToNull, false);
    assert.strictEqual(repository.findItemById(newSouthConnector.id, itemId)!.scanMode, null);
  });

  it('should update an item to clear its scan mode via saveItem', () => {
    const item = newItem('save-item-clear-scan-mode');
    repository.saveItem(testData.south.list[0].id, item);
    assert.ok(item.id);

    item.scanMode = null;
    repository.saveItem(testData.south.list[0].id, item);

    const saved = repository.findItemById(testData.south.list[0].id, item.id)!;
    assert.strictEqual(saved.scanMode, null);
  });

  it('should persist a non-null recovery strategy when updating an existing group', () => {
    const group = createGroup('Group With Recovery Strategy', { recoveryStrategy: 'newest' });
    assert.strictEqual(group.recoveryStrategy, 'newest');

    repository.saveSouth({ ...clone(testData.south.list[0]), items: [], groups: [group] }, false);

    const savedGroup = groupRepository.findById(group.id)!;
    assert.strictEqual(savedGroup.recoveryStrategy, 'newest');
  });

  it('should throw when an existing group is saved without a scan mode (NOT NULL constraint)', () => {
    const group = createGroup('Group Missing Scan Mode');

    const south: South = {
      ...clone(testData.south.list[0]),
      items: [],
      groups: [{ ...group, scanMode: undefined as unknown as ScanMode }]
    };

    assert.throws(() => repository.saveSouth(south, false));
  });
});

describe('toItemEntityFromJoinedRow / toSouthItemGroupLight helpers', () => {
  const joinedRow = (groupReadDelay: number | null): Record<string, string | number | null> => ({
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
    g_read_delay: groupReadDelay,
    g_recovery_strategy: null,
    g_created_by: '',
    g_updated_by: '',
    g_created_at: '',
    g_updated_at: '',
    gsm_id: null
  });

  it('should default a joined item group readDelay to null when the column is missing', () => {
    const entity = toItemEntityFromJoinedRow(joinedRow(null));
    assert.ok(entity.group);
    assert.strictEqual(entity.group.readDelay, null);
  });

  it('should default a joined item group readDelay to a number when the column is present', () => {
    const entity = toItemEntityFromJoinedRow(joinedRow(200));
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
