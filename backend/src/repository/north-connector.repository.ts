import { generateRandomId } from '../service/utils';
import { NorthConnectorCommandDTO, NorthConnectorDTO } from '../../../shared/model/north-connector.model';
import { Database } from 'better-sqlite3';

export const NORTH_CONNECTORS_TABLE = 'north_connectors';

/**
 * Repository used for North connectors
 */
export default class NorthConnectorRepository {
  constructor(private readonly database: Database) {}

  findAll(): Array<NorthConnectorDTO> {
    const query =
      `SELECT id, name, type, description, enabled, settings, caching_scan_mode_id AS cachingScanModeId, ` +
      `caching_group_count AS cachingGroupCount, caching_retry_interval AS cachingRetryInterval, ` +
      `caching_retry_count AS cachingRetryCount, caching_max_send_count AS cachingMaxSendCount, ` +
      `caching_send_file_immediately AS cachingSendFileImmediately, caching_max_size AS cachingMaxSize, archive_enabled AS archiveEnabled, ` +
      `archive_retention_duration AS archiveRetentionDuration FROM ${NORTH_CONNECTORS_TABLE};`;
    return this.database
      .prepare(query)
      .all()
      .map((result: any) => ({
        id: result.id,
        name: result.name,
        type: result.type,
        description: result.description,
        enabled: Boolean(result.enabled),
        settings: JSON.parse(result.settings),
        caching: {
          scanModeId: result.cachingScanModeId,
          retryInterval: result.cachingRetryInterval,
          retryCount: result.cachingRetryCount,
          maxSize: result.cachingMaxSize,
          oibusTimeValues: {
            groupCount: result.cachingGroupCount,
            maxSendCount: result.cachingMaxSendCount
          },
          rawFiles: {
            sendFileImmediately: Boolean(result.cachingSendFileImmediately),
            archive: {
              enabled: Boolean(result.archiveEnabled),
              retentionDuration: result.archiveRetentionDuration
            }
          }
        }
      }))
      .filter(result =>
        ['aws-s3', 'azure-blob', 'console', 'file-writer', 'oianalytics', 'oibus', 'rest-api', 'sftp'].includes(result.type)
      );
  }

  findById(id: string): NorthConnectorDTO | null {
    const query =
      `SELECT id, name, type, description, enabled, settings, caching_scan_mode_id AS cachingScanModeId, ` +
      `caching_group_count AS cachingGroupCount, caching_retry_interval AS cachingRetryInterval, ` +
      `caching_retry_count AS cachingRetryCount, caching_max_send_count AS cachingMaxSendCount, ` +
      `caching_send_file_immediately AS cachingSendFileImmediately, caching_max_size AS cachingMaxSize, archive_enabled AS archiveEnabled, ` +
      `archive_retention_duration AS archiveRetentionDuration FROM ${NORTH_CONNECTORS_TABLE} WHERE id = ?;`;
    const result: any = this.database.prepare(query).get(id) as any;

    if (!result) {
      return null;
    }

    return {
      id: result.id,
      name: result.name,
      type: result.type,
      description: result.description,
      enabled: Boolean(result.enabled),
      settings: JSON.parse(result.settings),
      caching: {
        scanModeId: result.cachingScanModeId,
        retryInterval: result.cachingRetryInterval,
        retryCount: result.cachingRetryCount,
        maxSize: result.cachingMaxSize,
        oibusTimeValues: {
          groupCount: result.cachingGroupCount,
          maxSendCount: result.cachingMaxSendCount
        },
        rawFiles: {
          sendFileImmediately: Boolean(result.cachingSendFileImmediately),
          archive: {
            enabled: Boolean(result.archiveEnabled),
            retentionDuration: result.archiveRetentionDuration
          }
        }
      }
    };
  }

  create(command: NorthConnectorCommandDTO): NorthConnectorDTO {
    const id = generateRandomId(6);
    const insertQuery =
      `INSERT INTO ${NORTH_CONNECTORS_TABLE} (id, name, type, description, enabled, settings, ` +
      `caching_scan_mode_id, caching_group_count, caching_retry_interval, caching_retry_count, caching_max_send_count, ` +
      `caching_send_file_immediately, caching_max_size, archive_enabled, archive_retention_duration) ` +
      `VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`;
    const insertResult = this.database
      .prepare(insertQuery)
      .run(
        id,
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

    const query =
      `SELECT id, name, type, description, enabled, settings, caching_scan_mode_id AS cachingScanModeId, ` +
      `caching_group_count AS cachingGroupCount, caching_retry_interval AS cachingRetryInterval, ` +
      `caching_retry_count AS cachingRetryCount, caching_max_send_count AS cachingMaxSendCount, ` +
      `caching_send_file_immediately AS cachingSendFileImmediately, caching_max_size AS cachingMaxSize, archive_enabled AS archiveEnabled, ` +
      `archive_retention_duration AS archiveRetentionDuration FROM ${NORTH_CONNECTORS_TABLE} WHERE ROWID = ?;`;
    const result: any = this.database.prepare(query).get(insertResult.lastInsertRowid);
    return {
      id: result.id,
      name: result.name,
      type: result.type,
      description: result.description,
      enabled: Boolean(result.enabled),
      settings: JSON.parse(result.settings),
      caching: {
        scanModeId: result.cachingScanModeId,
        retryInterval: result.cachingRetryInterval,
        retryCount: result.cachingRetryCount,
        maxSize: result.cachingMaxSize,
        oibusTimeValues: {
          groupCount: result.cachingGroupCount,
          maxSendCount: result.cachingMaxSendCount
        },
        rawFiles: {
          sendFileImmediately: Boolean(result.cachingSendFileImmediately),
          archive: {
            enabled: Boolean(result.archiveEnabled),
            retentionDuration: result.archiveRetentionDuration
          }
        }
      }
    };
  }

  start(id: string) {
    const query = `UPDATE ${NORTH_CONNECTORS_TABLE} SET enabled = ? WHERE id = ?;`;
    this.database.prepare(query).run(1, id);
  }

  stop(id: string) {
    const query = `UPDATE ${NORTH_CONNECTORS_TABLE} SET enabled = ? WHERE id = ?;`;
    this.database.prepare(query).run(0, id);
  }

  update(id: string, command: NorthConnectorCommandDTO): void {
    const query =
      `UPDATE ${NORTH_CONNECTORS_TABLE} SET name = ?, description = ?, settings = ?, ` +
      `caching_scan_mode_id = ?, caching_group_count = ?, caching_retry_interval = ?, caching_retry_count = ?, ` +
      `caching_max_send_count = ?, caching_send_file_immediately = ?, caching_max_size = ?, archive_enabled = ?, archive_retention_duration = ? ` +
      `WHERE id = ?;`;
    this.database
      .prepare(query)
      .run(
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
        id
      );
  }

  delete(id: string): void {
    const query = `DELETE FROM ${NORTH_CONNECTORS_TABLE} WHERE id = ?;`;
    this.database.prepare(query).run(id);
  }
}
