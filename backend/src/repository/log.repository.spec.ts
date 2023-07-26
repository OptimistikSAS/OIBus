import SqliteDatabaseMock, { all, get, run } from '../tests/__mocks__/database.mock';
import LogRepository from './log.repository';
import { Page } from '../../../shared/model/types';
import { LogDTO } from '../../../shared/model/logs.model';
import { Database } from 'better-sqlite3';

jest.mock('../tests/__mocks__/database.mock');

let database: Database;
let repository: LogRepository;
describe('Log repository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    database = new SqliteDatabaseMock();
    database.prepare = jest.fn().mockReturnValue({
      run,
      get,
      all
    });
    repository = new LogRepository(database);
  });

  it('should properly get logs by search criteria', () => {
    const expectedValue: Page<LogDTO> = {
      content: [
        {
          timestamp: '2023-01-01T00:00:00.000Z',
          level: 'error',
          scopeType: 'data-stream',
          message: 'my log 1'
        },
        {
          timestamp: '2023-01-02T00:00:00.000Z',
          level: 'error',
          scopeType: 'data-stream',
          message: 'my log 2'
        }
      ],
      size: 50,
      number: 0,
      totalElements: 2,
      totalPages: 1
    };
    all.mockReturnValueOnce([
      {
        timestamp: '2023-01-01T00:00:00.000Z',
        level: 'error',
        scopeType: 'data-stream',
        message: 'my log 1'
      },
      {
        timestamp: '2023-01-02T00:00:00.000Z',
        level: 'error',
        scopeType: 'data-stream',
        message: 'my log 2'
      }
    ]);
    get.mockReturnValueOnce({ count: 2 });
    const logs = repository.searchLogs({
      page: 0,
      messageContent: 'messageContent',
      scopeTypes: ['myScopeType1', 'myScopeType2'],
      scopeIds: ['myScopeId1', 'myScopeId2'],
      start: '2023-01-01T00:00:00.000Z',
      end: '2023-01-02T00:00:00.000Z',
      levels: ['info', 'debug']
    });
    expect(database.prepare).toHaveBeenCalledWith(
      'SELECT timestamp, level, scope_id AS scopeId, scope_type as scopeType, scope_name as scopeName, message FROM logs WHERE timestamp BETWEEN ? AND ? AND level IN (?,?) ' +
        "AND scope_id IN (?,?) AND scope_type IN (?,?) AND message LIKE '%' || ? || '%' ORDER BY timestamp DESC LIMIT 50 OFFSET ?;"
    );
    expect(logs).toEqual(expectedValue);

    expect(database.prepare).toHaveBeenCalledWith(
      "SELECT COUNT(*) as count FROM logs WHERE timestamp BETWEEN ? AND ? AND level IN (?,?) AND scope_id IN (?,?) AND scope_type IN (?,?) AND message LIKE '%' || ? || '%'"
    );
  });

  it('should add logs', () => {
    repository.addLogs([
      { msg: 'my message 1', scopeType: 'myScopeType', scopeId: 'scopeId', scopeName: 'scope name', time: 0, level: '30' },
      { msg: 'my message 1', scopeType: 'myScopeType', scopeId: 'scopeId', scopeName: 'scope name', time: 1, level: '10' }
    ]);

    expect(database.prepare).toHaveBeenCalledWith(
      'INSERT INTO logs (timestamp, level, scope_type, scope_id, scope_name, message) VALUES (?,?,?,?,?,?), (?,?,?,?,?,?);'
    );
    expect(run).toHaveBeenCalledWith(
      0,
      'info',
      'myScopeType',
      'scopeId',
      'scope name',
      'my message 1',
      1,
      'trace',
      'myScopeType',
      'scopeId',
      'scope name',
      'my message 1'
    );
  });

  it('should not add logs if empty array', () => {
    repository.addLogs();
    repository.addLogs([]);

    expect(database.prepare).not.toHaveBeenCalled();
  });

  it('should count logs', () => {
    get.mockReturnValueOnce({ count: 2 });
    const result = repository.countLogs();

    expect(database.prepare).toHaveBeenCalledWith('SELECT COUNT(*) AS count FROM logs');
    expect(get).toHaveBeenCalledTimes(1);
    expect(result).toEqual(2);
  });

  it('should delete logs', () => {
    repository.deleteLogs(2);

    expect(database.prepare).toHaveBeenCalledWith(
      'DELETE FROM logs WHERE timestamp IN (SELECT timestamp FROM logs ORDER BY timestamp LIMIT ?);'
    );
    expect(run).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenCalledWith(2);
  });
});
