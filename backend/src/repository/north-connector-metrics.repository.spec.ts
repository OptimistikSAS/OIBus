import SqliteDatabaseMock, { all, get, run } from '../tests/__mocks__/database.mock';
import { Database } from 'better-sqlite3';
import NorthConnectorMetricsRepository from './north-connector-metrics.repository';
import { NorthConnectorMetrics } from '../../../shared/model/engine.model';

jest.mock('../tests/__mocks__/database.mock');

let database: Database;
let repository: NorthConnectorMetricsRepository;
describe('NorthConnectorMetricsRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    database = new SqliteDatabaseMock();
    database.prepare = jest.fn().mockReturnValue({
      run,
      get,
      all
    });
    repository = new NorthConnectorMetricsRepository(database);
  });

  it('should properly init metrics table', () => {
    repository.getMetrics = jest.fn();

    repository.createMetricsTable('id1');
    expect(repository.database.prepare).toHaveBeenCalledWith(
      `CREATE TABLE IF NOT EXISTS north_metrics(connector_id TEXT PRIMARY KEY, metrics_start TEXT, nb_values INTEGER, ` +
        `nb_files INTEGER, last_value TEXT, last_file TEXT, last_connection TEXT, last_run_start TEXT, last_run_duration INTEGER);`
    );
    expect(repository.getMetrics).toHaveBeenCalledWith('id1');
    expect(repository.database.prepare).toHaveBeenCalledWith(
      `INSERT INTO north_metrics (connector_id, metrics_start, nb_values, nb_files, ` +
        `last_value, last_file, last_connection, last_run_start, last_run_duration) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`
    );
    expect(run).toHaveBeenCalledWith();
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('should get metrics', () => {
    const nullMetrics = repository.getMetrics('id1');
    expect(repository.database.prepare).toHaveBeenCalledWith(
      `SELECT metrics_start AS metricsStart, nb_values AS numberOfValuesSent, nb_files AS numberOfFilesSent, ` +
        `last_value AS lastValueSent, last_file AS lastFileSent, last_connection AS lastConnection, last_run_start AS lastRunStart, ` +
        `last_run_duration AS lastRunDuration FROM north_metrics WHERE connector_id = ?;`
    );
    expect(nullMetrics).toBeNull();

    get.mockReturnValueOnce({
      metricsStart: '2020-02-02T02:02:02.222Z',
      numberOfValuesSent: 22,
      numberOfFilesSent: 33,
      lastValueSent: '{}',
      lastFileSent: 'myFile',
      lastConnection: '2020-02-02T02:02:02.222Z',
      lastRunStart: '2020-02-02T02:02:02.222Z',
      lastRunDuration: 120
    });
    const metrics = repository.getMetrics('id1');
    expect(metrics).toEqual({
      metricsStart: '2020-02-02T02:02:02.222Z',
      numberOfValuesSent: 22,
      numberOfFilesSent: 33,
      lastValueSent: {},
      lastFileSent: 'myFile',
      lastConnection: '2020-02-02T02:02:02.222Z',
      lastRunStart: '2020-02-02T02:02:02.222Z',
      lastRunDuration: 120
    });

    get.mockReturnValueOnce({
      metricsStart: '2020-02-02T02:02:02.222Z',
      numberOfValuesSent: 22,
      numberOfFilesSent: 33,
      lastValueSent: '',
      lastFileSent: 'myFile',
      lastConnection: '2020-02-02T02:02:02.222Z',
      lastRunStart: '2020-02-02T02:02:02.222Z',
      lastRunDuration: 120
    });
    const metricsWithEmptyValue = repository.getMetrics('id1');
    expect(metricsWithEmptyValue).toEqual({
      metricsStart: '2020-02-02T02:02:02.222Z',
      numberOfValuesSent: 22,
      numberOfFilesSent: 33,
      lastValueSent: null,
      lastFileSent: 'myFile',
      lastConnection: '2020-02-02T02:02:02.222Z',
      lastRunStart: '2020-02-02T02:02:02.222Z',
      lastRunDuration: 120
    });
  });

  it('should update metrics', () => {
    const newConnectorMetrics: NorthConnectorMetrics = {
      metricsStart: '2020-02-02T02:02:02.222Z',
      numberOfValuesSent: 22,
      numberOfFilesSent: 33,
      lastValueSent: {},
      lastFileSent: 'myFile',
      lastConnection: '2020-02-02T02:02:02.222Z',
      lastRunStart: '2020-02-02T02:02:02.222Z',
      lastRunDuration: 120
    };

    repository.updateMetrics(newConnectorMetrics);
    expect(repository.database.prepare).toHaveBeenCalledWith(
      `UPDATE north_metrics SET metrics_start = ?, nb_values = ?, nb_files = ?,  ` +
        `last_value = ?, last_file = ?, last_connection = ?, last_run_start = ?, last_run_duration = ?;`
    );
    expect(run).toHaveBeenCalledWith(
      newConnectorMetrics.metricsStart,
      newConnectorMetrics.numberOfValuesSent,
      newConnectorMetrics.numberOfFilesSent,
      JSON.stringify(newConnectorMetrics.lastValueSent),
      newConnectorMetrics.lastFileSent,
      newConnectorMetrics.lastConnection,
      newConnectorMetrics.lastRunStart,
      newConnectorMetrics.lastRunDuration
    );

    const connectorMetricsWithNullValue: NorthConnectorMetrics = {
      metricsStart: '2020-02-02T02:02:02.222Z',
      numberOfValuesSent: 22,
      numberOfFilesSent: 33,
      lastValueSent: null,
      lastFileSent: 'myFile',
      lastConnection: '2020-02-02T02:02:02.222Z',
      lastRunStart: '2020-02-02T02:02:02.222Z',
      lastRunDuration: 120
    };

    repository.updateMetrics(connectorMetricsWithNullValue);

    expect(run).toHaveBeenCalledWith(
      newConnectorMetrics.metricsStart,
      newConnectorMetrics.numberOfValuesSent,
      newConnectorMetrics.numberOfFilesSent,
      null,
      newConnectorMetrics.lastFileSent,
      newConnectorMetrics.lastConnection,
      newConnectorMetrics.lastRunStart,
      newConnectorMetrics.lastRunDuration
    );
  });

  it('should delete a south metrics', () => {
    repository.removeMetrics('id1');
    expect(database.prepare).toHaveBeenCalledWith('DELETE FROM north_metrics WHERE connector_id = ?;');
    expect(run).toHaveBeenCalledWith('id1');
  });
});
