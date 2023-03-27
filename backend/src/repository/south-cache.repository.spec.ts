import SqliteDatabaseMock, { all, get, run } from '../tests/__mocks__/database.mock';
import { SouthCache } from '../../../shared/model/south-connector.model';
import { Database } from 'better-sqlite3';
import SouthCacheRepository from './south-cache.repository';

jest.mock('../tests/__mocks__/database.mock');

let database: Database;
let repository: SouthCacheRepository;
describe('South cache repository', () => {
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

  it('should properly init south cache table', () => {
    repository.createCacheHistoryTable();

    expect(repository.database.prepare).toHaveBeenCalledWith(
      'CREATE TABLE IF NOT EXISTS cache_history (scan_mode_id TEXT PRIMARY KEY, interval_index INTEGER, max_instant TEXT);'
    );
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('should properly get a south cache', () => {
    const expectedValue: SouthCache = {
      scanModeId: 'id1',
      intervalIndex: 1,
      maxInstant: '2023-03-01T10:30:16.000Z'
    };
    get.mockReturnValueOnce({ scanModeId: 'id1', intervalIndex: 1, maxInstant: '2023-03-01T10:30:16.000Z' });
    const southCache = repository.getSouthCacheScanMode('id1');
    expect(database.prepare).toHaveBeenCalledWith(
      'SELECT scan_mode_id as scanModeId, interval_index as intervalIndex, max_instant as maxInstant FROM cache_history WHERE scan_mode_id = ?;'
    );
    expect(get).toHaveBeenCalledWith('id1');
    expect(southCache).toEqual(expectedValue);
  });

  it('should create a south cache', () => {
    run.mockReturnValueOnce({ lastInsertRowid: 1 });
    get.mockReturnValueOnce(null);

    const command: SouthCache = {
      scanModeId: 'id1',
      intervalIndex: 1,
      maxInstant: '2023-03-01T10:30:16.000Z'
    };

    repository.createOrUpdateCacheScanMode(command);
    expect(get).toHaveBeenCalledWith('id1');
    expect(database.prepare).toHaveBeenCalledWith(
      'INSERT INTO cache_history (scan_mode_id, interval_index, max_instant) VALUES (?, ?, ?);'
    );
    expect(run).toHaveBeenCalledWith(command.scanModeId, command.intervalIndex, command.maxInstant);
  });

  it('should update a south cache', () => {
    run.mockReturnValueOnce({ lastInsertRowid: 1 });
    get.mockReturnValueOnce({ scanModeId: 'id1', intervalIndex: 1, maxInstant: '2023-03-01T10:30:16.000Z' });

    const command: SouthCache = {
      scanModeId: 'id1',
      intervalIndex: 2,
      maxInstant: '2023-03-01T10:30:16.000Z'
    };

    repository.createOrUpdateCacheScanMode(command);
    expect(get).toHaveBeenCalledWith('id1');
    expect(database.prepare).toHaveBeenCalledWith('UPDATE cache_history SET interval_index = ?, max_instant = ? WHERE scan_mode_id = ?;');
    expect(run).toHaveBeenCalledWith(command.intervalIndex, command.maxInstant, command.scanModeId);
  });

  it('should delete a south connector', () => {
    repository.deleteCacheScanMode('id1');
    expect(database.prepare).toHaveBeenCalledWith('DELETE FROM cache_history WHERE scan_mode_id = ?;');
    expect(run).toHaveBeenCalledWith('id1');
  });

  it('should reset cache', () => {
    repository.resetDatabase();
    expect(database.prepare).toHaveBeenCalledWith('DELETE FROM cache_history;');
    expect(run).toHaveBeenCalledTimes(1);
  });
});
