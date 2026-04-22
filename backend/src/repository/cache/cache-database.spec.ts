import { before, after, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Database } from 'better-sqlite3';
import { emptyDatabase, initDatabase } from '../../tests/utils/test-utils';
import SouthCacheRepository from './south-cache.repository';

let database: Database;
describe('Repository with populated database', () => {
  before(async () => {
    database = await initDatabase('cache');
  });

  after(async () => {
    database.close();
    await emptyDatabase('cache');
  });

  describe('South Cache', () => {
    let repository: SouthCacheRepository;

    beforeEach(() => {
      repository = new SouthCacheRepository(database);
      repository.createItemValueTable('southId');
    });

    it('should return null from getItemLastValue when table does not exist', () => {
      const result = repository.getItemLastValue('nonexistent-connector', 'groupId', 'someItemId');
      assert.strictEqual(result, null);
    });

    it('should handle invalid JSON in value when getting item last value', () => {
      repository.createItemValueTable('invalidJsonConnector');
      database
        .prepare(
          `INSERT INTO "south_item_cache_invalidJsonConnector" (item_id, group_id, query_time, value, tracked_instant) VALUES (?, ?, ?, ?, ?)`
        )
        .run('item1', null, null, 'not valid json', null);
      const result = repository.getItemLastValue('invalidJsonConnector', null, 'item1');
      assert.notStrictEqual(result, null);
      assert.strictEqual(result!.itemId, 'item1');
      assert.strictEqual(result!.value, 'not valid json');
      repository.dropItemValueTable('invalidJsonConnector');
    });

    it('should ignore deleteItemValue when table does not exist', () => {
      assert.doesNotThrow(() => repository.deleteItemValue('nonexistent-connector', 'groupId', 'itemId'));
    });

    it('should save and update item with group id', () => {
      repository.saveItemLastValue('southId', { itemId: 'item1', groupId: 'group1', value: 'v1', queryTime: 'now', trackedInstant: 'ts1' });
      repository.saveItemLastValue('southId', {
        itemId: 'item1',
        groupId: 'group1',
        value: 'v2',
        queryTime: 'now2',
        trackedInstant: 'ts2'
      });
      const result = repository.getItemLastValue('southId', 'group1', 'item1');
      assert.strictEqual(result!.value, 'v2');
      assert.strictEqual(result!.trackedInstant, 'ts2');
    });

    it('should save and update item with null group id', () => {
      repository.saveItemLastValue('southId', { itemId: 'item2', groupId: null, value: 'v1', queryTime: 'now', trackedInstant: 'ts1' });
      repository.saveItemLastValue('southId', { itemId: 'item2', groupId: null, value: 'v2', queryTime: 'now2', trackedInstant: 'ts2' });
      const result = repository.getItemLastValue('southId', null, 'item2');
      assert.strictEqual(result!.value, 'v2');
      assert.strictEqual(result!.trackedInstant, 'ts2');
    });

    it('should delete item by groupId and itemId', () => {
      repository.saveItemLastValue('southId', { itemId: 'item3', groupId: 'group1', value: 'v', queryTime: 'now', trackedInstant: 'now' });
      assert.ok(repository.getItemLastValue('southId', 'group1', 'item3'));
      repository.deleteItemValue('southId', 'group1', 'item3');
      assert.strictEqual(repository.getItemLastValue('southId', 'group1', 'item3'), null);
    });

    it('should delete item with null groupId using IS NULL', () => {
      repository.saveItemLastValue('southId', { itemId: 'item4', groupId: null, value: 'v', queryTime: 'now', trackedInstant: 'now' });
      assert.ok(repository.getItemLastValue('southId', null, 'item4'));
      repository.deleteItemValue('southId', null, 'item4');
      assert.strictEqual(repository.getItemLastValue('southId', null, 'item4'), null);
    });
  });
});
