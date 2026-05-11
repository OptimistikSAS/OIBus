import { Database } from 'better-sqlite3';
import SouthCacheRepository from './south-cache.repository';

// Mock better-sqlite3
const mockDatabase = {
  prepare: jest.fn().mockReturnThis(),
  run: jest.fn(),
  get: jest.fn(),
  all: jest.fn()
};

jest.mock('better-sqlite3', () => {
  return jest.fn().mockImplementation(() => mockDatabase);
});

describe('SouthCacheRepository', () => {
  let repository: SouthCacheRepository;

  beforeEach(() => {
    repository = new SouthCacheRepository(mockDatabase as unknown as Database);
    jest.clearAllMocks();
  });

  it('createItemValueTable() should create table with correct schema', () => {
    repository.createItemValueTable('south1');
    expect(mockDatabase.prepare).toHaveBeenCalledWith(expect.stringContaining('south_item_cache_south1'));
    expect(mockDatabase.run).toHaveBeenCalled();
  });

  it('dropItemValueTable() should drop table', () => {
    repository.dropItemValueTable('south1');
    expect(mockDatabase.prepare).toHaveBeenCalledWith('DROP TABLE IF EXISTS "south_item_cache_south1";');
    expect(mockDatabase.run).toHaveBeenCalled();
  });

  describe('getItemLastValue', () => {
    it('should return null if result is undefined', () => {
      (mockDatabase.get as jest.Mock).mockReturnValueOnce(undefined);
      const result = repository.getItemLastValue('south1', 'item1');
      expect(result).toBeNull();
    });

    it('should look up by item_id only (not group_id)', () => {
      (mockDatabase.get as jest.Mock).mockReturnValueOnce(undefined);
      repository.getItemLastValue('south1', 'item1');
      expect(mockDatabase.prepare).toHaveBeenCalledWith(expect.stringContaining('WHERE item_id = ?'));
      // group_id must NOT appear in the WHERE clause
      const sql: string = (mockDatabase.prepare as jest.Mock).mock.calls[0][0];
      expect(sql).not.toMatch(/AND group_id/);
    });

    it('should return parsed value', () => {
      (mockDatabase.get as jest.Mock).mockReturnValueOnce({
        item_id: 'item1',
        query_time: '2023-01-01',
        value: '{"a":1}',
        tracked_instant: '2023-01-01'
      });
      const result = repository.getItemLastValue('south1', 'item1');
      expect(result).toEqual({
        itemId: 'item1',
        groupId: null,
        queryTime: '2023-01-01',
        value: { a: 1 },
        trackedInstant: '2023-01-01'
      });
    });

    it('should return raw value if parse fails', () => {
      (mockDatabase.get as jest.Mock).mockReturnValueOnce({
        item_id: 'item1',
        value: 'invalid-json'
      });
      const result = repository.getItemLastValue('south1', 'item1');
      expect(result?.value).toBe('invalid-json');
    });

    it('should return null on db error', () => {
      (mockDatabase.prepare as jest.Mock).mockImplementationOnce(() => {
        throw new Error('DB Error');
      });
      const result = repository.getItemLastValue('south1', 'item1');
      expect(result).toBeNull();
    });
  });

  describe('saveItemLastValue', () => {
    it('should execute a single statement (no SELECT-then-write round-trip)', () => {
      repository.saveItemLastValue('south1', { itemId: 'item1', groupId: 'group1', value: 1, trackedInstant: 'now', queryTime: 'now' });
      // Exactly one prepare(), no preliminary SELECT.
      expect(mockDatabase.prepare).toHaveBeenCalledTimes(1);
      expect(mockDatabase.get).not.toHaveBeenCalled();
      const sql: string = (mockDatabase.prepare as jest.Mock).mock.calls[0][0];
      // INSERT OR REPLACE is SQLite shorthand for "insert; on conflict, delete + insert again".
      expect(sql).toContain('INSERT OR REPLACE INTO "south_item_cache_south1"');
      // Args follow the INSERT column order: group_id, item_id, query_time, value, tracked_instant.
      expect(mockDatabase.run).toHaveBeenCalledWith('group1', 'item1', 'now', '1', 'now');
    });

    it('should pass null group_id through when item has no group', () => {
      repository.saveItemLastValue('south1', { itemId: 'item1', groupId: null, value: 1, trackedInstant: 'now', queryTime: 'now' });
      expect(mockDatabase.run).toHaveBeenCalledWith(null, 'item1', 'now', '1', 'now');
    });

    it('should rewrite group_id when the row already exists', () => {
      // INSERT OR REPLACE deletes the existing row and inserts the new one, so
      // the new group_id is whatever the caller just passed — same semantic as
      // the old "find by item_id, UPDATE group_id" branch, in a single
      // statement.
      repository.saveItemLastValue('south1', { itemId: 'item1', groupId: 'group1', value: 42, trackedInstant: 'now', queryTime: 'now' });
      const sql: string = (mockDatabase.prepare as jest.Mock).mock.calls[0][0];
      expect(sql).toContain('INSERT OR REPLACE');
      expect(mockDatabase.run).toHaveBeenCalledWith('group1', 'item1', 'now', '42', 'now');
    });

    it('should store null when value is null', () => {
      repository.saveItemLastValue('south1', { itemId: 'item1', groupId: 'group1', value: null, trackedInstant: 'now', queryTime: 'now' });
      expect(mockDatabase.run).toHaveBeenCalledWith('group1', 'item1', 'now', null, 'now');
    });

    it('should reuse the cached prepared statement on subsequent saves for the same connector', () => {
      repository.saveItemLastValue('south1', { itemId: 'item1', groupId: 'g', value: 1, trackedInstant: 't', queryTime: 't' });
      repository.saveItemLastValue('south1', { itemId: 'item2', groupId: 'g', value: 2, trackedInstant: 't', queryTime: 't' });
      // prepare() ran once total (cache hit on the second call).
      expect(mockDatabase.prepare).toHaveBeenCalledTimes(1);
      expect(mockDatabase.run).toHaveBeenCalledTimes(2);
    });

    it('should drop the cached statement when the table is recreated', () => {
      repository.saveItemLastValue('south1', { itemId: 'item1', groupId: 'g', value: 1, trackedInstant: 't', queryTime: 't' });
      repository.createItemValueTable('south1'); // invalidates the cache
      repository.saveItemLastValue('south1', { itemId: 'item2', groupId: 'g', value: 2, trackedInstant: 't', queryTime: 't' });
      // 1 UPSERT prepare + 1 CREATE TABLE prepare + 1 second UPSERT prepare
      expect(mockDatabase.prepare).toHaveBeenCalledTimes(3);
    });
  });

  describe('deleteItemValue', () => {
    it('should delete by item_id only', () => {
      repository.deleteItemValue('south1', 'item1');
      expect(mockDatabase.prepare).toHaveBeenCalledWith('DELETE FROM "south_item_cache_south1" WHERE item_id = ?;');
      expect(mockDatabase.run).toHaveBeenCalledWith('item1');
    });

    it('should delete by item_id regardless of groupId being null', () => {
      repository.deleteItemValue('south1', 'item1');
      expect(mockDatabase.prepare).toHaveBeenCalledWith('DELETE FROM "south_item_cache_south1" WHERE item_id = ?;');
      expect(mockDatabase.run).toHaveBeenCalledWith('item1');
    });

    it('should catch error', () => {
      (mockDatabase.prepare as jest.Mock).mockImplementationOnce(() => {
        throw new Error('DB Error');
      });
      expect(() => repository.deleteItemValue('south1', 'item1')).not.toThrow();
    });
  });
});
