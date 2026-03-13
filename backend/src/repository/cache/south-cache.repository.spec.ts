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

  it('getLatestMaxInstants() should return null (deprecated)', () => {
    const result = repository.getLatestMaxInstants('any-id');
    expect(result).toBeNull();
  });

  it('deleteAllBySouthItem() should do nothing (no-op)', () => {
    repository.deleteAllBySouthItem('any-id');
    // No expectations needed as it's a void no-op, just ensuring it doesn't throw
  });

  it('deleteAllByScanMode() should do nothing (no-op)', () => {
    repository.deleteAllByScanMode('any-id');
    // No expectations needed as it's a void no-op, just ensuring it doesn't throw
  });

  it('createCustomTable() should execute create table query', () => {
    repository.createCustomTable('test_table', 'id TEXT');
    expect(mockDatabase.prepare).toHaveBeenCalledWith('CREATE TABLE IF NOT EXISTS "test_table" (id TEXT);');
    expect(mockDatabase.run).toHaveBeenCalled();
  });

  it('runQueryOnCustomTable() should execute query', () => {
    repository.runQueryOnCustomTable('SELECT * FROM test', [1]);
    expect(mockDatabase.prepare).toHaveBeenCalledWith('SELECT * FROM test');
    expect(mockDatabase.run).toHaveBeenCalledWith(1);
  });

  it('getQueryOnCustomTable() should execute query and return result', () => {
    (mockDatabase.get as jest.Mock).mockReturnValueOnce({ id: 1 });
    const result = repository.getQueryOnCustomTable('SELECT * FROM test', [1]);
    expect(mockDatabase.prepare).toHaveBeenCalledWith('SELECT * FROM test');
    expect(mockDatabase.get).toHaveBeenCalledWith(1);
    expect(result).toEqual({ id: 1 });
  });

  it('createItemValueTable() should create table with correct schema', () => {
    repository.createItemValueTable('south1');
    expect(mockDatabase.prepare).toHaveBeenCalledWith(expect.stringContaining('CREATE TABLE IF NOT EXISTS "south_item_cache_south1"'));
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

  describe('getAllItemValues', () => {
    it('should return empty array on db error', () => {
      (mockDatabase.prepare as jest.Mock).mockImplementationOnce(() => {
        throw new Error('DB Error');
      });
      const result = repository.getAllItemValues('south1');
      expect(result).toEqual([]);
    });

    it('should return valid items', () => {
      (mockDatabase.all as jest.Mock).mockReturnValueOnce([
        { item_id: 'item1', value: '1' },
        { item_id: 'item2', value: '2' }
      ]);
      const result = repository.getAllItemValues('south1');
      expect(result).toHaveLength(2);
      expect(result[0].itemId).toBe('item1');
    });
  });

  describe('saveItemLastValue', () => {
    it('should insert if not exists', () => {
      (mockDatabase.get as jest.Mock).mockReturnValueOnce(undefined); // getItemLastValue returns null
      repository.saveItemLastValue('south1', { itemId: 'item1', value: 1, trackedInstant: 'now', queryTime: 'now' });
      expect(mockDatabase.prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO'));
    });

    it('should update if exists', () => {
      // Mock getItemLastValue to return something (requires mocking .get for the SELECT inside getItemLastValue)
      (mockDatabase.get as jest.Mock).mockReturnValueOnce({});
      repository.saveItemLastValue('south1', { itemId: 'item1', value: 1, trackedInstant: 'now', queryTime: 'now' });
      expect(mockDatabase.prepare).toHaveBeenCalledWith(expect.stringContaining('UPDATE'));
    });
  });

  describe('deleteItemValue', () => {
    it('should delete item', () => {
      repository.deleteItemValue('south1', 'item1');
      expect(mockDatabase.prepare).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM'));
    });

    it('should catch error', () => {
      (mockDatabase.prepare as jest.Mock).mockImplementationOnce(() => {
        throw new Error('DB Error');
      });
      expect(() => repository.deleteItemValue('south1', 'item1')).not.toThrow();
    });
  });

  describe('Legacy/Wrapper methods', () => {
    it('getSouthCache should return null if item not found', () => {
      (mockDatabase.get as jest.Mock).mockReturnValueOnce(undefined);
      const result = repository.getSouthCache('south1', 'scan1', 'item1');
      expect(result).toBeNull();
    });

    it('getSouthCache should return cache object', () => {
      (mockDatabase.get as jest.Mock).mockReturnValueOnce({ item_id: 'item1', tracked_instant: 'now' });
      const result = repository.getSouthCache('south1', 'scan1', 'item1');
      expect(result).toEqual({
        southId: 'south1',
        scanModeId: 'scan1',
        itemId: 'item1',
        maxInstant: 'now'
      });
    });

    it('getSouthCache should return empty string if tracked_instant is missing', () => {
      (mockDatabase.get as jest.Mock).mockReturnValueOnce({ item_id: 'item1', tracked_instant: null });
      const result = repository.getSouthCache('south1', 'scan1', 'item1');
      expect(result).toEqual({
        southId: 'south1',
        scanModeId: 'scan1',
        itemId: 'item1',
        maxInstant: ''
      });
    });

    it('getSouthCache should use scanModeId if itemId is all', () => {
      repository.getSouthCache('south1', 'scan1', 'all');
      expect(mockDatabase.prepare).toHaveBeenCalledWith(expect.stringContaining('WHERE item_id = ?'));
      expect(mockDatabase.get).toHaveBeenCalledWith('scan1');
    });

    it('save should call saveItemLastValue', () => {
      const spy = jest.spyOn(repository, 'saveItemLastValue');
      (mockDatabase.get as jest.Mock).mockReturnValue(undefined); // for internal check

      repository.save({ southId: 'south1', scanModeId: 'scan1', itemId: 'item1', maxInstant: 'now' });
      expect(spy).toHaveBeenCalledWith('south1', expect.objectContaining({ itemId: 'item1', trackedInstant: 'now' }));

      repository.save({ southId: 'south1', scanModeId: 'scan1', itemId: 'all', maxInstant: 'now' });
      expect(spy).toHaveBeenCalledWith('south1', expect.objectContaining({ itemId: 'scan1', trackedInstant: 'now' }));
    });

    it('delete should call deleteItemValue', () => {
      const spy = jest.spyOn(repository, 'deleteItemValue');
      repository.delete('south1', 'scan1', 'item1');
      expect(spy).toHaveBeenCalledWith('south1', 'item1');

      repository.delete('south1', 'scan1', 'all');
      expect(spy).toHaveBeenCalledWith('south1', 'scan1');
    });

    it('deleteAllBySouthConnector should call dropItemValueTable', () => {
      const spy = jest.spyOn(repository, 'dropItemValueTable');
      repository.deleteAllBySouthConnector('south1');
      expect(spy).toHaveBeenCalledWith('south1');
    });
  });
});
