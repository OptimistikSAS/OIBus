import SqliteDatabaseMock, { all, get, run } from '../tests/__mocks__/database.mock';
import { SouthCache } from '../../../shared/model/south-connector.model';
import { Database } from 'better-sqlite3';
import ConnectorCacheRepository from './connector-cache.repository';

jest.mock('../tests/__mocks__/database.mock');

let database: Database;
let repository: ConnectorCacheRepository;
describe('ConnectorCacheRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    database = new SqliteDatabaseMock();
    database.prepare = jest.fn().mockReturnValue({
      run,
      get,
      all
    });
    repository = new ConnectorCacheRepository(database);
  });

  it('should properly init south cache table', () => {
    repository.createSouthCacheScanModeTable();

    expect(repository.database.prepare).toHaveBeenCalledWith(
      'CREATE TABLE IF NOT EXISTS cache_history (scan_mode_id TEXT, item_id TEXT, interval_index INTEGER, max_instant TEXT, PRIMARY KEY(scan_mode_id, item_id));'
    );
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('should properly get a south cache', () => {
    const expectedValue: SouthCache = {
      scanModeId: 'id1',
      itemId: 'itemId',
      intervalIndex: 1,
      maxInstant: '2023-03-01T10:30:16.000Z'
    };
    get.mockReturnValueOnce({ scanModeId: 'id1', itemId: 'itemId', intervalIndex: 1, maxInstant: '2023-03-01T10:30:16.000Z' });
    const southCache = repository.getSouthCacheScanMode('id1', 'itemId');
    expect(database.prepare).toHaveBeenCalledWith(
      'SELECT scan_mode_id AS scanModeId, item_id AS itemId, interval_index AS intervalIndex, max_instant AS maxInstant FROM cache_history WHERE scan_mode_id = ? AND item_id = ?;'
    );
    expect(get).toHaveBeenCalledWith('id1', 'itemId');
    expect(southCache).toEqual(expectedValue);
  });

  it('should create a south cache', () => {
    run.mockReturnValueOnce({ lastInsertRowid: 1 });
    get.mockReturnValueOnce(null);

    const command: SouthCache = {
      scanModeId: 'id1',
      itemId: 'itemId',
      intervalIndex: 1,
      maxInstant: '2023-03-01T10:30:16.000Z'
    };

    repository.createOrUpdateCacheScanMode(command);
    expect(get).toHaveBeenCalledWith('id1', 'itemId');
    expect(database.prepare).toHaveBeenCalledWith(
      'INSERT INTO cache_history (scan_mode_id, item_id, interval_index, max_instant) VALUES (?, ?, ?, ?);'
    );
    expect(run).toHaveBeenCalledWith(command.scanModeId, command.itemId, command.intervalIndex, command.maxInstant);
  });

  it('should update a south cache', () => {
    run.mockReturnValueOnce({ lastInsertRowid: 1 });
    get.mockReturnValueOnce({ scanModeId: 'id1', intervalIndex: 1, maxInstant: '2023-03-01T10:30:16.000Z' });

    const command: SouthCache = {
      scanModeId: 'id1',
      itemId: 'itemId',
      intervalIndex: 2,
      maxInstant: '2023-03-01T10:30:16.000Z'
    };

    repository.createOrUpdateCacheScanMode(command);
    expect(get).toHaveBeenCalledWith('id1', 'itemId');
    expect(database.prepare).toHaveBeenCalledWith(
      'UPDATE cache_history SET interval_index = ?, max_instant = ? WHERE scan_mode_id = ? AND item_id = ?;'
    );
    expect(run).toHaveBeenCalledWith(command.intervalIndex, command.maxInstant, command.scanModeId, command.itemId);
  });

  it('should delete a south connector', () => {
    repository.deleteCacheScanMode('id1', 'itemId');
    expect(database.prepare).toHaveBeenCalledWith('DELETE FROM cache_history WHERE scan_mode_id = ? AND item_id = ?;');
    expect(run).toHaveBeenCalledWith('id1', 'itemId');
  });

  it('should reset cache', () => {
    repository.resetSouthCacheDatabase();
    expect(database.prepare).toHaveBeenCalledWith('DELETE FROM cache_history;');
    expect(run).toHaveBeenCalledTimes(1);
  });
});
