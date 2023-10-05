import { generateRandomId } from '../service/utils';
import {
  SouthConnectorItemCommandDTO,
  SouthConnectorItemDTO,
  SouthConnectorItemSearchParam
} from '../../../shared/model/south-connector.model';
import { Page } from '../../../shared/model/types';
import { Database } from 'better-sqlite3';

export const SOUTH_ITEMS_TABLE = 'south_items';
const PAGE_SIZE = 50;

/**
 * Repository used for South connectors items
 */
export default class SouthItemRepository {
  constructor(private readonly database: Database) {}

  /**
   * Retrieve all items associated to a South connector
   */
  listSouthItems(southId: string): Array<SouthConnectorItemDTO> {
    const queryParams = [southId];
    const query = `SELECT id, name, enabled, connector_id AS connectorId, scan_mode_id AS scanModeId, settings FROM ${SOUTH_ITEMS_TABLE} WHERE connector_id = ?;`;

    return this.database
      .prepare(query)
      .all(...queryParams)
      .map((result: any) => ({
        id: result.id,
        name: result.name,
        enabled: result.enabled,
        connectorId: result.connectorId,
        scanModeId: result.scanModeId,
        settings: JSON.parse(result.settings)
      }));
  }

  /**
   * Search South items (point, query, folder...) associated to a South connector
   */
  searchSouthItems(southId: string, searchParams: SouthConnectorItemSearchParam): Page<SouthConnectorItemDTO> {
    let whereClause = `WHERE connector_id = ?`;
    const queryParams = [southId];

    if (searchParams.name) {
      queryParams.push(searchParams.name);
      whereClause += ` AND name like '%' || ? || '%'`;
    }
    const query =
      `SELECT id, name, enabled, connector_id AS connectorId, scan_mode_id AS scanModeId, settings FROM ${SOUTH_ITEMS_TABLE} ${whereClause}` +
      ` LIMIT ${PAGE_SIZE} OFFSET ${PAGE_SIZE * searchParams.page};`;
    const results = this.database
      .prepare(query)
      .all(...queryParams)
      .map((result: any) => ({
        id: result.id,
        name: result.name,
        enabled: result.enabled,
        connectorId: result.connectorId,
        scanModeId: result.scanModeId,
        settings: JSON.parse(result.settings)
      }));
    const totalElements = (
      this.database.prepare(`SELECT COUNT(*) as count FROM ${SOUTH_ITEMS_TABLE} ${whereClause}`).get(...queryParams) as { count: number }
    ).count;
    const totalPages = Math.ceil(totalElements / PAGE_SIZE);

    return {
      content: results,
      size: PAGE_SIZE,
      number: searchParams.page,
      totalElements,
      totalPages
    };
  }

  /**
   * Retrieve all South items (point, query, folder...) associated to a South connector
   */
  getSouthItems(southId: string): Array<SouthConnectorItemDTO> {
    const query = `SELECT id, name, enabled, connector_id AS connectorId, scan_mode_id AS scanModeId, settings FROM ${SOUTH_ITEMS_TABLE} WHERE connector_id = ?;`;
    return this.database
      .prepare(query)
      .all(southId)
      .map((result: any) => ({
        id: result.id,
        name: result.name,
        enabled: result.enabled,
        connectorId: result.connectorId,
        scanModeId: result.scanModeId,
        settings: JSON.parse(result.settings)
      }));
  }

  /**
   * Retrieve a South item by its ID
   */
  getSouthItem(id: string): SouthConnectorItemDTO | null {
    const query = `SELECT id, name, enabled, connector_id AS connectorId, scan_mode_id AS scanModeId, settings FROM ${SOUTH_ITEMS_TABLE} WHERE id = ?;`;
    const result: any = this.database.prepare(query).get(id);
    if (!result) return null;
    return {
      id: result.id,
      name: result.name,
      enabled: result.enabled,
      connectorId: result.connectorId,
      scanModeId: result.scanModeId,
      settings: JSON.parse(result.settings)
    };
  }

  /**
   * Create a South item with a random generated ID
   */
  createSouthItem(southId: string, command: SouthConnectorItemCommandDTO): SouthConnectorItemDTO {
    const id = generateRandomId(6);
    const insertQuery =
      `INSERT INTO ${SOUTH_ITEMS_TABLE} (id, name, enabled, connector_id, scan_mode_id, settings) ` + `VALUES (?, ?, ?, ?, ?, ?);`;
    const insertResult = this.database
      .prepare(insertQuery)
      .run(id, command.name, +command.enabled, southId, command.scanModeId, JSON.stringify(command.settings));

    const query = `SELECT id, name, enabled, connector_id AS connectorId, scan_mode_id AS scanModeId, settings FROM ${SOUTH_ITEMS_TABLE} WHERE ROWID = ?;`;
    const result: any = this.database.prepare(query).get(insertResult.lastInsertRowid);
    return {
      id: result.id,
      name: result.name,
      enabled: result.enabled,
      connectorId: result.connectorId,
      scanModeId: result.scanModeId,
      settings: JSON.parse(result.settings)
    };
  }

  /**
   * Update a South item by its ID
   */
  updateSouthItem(id: string, command: SouthConnectorItemCommandDTO): void {
    const query = `UPDATE ${SOUTH_ITEMS_TABLE} SET name = ?, enabled = ?, scan_mode_id = ?, settings = ? WHERE id = ?;`;
    this.database.prepare(query).run(command.name, +command.enabled, command.scanModeId, JSON.stringify(command.settings), id);
  }

  /**
   * Delete a South item by its ID
   */
  deleteSouthItem(id: string): void {
    const query = `DELETE FROM ${SOUTH_ITEMS_TABLE} WHERE id = ?;`;
    this.database.prepare(query).run(id);
  }

  enableSouthItem(id: string): void {
    const query = `UPDATE ${SOUTH_ITEMS_TABLE} SET enabled = 1 WHERE id = ?;`;
    this.database.prepare(query).run(id);
  }

  disableSouthItem(id: string): void {
    const query = `UPDATE ${SOUTH_ITEMS_TABLE} SET enabled = 0 WHERE id = ?;`;
    this.database.prepare(query).run(id);
  }

  /**
   * Delete all South items of a South connector
   */
  deleteAllSouthItems(southId: string): void {
    const query = `DELETE FROM ${SOUTH_ITEMS_TABLE} WHERE connector_id = ?;`;
    this.database.prepare(query).run(southId);
  }

  createAndUpdateSouthItems(southId: string, itemsToAdd: Array<SouthConnectorItemDTO>, itemsToUpdate: Array<SouthConnectorItemDTO>): void {
    const insert = this.database.prepare(
      `INSERT INTO ${SOUTH_ITEMS_TABLE} (id, name, enabled, connector_id, scan_mode_id, settings) VALUES (?, ?, ?, ?, ?, ?);`
    );
    const update = this.database.prepare(
      `UPDATE ${SOUTH_ITEMS_TABLE} SET name = ?, enabled = ?, scan_mode_id = ?, settings = ? WHERE id = ?;`
    );

    const transaction = this.database.transaction(() => {
      for (const item of itemsToUpdate) {
        update.run(item.name, +item.enabled, item.scanModeId, JSON.stringify(item.settings), item.id);
      }
      for (const item of itemsToAdd) {
        const id = generateRandomId(6);
        insert.run(id, item.name, 1, southId, item.scanModeId, JSON.stringify(item.settings));
      }
    });
    transaction();
  }
}
