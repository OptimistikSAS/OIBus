import { ScanModeCommandDTO, ScanModeDTO } from '../../../shared/model/scan-mode.model';
import { generateRandomId } from '../service/utils';
import { Database } from 'better-sqlite3';

export const SCAN_MODES_TABLE = 'scan_modes';

/**
 * Repository used for scan modes (cron definitions)
 */
export default class ScanModeRepository {
  constructor(private readonly database: Database) {
    if (this.getScanModes().length === 0) {
      this.createScanMode({ name: 'Every seconds', description: 'Trigger every seconds', cron: '* * * * * *' });
      this.createScanMode({ name: 'Every 10 seconds', description: 'Trigger every 10 seconds', cron: '*/10 * * * * *' });
      this.createScanMode({ name: 'Every minutes', description: 'Trigger every minutes', cron: '0 * * * * *' });
      this.createScanMode({ name: 'Every 10 minutes', description: 'Trigger every 10 minutes', cron: '0 */10 * * * *' });
      this.createScanMode({ name: 'Every hours', description: 'Trigger every hours', cron: '0 0 * * * *' });
      this.createScanMode({ name: 'Every 24 hours', description: 'Trigger every 24 hours', cron: '0 0 0 * * *' });
      this.createScanMode({ name: 'Subscription', description: 'Used for subscription', cron: '' }, 'subscription');
    }
  }

  /**
   * Retrieve all scan modes
   */
  getScanModes(): Array<ScanModeDTO> {
    const query = `SELECT id, name, description, cron FROM ${SCAN_MODES_TABLE};`;
    return this.database.prepare(query).all() as Array<ScanModeDTO>;
  }

  /**
   * Retrieve a scan mode by its ID
   */
  getScanMode(id: string): ScanModeDTO | null {
    const query = `SELECT id, name, description, cron FROM ${SCAN_MODES_TABLE} WHERE id = ?;`;
    return this.database.prepare(query).get(id) as ScanModeDTO | null;
  }

  /**
   * Create a scan mode with a random generated ID
   */
  createScanMode(command: ScanModeCommandDTO, id = generateRandomId(6)): ScanModeDTO {
    const insertQuery = `INSERT INTO ${SCAN_MODES_TABLE} (id, name, description, cron) VALUES (?, ?, ?, ?);`;
    const result = this.database.prepare(insertQuery).run(id, command.name, command.description, command.cron);

    const query = `SELECT id, name, description, cron FROM ${SCAN_MODES_TABLE} WHERE ROWID = ?;`;
    return this.database.prepare(query).get(result.lastInsertRowid) as ScanModeDTO;
  }

  /**
   * Update a scan mode by its ID
   */
  updateScanMode(id: string, command: ScanModeCommandDTO): void {
    const query = `UPDATE ${SCAN_MODES_TABLE} SET name = ?, description = ?, cron = ? WHERE id = ?;`;
    this.database.prepare(query).run(command.name, command.description, command.cron, id);
  }

  /**
   * Delete a scan mode by its ID
   */
  deleteScanMode(id: string): void {
    const query = `DELETE FROM ${SCAN_MODES_TABLE} WHERE id = ?;`;
    this.database.prepare(query).run(id);
  }
}
