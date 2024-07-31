import { Database } from 'better-sqlite3';
import {
  CommandSearchParam,
  OIBusCommand,
  OIBusCommandDTO,
  OIBusCommandStatus,
  OIBusCommandType
} from '../../../shared/model/command.model';
import { Instant, Page } from '../../../shared/model/types';
import { DateTime } from 'luxon';
import { EngineSettingsCommandDTO } from '../../../shared/model/engine.model';

export const COMMANDS_TABLE = 'commands';

const PAGE_SIZE = 50;

export interface OIBusCommandResult {
  id: string;
  created_at: Instant;
  updated_at: Instant;
  type: OIBusCommandType;
  status: OIBusCommandStatus;
  ack: number;
  retrieved_date: Instant;
  completed_date: Instant;
  result: string | null;
  upgrade_version: string | null;
  upgrade_asset_id: string | null;
  command_content: string | null;
  target_version: string | null;
  scan_mode_id: string | null;
  south_connector_id: string | null;
  north_connector_id: string | null;
}

/**
 * Repository used for managing commands within OIBus
 */
export default class OIAnalyticsCommandRepository {
  constructor(private readonly database: Database) {}

  findAll(): Array<OIBusCommand> {
    const query = `SELECT *
                   FROM ${COMMANDS_TABLE};`;
    return this.database
      .prepare(query)
      .all()
      .map(command => this.toOIBusCommand(command as OIBusCommandResult));
  }

