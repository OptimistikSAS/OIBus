import { generateRandomId } from '../../service/utils';
import { Database } from 'better-sqlite3';
import { NorthConnectorEntity, NorthConnectorEntityLight } from '../../model/north-connector.model';
import { NorthSettings } from '../../../../shared/model/north-settings.model';
import { toSouthConnectorLight } from './south-connector.repository';
import { SouthConnectorEntityLight } from '../../model/south-connector.model';

const NORTH_CONNECTORS_TABLE = 'north_connectors';
const SUBSCRIPTION_TABLE = 'subscription';
const SOUTH_CONNECTORS_TABLE = 'south_connectors';

/**
 * Repository used for North connectors
 */
export default class NorthConnectorRepository {
  constructor(private readonly database: Database) {}

  findAllNorth(): Array<NorthConnectorEntityLight> {
    const query = `SELECT id, name, type, description, enabled FROM ${NORTH_CONNECTORS_TABLE};`;
    return this.database
      .prepare(query)
      .all()
      .map(result => this.toNorthConnectorLight(result as Record<string, string>));
  }

  findNorthById<N extends NorthSettings>(id: string): NorthConnectorEntity<N> | null {
    const query =
      `SELECT id, name, type, description, enabled, settings, caching_scan_mode_id, ` +
      `caching_group_count, caching_retry_interval, ` +
      `caching_retry_count, caching_max_send_count, ` +
      `caching_send_file_immediately, caching_max_size, archive_enabled, ` +
      `archive_retention_duration FROM ${NORTH_CONNECTORS_TABLE} WHERE id = ?;`;
    const result = this.database.prepare(query).get(id);
    if (!result) return null;
    return this.toNorthConnector<N>(result as Record<string, string | number>);
  }

  saveNorthConnector(north: NorthConnectorEntity<NorthSettings>): void {
    const transaction = this.database.transaction(() => {
      if (!north.id) {
        north.id = generateRandomId(6);
        const insertQuery =
          `INSERT INTO ${NORTH_CONNECTORS_TABLE} (id, name, type, description, enabled, settings, ` +
          `caching_scan_mode_id, caching_group_count, caching_retry_interval, caching_retry_count, caching_max_send_count, ` +
          `caching_send_file_immediately, caching_max_size, archive_enabled, archive_retention_duration) ` +
          `VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`;
        this.database
          .prepare(insertQuery)
          .run(
            north.id,
            north.name,
            north.type,
            north.description,
            +north.enabled,
            JSON.stringify(north.settings),
            north.caching.scanModeId,
            north.caching.oibusTimeValues.groupCount,
            north.caching.retryInterval,
            north.caching.retryCount,
            north.caching.oibusTimeValues.maxSendCount,
            +north.caching.rawFiles.sendFileImmediately,
            north.caching.maxSize,
            +north.caching.rawFiles.archive.enabled,
            north.caching.rawFiles.archive.retentionDuration
          );
      } else {
        const query =
          `UPDATE ${NORTH_CONNECTORS_TABLE} SET name = ?, description = ?, settings = ?, ` +
          `caching_scan_mode_id = ?, caching_group_count = ?, caching_retry_interval = ?, caching_retry_count = ?, ` +
          `caching_max_send_count = ?, caching_send_file_immediately = ?, caching_max_size = ?, archive_enabled = ?, archive_retention_duration = ? ` +
          `WHERE id = ?;`;
        this.database
          .prepare(query)
          .run(
            north.name,
            north.description,
            JSON.stringify(north.settings),
            north.caching.scanModeId,
            north.caching.oibusTimeValues.groupCount,
            north.caching.retryInterval,
            north.caching.retryCount,
            north.caching.oibusTimeValues.maxSendCount,
            +north.caching.rawFiles.sendFileImmediately,
            north.caching.maxSize,
            +north.caching.rawFiles.archive.enabled,
            north.caching.rawFiles.archive.retentionDuration,
            north.id
          );
      }

      if (north.subscriptions.length > 0) {
        this.database
          .prepare(
            `DELETE FROM ${SUBSCRIPTION_TABLE} WHERE north_connector_id = ? AND south_connector_id NOT IN (${north.subscriptions
              .map(() => '?')
              .join(', ')});`
          )
          .run(
            north.id,
            north.subscriptions.map(subscription => subscription.id)
          );

        const insert = this.database.prepare(
          `INSERT OR IGNORE INTO ${SUBSCRIPTION_TABLE} (north_connector_id, south_connector_id) VALUES (?, ?);`
        );
        for (const subscription of north.subscriptions) {
          insert.run(north.id, subscription.id);
        }
      } else {
        this.database.prepare(`DELETE FROM ${SUBSCRIPTION_TABLE} WHERE north_connector_id = ?;`).run(north.id);
      }
    });
    transaction();
  }

