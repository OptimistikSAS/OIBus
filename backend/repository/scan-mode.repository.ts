import { ScanModeCommandDTO, ScanModeDTO } from "../model/scan-mode.model";
import { generateRandomId } from "./utils";

const SCAN_MODE_TABLE = "scan_mode";

/**
 * Repository used for scan modes (cron definitions)
 */
export default class ScanModeRepository {
  private readonly database;
  constructor(database) {
    this.database = database;
    const query = `CREATE TABLE IF NOT EXISTS ${SCAN_MODE_TABLE} (
                   id TEXT PRIMARY KEY,
                   name TEXT,
                   description TEXT,
                   cron TEXT
                 );`;
    this.database.prepare(query).run();
  }

  /**
   * Retrieve all scan modes
   */
  getScanModes(): Array<ScanModeDTO> {
    const query = `SELECT id, name, description, cron FROM ${SCAN_MODE_TABLE}`;
    return this.database.prepare(query).all();
  }

  /**
   * Retrieve a scan mode by its ID
   */
  getScanMode(id: string): ScanModeDTO {
    const query = `SELECT id, name, description, cron FROM ${SCAN_MODE_TABLE} WHERE id = ?`;
    return this.database.prepare(query).get(id);
  }

  /**
   * Create a scan mode with a random generated ID
   */
  createScanMode(command: ScanModeCommandDTO): void {
    const id = generateRandomId();
    const query =
      `INSERT INTO ${SCAN_MODE_TABLE} (id, name, description, cron) ` +
      `VALUES (?, ?, ?, ?)`;
    return this.database
      .prepare(query)
      .run(id, command.name, command.description, command.cron);
  }

  updateScanMode(id: string, command: ScanModeCommandDTO): void {
    const query = `UPDATE ${SCAN_MODE_TABLE} SET name = ?, description = ?, cron = ? WHERE id = ?`;
    return this.database
      .prepare(query)
      .run(command.name, command.description, command.cron, id);
  }

  deleteScanMode(id: string): void {
    const query = `DELETE FROM ${SCAN_MODE_TABLE} WHERE id = ?`;
    return this.database.prepare(query).run(id);
  }
}
