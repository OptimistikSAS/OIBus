import { generateRandomId } from '../../service/utils';
import { Database } from 'better-sqlite3';
import { SouthConnectorEntity, SouthConnectorEntityLight, SouthConnectorItemEntity } from '../../model/south-connector.model';
import { SouthItemSettings, SouthSettings } from '../../../shared/model/south-settings.model';
import { SouthConnectorItemSearchParam } from '../../../shared/model/south-connector.model';
import { Page } from '../../../shared/model/types';

const SOUTH_CONNECTORS_TABLE = 'south_connectors';
const SOUTH_ITEMS_TABLE = 'south_items';
const SUBSCRIPTION_TABLE = 'subscription';
const PAGE_SIZE = 50;
/**
 * Repository used for South connectors (Data sources)
 */
export default class SouthConnectorRepository {
  constructor(private readonly database: Database) {}

  findAllSouth(): Array<SouthConnectorEntityLight> {
    const query = `SELECT id, name, type, description, enabled FROM ${SOUTH_CONNECTORS_TABLE};`;
    return this.database
      .prepare(query)
      .all()
      .map(result => toSouthConnectorLight(result as Record<string, string>));
  }

  findSouthById<S extends SouthSettings, I extends SouthItemSettings>(id: string): SouthConnectorEntity<S, I> | null {
    const query = `
        SELECT id, name, type, description, enabled,
        history_max_instant_per_item, history_max_read_interval,
        history_read_delay, history_read_overlap, settings
        FROM ${SOUTH_CONNECTORS_TABLE}
        WHERE id = ?;`;

    const result = this.database.prepare(query).get(id);
    if (!result) {
      return null;
    }
    return this.toSouthConnector<S, I>(result as Record<string, string | number>);
  }

  saveSouthConnector<S extends SouthSettings, I extends SouthItemSettings>(south: SouthConnectorEntity<S, I>): void {
    const transaction = this.database.transaction(() => {
      if (!south.id) {
        south.id = generateRandomId(6);
        const insertQuery =
          `INSERT INTO ${SOUTH_CONNECTORS_TABLE} (id, name, type, description, enabled, history_max_instant_per_item, ` +
          `history_max_read_interval, history_read_delay, history_read_overlap, settings) ` +
          `VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`;
        this.database
          .prepare(insertQuery)
          .run(
            south.id,
            south.name,
            south.type,
            south.description,
            +south.enabled,
            +south.history.maxInstantPerItem,
            south.history.maxReadInterval,
            south.history.readDelay,
            south.history.overlap,
            JSON.stringify(south.settings)
          );
      } else {
        const query =
          `UPDATE ${SOUTH_CONNECTORS_TABLE} SET name = ?, description = ?, ` +
          `history_max_instant_per_item = ?, history_max_read_interval = ?, history_read_delay = ?, history_read_overlap = ?, settings = ? WHERE id = ?;`;
        this.database
          .prepare(query)
          .run(
            south.name,
            south.description,
            +south.history.maxInstantPerItem,
            south.history.maxReadInterval,
            south.history.readDelay,
            south.history.overlap,
            JSON.stringify(south.settings),
            south.id
          );
      }

      if (south.items.length > 0) {
        this.database
          .prepare(`DELETE FROM ${SOUTH_ITEMS_TABLE} WHERE connector_id = ? AND id NOT IN (${south.items.map(() => '?').join(', ')});`)
          .run(
            south.id,
            south.items.map(item => item.id)
          );
        const insert = this.database.prepare(
          `INSERT INTO ${SOUTH_ITEMS_TABLE} (id, name, enabled, connector_id, scan_mode_id, settings) VALUES (?, ?, ?, ?, ?, ?);`
        );
        const update = this.database.prepare(
          `UPDATE ${SOUTH_ITEMS_TABLE} SET name = ?, enabled = ?, scan_mode_id = ?, settings = ? WHERE id = ?;`
        );
        for (const item of south.items) {
          if (!item.id) {
            item.id = generateRandomId(6);
            insert.run(item.id, item.name, +item.enabled, south.id, item.scanModeId, JSON.stringify(item.settings));
          } else {
            update.run(item.name, +item.enabled, item.scanModeId, JSON.stringify(item.settings), item.id);
          }
        }
      } else {
        this.database.prepare(`DELETE FROM ${SOUTH_ITEMS_TABLE} WHERE connector_id = ?;`).run(south.id);
      }
    });
    transaction();
  }

