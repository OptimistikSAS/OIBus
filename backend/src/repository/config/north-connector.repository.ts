import { generateRandomId } from '../../service/utils';
import { Database } from 'better-sqlite3';
import { NorthConnectorEntity, NorthConnectorEntityLight, NorthConnectorItemEntity } from '../../model/north-connector.model';
import { NorthItemSettings, NorthSettings } from '../../../shared/model/north-settings.model';
import { toSouthConnectorLight } from './south-connector.repository';
import { SouthConnectorEntityLight } from '../../model/south-connector.model';
import { NorthConnectorItemSearchParam, OIBusNorthType } from '../../../shared/model/north-connector.model';
import { Page } from '../../../shared/model/types';
import { Transformer } from '../../model/transformer.model';

const NORTH_CONNECTORS_TABLE = 'north_connectors';
const NORTH_ITEMS_TABLE = 'north_items';
const SUBSCRIPTION_TABLE = 'subscription';
const SOUTH_CONNECTORS_TABLE = 'south_connectors';
const NORTH_TRANSFORMERS_TABLE = 'north_transformers';
const TRANSFORMERS_TABLE = 'transformers';
const PAGE_SIZE = 50;

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

  findNorthById<N extends NorthSettings, I extends NorthItemSettings>(id: string): NorthConnectorEntity<N, I> | null {
    const query =
      `SELECT id, name, type, description, enabled, settings, caching_scan_mode_id, ` +
      `caching_group_count, caching_retry_interval, ` +
      `caching_retry_count, caching_max_send_count, ` +
      `caching_send_file_immediately, caching_max_size, archive_enabled, ` +
      `archive_retention_duration FROM ${NORTH_CONNECTORS_TABLE} WHERE id = ?;`;
    const result = this.database.prepare(query).get(id);
    if (!result) return null;
    return this.toNorthConnector<N, I>(result as Record<string, string | number>);
  }

  saveNorthConnector(north: NorthConnectorEntity<NorthSettings, NorthItemSettings>): void {
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
          `UPDATE ${NORTH_CONNECTORS_TABLE} SET name = ?, description = ?, enabled = ?, settings = ?, ` +
          `caching_scan_mode_id = ?, caching_group_count = ?, caching_retry_interval = ?, caching_retry_count = ?, ` +
          `caching_max_send_count = ?, caching_send_file_immediately = ?, caching_max_size = ?, archive_enabled = ?, archive_retention_duration = ? ` +
          `WHERE id = ?;`;
        this.database
          .prepare(query)
          .run(
            north.name,
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
            north.caching.rawFiles.archive.retentionDuration,
            north.id
          );
      }

      if (north.subscriptions.length > 0) {
        this.database
          .prepare(
            `DELETE FROM ${SUBSCRIPTION_TABLE} WHERE north_connector_id = ? AND south_connector_id NOT IN (${north.subscriptions.map(() => '?').join(', ')});`
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

      if (north.items.length > 0) {
        this.database
          .prepare(`DELETE FROM ${NORTH_ITEMS_TABLE} WHERE connector_id = ? AND id NOT IN (${north.items.map(() => '?').join(', ')});`)
          .run(
            north.id,
            north.items.map(item => item.id)
          );
        const insert = this.database.prepare(
          `INSERT INTO ${NORTH_ITEMS_TABLE} (id, name, enabled, connector_id, settings) VALUES (?, ?, ?, ?, ?);`
        );
        const update = this.database.prepare(`UPDATE ${NORTH_ITEMS_TABLE} SET name = ?, enabled = ?, settings = ? WHERE id = ?;`);
        for (const item of north.items) {
          if (!item.id) {
            item.id = generateRandomId(6);
            insert.run(item.id, item.name, +item.enabled, north.id, JSON.stringify(item.settings));
          } else {
            update.run(item.name, +item.enabled, JSON.stringify(item.settings), item.id);
          }
        }
      } else {
        this.database.prepare(`DELETE FROM ${NORTH_ITEMS_TABLE} WHERE connector_id = ?;`).run(north.id);
      }

      this.database.prepare(`DELETE FROM ${NORTH_TRANSFORMERS_TABLE} WHERE north_id = ?;`).run(north.id);
      if (north.transformers.length > 0) {
        const insert = this.database.prepare(
          `INSERT INTO ${NORTH_TRANSFORMERS_TABLE} (north_id, transformer_id, transformer_order) VALUES (?, ?, ?);`
        );
        for (const transformer of north.transformers) {
          insert.run(north.id, transformer.transformer.id, transformer.order);
        }
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
      this.database.prepare(`DELETE FROM ${NORTH_ITEMS_TABLE} WHERE connector_id = ?;`).run(id);
      this.database.prepare(`DELETE FROM ${NORTH_TRANSFORMERS_TABLE} WHERE north_id = ?;`).run(id);
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

  listItems<I extends NorthItemSettings>(northId: string, searchParams: NorthConnectorItemSearchParam): Array<NorthConnectorItemEntity<I>> {
    let whereClause = `WHERE connector_id = ?`;
    const queryParams = [northId];

    if (searchParams.enabled !== undefined) {
      queryParams.push(`${+searchParams.enabled}`);
      whereClause += ` AND enabled = ?`;
    }
    if (searchParams.name) {
      queryParams.push(searchParams.name);
      whereClause += ` AND name like '%' || ? || '%'`;
    }
    const query = `SELECT id, name, enabled, settings FROM ${NORTH_ITEMS_TABLE} ${whereClause};`;

    return this.database
      .prepare(query)
      .all(...queryParams)
      .map(result => this.toNorthConnectorItemEntity<I>(result as Record<string, string>));
  }

  searchItems<I extends NorthItemSettings>(
    northId: string,
    searchParams: NorthConnectorItemSearchParam
  ): Page<NorthConnectorItemEntity<I>> {
    let whereClause = `WHERE connector_id = ?`;
    const queryParams = [northId];

    const page = searchParams.page ?? 0;

    if (searchParams.enabled !== undefined) {
      queryParams.push(`${+searchParams.enabled}`);
      whereClause += ` AND enabled = ?`;
    }
    if (searchParams.name) {
      queryParams.push(searchParams.name);
      whereClause += ` AND name like '%' || ? || '%'`;
    }
    const query = `SELECT id, name, enabled, settings FROM ${NORTH_ITEMS_TABLE} ${whereClause} LIMIT ${PAGE_SIZE} OFFSET ${PAGE_SIZE * page};`;
    const results = this.database
      .prepare(query)
      .all(...queryParams)
      .map(result => this.toNorthConnectorItemEntity<I>(result as Record<string, string>));
    const totalElements = (
      this.database.prepare(`SELECT COUNT(*) as count FROM ${NORTH_ITEMS_TABLE} ${whereClause}`).get(...queryParams) as { count: number }
    ).count;
    const totalPages = Math.ceil(totalElements / PAGE_SIZE);

    return {
      content: results,
      size: PAGE_SIZE,
      number: page,
      totalElements,
      totalPages
    };
  }

  findAllItemsForNorth<I extends NorthItemSettings>(northId: string): Array<NorthConnectorItemEntity<I>> {
    const query = `SELECT id, name, enabled, settings FROM ${NORTH_ITEMS_TABLE} WHERE connector_id = ?;`;
    return this.database
      .prepare(query)
      .all(northId)
      .map(result => this.toNorthConnectorItemEntity<I>(result as Record<string, string>));
  }

  findItemById<I extends NorthItemSettings>(northId: string, itemId: string): NorthConnectorItemEntity<I> | null {
    const query = `SELECT id, name, enabled, settings FROM ${NORTH_ITEMS_TABLE} WHERE id = ? AND connector_id = ?;`;
    const result = this.database.prepare(query).get(itemId, northId);
    if (!result) return null;
    return this.toNorthConnectorItemEntity(result as Record<string, string>);
  }

  saveItem<I extends NorthItemSettings>(northConnectorId: string, northItem: NorthConnectorItemEntity<I>): void {
    if (!northItem.id) {
      northItem.id = generateRandomId(6);
      const insertQuery = `INSERT INTO ${NORTH_ITEMS_TABLE} (id, name, enabled, connector_id, settings) ` + `VALUES (?, ?, ?, ?, ?);`;
      this.database
        .prepare(insertQuery)
        .run(northItem.id, northItem.name, +northItem.enabled, northConnectorId, JSON.stringify(northItem.settings));
    } else {
      const query = `UPDATE ${NORTH_ITEMS_TABLE} SET name = ?, enabled = ?, settings = ? WHERE id = ?;`;
      this.database.prepare(query).run(northItem.name, +northItem.enabled, JSON.stringify(northItem.settings), northItem.id);
    }
  }

  saveAllItems<I extends NorthItemSettings>(
    northConnectorId: string,
    northItems: Array<NorthConnectorItemEntity<I>>,
    deleteItemsNotPresent: boolean
  ): void {
    const transaction = this.database.transaction(() => {
      if (deleteItemsNotPresent) {
        this.deleteAllItemsByNorth(northConnectorId);
      }
      for (const item of northItems) {
        this.saveItem(northConnectorId, item);
      }
    });
    transaction();
  }

  deleteItem(id: string): void {
    const query = `DELETE FROM ${NORTH_ITEMS_TABLE} WHERE id = ?;`;
    this.database.prepare(query).run(id);
  }

  deleteAllItemsByNorth(southConnectorId: string): void {
    const query = `DELETE FROM ${NORTH_ITEMS_TABLE} WHERE connector_id = ?;`;
    this.database.prepare(query).run(southConnectorId);
  }

  enableItem(id: string): void {
    const query = `UPDATE ${NORTH_ITEMS_TABLE} SET enabled = 1 WHERE id = ?;`;
    this.database.prepare(query).run(id);
  }

  disableItem(id: string): void {
    const query = `UPDATE ${NORTH_ITEMS_TABLE} SET enabled = 0 WHERE id = ?;`;
    this.database.prepare(query).run(id);
  }

  findAllTransformersForNorth(northId: string): Array<{ transformer: Transformer; order: number }> {
    const query = `SELECT t.id, t.name, t.description, t.input_type, t.output_type, t.code, nt.transformer_order FROM ${NORTH_TRANSFORMERS_TABLE} nt JOIN ${TRANSFORMERS_TABLE} t ON nt.transformer_id = t.id WHERE nt.north_id = ?`;
    return this.database
      .prepare(query)
      .all(northId)
      .map(result => this.toTransformer(result as Record<string, string | number>));
  }

  private toTransformer(result: Record<string, string | number>): { transformer: Transformer; order: number } {
    return {
      order: result.transformer_order as number,
      transformer: {
        id: result.id as string,
        name: result.name as string,
        description: result.description as string,
        inputType: result.input_type as string,
        outputType: result.output_type as string,
        code: result.code as string
      }
    };
  }

  private toNorthConnectorItemEntity<I extends NorthItemSettings>(result: Record<string, string>): NorthConnectorItemEntity<I> {
    return {
      id: result.id,
      name: result.name,
      enabled: Boolean(result.enabled),
      settings: JSON.parse(result.settings) as I
    };
  }

  private toNorthConnectorLight(result: Record<string, string>): NorthConnectorEntityLight {
    return {
      id: result.id,
      name: result.name,
      type: result.type as OIBusNorthType,
      description: result.description,
      enabled: Boolean(result.enabled)
    };
  }

  private toNorthConnector<N extends NorthSettings, I extends NorthItemSettings>(
    result: Record<string, string | number>
  ): NorthConnectorEntity<N, I> {
    return {
      id: result.id as string,
      name: result.name as string,
      type: result.type as OIBusNorthType,
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
      subscriptions: this.listNorthSubscriptions(result.id as string),
      items: this.findAllItemsForNorth<I>(result.id as string),
      transformers: this.findAllTransformersForNorth(result.id as string)
    };
  }
}
