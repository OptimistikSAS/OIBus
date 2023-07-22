import SqliteDatabaseMock, { all, get, run } from '../tests/__mocks__/database.mock';
import { SouthCache } from '../../../shared/model/south-connector.model';
import { Database } from 'better-sqlite3';
import SouthCacheRepository from './south-cache.repository';

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
});