  start(id: string): void {
    const query = `UPDATE ${SOUTH_CONNECTORS_TABLE} SET enabled = ? WHERE id = ?;`;
    this.database.prepare(query).run(1, id);
  }

  stop(id: string): void {
    const query = `UPDATE ${SOUTH_CONNECTORS_TABLE} SET enabled = ? WHERE id = ?;`;
    this.database.prepare(query).run(0, id);
  }

  deleteSouth(id: string): void {
    const transaction = this.database.transaction(() => {
      this.database.prepare(`DELETE FROM ${SOUTH_ITEMS_TABLE} WHERE connector_id = ?;`).run(id);
      this.database.prepare(`DELETE FROM ${SUBSCRIPTION_TABLE} WHERE south_connector_id = ?;`).run(id);
      this.database.prepare(`DELETE FROM ${SOUTH_CONNECTORS_TABLE} WHERE id = ?;`).run(id);
    });
    transaction();
  }

  listItems<I extends SouthItemSettings>(southId: string, searchParams: SouthConnectorItemSearchParam): Array<SouthConnectorItemEntity<I>> {
    let whereClause = `WHERE connector_id = ?`;
    const queryParams = [southId];

    if (searchParams.scanModeId) {
      queryParams.push(searchParams.scanModeId);
      whereClause += ` AND scan_mode_id = ?`;
    }
    if (searchParams.enabled !== undefined) {
      queryParams.push(`${+searchParams.enabled}`);
      whereClause += ` AND enabled = ?`;
    }
    if (searchParams.name) {
      queryParams.push(searchParams.name);
      whereClause += ` AND name like '%' || ? || '%'`;
    }
    const query = `SELECT id, name, enabled, scan_mode_id, settings FROM ${SOUTH_ITEMS_TABLE} ${whereClause};`;

    return this.database
      .prepare(query)
      .all(...queryParams)
      .map(result => this.toSouthConnectorItemEntity<I>(result as Record<string, string>));
  }

