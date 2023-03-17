import { generateRandomId } from '../service/utils';
import { OibusItemCommandDTO, OibusItemDTO, OibusItemSearchParam } from '../../../shared/model/south-connector.model';
import { SOUTH_CONNECTOR_TABLE } from './south-connector.repository';
import { SCAN_MODE_TABLE } from './scan-mode.repository';
import { Page } from '../../../shared/model/types';
import { Database } from 'better-sqlite3';

const SOUTH_ITEM_TABLE = 'south_item';
const PAGE_SIZE = 50;

/**
 * Repository used for South connectors items
 */
export default class SouthItemRepository {
  constructor(private readonly database: Database) {
    const query =
      `CREATE TABLE IF NOT EXISTS ${SOUTH_ITEM_TABLE} (id TEXT PRIMARY KEY, connector_id TEXT, scan_mode_id TEXT, name TEXT, ` +
      `settings TEXT, FOREIGN KEY(connector_id) REFERENCES ${SOUTH_CONNECTOR_TABLE}(id), ` +
      `FOREIGN KEY(scan_mode_id) REFERENCES ${SCAN_MODE_TABLE}(id));`;
    this.database.prepare(query).run();
  }

  /**
   * Search South items (point, query, folder...) associated to a South connector
   */
  searchSouthItems(southId: string, searchParams: OibusItemSearchParam): Page<OibusItemDTO> {
    const queryParams = [];
    let whereClause = `WHERE connector_id = ?`;

    if (searchParams.name) {
      queryParams.push(searchParams.name);
      whereClause += ` AND name like '%${searchParams.name}%'`;
    }
    queryParams.push(southId);
    const query =
      `SELECT id, name, connector_id AS connectorId, scan_mode_id AS scanModeId, settings FROM ${SOUTH_ITEM_TABLE} ${whereClause}` +
      ` LIMIT ${PAGE_SIZE} OFFSET ${PAGE_SIZE * searchParams.page};`;
    const results = this.database
      .prepare(query)
      .all(...queryParams)
      .map(result => ({
        id: result.id,
        name: result.name,
        connectorId: result.connectorId,
        scanModeId: result.scanModeId,
        settings: JSON.parse(result.settings)
      }));
    const totalElements = this.database.prepare(`SELECT COUNT(*) as count FROM ${SOUTH_ITEM_TABLE} ${whereClause}`).get(southId).count;
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
  getSouthItems(southId: string): Array<OibusItemDTO> {
    const query = `SELECT id, name, connector_id AS connectorId, scan_mode_id AS scanModeId, settings FROM ${SOUTH_ITEM_TABLE} WHERE connector_id = ?;`;
    return this.database
      .prepare(query)
      .all(southId)
      .map(result => ({
        id: result.id,
        name: result.name,
        connectorId: result.connectorId,
        scanModeId: result.scanModeId,
        settings: JSON.parse(result.settings)
      }));
  }

  /**
   * Retrieve a South item by its ID
   */
  getSouthItem(id: string): OibusItemDTO {
    const query = `SELECT id, name, connector_id AS connectorId, scan_mode_id AS scanModeId, settings FROM ${SOUTH_ITEM_TABLE} WHERE id = ?;`;
    const result = this.database.prepare(query).get(id);
    return {
      id: result.id,
      name: result.name,
      connectorId: result.connectorId,
      scanModeId: result.scanModeId,
      settings: JSON.parse(result.settings)
    };
  }

  /**
   * Create a South item with a random generated ID
   */
  createSouthItem(southId: string, command: OibusItemCommandDTO): OibusItemDTO {
    const id = generateRandomId(6);
    const insertQuery = `INSERT INTO ${SOUTH_ITEM_TABLE} (id, name, connector_id, scan_mode_id, settings) ` + `VALUES (?, ?, ?, ?, ?);`;
    const insertResult = this.database
      .prepare(insertQuery)
      .run(id, command.name, southId, command.scanModeId, JSON.stringify(command.settings));

    const query = `SELECT id, name, connector_id AS connectorId, scan_mode_id AS scanModeId, settings FROM ${SOUTH_ITEM_TABLE} WHERE ROWID = ?;`;
    const result = this.database.prepare(query).get(insertResult.lastInsertRowid);
    return {
      id: result.id,
      name: result.name,
      connectorId: result.connectorId,
      scanModeId: result.scanModeId,
      settings: JSON.parse(result.settings)
    };
  }

  /**
   * Update a South item by its ID
   */
  updateSouthItem(id: string, command: OibusItemCommandDTO): void {
    const query = `UPDATE ${SOUTH_ITEM_TABLE} SET name = ?, scan_mode_id = ?, settings = ? WHERE id = ?;`;
    this.database.prepare(query).run(command.name, command.scanModeId, JSON.stringify(command.settings), id);
  }

  /**
   * Delete a South item by its ID
   */
  deleteSouthItem(id: string): void {
    const query = `DELETE FROM ${SOUTH_ITEM_TABLE} WHERE id = ?;`;
    this.database.prepare(query).run(id);
  }
}
