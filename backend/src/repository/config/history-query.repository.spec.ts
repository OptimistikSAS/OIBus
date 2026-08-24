import { before, after, beforeEach, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { Database } from 'better-sqlite3';
import { createAuditServiceMock, emptyDatabase, initDatabase, stripAuditFields } from '../../tests/utils/test-utils';
import testData from '../../tests/utils/test-data';
import HistoryQueryRepository from './history-query.repository';
import { HistoryQueryEntity, HistoryQueryItemEntity } from '../../model/histor-query.model';
import { SouthItemSettings, SouthSettings } from '../../../shared/model/south-settings.model';
import { NorthSettings } from '../../../shared/model/north-settings.model';
import { Transformer } from '../../model/transformer.model';
import AuditService from '../../service/audit.service';

const TEST_DB_PATH = 'src/tests/test-config-history-query.db';

let database: Database;
describe('HistoryQueryRepository', () => {
  before(async () => {
    database = await initDatabase('config', true, TEST_DB_PATH);
  });

  after(async () => {
    database.close();
    await emptyDatabase('config', TEST_DB_PATH);
  });

  let repository: HistoryQueryRepository;
  let auditService: AuditService;
  // IDs for newly created history queries, shared across tests
  let newHistoryId: string;
  let newHistoryWithoutTransformerId: string;

  beforeEach(() => {
    auditService = createAuditServiceMock();
    repository = new HistoryQueryRepository(database, auditService);
  });

  it('should properly get history queries (light)', () => {
    const result = repository.findAllHistoriesLight();
    for (const element of testData.historyQueries.list) {
      const found = result.find(r => r.id === element.id);
      assert.ok(found, `History query ${element.id} not found`);
      assert.strictEqual(found.name, element.name);
      assert.strictEqual(found.description, element.description);
      assert.strictEqual(found.status, element.status);
      assert.strictEqual(found.startTime, element.queryTimeRange.startTime);
      assert.strictEqual(found.endTime, element.queryTimeRange.endTime);
      assert.strictEqual(found.southType, element.southType);
      assert.strictEqual(found.northType, element.northType);
    }
  });

  it('should properly get history queries (full)', () => {
    assert.deepStrictEqual(stripAuditFields(repository.findAllHistoriesFull()), stripAuditFields(testData.historyQueries.list));
  });

  it('should properly get a history query', () => {
    assert.deepStrictEqual(
      stripAuditFields(repository.findHistoryById(testData.historyQueries.list[0].id)),
      stripAuditFields(testData.historyQueries.list[0])
    );
    assert.strictEqual(repository.findHistoryById('badId'), null);
  });

  it('should save a new history query', () => {
    const newHistoryQuery: HistoryQueryEntity<SouthSettings, NorthSettings, SouthItemSettings> = JSON.parse(
      JSON.stringify(testData.historyQueries.list[0])
    );
    newHistoryQuery.id = '';
    newHistoryQuery.name = 'new history query';
    repository.saveHistory(newHistoryQuery);

    assert.ok(newHistoryQuery.id);
    newHistoryId = newHistoryQuery.id;

    const createdHistoryQuery = repository.findHistoryById(newHistoryId)!;
    assert.strictEqual(createdHistoryQuery.id, newHistoryId);
    assert.strictEqual(createdHistoryQuery.name, 'new history query');
    assert.strictEqual(createdHistoryQuery.items.length, 0);

    const recordMock = auditService.record as unknown as ReturnType<typeof mock.fn>;
    const historyCreateCalls = recordMock.mock.calls.filter(
      call => call.arguments[0] === 'history_query' && call.arguments[1] === newHistoryId && call.arguments[2] === 'CREATE'
    );
    assert.strictEqual(historyCreateCalls.length, 1);
    assert.deepStrictEqual(historyCreateCalls[0].arguments, [
      'history_query',
      newHistoryId,
      'CREATE',
      null,
      { ...createdHistoryQuery, southSettings: { ...createdHistoryQuery.southSettings, password: '' } },
      newHistoryQuery.updatedBy
    ]);
    // The south settings' secret field must never be persisted in the audit trail
    assert.strictEqual((historyCreateCalls[0].arguments[4] as { southSettings: { password: string } }).southSettings.password, '');

    const newHistoryWithoutTransformer: HistoryQueryEntity<SouthSettings, NorthSettings, SouthItemSettings> = JSON.parse(
      JSON.stringify(testData.historyQueries.list[0])
    );
    newHistoryWithoutTransformer.id = '';
    newHistoryWithoutTransformer.name = 'new history query without transformer';
    newHistoryWithoutTransformer.northTransformers = [];
    newHistoryQuery.items = [];
    repository.saveHistory(newHistoryWithoutTransformer);

    assert.ok(newHistoryWithoutTransformer.id);
    newHistoryWithoutTransformerId = newHistoryWithoutTransformer.id;

    const createdHistoryWithoutTransformer = repository.findHistoryById(newHistoryWithoutTransformerId)!;
    assert.deepStrictEqual(createdHistoryWithoutTransformer.northTransformers, []);

    recordMock.mock.resetCalls();
    repository.addOrEditTransformer(
      newHistoryWithoutTransformerId,
      {
        id: '',
        transformer: testData.transformers.list[0] as Transformer,
        options: {},
        items: []
      },
      'transformerUser'
    );
    const createdHistoryWithTransformer = repository.findHistoryById(newHistoryWithoutTransformerId)!;
    assert.strictEqual(createdHistoryWithTransformer.northTransformers.length, 1);
    assert.strictEqual(createdHistoryWithTransformer.northTransformers[0].transformer.id, testData.transformers.list[0].id);

    const transformerId = createdHistoryWithTransformer.northTransformers[0].id;
    const transformerCreateCalls = recordMock.mock.calls.filter(
      call => call.arguments[0] === 'history_query_transformer' && call.arguments[1] === transformerId && call.arguments[2] === 'CREATE'
    );
    assert.strictEqual(transformerCreateCalls.length, 1);
    assert.strictEqual(transformerCreateCalls[0].arguments[5], 'transformerUser');

    recordMock.mock.resetCalls();
    repository.removeTransformer(transformerId, 'removeUser');
    const createdHistoryWithRemovedTransformer = repository.findHistoryById(newHistoryWithoutTransformerId)!;
    assert.deepStrictEqual(createdHistoryWithRemovedTransformer.northTransformers, []);
    const transformerDeleteCalls = recordMock.mock.calls.filter(
      call => call.arguments[0] === 'history_query_transformer' && call.arguments[1] === transformerId && call.arguments[2] === 'DELETE'
    );
    assert.strictEqual(transformerDeleteCalls.length, 1);
    assert.strictEqual(transformerDeleteCalls[0].arguments[5], 'removeUser');
  });

  it('should remove all transformers for a history query by transformer id', () => {
    const newHistoryWithoutTransformer2: HistoryQueryEntity<SouthSettings, NorthSettings, SouthItemSettings> = JSON.parse(
      JSON.stringify(testData.historyQueries.list[1])
    );
    newHistoryWithoutTransformer2.id = '';
    newHistoryWithoutTransformer2.name = 'new history without transformer 2';
    newHistoryWithoutTransformer2.northTransformers = [];
    newHistoryWithoutTransformer2.items = [];
    repository.saveHistory(newHistoryWithoutTransformer2);

    assert.ok(newHistoryWithoutTransformer2.id);

    repository.addOrEditTransformer(
      newHistoryWithoutTransformer2.id,
      {
        id: '',
        transformer: testData.transformers.list[0] as Transformer,
        options: {},
        items: []
      },
      'attachUser'
    );
    const historyWithTransformer = repository.findHistoryById(newHistoryWithoutTransformer2.id)!;
    assert.strictEqual(historyWithTransformer.northTransformers.length, 1);
    const transformerId = historyWithTransformer.northTransformers[0].id;

    const recordMock = auditService.record as unknown as ReturnType<typeof mock.fn>;
    recordMock.mock.resetCalls();
    repository.removeTransformersByTransformerId(testData.transformers.list[0].id, 'bulkRemoveUser');
    const historyWithRemovedTransformers = repository.findHistoryById(newHistoryWithoutTransformer2.id)!;
    assert.deepStrictEqual(historyWithRemovedTransformers.northTransformers, []);

    const transformerDeleteCalls = recordMock.mock.calls.filter(
      call => call.arguments[0] === 'history_query_transformer' && call.arguments[1] === transformerId && call.arguments[2] === 'DELETE'
    );
    assert.strictEqual(transformerDeleteCalls.length, 1);
    assert.strictEqual(transformerDeleteCalls[0].arguments[5], 'bulkRemoveUser');
  });

  it('should update a history query', () => {
    const newHistoryQuery: HistoryQueryEntity<SouthSettings, NorthSettings, SouthItemSettings> = JSON.parse(
      JSON.stringify(testData.historyQueries.list[1])
    );
    const newItem1: HistoryQueryItemEntity<SouthItemSettings> = {
      id: 'temp_1',
      name: 'new item',
      enabled: true,
      settings: {} as SouthItemSettings,
      createdBy: '',
      updatedBy: '',
      createdAt: '',
      updatedAt: ''
    };
    const newItem2: HistoryQueryItemEntity<SouthItemSettings> = {
      id: 'temp_2',
      name: 'another item',
      enabled: true,
      settings: {} as SouthItemSettings,
      createdBy: '',
      updatedBy: '',
      createdAt: '',
      updatedAt: ''
    };
    const existingItem = testData.historyQueries.list[1].items[0];
    const beforeItem = repository.findItemById(testData.historyQueries.list[1].id, existingItem.id);
    newHistoryQuery.items = [...testData.historyQueries.list[1].items, newItem1, newItem2];
    newHistoryQuery.items[0] = { ...newHistoryQuery.items[0], name: 'renamed existing item' };
    newHistoryQuery.northTransformers = [
      {
        id: '',
        transformer: testData.transformers.list[0],
        options: {},
        items: [{ id: 'temp_1', name: 'new item', enabled: true, createdBy: '', updatedBy: '', createdAt: '', updatedAt: '' }]
      }
    ];

    const recordMock = auditService.record as unknown as ReturnType<typeof mock.fn>;
    recordMock.mock.resetCalls();
    repository.saveHistory(newHistoryQuery);

    const updatedHistoryQuery = repository.findHistoryById(newHistoryQuery.id)!;
    assert.strictEqual(updatedHistoryQuery.items.length, 3);
    assert.strictEqual(updatedHistoryQuery.northTransformers.length, 1);
    assert.strictEqual(updatedHistoryQuery.northTransformers[0].items.length, 1);

    const itemCreateCalls = recordMock.mock.calls.filter(
      call => call.arguments[0] === 'history_query_item' && call.arguments[2] === 'CREATE'
    );
    assert.strictEqual(itemCreateCalls.length, 2);

    const itemUpdateCalls = recordMock.mock.calls.filter(
      call => call.arguments[0] === 'history_query_item' && call.arguments[1] === existingItem.id && call.arguments[2] === 'UPDATE'
    );
    assert.strictEqual(itemUpdateCalls.length, 1);
    assert.deepStrictEqual(itemUpdateCalls[0].arguments[3], beforeItem);

    const historyUpdateCalls = recordMock.mock.calls.filter(
      call => call.arguments[0] === 'history_query' && call.arguments[1] === newHistoryQuery.id && call.arguments[2] === 'UPDATE'
    );
    assert.strictEqual(historyUpdateCalls.length, 1);
  });

  it('should save a history query with a "temp_" north transformer id (treated as new)', () => {
    const newHistoryQuery: HistoryQueryEntity<SouthSettings, NorthSettings, SouthItemSettings> = JSON.parse(
      JSON.stringify(testData.historyQueries.list[1])
    );
    newHistoryQuery.id = '';
    newHistoryQuery.name = 'history query with temp transformer id';
    newHistoryQuery.items = [];
    newHistoryQuery.northTransformers = [
      {
        id: 'temp_north_1',
        transformer: testData.transformers.list[0],
        options: {},
        items: []
      }
    ];
    repository.saveHistory(newHistoryQuery);

    assert.ok(newHistoryQuery.id);
    const created = repository.findHistoryById(newHistoryQuery.id)!;
    assert.strictEqual(created.northTransformers.length, 1);
    assert.notStrictEqual(created.northTransformers[0].id, 'temp_north_1');
  });

  it('should update a history query by removing items and transformers', () => {
    // Operate on newHistoryId (created in 'save a new history query'), not testData.historyQueries.list[1]
    const newHistoryQuery: HistoryQueryEntity<SouthSettings, NorthSettings, SouthItemSettings> = JSON.parse(
      JSON.stringify(testData.historyQueries.list[1])
    );
    newHistoryQuery.id = newHistoryId;
    newHistoryQuery.name = 'new history query';
    newHistoryQuery.items = [];
    newHistoryQuery.northTransformers = [];
    repository.saveHistory(newHistoryQuery);

    const updatedHistoryQuery = repository.findHistoryById(newHistoryId)!;
    assert.strictEqual(updatedHistoryQuery.items.length, 0);
    assert.strictEqual(updatedHistoryQuery.northTransformers.length, 0);
  });

  it('should delete a history query', () => {
    assert.ok(repository.findHistoryById(newHistoryId));

    const beforeHistory = repository.findHistoryById(newHistoryId)!;
    const recordMock = auditService.record as unknown as ReturnType<typeof mock.fn>;
    recordMock.mock.resetCalls();
    repository.deleteHistory(newHistoryId, 'deleteUser');
    assert.strictEqual(repository.findHistoryById(newHistoryId), null);

    const historyDeleteCall = recordMock.mock.calls.find(
      call => call.arguments[0] === 'history_query' && call.arguments[1] === newHistoryId && call.arguments[2] === 'DELETE'
    );
    assert.deepStrictEqual(historyDeleteCall!.arguments, [
      'history_query',
      newHistoryId,
      'DELETE',
      {
        ...beforeHistory,
        southSettings: { ...beforeHistory.southSettings, password: '' },
        northSettings: { ...beforeHistory.northSettings, password: '' }
      },
      null,
      'deleteUser'
    ]);
    // The south/north settings' secret fields must never be persisted in the audit trail
    const redactedBefore = historyDeleteCall!.arguments[3] as { southSettings: { password: string }; northSettings: { password: string } };
    assert.strictEqual(redactedBefore.southSettings.password, '');
    assert.strictEqual(redactedBefore.northSettings.password, '');
  });

  it('should cascade-delete items and transformers when deleting a history query', () => {
    const newHistoryQuery: HistoryQueryEntity<SouthSettings, NorthSettings, SouthItemSettings> = JSON.parse(
      JSON.stringify(testData.historyQueries.list[0])
    );
    newHistoryQuery.id = '';
    newHistoryQuery.name = 'history to delete with items and transformers';
    newHistoryQuery.northTransformers = [];
    newHistoryQuery.items = [
      {
        id: '',
        name: 'item to be cascade-deleted',
        enabled: true,
        settings: {} as SouthItemSettings,
        createdBy: '',
        updatedBy: '',
        createdAt: '',
        updatedAt: ''
      }
    ];
    repository.saveHistory(newHistoryQuery);
    repository.addOrEditTransformer(
      newHistoryQuery.id,
      {
        id: '',
        transformer: testData.transformers.list[0] as Transformer,
        options: {},
        items: []
      },
      'attachUser'
    );

    const before = repository.findHistoryById(newHistoryQuery.id)!;
    assert.strictEqual(before.items.length, 1);
    assert.strictEqual(before.northTransformers.length, 1);

    const recordMock = auditService.record as unknown as ReturnType<typeof mock.fn>;
    recordMock.mock.resetCalls();
    repository.deleteHistory(newHistoryQuery.id, 'cascadeDeleteUser');

    const itemDeleteCalls = recordMock.mock.calls.filter(
      call => call.arguments[0] === 'history_query_item' && call.arguments[2] === 'DELETE'
    );
    assert.strictEqual(itemDeleteCalls.length, 1);
    assert.strictEqual(itemDeleteCalls[0].arguments[5], 'cascadeDeleteUser');

    const transformerDeleteCalls = recordMock.mock.calls.filter(
      call => call.arguments[0] === 'history_query_transformer' && call.arguments[2] === 'DELETE'
    );
    assert.strictEqual(transformerDeleteCalls.length, 1);
    assert.strictEqual(transformerDeleteCalls[0].arguments[5], 'cascadeDeleteUser');

    const historyDeleteCalls = recordMock.mock.calls.filter(
      call => call.arguments[0] === 'history_query' && call.arguments[1] === newHistoryQuery.id && call.arguments[2] === 'DELETE'
    );
    assert.strictEqual(historyDeleteCalls.length, 1);
  });

  it('should update status', () => {
    repository.updateHistoryStatus(testData.historyQueries.list[0].id, 'FINISHED');
    assert.strictEqual(repository.findHistoryById(testData.historyQueries.list[0].id)!.status, 'FINISHED');
  });

  it('should list items', () => {
    assert.strictEqual(repository.listItems(testData.historyQueries.list[1].id, { enabled: true, name: 'item' }).length, 3);
    assert.strictEqual(repository.listItems(testData.historyQueries.list[1].id, { enabled: undefined, name: undefined }).length, 3);
  });

  it('should search items', () => {
    assert.strictEqual(
      repository.searchItems(testData.historyQueries.list[1].id, { enabled: true, name: 'item', page: 0 }).totalElements,
      3
    );
    assert.strictEqual(
      repository.searchItems(testData.historyQueries.list[1].id, { enabled: undefined, name: undefined, page: 0 }).totalElements,
      3
    );
  });

  it('should find items', () => {
    const results = repository.findAllItemsForHistory(testData.historyQueries.list[1].id);
    assert.strictEqual(results.length, 3);
  });

  it('should find item', () => {
    const result = repository.findItemById(testData.historyQueries.list[1].id, testData.historyQueries.list[1].items[0].id);
    const stripped = stripAuditFields(result);
    assert.ok(stripped);
    assert.strictEqual(stripped.id, testData.historyQueries.list[1].items[0].id);
    assert.strictEqual(repository.findItemById(testData.historyQueries.list[0].id, testData.historyQueries.list[1].items[0].id), null);
  });

  it('should save a new item and audit it as CREATE', () => {
    const newItem: HistoryQueryItemEntity<SouthItemSettings> = {
      id: '',
      name: 'saveItem created item',
      enabled: true,
      settings: {} as SouthItemSettings,
      createdBy: 'creatorUser',
      updatedBy: 'creatorUser',
      createdAt: '',
      updatedAt: ''
    };
    const recordMock = auditService.record as unknown as ReturnType<typeof mock.fn>;
    recordMock.mock.resetCalls();
    repository.saveItem(testData.historyQueries.list[1].id, newItem);
    assert.ok(newItem.id);

    const created = repository.findItemById(testData.historyQueries.list[1].id, newItem.id)!;
    const createCalls = recordMock.mock.calls.filter(
      call => call.arguments[0] === 'history_query_item' && call.arguments[1] === newItem.id && call.arguments[2] === 'CREATE'
    );
    assert.strictEqual(createCalls.length, 1);
    assert.deepStrictEqual(createCalls[0].arguments, ['history_query_item', newItem.id, 'CREATE', null, created, 'creatorUser']);

    recordMock.mock.resetCalls();
    const updatedItem = { ...newItem, name: 'saveItem renamed item', updatedBy: 'updaterUser' };
    repository.saveItem(testData.historyQueries.list[1].id, updatedItem);
    const afterUpdate = repository.findItemById(testData.historyQueries.list[1].id, newItem.id)!;
    const updateCalls = recordMock.mock.calls.filter(
      call => call.arguments[0] === 'history_query_item' && call.arguments[1] === newItem.id && call.arguments[2] === 'UPDATE'
    );
    assert.strictEqual(updateCalls.length, 1);
    assert.deepStrictEqual(updateCalls[0].arguments, ['history_query_item', newItem.id, 'UPDATE', created, afterUpdate, 'updaterUser']);
  });

  it('should delete item', () => {
    const before = repository.findItemById(testData.historyQueries.list[0].id, testData.historyQueries.list[0].items[0].id);
    const recordMock = auditService.record as unknown as ReturnType<typeof mock.fn>;
    recordMock.mock.resetCalls();
    repository.deleteItem(testData.historyQueries.list[0].id, testData.historyQueries.list[0].items[0].id, 'deleteItemUser');
    assert.strictEqual(repository.findItemById(testData.historyQueries.list[0].id, testData.historyQueries.list[0].items[0].id), null);

    const deleteCall = recordMock.mock.calls.find(
      call =>
        call.arguments[0] === 'history_query_item' &&
        call.arguments[1] === testData.historyQueries.list[0].items[0].id &&
        call.arguments[2] === 'DELETE'
    );
    assert.deepStrictEqual(deleteCall!.arguments, [
      'history_query_item',
      testData.historyQueries.list[0].items[0].id,
      'DELETE',
      before,
      null,
      'deleteItemUser'
    ]);
  });

  it('should delete all item by south', () => {
    const beforeItems = repository.findAllItemsForHistory(testData.historyQueries.list[0].id);
    const recordMock = auditService.record as unknown as ReturnType<typeof mock.fn>;
    recordMock.mock.resetCalls();
    repository.deleteAllItemsByHistory(testData.historyQueries.list[0].id, 'deleteAllUser');
    assert.strictEqual(repository.findAllItemsForHistory(testData.historyQueries.list[0].id).length, 0);

    const deleteCalls = recordMock.mock.calls.filter(call => call.arguments[0] === 'history_query_item' && call.arguments[2] === 'DELETE');
    assert.strictEqual(deleteCalls.length, beforeItems.length);
    for (const call of deleteCalls) {
      assert.strictEqual(call.arguments[5], 'deleteAllUser');
    }
  });

  it('should disable and enable item', () => {
    repository.disableItem(testData.historyQueries.list[1].items[0].id);
    assert.strictEqual(
      repository.findItemById(testData.historyQueries.list[1].id, testData.historyQueries.list[1].items[0].id)!.enabled,
      false
    );
    repository.enableItem(testData.historyQueries.list[1].items[0].id);
    assert.strictEqual(
      repository.findItemById(testData.historyQueries.list[1].id, testData.historyQueries.list[1].items[0].id)!.enabled,
      true
    );
  });

  it('should save all items without deleting previous items (deleteItemsNotPresent=false)', () => {
    // deleteItemsNotPresent=false: items already in the DB but not present in itemsToSave are left untouched
    const beforeCount = repository.findAllItemsForHistory(testData.historyQueries.list[1].id).length;
    const existingItems: Array<HistoryQueryItemEntity<SouthItemSettings>> = JSON.parse(
      JSON.stringify(testData.historyQueries.list[1].items)
    );
    const newItem: HistoryQueryItemEntity<SouthItemSettings> = {
      id: '',
      name: 'new history item',
      enabled: false,
      settings: {} as SouthItemSettings,
      createdBy: '',
      updatedBy: '',
      createdAt: '',
      updatedAt: ''
    };
    const itemsToSave = [...existingItems, newItem];
    itemsToSave[0].name = 'updated name';

    repository.saveAllItems(testData.historyQueries.list[1].id, itemsToSave, false, 'saveAllUser');

    const results = repository.findAllItemsForHistory(testData.historyQueries.list[1].id);
    // Only the new item is added on top of whatever already existed; the pre-existing item is renamed, not duplicated.
    assert.strictEqual(results.length, beforeCount + 1);

    assert.strictEqual(
      repository.findItemById(testData.historyQueries.list[1].id, testData.historyQueries.list[1].items[0].id)!.name,
      itemsToSave[0].name
    );
    // newItem.id is set after saveAllItems
    assert.ok(newItem.id);
    assert.ok(repository.findItemById(testData.historyQueries.list[1].id, newItem.id));
  });

  it('should save all items and delete previous items (deleteItemsNotPresent=true)', () => {
    // deleteItemsNotPresent=true: deletes all existing items for this history query, then only inserts the new ones (id='')
    const beforeItems = repository.findAllItemsForHistory(testData.historyQueries.list[1].id);
    const newItem: HistoryQueryItemEntity<SouthItemSettings> = {
      id: '',
      name: 'new history item after delete-all',
      enabled: false,
      settings: {} as SouthItemSettings,
      createdBy: '',
      updatedBy: '',
      createdAt: '',
      updatedAt: ''
    };
    const itemsToSave = [newItem];

    const recordMock = auditService.record as unknown as ReturnType<typeof mock.fn>;
    recordMock.mock.resetCalls();
    repository.saveAllItems(testData.historyQueries.list[1].id, itemsToSave, true, 'deleteAllThenSaveUser');

    const results = repository.findAllItemsForHistory(testData.historyQueries.list[1].id);
    // deleteAll=true deletes every pre-existing item first, then only the new item gets inserted
    assert.strictEqual(results.length, 1);
    assert.ok(newItem.id);
    assert.ok(repository.findItemById(testData.historyQueries.list[1].id, newItem.id));

    const deleteAllCalls = recordMock.mock.calls.filter(
      call => call.arguments[0] === 'history_query_item' && call.arguments[2] === 'DELETE' && call.arguments[5] === 'deleteAllThenSaveUser'
    );
    assert.strictEqual(deleteAllCalls.length, beforeItems.length);
  });

  it('should not bump updated_at when saving a history query item that has not changed', () => {
    const historyQuery: HistoryQueryEntity<SouthSettings, NorthSettings, SouthItemSettings> = JSON.parse(
      JSON.stringify(testData.historyQueries.list[0])
    );
    historyQuery.id = '';
    historyQuery.name = 'unchanged item history query';
    historyQuery.northTransformers = [];
    historyQuery.items = [
      {
        id: '',
        name: 'stable item',
        enabled: true,
        settings: {} as SouthItemSettings,
        createdBy: '',
        updatedBy: '',
        createdAt: '',
        updatedAt: ''
      }
    ];
    repository.saveHistory(historyQuery);
    const itemId = historyQuery.items[0].id;

    database.prepare(`UPDATE history_items SET updated_at = '2000-01-01T00:00:00Z' WHERE id = ?;`).run(itemId);

    const resavedHistoryQuery: HistoryQueryEntity<SouthSettings, NorthSettings, SouthItemSettings> = JSON.parse(
      JSON.stringify(historyQuery)
    );
    const recordMock = auditService.record as unknown as ReturnType<typeof mock.fn>;
    recordMock.mock.resetCalls();
    repository.saveHistory(resavedHistoryQuery);

    const row = database.prepare(`SELECT updated_at FROM history_items WHERE id = ?;`).get(itemId) as { updated_at: string };
    assert.strictEqual(row.updated_at, '2000-01-01T00:00:00Z');

    const itemAuditCalls = recordMock.mock.calls.filter(call => call.arguments[0] === 'history_query_item' && call.arguments[1] === itemId);
    assert.strictEqual(itemAuditCalls.length, 0);
  });

  it('should bump updated_at when saving a history query item that has changed', () => {
    const historyQuery: HistoryQueryEntity<SouthSettings, NorthSettings, SouthItemSettings> = JSON.parse(
      JSON.stringify(testData.historyQueries.list[0])
    );
    historyQuery.id = '';
    historyQuery.name = 'changed item history query';
    historyQuery.northTransformers = [];
    historyQuery.items = [
      {
        id: '',
        name: 'item to rename',
        enabled: true,
        settings: {} as SouthItemSettings,
        createdBy: '',
        updatedBy: '',
        createdAt: '',
        updatedAt: ''
      }
    ];
    repository.saveHistory(historyQuery);
    const itemId = historyQuery.items[0].id;

    database.prepare(`UPDATE history_items SET updated_at = '2000-01-01T00:00:00Z' WHERE id = ?;`).run(itemId);

    const changedHistoryQuery: HistoryQueryEntity<SouthSettings, NorthSettings, SouthItemSettings> = JSON.parse(
      JSON.stringify(historyQuery)
    );
    changedHistoryQuery.items[0].name = 'renamed item';
    repository.saveHistory(changedHistoryQuery);

    const row = database.prepare(`SELECT updated_at FROM history_items WHERE id = ?;`).get(itemId) as { updated_at: string };
    assert.notStrictEqual(row.updated_at, '2000-01-01T00:00:00Z');
  });
});
