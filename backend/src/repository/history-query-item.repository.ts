import { generateRandomId } from '../service/utils';
import {
  SouthConnectorItemCommandDTO,
  SouthConnectorItemDTO,
  SouthConnectorItemSearchParam
} from '../../../shared/model/south-connector.model';
import { Page } from '../../../shared/model/types';
import { Database } from 'better-sqlite3';

export const HISTORY_ITEMS_TABLE = 'history_items';
const PAGE_SIZE = 50;

/**
 * Repository used for History query items
 */
export default class HistoryQueryItemRepository {
  constructor(private readonly database: Database) {}

  /**
   * Search History items (point, query, folder...) associated to a History Query
   */
  searchHistoryItems(historyId: string, searchParams: SouthConnectorItemSearchParam): Page<SouthConnectorItemDTO> {
    let whereClause = `WHERE history_id = ?`;
    const queryParams = [historyId];

    if (searchParams.name) {
      queryParams.push(searchParams.name);
      whereClause += ` AND name like '%' || ? || '%'`;
    }
    const query =
      `SELECT id, name, history_id AS historyId, settings FROM ${HISTORY_ITEMS_TABLE} ${whereClause}` +
      ` LIMIT ${PAGE_SIZE} OFFSET ${PAGE_SIZE * searchParams.page};`;
    const results: Array<SouthConnectorItemDTO> = this.database
      .prepare(query)
      .all(...queryParams)
      .map((result: any) => ({
        id: result.id,
        name: result.name,
        connectorId: result.historyId,
        scanModeId: 'history',
        settings: JSON.parse(result.settings)
      }));
    const totalElements: number = (
      this.database.prepare(`SELECT COUNT(*) as count FROM ${HISTORY_ITEMS_TABLE} ${whereClause}`).get(...queryParams) as { count: number }
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
   * Retrieve all History items (point, query, folder...) associated to a History Query
   */
  getHistoryItems(historyId: string): Array<SouthConnectorItemDTO> {
    const query = `SELECT id, name, settings FROM ${HISTORY_ITEMS_TABLE} WHERE history_id = ?;`;
    return this.database
      .prepare(query)
      .all(historyId)
      .map((result: any) => ({
        id: result.id,
        name: result.name,
        connectorId: historyId,
        scanModeId: 'history',
        settings: JSON.parse(result.settings)
      }));
  }

  /**
   * Retrieve a History item by its ID
   */
  getHistoryItem(id: string): SouthConnectorItemDTO {
    const query = `SELECT id, name, history_id AS historyId, settings FROM ${HISTORY_ITEMS_TABLE} WHERE id = ?;`;
    const result: any = this.database.prepare(query).get(id);
    return {
      id: result.id,
      name: result.name,
      connectorId: result.historyId,
      scanModeId: 'history',
      settings: JSON.parse(result.settings)
    };
  }

  /**
   * Create a History item with a random generated ID
   */
  createHistoryItem(historyId: string, command: SouthConnectorItemCommandDTO): SouthConnectorItemDTO {
    const id = generateRandomId(6);
    const insertQuery = `INSERT INTO ${HISTORY_ITEMS_TABLE} (id, name, history_id, settings) ` + `VALUES (?, ?, ?, ?);`;
    const insertResult = this.database.prepare(insertQuery).run(id, command.name, historyId, JSON.stringify(command.settings));

    const query = `SELECT id, name, history_id AS historyId, settings FROM ${HISTORY_ITEMS_TABLE} WHERE ROWID = ?;`;
    const result: any = this.database.prepare(query).get(insertResult.lastInsertRowid);
    return {
      id: result.id,
      name: result.name,
      connectorId: result.historyId,
      scanModeId: 'history',
      settings: JSON.parse(result.settings)
    };
  }

  /**
   * Update a History item by its ID
   */
  updateHistoryItem(id: string, command: SouthConnectorItemCommandDTO): void {
    const query = `UPDATE ${HISTORY_ITEMS_TABLE} SET name = ?, settings = ? WHERE id = ?;`;
    this.database.prepare(query).run(command.name, JSON.stringify(command.settings), id);
  }

  /**
   * Delete a History item by its ID
   */
  deleteHistoryItem(id: string): void {
    const query = `DELETE FROM ${HISTORY_ITEMS_TABLE} WHERE id = ?;`;
    this.database.prepare(query).run(id);
  }

  /**
   * Delete History items associated to a history query ID
   */
  deleteAllItems(historyId: string): void {
    const query = `DELETE FROM ${HISTORY_ITEMS_TABLE} WHERE history_id = ?;`;
    this.database.prepare(query).run(historyId);
  }

  createAndUpdateItems(historyId: string, itemsToAdd: Array<SouthConnectorItemDTO>, itemsToUpdate: Array<SouthConnectorItemDTO>): void {
    const insert = this.database.prepare(`INSERT INTO ${HISTORY_ITEMS_TABLE} (id, name, history_id, settings) VALUES (?, ?, ?, ?);`);
    const update = this.database.prepare(`UPDATE ${HISTORY_ITEMS_TABLE} SET name = ?, settings = ? WHERE id = ?;`);

    const transaction = this.database.transaction(() => {
      for (const item of itemsToAdd) {
        const id = generateRandomId(6);
        insert.run(id, item.name, historyId, JSON.stringify(item.settings));
      }
      for (const item of itemsToUpdate) {
        update.run(item.name, JSON.stringify(item.settings), item.id);
      }
    });
    transaction();
  }
}
