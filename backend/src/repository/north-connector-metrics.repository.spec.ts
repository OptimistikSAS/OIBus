import SqliteDatabaseMock, { all, get, run } from '../tests/__mocks__/database.mock';
import { Database } from 'better-sqlite3';
import NorthConnectorMetricsRepository from './north-connector-metrics.repository';
import { NorthConnectorMetrics } from '../../../shared/model/engine.model';

jest.mock('../tests/__mocks__/database.mock');
const nowDateString = '2020-02-02T02:02:02.222Z';

let database: Database;
let repository: NorthConnectorMetricsRepository;
describe('NorthConnectorMetricsRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(nowDateString));

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

    repository.initMetrics('id1');
    expect(repository.getMetrics).toHaveBeenCalledWith('id1');
    expect(repository.database.prepare).toHaveBeenCalledWith(
      `INSERT INTO north_metrics (north_id, metrics_start, nb_values, nb_files, ` +
        `last_value, last_file, last_connection, last_run_start, last_run_duration, cache_size) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`
    );
    expect(run).toHaveBeenCalledWith('id1', nowDateString, 0, 0, null, null, null, null, null, 0);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('should get metrics', () => {
    const nullMetrics = repository.getMetrics('id1');
    expect(repository.database.prepare).toHaveBeenCalledWith(
      `SELECT metrics_start AS metricsStart, nb_values AS numberOfValuesSent, nb_files AS numberOfFilesSent, ` +
        `last_value AS lastValueSent, last_file AS lastFileSent, last_connection AS lastConnection, last_run_start AS lastRunStart, ` +
        `last_run_duration AS lastRunDuration, cache_size AS cacheSize FROM north_metrics WHERE north_id = ?;`
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
      lastRunDuration: 120,
      cacheSize: 123
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
      lastRunDuration: 120,
      cacheSize: 123
    });

    get.mockReturnValueOnce({
      metricsStart: '2020-02-02T02:02:02.222Z',
      numberOfValuesSent: 22,
      numberOfFilesSent: 33,
      lastValueSent: '',
      lastFileSent: 'myFile',
      lastConnection: '2020-02-02T02:02:02.222Z',
      lastRunStart: '2020-02-02T02:02:02.222Z',
      lastRunDuration: 120,
      cacheSize: 123
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
      lastRunDuration: 120,
      cacheSize: 123
    });
  });

  it('should update metrics', () => {
    const newConnectorMetrics: NorthConnectorMetrics = {
      metricsStart: '2020-02-02T02:02:02.222Z',
      numberOfValuesSent: 22,
      numberOfFilesSent: 33,
      lastValueSent: { pointId: 'pointId', timestamp: '2020-02-02T02:02:02.222Z', data: { value: '13' } },
      lastFileSent: 'myFile',
      lastConnection: '2020-02-02T02:02:02.222Z',
      lastRunStart: '2020-02-02T02:02:02.222Z',
      lastRunDuration: 120,
      cacheSize: 123
    };

    repository.updateMetrics('northId', newConnectorMetrics);
    expect(repository.database.prepare).toHaveBeenCalledWith(
      `UPDATE north_metrics SET metrics_start = ?, nb_values = ?, nb_files = ?, last_value = ?, last_file = ?, ` +
        `last_connection = ?, last_run_start = ?, last_run_duration = ?, cache_size = ? WHERE north_id = ?;`
    );
    expect(run).toHaveBeenCalledWith(
      newConnectorMetrics.metricsStart,
      newConnectorMetrics.numberOfValuesSent,
      newConnectorMetrics.numberOfFilesSent,
      JSON.stringify(newConnectorMetrics.lastValueSent),
      newConnectorMetrics.lastFileSent,
      newConnectorMetrics.lastConnection,
      newConnectorMetrics.lastRunStart,
      newConnectorMetrics.lastRunDuration,
      123,
      'northId'
    );

    const connectorMetricsWithNullValue: NorthConnectorMetrics = {
      metricsStart: '2020-02-02T02:02:02.222Z',
      numberOfValuesSent: 22,
      numberOfFilesSent: 33,
      lastValueSent: null,
      lastFileSent: 'myFile',
      lastConnection: '2020-02-02T02:02:02.222Z',
      lastRunStart: '2020-02-02T02:02:02.222Z',
      lastRunDuration: 120,
      cacheSize: 123
    };

    repository.updateMetrics('northId', connectorMetricsWithNullValue);

    expect(run).toHaveBeenCalledWith(
      newConnectorMetrics.metricsStart,
      newConnectorMetrics.numberOfValuesSent,
      newConnectorMetrics.numberOfFilesSent,
      null,
      newConnectorMetrics.lastFileSent,
      newConnectorMetrics.lastConnection,
      newConnectorMetrics.lastRunStart,
      newConnectorMetrics.lastRunDuration,
      123,
      'northId'
    );
  });

  it('should delete a north metrics', () => {
    repository.removeMetrics('id1');
    expect(database.prepare).toHaveBeenCalledWith('DELETE FROM north_metrics WHERE north_id = ?;');
    expect(run).toHaveBeenCalledWith('id1');
  });
});
