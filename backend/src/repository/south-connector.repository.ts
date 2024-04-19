import { generateRandomId } from '../service/utils';
import { SouthConnectorCommandDTO, SouthConnectorDTO } from '../../../shared/model/south-connector.model';
import { Database } from 'better-sqlite3';

export const SOUTH_CONNECTORS_TABLE = 'south_connectors';

/**
 * Repository used for South connectors (Data sources)
 */
export default class SouthConnectorRepository {
  constructor(private readonly database: Database) {}

  /**
   * Retrieve all South connectors
   */
  getSouthConnectors(): Array<SouthConnectorDTO> {
    const query =
      `SELECT id, name, type, description, enabled, history_max_instant_per_item AS maxInstantPerItem, shared_connection as sharedConnection, ` +
      `history_max_read_interval AS maxReadInterval, history_read_delay AS readDelay, history_read_overlap AS overlap, ` +
      `settings FROM ${SOUTH_CONNECTORS_TABLE};`;
    return this.database
      .prepare(query)
      .all()
      .map((result: any) => ({
        id: result.id,
        name: result.name,
        type: result.type,
        description: result.description,
        enabled: Boolean(result.enabled),
        sharedConnection: result.sharedConnection,
        history: {
          maxInstantPerItem: Boolean(result.maxInstantPerItem),
          maxReadInterval: result.maxReadInterval,
          readDelay: result.readDelay,
          overlap: result.overlap
        },
        settings: JSON.parse(result.settings)
      }));
  }

  /**
   * Retrieve a South connector by its ID
   */
  getSouthConnector(id: string): SouthConnectorDTO | null {
    const query =
      `SELECT id, name, type, description, enabled, history_max_instant_per_item AS maxInstantPerItem, shared_connection as sharedConnection, ` +
      `history_max_read_interval AS maxReadInterval, history_read_delay AS readDelay, history_read_overlap AS overlap, ` +
      `settings FROM ${SOUTH_CONNECTORS_TABLE} WHERE id = ?;`;
    const result: any = this.database.prepare(query).get(id);

    if (!result) {
      return null;
    }

    return {
      id: result.id,
      name: result.name,
      type: result.type,
      description: result.description,
      enabled: Boolean(result.enabled),
      sharedConnection: result.sharedConnection,
      history: {
        maxInstantPerItem: Boolean(result.maxInstantPerItem),
        maxReadInterval: result.maxReadInterval,
        readDelay: result.readDelay,
        overlap: result.overlap
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
      `INSERT INTO ${SOUTH_CONNECTORS_TABLE} (id, name, type, description, enabled, history_max_instant_per_item, ` +
      `history_max_read_interval, history_read_delay, history_read_overlap, settings, shared_connection) ` +
      `VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`;
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
        command.history.overlap,
        JSON.stringify(command.settings),
        command.sharedConnection ? +command.sharedConnection : 0
      );

    const query =
      `SELECT id, name, type, description, enabled, history_max_instant_per_item AS maxInstantPerItem, shared_connection as sharedConnection, ` +
      `history_max_read_interval AS maxReadInterval, history_read_delay AS readDelay, history_read_overlap AS overlap, ` +
      `settings FROM ${SOUTH_CONNECTORS_TABLE} WHERE ROWID = ?;`;
    const result: any = this.database.prepare(query).get(insertResult.lastInsertRowid);
    return {
      id: result.id,
      name: result.name,
      type: result.type,
      description: result.description,
      enabled: Boolean(result.enabled),
      sharedConnection: Boolean(result.sharedConnection),
      history: {
        maxInstantPerItem: Boolean(result.maxInstantPerItem),
        maxReadInterval: result.maxReadInterval,
        readDelay: result.readDelay,
        overlap: result.overlap
      },
      settings: JSON.parse(result.settings)
    };
  }

  startSouthConnector(id: string) {
    const query = `UPDATE ${SOUTH_CONNECTORS_TABLE} SET enabled = ? WHERE id = ?;`;
    this.database.prepare(query).run(1, id);
  }

  stopSouthConnector(id: string) {
    const query = `UPDATE ${SOUTH_CONNECTORS_TABLE} SET enabled = ? WHERE id = ?;`;
    this.database.prepare(query).run(0, id);
  }

  /**
   * Update a South connector by its ID
   */
  updateSouthConnector(id: string, command: SouthConnectorCommandDTO): void {
    const query =
      `UPDATE ${SOUTH_CONNECTORS_TABLE} SET name = ?, description = ?, ` +
      `history_max_instant_per_item = ?, history_max_read_interval = ?, history_read_delay = ?, history_read_overlap = ?, settings = ?, shared_connection = ? WHERE id = ?;`;
    this.database
      .prepare(query)
      .run(
        command.name,
        command.description,
        +command.history.maxInstantPerItem,
        command.history.maxReadInterval,
        command.history.readDelay,
        command.history.overlap,
        JSON.stringify(command.settings),
        command.sharedConnection ? +command.sharedConnection : 0,
        id
      );
  }

  /**
   * Delete a South Connector by its ID
   */
  deleteSouthConnector(id: string): void {
    const query = `DELETE FROM ${SOUTH_CONNECTORS_TABLE} WHERE id = ?;`;
    this.database.prepare(query).run(id);
  }
}
