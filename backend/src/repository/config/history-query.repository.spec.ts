import { before, after, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Database } from 'better-sqlite3';
import { emptyDatabase, initDatabase, stripAuditFields } from '../../tests/utils/test-utils';
import testData from '../../tests/utils/test-data';
import HistoryQueryRepository from './history-query.repository';
import { HistoryQueryEntity, HistoryQueryItemEntity } from '../../model/histor-query.model';
import { SouthItemSettings, SouthSettings } from '../../../shared/model/south-settings.model';
import { NorthSettings } from '../../../shared/model/north-settings.model';
import { Transformer } from '../../model/transformer.model';

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
  // IDs for newly created history queries, shared across tests
  let newHistoryId: string;
  let newHistoryWithoutTransformerId: string;

  beforeEach(() => {
    repository = new HistoryQueryRepository(database);
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

    repository.addOrEditTransformer(newHistoryWithoutTransformerId, {
      id: '',
      transformer: testData.transformers.list[0] as Transformer,
      options: {},
      items: []
    });
    const createdHistoryWithTransformer = repository.findHistoryById(newHistoryWithoutTransformerId)!;
    assert.strictEqual(createdHistoryWithTransformer.northTransformers.length, 1);
    assert.strictEqual(createdHistoryWithTransformer.northTransformers[0].transformer.id, testData.transformers.list[0].id);

    const transformerId = createdHistoryWithTransformer.northTransformers[0].id;
    repository.removeTransformer(transformerId);
    const createdHistoryWithRemovedTransformer = repository.findHistoryById(newHistoryWithoutTransformerId)!;
    assert.deepStrictEqual(createdHistoryWithRemovedTransformer.northTransformers, []);
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

    repository.addOrEditTransformer(newHistoryWithoutTransformer2.id, {
      id: '',
      transformer: testData.transformers.list[0] as Transformer,
      options: {},
      items: []
    });
    const historyWithTransformer = repository.findHistoryById(newHistoryWithoutTransformer2.id)!;
    assert.strictEqual(historyWithTransformer.northTransformers.length, 1);

    repository.removeTransformersByTransformerId(testData.transformers.list[0].id);
    const historyWithRemovedTransformers = repository.findHistoryById(newHistoryWithoutTransformer2.id)!;
    assert.deepStrictEqual(historyWithRemovedTransformers.northTransformers, []);
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
    newHistoryQuery.items = [
      ...testData.historyQueries.list[1].items,
      newItem1,
      newItem2
    ];
    newHistoryQuery.northTransformers = [
      {
        id: '',
        transformer: testData.transformers.list[0],
        options: {},
        items: [{ id: 'temp_1', name: 'new item', enabled: true, createdBy: '', updatedBy: '', createdAt: '', updatedAt: '' }]
      }
    ];
    repository.saveHistory(newHistoryQuery);

    const updatedHistoryQuery = repository.findHistoryById(newHistoryQuery.id)!;
    assert.strictEqual(updatedHistoryQuery.items.length, 3);
    assert.strictEqual(updatedHistoryQuery.northTransformers.length, 1);
    assert.strictEqual(updatedHistoryQuery.northTransformers[0].items.length, 1);
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
    repository.deleteHistory(newHistoryId);
    assert.strictEqual(repository.findHistoryById(newHistoryId), null);
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

  it('should delete item', () => {
    repository.deleteItem(testData.historyQueries.list[0].id, testData.historyQueries.list[0].items[0].id);
    assert.strictEqual(repository.findItemById(testData.historyQueries.list[0].id, testData.historyQueries.list[0].items[0].id), null);
  });

  it('should delete all item by south', () => {
    repository.deleteAllItemsByHistory(testData.historyQueries.list[0].id);
    assert.strictEqual(repository.findAllItemsForHistory(testData.historyQueries.list[0].id).length, 0);
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

  it('should save all items without and delete previous items', () => {
    // At this point list[1] has 3 items (from 'update a history query' test)
    // saveAllItems with deleteItemsNotPresent=false: keeps existing items not in the list
    const existingItems: Array<HistoryQueryItemEntity<SouthItemSettings>> = JSON.parse(JSON.stringify(testData.historyQueries.list[1].items));
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

    repository.saveAllItems(testData.historyQueries.list[1].id, itemsToSave, false);

    const results = repository.findAllItemsForHistory(testData.historyQueries.list[1].id);
    assert.strictEqual(results.length, 4);

    assert.strictEqual(
      repository.findItemById(testData.historyQueries.list[1].id, testData.historyQueries.list[1].items[0].id)!.name,
      itemsToSave[0].name
    );
    // newItem.id is set after saveAllItems
    assert.ok(newItem.id);
    assert.ok(repository.findItemById(testData.historyQueries.list[1].id, newItem.id));
  });

  it('should save all items without deleting previous items', () => {
    // deleteItemsNotPresent=true: deletes all existing items, then only inserts new ones (id='')
    // list[0].items were deleted, so their IDs won't match anything after the delete
    const existingItems: Array<HistoryQueryItemEntity<SouthItemSettings>> = JSON.parse(JSON.stringify(testData.historyQueries.list[0].items));
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

    repository.saveAllItems(testData.historyQueries.list[1].id, itemsToSave, true);

    const results = repository.findAllItemsForHistory(testData.historyQueries.list[1].id);
    // deleteAll=true deletes all 4 items, then only the new item (id='') gets inserted
    // items with existing IDs get UPDATE which matches nothing (already deleted)
    assert.strictEqual(results.length, 1);
    assert.ok(newItem.id);
    assert.ok(repository.findItemById(testData.historyQueries.list[1].id, newItem.id));
  });
});
