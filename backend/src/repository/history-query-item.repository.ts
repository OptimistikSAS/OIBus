import { generateRandomId } from '../service/utils';
import { OibusItemCommandDTO, OibusItemDTO, OibusItemSearchParam } from '../../../shared/model/south-connector.model';
import { Page } from '../../../shared/model/types';
import { Database } from 'better-sqlite3';
import { HISTORY_QUERIES_TABLE } from './history-query.repository';

const HISTORY_ITEM_TABLE = 'history_item';
const PAGE_SIZE = 50;

/**
 * Repository used for History query items
 */
export default class HistoryQueryItemRepository {
  constructor(private readonly database: Database) {
    const query =
      `CREATE TABLE IF NOT EXISTS ${HISTORY_ITEM_TABLE} (id TEXT PRIMARY KEY, history_id TEXT, name TEXT, ` +
      `settings TEXT, FOREIGN KEY(history_id) REFERENCES ${HISTORY_QUERIES_TABLE}(id));`;
    this.database.prepare(query).run();
  }

  /**
   * Search History items (point, query, folder...) associated to a History Query
   */
  searchHistoryItems(historyId: string, searchParams: OibusItemSearchParam): Page<OibusItemDTO> {
    const queryParams = [];
    let whereClause = `WHERE history_id = ?`;

    if (searchParams.name) {
      queryParams.push(searchParams.name);
      whereClause += ` AND name like '%${searchParams.name}%'`;
    }
    queryParams.push(historyId);
    const query =
      `SELECT id, name, history_id AS historyId, settings FROM ${HISTORY_ITEM_TABLE} ${whereClause}` +
      ` LIMIT ${PAGE_SIZE} OFFSET ${PAGE_SIZE * searchParams.page};`;
    const results = this.database
      .prepare(query)
      .all(...queryParams)
      .map(result => ({
        id: result.id,
        name: result.name,
        connectorId: result.historyId,
        settings: JSON.parse(result.settings)
      }));
    const totalElements = this.database.prepare(`SELECT COUNT(*) as count FROM ${HISTORY_ITEM_TABLE} ${whereClause}`).get(historyId).count;
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
  getHistoryItems(historyId: string): Array<OibusItemDTO> {
    const query = `SELECT id, name, settings FROM ${HISTORY_ITEM_TABLE} WHERE history_id = ?;`;
    return this.database
      .prepare(query)
      .all(historyId)
      .map(result => ({
        id: result.id,
        name: result.name,
        connectorId: historyId,
        settings: JSON.parse(result.settings)
      }));
  }

  /**
   * Retrieve a History item by its ID
   */
  getHistoryItem(id: string): OibusItemDTO {
    const query = `SELECT id, name, history_id AS historyId, settings FROM ${HISTORY_ITEM_TABLE} WHERE id = ?;`;
    const result = this.database.prepare(query).get(id);
    return {
      id: result.id,
      name: result.name,
      connectorId: result.historyId,
      settings: JSON.parse(result.settings)
    };
  }

  /**
   * Create a History item with a random generated ID
   */
  createHistoryItem(historyId: string, command: OibusItemCommandDTO): OibusItemDTO {
    const id = generateRandomId(6);
    const insertQuery = `INSERT INTO ${HISTORY_ITEM_TABLE} (id, name, history_id, settings) ` + `VALUES (?, ?, ?, ?);`;
    const insertResult = this.database.prepare(insertQuery).run(id, command.name, historyId, JSON.stringify(command.settings));

    const query = `SELECT id, name, history_id AS historyId, settings FROM ${HISTORY_ITEM_TABLE} WHERE ROWID = ?;`;
    const result = this.database.prepare(query).get(insertResult.lastInsertRowid);
    return {
      id: result.id,
      name: result.name,
      connectorId: result.historyId,
      settings: JSON.parse(result.settings)
    };
  }

  /**
   * Update a History item by its ID
   */
  updateHistoryItem(id: string, command: OibusItemCommandDTO): void {
    const query = `UPDATE ${HISTORY_ITEM_TABLE} SET name = ?, settings = ? WHERE id = ?;`;
    this.database.prepare(query).run(command.name, JSON.stringify(command.settings), id);
  }

  /**
   * Delete a History item by its ID
   */
  deleteHistoryItem(id: string): void {
    const query = `DELETE FROM ${HISTORY_ITEM_TABLE} WHERE id = ?;`;
    this.database.prepare(query).run(id);
  }

  /**
   * Delete History items associated to a history query ID
   */
  deleteHistoryItemByHistoryId(historyId: string): void {
    const query = `DELETE FROM ${HISTORY_ITEM_TABLE} WHERE history_id = ?;`;
    this.database.prepare(query).run(historyId);
  }
}
