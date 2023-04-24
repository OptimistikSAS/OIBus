import SqliteDatabaseMock, { all, get, run } from '../tests/__mocks__/database.mock';
import { SouthCache } from '../../../shared/model/south-connector.model';
import { Database } from 'better-sqlite3';
import ConnectorCacheRepository, { METRICS_TABLE } from './connector-cache.repository';
import { ConnectorMetrics } from '../../../shared/model/engine.model';

jest.mock('../tests/__mocks__/database.mock');

let database: Database;
let repository: ConnectorCacheRepository;
describe('South cache repository', () => {
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

  it('should properly init metrics table', () => {
    repository.getMetrics = jest.fn();

    repository.createMetricsTable('id1');
    expect(repository.database.prepare).toHaveBeenCalledWith(
      `CREATE TABLE IF NOT EXISTS metrics(connector_id TEXT PRIMARY KEY,metrics_start TEXT,nb_values INTEGER, ` +
        `nb_files INTEGER, last_value TEXT, last_file TEXT, last_connection TEXT, last_run_start TEXT, last_run_duration INTEGER);`
    );
    expect(repository.getMetrics).toHaveBeenCalledWith('id1');
    expect(repository.database.prepare).toHaveBeenCalledWith(
      `INSERT INTO metrics (connector_id, metrics_start, nb_values, nb_files, ` +
        `last_value, last_file, last_connection, last_run_start, last_run_duration) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`
    );
    expect(run).toHaveBeenCalledWith();
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('should get metrics', () => {
    const nullMetrics = repository.getMetrics('id1');
    expect(repository.database.prepare).toHaveBeenCalledWith(
      `SELECT metrics_start AS metricsStart, nb_values AS numberOfValues, nb_files AS numberOfFiles, ` +
        `last_value AS lastValue, last_file AS lastFile, last_connection AS lastConnection, last_run_start AS lastRunStart, ` +
        `last_run_duration AS lastRunDuration FROM metrics WHERE connector_id = ?;`
    );
    expect(nullMetrics).toBeNull();

    get.mockReturnValueOnce({
      metricsStart: '2020-02-02T02:02:02.222Z',
      numberOfValues: 22,
      numberOfFiles: 33,
      lastValue: '{}',
      lastFile: 'myFile',
      lastConnection: '2020-02-02T02:02:02.222Z',
      lastRunStart: '2020-02-02T02:02:02.222Z',
      lastRunDuration: 120
    });
    const metrics = repository.getMetrics('id1');
    expect(metrics).toEqual({
      metricsStart: '2020-02-02T02:02:02.222Z',
      numberOfValues: 22,
      numberOfFiles: 33,
      lastValue: {},
      lastFile: 'myFile',
      lastConnection: '2020-02-02T02:02:02.222Z',
      lastRunStart: '2020-02-02T02:02:02.222Z',
      lastRunDuration: 120
    });

    get.mockReturnValueOnce({
      metricsStart: '2020-02-02T02:02:02.222Z',
      numberOfValues: 22,
      numberOfFiles: 33,
      lastValue: '',
      lastFile: 'myFile',
      lastConnection: '2020-02-02T02:02:02.222Z',
      lastRunStart: '2020-02-02T02:02:02.222Z',
      lastRunDuration: 120
    });
    const metricsWithEmptyValue = repository.getMetrics('id1');
    expect(metricsWithEmptyValue).toEqual({
      metricsStart: '2020-02-02T02:02:02.222Z',
      numberOfValues: 22,
      numberOfFiles: 33,
      lastValue: null,
      lastFile: 'myFile',
      lastConnection: '2020-02-02T02:02:02.222Z',
      lastRunStart: '2020-02-02T02:02:02.222Z',
      lastRunDuration: 120
    });
  });

  it('should update metrics', () => {
    const newConnectorMetrics: ConnectorMetrics = {
      metricsStart: '2020-02-02T02:02:02.222Z',
      numberOfValues: 22,
      numberOfFiles: 33,
      lastValue: {},
      lastFile: 'myFile',
      lastConnection: '2020-02-02T02:02:02.222Z',
      lastRunStart: '2020-02-02T02:02:02.222Z',
      lastRunDuration: 120
    };

    repository.updateMetrics(newConnectorMetrics);
    expect(repository.database.prepare).toHaveBeenCalledWith(
      `UPDATE metrics SET metrics_start = ?, nb_values = ?, nb_files = ?,  ` +
        `last_value = ?, last_file = ?, last_connection = ?, last_run_start = ?, last_run_duration = ?;`
    );
    expect(run).toHaveBeenCalledWith(
      newConnectorMetrics.metricsStart,
      newConnectorMetrics.numberOfValues,
      newConnectorMetrics.numberOfFiles,
      JSON.stringify(newConnectorMetrics.lastValue),
      newConnectorMetrics.lastFile,
      newConnectorMetrics.lastConnection,
      newConnectorMetrics.lastRunStart,
      newConnectorMetrics.lastRunDuration
    );

    const connectorMetricsWithNullValue: ConnectorMetrics = {
      metricsStart: '2020-02-02T02:02:02.222Z',
      numberOfValues: 22,
      numberOfFiles: 33,
      lastValue: null,
      lastFile: 'myFile',
      lastConnection: '2020-02-02T02:02:02.222Z',
      lastRunStart: '2020-02-02T02:02:02.222Z',
      lastRunDuration: 120
    };

    repository.updateMetrics(connectorMetricsWithNullValue);

    expect(run).toHaveBeenCalledWith(
      newConnectorMetrics.metricsStart,
      newConnectorMetrics.numberOfValues,
      newConnectorMetrics.numberOfFiles,
      null,
      newConnectorMetrics.lastFile,
      newConnectorMetrics.lastConnection,
      newConnectorMetrics.lastRunStart,
      newConnectorMetrics.lastRunDuration
    );
  });

  it('should delete a south metrics', () => {
    repository.removeMetrics('id1');
    expect(database.prepare).toHaveBeenCalledWith('DELETE FROM metrics WHERE connector_id = ?;');
    expect(run).toHaveBeenCalledWith('id1');
  });
});