  startNorth(id: string) {
    const query = `UPDATE ${NORTH_CONNECTORS_TABLE} SET enabled = ? WHERE id = ?;`;
    this.database.prepare(query).run(1, id);
  }

  stopNorth(id: string) {
    const query = `UPDATE ${NORTH_CONNECTORS_TABLE} SET enabled = ? WHERE id = ?;`;
    this.database.prepare(query).run(0, id);
  }

  deleteNorth(id: string): void {
    const transaction = this.database.transaction(() => {
      this.database.prepare(`DELETE FROM ${NORTH_CONNECTORS_TABLE} WHERE id = ?;`).run(id);
      this.database.prepare(`DELETE FROM ${SUBSCRIPTION_TABLE} WHERE north_connector_id = ?;`).run(id);
    });
    transaction();
  }

  listNorthSubscriptions(northId: string): Array<SouthConnectorEntityLight> {
    const query = `SELECT id, name, type, description, enabled, settings
            FROM ${SOUTH_CONNECTORS_TABLE}
            LEFT JOIN ${SUBSCRIPTION_TABLE}
              ON ${SUBSCRIPTION_TABLE}.south_connector_id = ${SOUTH_CONNECTORS_TABLE}.id
            WHERE ${SUBSCRIPTION_TABLE}.north_connector_id = ?;`;
    return this.database
      .prepare(query)
      .all(northId)
      .map(result => toSouthConnectorLight(result as Record<string, string>));
  }

  checkSubscription(northId: string, southId: string): boolean {
    const query = `SELECT south_connector_id AS southId FROM ${SUBSCRIPTION_TABLE} WHERE north_connector_id = ? AND south_connector_id = ?;`;
    return !!this.database.prepare(query).get(northId, southId);
  }

  createSubscription(northId: string, southId: string): void {
    const query = `INSERT INTO ${SUBSCRIPTION_TABLE} (north_connector_id, south_connector_id) ` + 'VALUES (?, ?);';
    this.database.prepare(query).run(northId, southId);
  }

  deleteSubscription(northId: string, southId: string): void {
    const query = `DELETE FROM ${SUBSCRIPTION_TABLE} WHERE north_connector_id = ? AND south_connector_id = ?;`;
    this.database.prepare(query).run(northId, southId);
  }

  deleteAllSubscriptionsByNorth(northId: string): void {
    const query = `DELETE FROM ${SUBSCRIPTION_TABLE} WHERE north_connector_id = ?;`;
    this.database.prepare(query).run(northId);
  }

  private toNorthConnectorLight(result: Record<string, string>): NorthConnectorEntityLight {
    return {
      id: result.id,
      name: result.name,
      type: result.type,
      description: result.description,
      enabled: Boolean(result.enabled)
    };
  }

  private toNorthConnector<N extends NorthSettings>(result: Record<string, string | number>): NorthConnectorEntity<N> {
    return {
      id: result.id as string,
      name: result.name as string,
      type: result.type as string,
      description: result.description as string,
      enabled: Boolean(result.enabled),
      settings: JSON.parse(result.settings as string) as N,
      caching: {
        scanModeId: result.caching_scan_mode_id as string,
        retryInterval: result.caching_retry_interval as number,
        retryCount: result.caching_retry_count as number,
        maxSize: result.caching_max_size as number,
        oibusTimeValues: {
          groupCount: result.caching_group_count as number,
          maxSendCount: result.caching_max_send_count as number
        },
        rawFiles: {
          sendFileImmediately: Boolean(result.caching_send_file_immediately),
          archive: {
            enabled: Boolean(result.archive_enabled),
            retentionDuration: result.archive_retention_duration as number
          }
        }
      },
      subscriptions: this.listNorthSubscriptions(result.id as string)
    };
  }
}