  searchItems<I extends SouthItemSettings>(
    southId: string,
    searchParams: SouthConnectorItemSearchParam
  ): Page<SouthConnectorItemEntity<I>> {
    let whereClause = `WHERE connector_id = ?`;
    const queryParams = [southId];

    const page = searchParams.page ?? 0;

    if (searchParams.scanModeId) {
      queryParams.push(searchParams.scanModeId);
      whereClause += ` AND scan_mode_id = ?`;
    }
    if (searchParams.enabled !== undefined) {
      queryParams.push(`${+searchParams.enabled}`);
      whereClause += ` AND enabled = ?`;
    }
    if (searchParams.name) {
      queryParams.push(searchParams.name);
      whereClause += ` AND name like '%' || ? || '%'`;
    }
    const query =
      `SELECT id, name, enabled, scan_mode_id, settings FROM ${SOUTH_ITEMS_TABLE} ${whereClause}` +
      ` LIMIT ${PAGE_SIZE} OFFSET ${PAGE_SIZE * page};`;
    const results = this.database
      .prepare(query)
      .all(...queryParams)
      .map(result => this.toSouthConnectorItemEntity<I>(result as Record<string, string>));
    const totalElements = (
      this.database.prepare(`SELECT COUNT(*) as count FROM ${SOUTH_ITEMS_TABLE} ${whereClause}`).get(...queryParams) as { count: number }
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

  findAllItemsForSouth<I extends SouthItemSettings>(southId: string): Array<SouthConnectorItemEntity<I>> {
    const query = `SELECT id, name, enabled, scan_mode_id, settings FROM ${SOUTH_ITEMS_TABLE} WHERE connector_id = ?;`;
    return this.database
      .prepare(query)
      .all(southId)
      .map(result => this.toSouthConnectorItemEntity<I>(result as Record<string, string>));
  }

  findItemById<I extends SouthItemSettings>(southConnectorId: string, itemId: string): SouthConnectorItemEntity<I> | null {
    const query = `SELECT id, name, enabled, scan_mode_id, settings FROM ${SOUTH_ITEMS_TABLE} WHERE id = ? AND connector_id = ?;`;
    const result = this.database.prepare(query).get(itemId, southConnectorId);
    if (!result) return null;
    return this.toSouthConnectorItemEntity(result as Record<string, string>);
  }

  saveItem<I extends SouthItemSettings>(southConnectorId: string, southItem: SouthConnectorItemEntity<I>): void {
    if (!southItem.id) {
      southItem.id = generateRandomId(6);
      const insertQuery =
        `INSERT INTO ${SOUTH_ITEMS_TABLE} (id, name, enabled, connector_id, scan_mode_id, settings) ` + `VALUES (?, ?, ?, ?, ?, ?);`;
      this.database
        .prepare(insertQuery)
        .run(southItem.id, southItem.name, +southItem.enabled, southConnectorId, southItem.scanModeId, JSON.stringify(southItem.settings));
    } else {
      const query = `UPDATE ${SOUTH_ITEMS_TABLE} SET name = ?, enabled = ?, scan_mode_id = ?, settings = ? WHERE id = ?;`;
      this.database
        .prepare(query)
        .run(southItem.name, +southItem.enabled, southItem.scanModeId, JSON.stringify(southItem.settings), southItem.id);
    }
  }

  saveAllItems<I extends SouthItemSettings>(southConnectorId: string, southItems: Array<SouthConnectorItemEntity<I>>): void {
    const transaction = this.database.transaction(() => {
      for (const item of southItems) {
        this.saveItem(southConnectorId, item);
      }
    });
    transaction();
  }

  deleteItem(id: string): void {
    const query = `DELETE FROM ${SOUTH_ITEMS_TABLE} WHERE id = ?;`;
    this.database.prepare(query).run(id);
  }

  deleteAllItemsBySouth(southConnectorId: string): void {
    const query = `DELETE FROM ${SOUTH_ITEMS_TABLE} WHERE connector_id = ?;`;
    this.database.prepare(query).run(southConnectorId);
  }

  enableItem(id: string): void {
    const query = `UPDATE ${SOUTH_ITEMS_TABLE} SET enabled = 1 WHERE id = ?;`;
    this.database.prepare(query).run(id);
  }

  disableItem(id: string): void {
    const query = `UPDATE ${SOUTH_ITEMS_TABLE} SET enabled = 0 WHERE id = ?;`;
    this.database.prepare(query).run(id);
  }

  private toSouthConnectorItemEntity<I extends SouthItemSettings>(result: Record<string, string>): SouthConnectorItemEntity<I> {
    return {
      id: result.id,
      name: result.name,
      enabled: Boolean(result.enabled),
      scanModeId: result.scan_mode_id,
      settings: JSON.parse(result.settings) as I
    };
  }

  private toSouthConnector<S extends SouthSettings, I extends SouthItemSettings>(
    result: Record<string, string | number>
  ): SouthConnectorEntity<S, I> {
    return {
      id: result.id as string,
      name: result.name as string,
      type: result.type as string,
      description: result.description as string,
      enabled: Boolean(result.enabled),
      history: {
        maxInstantPerItem: Boolean(result.history_max_instant_per_item),
        maxReadInterval: result.history_max_read_interval as number,
        readDelay: result.history_read_delay as number,
        overlap: result.history_read_overlap as number
      },
      settings: JSON.parse(result.settings as string) as S,
      items: this.findAllItemsForSouth<I>(result.id as string)
    };
  }
}

export const toSouthConnectorLight = (result: Record<string, string>): SouthConnectorEntityLight => {
  return {
    id: result.id,
    name: result.name,
    type: result.type,
    description: result.description,
    enabled: Boolean(result.enabled)
  };
};
