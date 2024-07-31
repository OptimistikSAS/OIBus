import { generateRandomId } from '../service/utils';
import {
  SouthConnectorItemCommandDTO,
  SouthConnectorItemDTO,
  SouthConnectorItemSearchParam
} from '../../../shared/model/south-connector.model';
import { Page } from '../../../shared/model/types';
import { Database } from 'better-sqlite3';
import { SouthHistoryQueryItemDTO } from '../../../shared/model/history-query.model';

export const HISTORY_ITEMS_TABLE = 'history_items';
const PAGE_SIZE = 50;

/**
 * Repository used for History query items
 */
export default class HistoryQueryItemRepository {
  constructor(private readonly database: Database) {}

  search(historyId: string, searchParams: SouthConnectorItemSearchParam): Page<SouthConnectorItemDTO> {
    let whereClause = `WHERE history_id = ?`;
    const queryParams = [historyId];

    const page = searchParams.page ?? 0;

    if (searchParams.name) {
      queryParams.push(searchParams.name);
      whereClause += ` AND name like '%' || ? || '%'`;
    }
    const query =
      `SELECT id, name, enabled, history_id AS historyId, settings FROM ${HISTORY_ITEMS_TABLE} ${whereClause}` +
      ` LIMIT ${PAGE_SIZE} OFFSET ${PAGE_SIZE * page};`;
    const results: Array<SouthConnectorItemDTO> = this.database
      .prepare(query)
      .all(...queryParams)
      .map((result: any) => ({
        id: result.id,
        name: result.name,
        enabled: Boolean(result.enabled),
        connectorId: result.historyId,
        scanModeId: '',
        settings: JSON.parse(result.settings)
      }));
    const totalElements: number = (
      this.database.prepare(`SELECT COUNT(*) as count FROM ${HISTORY_ITEMS_TABLE} ${whereClause}`).get(...queryParams) as { count: number }
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

  list(historyId: string, searchParams: SouthConnectorItemSearchParam): Array<SouthConnectorItemDTO> {
    let whereClause = `WHERE history_id = ?`;
    const queryParams = [historyId];

    if (searchParams.enabled !== undefined) {
      queryParams.push(`${+searchParams.enabled}`);
      whereClause += ` AND enabled = ?`;
    }

    const query = `SELECT id, name, enabled, settings FROM ${HISTORY_ITEMS_TABLE} ${whereClause};`;

    return this.database
      .prepare(query)
      .all(...queryParams)
      .map((result: any) => ({
        id: result.id,
        name: result.name,
        enabled: Boolean(result.enabled),
        connectorId: historyId,
        scanModeId: '',
        settings: JSON.parse(result.settings)
      }));
  }

  findById(id: string): SouthConnectorItemDTO {
    const query = `SELECT id, name, enabled, history_id AS historyId, settings FROM ${HISTORY_ITEMS_TABLE} WHERE id = ?;`;
    const result: any = this.database.prepare(query).get(id);
    return {
      id: result.id,
      name: result.name,
      enabled: result.enabled,
      connectorId: result.historyId,
      scanModeId: '',
      settings: JSON.parse(result.settings)
    };
  }

  create(historyId: string, command: SouthConnectorItemCommandDTO): SouthConnectorItemDTO {
    const id = generateRandomId(6);
    const insertQuery = `INSERT INTO ${HISTORY_ITEMS_TABLE} (id, name, enabled, history_id, settings) ` + `VALUES (?, ?, ?, ?, ?);`;
    const insertResult = this.database
      .prepare(insertQuery)
      .run(id, command.name, +command.enabled, historyId, JSON.stringify(command.settings));

    const query = `SELECT id, name, enabled, history_id AS historyId, settings FROM ${HISTORY_ITEMS_TABLE} WHERE ROWID = ?;`;
    const result: any = this.database.prepare(query).get(insertResult.lastInsertRowid);
    return {
      id: result.id,
      name: result.name,
      enabled: result.enabled,
      connectorId: result.historyId,
      scanModeId: '',
      settings: JSON.parse(result.settings)
    };
  }

  update(id: string, command: SouthConnectorItemCommandDTO): void {
    const query = `UPDATE ${HISTORY_ITEMS_TABLE} SET name = ?, enabled = ?, settings = ? WHERE id = ?;`;
    this.database.prepare(query).run(command.name, +command.enabled, JSON.stringify(command.settings), id);
  }

  delete(id: string): void {
    const query = `DELETE FROM ${HISTORY_ITEMS_TABLE} WHERE id = ?;`;
    this.database.prepare(query).run(id);
  }

  deleteAllByHistoryId(historyId: string): void {
    const query = `DELETE FROM ${HISTORY_ITEMS_TABLE} WHERE history_id = ?;`;
    this.database.prepare(query).run(historyId);
  }

  enable(id: string): void {
    const query = `UPDATE ${HISTORY_ITEMS_TABLE} SET enabled = 1 WHERE id = ?;`;
    this.database.prepare(query).run(id);
  }

  disable(id: string): void {
    const query = `UPDATE ${HISTORY_ITEMS_TABLE} SET enabled = 0 WHERE id = ?;`;
    this.database.prepare(query).run(id);
  }

  createAndUpdateAll(historyId: string, itemsToAdd: Array<SouthHistoryQueryItemDTO>, itemsToUpdate: Array<SouthHistoryQueryItemDTO>): void {
    const insert = this.database.prepare(
      `INSERT INTO ${HISTORY_ITEMS_TABLE} (id, name, enabled, history_id, settings) VALUES (?, ?, ?, ?, ?);`
    );
    const update = this.database.prepare(`UPDATE ${HISTORY_ITEMS_TABLE} SET name = ?, settings = ? WHERE id = ?;`);

    const transaction = this.database.transaction(() => {
      for (const item of itemsToUpdate) {
        update.run(item.name, JSON.stringify(item.settings), item.id);
      }

      for (const item of itemsToAdd) {
        const id = generateRandomId(6);
        insert.run(id, item.name, +item.enabled, historyId, JSON.stringify(item.settings));
      }
    });
    transaction();
  }
}
