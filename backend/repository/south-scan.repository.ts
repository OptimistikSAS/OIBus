import { generateRandomId } from "./utils";
import {
  SouthScanCommandDTO,
  SouthScanDTO,
} from "../model/south-connector.model";
import { SOUTH_CONNECTOR_TABLE } from "./south-connector.repository";
import { SCAN_MODE_TABLE } from "./scan-mode.repository";

const SOUTH_SCAN_TABLE = "south_scan";

/**
 * Repository used for South connectors (Data sources)
 */
export default class SouthScanRepository {
  private readonly database;
  constructor(database) {
    this.database = database;
    const query =
      `CREATE TABLE IF NOT EXISTS ${SOUTH_SCAN_TABLE} (id TEXT PRIMARY KEY, south_id TEXT, scan_mode_id TEXT, name TEXT, ` +
      `settings TEXT, FOREIGN KEY(south_id) REFERENCES ${SOUTH_CONNECTOR_TABLE}(id), ` +
      `FOREIGN KEY(scan_mode_id) REFERENCES ${SCAN_MODE_TABLE}(id));`;
    this.database.prepare(query).run();
  }

  /**
   * Retrieve all South scan (point, query, folder...) associated to a South connector
   */
  getSouthScans(southId: string): Array<SouthScanDTO> {
    const query = `SELECT id, name, south_id AS southId, scan_mode_id AS scanModeId, settings FROM ${SOUTH_SCAN_TABLE} WHERE south_id = ?;`;
    return this.database
      .prepare(query)
      .all(southId)
      .map((result) => ({
        id: result.id,
        name: result.name,
        southId: result.southId,
        scanModeId: result.scanModeId,
        settings: JSON.parse(result.settings),
      }));
  }

  /**
   * Retrieve a South scan by its ID
   */
  getSouthScan(id: string): SouthScanDTO {
    const query = `SELECT id, name, south_id AS southId, scan_mode_id AS scanModeId, settings FROM ${SOUTH_SCAN_TABLE} WHERE id = ?;`;
    const result = this.database.prepare(query).get(id);
    return {
      id: result.id,
      name: result.name,
      southId: result.southId,
      scanModeId: result.scanModeId,
      settings: JSON.parse(result.settings),
    };
  }

  /**
   * Create a South scan with a random generated ID
   */
  createSouthScan(command: SouthScanCommandDTO): SouthScanDTO {
    const id = generateRandomId(6);
    const insertQuery =
      `INSERT INTO ${SOUTH_SCAN_TABLE} (id, name, south_id, scan_mode_id, settings) ` +
      `VALUES (?, ?, ?, ?, ?);`;
    const insertResult = this.database
      .prepare(insertQuery)
      .run(
        id,
        command.name,
        command.southId,
        command.scanModeId,
        JSON.stringify(command.settings)
      );

    const query = `SELECT id, name, south_id AS southId, scan_mode_id AS scanModeId, settings FROM ${SOUTH_SCAN_TABLE} WHERE ROWID = ?;`;
    const result = this.database
      .prepare(query)
      .get(insertResult.lastInsertRowid);
    return {
      id: result.id,
      name: result.name,
      southId: result.southId,
      scanModeId: result.scanModeId,
      settings: JSON.parse(result.settings),
    };
  }

  /**
   * Update a South scan by its ID
   */
  updateSouthScan(id: string, command: SouthScanCommandDTO): void {
    const query = `UPDATE ${SOUTH_SCAN_TABLE} SET name = ?, scan_mode_id = ?, settings = ? WHERE id = ?;`;
    return this.database
      .prepare(query)
      .run(
        command.name,
        command.scanModeId,
        JSON.stringify(command.settings),
        id
      );
  }

  /**
   * Delete a South scan by its ID
   */
  deleteSouthScan(id: string): void {
    const query = `DELETE FROM ${SOUTH_SCAN_TABLE} WHERE id = ?;`;
    return this.database.prepare(query).run(id);
  }
}
