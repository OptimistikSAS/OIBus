import { beforeEach, afterEach, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { Database } from 'better-sqlite3';
import SouthCacheRepository from './south-cache.repository';

describe('SouthCacheRepository', () => {
  let repository: SouthCacheRepository;
  let runMock: ReturnType<typeof mock.fn>;
  let getMock: ReturnType<typeof mock.fn>;
  let allMock: ReturnType<typeof mock.fn>;
  let prepareMock: ReturnType<typeof mock.fn>;

  beforeEach(() => {
    runMock = mock.fn();
    getMock = mock.fn();
    allMock = mock.fn();
    prepareMock = mock.fn(() => ({ run: runMock, get: getMock, all: allMock }));
    const mockDatabase = { prepare: prepareMock, run: runMock, get: getMock, all: allMock };
    repository = new SouthCacheRepository(mockDatabase as unknown as Database);
  });

  afterEach(() => {
    mock.restoreAll();
  });

  it('createItemValueTable() should create table with correct schema', () => {
    repository.createItemValueTable('south1');
    assert.ok(prepareMock.mock.calls.some(c => (c.arguments[0] as string).includes('south_item_cache_south1')));
    assert.ok(runMock.mock.calls.length > 0);
  });

  it('dropItemValueTable() should drop table', () => {
    repository.dropItemValueTable('south1');
    assert.deepStrictEqual(prepareMock.mock.calls[0].arguments, ['DROP TABLE IF EXISTS "south_item_cache_south1";']);
    assert.ok(runMock.mock.calls.length > 0);
  });

  describe('getItemLastValue', () => {
    it('should return null if result is undefined', () => {
      getMock.mock.mockImplementationOnce(() => undefined);
      const result = repository.getItemLastValue('south1', 'item1');
      assert.strictEqual(result, null);
    });

    it('should look up by item_id only (not group_id)', () => {
      getMock.mock.mockImplementationOnce(() => undefined);
      repository.getItemLastValue('south1', 'item1');
      assert.ok(prepareMock.mock.calls.some(c => (c.arguments[0] as string).includes('WHERE item_id = ?')));
      const sql = prepareMock.mock.calls.at(-1)!.arguments[0] as string;
      assert.doesNotMatch(sql, /AND group_id/);
    });

    it('should return parsed value', () => {
      getMock.mock.mockImplementationOnce(() => ({
        item_id: 'item1',
        query_time: '2023-01-01',
        value: '{"a":1}',
        tracked_instant: '2023-01-01'
      }));
      const result = repository.getItemLastValue('south1', 'item1');
      assert.deepStrictEqual(result, {
        itemId: 'item1',
        groupId: null,
        queryTime: '2023-01-01',
        value: { a: 1 },
        trackedInstant: '2023-01-01'
      });
    });

    it('should return raw value if parse fails', () => {
      getMock.mock.mockImplementationOnce(() => ({
        item_id: 'item1',
        value: 'invalid-json'
      }));
      const result = repository.getItemLastValue('south1', 'item1');
      assert.strictEqual(result?.value, 'invalid-json');
    });

    it('should return null on db error', () => {
      prepareMock.mock.mockImplementationOnce(() => {
        throw new Error('DB Error');
      });
      const result = repository.getItemLastValue('south1', 'item1');
      assert.strictEqual(result, null);
    });
  });

  describe('saveItemLastValue', () => {
    it('should execute a single statement (no SELECT-then-write round-trip)', () => {
      repository.saveItemLastValue('south1', { itemId: 'item1', groupId: 'group1', value: 1, trackedInstant: 'now', queryTime: 'now' });
      assert.strictEqual(prepareMock.mock.calls.length, 1);
      assert.strictEqual(getMock.mock.calls.length, 0);
      assert.ok((prepareMock.mock.calls[0].arguments[0] as string).includes('INSERT OR REPLACE INTO "south_item_cache_south1"'));
      assert.deepStrictEqual(runMock.mock.calls[0].arguments, ['group1', 'item1', 'now', '1', 'now']);
    });

    it('should pass null group_id through when item has no group', () => {
      repository.saveItemLastValue('south1', { itemId: 'item1', groupId: null, value: 1, trackedInstant: 'now', queryTime: 'now' });
      assert.deepStrictEqual(runMock.mock.calls[0].arguments, [null, 'item1', 'now', '1', 'now']);
    });

    it('should rewrite group_id when the row already exists', () => {
      repository.saveItemLastValue('south1', { itemId: 'item1', groupId: 'group1', value: 42, trackedInstant: 'now', queryTime: 'now' });
      assert.ok((prepareMock.mock.calls[0].arguments[0] as string).includes('INSERT OR REPLACE'));
      assert.deepStrictEqual(runMock.mock.calls[0].arguments, ['group1', 'item1', 'now', '42', 'now']);
    });

    it('should store null when value is null', () => {
      repository.saveItemLastValue('south1', { itemId: 'item1', groupId: 'group1', value: null, trackedInstant: 'now', queryTime: 'now' });
      assert.ok(prepareMock.mock.calls.some(c => (c.arguments[0] as string).includes('INSERT OR REPLACE')));
      assert.deepStrictEqual(runMock.mock.calls[0].arguments, ['group1', 'item1', 'now', null, 'now']);
    });

    it('should reuse the cached prepared statement on subsequent saves for the same connector', () => {
      repository.saveItemLastValue('south1', { itemId: 'item1', groupId: 'g', value: 1, trackedInstant: 't', queryTime: 't' });
      repository.saveItemLastValue('south1', { itemId: 'item2', groupId: 'g', value: 2, trackedInstant: 't', queryTime: 't' });
      // prepare() ran once total (cache hit on the second call).
      assert.strictEqual(prepareMock.mock.calls.length, 1);
      assert.strictEqual(runMock.mock.calls.length, 2);
    });

    it('should drop the cached statement when the table is recreated', () => {
      repository.saveItemLastValue('south1', { itemId: 'item1', groupId: 'g', value: 1, trackedInstant: 't', queryTime: 't' });
      repository.createItemValueTable('south1'); // invalidates the cache
      repository.saveItemLastValue('south1', { itemId: 'item2', groupId: 'g', value: 2, trackedInstant: 't', queryTime: 't' });
      // 1 UPSERT prepare + 1 CREATE TABLE prepare + 1 second UPSERT prepare
      assert.strictEqual(prepareMock.mock.calls.length, 3);
    });
  });

  describe('deleteItemValue', () => {
    it('should delete by item_id only', () => {
      repository.deleteItemValue('south1', 'item1');
      assert.ok(
        prepareMock.mock.calls.some(c => (c.arguments[0] as string).includes('DELETE FROM "south_item_cache_south1" WHERE item_id = ?'))
      );
      assert.deepStrictEqual(runMock.mock.calls[0].arguments, ['item1']);
    });

    it('should catch error', () => {
      prepareMock.mock.mockImplementationOnce(() => {
        throw new Error('DB Error');
      });
      assert.doesNotThrow(() => repository.deleteItemValue('south1', 'item1'));
    });
  });
});
