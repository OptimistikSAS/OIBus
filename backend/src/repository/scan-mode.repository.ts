import { generateRandomId } from '../service/utils';
import { Database } from 'better-sqlite3';
import { ScanMode } from '../model/scan-mode.model';

export const SCAN_MODES_TABLE = 'scan_modes';

/**
 * Repository used for scan modes (cron definitions)
 */
export default class ScanModeRepository {
  constructor(private readonly database: Database) {
    if (this.findAll().length === 0) {
      this.create({ name: 'Every second', description: 'Trigger every second', cron: '* * * * * *' });
      this.create({ name: 'Every 10 seconds', description: 'Trigger every 10 seconds', cron: '*/10 * * * * *' });
      this.create({ name: 'Every minute', description: 'Trigger every minute', cron: '0 * * * * *' });
      this.create({ name: 'Every 10 minutes', description: 'Trigger every 10 minutes', cron: '0 */10 * * * *' });
      this.create({ name: 'Every hour', description: 'Trigger every hour', cron: '0 0 * * * *' });
      this.create({ name: 'Every 24 hours', description: 'Trigger every 24 hours', cron: '0 0 0 * * *' });
      this.create({ name: 'Subscription', description: 'Used for subscription', cron: '' }, 'subscription');
    }
  }

  findAll(): Array<ScanMode> {
    const query = `SELECT id, name, description, cron FROM ${SCAN_MODES_TABLE};`;
    return this.database
      .prepare(query)
      .all()
      .map(result => this.toScanMode(result));
  }

  findById(id: string): ScanMode | null {
    const query = `SELECT id, name, description, cron FROM ${SCAN_MODES_TABLE} WHERE id = ?;`;
    const result = this.database.prepare(query).get(id);
    return result ? this.toScanMode(result) : null;
  }

  create(command: Omit<ScanMode, 'id'>, id = generateRandomId(6)): ScanMode {
    const insertQuery = `INSERT INTO ${SCAN_MODES_TABLE} (id, name, description, cron) VALUES (?, ?, ?, ?);`;
    const result = this.database.prepare(insertQuery).run(id, command.name, command.description, command.cron);
    const query = `SELECT id, name, description, cron FROM ${SCAN_MODES_TABLE} WHERE ROWID = ?;`;
    return this.toScanMode(this.database.prepare(query).get(result.lastInsertRowid));
  }

  update(id: string, command: Omit<ScanMode, 'id'>): void {
    const query = `UPDATE ${SCAN_MODES_TABLE} SET name = ?, description = ?, cron = ? WHERE id = ?;`;
    this.database.prepare(query).run(command.name, command.description, command.cron, id);
  }

  delete(id: string): void {
    const query = `DELETE FROM ${SCAN_MODES_TABLE} WHERE id = ?;`;
    this.database.prepare(query).run(id);
  }

  private toScanMode(result: any): ScanMode {
    return {
      id: result.id,
      name: result.name,
      description: result.description,
      cron: result.cron
    };
  }
}
