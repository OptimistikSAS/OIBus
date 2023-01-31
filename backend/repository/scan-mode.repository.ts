import { ScanModeCommandDTO, ScanModeDTO } from '../../shared/model/scan-mode.model';
import { generateRandomId } from './utils';
import { Database } from 'better-sqlite3';

export const SCAN_MODE_TABLE = 'scan_mode';

/**
 * Repository used for scan modes (cron definitions)
 */
export default class ScanModeRepository {
  private readonly database: Database;
  constructor(database: Database) {
    this.database = database;
    const query = `CREATE TABLE IF NOT EXISTS ${SCAN_MODE_TABLE} (id TEXT PRIMARY KEY, name TEXT, description TEXT, cron TEXT);`;
    this.database.prepare(query).run();
  }

  /**
   * Retrieve all scan modes
   */
  getScanModes(): Array<ScanModeDTO> {
    const query = `SELECT id, name, description, cron FROM ${SCAN_MODE_TABLE};`;
    return this.database.prepare(query).all();
  }

  /**
   * Retrieve a scan mode by its ID
   */
  getScanMode(id: string): ScanModeDTO {
    const query = `SELECT id, name, description, cron FROM ${SCAN_MODE_TABLE} WHERE id = ?;`;
    return this.database.prepare(query).get(id);
  }

  /**
   * Create a scan mode with a random generated ID
   */
  createScanMode(command: ScanModeCommandDTO): ScanModeDTO {
    const id = generateRandomId(6);
    const insertQuery = `INSERT INTO ${SCAN_MODE_TABLE} (id, name, description, cron) VALUES (?, ?, ?, ?);`;
    const result = this.database.prepare(insertQuery).run(id, command.name, command.description, command.cron);

    const query = `SELECT id, name, description, cron FROM ${SCAN_MODE_TABLE} WHERE ROWID = ?;`;
    return this.database.prepare(query).get(result.lastInsertRowid);
  }

  /**
   * Update a scan mode by its ID
   */
  updateScanMode(id: string, command: ScanModeCommandDTO): void {
    const query = `UPDATE ${SCAN_MODE_TABLE} SET name = ?, description = ?, cron = ? WHERE id = ?;`;
    this.database.prepare(query).run(command.name, command.description, command.cron, id);
  }

  /**
   * Delete a scan mode by its ID
   */
  deleteScanMode(id: string): void {
    const query = `DELETE FROM ${SCAN_MODE_TABLE} WHERE id = ?;`;
    this.database.prepare(query).run(id);
  }
}
