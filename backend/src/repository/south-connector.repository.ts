import { generateRandomId } from '../service/utils';
import { SouthConnectorCommandDTO, SouthConnectorDTO } from '../../../shared/model/south-connector.model';
import { Database } from 'better-sqlite3';

export const SOUTH_CONNECTOR_TABLE = 'south_connector';

/**
 * Repository used for South connectors (Data sources)
 */
export default class SouthConnectorRepository {
  private readonly database: Database;
  constructor(database: Database) {
    this.database = database;
    const query =
      `CREATE TABLE IF NOT EXISTS ${SOUTH_CONNECTOR_TABLE} (id TEXT PRIMARY KEY, name TEXT, type TEXT, description TEXT, ` +
      `enabled INTEGER, history_max_instant_per_item INTEGER, history_max_read_interval INTEGER, history_read_delay INTEGER, settings TEXT);`;
    this.database.prepare(query).run();
  }

  /**
   * Retrieve all South connectors
   */
  getSouthConnectors(): Array<SouthConnectorDTO> {
    const query =
      `SELECT id, name, type, description, enabled, history_max_instant_per_item AS maxInstantPerItem, ` +
      `history_max_read_interval AS maxReadInterval, history_read_delay AS readDelay, settings FROM ${SOUTH_CONNECTOR_TABLE};`;
    return this.database
      .prepare(query)
      .all()
      .map((result: any) => ({
        id: result.id,
        name: result.name,
        type: result.type,
        description: result.description,
        enabled: result.enabled,
        history: {
          maxInstantPerItem: result.maxInstantPerItem,
          maxReadInterval: result.maxReadInterval,
          readDelay: result.readDelay
        },
        settings: JSON.parse(result.settings)
      }));
  }

  /**
   * Retrieve a South connector by its ID
   */
  getSouthConnector(id: string): SouthConnectorDTO | null {
    const query =
      `SELECT id, name, type, description, enabled, history_max_instant_per_item AS maxInstantPerItem, ` +
      `history_max_read_interval AS maxReadInterval, history_read_delay AS readDelay, settings FROM ${SOUTH_CONNECTOR_TABLE} WHERE id = ?;`;
    const result: any = this.database.prepare(query).get(id);

    if (!result) {
      return null;
    }

    return {
      id: result.id,
      name: result.name,
      type: result.type,
      description: result.description,
      enabled: result.enabled,
      history: {
        maxInstantPerItem: result.maxInstantPerItem,
        maxReadInterval: result.maxReadInterval,
        readDelay: result.readDelay
      },
      settings: JSON.parse(result.settings)
    };
  }

  /**
   * Create a South connector with a random generated ID
   */
  createSouthConnector(command: SouthConnectorCommandDTO): SouthConnectorDTO {
    const id = generateRandomId(6);
    const insertQuery =
      `INSERT INTO ${SOUTH_CONNECTOR_TABLE} (id, name, type, description, enabled, history_max_instant_per_item, history_max_read_interval, history_read_delay, settings) ` +
      `VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`;
    const insertResult = this.database
      .prepare(insertQuery)
      .run(
        id,
        command.name,
        command.type,
        command.description,
        +command.enabled,
        +command.history.maxInstantPerItem,
        command.history.maxReadInterval,
        command.history.readDelay,
        JSON.stringify(command.settings)
      );

    const query =
      `SELECT id, name, type, description, enabled, history_max_instant_per_item AS maxInstantPerItem, ` +
      `history_max_read_interval AS maxReadInterval, history_read_delay AS readDelay, settings FROM ${SOUTH_CONNECTOR_TABLE} WHERE ROWID = ?;`;
    const result: any = this.database.prepare(query).get(insertResult.lastInsertRowid);
    return {
      id: result.id,
      name: result.name,
      type: result.type,
      description: result.description,
      enabled: result.enabled,
      history: {
        maxInstantPerItem: result.maxInstantPerItem,
        maxReadInterval: result.maxReadInterval,
        readDelay: result.readDelay
      },
      settings: JSON.parse(result.settings)
    };
  }

  /**
   * Update a South connector by its ID
   */
  updateSouthConnector(id: string, command: SouthConnectorCommandDTO): void {
    const query =
      `UPDATE ${SOUTH_CONNECTOR_TABLE} SET name = ?, description = ?, enabled = ?, ` +
      `history_max_instant_per_item = ?, history_max_read_interval = ?, history_read_delay = ?, settings = ? WHERE id = ?;`;
    this.database
      .prepare(query)
      .run(
        command.name,
        command.description,
        +command.enabled,
        +command.history.maxInstantPerItem,
        command.history.maxReadInterval,
        command.history.readDelay,
        JSON.stringify(command.settings),
        id
      );
  }

  /**
   * Delete a South Connector by its ID
   */
  deleteSouthConnector(id: string): void {
    const query = `DELETE FROM ${SOUTH_CONNECTOR_TABLE} WHERE id = ?;`;
    this.database.prepare(query).run(id);
  }
}
