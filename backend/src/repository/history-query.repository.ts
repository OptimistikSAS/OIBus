import { HistoryQueryCommandDTO, HistoryQueryDTO, HistoryQueryStatus } from '../../../shared/model/history-query.model';
import { generateRandomId } from '../service/utils';
import { Database } from 'better-sqlite3';

export const HISTORY_QUERIES_TABLE = 'history_queries';

interface HistoryQueryResult {
  id: string;
  name: string;
  description: string;
  status: HistoryQueryStatus;
  maxInstantPerItem: boolean;
  maxReadInterval: number;
  readDelay: number;
  startTime: string;
  endTime: string;
  southType: string;
  northType: string;
  southSettings: string;
  southSharedConnection: boolean;
  northSettings: string;
  cachingScanModeId: string;
  cachingGroupCount: number;
  cachingRetryInterval: number;
  cachingRetryCount: number;
  cachingMaxSendCount: number;
  cachingSendFileImmediately: boolean;
  cachingMaxSize: number;
  archiveEnabled: boolean;
  archiveRetentionDuration: number;
}

export default class HistoryQueryRepository {
  constructor(private readonly database: Database) {}

  findAll(): Array<HistoryQueryDTO> {
    const query =
      `SELECT id, name, description, status, history_max_instant_per_item AS maxInstantPerItem, ` +
      `history_max_read_interval AS maxReadInterval, history_read_delay AS readDelay, start_time AS startTime, end_time AS endTime, ` +
      `south_type AS southType, north_type AS northType, south_settings AS southSettings, south_shared_connection as southSharedConnection, north_settings AS northSettings, ` +
      `caching_scan_mode_id AS cachingScanModeId, caching_group_count AS cachingGroupCount, caching_retry_interval AS ` +
      `cachingRetryInterval, caching_retry_count AS cachingRetryCount, caching_max_send_count AS cachingMaxSendCount, ` +
      `caching_send_file_immediately AS cachingSendFileImmediately, caching_max_size AS cachingMaxSize, archive_enabled AS archiveEnabled, ` +
      `archive_retention_duration AS archiveRetentionDuration FROM ${HISTORY_QUERIES_TABLE};`;
    const results: Array<HistoryQueryResult> = this.database.prepare(query).all() as Array<HistoryQueryResult>;
    return results.map(result => this.toHistoryQueryDTO(result));
  }

  findById(id: string): HistoryQueryDTO | null {
    const query =
      `SELECT id, name, description, status, history_max_instant_per_item AS maxInstantPerItem, ` +
      `history_max_read_interval AS maxReadInterval, history_read_delay AS readDelay, start_time AS startTime, end_time AS endTime, ` +
      `south_type AS southType, north_type AS northType, south_settings AS southSettings, south_shared_connection as southSharedConnection, north_settings AS northSettings, ` +
      `caching_scan_mode_id AS cachingScanModeId, caching_group_count AS cachingGroupCount, caching_retry_interval AS ` +
      `cachingRetryInterval, caching_retry_count AS cachingRetryCount, caching_max_send_count AS cachingMaxSendCount, ` +
      `caching_send_file_immediately AS cachingSendFileImmediately, caching_max_size AS cachingMaxSize, archive_enabled AS archiveEnabled, ` +
      `archive_retention_duration AS archiveRetentionDuration FROM ${HISTORY_QUERIES_TABLE} WHERE id = ?;`;
    const result: HistoryQueryResult = this.database.prepare(query).get(id) as HistoryQueryResult;

    if (!result) {
      return null;
    }

    return this.toHistoryQueryDTO(result);
  }

