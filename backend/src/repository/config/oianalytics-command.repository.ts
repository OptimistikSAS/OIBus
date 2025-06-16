import { Database } from 'better-sqlite3';
import { CommandSearchParam, OIBusCommandStatus, OIBusCommandType } from '../../../shared/model/command.model';
import { Instant, Page } from '../../../shared/model/types';
import { DateTime } from 'luxon';
import { OIBusCommand, OIBusRegenerateCipherKeysCommand, OIBusRestartEngineCommand } from '../../model/oianalytics-command.model';
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
      case 'update-registration-settings':
        queryParams.push(JSON.stringify(command.commandContent));
        insertQuery += `(id, retrieved_date, type, status, ack, target_version, command_content) VALUES (?, ?, ?, ?, ?, ?, ?);`;
        break;
      case 'update-engine-settings':
      case 'create-scan-mode':
        queryParams.push(JSON.stringify(command.commandContent));
        insertQuery += `(id, retrieved_date, type, status, ack, target_version, command_content) VALUES (?, ?, ?, ?, ?, ?, ?);`;
        break;
      case 'update-scan-mode':
        queryParams.push(command.scanModeId);
        queryParams.push(JSON.stringify(command.commandContent));
        insertQuery += `(id, retrieved_date, type, status, ack, target_version, scan_mode_id, command_content) VALUES (?, ?, ?, ?, ?, ?, ?, ?);`;
        break;
      case 'delete-scan-mode':
        queryParams.push(command.scanModeId);
        insertQuery += `(id, retrieved_date, type, status, ack, target_version, scan_mode_id) VALUES (?, ?, ?, ?, ?, ?, ?);`;
        break;
      case 'create-ip-filter':
        queryParams.push(JSON.stringify(command.commandContent));
        insertQuery += `(id, retrieved_date, type, status, ack, target_version, command_content) VALUES (?, ?, ?, ?, ?, ?, ?);`;
        break;
      case 'update-ip-filter':
        queryParams.push(command.ipFilterId);
        queryParams.push(JSON.stringify(command.commandContent));
        insertQuery += `(id, retrieved_date, type, status, ack, target_version, ip_filter_id, command_content) VALUES (?, ?, ?, ?, ?, ?, ?, ?);`;
        break;
      case 'delete-ip-filter':
        queryParams.push(command.ipFilterId);
        insertQuery += `(id, retrieved_date, type, status, ack, target_version, ip_filter_id) VALUES (?, ?, ?, ?, ?, ?, ?);`;
        break;
      case 'create-certificate':
        queryParams.push(JSON.stringify(command.commandContent));
        insertQuery += `(id, retrieved_date, type, status, ack, target_version, command_content) VALUES (?, ?, ?, ?, ?, ?, ?);`;
        break;
      case 'update-certificate':
        queryParams.push(command.certificateId);
        queryParams.push(JSON.stringify(command.commandContent));
        insertQuery += `(id, retrieved_date, type, status, ack, target_version, certificate_id, command_content) VALUES (?, ?, ?, ?, ?, ?, ?, ?);`;
        break;
      case 'delete-certificate':
        queryParams.push(command.certificateId);
        insertQuery += `(id, retrieved_date, type, status, ack, target_version, certificate_id) VALUES (?, ?, ?, ?, ?, ?, ?);`;
        break;
      case 'create-south':
        queryParams.push(command.retrieveSecretsFromSouth || '');
        queryParams.push(JSON.stringify(command.commandContent));
        insertQuery += `(id, retrieved_date, type, status, ack, target_version, south_connector_id, command_content) VALUES (?, ?, ?, ?, ?, ?, ?, ?);`;
        break;
      case 'update-south':
        queryParams.push(command.southConnectorId);
        queryParams.push(JSON.stringify(command.commandContent));
        insertQuery += `(id, retrieved_date, type, status, ack, target_version, south_connector_id, command_content) VALUES (?, ?, ?, ?, ?, ?, ?, ?);`;
        break;
      case 'delete-south':
        queryParams.push(command.southConnectorId);
        insertQuery += `(id, retrieved_date, type, status, ack, target_version, south_connector_id) VALUES (?, ?, ?, ?, ?, ?, ?);`;
        break;
      case 'create-or-update-south-items-from-csv':
        queryParams.push(command.southConnectorId);
        queryParams.push(
          JSON.stringify({
            deleteItemsNotPresent: command.deleteItemsNotPresent,
            csvContent: command.csvContent,
            delimiter: command.delimiter
          })
        );
        insertQuery += `(id, retrieved_date, type, status, ack, target_version, south_connector_id, command_content) VALUES (?, ?, ?, ?, ?, ?, ?, ?);`;
        break;
      case 'test-south-connection':
        queryParams.push(command.southConnectorId);
        queryParams.push(JSON.stringify(command.commandContent));
        insertQuery += `(id, retrieved_date, type, status, ack, target_version, south_connector_id, command_content) VALUES (?, ?, ?, ?, ?, ?, ?, ?);`;
        break;
      case 'test-south-item':
        queryParams.push(command.southConnectorId);
        queryParams.push(command.itemId);
        queryParams.push(JSON.stringify(command.commandContent));
        insertQuery += `(id, retrieved_date, type, status, ack, target_version, south_connector_id, item_id, command_content) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`;
        break;
      case 'create-north':
        queryParams.push(command.retrieveSecretsFromNorth || '');
        queryParams.push(JSON.stringify(command.commandContent));
        insertQuery += `(id, retrieved_date, type, status, ack, target_version, north_connector_id, command_content) VALUES (?, ?, ?, ?, ?, ?,?, ?);`;
        break;
      case 'update-north':
        queryParams.push(command.northConnectorId);
        queryParams.push(JSON.stringify(command.commandContent));
        insertQuery += `(id, retrieved_date, type, status, ack, target_version, north_connector_id, command_content) VALUES (?, ?, ?, ?, ?, ?,?, ?);`;
        break;
      case 'delete-north':
        queryParams.push(command.northConnectorId);
        insertQuery += `(id, retrieved_date, type, status, ack, target_version, north_connector_id) VALUES (?, ?, ?, ?, ?, ?, ?);`;
        break;
      case 'test-north-connection':
        queryParams.push(command.northConnectorId);
        queryParams.push(JSON.stringify(command.commandContent));
        insertQuery += `(id, retrieved_date, type, status, ack, target_version, north_connector_id, command_content) VALUES (?, ?, ?, ?, ?, ?, ?, ?);`;
        break;
      case 'restart-engine':
      case 'regenerate-cipher-keys':
        insertQuery += `(id, retrieved_date, type, status, ack, target_version) VALUES (?, ?, ?, ?, ?, ?);`;
        break;
      case 'update-version':
        queryParams.push(
          JSON.stringify({
            version: command.version,
            assetId: command.assetId,
            updateLauncher: command.updateLauncher,
            backupFolders: command.backupFoldersPattern
          })
        );
        insertQuery += `(id, retrieved_date, type, status, ack, target_version, command_content) VALUES (?, ?, ?, ?, ?, ?, ?);`;
        break;
      case 'create-history-query':
        queryParams.push(command.retrieveSecretsFromNorth || '');
        queryParams.push(command.retrieveSecretsFromSouth || '');
        queryParams.push(command.retrieveSecretsFromHistoryQuery || '');
        queryParams.push(JSON.stringify(command.commandContent));
        insertQuery += `(id, retrieved_date, type, status, ack, target_version, north_connector_id, south_connector_id, history_id, command_content) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`;
        break;
      case 'update-history-query':
        queryParams.push(command.historyId);
        queryParams.push(JSON.stringify(command.commandContent));
        insertQuery += `(id, retrieved_date, type, status, ack, target_version, history_id, command_content) VALUES (?, ?, ?, ?, ?, ?, ?, ?);`;
        break;
      case 'delete-history-query':
        queryParams.push(command.historyId);
        insertQuery += `(id, retrieved_date, type, status, ack, target_version, history_id) VALUES (?, ?, ?, ?, ?, ?, ?);`;
        break;
      case 'create-or-update-history-query-south-items-from-csv':
        queryParams.push(command.historyId);
        queryParams.push(
          JSON.stringify({
            deleteItemsNotPresent: command.deleteItemsNotPresent,
            csvContent: command.csvContent,
            delimiter: command.delimiter
          })
        );
        insertQuery += `(id, retrieved_date, type, status, ack, target_version, history_id, command_content) VALUES (?, ?, ?, ?, ?, ?, ?, ?);`;
        break;
      case 'test-history-query-north-connection':
        queryParams.push(command.historyId);
        queryParams.push(command.northConnectorId);
        queryParams.push(JSON.stringify(command.commandContent));
        insertQuery += `(id, retrieved_date, type, status, ack, target_version, history_id, north_connector_id, command_content) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`;
        break;
      case 'test-history-query-south-connection':
        queryParams.push(command.historyId);
        queryParams.push(command.southConnectorId);
        queryParams.push(JSON.stringify(command.commandContent));
        insertQuery += `(id, retrieved_date, type, status, ack, target_version, history_id, south_connector_id, command_content) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`;
        break;
      case 'test-history-query-south-item':
        queryParams.push(command.historyId);
        queryParams.push(command.southConnectorId);
        queryParams.push(command.itemId);
        queryParams.push(JSON.stringify(command.commandContent));
        insertQuery += `(id, retrieved_date, type, status, ack, target_version, history_id, south_connector_id, item_id, command_content) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`;
        break;
      case 'update-history-query-status':
        queryParams.push(command.historyId);
        queryParams.push(
          JSON.stringify({
            historyQueryStatus: command.historyQueryStatus
          })
        );
        insertQuery += `(id, retrieved_date, type, status, ack, target_version, history_id, command_content) VALUES (?, ?, ?, ?, ?, ?, ?, ?);`;
        break;
      case 'setpoint':
        queryParams.push(command.northConnectorId);
        queryParams.push(JSON.stringify(command.commandContent));
        insertQuery += `(id, retrieved_date, type, status, ack, target_version, north_connector_id, command_content) VALUES (?, ?, ?, ?, ?, ?, ?, ?);`;
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
        return {
          id: command.id as string,
          type: 'update-version',
          status: command.status as OIBusCommandStatus,
          ack: Boolean(command.ack),
          targetVersion: command.target_version as string,
          retrievedDate: command.retrieved_date as Instant,
          completedDate: command.completed_date as Instant,
          result: command.result as string,
          commandContent: JSON.parse(command.command_content as string)
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
      case 'regenerate-cipher-keys':
        return {
          id: command.id as string,
          type: command.type as OIBusCommandType,
          status: command.status as OIBusCommandStatus,
          ack: Boolean(command.ack),
          targetVersion: command.target_version as string,
          retrievedDate: command.retrieved_date as Instant,
          completedDate: command.completed_date as Instant,
          result: command.result as string
        } as OIBusRegenerateCipherKeysCommand;
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
      case 'update-registration-settings':
        return {
          id: command.id as string,
          type: 'update-registration-settings',
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
          northConnectorId: command.north_connector_id as string,
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
      case 'test-north-connection':
        return {
          id: command.id as string,
          type: 'test-north-connection',
          status: command.status as OIBusCommandStatus,
          ack: Boolean(command.ack),
          targetVersion: command.target_version as string,
          retrievedDate: command.retrieved_date as Instant,
          completedDate: command.completed_date as Instant,
          result: command.result as string,
          northConnectorId: command.north_connector_id as string,
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
          southConnectorId: command.south_connector_id as string,
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
      case 'create-or-update-south-items-from-csv':
        return {
          id: command.id as string,
          type: 'create-or-update-south-items-from-csv',
          status: command.status as OIBusCommandStatus,
          ack: Boolean(command.ack),
          targetVersion: command.target_version as string,
          retrievedDate: command.retrieved_date as Instant,
          completedDate: command.completed_date as Instant,
          result: command.result as string,
          southConnectorId: command.south_connector_id as string,
          commandContent: JSON.parse(command.command_content as string)
        };
      case 'test-south-connection':
        return {
          id: command.id as string,
          type: 'test-south-connection',
          status: command.status as OIBusCommandStatus,
          ack: Boolean(command.ack),
          targetVersion: command.target_version as string,
          retrievedDate: command.retrieved_date as Instant,
          completedDate: command.completed_date as Instant,
          result: command.result as string,
          southConnectorId: command.south_connector_id as string,
          commandContent: JSON.parse(command.command_content as string)
        };
      case 'test-south-item':
        return {
          id: command.id as string,
          type: 'test-south-item',
          status: command.status as OIBusCommandStatus,
          ack: Boolean(command.ack),
          targetVersion: command.target_version as string,
          retrievedDate: command.retrieved_date as Instant,
          completedDate: command.completed_date as Instant,
          result: command.result as string,
          southConnectorId: command.south_connector_id as string,
          itemId: command.item_id as string,
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
      case 'create-ip-filter':
        return {
          id: command.id as string,
          type: 'create-ip-filter',
          status: command.status as OIBusCommandStatus,
          ack: Boolean(command.ack),
          targetVersion: command.target_version as string,
          retrievedDate: command.retrieved_date as Instant,
          completedDate: command.completed_date as Instant,
          result: command.result as string,
          commandContent: JSON.parse(command.command_content as string)
        };
      case 'update-ip-filter':
        return {
          id: command.id as string,
          type: 'update-ip-filter',
          status: command.status as OIBusCommandStatus,
          ack: Boolean(command.ack),
          targetVersion: command.target_version as string,
          retrievedDate: command.retrieved_date as Instant,
          completedDate: command.completed_date as Instant,
          result: command.result as string,
          ipFilterId: command.ip_filter_id as string,
          commandContent: JSON.parse(command.command_content as string)
        };
      case 'delete-ip-filter':
        return {
          id: command.id as string,
          type: 'delete-ip-filter',
          status: command.status as OIBusCommandStatus,
          ack: Boolean(command.ack),
          targetVersion: command.target_version as string,
          retrievedDate: command.retrieved_date as Instant,
          completedDate: command.completed_date as Instant,
          result: command.result as string,
          ipFilterId: command.ip_filter_id as string
        };
      case 'create-certificate':
        return {
          id: command.id as string,
          type: 'create-certificate',
          status: command.status as OIBusCommandStatus,
          ack: Boolean(command.ack),
          targetVersion: command.target_version as string,
          retrievedDate: command.retrieved_date as Instant,
          completedDate: command.completed_date as Instant,
          result: command.result as string,
          commandContent: JSON.parse(command.command_content as string)
        };
      case 'update-certificate':
        return {
          id: command.id as string,
          type: 'update-certificate',
          status: command.status as OIBusCommandStatus,
          ack: Boolean(command.ack),
          targetVersion: command.target_version as string,
          retrievedDate: command.retrieved_date as Instant,
          completedDate: command.completed_date as Instant,
          result: command.result as string,
          certificateId: command.certificate_id as string,
          commandContent: JSON.parse(command.command_content as string)
        };
      case 'delete-certificate':
        return {
          id: command.id as string,
          type: 'delete-certificate',
          status: command.status as OIBusCommandStatus,
          ack: Boolean(command.ack),
          targetVersion: command.target_version as string,
          retrievedDate: command.retrieved_date as Instant,
          completedDate: command.completed_date as Instant,
          result: command.result as string,
          certificateId: command.certificate_id as string
        };
      case 'create-history-query':
        return {
          id: command.id as string,
          type: 'create-history-query',
          status: command.status as OIBusCommandStatus,
          ack: Boolean(command.ack),
          targetVersion: command.target_version as string,
          retrievedDate: command.retrieved_date as Instant,
          completedDate: command.completed_date as Instant,
          result: command.result as string,
          northConnectorId: command.north_connector_id as string,
          southConnectorId: command.south_connector_id as string,
          historyQueryId: command.history_id as string,
          commandContent: JSON.parse(command.command_content as string)
        };
      case 'update-history-query':
        return {
          id: command.id as string,
          type: 'update-history-query',
          status: command.status as OIBusCommandStatus,
          ack: Boolean(command.ack),
          targetVersion: command.target_version as string,
          retrievedDate: command.retrieved_date as Instant,
          completedDate: command.completed_date as Instant,
          result: command.result as string,
          historyQueryId: command.history_id as string,
          commandContent: JSON.parse(command.command_content as string)
        };
      case 'delete-history-query':
        return {
          id: command.id as string,
          type: 'delete-history-query',
          status: command.status as OIBusCommandStatus,
          ack: Boolean(command.ack),
          targetVersion: command.target_version as string,
          retrievedDate: command.retrieved_date as Instant,
          completedDate: command.completed_date as Instant,
          result: command.result as string,
          historyQueryId: command.history_id as string
        };
      case 'create-or-update-history-query-south-items-from-csv':
        return {
          id: command.id as string,
          type: 'create-or-update-history-query-south-items-from-csv',
          status: command.status as OIBusCommandStatus,
          ack: Boolean(command.ack),
          targetVersion: command.target_version as string,
          retrievedDate: command.retrieved_date as Instant,
          completedDate: command.completed_date as Instant,
          result: command.result as string,
          historyQueryId: command.history_id as string,
          commandContent: JSON.parse(command.command_content as string)
        };
      case 'test-history-query-north-connection':
        return {
          id: command.id as string,
          type: 'test-history-query-north-connection',
          status: command.status as OIBusCommandStatus,
          ack: Boolean(command.ack),
          targetVersion: command.target_version as string,
          retrievedDate: command.retrieved_date as Instant,
          completedDate: command.completed_date as Instant,
          result: command.result as string,
          historyQueryId: command.history_id as string,
          northConnectorId: command.north_connector_id as string,
          commandContent: JSON.parse(command.command_content as string)
        };
      case 'test-history-query-south-connection':
        return {
          id: command.id as string,
          type: 'test-history-query-south-connection',
          status: command.status as OIBusCommandStatus,
          ack: Boolean(command.ack),
          targetVersion: command.target_version as string,
          retrievedDate: command.retrieved_date as Instant,
          completedDate: command.completed_date as Instant,
          result: command.result as string,
          historyQueryId: command.history_id as string,
          southConnectorId: command.south_connector_id as string,
          commandContent: JSON.parse(command.command_content as string)
        };
      case 'test-history-query-south-item':
        return {
          id: command.id as string,
          type: 'test-history-query-south-item',
          status: command.status as OIBusCommandStatus,
          ack: Boolean(command.ack),
          targetVersion: command.target_version as string,
          retrievedDate: command.retrieved_date as Instant,
          completedDate: command.completed_date as Instant,
          result: command.result as string,
          historyQueryId: command.history_id as string,
          southConnectorId: command.south_connector_id as string,
          itemId: command.item_id as string,
          commandContent: JSON.parse(command.command_content as string)
        };
      case 'update-history-query-status':
        return {
          id: command.id as string,
          type: 'update-history-query-status',
          status: command.status as OIBusCommandStatus,
          ack: Boolean(command.ack),
          targetVersion: command.target_version as string,
          retrievedDate: command.retrieved_date as Instant,
          completedDate: command.completed_date as Instant,
          result: command.result as string,
          historyQueryId: command.history_id as string,
          commandContent: JSON.parse(command.command_content as string)
        };
      case 'setpoint':
        return {
          id: command.id as string,
          type: 'setpoint',
          status: command.status as OIBusCommandStatus,
          ack: Boolean(command.ack),
          targetVersion: command.target_version as string,
          retrievedDate: command.retrieved_date as Instant,
          completedDate: command.completed_date as Instant,
          result: command.result as string,
          northConnectorId: command.north_connector_id as string,
          commandContent: JSON.parse(command.command_content as string)
        };
    }
  }
}
