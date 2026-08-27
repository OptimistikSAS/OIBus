import { before, after, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Database } from 'better-sqlite3';
import { emptyDatabase, initDatabase } from '../../tests/utils/test-utils';
import SouthCacheRepository from './south-cache.repository';

const TEST_DB_PATH = 'src/tests/test-cache-db.db';

let database: Database;
describe('Repository with populated database', () => {
  before(async () => {
    database = await initDatabase('cache', true, TEST_DB_PATH);
  });

  after(async () => {
    database.close();
    await emptyDatabase('cache', TEST_DB_PATH);
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

    it('should return null from getGroupLastValue when no row with that group exists', () => {
      assert.strictEqual(repository.getGroupLastValue('southId', 'nonexistent-group'), null);
    });

    it('getGroupLastValue should return the cached entry saved with that group_id', () => {
      repository.saveItemLastValue('southId', { itemId: 'lead-item', groupId: 'grp1', value: 'gv', queryTime: 'qt', trackedInstant: 'ts' });
      const result = repository.getGroupLastValue('southId', 'grp1');
      assert.ok(result);
      assert.strictEqual(result!.groupId, 'grp1');
      assert.strictEqual(result!.value, 'gv');
    });

    it('getGroupLastValue should be scoped to the connector', () => {
      repository.saveItemLastValue('southA', { itemId: 'item1', groupId: 'grp1', value: 'A', queryTime: 'now', trackedInstant: 'ts' });
      repository.saveItemLastValue('southB', { itemId: 'item1', groupId: 'grp1', value: 'B', queryTime: 'now', trackedInstant: 'ts' });
      assert.strictEqual(repository.getGroupLastValue('southA', 'grp1')!.value, 'A');
      assert.strictEqual(repository.getGroupLastValue('southB', 'grp1')!.value, 'B');
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

    describe('saveItemsLastValues', () => {
      it('should do nothing when values is empty', () => {
        assert.doesNotThrow(() => repository.saveItemsLastValues('southId', []));
      });

      it('should batch-insert more than 100 items across multiple internal chunks', () => {
        const values = Array.from({ length: 250 }, (_, i) => ({ itemId: `item${i}`, value: i, instant: `2023-01-01T00:00:${i}Z` }));
        repository.saveItemsLastValues('southId', values);

        for (const value of values) {
          const result = repository.getItemLastValue('southId', value.itemId);
          assert.ok(result, `expected a row for ${value.itemId}`);
          assert.strictEqual(result!.value, value.value);
          assert.strictEqual(result!.trackedInstant, value.instant);
          assert.strictEqual(result!.groupId, null);
        }

        const total = database.prepare('SELECT COUNT(*) as count FROM south_item_cache WHERE south_id = ?').get('southId') as {
          count: number;
        };
        assert.strictEqual(total.count, 250);
      });

      it('should update existing rows instead of creating duplicates (upsert semantics)', () => {
        repository.saveItemsLastValues('southId', [{ itemId: 'item1', value: 'v1', instant: 'ts1' }]);
        repository.saveItemsLastValues('southId', [{ itemId: 'item1', value: 'v2', instant: 'ts2' }]);

        const result = repository.getItemLastValue('southId', 'item1');
        assert.strictEqual(result!.value, 'v2');
        assert.strictEqual(result!.trackedInstant, 'ts2');

        const total = database
          .prepare('SELECT COUNT(*) as count FROM south_item_cache WHERE south_id = ? AND item_id = ?')
          .get('southId', 'item1') as { count: number };
        assert.strictEqual(total.count, 1);
      });

      it('should not collide with an existing group-keyed row (item_id IS NULL) for the same group', () => {
        repository.saveGroupLastValue('southId', 'group1', { value: 'group-value', queryTime: 'gt', trackedInstant: 'gts' });
        repository.saveItemsLastValues('southId', [{ itemId: 'item1', value: 'item-value', instant: 'its' }]);

        const groupResult = repository.getGroupLastValue('southId', 'group1');
        assert.ok(groupResult);
        assert.strictEqual(groupResult!.value, 'group-value');
        assert.strictEqual(groupResult!.itemId, null);

        const itemResult = repository.getItemLastValue('southId', 'item1');
        assert.ok(itemResult);
        assert.strictEqual(itemResult!.value, 'item-value');

        const total = database.prepare('SELECT COUNT(*) as count FROM south_item_cache WHERE south_id = ?').get('southId') as {
          count: number;
        };
        assert.strictEqual(total.count, 2);
      });

      it('should overwrite a row saved with a duplicate itemId within the same batch (last one wins)', () => {
        repository.saveItemsLastValues('southId', [
          { itemId: 'item1', value: 'first', instant: 'ts1' },
          { itemId: 'item1', value: 'second', instant: 'ts2' }
        ]);

        const result = repository.getItemLastValue('southId', 'item1');
        assert.strictEqual(result!.value, 'second');
        const total = database
          .prepare('SELECT COUNT(*) as count FROM south_item_cache WHERE south_id = ? AND item_id = ?')
          .get('southId', 'item1') as { count: number };
        assert.strictEqual(total.count, 1);
      });
    });

    describe('getItemsLastValues', () => {
      it('should return an empty map when itemIds is empty', () => {
        const result = repository.getItemsLastValues('southId', []);
        assert.strictEqual(result.size, 0);
      });

      it('should return an empty map when southId has no matching rows', () => {
        const result = repository.getItemsLastValues('nonexistent', ['item1', 'item2']);
        assert.strictEqual(result.size, 0);
      });

      it('should return a map keyed by itemId for the requested ids only', () => {
        repository.saveItemLastValue('southId', { itemId: 'item1', groupId: null, value: 'v1', queryTime: 'q', trackedInstant: 't1' });
        repository.saveItemLastValue('southId', { itemId: 'item2', groupId: null, value: 'v2', queryTime: 'q', trackedInstant: 't2' });
        repository.saveItemLastValue('southId', { itemId: 'item3', groupId: null, value: 'v3', queryTime: 'q', trackedInstant: 't3' });

        const result = repository.getItemsLastValues('southId', ['item1', 'item3', 'not-there']);
        assert.strictEqual(result.size, 2);
        assert.strictEqual(result.get('item1')!.value, 'v1');
        assert.strictEqual(result.get('item3')!.value, 'v3');
        assert.strictEqual(result.has('item2'), false);
      });

      it('should batch-read more than 100 items across multiple internal chunks', () => {
        const values = Array.from({ length: 250 }, (_, i) => ({ itemId: `item${i}`, value: i, instant: `ts${i}` }));
        repository.saveItemsLastValues('southId', values);

        const result = repository.getItemsLastValues(
          'southId',
          values.map(v => v.itemId)
        );
        assert.strictEqual(result.size, 250);
        for (const value of values) {
          assert.strictEqual(result.get(value.itemId)!.value, value.value);
        }
      });

      it('should not include group-keyed rows (item_id IS NULL) in the result', () => {
        repository.saveGroupLastValue('southId', 'group1', { value: 'group-value', queryTime: 'gt', trackedInstant: 'gts' });
        repository.saveItemLastValue('southId', { itemId: 'item1', groupId: 'group1', value: 'v1', queryTime: 'q', trackedInstant: 't1' });

        const result = repository.getItemsLastValues('southId', ['item1', 'group1']);
        assert.strictEqual(result.size, 1);
        assert.strictEqual(result.get('item1')!.value, 'v1');
      });

      it('should scope results to the requested connector', () => {
        repository.saveItemLastValue('southA', { itemId: 'item1', groupId: null, value: 'A', queryTime: 'q', trackedInstant: 't' });
        repository.saveItemLastValue('southB', { itemId: 'item1', groupId: null, value: 'B', queryTime: 'q', trackedInstant: 't' });

        const result = repository.getItemsLastValues('southA', ['item1']);
        assert.strictEqual(result.size, 1);
        assert.strictEqual(result.get('item1')!.value, 'A');
      });
    });
  });
});
