import SqliteDatabaseMock, { all, get, run } from '../tests/__mocks__/database.mock';
import { Database } from 'better-sqlite3';
import SouthConnectorMetricsRepository from './south-connector-metrics.repository';
import { SouthConnectorMetrics } from '../../../shared/model/engine.model';

jest.mock('../tests/__mocks__/database.mock');

let database: Database;
let repository: SouthConnectorMetricsRepository;
describe('SouthConnectorMetricsRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    database = new SqliteDatabaseMock();
    database.prepare = jest.fn().mockReturnValue({
      run,
      get,
      all
    });
    repository = new SouthConnectorMetricsRepository(database);
  });

  it('should properly init metrics table', () => {
    repository.getMetrics = jest.fn();

    repository.createMetricsTable('id1');
    expect(repository.database.prepare).toHaveBeenCalledWith(
      `CREATE TABLE IF NOT EXISTS south_metrics(connector_id TEXT PRIMARY KEY, metrics_start TEXT, nb_values INTEGER, ` +
        `nb_files INTEGER, last_value TEXT, last_file TEXT, last_connection TEXT, last_run_start TEXT, last_run_duration INTEGER);`
    );
    expect(repository.getMetrics).toHaveBeenCalledWith('id1');
    expect(repository.database.prepare).toHaveBeenCalledWith(
      `INSERT INTO south_metrics (connector_id, metrics_start, nb_values, nb_files, ` +
        `last_value, last_file, last_connection, last_run_start, last_run_duration) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`
    );
    expect(run).toHaveBeenCalledWith();
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('should get metrics', () => {
    const nullMetrics = repository.getMetrics('id1');
    expect(repository.database.prepare).toHaveBeenCalledWith(
      `SELECT metrics_start AS metricsStart, nb_values AS numberOfValuesRetrieved, nb_files AS numberOfFilesRetrieved, ` +
        `last_value AS lastValueRetrieved, last_file AS lastFileRetrieved, last_connection AS lastConnection, last_run_start AS lastRunStart, ` +
        `last_run_duration AS lastRunDuration FROM south_metrics WHERE connector_id = ?;`
    );
    expect(nullMetrics).toBeNull();

    get.mockReturnValueOnce({
      metricsStart: '2020-02-02T02:02:02.222Z',
      numberOfValuesRetrieved: 22,
      numberOfFilesRetrieved: 33,
      lastValueRetrieved: '{}',
      lastFileRetrieved: 'myFile',
      lastConnection: '2020-02-02T02:02:02.222Z',
      lastRunStart: '2020-02-02T02:02:02.222Z',
      lastRunDuration: 120
    });
    const metrics = repository.getMetrics('id1');
    expect(metrics).toEqual({
      metricsStart: '2020-02-02T02:02:02.222Z',
      numberOfValuesRetrieved: 22,
      numberOfFilesRetrieved: 33,
      lastValueRetrieved: {},
      lastFileRetrieved: 'myFile',
      lastConnection: '2020-02-02T02:02:02.222Z',
      lastRunStart: '2020-02-02T02:02:02.222Z',
      lastRunDuration: 120,
      historyMetrics: {}
    });

    get.mockReturnValueOnce({
      metricsStart: '2020-02-02T02:02:02.222Z',
      numberOfValuesRetrieved: 22,
      numberOfFilesRetrieved: 33,
      lastValueRetrieved: '',
      lastFileRetrieved: 'myFile',
      lastConnection: '2020-02-02T02:02:02.222Z',
      lastRunStart: '2020-02-02T02:02:02.222Z',
      lastRunDuration: 120
    });
    const metricsWithEmptyValue = repository.getMetrics('id1');
    expect(metricsWithEmptyValue).toEqual({
      metricsStart: '2020-02-02T02:02:02.222Z',
      numberOfValuesRetrieved: 22,
      numberOfFilesRetrieved: 33,
      lastValueRetrieved: null,
      lastFileRetrieved: 'myFile',
      lastConnection: '2020-02-02T02:02:02.222Z',
      lastRunStart: '2020-02-02T02:02:02.222Z',
      lastRunDuration: 120,
      historyMetrics: {}
    });
  });

  it('should update metrics', () => {
    const newConnectorMetrics: SouthConnectorMetrics = {
      metricsStart: '2020-02-02T02:02:02.222Z',
      numberOfValuesRetrieved: 22,
      numberOfFilesRetrieved: 33,
      lastValueRetrieved: {},
      lastFileRetrieved: 'myFile',
      lastConnection: '2020-02-02T02:02:02.222Z',
      lastRunStart: '2020-02-02T02:02:02.222Z',
      lastRunDuration: 120,
      historyMetrics: {}
    };

    repository.updateMetrics(newConnectorMetrics);
    expect(repository.database.prepare).toHaveBeenCalledWith(
      `UPDATE south_metrics SET metrics_start = ?, nb_values = ?, nb_files = ?,  ` +
        `last_value = ?, last_file = ?, last_connection = ?, last_run_start = ?, last_run_duration = ?;`
    );
    expect(run).toHaveBeenCalledWith(
      newConnectorMetrics.metricsStart,
      newConnectorMetrics.numberOfValuesRetrieved,
      newConnectorMetrics.numberOfFilesRetrieved,
      JSON.stringify(newConnectorMetrics.lastValueRetrieved),
      newConnectorMetrics.lastFileRetrieved,
      newConnectorMetrics.lastConnection,
      newConnectorMetrics.lastRunStart,
      newConnectorMetrics.lastRunDuration
    );

    const connectorMetricsWithNullValue: SouthConnectorMetrics = {
      metricsStart: '2020-02-02T02:02:02.222Z',
      numberOfValuesRetrieved: 22,
      numberOfFilesRetrieved: 33,
      lastValueRetrieved: null,
      lastFileRetrieved: 'myFile',
      lastConnection: '2020-02-02T02:02:02.222Z',
      lastRunStart: '2020-02-02T02:02:02.222Z',
      lastRunDuration: 120,
      historyMetrics: {}
    };

    repository.updateMetrics(connectorMetricsWithNullValue);

    expect(run).toHaveBeenCalledWith(
      newConnectorMetrics.metricsStart,
      newConnectorMetrics.numberOfValuesRetrieved,
      newConnectorMetrics.numberOfFilesRetrieved,
      null,
      newConnectorMetrics.lastFileRetrieved,
      newConnectorMetrics.lastConnection,
      newConnectorMetrics.lastRunStart,
      newConnectorMetrics.lastRunDuration
    );
  });

  it('should delete a south metrics', () => {
    repository.removeMetrics('id1');
    expect(database.prepare).toHaveBeenCalledWith('DELETE FROM south_metrics WHERE connector_id = ?;');
    expect(run).toHaveBeenCalledWith('id1');
  });
});
