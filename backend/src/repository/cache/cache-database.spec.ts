import { Database } from 'better-sqlite3';
import { emptyDatabase, initDatabase } from '../../tests/utils/test-utils';
import SouthCacheRepository from './south-cache.repository';
import { SouthCache } from '../../../shared/model/south-connector.model';
import testData from '../../tests/utils/test-data';

jest.mock('node:crypto');

const southCache: SouthCache = {
  scanModeId: 'scanModeId1',
  itemId: 'itemId',
  southId: 'southId',
  maxInstant: testData.constants.dates.DATE_1
};

let database: Database;
describe('Repository with populated database', () => {
  beforeAll(async () => {
    database = await initDatabase('cache');
  });

  afterAll(async () => {
    database.close();
    await emptyDatabase('cache');
  });

  describe('South Cache', () => {
    let repository: SouthCacheRepository;

    beforeEach(() => {
      jest.clearAllMocks();

      repository = new SouthCacheRepository(database);
      repository.createItemValueTable(southCache.southId);
    });

    it('should create a south cache', () => {
      repository.save(southCache);
      expect(repository.getSouthCache(southCache.southId, southCache.scanModeId, southCache.itemId)).toEqual(southCache);
    });

    it('should return max instants grouped by scan modes', () => {
      repository.save(southCache);

      // getAllItemValues returns SouthItemLastValue (itemId, trackedInstant); save() uses itemId as key when itemId !== 'all'
      const allItems = repository.getAllItemValues(southCache.southId);
      expect(allItems.length).toBe(1);
      expect(allItems[0].itemId).toBe(southCache.itemId);
      expect(allItems[0].trackedInstant).toBe(southCache.maxInstant);

      // For a bad id, getAllItemValues returns empty array
      const allItemsBad = repository.getAllItemValues('bad id');
      expect(allItemsBad).toEqual([]);

      // Update the existing southCache to have a new maxInstant value and save it
      const updatedCache = { ...southCache, maxInstant: testData.constants.dates.DATE_2 };
      repository.save(updatedCache);

      expect(repository.getSouthCache(southCache.southId, southCache.scanModeId, southCache.itemId)).toEqual(updatedCache);
    });

    it('should delete a south connector', () => {
      repository.save(southCache);
      repository.delete(southCache.southId, southCache.scanModeId, southCache.itemId);
      expect(repository.getSouthCache(southCache.southId, southCache.scanModeId, southCache.itemId)).toEqual(null);
    });

    it('should delete cache by South Connector', () => {
      repository.save(southCache);
      repository.deleteAllBySouthConnector(southCache.southId);

      expect(repository.getSouthCache(southCache.southId, southCache.scanModeId, southCache.itemId)).toEqual(null);
    });

    it('should no-op deleteAllBySouthItem and deleteAllByScanMode', () => {
      repository.save(southCache);
      repository.deleteAllBySouthItem(southCache.itemId);
      repository.deleteAllByScanMode(southCache.scanModeId);
      expect(repository.getSouthCache(southCache.southId, southCache.scanModeId, southCache.itemId)).toEqual(southCache);
    });

    it('should drop item value table', () => {
      repository.save(southCache);
      repository.dropItemValueTable(southCache.southId);
      expect(repository.getSouthCache(southCache.southId, southCache.scanModeId, southCache.itemId)).toEqual(null);
    });

    it('should return null from getItemLastValue when table does not exist', () => {
      const result = repository.getItemLastValue('nonexistent-connector', 'someItemId');
      expect(result).toBe(null);
    });

    it('should return empty array from getAllItemValues when table does not exist', () => {
      const result = repository.getAllItemValues('nonexistent-connector');
      expect(result).toEqual([]);
    });

    it('should handle invalid JSON in value when getting item last value', () => {
      repository.createItemValueTable('invalidJsonConnector');
      database
        .prepare(`INSERT INTO "south_item_cache_invalidJsonConnector" (item_id, query_time, value, tracked_instant) VALUES (?, ?, ?, ?)`)
        .run('item1', null, 'not valid json', null);
      const result = repository.getItemLastValue('invalidJsonConnector', 'item1');
      expect(result).not.toBe(null);
      expect(result!.itemId).toBe('item1');
      expect(result!.value).toBe('not valid json');
      repository.dropItemValueTable('invalidJsonConnector');
    });

    it('should ignore deleteItemValue when table does not exist', () => {
      expect(() => repository.deleteItemValue('nonexistent-connector', 'itemId')).not.toThrow();
    });

    it('should create custom table, and interact with it', () => {
      repository.createCustomTable('test', 'filename TEXT PRIMARY KEY, mtime_ms INTEGER');
      repository.runQueryOnCustomTable(
        `INSERT INTO "test" (filename, mtime_ms) VALUES (?, ?) ON CONFLICT(filename) DO UPDATE SET mtime_ms = ?`,
        ['my filename', testData.constants.dates.FAKE_NOW, testData.constants.dates.FAKE_NOW]
      );

      const result = repository.getQueryOnCustomTable(`SELECT mtime_ms AS mtimeMs FROM "test" WHERE filename = ?`, ['my filename']);
      expect(result).toEqual({ mtimeMs: testData.constants.dates.FAKE_NOW });
    });
  });
});
