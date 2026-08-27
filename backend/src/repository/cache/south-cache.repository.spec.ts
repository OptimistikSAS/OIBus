import { beforeEach, afterEach, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { Database, Statement } from 'better-sqlite3';
import SouthCacheRepository from './south-cache.repository';

describe('SouthCacheRepository', () => {
  let repository: SouthCacheRepository;
  let runMock: ReturnType<typeof mock.fn>;
  let getMock: ReturnType<typeof mock.fn>;
  let prepareMock: ReturnType<typeof mock.fn>;

  beforeEach(() => {
    runMock = mock.fn(() => ({ changes: 1 }));
    getMock = mock.fn();
    prepareMock = mock.fn(() => ({ run: runMock, get: getMock }) as unknown as Statement);
    // better-sqlite3's real `database.transaction(fn)` returns a wrapped function that runs `fn`
    // inside a transaction when called; this mock just returns `fn` itself so calling it invokes
    // the callback synchronously, close enough for unit-testing saveItemsLastValues' chunk loop.
    const mockDatabase = {
      prepare: prepareMock,
      transaction: (fn: (...args: Array<unknown>) => void) => fn
    } as unknown as Database;
    repository = new SouthCacheRepository(mockDatabase);
  });

  afterEach(() => {
    mock.restoreAll();
  });

  it('prepares all nine statements once at construction', () => {
    // 9 statements: get, getByGroup, upsert, getCachedValue, upsertCachedValue, updateGroup, insertGroup, delete, deleteAllBySouth
    assert.strictEqual(prepareMock.mock.calls.length, 9);
  });

  describe('getItemLastValue', () => {
    it('should return null if row is not found', () => {
      getMock.mock.mockImplementationOnce(() => undefined);
      const result = repository.getItemLastValue('south1', 'item1');
      assert.strictEqual(result, null);
    });

    it('should query by south_id and item_id', () => {
      getMock.mock.mockImplementationOnce(() => undefined);
      repository.getItemLastValue('south1', 'item1');
      const sql = prepareMock.mock.calls[0].arguments[0] as string;
      assert.ok(sql.includes('south_id = ?'));
      assert.ok(sql.includes('item_id = ?'));
    });

    it('should return parsed value', () => {
      getMock.mock.mockImplementationOnce(() => ({
        south_id: 'south1',
        item_id: 'item1',
        group_id: 'group1',
        query_time: '2023-01-01',
        value: '{"a":1}',
        tracked_instant: '2023-01-01'
      }));
      const result = repository.getItemLastValue('south1', 'item1');
      assert.deepStrictEqual(result, {
        itemId: 'item1',
        groupId: 'group1',
        queryTime: '2023-01-01',
        value: { a: 1 },
        trackedInstant: '2023-01-01'
      });
    });

    it('should return raw value if JSON parse fails', () => {
      getMock.mock.mockImplementationOnce(() => ({ item_id: 'item1', value: 'not-json' }));
      const result = repository.getItemLastValue('south1', 'item1');
      assert.strictEqual(result?.value, 'not-json');
    });
  });

  describe('getGroupLastValue', () => {
    it('should return null if no row matches the group', () => {
      getMock.mock.mockImplementationOnce(() => undefined);
      assert.strictEqual(repository.getGroupLastValue('south1', 'grp1'), null);
    });

    it('should query by south_id and group_id', () => {
      getMock.mock.mockImplementationOnce(() => undefined);
      repository.getGroupLastValue('south1', 'grp1');
      const sql = prepareMock.mock.calls[1].arguments[0] as string;
      assert.ok(sql.includes('south_id = ?'));
      assert.ok(sql.includes('group_id = ?'));
    });

    it('should return a row whose item_id is null', () => {
      getMock.mock.mockImplementationOnce(() => ({
        south_id: 'south1',
        item_id: null,
        group_id: 'group1',
        query_time: '2023-01-01',
        value: '{"a":1}',
        tracked_instant: '2023-01-01'
      }));
      const result = repository.getGroupLastValue('south1', 'group1');
      assert.deepStrictEqual(result, {
        itemId: null,
        groupId: 'group1',
        queryTime: '2023-01-01',
        value: { a: 1 },
        trackedInstant: '2023-01-01'
      });
    });
  });

  describe('saveItemLastValue', () => {
    it('should upsert into south_item_cache scoped to its own columns (never a blanket REPLACE, which would wipe cached_value/cached_instant)', () => {
      repository.saveItemLastValue('south1', { itemId: 'item1', groupId: 'group1', value: 1, trackedInstant: 'now', queryTime: 'now' });
      const sql = prepareMock.mock.calls[2].arguments[0] as string;
      assert.ok(sql.includes('INSERT INTO south_item_cache'));
      assert.ok(sql.includes('ON CONFLICT'));
      assert.ok(sql.includes('DO UPDATE'));
      assert.ok(!sql.includes('cached_value'));
      assert.ok(sql.includes('south_id'));
      assert.deepStrictEqual(runMock.mock.calls[0].arguments, ['south1', 'group1', 'item1', 'now', '1', 'now']);
    });

    it('should pass null group_id when item has no group', () => {
      repository.saveItemLastValue('south1', { itemId: 'item1', groupId: null, value: 1, trackedInstant: 'now', queryTime: 'now' });
      assert.deepStrictEqual(runMock.mock.calls[0].arguments, ['south1', null, 'item1', 'now', '1', 'now']);
    });

    it('should store null when value is null', () => {
      repository.saveItemLastValue('south1', { itemId: 'item1', groupId: null, value: null, trackedInstant: 'now', queryTime: 'now' });
      assert.deepStrictEqual(runMock.mock.calls[0].arguments, ['south1', null, 'item1', 'now', null, 'now']);
    });

    it('should reuse the single prepared statement for any connector', () => {
      repository.saveItemLastValue('south1', { itemId: 'item1', groupId: 'g', value: 1, trackedInstant: 't', queryTime: 't' });
      repository.saveItemLastValue('south2', { itemId: 'item2', groupId: 'g', value: 2, trackedInstant: 't', queryTime: 't' });
      // prepare() still called only 9 times total (constructor) — no new preparations.
      assert.strictEqual(prepareMock.mock.calls.length, 9);
      assert.strictEqual(runMock.mock.calls.length, 2);
      assert.strictEqual(runMock.mock.calls[0].arguments[0], 'south1');
      assert.strictEqual(runMock.mock.calls[1].arguments[0], 'south2');
    });
  });

  describe('saveGroupLastValue', () => {
    it('should UPDATE the existing group row and not INSERT when a row was updated', () => {
      runMock.mock.mockImplementationOnce(() => ({ changes: 1 }));
      repository.saveGroupLastValue('south1', 'group1', { value: 1, trackedInstant: 'now', queryTime: 'now' });

      assert.strictEqual(runMock.mock.calls.length, 1);
      const updateSql = prepareMock.mock.calls[5].arguments[0] as string;
      assert.ok(updateSql.includes('UPDATE south_item_cache'));
      assert.ok(updateSql.includes('item_id IS NULL'));
      assert.deepStrictEqual(runMock.mock.calls[0].arguments, ['now', '1', 'now', 'south1', 'group1']);
    });

    it('should INSERT a new group row (item_id = NULL) when no row existed to update', () => {
      // Update reports no matching row (changes: 0); the default impl (changes: 1) covers the
      // follow-up insert call, whose return value saveGroupLastValue doesn't inspect.
      runMock.mock.mockImplementationOnce(() => ({ changes: 0 }));
      repository.saveGroupLastValue('south1', 'group1', { value: 1, trackedInstant: 'now', queryTime: 'now' });

      assert.strictEqual(runMock.mock.calls.length, 2);
      const insertSql = prepareMock.mock.calls[6].arguments[0] as string;
      assert.ok(insertSql.includes('INSERT INTO south_item_cache'));
      assert.ok(insertSql.includes('NULL'));
      assert.deepStrictEqual(runMock.mock.calls[1].arguments, ['south1', 'group1', 'now', '1', 'now']);
    });

    it('should store null when value is null', () => {
      runMock.mock.mockImplementationOnce(() => ({ changes: 1 }));
      repository.saveGroupLastValue('south1', 'group1', { value: null, trackedInstant: 'now', queryTime: 'now' });
      assert.deepStrictEqual(runMock.mock.calls[0].arguments, ['now', null, 'now', 'south1', 'group1']);
    });
  });

  describe('getItemCachedValue', () => {
    it('returns null if no row is found or cached_instant is NULL', () => {
      getMock.mock.mockImplementationOnce(() => undefined);
      assert.strictEqual(repository.getItemCachedValue('south1', 'item1'), null);

      getMock.mock.mockImplementationOnce(() => ({ cached_value: null, cached_instant: null }));
      assert.strictEqual(repository.getItemCachedValue('south1', 'item1'), null);
    });

    it('queries the dedicated cached_value/cached_instant columns by south_id and item_id', () => {
      getMock.mock.mockImplementationOnce(() => undefined);
      repository.getItemCachedValue('south1', 'item1');
      const sql = prepareMock.mock.calls[3].arguments[0] as string;
      assert.ok(sql.includes('cached_value'));
      assert.ok(sql.includes('cached_instant'));
      assert.ok(sql.includes('south_id = ?'));
      assert.ok(sql.includes('item_id = ?'));
    });

    it('returns a parsed value and the tracked instant', () => {
      getMock.mock.mockImplementationOnce(() => ({ cached_value: '{"a":1}', cached_instant: '2023-01-01' }));
      const result = repository.getItemCachedValue('south1', 'item1');
      assert.deepStrictEqual(result, { value: { a: 1 }, trackedInstant: '2023-01-01' });
    });
  });

  describe('saveItemsLastValues', () => {
    it('upserts into the dedicated cached_value/cached_instant columns, never value/tracked_instant', () => {
      repository.saveItemsLastValues('south1', [{ itemId: 'item1', value: 'v1', instant: 't1' }]);
      const sql = prepareMock.mock.calls[4].arguments[0] as string;
      assert.ok(sql.includes('cached_value'));
      assert.ok(sql.includes('cached_instant'));
      assert.ok(sql.includes('ON CONFLICT'));
      assert.deepStrictEqual(runMock.mock.calls[0].arguments, ['south1', 'item1', '"v1"', 't1']);
    });

    it('does nothing when values is empty', () => {
      repository.saveItemsLastValues('south1', []);
      assert.strictEqual(runMock.mock.calls.length, 0);
    });
  });

  describe('deleteItemValue', () => {
    it('should delete by south_id and item_id', () => {
      repository.deleteItemValue('south1', 'item1');
      const sql = prepareMock.mock.calls[7].arguments[0] as string;
      assert.ok(sql.includes('south_id = ?'));
      assert.ok(sql.includes('item_id = ?'));
      assert.deepStrictEqual(runMock.mock.calls[0].arguments, ['south1', 'item1']);
    });
  });

  describe('deleteItemsBySouth', () => {
    it('should delete all rows for the given south_id', () => {
      repository.deleteItemsBySouth('south1');
      const sql = prepareMock.mock.calls[8].arguments[0] as string;
      assert.ok(sql.includes('south_id = ?'));
      assert.ok(!sql.includes('item_id'));
      assert.deepStrictEqual(runMock.mock.calls[0].arguments, ['south1']);
    });
  });
});
