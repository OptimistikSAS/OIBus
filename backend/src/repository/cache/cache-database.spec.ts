import { Database } from 'better-sqlite3';
import { emptyDatabase, initDatabase } from '../../tests/utils/test-utils';
import SouthCacheRepository from './south-cache.repository';
import { SouthCache } from '../../../../shared/model/south-connector.model';
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
    await emptyDatabase('cache');
  });

  describe('South Cache', () => {
    let repository: SouthCacheRepository;

    beforeEach(() => {
      jest.clearAllMocks();

      repository = new SouthCacheRepository(database);
    });

    it('should create a south cache', () => {
      repository.save(southCache);
      expect(repository.getSouthCache(southCache.southId, southCache.scanModeId, southCache.itemId)).toEqual(southCache);
    });

    it('should return max instants grouped by scan modes', () => {
      const command: SouthCache = JSON.parse(JSON.stringify(southCache));
      command.maxInstant = testData.constants.dates.DATE_2;
      command.scanModeId = 'scanModeId2';
      const expectedMap = new Map([southCache, command].map(r => [r.scanModeId, r.maxInstant]));

      repository.save(command);

      const resultMap = repository.getLatestMaxInstants(command.southId);
      expect(resultMap).toEqual(expectedMap);

      expect(repository.getLatestMaxInstants('bad id')).toEqual(null);
    });

    it('should update a south cache', () => {
      const command: SouthCache = JSON.parse(JSON.stringify(southCache));
      command.maxInstant = testData.constants.dates.DATE_2;

      repository.save(command);
      expect(repository.getSouthCache(southCache.southId, southCache.scanModeId, southCache.itemId)).toEqual(command);
    });

    it('should delete a south connector', () => {
      repository.delete(southCache.southId, southCache.scanModeId, southCache.itemId);
      expect(repository.getSouthCache(southCache.southId, southCache.scanModeId, southCache.itemId)).toEqual(null);
    });

    it('should delete cache by South Connector', () => {
      repository.save(southCache);
      repository.deleteAllBySouthConnector(southCache.southId);

      expect(repository.getSouthCache(southCache.southId, southCache.scanModeId, southCache.itemId)).toEqual(null);
    });

    it('should delete cache by Scan Mode', () => {
      repository.save(southCache);
      repository.deleteAllByScanMode(southCache.scanModeId);

      expect(repository.getSouthCache(southCache.southId, southCache.scanModeId, southCache.itemId)).toEqual(null);
    });

    it('should delete cache by Item', () => {
      repository.save(southCache);
      repository.deleteAllBySouthItem(southCache.itemId);

      expect(repository.getSouthCache(southCache.southId, southCache.scanModeId, southCache.itemId)).toEqual(null);
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
