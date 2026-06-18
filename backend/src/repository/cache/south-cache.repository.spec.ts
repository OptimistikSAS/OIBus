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
    runMock = mock.fn();
    getMock = mock.fn();
    prepareMock = mock.fn(() => ({ run: runMock, get: getMock }) as unknown as Statement);
    const mockDatabase = { prepare: prepareMock } as unknown as Database;
    repository = new SouthCacheRepository(mockDatabase);
  });

  afterEach(() => {
    mock.restoreAll();
  });

  it('prepares all five statements once at construction', () => {
    // 5 statements: get, getByGroup, upsert, delete, deleteAllBySouth
    assert.strictEqual(prepareMock.mock.calls.length, 5);
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
      // consume the getStmt call
      repository.getItemLastValue('south1', 'item1');
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
  });

  describe('saveItemLastValue', () => {
    it('should INSERT OR REPLACE into south_item_cache with south_id', () => {
      repository.saveItemLastValue('south1', { itemId: 'item1', groupId: 'group1', value: 1, trackedInstant: 'now', queryTime: 'now' });
      const sql = prepareMock.mock.calls[2].arguments[0] as string;
      assert.ok(sql.includes('INSERT OR REPLACE INTO south_item_cache'));
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
      // prepare() still called only 5 times total (constructor) — no new preparations.
      assert.strictEqual(prepareMock.mock.calls.length, 5);
      assert.strictEqual(runMock.mock.calls.length, 2);
      assert.strictEqual(runMock.mock.calls[0].arguments[0], 'south1');
      assert.strictEqual(runMock.mock.calls[1].arguments[0], 'south2');
    });
  });

  describe('deleteItemValue', () => {
    it('should delete by south_id and item_id', () => {
      repository.deleteItemValue('south1', 'item1');
      const sql = prepareMock.mock.calls[3].arguments[0] as string;
      assert.ok(sql.includes('south_id = ?'));
      assert.ok(sql.includes('item_id = ?'));
      assert.deepStrictEqual(runMock.mock.calls[0].arguments, ['south1', 'item1']);
    });
  });

  describe('deleteItemsBySouth', () => {
    it('should delete all rows for the given south_id', () => {
      repository.deleteItemsBySouth('south1');
      const sql = prepareMock.mock.calls[4].arguments[0] as string;
      assert.ok(sql.includes('south_id = ?'));
      assert.ok(!sql.includes('item_id'));
      assert.deepStrictEqual(runMock.mock.calls[0].arguments, ['south1']);
    });
  });
});
