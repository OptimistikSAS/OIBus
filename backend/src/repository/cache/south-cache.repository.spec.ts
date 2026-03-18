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
      const result = repository.getItemLastValue('south1', 'group1', 'item1');
      expect(result).toBeNull();
    });

    it('should return parsed value', () => {
      (mockDatabase.get as jest.Mock).mockReturnValueOnce({
        item_id: 'item1',
        query_time: '2023-01-01',
        value: '{"a":1}',
        tracked_instant: '2023-01-01'
      });
      const result = repository.getItemLastValue('south1', 'group1', 'item1');
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
      const result = repository.getItemLastValue('south1', 'group1', 'item1');
      expect(result?.value).toBe('invalid-json');
    });

    it('should return null on db error', () => {
      (mockDatabase.prepare as jest.Mock).mockImplementationOnce(() => {
        throw new Error('DB Error');
      });
      const result = repository.getItemLastValue('south1', 'group1', 'item1');
      expect(result).toBeNull();
    });
  });

  describe('saveItemLastValue', () => {
    it('should insert if not exists', () => {
      (mockDatabase.get as jest.Mock).mockReturnValueOnce(undefined); // getItemLastValue returns null
      repository.saveItemLastValue('south1', { itemId: 'item1', groupId: 'group1', value: 1, trackedInstant: 'now', queryTime: 'now' });
      expect(mockDatabase.prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO'));
    });

    it('should update if exists', () => {
      // Mock getItemLastValue to return something (requires mocking .get for the SELECT inside getItemLastValue)
      (mockDatabase.get as jest.Mock).mockReturnValueOnce({});
      repository.saveItemLastValue('south1', { itemId: 'item1', groupId: 'group1', value: 1, trackedInstant: 'now', queryTime: 'now' });
      expect(mockDatabase.prepare).toHaveBeenCalledWith(expect.stringContaining('UPDATE'));
    });
  });

  describe('deleteItemValue', () => {
    it('should delete item', () => {
      repository.deleteItemValue('south1', 'group1', 'item1');
      expect(mockDatabase.prepare).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM'));
    });

    it('should catch error', () => {
      (mockDatabase.prepare as jest.Mock).mockImplementationOnce(() => {
        throw new Error('DB Error');
      });
      expect(() => repository.deleteItemValue('south1', 'group1', 'item1')).not.toThrow();
    });
  });
});