  create(command: HistoryQueryCommandDTO): HistoryQueryDTO {
    const id = generateRandomId(6);

    const insertQuery =
      `INSERT INTO ${HISTORY_QUERIES_TABLE} (id, name, description, status, history_max_instant_per_item, history_max_read_interval, ` +
      `history_read_delay, start_time, end_time, south_type, north_type, south_settings, south_shared_connection, north_settings, caching_scan_mode_id, caching_group_count, ` +
      `caching_retry_interval, caching_retry_count, caching_max_send_count, caching_send_file_immediately, caching_max_size, archive_enabled, ` +
      `archive_retention_duration) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    const insertResult = this.database.prepare(insertQuery).run(
      id,
      command.name,
      command.description,
      'PENDING', // disabled by default at creation
      +command.history.maxInstantPerItem,
      command.history.maxReadInterval,
      command.history.readDelay,
      command.startTime,
      command.endTime,
      command.southType,
      command.northType,
      JSON.stringify(command.southSettings),
      +command.southSharedConnection,
      JSON.stringify(command.northSettings),
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
      `SELECT id, name, description, status, history_max_instant_per_item AS maxInstantPerItem, ` +
      `history_max_read_interval AS maxReadInterval, history_read_delay AS readDelay, start_time AS startTime, end_time AS endTime, ` +
      `south_type AS southType, north_type AS northType, south_settings AS southSettings, south_shared_connection as southSharedConnection, north_settings AS northSettings, ` +
      `caching_scan_mode_id AS cachingScanModeId, caching_group_count AS cachingGroupCount, caching_retry_interval AS ` +
      `cachingRetryInterval, caching_retry_count AS cachingRetryCount, caching_max_send_count AS cachingMaxSendCount, ` +
      `caching_send_file_immediately AS cachingSendFileImmediately, caching_max_size AS cachingMaxSize, archive_enabled AS archiveEnabled, ` +
      `archive_retention_duration AS archiveRetentionDuration FROM ${HISTORY_QUERIES_TABLE} WHERE ROWID = ?;`;
    const result: HistoryQueryResult = this.database.prepare(query).get(insertResult.lastInsertRowid) as HistoryQueryResult;

    return this.toHistoryQueryDTO(result);
  }

  updateStatus(id: string, status: HistoryQueryStatus) {
    const query = `UPDATE ${HISTORY_QUERIES_TABLE} SET status = ? WHERE id = ?;`;
    this.database.prepare(query).run(status, id);
  }

  update(id: string, command: HistoryQueryCommandDTO): void {
    const query =
      `UPDATE ${HISTORY_QUERIES_TABLE} SET name = ?, description = ?, history_max_instant_per_item = ?, ` +
      `history_max_read_interval = ?, history_read_delay = ?, start_time = ?, ` +
      `end_time = ?, south_type = ?, north_type = ?, south_settings = ?, south_shared_connection = ?, north_settings = ?,` +
      `caching_scan_mode_id = ?, caching_group_count = ?, caching_retry_interval = ?, caching_retry_count = ?, ` +
      `caching_max_send_count = ?, caching_send_file_immediately = ?, caching_max_size = ?, archive_enabled = ?, archive_retention_duration = ? ` +
      `WHERE id = ?;`;
    this.database
      .prepare(query)
      .run(
        command.name,
        command.description,
        +command.history.maxInstantPerItem,
        command.history.maxReadInterval,
        command.history.readDelay,
        command.startTime,
        command.endTime,
        command.southType,
        command.northType,
        JSON.stringify(command.southSettings),
        +command.southSharedConnection,
        JSON.stringify(command.northSettings),
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
    const query = `DELETE FROM ${HISTORY_QUERIES_TABLE} WHERE id = ?;`;
    this.database.prepare(query).run(id);
  }

  private toHistoryQueryDTO(result: HistoryQueryResult): HistoryQueryDTO {
    return {
      id: result.id,
      name: result.name,
      description: result.description,
      status: result.status,
      history: {
        maxInstantPerItem: Boolean(result.maxInstantPerItem),
        readDelay: result.readDelay,
        maxReadInterval: result.maxReadInterval,
        overlap: 0
      },
      startTime: result.startTime,
      endTime: result.endTime,
      southType: result.southType,
      northType: result.northType,
      southSettings: JSON.parse(result.southSettings),
      southSharedConnection: Boolean(result.southSharedConnection),
      northSettings: JSON.parse(result.northSettings),
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
}
