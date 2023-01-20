import { SCAN_MODE_TABLE } from "./scan-mode.repository";
import {
  HistoryQueryCommandDTO,
  HistoryQueryDTO,
} from "../model/history-query.model";
import { generateRandomId } from "./utils";
import { NORTH_CONNECTOR_TABLE } from "./north-connector.repository";

const HISTORY_QUERIES_TABLE = "history_queries";

export default class HistoryQueryRepository {
  private readonly database;

  constructor(database) {
    this.database = database;
    const query =
      `CREATE TABLE IF NOT EXISTS ${HISTORY_QUERIES_TABLE} (id TEXT PRIMARY KEY, name TEXT, description TEXT, ` +
      `enabled INTEGER, start_time TEXT, end_time TEXT, south_type TEXT, north_type TEXT, ` +
      `south_settings TEXT, north_settings TEXT, caching_scan_mode_id TEXT, caching_group_count INTEGER, caching_retry_interval INTEGER, ` +
      `caching_retry_count INTEGER, caching_max_send_count INTEGER, caching_timeout INTEGER, archive_enabled INTEGER, ` +
      `archive_retention_duration INTEGER, FOREIGN KEY(caching_scan_mode_id) REFERENCES ${SCAN_MODE_TABLE}(id));`;
    this.database.prepare(query).run();
  }

  /**
   * Get all HistoryQueries.
   * @return {Object[]} - The HistoryQueries
   */
  getHistoryQueries(): Array<HistoryQueryDTO> {
    const query =
      `SELECT id, name, description, enabled, start_time as startTime, end_time as endTime, south_type AS southType, ` +
      `north_type AS northType, south_settings AS southSettings, north_settings AS northSettings, ` +
      `caching_scan_mode_id AS cachingScanModeId, caching_group_count AS cachingGroupCount, caching_retry_interval AS ` +
      `cachingRetryInterval, caching_retry_count AS cachingRetryCount, caching_max_send_count AS cachingMaxSendCount, ` +
      `caching_timeout AS cachingTimeout, archive_enabled AS archiveEnabled, ` +
      `archive_retention_duration AS archiveRetentionDuration FROM ${HISTORY_QUERIES_TABLE};`;
    const results = this.database.prepare(query).all();
    return results.map((result) => this.toHistoryQueryDTO(result));
  }

  /**
   * Get a HistoryQuery
   */
  getHistoryQuery(id: string): HistoryQueryDTO {
    const query =
      `SELECT id, name, description, enabled, start_time as startTime, end_time as endTime, south_type AS southType, ` +
      `north_type AS northType, south_settings AS southSettings, north_settings AS northSettings, ` +
      `caching_scan_mode_id AS cachingScanModeId, caching_group_count AS cachingGroupCount, caching_retry_interval AS ` +
      `cachingRetryInterval, caching_retry_count AS cachingRetryCount, caching_max_send_count AS cachingMaxSendCount, ` +
      `caching_timeout AS cachingTimeout, archive_enabled AS archiveEnabled, ` +
      `archive_retention_duration AS archiveRetentionDuration FROM ${HISTORY_QUERIES_TABLE} WHERE id = ?;`;
    const result = this.database.prepare(query).get(id);

    if (!result) {
      return null;
    }

    return this.toHistoryQueryDTO(result);
  }

  /**
   * Create a new HistoryQuery
   */
  createHistoryQuery(command: HistoryQueryCommandDTO): HistoryQueryDTO {
    const id = generateRandomId(6);

    const insertQuery =
      `INSERT INTO ${HISTORY_QUERIES_TABLE} (id, name, description, enabled, start_time, end_time, ` +
      `south_type, north_type, south_settings, north_settings, caching_scan_mode_id, caching_group_count, ` +
      `caching_retry_interval, caching_retry_count, caching_max_send_count, caching_timeout, archive_enabled, ` +
      `archive_retention_duration) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    const insertResult = this.database
      .prepare(insertQuery)
      .run(
        id,
        command.name,
        command.description,
        +command.enabled,
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
        command.caching.timeout,
        +command.archive.enabled,
        command.archive.retentionDuration
      );

    const query =
      `SELECT id, name, description, enabled, start_time as startTime, end_time as endTime, south_type AS southType, ` +
      `north_type AS northType, south_settings AS southSettings, north_settings AS northSettings, ` +
      `caching_scan_mode_id AS cachingScanModeId, caching_group_count AS cachingGroupCount, caching_retry_interval AS ` +
      `cachingRetryInterval, caching_retry_count AS cachingRetryCount, caching_max_send_count AS cachingMaxSendCount, ` +
      `caching_timeout AS cachingTimeout, archive_enabled AS archiveEnabled, ` +
      `archive_retention_duration AS archiveRetentionDuration FROM ${HISTORY_QUERIES_TABLE} WHERE ROWID = ?;`;
    const result = this.database
      .prepare(query)
      .get(insertResult.lastInsertRowid);

    return this.toHistoryQueryDTO(result);
  }

  /**
   * Update a History query by its ID
   */
  updateHistoryQuery(id: string, command: HistoryQueryCommandDTO): void {
    const query =
      `UPDATE ${HISTORY_QUERIES_TABLE} SET name = ?, description = ?, enabled = ?, start_time = ?, ` +
      `end_time = ?, south_type = ?, north_type = ?, south_settings = ?, north_settings = ?,` +
      `caching_scan_mode_id = ?, caching_group_count = ?, caching_retry_interval = ?, caching_retry_count = ?, ` +
      `caching_max_send_count = ?, caching_timeout = ?, archive_enabled = ?, archive_retention_duration = ? ` +
      `WHERE id = ?;`;
    return this.database
      .prepare(query)
      .run(
        command.name,
        command.description,
        +command.enabled,
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
        command.caching.timeout,
        +command.archive.enabled,
        command.archive.retentionDuration,
        id
      );
  }

  /**
   * Delete a History query by its ID
   */
  deleteHistoryQuery(id: string): void {
    const query = `DELETE FROM ${HISTORY_QUERIES_TABLE} WHERE id = ?;`;
    return this.database.prepare(query).run(id);
  }

  private toHistoryQueryDTO(result): HistoryQueryDTO {
    return {
      id: result.id,
      name: result.name,
      description: result.description,
      enabled: result.enabled,
      startTime: result.startTime,
      endTime: result.endTime,
      southType: result.southType,
      northType: result.northType,
      southSettings: JSON.parse(result.southSettings),
      northSettings: JSON.parse(result.northSettings),
      caching: {
        scanModeId: result.cachingScanModeId,
        groupCount: result.cachingGroupCount,
        retryInterval: result.cachingRetryInterval,
        retryCount: result.cachingRetryCount,
        maxSendCount: result.cachingMaxSendCount,
        timeout: result.cachingTimeout,
      },
      archive: {
        enabled: result.archiveEnabled,
        retentionDuration: result.archiveRetentionDuration,
      },
    };
  }
}
