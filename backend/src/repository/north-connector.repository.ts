import { generateRandomId } from '../service/utils';
import { NorthConnectorCommandDTO, NorthConnectorDTO } from '../../../shared/model/north-connector.model';
import { SCAN_MODE_TABLE } from './scan-mode.repository';
import { Database } from 'better-sqlite3';

export const NORTH_CONNECTOR_TABLE = 'north_connector';

/**
 * Repository used for North connectors
 */
export default class NorthConnectorRepository {
  private readonly database: Database;
  constructor(database: Database) {
    this.database = database;
    const query =
      `CREATE TABLE IF NOT EXISTS ${NORTH_CONNECTOR_TABLE} (id TEXT PRIMARY KEY, name TEXT, type TEXT, description TEXT, ` +
      `enabled INTEGER, settings TEXT, caching_scan_mode_id TEXT, caching_group_count INTEGER, caching_retry_interval INTEGER, ` +
      `caching_retry_count INTEGER, caching_max_send_count INTEGER, caching_timeout INTEGER, archive_enabled INTEGER, ` +
      `archive_retention_duration INTEGER, FOREIGN KEY(caching_scan_mode_id) REFERENCES ${SCAN_MODE_TABLE}(id));`;
    this.database.prepare(query).run();
  }

  /**
   * Retrieve all North connectors
   */
  getNorthConnectors(): Array<NorthConnectorDTO> {
    const query =
      `SELECT id, name, type, description, enabled, settings, caching_scan_mode_id AS cachingScanModeId, ` +
      `caching_group_count AS cachingGroupCount, caching_retry_interval AS cachingRetryInterval, ` +
      `caching_retry_count AS cachingRetryCount, caching_max_send_count AS cachingMaxSendCount, ` +
      `caching_timeout AS cachingTimeout, archive_enabled AS archiveEnabled, ` +
      `archive_retention_duration AS archiveRetentionDuration FROM ${NORTH_CONNECTOR_TABLE};`;
    return this.database
      .prepare(query)
      .all()
      .map(result => ({
        id: result.id,
        name: result.name,
        type: result.type,
        description: result.description,
        enabled: result.enabled,
        settings: JSON.parse(result.settings),
        caching: {
          scanModeId: result.cachingScanModeId,
          groupCount: result.cachingGroupCount,
          retryInterval: result.cachingRetryInterval,
          retryCount: result.cachingRetryCount,
          maxSendCount: result.cachingMaxSendCount,
          timeout: result.cachingTimeout
        },
        archive: {
          enabled: result.archiveEnabled,
          retentionDuration: result.archiveRetentionDuration
        }
      }));
  }

  /**
   * Retrieve a North connector by its ID
   */
  getNorthConnector(id: string): NorthConnectorDTO {
    const query =
      `SELECT id, name, type, description, enabled, settings, caching_scan_mode_id AS cachingScanModeId, ` +
      `caching_group_count AS cachingGroupCount, caching_retry_interval AS cachingRetryInterval, ` +
      `caching_retry_count AS cachingRetryCount, caching_max_send_count AS cachingMaxSendCount, ` +
      `caching_timeout AS cachingTimeout, archive_enabled AS archiveEnabled, ` +
      `archive_retention_duration AS archiveRetentionDuration FROM ${NORTH_CONNECTOR_TABLE} WHERE id = ?;`;
    const result = this.database.prepare(query).get(id);
    return {
      id: result.id,
      name: result.name,
      type: result.type,
      description: result.description,
      enabled: result.enabled,
      settings: JSON.parse(result.settings),
      caching: {
        scanModeId: result.cachingScanModeId,
        groupCount: result.cachingGroupCount,
        retryInterval: result.cachingRetryInterval,
        retryCount: result.cachingRetryCount,
        maxSendCount: result.cachingMaxSendCount,
        timeout: result.cachingTimeout
      },
      archive: {
        enabled: result.archiveEnabled,
        retentionDuration: result.archiveRetentionDuration
      }
    };
  }

  /**
   * Create a North connector with a random generated ID
   */
  createNorthConnector(command: NorthConnectorCommandDTO): NorthConnectorDTO {
    const id = generateRandomId(6);
    const insertQuery =
      `INSERT INTO ${NORTH_CONNECTOR_TABLE} (id, name, type, description, enabled, settings, ` +
      `caching_scan_mode_id, caching_group_count, caching_retry_interval, caching_retry_count, caching_max_send_count, ` +
      `caching_timeout, archive_enabled, archive_retention_duration) ` +
      `VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`;
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
        command.caching.groupCount,
        command.caching.retryInterval,
        command.caching.retryCount,
        command.caching.maxSendCount,
        command.caching.timeout,
        +command.archive.enabled,
        command.archive.retentionDuration
      );

    const query =
      `SELECT id, name, type, description, enabled, settings, caching_scan_mode_id AS cachingScanModeId, ` +
      `caching_group_count AS cachingGroupCount, caching_retry_interval AS cachingRetryInterval, ` +
      `caching_retry_count AS cachingRetryCount, caching_max_send_count AS cachingMaxSendCount, ` +
      `caching_timeout AS cachingTimeout, archive_enabled AS archiveEnabled, ` +
      `archive_retention_duration AS archiveRetentionDuration FROM ${NORTH_CONNECTOR_TABLE} WHERE ROWID = ?;`;
    const result = this.database.prepare(query).get(insertResult.lastInsertRowid);
    return {
      id: result.id,
      name: result.name,
      type: result.type,
      description: result.description,
      enabled: result.enabled,
      settings: JSON.parse(result.settings),
      caching: {
        scanModeId: result.cachingScanModeId,
        groupCount: result.cachingGroupCount,
        retryInterval: result.cachingRetryInterval,
        retryCount: result.cachingRetryCount,
        maxSendCount: result.cachingMaxSendCount,
        timeout: result.cachingTimeout
      },
      archive: {
        enabled: result.archiveEnabled,
        retentionDuration: result.archiveRetentionDuration
      }
    };
  }

  /**
   * Update a North connector by its ID
   */
  updateNorthConnector(id: string, command: NorthConnectorCommandDTO): void {
    const query =
      `UPDATE ${NORTH_CONNECTOR_TABLE} SET name = ?, description = ?, enabled = ?, settings = ?, ` +
      `caching_scan_mode_id = ?, caching_group_count = ?, caching_retry_interval = ?, caching_retry_count = ?, ` +
      `caching_max_send_count = ?, caching_timeout = ?, archive_enabled = ?, archive_retention_duration = ? ` +
      `WHERE id = ?;`;
    this.database
      .prepare(query)
      .run(
        command.name,
        command.description,
        +command.enabled,
        JSON.stringify(command.settings),
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
   * Delete a North Connector by its ID
   */
  deleteNorthConnector(id: string): void {
    const query = `DELETE FROM ${NORTH_CONNECTOR_TABLE} WHERE id = ?;`;
    this.database.prepare(query).run(id);
  }
}