  search(searchParams: CommandSearchParam, page: number): Page<OIBusCommand> {
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

    const query = `SELECT *
                   FROM ${COMMANDS_TABLE} ${whereClause}
                   ORDER BY created_at DESC
                   LIMIT ${PAGE_SIZE} OFFSET ?;`;
    const results: Array<OIBusCommand> = this.database
      .prepare(query)
      .all(...queryParams, PAGE_SIZE * page)
      .map(command => this.toOIBusCommand(command as OIBusCommandResult));
    const totalElements = (
      this.database
        .prepare(
          `SELECT COUNT(*) as count
           FROM ${COMMANDS_TABLE} ${whereClause}`
        )
        .get(...queryParams) as { count: number }
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

  list(searchParams: CommandSearchParam): Array<OIBusCommand> {
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

    const query = `SELECT *
                   FROM ${COMMANDS_TABLE} ${whereClause}
                   ORDER BY created_at DESC;`;
    return this.database
      .prepare(query)
      .all(...queryParams)
      .map(command => this.toOIBusCommand(command as OIBusCommandResult));
  }

  findById(id: string): OIBusCommand | null {
    const query = `SELECT *
                   FROM ${COMMANDS_TABLE}
                   WHERE id = ?;`;
    const result = this.database.prepare(query).get(id);
    return result ? this.toOIBusCommand(result as OIBusCommandResult) : null;
  }

  create(id: string, command: OIBusCommandDTO): OIBusCommand {
    // id, retrieved_date, type, status, ack
    const queryParams = [id, DateTime.now().toUTC().toISO(), command.type, 'RETRIEVED', 0];
    let insertQuery = `INSERT INTO ${COMMANDS_TABLE} `;
    switch (command.type) {
      case 'create-south':
      case 'create-north':
      case 'create-scan-mode':
      case 'update-engine-settings':
        queryParams.push(command.targetVersion);
        queryParams.push(JSON.stringify(command.commandContent));
        insertQuery += `(id, retrieved_date, type, status, ack, target_version, command_content) VALUES (?, ?, ?, ?, ?, ?, ?);`;
        break;
      case 'update-scan-mode':
        queryParams.push(command.targetVersion);
        queryParams.push(command.scanModeId);
        queryParams.push(JSON.stringify(command.commandContent));
        insertQuery += `(id, retrieved_date, type, status, ack, target_version, scan_mode_id, command_content) VALUES (?, ?, ?, ?, ?, ?, ?, ?);`;
        break;
      case 'update-south':
        queryParams.push(command.targetVersion);
        queryParams.push(command.southConnectorId);
        queryParams.push(JSON.stringify(command.commandContent));
        insertQuery += `(id, retrieved_date, type, status, ack, target_version, south_connector_id, command_content) VALUES (?, ?, ?, ?, ?, ?, ?, ?);`;
        break;
      case 'update-north':
        queryParams.push(command.targetVersion);
        queryParams.push(command.northConnectorId);
        queryParams.push(JSON.stringify(command.commandContent));
        insertQuery += `(id, retrieved_date, type, status, ack, target_version, north_connector_id, command_content) VALUES (?, ?, ?, ?, ?, ?,?, ?);`;
        break;
      case 'delete-scan-mode':
        queryParams.push(command.targetVersion);
        queryParams.push(command.scanModeId);
        insertQuery += `(id, retrieved_date, type, status, ack, target_version, scan_mode_id) VALUES (?, ?, ?, ?, ?, ?, ?);`;
        break;
      case 'delete-south':
        queryParams.push(command.targetVersion);
        queryParams.push(command.southConnectorId);
        insertQuery += `(id, retrieved_date, type, status, ack, target_version, south_connector_id) VALUES (?, ?, ?, ?, ?, ?, ?);`;
        break;
      case 'delete-north':
        queryParams.push(command.targetVersion);
        queryParams.push(command.northConnectorId);
        insertQuery += `(id, retrieved_date, type, status, ack, target_version, north_connector_id) VALUES (?, ?, ?, ?, ?, ?, ?);`;
        break;
      case 'restart-engine':
        insertQuery += `(id, retrieved_date, type, status, ack) VALUES (?, ?, ?, ?, ?);`;
        break;
      case 'update-version':
        queryParams.push(command.version);
        queryParams.push(command.assetId);
        insertQuery += `(id, retrieved_date, type, status, ack, upgrade_version, upgrade_asset_id) VALUES (?, ?, ?, ?, ?, ?, ?);`;
        break;
    }
    const result = this.database.prepare(insertQuery).run(...queryParams);
    const query = `SELECT *
                   FROM ${COMMANDS_TABLE}
                   WHERE ROWID = ?;`;
    const createdCommand: OIBusCommandResult = this.database.prepare(query).get(result.lastInsertRowid) as OIBusCommandResult;
    return this.toOIBusCommand(createdCommand);
  }

  cancel(id: string): void {
    const query = `UPDATE ${COMMANDS_TABLE}
                   SET status = 'CANCELLED',
                       ack    = 0
                   WHERE id = ?;`;
    this.database.prepare(query).run(id);
  }

  markAsCompleted(id: string, completedDate: Instant, result: string): void {
    const query = `UPDATE ${COMMANDS_TABLE}
                   SET status         = 'COMPLETED',
                       completed_date = ?,
                       result         = ?,
                       ack            = 0
                   WHERE id = ?;`;
    this.database.prepare(query).run(completedDate, result, id);
  }

  markAsErrored(id: string, result: string): void {
    const query = `UPDATE ${COMMANDS_TABLE}
                   SET status = 'ERRORED',
                       result = ?,
                       ack    = 0
                   WHERE id = ?;`;
    this.database.prepare(query).run(result, id);
  }

  markAsRunning(id: string): void {
    const query = `UPDATE ${COMMANDS_TABLE}
                   SET status = 'RUNNING',
                       ack    = 0
                   WHERE id = ?;`;
    this.database.prepare(query).run(id);
  }

  markAsAcknowledged(id: string): void {
    const query = `UPDATE ${COMMANDS_TABLE}
                   SET ack = 1
                   WHERE id = ?;`;
    this.database.prepare(query).run(id);
  }

  delete(id: string): void {
    const query = `DELETE
                   FROM ${COMMANDS_TABLE}
                   WHERE id = ?;`;
    this.database.prepare(query).run(id);
  }

  private toOIBusCommand(command: OIBusCommandResult): OIBusCommand {
    switch (command.type) {
      case 'UPGRADE':
      case 'update-version':
        return {
          id: command.id,
          type: 'update-version',
          creationDate: command.created_at,
          status: command.status,
          ack: Boolean(command.ack),
          retrievedDate: command.retrieved_date,
          completedDate: command.completed_date,
          result: command.result,
          version: command.upgrade_version!,
          assetId: command.upgrade_asset_id!
        };
      case 'restart-engine':
        return {
          id: command.id,
          type: command.type,
          creationDate: command.created_at,
          status: command.status,
          ack: Boolean(command.ack),
          retrievedDate: command.retrieved_date,
          completedDate: command.completed_date,
          result: command.result
        };
      case 'update-engine-settings':
        return {
          id: command.id,
          type: command.type,
          creationDate: command.created_at,
          status: command.status,
          ack: Boolean(command.ack),
          retrievedDate: command.retrieved_date,
          completedDate: command.completed_date,
          result: command.result,
          targetVersion: command.target_version!,
          commandContent: JSON.parse(command.command_content!) as EngineSettingsCommandDTO
        };
      case 'create-north':
      case 'create-south':
      case 'create-scan-mode':
        return {
          id: command.id,
          type: command.type,
          creationDate: command.created_at,
          status: command.status,
          ack: Boolean(command.ack),
          retrievedDate: command.retrieved_date,
          completedDate: command.completed_date,
          result: command.result,
          targetVersion: command.target_version!,
          commandContent: JSON.parse(command.command_content!)
        };
      case 'update-scan-mode':
        return {
          id: command.id,
          type: command.type,
          creationDate: command.created_at,
          status: command.status,
          ack: Boolean(command.ack),
          retrievedDate: command.retrieved_date,
          completedDate: command.completed_date,
          result: command.result,
          targetVersion: command.target_version!,
          scanModeId: command.scan_mode_id!,
          commandContent: JSON.parse(command.command_content!)
        };
      case 'update-north':
        return {
          id: command.id,
          type: command.type,
          creationDate: command.created_at,
          status: command.status,
          ack: Boolean(command.ack),
          retrievedDate: command.retrieved_date,
          completedDate: command.completed_date,
          result: command.result,
          targetVersion: command.target_version!,
          northConnectorId: command.north_connector_id!,
          commandContent: JSON.parse(command.command_content!)
        };
      case 'update-south':
        return {
          id: command.id,
          type: command.type,
          creationDate: command.created_at,
          status: command.status,
          ack: Boolean(command.ack),
          retrievedDate: command.retrieved_date,
          completedDate: command.completed_date,
          result: command.result,
          targetVersion: command.target_version!,
          southConnectorId: command.south_connector_id!,
          commandContent: JSON.parse(command.command_content!)
        };
      case 'delete-scan-mode':
        return {
          id: command.id,
          type: command.type,
          creationDate: command.created_at,
          status: command.status,
          ack: Boolean(command.ack),
          retrievedDate: command.retrieved_date,
          completedDate: command.completed_date,
          result: command.result,
          targetVersion: command.target_version!,
          scanModeId: command.scan_mode_id!
        };
      case 'delete-south':
        return {
          id: command.id,
          type: command.type,
          creationDate: command.created_at,
          status: command.status,
          ack: Boolean(command.ack),
          retrievedDate: command.retrieved_date,
          completedDate: command.completed_date,
          result: command.result,
          targetVersion: command.target_version!,
          southConnectorId: command.south_connector_id!
        };
      case 'delete-north':
        return {
          id: command.id,
          type: command.type,
          creationDate: command.created_at,
          status: command.status,
          ack: Boolean(command.ack),
          retrievedDate: command.retrieved_date,
          completedDate: command.completed_date,
          result: command.result,
          targetVersion: command.target_version!,
          northConnectorId: command.north_connector_id!
        };
    }
  }
}
