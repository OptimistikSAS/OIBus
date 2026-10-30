import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it, mock } from 'node:test';

import { Database } from 'better-sqlite3';

import { NorthSettings } from '../../../shared/model/connector/north-settings.model';
import { SouthItemSettings, SouthSettings } from '../../../shared/model/connector/south-settings.model';

import { HistoryQueryEntity, HistoryQueryItemEntity } from '../../model/histor-query.model';
import { HistoryTransformerWithOptions } from '../../model/transformer.model';
import { NotFoundError } from '../../model/types';
import AuditService from '../../service/audit.service';
import { emptyDatabase, initDatabase } from '../../tests/utils/database-utils';
import testData from '../../tests/utils/test-data';
import { createAuditServiceMock, Mocked, stripAuditFields } from '../../tests/utils/test-utils';
import HistoryQueryRepository from './history-query.repository';

const TEST_DB_PATH = 'src/tests/test-config-history-query.db';

type HistoryQuery = HistoryQueryEntity<SouthSettings, NorthSettings, SouthItemSettings>;
type HistoryItem = HistoryQueryItemEntity<SouthItemSettings>;
type AuditCall = Parameters<AuditService['record']>;

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

// A real "new" history query (as the UI always sends) never reuses the items/transformer links of the
// fixture it is cloned from, which belong to the other, still-existing history query: start them empty.
const newHistory = (name: string, items: Array<HistoryItem> = [], fixture = testData.historyQueries.list[0]): HistoryQuery => ({
  ...clone(fixture),
  id: '',
  name,
  items,
  northTransformers: []
});

const newItem = (name: string, overrides: Partial<HistoryItem> = {}): HistoryItem => ({
  id: '',
  name,
  description: null,
  enabled: true,
  settings: {} as SouthItemSettings,
  createdBy: '',
  updatedBy: '',
  createdAt: '',
  updatedAt: '',
  ...overrides
});

const newTransformerLink = (transformer = testData.transformers.list[0]): HistoryTransformerWithOptions => ({
  id: '',
  transformer,
  options: {},
  items: []
});

