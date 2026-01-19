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
    });

    it('should create a south cache', () => {
      const tableName = `south_item_cache_${southCache.southId}`;
      repository.createCustomTable(
        tableName,
        'south_id TEXT, scan_mode_id TEXT, item_id TEXT, max_instant TEXT, PRIMARY KEY(scan_mode_id, item_id)'
      );
      repository.save(tableName, southCache);
      expect(repository.getSouthCache(tableName, southCache.scanModeId, southCache.itemId)).toEqual(southCache);
    });

    it('should return max instants grouped by scan modes', () => {
      const tableName = `south_item_cache_${southCache.southId}`;
      const command: SouthCache = JSON.parse(JSON.stringify(southCache));
      command.maxInstant = testData.constants.dates.DATE_2;
      command.scanModeId = 'scanModeId2';
      const expectedMap = new Map([southCache, command].map(r => [r.scanModeId, r.maxInstant]));

      repository.save(tableName, command);

      const resultMap = repository.getLatestMaxInstants(tableName);
      expect(resultMap).toEqual(expectedMap);

      const badTableName = 'south_item_cache_bad_id';
      repository.createCustomTable(
        badTableName,
        'south_id TEXT, scan_mode_id TEXT, item_id TEXT, max_instant TEXT, PRIMARY KEY(scan_mode_id, item_id)'
      );
      expect(repository.getLatestMaxInstants(badTableName)).toEqual(null);
    });

    it('should update a south cache', () => {
      const tableName = `south_item_cache_${southCache.southId}`;
      const command: SouthCache = JSON.parse(JSON.stringify(southCache));
      command.maxInstant = testData.constants.dates.DATE_2;

      repository.save(tableName, command);
      expect(repository.getSouthCache(tableName, southCache.scanModeId, southCache.itemId)).toEqual(command);
    });

    it('should delete a south connector', () => {
      const tableName = `south_item_cache_${southCache.southId}`;
      repository.delete(tableName, southCache.scanModeId, southCache.itemId);
      expect(repository.getSouthCache(tableName, southCache.scanModeId, southCache.itemId)).toEqual(null);
    });

    it('should delete cache by South Connector', () => {
      const tableName = `south_item_cache_${southCache.southId}`;
      repository.save(tableName, southCache);
      repository.deleteAllBySouthConnector(tableName);

      expect(repository.getSouthCache(tableName, southCache.scanModeId, southCache.itemId)).toEqual(null);
    });

    it('should delete cache by Scan Mode', () => {
      const tableName = `south_item_cache_${southCache.southId}`;
      repository.save(tableName, southCache);
      repository.deleteAllByScanMode(tableName, southCache.scanModeId);

      expect(repository.getSouthCache(tableName, southCache.scanModeId, southCache.itemId)).toEqual(null);
    });

    it('should delete cache by Item', () => {
      const tableName = `south_item_cache_${southCache.southId}`;
      repository.save(tableName, southCache);
      repository.deleteAllBySouthItem(tableName, southCache.itemId);

      expect(repository.getSouthCache(tableName, southCache.scanModeId, southCache.itemId)).toEqual(null);
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
