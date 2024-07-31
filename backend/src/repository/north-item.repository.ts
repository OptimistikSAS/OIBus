import { generateRandomId } from '../service/utils';
import {
  NorthConnectorItemCommandDTO,
  NorthConnectorItemDTO,
  NorthConnectorItemSearchParam
} from '../../../shared/model/north-connector.model';
import { Page } from '../../../shared/model/types';
import { Database } from 'better-sqlite3';

export const NORTH_ITEMS_TABLE = 'north_items';
const PAGE_SIZE = 50;

/**
 * Repository used for North connectors items
 */
export default class NorthItemRepository {
  constructor(private readonly database: Database) {}

  list(northId: string, searchParams: NorthConnectorItemSearchParam): Array<NorthConnectorItemDTO> {
    let whereClause = `WHERE connector_id = ?`;
    const queryParams = [northId];

    if (searchParams.enabled !== undefined) {
      queryParams.push(`${+searchParams.enabled}`);
      whereClause += ` AND enabled = ?`;
    }

    const query = `SELECT id, name, enabled, connector_id AS connectorId, settings FROM ${NORTH_ITEMS_TABLE} ${whereClause};`;

    return this.database
      .prepare(query)
      .all(...queryParams)
      .map((result: any) => ({
        id: result.id,
        name: result.name,
        enabled: result.enabled,
        connectorId: result.connectorId,
        settings: JSON.parse(result.settings)
      }));
  }

  search(northId: string, searchParams: NorthConnectorItemSearchParam): Page<NorthConnectorItemDTO> {
    let whereClause = `WHERE connector_id = ?`;
    const queryParams = [northId];

    const page = searchParams.page ?? 0;

    if (searchParams.name) {
      queryParams.push(searchParams.name);
      whereClause += ` AND name like '%' || ? || '%'`;
    }
    const query =
      `SELECT id, name, enabled, connector_id AS connectorId, settings FROM ${NORTH_ITEMS_TABLE} ${whereClause}` +
      ` LIMIT ${PAGE_SIZE} OFFSET ${PAGE_SIZE * page};`;
    const results = this.database
      .prepare(query)
      .all(...queryParams)
      .map((result: any) => ({
        id: result.id,
        name: result.name,
        enabled: result.enabled,
        connectorId: result.connectorId,
        settings: JSON.parse(result.settings)
      }));
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

  findAllForNorthConnector(northId: string): Array<NorthConnectorItemDTO> {
    const query = `SELECT id, name, enabled, connector_id AS connectorId, settings FROM ${NORTH_ITEMS_TABLE} WHERE connector_id = ?;`;
    return this.database
      .prepare(query)
      .all(northId)
      .map((result: any) => ({
        id: result.id,
        name: result.name,
        enabled: result.enabled,
        connectorId: result.connectorId,
        settings: JSON.parse(result.settings)
      }));
  }

  findById(id: string): NorthConnectorItemDTO | null {
    const query = `SELECT id, name, enabled, connector_id AS connectorId, settings FROM ${NORTH_ITEMS_TABLE} WHERE id = ?;`;
    const result: any = this.database.prepare(query).get(id);
    if (!result) return null;
    return {
      id: result.id,
      name: result.name,
      enabled: result.enabled,
      connectorId: result.connectorId,
      settings: JSON.parse(result.settings)
    };
  }

  create(northId: string, command: NorthConnectorItemCommandDTO): NorthConnectorItemDTO {
    const id = generateRandomId(6);
    const insertQuery = `INSERT INTO ${NORTH_ITEMS_TABLE} (id, name, enabled, connector_id, settings) ` + `VALUES (?, ?, ?, ?, ?);`;
    const insertResult = this.database
      .prepare(insertQuery)
      .run(id, command.name, +command.enabled, northId, JSON.stringify(command.settings));

    const query = `SELECT id, name, enabled, connector_id AS connectorId, settings FROM ${NORTH_ITEMS_TABLE} WHERE ROWID = ?;`;
    const result: any = this.database.prepare(query).get(insertResult.lastInsertRowid);
    return {
      id: result.id,
      name: result.name,
      enabled: result.enabled,
      connectorId: result.connectorId,
      settings: JSON.parse(result.settings)
    };
  }

  update(id: string, command: NorthConnectorItemCommandDTO): void {
    const query = `UPDATE ${NORTH_ITEMS_TABLE} SET name = ?, enabled = ?, settings = ? WHERE id = ?;`;
    this.database.prepare(query).run(command.name, +command.enabled, JSON.stringify(command.settings), id);
  }

  delete(id: string): void {
    const query = `DELETE FROM ${NORTH_ITEMS_TABLE} WHERE id = ?;`;
    this.database.prepare(query).run(id);
  }

  enable(id: string): void {
    const query = `UPDATE ${NORTH_ITEMS_TABLE} SET enabled = 1 WHERE id = ?;`;
    this.database.prepare(query).run(id);
  }

  disable(id: string): void {
    const query = `UPDATE ${NORTH_ITEMS_TABLE} SET enabled = 0 WHERE id = ?;`;
    this.database.prepare(query).run(id);
  }

  deleteAllByNorthConnector(northId: string): void {
    const query = `DELETE FROM ${NORTH_ITEMS_TABLE} WHERE connector_id = ?;`;
    this.database.prepare(query).run(northId);
  }

  createAndUpdateNorthItems(northId: string, itemsToAdd: Array<NorthConnectorItemDTO>, itemsToUpdate: Array<NorthConnectorItemDTO>): void {
    const insert = this.database.prepare(
      `INSERT INTO ${NORTH_ITEMS_TABLE} (id, name, enabled, connector_id, settings) VALUES (?, ?, ?, ?, ?);`
    );
    const update = this.database.prepare(`UPDATE ${NORTH_ITEMS_TABLE} SET name = ?, settings = ? WHERE id = ?;`);

    const transaction = this.database.transaction(() => {
      for (const item of itemsToAdd) {
        const id = generateRandomId(6);

        insert.run(id, item.name, 1, northId, JSON.stringify(item.settings));
      }
      for (const item of itemsToUpdate) {
        update.run(item.name, JSON.stringify(item.settings), item.id);
      }
    });
    transaction();
  }
}
