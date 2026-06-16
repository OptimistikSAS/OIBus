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
      // Clean up between tests so they don't interfere.
      database.prepare('DELETE FROM south_item_cache').run();
    });

    it('should return null from getItemLastValue when no row exists', () => {
      const result = repository.getItemLastValue('nonexistent-connector', 'someItemId');
      assert.strictEqual(result, null);
    });

    it('should handle invalid JSON in value when getting item last value', () => {
      database
        .prepare('INSERT INTO south_item_cache (south_id, item_id, group_id, query_time, value, tracked_instant) VALUES (?, ?, ?, ?, ?, ?)')
        .run('invalidJsonConnector', 'item1', null, null, 'not valid json', null);
      const result = repository.getItemLastValue('invalidJsonConnector', 'item1');
      assert.notStrictEqual(result, null);
      assert.strictEqual(result!.itemId, 'item1');
      assert.strictEqual(result!.value, 'not valid json');
    });

    it('should ignore deleteItemValue when no matching row exists', () => {
      assert.doesNotThrow(() => repository.deleteItemValue('nonexistent-connector', 'itemId'));
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
      const result = repository.getItemLastValue('southId', 'item1');
      assert.strictEqual(result!.value, 'v2');
      assert.strictEqual(result!.trackedInstant, 'ts2');
    });

    it('should save and update item with null group id', () => {
      repository.saveItemLastValue('southId', { itemId: 'item2', groupId: null, value: 'v1', queryTime: 'now', trackedInstant: 'ts1' });
      repository.saveItemLastValue('southId', { itemId: 'item2', groupId: null, value: 'v2', queryTime: 'now2', trackedInstant: 'ts2' });
      const result = repository.getItemLastValue('southId', 'item2');
      assert.strictEqual(result!.value, 'v2');
      assert.strictEqual(result!.trackedInstant, 'ts2');
    });

    it('should keep items from different connectors independent', () => {
      repository.saveItemLastValue('southA', { itemId: 'item1', groupId: null, value: 'A', queryTime: 'now', trackedInstant: 'ts1' });
      repository.saveItemLastValue('southB', { itemId: 'item1', groupId: null, value: 'B', queryTime: 'now', trackedInstant: 'ts2' });
      assert.strictEqual(repository.getItemLastValue('southA', 'item1')!.value, 'A');
      assert.strictEqual(repository.getItemLastValue('southB', 'item1')!.value, 'B');
    });

    it('should delete item by itemId', () => {
      repository.saveItemLastValue('southId', { itemId: 'item3', groupId: 'group1', value: 'v', queryTime: 'now', trackedInstant: 'now' });
      assert.ok(repository.getItemLastValue('southId', 'item3'));
      repository.deleteItemValue('southId', 'item3');
      assert.strictEqual(repository.getItemLastValue('southId', 'item3'), null);
    });

    it('should delete item with null groupId', () => {
      repository.saveItemLastValue('southId', { itemId: 'item4', groupId: null, value: 'v', queryTime: 'now', trackedInstant: 'now' });
      assert.ok(repository.getItemLastValue('southId', 'item4'));
      repository.deleteItemValue('southId', 'item4');
      assert.strictEqual(repository.getItemLastValue('southId', 'item4'), null);
    });

    it('deleteItemsBySouth should remove all rows for the connector and leave others intact', () => {
      repository.saveItemLastValue('southA', { itemId: 'i1', groupId: null, value: 'v', queryTime: 'now', trackedInstant: 'ts' });
      repository.saveItemLastValue('southA', { itemId: 'i2', groupId: null, value: 'v', queryTime: 'now', trackedInstant: 'ts' });
      repository.saveItemLastValue('southB', { itemId: 'i1', groupId: null, value: 'v', queryTime: 'now', trackedInstant: 'ts' });

      repository.deleteItemsBySouth('southA');

      assert.strictEqual(repository.getItemLastValue('southA', 'i1'), null);
      assert.strictEqual(repository.getItemLastValue('southA', 'i2'), null);
      assert.ok(repository.getItemLastValue('southB', 'i1'));
    });
  });
});
