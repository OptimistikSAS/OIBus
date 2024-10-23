import { Database } from 'better-sqlite3';
import { CommandSearchParam, OIBusCommandStatus, OIBusCommandType } from '../../../shared/model/command.model';
import { Instant, Page } from '../../../shared/model/types';
import { DateTime } from 'luxon';
import { OIBusCommand, OIBusRestartEngineCommand } from '../../model/oianalytics-command.model';
import { OIAnalyticsFetchCommandDTO } from '../../service/oia/oianalytics.model';

const COMMANDS_TABLE = 'commands';

const PAGE_SIZE = 50;

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
      .map(command => this.toOIBusCommand(command as Record<string, string>));
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
      .map(command => this.toOIBusCommand(command as Record<string, string>));
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
      .map(command => this.toOIBusCommand(command as Record<string, string>));
  }

  findById(id: string): OIBusCommand | null {
    const query = `SELECT *
                   FROM ${COMMANDS_TABLE}
                   WHERE id = ?;`;
    const result = this.database.prepare(query).get(id);
    return result ? this.toOIBusCommand(result as Record<string, string>) : null;
  }

  create(command: OIAnalyticsFetchCommandDTO): void {
    // retrieved_date, type, status, ack
    const queryParams = [command.id, DateTime.now().toUTC().toISO(), command.type, 'RETRIEVED', 0, command.targetVersion];
    let insertQuery = `INSERT INTO ${COMMANDS_TABLE} `;
    switch (command.type) {
      case 'update-engine-settings':
      case 'create-south':
      case 'create-north':
      case 'create-scan-mode':
        queryParams.push(JSON.stringify(command.commandContent));
        insertQuery += `(id, retrieved_date, type, status, ack, target_version, command_content) VALUES (?, ?, ?, ?, ?, ?, ?);`;
        break;
      case 'update-scan-mode':
        queryParams.push(command.scanModeId);
        queryParams.push(JSON.stringify(command.commandContent));
        insertQuery += `(id, retrieved_date, type, status, ack, target_version, scan_mode_id, command_content) VALUES (?, ?, ?, ?, ?, ?, ?, ?);`;
        break;
      case 'update-south':
        queryParams.push(command.southConnectorId);
        queryParams.push(JSON.stringify(command.commandContent));
        insertQuery += `(id, retrieved_date, type, status, ack, target_version, south_connector_id, command_content) VALUES (?, ?, ?, ?, ?, ?, ?, ?);`;
        break;
      case 'update-north':
        queryParams.push(command.northConnectorId);
        queryParams.push(JSON.stringify(command.commandContent));
        insertQuery += `(id, retrieved_date, type, status, ack, target_version, north_connector_id, command_content) VALUES (?, ?, ?, ?, ?, ?,?, ?);`;
        break;
      case 'delete-scan-mode':
        queryParams.push(command.scanModeId);
        insertQuery += `(id, retrieved_date, type, status, ack, target_version, scan_mode_id) VALUES (?, ?, ?, ?, ?, ?, ?);`;
        break;
      case 'delete-south':
        queryParams.push(command.southConnectorId);
        insertQuery += `(id, retrieved_date, type, status, ack, target_version, south_connector_id) VALUES (?, ?, ?, ?, ?, ?, ?);`;
        break;
      case 'delete-north':
        queryParams.push(command.northConnectorId);
        insertQuery += `(id, retrieved_date, type, status, ack, target_version, north_connector_id) VALUES (?, ?, ?, ?, ?, ?, ?);`;
        break;
      case 'restart-engine':
        insertQuery += `(id, retrieved_date, type, status, ack, target_version) VALUES (?, ?, ?, ?, ?, ?);`;
        break;
      case 'update-version':
        queryParams.push(command.version);
        queryParams.push(command.assetId);
        insertQuery += `(id, retrieved_date, type, status, ack, target_version, upgrade_version, upgrade_asset_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?);`;
        break;
    }
    this.database.prepare(insertQuery).run(...queryParams);
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

  private toOIBusCommand(command: Record<string, string | number>): OIBusCommand {
    switch (command.type as OIBusCommandType) {
      case 'update-version':
      case 'UPGRADE':
        return {
          id: command.id as string,
          type: 'update-version',
          status: command.status as OIBusCommandStatus,
          ack: Boolean(command.ack),
          targetVersion: command.target_version as string,
          retrievedDate: command.retrieved_date as Instant,
          completedDate: command.completed_date as Instant,
          result: command.result as string,
          version: command.upgrade_version as string,
          assetId: command.upgrade_asset_id as string
        };
      case 'restart-engine':
        return {
          id: command.id as string,
          type: command.type as OIBusCommandType,
          status: command.status as OIBusCommandStatus,
          ack: Boolean(command.ack),
          targetVersion: command.target_version as string,
          retrievedDate: command.retrieved_date as Instant,
          completedDate: command.completed_date as Instant,
          result: command.result as string
        } as OIBusRestartEngineCommand;
      case 'update-engine-settings':
        return {
          id: command.id as string,
          type: 'update-engine-settings',
          status: command.status as OIBusCommandStatus,
          ack: Boolean(command.ack),
          targetVersion: command.target_version as string,
          retrievedDate: command.retrieved_date as Instant,
          completedDate: command.completed_date as Instant,
          result: command.result as string,
          commandContent: JSON.parse(command.command_content as string)
        };
      case 'create-north':
        return {
          id: command.id as string,
          type: 'create-north',
          status: command.status as OIBusCommandStatus,
          ack: Boolean(command.ack),
          targetVersion: command.target_version as string,
          retrievedDate: command.retrieved_date as Instant,
          completedDate: command.completed_date as Instant,
          result: command.result as string,
          commandContent: JSON.parse(command.command_content as string)
        };
      case 'create-south':
        return {
          id: command.id as string,
          type: 'create-south',
          status: command.status as OIBusCommandStatus,
          ack: Boolean(command.ack),
          targetVersion: command.target_version as string,
          retrievedDate: command.retrieved_date as Instant,
          completedDate: command.completed_date as Instant,
          result: command.result as string,
          commandContent: JSON.parse(command.command_content as string)
        };
      case 'create-scan-mode':
        return {
          id: command.id as string,
          type: 'create-scan-mode',
          status: command.status as OIBusCommandStatus,
          ack: Boolean(command.ack),
          targetVersion: command.target_version as string,
          retrievedDate: command.retrieved_date as Instant,
          completedDate: command.completed_date as Instant,
          result: command.result as string,
          commandContent: JSON.parse(command.command_content as string)
        };
      case 'update-scan-mode':
        return {
          id: command.id as string,
          type: 'update-scan-mode',
          status: command.status as OIBusCommandStatus,
          ack: Boolean(command.ack),
          targetVersion: command.target_version as string,
          retrievedDate: command.retrieved_date as Instant,
          completedDate: command.completed_date as Instant,
          result: command.result as string,
          scanModeId: command.scan_mode_id as string,
          commandContent: JSON.parse(command.command_content as string)
        };
      case 'update-north':
        return {
          id: command.id as string,
          type: 'update-north',
          status: command.status as OIBusCommandStatus,
          ack: Boolean(command.ack),
          targetVersion: command.target_version as string,
          retrievedDate: command.retrieved_date as Instant,
          completedDate: command.completed_date as Instant,
          result: command.result as string,
          northConnectorId: command.north_connector_id as string,
          commandContent: JSON.parse(command.command_content as string)
        };
      case 'update-south':
        return {
          id: command.id as string,
          type: 'update-south',
          status: command.status as OIBusCommandStatus,
          ack: Boolean(command.ack),
          targetVersion: command.target_version as string,
          retrievedDate: command.retrieved_date as Instant,
          completedDate: command.completed_date as Instant,
          result: command.result as string,
          southConnectorId: command.south_connector_id as string,
          commandContent: JSON.parse(command.command_content as string)
        };
      case 'delete-scan-mode':
        return {
          id: command.id as string,
          type: 'delete-scan-mode',
          status: command.status as OIBusCommandStatus,
          ack: Boolean(command.ack),
          targetVersion: command.target_version as string,
          retrievedDate: command.retrieved_date as Instant,
          completedDate: command.completed_date as Instant,
          result: command.result as string,
          scanModeId: command.scan_mode_id as string
        };
      case 'delete-south':
        return {
          id: command.id as string,
          type: 'delete-south',
          status: command.status as OIBusCommandStatus,
          ack: Boolean(command.ack),
          targetVersion: command.target_version as string,
          retrievedDate: command.retrieved_date as Instant,
          completedDate: command.completed_date as Instant,
          result: command.result as string,
          southConnectorId: command.south_connector_id as string
        };
      case 'delete-north':
        return {
          id: command.id as string,
          type: 'delete-north',
          status: command.status as OIBusCommandStatus,
          ack: Boolean(command.ack),
          targetVersion: command.target_version as string,
          retrievedDate: command.retrieved_date as Instant,
          completedDate: command.completed_date as Instant,
          result: command.result as string,
          northConnectorId: command.north_connector_id as string
        };
    }
  }
}
