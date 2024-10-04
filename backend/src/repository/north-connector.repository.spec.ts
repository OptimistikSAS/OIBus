import SqliteDatabaseMock, { all, get, run } from '../tests/__mocks__/database.mock';
import { generateRandomId } from '../service/utils';
import NorthConnectorRepository from './north-connector.repository';
import { NorthConnectorCommandDTO, NorthConnectorDTO } from '../../../shared/model/north-connector.model';
import { Database } from 'better-sqlite3';

jest.mock('../tests/__mocks__/database.mock');
jest.mock('../service/utils', () => ({
  generateRandomId: jest.fn(() => '123456')
}));

let database: Database;
let repository: NorthConnectorRepository;
describe('North connector repository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    database = new SqliteDatabaseMock();
    database.prepare = jest.fn().mockReturnValue({
      run,
      get,
      all
    });
    repository = new NorthConnectorRepository(database);
  });

  it('should properly get north connectors', () => {
    const expectedValue: Array<NorthConnectorDTO> = [
      {
        id: 'id1',
        name: 'north1',
        type: 'oianalytics',
        description: 'My north connector',
        enabled: true,
        settings: {},
        caching: {
          scanModeId: 'scanId1',
          retryInterval: 5000,
          retryCount: 3,
          maxSize: 10000,
          oibusTimeValues: {
            groupCount: 1000,
            maxSendCount: 10000
          },
          rawFiles: {
            sendFileImmediately: false,
            archive: {
              enabled: true,
              retentionDuration: 1000
            }
          }
        }
      },
      {
        id: 'id2',
        name: 'north2',
        type: 'oianalytics',
        description: 'My second north connector',
        enabled: true,
        settings: {},
        caching: {
          scanModeId: 'scanId1',
          retryInterval: 5000,
          retryCount: 3,
          maxSize: 10000,
          oibusTimeValues: {
            groupCount: 1000,
            maxSendCount: 10000
          },
          rawFiles: {
            sendFileImmediately: false,
            archive: {
              enabled: true,
              retentionDuration: 1000
            }
          }
        }
      }
    ];
    all.mockReturnValueOnce([
      {
        id: 'id1',
        name: 'north1',
        type: 'oianalytics',
        description: 'My north connector',
        enabled: 1,
        settings: JSON.stringify({}),
        cachingScanModeId: 'scanId1',
        cachingRetryInterval: 5000,
        cachingRetryCount: 3,
        cachingGroupCount: 1000,
        cachingMaxSendCount: 10000,
        cachingSendFileImmediately: 0,
        cachingMaxSize: 10000,
        archiveEnabled: 1,
        archiveRetentionDuration: 1000
      },
      {
        id: 'id2',
        name: 'north2',
        type: 'oianalytics',
        description: 'My second north connector',
        enabled: 1,
        settings: JSON.stringify({}),
        cachingScanModeId: 'scanId1',
        cachingRetryInterval: 5000,
        cachingRetryCount: 3,
        cachingGroupCount: 1000,
        cachingMaxSendCount: 10000,
        cachingSendFileImmediately: 0,
        cachingMaxSize: 10000,
        archiveEnabled: 1,
        archiveRetentionDuration: 1000
      }
    ]);
    const northConnectors = repository.findAll();
    expect(database.prepare).toHaveBeenCalledWith(
      'SELECT id, name, type, description, enabled, settings, caching_scan_mode_id AS cachingScanModeId, ' +
        'caching_group_count AS cachingGroupCount, caching_retry_interval AS cachingRetryInterval, ' +
        'caching_retry_count AS cachingRetryCount, caching_max_send_count AS cachingMaxSendCount, ' +
        'caching_send_file_immediately AS cachingSendFileImmediately, caching_max_size AS cachingMaxSize, archive_enabled AS archiveEnabled, ' +
        'archive_retention_duration AS archiveRetentionDuration FROM north_connectors;'
    );
    expect(northConnectors).toEqual(expectedValue);
  });

  it('should properly get a north connector', () => {
    const expectedValue: NorthConnectorDTO = {
      id: 'id1',
      name: 'north1',
      type: 'NorthConnector',
      description: 'My north connector',
      enabled: true,
      settings: {},
      caching: {
        scanModeId: 'scanId1',
        retryInterval: 5000,
        retryCount: 3,
        maxSize: 10000,
        oibusTimeValues: {
          groupCount: 1000,
          maxSendCount: 10000
        },
        rawFiles: {
          sendFileImmediately: false,
          archive: {
            enabled: true,
            retentionDuration: 1000
          }
        }
      }
    };
    get.mockReturnValueOnce({
      id: 'id1',
      name: 'north1',
      type: 'NorthConnector',
      description: 'My north connector',
      enabled: 1,
      settings: JSON.stringify({}),
      cachingScanModeId: 'scanId1',
      cachingRetryInterval: 5000,
      cachingRetryCount: 3,
      cachingGroupCount: 1000,
      cachingMaxSendCount: 10000,
      cachingSendFileImmediately: 0,
      cachingMaxSize: 10000,
      archiveEnabled: 1,
      archiveRetentionDuration: 1000
    });
    const northConnector = repository.findById('id1');
    expect(database.prepare).toHaveBeenCalledWith(
      'SELECT id, name, type, description, enabled, settings, caching_scan_mode_id AS cachingScanModeId, ' +
        'caching_group_count AS cachingGroupCount, caching_retry_interval AS cachingRetryInterval, ' +
        'caching_retry_count AS cachingRetryCount, caching_max_send_count AS cachingMaxSendCount, ' +
        'caching_send_file_immediately AS cachingSendFileImmediately, caching_max_size AS cachingMaxSize, archive_enabled AS archiveEnabled, ' +
        'archive_retention_duration AS archiveRetentionDuration FROM north_connectors WHERE id = ?;'
    );
    expect(get).toHaveBeenCalledWith('id1');
    expect(northConnector).toEqual(expectedValue);
  });

  it('should return null when north connector not found', () => {
    get.mockReturnValueOnce(null);
    const northConnector = repository.findById('id1');
    expect(database.prepare).toHaveBeenCalledWith(
      'SELECT id, name, type, description, enabled, settings, caching_scan_mode_id AS cachingScanModeId, ' +
        'caching_group_count AS cachingGroupCount, caching_retry_interval AS cachingRetryInterval, ' +
        'caching_retry_count AS cachingRetryCount, caching_max_send_count AS cachingMaxSendCount, ' +
        'caching_send_file_immediately AS cachingSendFileImmediately, caching_max_size AS cachingMaxSize, archive_enabled AS archiveEnabled, ' +
        'archive_retention_duration AS archiveRetentionDuration FROM north_connectors WHERE id = ?;'
    );
    expect(get).toHaveBeenCalledWith('id1');
    expect(northConnector).toBeNull();
  });

  it('should create a north connector', () => {
    run.mockReturnValueOnce({ lastInsertRowid: 1 });
    get.mockReturnValueOnce({ settings: '{}' });

    const command: NorthConnectorCommandDTO = {
      name: 'north1',
      type: 'NorthConnector',
      description: 'My north connector',
      enabled: true,
      settings: {},
      caching: {
        scanModeId: 'scanId1',
        retryInterval: 5000,
        retryCount: 3,
        maxSize: 10000,
        oibusTimeValues: {
          groupCount: 1000,
          maxSendCount: 10000
        },
        rawFiles: {
          sendFileImmediately: false,
          archive: {
            enabled: true,
            retentionDuration: 1000
          }
        }
      }
    };
    repository.create(command);
    expect(generateRandomId).toHaveBeenCalledWith(6);
    expect(database.prepare).toHaveBeenCalledWith(
      'INSERT INTO north_connectors (id, name, type, description, enabled, settings, caching_scan_mode_id, ' +
        'caching_group_count, caching_retry_interval, caching_retry_count, caching_max_send_count, caching_send_file_immediately, caching_max_size, ' +
        'archive_enabled, archive_retention_duration) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);'
    );
    expect(run).toHaveBeenCalledWith(
      '123456',
      command.name,
      command.type,
      command.description,
      +command.enabled,
      JSON.stringify(command.settings),
      command.caching.scanModeId,
      command.caching.oibusTimeValues.groupCount,
      command.caching.retryInterval,
      command.caching.retryCount,
      command.caching.oibusTimeValues.maxSendCount,
      +command.caching.rawFiles.sendFileImmediately,
      command.caching.maxSize,
      +command.caching.rawFiles.archive.enabled,
      command.caching.rawFiles.archive.retentionDuration
    );
    expect(get).toHaveBeenCalledWith(1);

    expect(database.prepare).toHaveBeenCalledWith(
      'SELECT id, name, type, description, enabled, settings, caching_scan_mode_id AS cachingScanModeId, ' +
        'caching_group_count AS cachingGroupCount, caching_retry_interval AS cachingRetryInterval, ' +
        'caching_retry_count AS cachingRetryCount, caching_max_send_count AS cachingMaxSendCount, ' +
        'caching_send_file_immediately AS cachingSendFileImmediately, caching_max_size AS cachingMaxSize, archive_enabled AS archiveEnabled, ' +
        'archive_retention_duration AS archiveRetentionDuration FROM north_connectors WHERE ROWID = ?;'
    );
  });

  it('should update a north connector', () => {
    const command: NorthConnectorCommandDTO = {
      name: 'north1',
      type: 'NorthConnector',
      description: 'My north connector',
      enabled: true,
      settings: {},
      caching: {
        scanModeId: 'scanId1',
        retryInterval: 5000,
        retryCount: 3,
        maxSize: 10000,
        oibusTimeValues: {
          groupCount: 1000,
          maxSendCount: 10000
        },
        rawFiles: {
          sendFileImmediately: false,
          archive: {
            enabled: true,
            retentionDuration: 1000
          }
        }
      }
    };
    repository.update('id1', command);
    expect(database.prepare).toHaveBeenCalledWith(
      'UPDATE north_connectors SET name = ?, description = ?, settings = ?, caching_scan_mode_id = ?, ' +
        'caching_group_count = ?, caching_retry_interval = ?, caching_retry_count = ?, caching_max_send_count = ?, ' +
        'caching_send_file_immediately = ?, caching_max_size = ?, archive_enabled = ?, archive_retention_duration = ? WHERE id = ?;'
    );
    expect(run).toHaveBeenCalledWith(
      command.name,
      command.description,
      JSON.stringify(command.settings),
      command.caching.scanModeId,
      command.caching.oibusTimeValues.groupCount,
      command.caching.retryInterval,
      command.caching.retryCount,
      command.caching.oibusTimeValues.maxSendCount,
      +command.caching.rawFiles.sendFileImmediately,
      command.caching.maxSize,
      +command.caching.rawFiles.archive.enabled,
      command.caching.rawFiles.archive.retentionDuration,
      'id1'
    );
  });

  it('should delete a north connector', () => {
    repository.delete('id1');
    expect(database.prepare).toHaveBeenCalledWith('DELETE FROM north_connectors WHERE id = ?;');
    expect(run).toHaveBeenCalledWith('id1');
  });

  it('should start north connector', () => {
    repository.start('id1');
    expect(database.prepare).toHaveBeenCalledWith('UPDATE north_connectors SET enabled = ? WHERE id = ?;');
    expect(run).toHaveBeenCalledWith(1, 'id1');
  });

  it('should stop north connector', () => {
    repository.stop('id1');
    expect(database.prepare).toHaveBeenCalledWith('UPDATE north_connectors SET enabled = ? WHERE id = ?;');
    expect(run).toHaveBeenCalledWith(0, 'id1');
  });
});
