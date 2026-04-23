import { Database } from 'better-sqlite3';
import { CommandSearchParam, OIBusCommandStatus, OIBusCommandType } from '../../../shared/model/command.model';
import { Instant, Page } from '../../../shared/model/types';
import { DateTime } from 'luxon';
import { OIBusCommand } from '../../model/oianalytics-command.model';
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

  search(searchParams: CommandSearchParam): Page<OIBusCommand> {
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
    if (searchParams.start) {
      whereClause += ` AND created_at >= ?`;
      queryParams.push(searchParams.start);
    }
    if (searchParams.end) {
      whereClause += ` AND created_at <= ?`;
      queryParams.push(searchParams.end);
    }

    const query = `SELECT *
                   FROM ${COMMANDS_TABLE} ${whereClause}
                   ORDER BY created_at DESC
                   LIMIT ${PAGE_SIZE} OFFSET ?;`;
    const results: Array<OIBusCommand> = this.database
      .prepare(query)
      .all(...queryParams, PAGE_SIZE * searchParams.page)
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
      number: searchParams.page,
      totalElements,
      totalPages
    };
  }

  list(searchParams: Omit<CommandSearchParam, 'page'>): Array<OIBusCommand> {
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
    if (searchParams.start) {
      whereClause += ` AND created_at >= ?`;
      queryParams.push(searchParams.start);
    }
    if (searchParams.end) {
      whereClause += ` AND created_at <= ?`;
      queryParams.push(searchParams.end);
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
      case 'search-north-cache-content':
        queryParams.push(command.northConnectorId);
        queryParams.push(JSON.stringify(command.commandContent));
        insertQuery += `(id, retrieved_date, type, status, ack, target_version, north_connector_id, command_content) VALUES (?, ?, ?, ?, ?, ?, ?, ?);`;
        break;
      case 'search-history-cache-content':
        queryParams.push(command.historyQueryId);
        queryParams.push(JSON.stringify(command.commandContent));
        insertQuery += `(id, retrieved_date, type, status, ack, target_version, history_id, command_content) VALUES (?, ?, ?, ?, ?, ?, ?, ?);`;
        break;
      case 'get-north-cache-file-content':
        queryParams.push(command.northConnectorId);
        queryParams.push(JSON.stringify(command.commandContent));
        insertQuery += `(id, retrieved_date, type, status, ack, target_version, north_connector_id, command_content) VALUES (?, ?, ?, ?, ?, ?, ?, ?);`;
        break;
      case 'get-history-cache-file-content':
        queryParams.push(command.historyQueryId);
        queryParams.push(JSON.stringify(command.commandContent));
        insertQuery += `(id, retrieved_date, type, status, ack, target_version, history_id, command_content) VALUES (?, ?, ?, ?, ?, ?, ?, ?);`;
        break;
      case 'update-north-cache-content':
        queryParams.push(command.northConnectorId);
        queryParams.push(JSON.stringify(command.commandContent));
        insertQuery += `(id, retrieved_date, type, status, ack, target_version, north_connector_id, command_content) VALUES (?, ?, ?, ?, ?, ?, ?, ?);`;
        break;
      case 'update-history-cache-content':
        queryParams.push(command.historyQueryId);
        queryParams.push(JSON.stringify(command.commandContent));
        insertQuery += `(id, retrieved_date, type, status, ack, target_version, history_id, command_content) VALUES (?, ?, ?, ?, ?, ?, ?, ?);`;
        break;
      case 'create-custom-transformer':
        queryParams.push(JSON.stringify(command.commandContent));
        insertQuery += `(id, retrieved_date, type, status, ack, target_version, command_content) VALUES (?, ?, ?, ?, ?, ?, ?);`;
        break;
      case 'update-custom-transformer':
        queryParams.push(command.transformerId);
        queryParams.push(JSON.stringify(command.commandContent));
        insertQuery += `(id, retrieved_date, type, status, ack, target_version, transformer_id, command_content) VALUES (?, ?, ?, ?, ?, ?, ?, ?);`;
        break;
      case 'delete-custom-transformer':
        queryParams.push(command.transformerId);
        insertQuery += `(id, retrieved_date, type, status, ack, target_version, transformer_id) VALUES (?, ?, ?, ?, ?, ?, ?);`;
        break;
      case 'test-custom-transformer':
        queryParams.push(JSON.stringify(command.commandContent));
        insertQuery += `(id, retrieved_date, type, status, ack, target_version, command_content) VALUES (?, ?, ?, ?, ?, ?, ?);`;
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
          ...baseCommandFields(command),
          type: 'update-version',
          commandContent: JSON.parse(command.command_content as string)
        };
      case 'restart-engine':
        return {
          ...baseCommandFields(command),
          type: 'restart-engine'
        };
      case 'regenerate-cipher-keys':
        return {
          ...baseCommandFields(command),
          type: 'regenerate-cipher-keys'
        };
      case 'update-engine-settings':
        return {
          ...baseCommandFields(command),
          type: 'update-engine-settings',
          commandContent: JSON.parse(command.command_content as string)
        };
      case 'update-registration-settings':
        return {
          ...baseCommandFields(command),
          type: 'update-registration-settings',
          commandContent: JSON.parse(command.command_content as string)
        };
      case 'create-north':
        return {
          ...baseCommandFields(command),
          type: 'create-north',
          northConnectorId: command.north_connector_id as string,
          commandContent: JSON.parse(command.command_content as string)
        };
      case 'update-north':
        return {
          ...baseCommandFields(command),
          type: 'update-north',
          northConnectorId: command.north_connector_id as string,
          commandContent: JSON.parse(command.command_content as string)
        };
      case 'delete-north':
        return {
          ...baseCommandFields(command),
          type: 'delete-north',
          northConnectorId: command.north_connector_id as string
        };
      case 'test-north-connection':
        return {
          ...baseCommandFields(command),
          type: 'test-north-connection',
          northConnectorId: command.north_connector_id as string,
          commandContent: JSON.parse(command.command_content as string)
        };
      case 'create-south':
        return {
          ...baseCommandFields(command),
          type: 'create-south',
          southConnectorId: command.south_connector_id as string,
          commandContent: JSON.parse(command.command_content as string)
        };
      case 'update-south':
        return {
          ...baseCommandFields(command),
          type: 'update-south',
          southConnectorId: command.south_connector_id as string,
          commandContent: JSON.parse(command.command_content as string)
        };
      case 'delete-south':
        return {
          ...baseCommandFields(command),
          type: 'delete-south',
          southConnectorId: command.south_connector_id as string
        };
      case 'create-or-update-south-items-from-csv':
        return {
          ...baseCommandFields(command),
          type: 'create-or-update-south-items-from-csv',
          southConnectorId: command.south_connector_id as string,
          commandContent: JSON.parse(command.command_content as string)
        };
      case 'test-south-connection':
        return {
          ...baseCommandFields(command),
          type: 'test-south-connection',
          southConnectorId: command.south_connector_id as string,
          commandContent: JSON.parse(command.command_content as string)
        };
      case 'test-south-item':
        return {
          ...baseCommandFields(command),
          type: 'test-south-item',
          southConnectorId: command.south_connector_id as string,
          itemId: command.item_id as string,
          commandContent: JSON.parse(command.command_content as string)
        };
      case 'create-scan-mode':
        return {
          ...baseCommandFields(command),
          type: 'create-scan-mode',
          commandContent: JSON.parse(command.command_content as string)
        };
      case 'update-scan-mode':
        return {
          ...baseCommandFields(command),
          type: 'update-scan-mode',
          scanModeId: command.scan_mode_id as string,
          commandContent: JSON.parse(command.command_content as string)
        };
      case 'delete-scan-mode':
        return {
          ...baseCommandFields(command),
          type: 'delete-scan-mode',
          scanModeId: command.scan_mode_id as string
        };
      case 'create-ip-filter':
        return {
          ...baseCommandFields(command),
          type: 'create-ip-filter',
          commandContent: JSON.parse(command.command_content as string)
        };
      case 'update-ip-filter':
        return {
          ...baseCommandFields(command),
          type: 'update-ip-filter',
          ipFilterId: command.ip_filter_id as string,
          commandContent: JSON.parse(command.command_content as string)
        };
      case 'delete-ip-filter':
        return {
          ...baseCommandFields(command),
          type: 'delete-ip-filter',
          ipFilterId: command.ip_filter_id as string
        };
      case 'create-certificate':
        return {
          ...baseCommandFields(command),
          type: 'create-certificate',
          commandContent: JSON.parse(command.command_content as string)
        };
      case 'update-certificate':
        return {
          ...baseCommandFields(command),
          type: 'update-certificate',
          certificateId: command.certificate_id as string,
          commandContent: JSON.parse(command.command_content as string)
        };
      case 'delete-certificate':
        return {
          ...baseCommandFields(command),
          type: 'delete-certificate',
          certificateId: command.certificate_id as string
        };
      case 'create-history-query':
        return {
          ...baseCommandFields(command),
          type: 'create-history-query',
          northConnectorId: command.north_connector_id as string,
          southConnectorId: command.south_connector_id as string,
          historyQueryId: command.history_id as string,
          commandContent: JSON.parse(command.command_content as string)
        };
      case 'update-history-query':
        return {
          ...baseCommandFields(command),
          type: 'update-history-query',
          historyQueryId: command.history_id as string,
          commandContent: JSON.parse(command.command_content as string)
        };
      case 'delete-history-query':
        return {
          ...baseCommandFields(command),
          type: 'delete-history-query',
          historyQueryId: command.history_id as string
        };
      case 'create-or-update-history-query-south-items-from-csv':
        return {
          ...baseCommandFields(command),
          type: 'create-or-update-history-query-south-items-from-csv',
          historyQueryId: command.history_id as string,
          commandContent: JSON.parse(command.command_content as string)
        };
      case 'test-history-query-north-connection':
        return {
          ...baseCommandFields(command),
          type: 'test-history-query-north-connection',
          historyQueryId: command.history_id as string,
          northConnectorId: command.north_connector_id as string,
          commandContent: JSON.parse(command.command_content as string)
        };
      case 'test-history-query-south-connection':
        return {
          ...baseCommandFields(command),
          type: 'test-history-query-south-connection',
          historyQueryId: command.history_id as string,
          southConnectorId: command.south_connector_id as string,
          commandContent: JSON.parse(command.command_content as string)
        };
      case 'test-history-query-south-item':
        return {
          ...baseCommandFields(command),
          type: 'test-history-query-south-item',
          historyQueryId: command.history_id as string,
          southConnectorId: command.south_connector_id as string,
          itemId: command.item_id as string,
          commandContent: JSON.parse(command.command_content as string)
        };
      case 'update-history-query-status':
        return {
          ...baseCommandFields(command),
          type: 'update-history-query-status',
          historyQueryId: command.history_id as string,
          commandContent: JSON.parse(command.command_content as string)
        };
      case 'setpoint':
        return {
          ...baseCommandFields(command),
          type: 'setpoint',
          northConnectorId: command.north_connector_id as string,
          commandContent: JSON.parse(command.command_content as string)
        };
      case 'search-north-cache-content':
        return {
          ...baseCommandFields(command),
          type: 'search-north-cache-content',
          northConnectorId: command.north_connector_id as string,
          commandContent: JSON.parse(command.command_content as string)
        };
      case 'search-history-cache-content':
        return {
          ...baseCommandFields(command),
          type: 'search-history-cache-content',
          historyQueryId: command.history_id as string,
          commandContent: JSON.parse(command.command_content as string)
        };
      case 'get-north-cache-file-content':
        return {
          ...baseCommandFields(command),
          type: 'get-north-cache-file-content',
          northConnectorId: command.north_connector_id as string,
          commandContent: JSON.parse(command.command_content as string)
        };
      case 'get-history-cache-file-content':
        return {
          ...baseCommandFields(command),
          type: 'get-history-cache-file-content',
          historyQueryId: command.history_id as string,
          commandContent: JSON.parse(command.command_content as string)
        };
      case 'update-north-cache-content':
        return {
          ...baseCommandFields(command),
          type: 'update-north-cache-content',
          northConnectorId: command.north_connector_id as string,
          commandContent: JSON.parse(command.command_content as string)
        };
      case 'update-history-cache-content':
        return {
          ...baseCommandFields(command),
          type: 'update-history-cache-content',
          historyQueryId: command.history_id as string,
          commandContent: JSON.parse(command.command_content as string)
        };
      case 'create-custom-transformer':
        return {
          ...baseCommandFields(command),
          type: 'create-custom-transformer',
          commandContent: JSON.parse(command.command_content as string)
        };
      case 'update-custom-transformer':
        return {
          ...baseCommandFields(command),
          type: 'update-custom-transformer',
          transformerId: command.transformer_id as string,
          commandContent: JSON.parse(command.command_content as string)
        };
      case 'delete-custom-transformer':
        return {
          ...baseCommandFields(command),
          type: 'delete-custom-transformer',
          transformerId: command.transformer_id as string
        };
      case 'test-custom-transformer':
        return {
          ...baseCommandFields(command),
          type: 'test-custom-transformer',
          commandContent: JSON.parse(command.command_content as string)
        };
    }
  }
}

const baseCommandFields = (
  command: Record<string, string | number>
): {
  id: string;
  createdBy: string;
  updatedBy: string;
  createdAt: Instant;
  updatedAt: Instant;
  status: OIBusCommandStatus;
  ack: boolean;
  targetVersion: string;
  retrievedDate: Instant;
  completedDate: Instant;
  result: string;
} => {
  return {
    id: command.id as string,
    createdBy: command.created_by as string,
    updatedBy: command.updated_by as string,
    createdAt: command.created_at as string,
    updatedAt: command.updated_at as string,
    status: command.status as OIBusCommandStatus,
    ack: Boolean(command.ack),
    targetVersion: command.target_version as string,
    retrievedDate: command.retrieved_date as Instant,
    completedDate: command.completed_date as Instant,
    result: command.result as string
  };
};
