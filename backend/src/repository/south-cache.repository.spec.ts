import SqliteDatabaseMock, { all, get, run } from '../tests/__mocks__/database.mock';
import { SouthCache } from '../../../shared/model/south-connector.model';
import { Database } from 'better-sqlite3';
import SouthCacheRepository, { SOUTH_CACHE_TABLE } from './south-cache.repository';

jest.mock('../tests/__mocks__/database.mock');

let database: Database;
let repository: SouthCacheRepository;
describe('SouthCacheRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    database = new SqliteDatabaseMock();
    database.prepare = jest.fn().mockReturnValue({
      run,
      get,
      all
    });
    repository = new SouthCacheRepository(database);
  });

  it('should properly get a south cache', () => {
    const expectedValue: SouthCache = {
      southId: 'southId',
      scanModeId: 'id1',
      itemId: 'itemId',
      maxInstant: '2023-03-01T10:30:16.000Z'
    };
    get.mockReturnValueOnce({ scanModeId: 'id1', itemId: 'itemId', southId: 'southId', maxInstant: '2023-03-01T10:30:16.000Z' });
    const southCache = repository.getSouthCacheScanMode('southId', 'id1', 'itemId');
    expect(database.prepare).toHaveBeenCalledWith(
      'SELECT south_id AS southId, scan_mode_id AS scanModeId, item_id AS itemId, max_instant AS maxInstant FROM cache_history WHERE south_id = ? AND scan_mode_id = ? AND item_id = ?;'
    );
    expect(get).toHaveBeenCalledWith('southId', 'id1', 'itemId');
    expect(southCache).toEqual(expectedValue);
  });

  it('should create a south cache', () => {
    run.mockReturnValueOnce({ lastInsertRowid: 1 });
    get.mockReturnValueOnce(null);

    const command: SouthCache = {
      scanModeId: 'id1',
      itemId: 'itemId',
      southId: 'southId',
      maxInstant: '2023-03-01T10:30:16.000Z'
    };

    repository.createOrUpdateCacheScanMode(command);
    expect(get).toHaveBeenCalledWith('southId', 'id1', 'itemId');
    expect(database.prepare).toHaveBeenCalledWith(
      'INSERT INTO cache_history (south_id, scan_mode_id, item_id, max_instant) VALUES (?, ?, ?, ?);'
    );
    expect(run).toHaveBeenCalledWith(command.southId, command.scanModeId, command.itemId, command.maxInstant);
  });

  it('should update a south cache', () => {
    run.mockReturnValueOnce({ lastInsertRowid: 1 });
    get.mockReturnValueOnce({ scanModeId: 'id1', maxInstant: '2023-03-01T10:30:16.000Z' });

    const command: SouthCache = {
      scanModeId: 'id1',
      itemId: 'itemId',
      southId: 'southId',
      maxInstant: '2023-03-01T10:30:16.000Z'
    };

    repository.createOrUpdateCacheScanMode(command);
    expect(get).toHaveBeenCalledWith('southId', 'id1', 'itemId');
    expect(database.prepare).toHaveBeenCalledWith(
      'UPDATE cache_history SET max_instant = ? WHERE south_id = ? AND scan_mode_id = ? AND item_id = ?;'
    );
    expect(run).toHaveBeenCalledWith(command.maxInstant, command.southId, command.scanModeId, command.itemId);
  });

  it('should delete a south connector', () => {
    repository.deleteCacheScanMode('southId', 'id1', 'itemId');
    expect(database.prepare).toHaveBeenCalledWith('DELETE FROM cache_history WHERE south_id = ? AND scan_mode_id = ? AND item_id = ?;');
    expect(run).toHaveBeenCalledWith('southId', 'id1', 'itemId');
  });

  it('should reset cache', () => {
    repository.resetSouthCacheDatabase();
    expect(database.prepare).toHaveBeenCalledWith('DELETE FROM cache_history;');
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('should create custom table', () => {
    repository.createCustomTable('test', 'field1 TEXT, field2 INTEGER');
    expect(database.prepare).toHaveBeenCalledWith(`CREATE TABLE IF NOT EXISTS test (field1 TEXT, field2 INTEGER);`);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('should run on custom table', () => {
    repository.getQueryOnCustomTable(`SELECT mtime_ms AS mtimeMs FROM "test" WHERE filename = ?`, ['my filename']);
    expect(database.prepare).toHaveBeenCalledWith(`SELECT mtime_ms AS mtimeMs FROM "test" WHERE filename = ?`);
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('should query on custom table', () => {
    repository.runQueryOnCustomTable(
      `INSERT INTO "test" (filename, mtime_ms) VALUES (?, ?) ON CONFLICT(filename) DO UPDATE SET mtime_ms = ?`,
      ['my filename']
    );
    expect(database.prepare).toHaveBeenCalledWith(
      `INSERT INTO "test" (filename, mtime_ms) VALUES (?, ?) ON CONFLICT(filename) DO UPDATE SET mtime_ms = ?`
    );
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('should delete all cache rows of a south connector', () => {
    repository.deleteAllCacheScanModes('southId');
    expect(database.prepare).toHaveBeenCalledWith(`DELETE FROM ${SOUTH_CACHE_TABLE} WHERE south_id = ?;`);
    expect(run).toHaveBeenCalledWith('southId');
  });

  it('should delete all cache rows of an item', () => {
    repository.deleteCacheScanModesByItem('itemId');
    expect(database.prepare).toHaveBeenCalledWith(`DELETE FROM ${SOUTH_CACHE_TABLE} WHERE item_id = ?;`);
    expect(run).toHaveBeenCalledWith('itemId');
  });

  it('should delete all cache rows of a scan mode', () => {
    repository.deleteCacheScanModesByScanMode('scanModeId');
    expect(database.prepare).toHaveBeenCalledWith(`DELETE FROM ${SOUTH_CACHE_TABLE} WHERE scan_mode_id = ?;`);
    expect(run).toHaveBeenCalledWith('scanModeId');
  });

  it('should return max instants grouped by scan modes', () => {
    const mockValues = [
      { maxInstant: '2023-03-01T10:30:16.000Z', scanModeId: 'id1' },
      { maxInstant: '2023-03-01T10:30:00.000Z', scanModeId: 'id2' }
    ];
    all.mockReturnValueOnce(mockValues);
    const expectedMap = new Map(mockValues.map(r => [r.scanModeId, r.maxInstant]));
    const resultMap = repository.getLatestMaxInstants('southId');

    expect(database.prepare).toHaveBeenCalledWith(
      `SELECT max(max_instant) as maxInstant, scan_mode_id AS scanModeId FROM ${SOUTH_CACHE_TABLE} WHERE south_id = ? GROUP BY scan_mode_id ORDER BY max_instant DESC;`
    );
    expect(all).toHaveBeenCalledWith('southId');
    expect(resultMap).toEqual(expectedMap);
  });

  it("should update a chache row's scan mode id", () => {
    get.mockReturnValueOnce({});
    repository.updateCacheScanModeId('southId', 'itemId', 'oldScanModeId', 'newScanModeId');
    expect(database.prepare).toHaveBeenCalledWith(
      `UPDATE ${SOUTH_CACHE_TABLE} SET scan_mode_id = ? WHERE south_id = ? AND scan_mode_id = ? AND item_id = ?;`
    );
    expect(run).toHaveBeenCalledWith('newScanModeId', 'southId', 'oldScanModeId', 'itemId');
  });
});
