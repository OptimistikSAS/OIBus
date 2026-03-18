import { Database } from 'better-sqlite3';
import { emptyDatabase, initDatabase } from '../../tests/utils/test-utils';
import SouthCacheRepository from './south-cache.repository';

jest.mock('node:crypto');

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
      repository.createItemValueTable('southId');
    });

    it('should return null from getItemLastValue when table does not exist', () => {
      const result = repository.getItemLastValue('nonexistent-connector', 'groupId', 'someItemId');
      expect(result).toBe(null);
    });

    it('should handle invalid JSON in value when getting item last value', () => {
      repository.createItemValueTable('invalidJsonConnector');
      database
        .prepare(
          `INSERT INTO "south_item_cache_invalidJsonConnector" (item_id, group_id, query_time, value, tracked_instant) VALUES (?, ?, ?, ?, ?)`
        )
        .run('item1', null, null, 'not valid json', null);
      const result = repository.getItemLastValue('invalidJsonConnector', null, 'item1');
      expect(result).not.toBe(null);
      expect(result!.itemId).toBe('item1');
      expect(result!.value).toBe('not valid json');
      repository.dropItemValueTable('invalidJsonConnector');
    });

    it('should ignore deleteItemValue when table does not exist', () => {
      expect(() => repository.deleteItemValue('nonexistent-connector', 'groupId', 'itemId')).not.toThrow();
    });
  });
});