/** Matches the audit records on `entityType`, with `action` and on `entityId` when given. */
const isAudit =
  (entityType: string, action?: string, entityId?: string) =>
  ([type, id, act]: AuditCall): boolean =>
    type === entityType && (action === undefined || act === action) && (entityId === undefined || id === entityId);

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
  let auditService: Mocked<AuditService>;
  // IDs for newly created history queries, shared across tests
  let newHistoryId: string;
  let newHistoryWithoutTransformerId: string;

  beforeEach(() => {
    auditService = createAuditServiceMock();
    repository = new HistoryQueryRepository(database, auditService);
  });

  /** The arguments of every audit record made in the test so far. */
  const recorded = (): Array<AuditCall> => auditService.record.mock.calls.map(call => call.arguments);

  /** The arguments of the audit records made while running `action`. */
  const auditsDuring = (action: () => void): Array<AuditCall> => {
    const start = recorded().length;
    action();
    return recorded().slice(start);
  };

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

  it('should reject an update whose target id does not exist, instead of silently creating it', () => {
    const ghost: HistoryQuery = { ...clone(testData.historyQueries.list[0]), id: 'history-id-that-does-not-exist' };

    assert.throws(() => repository.saveHistory(ghost, false), NotFoundError);
    assert.strictEqual(repository.findHistoryById('history-id-that-does-not-exist'), null);
  });

  it('should save a new history query', () => {
    const newHistoryQuery = newHistory('new history query');
    repository.saveHistory(newHistoryQuery, true);

    assert.ok(newHistoryQuery.id);
    newHistoryId = newHistoryQuery.id;

    const createdHistoryQuery = repository.findHistoryById(newHistoryId)!;
    assert.strictEqual(createdHistoryQuery.id, newHistoryId);
    assert.strictEqual(createdHistoryQuery.name, 'new history query');
    assert.strictEqual(createdHistoryQuery.items.length, 0);

    const historyCreateCalls = recorded().filter(isAudit('history_query', 'CREATE', newHistoryId));
    assert.strictEqual(historyCreateCalls.length, 1);
    assert.deepStrictEqual(historyCreateCalls[0], [
      'history_query',
      newHistoryId,
      'CREATE',
      null,
      {
        ...createdHistoryQuery,
        southSettings: {
          ...createdHistoryQuery.southSettings,
          connectionSettings: {
            ...(createdHistoryQuery.southSettings as { connectionSettings: object }).connectionSettings,
            password: '<changed>'
          }
        }
      },
      newHistoryQuery.updatedBy
    ]);
    // The south settings' secret field must never be persisted in the audit trail, only the fact that it is set
    assert.strictEqual(
      (historyCreateCalls[0][4] as { southSettings: { connectionSettings: { password: string } } }).southSettings.connectionSettings
        .password,
      '<changed>'
    );

    const newHistoryWithoutTransformer = newHistory('new history query without transformer');
    repository.saveHistory(newHistoryWithoutTransformer, true);

    assert.ok(newHistoryWithoutTransformer.id);
    newHistoryWithoutTransformerId = newHistoryWithoutTransformer.id;

    const createdHistoryWithoutTransformer = repository.findHistoryById(newHistoryWithoutTransformerId)!;
    assert.deepStrictEqual(createdHistoryWithoutTransformer.northTransformers, []);

    const addCalls = auditsDuring(() =>
      repository.addOrEditTransformer(newHistoryWithoutTransformerId, newTransformerLink(), 'transformerUser')
    );
    const createdHistoryWithTransformer = repository.findHistoryById(newHistoryWithoutTransformerId)!;
    assert.strictEqual(createdHistoryWithTransformer.northTransformers.length, 1);
    assert.strictEqual(createdHistoryWithTransformer.northTransformers[0].transformer.id, testData.transformers.list[0].id);

    const transformerId = createdHistoryWithTransformer.northTransformers[0].id;
    const transformerCreateCalls = addCalls.filter(isAudit('history_query_transformer', 'CREATE', transformerId));
    assert.strictEqual(transformerCreateCalls.length, 1);
    assert.strictEqual(transformerCreateCalls[0][5], 'transformerUser');

    // Re-saving an unchanged transformer (as done when saving the history query) records nothing
    assert.deepStrictEqual(
      auditsDuring(() =>
        repository.addOrEditTransformer(
          newHistoryWithoutTransformerId,
          createdHistoryWithTransformer.northTransformers[0],
          'transformerUser'
        )
      ),
      []
    );

    // A changed transformer is recorded as an update
    const editCalls = auditsDuring(() =>
      repository.addOrEditTransformer(
        newHistoryWithoutTransformerId,
        { ...createdHistoryWithTransformer.northTransformers[0], options: { field: 'value' } },
        'transformerUser'
      )
    );
    const updatedTransformer = repository.findHistoryById(newHistoryWithoutTransformerId)!.northTransformers[0];
    assert.deepStrictEqual(editCalls, [
      [
        'history_query_transformer',
        transformerId,
        'UPDATE',
        createdHistoryWithTransformer.northTransformers[0],
        updatedTransformer,
        'transformerUser'
      ]
    ]);

    const removeCalls = auditsDuring(() => repository.removeTransformer(transformerId, 'removeUser'));
    const createdHistoryWithRemovedTransformer = repository.findHistoryById(newHistoryWithoutTransformerId)!;
    assert.deepStrictEqual(createdHistoryWithRemovedTransformer.northTransformers, []);
    const transformerDeleteCalls = removeCalls.filter(isAudit('history_query_transformer', 'DELETE', transformerId));
    assert.strictEqual(transformerDeleteCalls.length, 1);
    assert.strictEqual(transformerDeleteCalls[0][5], 'removeUser');
  });

  it('should preserve caller-supplied ids for the history query, its items and its transformer link (config import)', () => {
    const historyQuery: HistoryQuery = {
      ...newHistory('preserved history query', [newItem('preserved item', { id: 'preserved-history-item-id' })]),
      id: 'preserved-history-id',
      northTransformers: [{ ...newTransformerLink(), id: 'preserved-history-transformer-id' }]
    };

    repository.saveHistory(historyQuery, true);

    assert.strictEqual(historyQuery.id, 'preserved-history-id');
    const created = repository.findHistoryById('preserved-history-id');
    assert.ok(created);
    assert.strictEqual(created.items.length, 1);
    assert.strictEqual(created.items[0].id, 'preserved-history-item-id');
    assert.strictEqual(created.northTransformers.length, 1);
    assert.strictEqual(created.northTransformers[0].id, 'preserved-history-transformer-id');
  });

  it('should remove all transformers for a history query by transformer id', () => {
    const newHistoryWithoutTransformer2 = newHistory('new history without transformer 2', [], testData.historyQueries.list[1]);
    repository.saveHistory(newHistoryWithoutTransformer2, true);

    assert.ok(newHistoryWithoutTransformer2.id);

    repository.addOrEditTransformer(newHistoryWithoutTransformer2.id, newTransformerLink(), 'attachUser');
    const historyWithTransformer = repository.findHistoryById(newHistoryWithoutTransformer2.id)!;
    assert.strictEqual(historyWithTransformer.northTransformers.length, 1);
    const transformerId = historyWithTransformer.northTransformers[0].id;

    const calls = auditsDuring(() => repository.removeTransformersByTransformerId(testData.transformers.list[0].id, 'bulkRemoveUser'));
    const historyWithRemovedTransformers = repository.findHistoryById(newHistoryWithoutTransformer2.id)!;
    assert.deepStrictEqual(historyWithRemovedTransformers.northTransformers, []);

    const transformerDeleteCalls = calls.filter(isAudit('history_query_transformer', 'DELETE', transformerId));
    assert.strictEqual(transformerDeleteCalls.length, 1);
    assert.strictEqual(transformerDeleteCalls[0][5], 'bulkRemoveUser');
  });

  it('should update a history query', () => {
    const newHistoryQuery: HistoryQuery = clone(testData.historyQueries.list[1]);
    const existingItem = testData.historyQueries.list[1].items[0];
    const beforeItem = repository.findItemById(testData.historyQueries.list[1].id, existingItem.id);
    newHistoryQuery.items = [
      ...testData.historyQueries.list[1].items,
      newItem('new item', { id: 'temp_1' }),
      newItem('another item', { id: 'temp_2' })
    ];
    newHistoryQuery.items[0] = { ...newHistoryQuery.items[0], name: 'renamed existing item' };
    newHistoryQuery.northTransformers = [
      {
        ...newTransformerLink(),
        items: [{ id: 'temp_1', name: 'new item', enabled: true, createdBy: '', updatedBy: '', createdAt: '', updatedAt: '' }]
      }
    ];

    const calls = auditsDuring(() => repository.saveHistory(newHistoryQuery, false));

    const updatedHistoryQuery = repository.findHistoryById(newHistoryQuery.id)!;
    assert.strictEqual(updatedHistoryQuery.items.length, 3);
    assert.strictEqual(updatedHistoryQuery.northTransformers.length, 1);
    assert.strictEqual(updatedHistoryQuery.northTransformers[0].items.length, 1);

    assert.strictEqual(calls.filter(isAudit('history_query_item', 'CREATE')).length, 2);

    const itemUpdateCalls = calls.filter(isAudit('history_query_item', 'UPDATE', existingItem.id));
    assert.strictEqual(itemUpdateCalls.length, 1);
    assert.deepStrictEqual(itemUpdateCalls[0][3], beforeItem);

    assert.strictEqual(calls.filter(isAudit('history_query', 'UPDATE', newHistoryQuery.id)).length, 1);
  });

  it('should save a history query with a "temp_" north transformer id (treated as new)', () => {
    const newHistoryQuery: HistoryQuery = {
      ...newHistory('history query with temp transformer id', [], testData.historyQueries.list[1]),
      northTransformers: [{ ...newTransformerLink(), id: 'temp_north_1' }]
    };
    repository.saveHistory(newHistoryQuery, true);

    assert.ok(newHistoryQuery.id);
    const created = repository.findHistoryById(newHistoryQuery.id)!;
    assert.strictEqual(created.northTransformers.length, 1);
    assert.notStrictEqual(created.northTransformers[0].id, 'temp_north_1');
  });

  it('should update a history query by removing items and transformers', () => {
    // Operate on newHistoryId (created in 'save a new history query'), not testData.historyQueries.list[1]
    const newHistoryQuery = { ...newHistory('new history query', [], testData.historyQueries.list[1]), id: newHistoryId };
    repository.saveHistory(newHistoryQuery, false);

    const updatedHistoryQuery = repository.findHistoryById(newHistoryId)!;
    assert.strictEqual(updatedHistoryQuery.items.length, 0);
    assert.strictEqual(updatedHistoryQuery.northTransformers.length, 0);
  });

  it('should delete a history query', () => {
    assert.ok(repository.findHistoryById(newHistoryId));

    const beforeHistory = repository.findHistoryById(newHistoryId)!;
    const calls = auditsDuring(() => repository.deleteHistory(newHistoryId, 'deleteUser'));
    assert.strictEqual(repository.findHistoryById(newHistoryId), null);

    const historyDeleteCall = calls.find(isAudit('history_query', 'DELETE', newHistoryId));
    assert.deepStrictEqual(historyDeleteCall, [
      'history_query',
      newHistoryId,
      'DELETE',
      {
        ...beforeHistory,
        southSettings: {
          ...beforeHistory.southSettings,
          connectionSettings: { ...(beforeHistory.southSettings as { connectionSettings: object }).connectionSettings, password: '' }
        },
        northSettings: { ...beforeHistory.northSettings, password: '' }
      },
      null,
      'deleteUser'
    ]);
    // The south/north settings' secret fields must never be persisted in the audit trail
    const redactedBefore = historyDeleteCall[3] as {
      southSettings: { connectionSettings: { password: string } };
      northSettings: { password: string };
    };
    assert.strictEqual(redactedBefore.southSettings.connectionSettings.password, '');
    assert.strictEqual(redactedBefore.northSettings.password, '');
  });

  it('should cascade-delete items and transformers when deleting a history query', () => {
    const newHistoryQuery = newHistory('history to delete with items and transformers', [newItem('item to be cascade-deleted')]);
    repository.saveHistory(newHistoryQuery, true);
    repository.addOrEditTransformer(newHistoryQuery.id, newTransformerLink(), 'attachUser');

    const before = repository.findHistoryById(newHistoryQuery.id)!;
    assert.strictEqual(before.items.length, 1);
    assert.strictEqual(before.northTransformers.length, 1);

    const calls = auditsDuring(() => repository.deleteHistory(newHistoryQuery.id, 'cascadeDeleteUser'));

    const itemDeleteCalls = calls.filter(isAudit('history_query_item', 'DELETE'));
    assert.strictEqual(itemDeleteCalls.length, 1);
    assert.strictEqual(itemDeleteCalls[0][5], 'cascadeDeleteUser');

    const transformerDeleteCalls = calls.filter(isAudit('history_query_transformer', 'DELETE'));
    assert.strictEqual(transformerDeleteCalls.length, 1);
    assert.strictEqual(transformerDeleteCalls[0][5], 'cascadeDeleteUser');

    assert.strictEqual(calls.filter(isAudit('history_query', 'DELETE', newHistoryQuery.id)).length, 1);
  });

  it('should audit removed items and transformers when an update reduces (but does not empty) both lists', () => {
    const newHistoryQuery = newHistory('history with two items and transformers to reduce', [
      newItem('item-to-keep'),
      newItem('item-to-remove')
    ]);
    repository.saveHistory(newHistoryQuery, true);
    repository.addOrEditTransformer(newHistoryQuery.id, newTransformerLink(testData.transformers.list[0]), 'attachUser');
    repository.addOrEditTransformer(newHistoryQuery.id, newTransformerLink(testData.transformers.list[1]), 'attachUser');

    const before = repository.findHistoryById(newHistoryQuery.id)!;
    assert.strictEqual(before.items.length, 2);
    assert.strictEqual(before.northTransformers.length, 2);
    const keptItem = before.items.find(i => i.name === 'item-to-keep')!;
    const removedItem = before.items.find(i => i.name === 'item-to-remove')!;

    const updated: HistoryQuery = { ...clone(before), items: [keptItem], northTransformers: [before.northTransformers[0]] };
    const calls = auditsDuring(() => repository.saveHistory(updated, false));

    const after = repository.findHistoryById(newHistoryQuery.id)!;
    assert.strictEqual(after.items.length, 1);
    assert.strictEqual(after.northTransformers.length, 1);

    assert.ok(
      calls.find(isAudit('history_query_item', 'DELETE', removedItem.id)),
      'expected a DELETE audit entry for the item dropped by the update'
    );
    assert.strictEqual(calls.filter(isAudit('history_query_transformer', 'DELETE')).length, 1);
  });

  it('should audit removed items when an update clears a previously non-empty item list', () => {
    const newHistoryQuery = newHistory('history with items to fully clear', [newItem('item-to-clear')]);
    repository.saveHistory(newHistoryQuery, true);
    const before = repository.findHistoryById(newHistoryQuery.id)!;
    assert.strictEqual(before.items.length, 1);

    const calls = auditsDuring(() => repository.saveHistory({ ...clone(before), items: [] }, false));

    assert.strictEqual(repository.findHistoryById(newHistoryQuery.id)!.items.length, 0);
    assert.ok(
      calls.find(isAudit('history_query_item', 'DELETE', before.items[0].id)),
      'expected a DELETE audit entry for the item cleared by the update'
    );
  });

  it('should redact without a manifest (null "before") when the pre-transaction item snapshot cannot resolve an updated item', () => {
    // beforeItemsById is captured via findAllItemsForHistory() *before* saveHistory's transaction
    // opens; the update-path lookup inside the transaction re-queries existingItemsById
    // independently. The only way to desynchronize the two without breaking referential integrity is
    // to stub the pre-transaction snapshot call so it reports no items despite the DB still holding one.
    const newHistoryQuery = newHistory('history for desynced-before-items-snapshot test', [newItem('item-to-desync')]);
    repository.saveHistory(newHistoryQuery, true);
    const created = repository.findHistoryById(newHistoryQuery.id)!;
    const existingItem = created.items[0];

    const updated: HistoryQuery = clone(created);
    updated.items[0].name = 'desynced-before-items-snapshot';

    // The repository is rebuilt for each test: the stub needs no restore
    mock.method(repository, 'findAllItemsForHistory', () => []);
    const calls = auditsDuring(() => repository.saveHistory(updated, false));

    const updateCall = calls.find(isAudit('history_query_item', 'UPDATE', existingItem.id));
    assert.ok(updateCall, 'expected an UPDATE audit entry for the desynced item');
    assert.strictEqual(updateCall[3], null);
  });

  it('should insert and then update a transformer link, exercising both the CREATE and UPDATE audit branches', () => {
    const newHistoryQuery = newHistory('history for transformer create-then-update test');
    repository.saveHistory(newHistoryQuery, true);

    repository.addOrEditTransformer(newHistoryQuery.id, newTransformerLink(), 'attachUser');
    const transformerId = repository.findHistoryById(newHistoryQuery.id)!.northTransformers[0].id;

    const calls = auditsDuring(() =>
      repository.addOrEditTransformer(
        newHistoryQuery.id,
        { ...newTransformerLink(), id: transformerId, options: { updated: true } },
        'updateUser'
      )
    );

    assert.ok(
      calls.find(isAudit('history_query_transformer', 'UPDATE', transformerId)),
      'expected an UPDATE audit entry when re-saving an existing transformer link'
    );
    assert.deepStrictEqual(repository.findHistoryById(newHistoryQuery.id)!.northTransformers[0].options, { updated: true });
  });

  it('should return null when removing a transformer whose id does not exist', () => {
    assert.doesNotThrow(() => repository.removeTransformer('non-existent-transformer-id', 'removeUser'));
    assert.strictEqual(recorded().filter(isAudit('history_query_transformer', 'DELETE', 'non-existent-transformer-id')).length, 0);
  });

  it('should redact an unknown south/north connector type by returning settings as-is (no manifest match)', () => {
    const newHistoryQuery: HistoryQuery = {
      ...newHistory('history with unknown south/north types', [newItem('item-under-unknown-south-type')]),
      southType: 'not-a-real-south-type' as HistoryQuery['southType'],
      northType: 'not-a-real-north-type' as HistoryQuery['northType']
    };
    repository.saveHistory(newHistoryQuery, true);

    const calls = auditsDuring(() => repository.deleteHistory(newHistoryQuery.id, 'deleteUser'));

    const historyDeleteCall = calls.find(isAudit('history_query', 'DELETE', newHistoryQuery.id));
    assert.ok(historyDeleteCall);
    // With no manifest for either type, redactHistory must return both settings objects untouched.
    const redacted = historyDeleteCall[3] as { southType: string; northType: string };
    assert.strictEqual(redacted.southType, 'not-a-real-south-type');
    assert.strictEqual(redacted.northType, 'not-a-real-north-type');

    const itemDeleteCall = calls.find(isAudit('history_query_item', 'DELETE'));
    assert.ok(itemDeleteCall);
    assert.strictEqual((itemDeleteCall[3] as { name: string }).name, 'item-under-unknown-south-type');
  });

  it('should redact without a manifest (raw before/after) when saveItem is given a historyId whose history query does not exist', () => {
    // saveItem's UPDATE query matches by item id alone (not history_id), so passing a historyId that
    // doesn't resolve to a real history query still updates the row while making
    // findHistoryById(...)?.southType resolve to undefined — the only way to reach the "no southType"
    // side of saveItem's audit redaction without breaking referential integrity.
    const newHistoryQuery = newHistory('history for saveItem unknown historyId test');
    repository.saveHistory(newHistoryQuery, true);

    const item = newItem('save-item-unknown-history', { updatedBy: 'creatorUser' });
    repository.saveItem(newHistoryQuery.id, item);
    assert.ok(item.id);

    item.name = 'save-item-unknown-history-renamed';
    item.updatedBy = 'updaterUser';
    const calls = auditsDuring(() => repository.saveItem('history-id-that-does-not-exist', item));

    assert.strictEqual(calls.length, 1);
    const [, , , before, after] = calls[0];
    // No history query resolves for this (wrong) historyId => no southType => no manifest lookup;
    // findItemById(...) itself can't find the row via that same wrong id either, so both sides of the
    // audit entry come back null — the "no southType" ternary branch is what this test targets.
    assert.strictEqual(before, null);
    assert.strictEqual(after, null);
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
    assert.strictEqual(stripped.description, 'Flow of the reactor outlet');
    assert.strictEqual(repository.findItemById(testData.historyQueries.list[0].id, testData.historyQueries.list[1].items[0].id), null);
  });

  it('should save a new item and audit it as CREATE', () => {
    const historyId = testData.historyQueries.list[1].id;
    const item = newItem('saveItem created item', { createdBy: 'creatorUser', updatedBy: 'creatorUser' });
    const createCalls = auditsDuring(() => repository.saveItem(historyId, item));
    assert.ok(item.id);

    const created = repository.findItemById(historyId, item.id)!;
    assert.deepStrictEqual(createCalls.filter(isAudit('history_query_item', 'CREATE', item.id)), [
      ['history_query_item', item.id, 'CREATE', null, created, 'creatorUser']
    ]);

    const updatedItem = { ...item, name: 'saveItem renamed item', description: 'saveItem description', updatedBy: 'updaterUser' };
    const updateCalls = auditsDuring(() => repository.saveItem(historyId, updatedItem));
    const afterUpdate = repository.findItemById(historyId, item.id)!;
    assert.strictEqual(afterUpdate.description, 'saveItem description');
    assert.deepStrictEqual(updateCalls.filter(isAudit('history_query_item', 'UPDATE', item.id)), [
      ['history_query_item', item.id, 'UPDATE', created, afterUpdate, 'updaterUser']
    ]);
  });

  it('should delete item', () => {
    const historyId = testData.historyQueries.list[0].id;
    const itemId = testData.historyQueries.list[0].items[0].id;
    const before = repository.findItemById(historyId, itemId);
    const calls = auditsDuring(() => repository.deleteItem(historyId, itemId, 'deleteItemUser'));
    assert.strictEqual(repository.findItemById(historyId, itemId), null);

    assert.deepStrictEqual(calls.find(isAudit('history_query_item', 'DELETE', itemId)), [
      'history_query_item',
      itemId,
      'DELETE',
      before,
      null,
      'deleteItemUser'
    ]);
  });

  it('should delete all item by south', () => {
    const historyId = testData.historyQueries.list[0].id;
    const beforeItems = repository.findAllItemsForHistory(historyId);
    const calls = auditsDuring(() => repository.deleteAllItemsByHistory(historyId, 'deleteAllUser'));
    assert.strictEqual(repository.findAllItemsForHistory(historyId).length, 0);

    const deleteCalls = calls.filter(isAudit('history_query_item', 'DELETE'));
    assert.strictEqual(deleteCalls.length, beforeItems.length);
    for (const call of deleteCalls) {
      assert.strictEqual(call[5], 'deleteAllUser');
    }
  });

  it('should disable and enable item', () => {
    const historyId = testData.historyQueries.list[1].id;
    const itemId = testData.historyQueries.list[1].items[0].id;
    repository.disableItem(itemId);
    assert.strictEqual(repository.findItemById(historyId, itemId)!.enabled, false);
    repository.enableItem(itemId);
    assert.strictEqual(repository.findItemById(historyId, itemId)!.enabled, true);
  });

  it('should save all items without deleting previous items (deleteItemsNotPresent=false)', () => {
    // deleteItemsNotPresent=false: items already in the DB but not present in itemsToSave are left untouched
    const historyId = testData.historyQueries.list[1].id;
    const beforeCount = repository.findAllItemsForHistory(historyId).length;
    const item = newItem('new history item', { enabled: false });
    const itemsToSave = [...clone(testData.historyQueries.list[1].items), item];
    itemsToSave[0].name = 'updated name';

    repository.saveAllItems(historyId, itemsToSave, false, 'saveAllUser');

    const results = repository.findAllItemsForHistory(historyId);
    // Only the new item is added on top of whatever already existed; the pre-existing item is renamed, not duplicated.
    assert.strictEqual(results.length, beforeCount + 1);

    assert.strictEqual(repository.findItemById(historyId, testData.historyQueries.list[1].items[0].id)!.name, itemsToSave[0].name);
    // item.id is set after saveAllItems
    assert.ok(item.id);
    assert.ok(repository.findItemById(historyId, item.id));
  });

  it('should save all items and delete previous items (deleteItemsNotPresent=true)', () => {
    // deleteItemsNotPresent=true: deletes all existing items for this history query, then only inserts the new ones (id='')
    const historyId = testData.historyQueries.list[1].id;
    const beforeItems = repository.findAllItemsForHistory(historyId);
    const item = newItem('new history item after delete-all', { enabled: false });

    const calls = auditsDuring(() => repository.saveAllItems(historyId, [item], true, 'deleteAllThenSaveUser'));

    const results = repository.findAllItemsForHistory(historyId);
    // deleteAll=true deletes every pre-existing item first, then only the new item gets inserted
    assert.strictEqual(results.length, 1);
    assert.ok(item.id);
    assert.ok(repository.findItemById(historyId, item.id));

    const deleteAllCalls = calls.filter(isAudit('history_query_item', 'DELETE')).filter(call => call[5] === 'deleteAllThenSaveUser');
    assert.strictEqual(deleteAllCalls.length, beforeItems.length);
  });

  /** Saves a new history query with one item, then backdates the item's updated_at. */
  const saveHistoryWithBackdatedItem = (name: string, itemName: string): { historyQuery: HistoryQuery; itemId: string } => {
    const historyQuery = newHistory(name, [newItem(itemName)]);
    repository.saveHistory(historyQuery, true);
    const itemId = historyQuery.items[0].id;
    database.prepare(`UPDATE history_items SET updated_at = '2000-01-01T00:00:00Z' WHERE id = ?;`).run(itemId);
    return { historyQuery, itemId };
  };
  const itemUpdatedAt = (itemId: string) =>
    (database.prepare(`SELECT updated_at FROM history_items WHERE id = ?;`).get(itemId) as { updated_at: string }).updated_at;

  it('should not bump updated_at when saving a history query item that has not changed', () => {
    const { historyQuery, itemId } = saveHistoryWithBackdatedItem('unchanged item history query', 'stable item');

    const calls = auditsDuring(() => repository.saveHistory(clone(historyQuery), false));

    assert.strictEqual(itemUpdatedAt(itemId), '2000-01-01T00:00:00Z');
    assert.strictEqual(calls.filter(([type, id]) => type === 'history_query_item' && id === itemId).length, 0);
  });

  it('should bump updated_at when saving a history query item that has changed', () => {
    const { historyQuery, itemId } = saveHistoryWithBackdatedItem('changed item history query', 'item to rename');

    const changedHistoryQuery = clone(historyQuery);
    changedHistoryQuery.items[0].name = 'renamed item';
    repository.saveHistory(changedHistoryQuery, false);

    assert.notStrictEqual(itemUpdatedAt(itemId), '2000-01-01T00:00:00Z');
  });
});
