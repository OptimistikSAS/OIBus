import { Database } from 'better-sqlite3';
import { CommandSearchParam, OIBusCommand, OIBusCommandDTO } from '../../../shared/model/command.model';
import { Instant, Page } from '../../../shared/model/types';
import { DateTime } from 'luxon';

export const COMMANDS_TABLE = 'commands';

const PAGE_SIZE = 50;

/**
 * Repository used for managing commands within OIBus
 */
export default class CommandRepository {
  constructor(private readonly database: Database) {}

  findAll(): Array<OIBusCommandDTO> {
    const query =
      `SELECT id, type, status, ack, retrieved_date as retrievedDate, completed_date as completedDate, ` +
      `result, upgrade_version as version, upgrade_asset_id as assetId FROM ${COMMANDS_TABLE};`;
    return this.database.prepare(query).all() as Array<OIBusCommandDTO>;
  }

  /**
   * Search commands by page
   */
  searchCommandsPage(searchParams: CommandSearchParam, page: number): Page<OIBusCommandDTO> {
    const queryParams = [];
    let whereClause = 'WHERE id IS NOT NULL';
    if (searchParams.types.length > 0) {
      whereClause += ` AND type IN (${searchParams.types.map(() => '?')})`;
      queryParams.push(...searchParams.types);
    }
    if (searchParams.status.length > 0) {
      whereClause += ` AND status IN (${searchParams.status.map(() => '?')})`;
      queryParams.push(...searchParams.status);
    }

    const query =
      `SELECT id, type, status, ack, retrieved_date as retrievedDate, completed_date as completedDate, result, upgrade_version as version, ` +
      `upgrade_asset_id as assetId FROM ${COMMANDS_TABLE} ${whereClause} ORDER BY created_at DESC LIMIT ${PAGE_SIZE} OFFSET ?;`;
    const results: Array<OIBusCommandDTO> = this.database.prepare(query).all(...queryParams, PAGE_SIZE * page) as Array<OIBusCommandDTO>;
    const totalElements = (
      this.database.prepare(`SELECT COUNT(*) as count FROM ${COMMANDS_TABLE} ${whereClause}`).get(...queryParams) as { count: number }
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

  /**
   * Search commands by list
   */
  searchCommandsList(searchParams: CommandSearchParam): Array<OIBusCommandDTO> {
    const queryParams = [];
    let whereClause = 'WHERE id IS NOT NULL';
    if (searchParams.types.length > 0) {
      whereClause += ` AND type IN (${searchParams.types.map(() => '?')})`;
      queryParams.push(...searchParams.types);
    }
    if (searchParams.status.length > 0) {
      whereClause += ` AND status IN (${searchParams.status.map(() => '?')})`;
      queryParams.push(...searchParams.status);
    }

    const query =
      `SELECT id, type, status, ack, retrieved_date as retrievedDate, completed_date as completedDate, result, ` +
      `upgrade_version as version, upgrade_asset_id as assetId FROM ${COMMANDS_TABLE} ${whereClause} ORDER BY created_at DESC;`;
    return this.database.prepare(query).all(...queryParams) as Array<OIBusCommandDTO>;
  }

  findById(id: string): OIBusCommandDTO | null {
    const query =
      `SELECT id, type, status, ack, retrieved_date as retrievedDate, completed_date as completedDate, result, ` +
      `upgrade_version as version, upgrade_asset_id as assetId FROM ${COMMANDS_TABLE} WHERE id = ?;`;
    return this.database.prepare(query).get(id) as OIBusCommandDTO | null;
  }

  create(id: string, command: OIBusCommand): OIBusCommandDTO {
    const insertQuery =
      `INSERT INTO ${COMMANDS_TABLE} (id, retrieved_date, type, status, ack, upgrade_version, ` +
      `upgrade_asset_id) VALUES (?, ?, ?, ?, ?, ?, ?);`;
    const result = this.database
      .prepare(insertQuery)
      .run(id, DateTime.now().toUTC().toISO(), command.type, 'PENDING', 0, command.version, command.assetId);

    const query =
      `SELECT id, type, status, ack, retrieved_date as retrievedDate, completed_date as completedDate, result, ` +
      `upgrade_version as version, upgrade_asset_id as assetId FROM ${COMMANDS_TABLE} WHERE ROWID = ?;`;
    return this.database.prepare(query).get(result.lastInsertRowid) as OIBusCommandDTO;
  }

  cancel(id: string): void {
    const query = `UPDATE ${COMMANDS_TABLE} SET status = 'CANCELLED' WHERE id = ?;`;
    this.database.prepare(query).run(id);
  }

  markAsCompleted(id: string, completedDate: Instant, result: string): void {
    const query = `UPDATE ${COMMANDS_TABLE} SET status = 'COMPLETED', completed_date = ?, result = ? WHERE id = ?;`;
    this.database.prepare(query).run(completedDate, result, id);
  }

  markAsErrored(id: string, result: string): void {
    const query = `UPDATE ${COMMANDS_TABLE} SET status = 'ERRORED', result = ? WHERE id = ?;`;
    this.database.prepare(query).run(result, id);
  }

  markAsRunning(id: string): void {
    const query = `UPDATE ${COMMANDS_TABLE} SET status = 'RUNNING' WHERE id = ?;`;
    this.database.prepare(query).run(id);
  }

  markAsAcknowledged(id: string): void {
    const query = `UPDATE ${COMMANDS_TABLE} SET ack = 1 WHERE id = ?;`;
    this.database.prepare(query).run(id);
  }

  delete(id: string): void {
    const query = `DELETE FROM ${COMMANDS_TABLE} WHERE id = ?;`;
    this.database.prepare(query).run(id);
  }
}
