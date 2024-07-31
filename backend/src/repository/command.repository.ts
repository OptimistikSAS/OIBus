import { Database } from 'better-sqlite3';
import {
  CommandSearchParam,
  OIBusCommand,
  OIBusCommandDTO,
  OIBusCommandStatus,
  OIBusCommandType,
  OIBusFullConfigDTO
} from '../../../shared/model/command.model';
import { Instant, Page } from '../../../shared/model/types';
import { DateTime } from 'luxon';

export const COMMANDS_TABLE = 'commands';

const PAGE_SIZE = 50;

export interface OIBusCommandResult {
  id: string;
  create_at: Instant;
  updated_at: Instant;
  type: OIBusCommandType;
  status: OIBusCommandStatus;
  ack: number;
  retrieved_date: Instant;
  completed_date: Instant;
  result: string;
  upgrade_version?: string;
  upgrade_asset_id?: string;
  full_config?: string;
}

/**
 * Repository used for managing commands within OIBus
 */
export default class CommandRepository {
  constructor(private readonly database: Database) {}

  findAll(): Array<OIBusCommandDTO> {
    const query = `SELECT * FROM ${COMMANDS_TABLE};`;
    return this.database
      .prepare(query)
      .all()
      .map(command => this.toOIBusCommandDTO(command as OIBusCommandResult));
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

    const query = `SELECT * FROM ${COMMANDS_TABLE} ${whereClause} ORDER BY created_at DESC LIMIT ${PAGE_SIZE} OFFSET ?;`;
    const results: Array<OIBusCommandDTO> = this.database
      .prepare(query)
      .all(...queryParams, PAGE_SIZE * page)
      .map(command => this.toOIBusCommandDTO(command as OIBusCommandResult));
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
    if (searchParams.ack !== undefined) {
      whereClause += ` AND ack = ?`;
      queryParams.push(+searchParams.ack);
    }

    const query = `SELECT * FROM ${COMMANDS_TABLE} ${whereClause} ORDER BY created_at DESC;`;
    return this.database
      .prepare(query)
      .all(...queryParams)
      .map(command => this.toOIBusCommandDTO(command as OIBusCommandResult));
  }

  findById(id: string): OIBusCommandDTO | null {
    const query = `SELECT * FROM ${COMMANDS_TABLE} WHERE id = ?;`;
    const result = this.database.prepare(query).get(id);
    return result ? this.toOIBusCommandDTO(result as OIBusCommandResult) : null;
  }

  create(id: string, command: OIBusCommand): OIBusCommandDTO {
    // id, retrieved_date, type, status, ack
    const queryParams = [id, DateTime.now().toUTC().toISO(), command.type, 'RETRIEVED', 0];
    let insertQuery = `INSERT INTO ${COMMANDS_TABLE} `;
    switch (command.type) {
      case 'FULL_CONFIG':
        queryParams.push(JSON.stringify(command.fullConfig));
        insertQuery += `(id, retrieved_date, type, status, ack, full_config) VALUES (?, ?, ?, ?, ?, ?);`;
        break;
      case 'RESTART':
        insertQuery += `(id, retrieved_date, type, status, ack) VALUES (?, ?, ?, ?, ?);`;
        break;
      case 'UPGRADE':
        queryParams.push(command.version);
        queryParams.push(command.assetId);
        insertQuery += `(id, retrieved_date, type, status, ack, upgrade_version, upgrade_asset_id) VALUES (?, ?, ?, ?, ?, ?, ?);`;
        break;
    }
    const result = this.database.prepare(insertQuery).run(...queryParams);
    const query = `SELECT * FROM ${COMMANDS_TABLE} WHERE ROWID = ?;`;
    const createdCommand: OIBusCommandResult = this.database.prepare(query).get(result.lastInsertRowid) as OIBusCommandResult;
    return this.toOIBusCommandDTO(createdCommand);
  }

  cancel(id: string): void {
    const query = `UPDATE ${COMMANDS_TABLE} SET status = 'CANCELLED', ack = 0 WHERE id = ?;`;
    this.database.prepare(query).run(id);
  }

  markAsCompleted(id: string, completedDate: Instant, result: string): void {
    const query = `UPDATE ${COMMANDS_TABLE} SET status = 'COMPLETED', completed_date = ?, result = ?, ack = 0 WHERE id = ?;`;
    this.database.prepare(query).run(completedDate, result, id);
  }

  markAsErrored(id: string, result: string): void {
    const query = `UPDATE ${COMMANDS_TABLE} SET status = 'ERRORED', result = ?, ack = 0 WHERE id = ?;`;
    this.database.prepare(query).run(result, id);
  }

  markAsRunning(id: string): void {
    const query = `UPDATE ${COMMANDS_TABLE} SET status = 'RUNNING', ack = 0 WHERE id = ?;`;
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

  private toOIBusCommandDTO(command: OIBusCommandResult): OIBusCommandDTO {
    switch (command.type) {
      case 'UPGRADE':
        return {
          id: command.id,
          type: 'UPGRADE',
          creationDate: command.create_at,
          status: command.status,
          ack: Boolean(command.ack),
          retrievedDate: command.retrieved_date,
          completedDate: command.completed_date,
          result: command.result,
          version: command.upgrade_version!,
          assetId: command.upgrade_asset_id!
        };
      case 'RESTART':
        return {
          id: command.id,
          type: 'RESTART',
          creationDate: command.create_at,
          status: command.status,
          ack: Boolean(command.ack),
          retrievedDate: command.retrieved_date,
          completedDate: command.completed_date,
          result: command.result
        };
      case 'FULL_CONFIG':
        return {
          id: command.id,
          type: 'FULL_CONFIG',
          creationDate: command.create_at,
          status: command.status,
          ack: Boolean(command.ack),
          retrievedDate: command.retrieved_date,
          completedDate: command.completed_date,
          result: command.result,
          fullConfig: JSON.parse(command.full_config!) as OIBusFullConfigDTO
        };
    }
  }
}
