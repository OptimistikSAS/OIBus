import SqliteDatabaseMock, { run, all, get } from '../tests/__mocks__/database.mock';
import { generateRandomId } from '../service/utils';
import HistoryQueryRepository from './history-query.repository';
import { HistoryQueryCommandDTO, HistoryQueryDTO } from '../../../shared/model/history-query.model';
import { Database } from 'better-sqlite3';

jest.mock('../tests/__mocks__/database.mock');
jest.mock('../service/utils', () => ({
  generateRandomId: jest.fn(() => '123456')
}));

let database: Database;
let repository: HistoryQueryRepository;
describe('History Query repository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    database = new SqliteDatabaseMock();
    database.prepare = jest.fn().mockReturnValue({
      run,
      get,
      all
    });
    repository = new HistoryQueryRepository(database);
  });

  it('should properly init north connector table', () => {
    expect(database.prepare).toHaveBeenCalledWith(
      `CREATE TABLE IF NOT EXISTS history_queries (id TEXT PRIMARY KEY, name TEXT, description TEXT, ` +
        `enabled INTEGER, start_time TEXT, end_time TEXT, south_type TEXT, north_type TEXT, ` +
        `south_settings TEXT, north_settings TEXT, history_max_instant_per_item INTEGER, history_max_read_interval INTEGER, ` +
        `history_read_delay INTEGER, caching_scan_mode_id TEXT, caching_group_count INTEGER, caching_retry_interval INTEGER, ` +
        `caching_retry_count INTEGER, caching_max_send_count INTEGER, caching_max_size INTEGER, archive_enabled INTEGER, ` +
        `archive_retention_duration INTEGER, FOREIGN KEY(caching_scan_mode_id) REFERENCES scan_mode(id));`
    );
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('should properly get north connectors', () => {
    const expectedValue: Array<HistoryQueryDTO> = [
      {
        id: 'id1',
        name: 'historyQuery1',
        description: 'My history query',
        enabled: true,
        history: {
          maxInstantPerItem: true,
          maxReadInterval: 3600,
          readDelay: 0
        },
        startTime: '2023-01-01T00:00:00.000Z',
        endTime: '2023-02-01T00:00:00.000Z',
        southType: 'SQL',
        northType: 'OIConnect',
        southSettings: {},
        northSettings: {},
        caching: {
          scanModeId: 'scanId1',
          retryInterval: 5000,
          retryCount: 3,
          groupCount: 1000,
          maxSendCount: 10000,
          maxSize: 10000
        },
        archive: {
          enabled: true,
          retentionDuration: 1000
        }
      },
      {
        id: 'id2',
        name: 'historyQuery2',
        description: 'My second history query',
        enabled: true,
        history: {
          maxInstantPerItem: true,
          maxReadInterval: 3600,
          readDelay: 0
        },
        startTime: '2023-01-01T00:00:00.000Z',
        endTime: '2023-02-01T00:00:00.000Z',
        southType: 'SQL',
        northType: 'OIConnect',
        southSettings: {},
        northSettings: {},
        caching: {
          scanModeId: 'scanId1',
          retryInterval: 5000,
          retryCount: 3,
          groupCount: 1000,
          maxSendCount: 10000,
          maxSize: 10000
        },
        archive: {
          enabled: true,
          retentionDuration: 1000
        }
      }
    ];
    all.mockReturnValueOnce([
      {
        id: 'id1',
        name: 'historyQuery1',
        description: 'My history query',
        enabled: true,
        maxInstantPerItem: true,
        maxReadInterval: 3600,
        readDelay: 0,
        startTime: '2023-01-01T00:00:00.000Z',
        endTime: '2023-02-01T00:00:00.000Z',
        southType: 'SQL',
        northType: 'OIConnect',
        southSettings: JSON.stringify({}),
        northSettings: JSON.stringify({}),
        cachingScanModeId: 'scanId1',
        cachingRetryInterval: 5000,
        cachingRetryCount: 3,
        cachingGroupCount: 1000,
        cachingMaxSendCount: 10000,
        cachingMaxSize: 10000,
        archiveEnabled: true,
        archiveRetentionDuration: 1000
      },
      {
        id: 'id2',
        name: 'historyQuery2',
        description: 'My second history query',
        enabled: true,
        maxInstantPerItem: true,
        maxReadInterval: 3600,
        readDelay: 0,
        startTime: '2023-01-01T00:00:00.000Z',
        endTime: '2023-02-01T00:00:00.000Z',
        southType: 'SQL',
        northType: 'OIConnect',
        southSettings: JSON.stringify({}),
        northSettings: JSON.stringify({}),
        cachingScanModeId: 'scanId1',
        cachingRetryInterval: 5000,
        cachingRetryCount: 3,
        cachingGroupCount: 1000,
        cachingMaxSendCount: 10000,
        cachingMaxSize: 10000,
        archiveEnabled: true,
        archiveRetentionDuration: 1000
      }
    ]);
    const southConnectors = repository.getHistoryQueries();
    expect(database.prepare).toHaveBeenCalledWith(
      `SELECT id, name, description, enabled, history_max_instant_per_item AS maxInstantPerItem, ` +
        `history_max_read_interval AS maxReadInterval, history_read_delay AS readDelay, start_time AS startTime, end_time AS endTime, ` +
        `south_type AS southType, north_type AS northType, south_settings AS southSettings, north_settings AS northSettings, ` +
        `caching_scan_mode_id AS cachingScanModeId, caching_group_count AS cachingGroupCount, caching_retry_interval AS ` +
        `cachingRetryInterval, caching_retry_count AS cachingRetryCount, caching_max_send_count AS cachingMaxSendCount, ` +
        `caching_max_size AS cachingMaxSize, archive_enabled AS archiveEnabled, ` +
        `archive_retention_duration AS archiveRetentionDuration FROM history_queries;`
    );
    expect(southConnectors).toEqual(expectedValue);
  });

  it('should properly get a history query', () => {
    const expectedValue: HistoryQueryDTO = {
      id: 'id1',
      name: 'historyQuery1',
      description: 'My history query',
      enabled: true,
      history: {
        maxInstantPerItem: true,
        maxReadInterval: 3600,
        readDelay: 0
      },
      startTime: '2023-01-01T00:00:00.000Z',
      endTime: '2023-02-01T00:00:00.000Z',
      southType: 'SQL',
      northType: 'OIConnect',
      southSettings: {},
      northSettings: {},
      caching: {
        scanModeId: 'scanId1',
        retryInterval: 5000,
        retryCount: 3,
        groupCount: 1000,
        maxSendCount: 10000,
        maxSize: 10000
      },
      archive: {
        enabled: true,
        retentionDuration: 1000
      }
    };
    get.mockReturnValueOnce({
      id: 'id1',
      name: 'historyQuery1',
      description: 'My history query',
      enabled: true,
      maxInstantPerItem: true,
      maxReadInterval: 3600,
      readDelay: 0,
      startTime: '2023-01-01T00:00:00.000Z',
      endTime: '2023-02-01T00:00:00.000Z',
      southType: 'SQL',
      northType: 'OIConnect',
      southSettings: JSON.stringify({}),
      northSettings: JSON.stringify({}),
      cachingScanModeId: 'scanId1',
      cachingRetryInterval: 5000,
      cachingRetryCount: 3,
      cachingGroupCount: 1000,
      cachingMaxSendCount: 10000,
      cachingMaxSize: 10000,
      archiveEnabled: true,
      archiveRetentionDuration: 1000
    });
    const historyQuery = repository.getHistoryQuery('id1');
    expect(database.prepare).toHaveBeenCalledWith(
      `SELECT id, name, description, enabled, history_max_instant_per_item AS maxInstantPerItem, ` +
        `history_max_read_interval AS maxReadInterval, history_read_delay AS readDelay, start_time AS startTime, end_time AS endTime, ` +
        `south_type AS southType, north_type AS northType, south_settings AS southSettings, north_settings AS northSettings, ` +
        `caching_scan_mode_id AS cachingScanModeId, caching_group_count AS cachingGroupCount, caching_retry_interval AS ` +
        `cachingRetryInterval, caching_retry_count AS cachingRetryCount, caching_max_send_count AS cachingMaxSendCount, ` +
        `caching_max_size AS cachingMaxSize, archive_enabled AS archiveEnabled, ` +
        `archive_retention_duration AS archiveRetentionDuration FROM history_queries WHERE id = ?;`
    );
    expect(get).toHaveBeenCalledWith('id1');
    expect(historyQuery).toEqual(expectedValue);
  });

  it('should return null if not found', () => {
    get.mockReturnValueOnce(null);
    const historyQuery = repository.getHistoryQuery('id1');
    expect(database.prepare).toHaveBeenCalledWith(
      `SELECT id, name, description, enabled, history_max_instant_per_item AS maxInstantPerItem, ` +
        `history_max_read_interval AS maxReadInterval, history_read_delay AS readDelay, start_time AS startTime, end_time AS endTime, ` +
        `south_type AS southType, north_type AS northType, south_settings AS southSettings, north_settings AS northSettings, ` +
        `caching_scan_mode_id AS cachingScanModeId, caching_group_count AS cachingGroupCount, caching_retry_interval AS ` +
        `cachingRetryInterval, caching_retry_count AS cachingRetryCount, caching_max_send_count AS cachingMaxSendCount, ` +
        `caching_max_size AS cachingMaxSize, archive_enabled AS archiveEnabled, ` +
        `archive_retention_duration AS archiveRetentionDuration FROM history_queries WHERE id = ?;`
    );
    expect(get).toHaveBeenCalledWith('id1');
    expect(historyQuery).toEqual(null);
  });

  it('should create a history query', () => {
    const command: HistoryQueryCommandDTO = {
      name: 'historyQuery1',
      description: 'My history query',
      enabled: true,
      history: {
        maxInstantPerItem: true,
        maxReadInterval: 3600,
        readDelay: 0
      },
      startTime: '2023-01-01T00:00:00.000Z',
      endTime: '2023-02-01T00:00:00.000Z',
      southType: 'SQL',
      northType: 'OIConnect',
      southSettings: {},
      northSettings: {},
      caching: {
        scanModeId: 'scanId1',
        retryInterval: 5000,
        retryCount: 3,
        groupCount: 1000,
        maxSendCount: 10000,
        maxSize: 10000
      },
      archive: {
        enabled: true,
        retentionDuration: 1000
      }
    };

    const result = {
      id: 'id1',
      name: 'historyQuery1',
      description: 'My history query',
      enabled: true,
      maxInstantPerItem: true,
      maxReadInterval: 3600,
      readDelay: 0,
      startTime: '2023-01-01T00:00:00.000Z',
      endTime: '2023-02-01T00:00:00.000Z',
      southType: 'SQL',
      northType: 'OIConnect',
      southSettings: JSON.stringify({}),
      northSettings: JSON.stringify({}),
      cachingScanModeId: 'scanId1',
      cachingRetryInterval: 5000,
      cachingRetryCount: 3,
      cachingGroupCount: 1000,
      cachingMaxSendCount: 10000,
      cachingMaxSize: 10000,
      archiveEnabled: true,
      archiveRetentionDuration: 1000
    };
    const runFn = jest.fn(() => ({ lastInsertRowId: 1 }));
    const getFn = jest.fn(() => result);
    database.prepare = jest.fn().mockReturnValueOnce({ run: runFn }).mockReturnValueOnce({ get: getFn });
    repository.createHistoryQuery(command);
    expect(generateRandomId).toHaveBeenCalledWith(6);
    expect(database.prepare).toHaveBeenCalledWith(
      `INSERT INTO history_queries (id, name, description, enabled, history_max_instant_per_item, history_max_read_interval, ` +
        `history_read_delay, start_time, end_time, south_type, north_type, south_settings, north_settings, caching_scan_mode_id, caching_group_count, ` +
        `caching_retry_interval, caching_retry_count, caching_max_send_count, caching_max_size, archive_enabled, ` +
        `archive_retention_duration) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    expect(runFn).toHaveBeenCalledWith(
      '123456',
      command.name,
      command.description,
      +command.enabled,
      +command.history.maxInstantPerItem,
      command.history.maxReadInterval,
      command.history.readDelay,
      command.startTime,
      command.endTime,
      command.southType,
      command.northType,
      JSON.stringify(command.southSettings),
      JSON.stringify(command.northSettings),
      command.caching.scanModeId,
      command.caching.groupCount,
      command.caching.retryInterval,
      command.caching.retryCount,
      command.caching.maxSendCount,
      command.caching.maxSize,
      +command.archive.enabled,
      command.archive.retentionDuration
    );

    expect(database.prepare).toHaveBeenCalledWith(
      `SELECT id, name, description, enabled, history_max_instant_per_item AS maxInstantPerItem, ` +
        `history_max_read_interval AS maxReadInterval, history_read_delay AS readDelay, start_time AS startTime, end_time AS endTime, ` +
        `south_type AS southType, north_type AS northType, south_settings AS southSettings, north_settings AS northSettings, ` +
        `caching_scan_mode_id AS cachingScanModeId, caching_group_count AS cachingGroupCount, caching_retry_interval AS ` +
        `cachingRetryInterval, caching_retry_count AS cachingRetryCount, caching_max_send_count AS cachingMaxSendCount, ` +
        `caching_max_size AS cachingMaxSize, archive_enabled AS archiveEnabled, ` +
        `archive_retention_duration AS archiveRetentionDuration FROM history_queries WHERE ROWID = ?;`
    );
  });

  it('should update a history query', () => {
    const command: HistoryQueryCommandDTO = {
      name: 'historyQuery1',
      description: 'My history query',
      enabled: true,
      history: {
        maxInstantPerItem: true,
        maxReadInterval: 3600,
        readDelay: 0
      },
      startTime: '2023-01-01T00:00:00.000Z',
      endTime: '2023-02-01T00:00:00.000Z',
      southType: 'SQL',
      northType: 'OIConnect',
      southSettings: {},
      northSettings: {},
      caching: {
        scanModeId: 'scanId1',
        retryInterval: 5000,
        retryCount: 3,
        groupCount: 1000,
        maxSendCount: 10000,
        maxSize: 10000
      },
      archive: {
        enabled: true,
        retentionDuration: 1000
      }
    };
    repository.updateHistoryQuery('id1', command);
    expect(database.prepare).toHaveBeenCalledWith(
      `UPDATE history_queries SET name = ?, description = ?, enabled = ?, history_max_instant_per_item = ?, ` +
        `history_max_read_interval = ?, history_read_delay = ?, start_time = ?, ` +
        `end_time = ?, south_type = ?, north_type = ?, south_settings = ?, north_settings = ?,` +
        `caching_scan_mode_id = ?, caching_group_count = ?, caching_retry_interval = ?, caching_retry_count = ?, ` +
        `caching_max_send_count = ?, caching_max_size = ?, archive_enabled = ?, archive_retention_duration = ? ` +
        `WHERE id = ?;`
    );
    expect(run).toHaveBeenCalledWith(
      command.name,
      command.description,
      +command.enabled,
      +command.history.maxInstantPerItem,
      command.history.maxReadInterval,
      command.history.readDelay,
      command.startTime,
      command.endTime,
      command.southType,
      command.northType,
      JSON.stringify(command.southSettings),
      JSON.stringify(command.northSettings),
      command.caching.scanModeId,
      command.caching.groupCount,
      command.caching.retryInterval,
      command.caching.retryCount,
      command.caching.maxSendCount,
      command.caching.maxSize,
      +command.archive.enabled,
      command.archive.retentionDuration,
      'id1'
    );
  });

  it('should delete a history query', () => {
    repository.deleteHistoryQuery('id1');
    expect(database.prepare).toHaveBeenCalledWith('DELETE FROM history_queries WHERE id = ?;');
    expect(run).toHaveBeenCalledWith('id1');
  });
});
