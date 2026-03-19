import { generateRandomId } from '../../service/utils';
import { Database } from 'better-sqlite3';
import { ScanMode } from '../../model/scan-mode.model';

const SCAN_MODES_TABLE = 'scan_modes';

/**
 * Repository used for scan modes (cron definitions)
 */
export default class ScanModeRepository {
  constructor(private readonly database: Database) {
    if (this.findAll().length === 0) {
      this.create(
        {
          name: 'Every second',
          description: 'Trigger every second',
          cron: '* * * * * *'
        },
        'system'
      );
      this.create(
        {
          name: 'Every 10 seconds',
          description: 'Trigger every 10 seconds',
          cron: '*/10 * * * * *'
        },
        'system'
      );
      this.create(
        {
          name: 'Every minute',
          description: 'Trigger every minute',
          cron: '0 * * * * *'
        },
        'system'
      );
      this.create(
        {
          name: 'Every 10 minutes',
          description: 'Trigger every 10 minutes',
          cron: '0 */10 * * * *'
        },
        'system'
      );
      this.create(
        {
          name: 'Every hour',
          description: 'Trigger every hour',
          cron: '0 0 * * * *'
        },
        'system'
      );
      this.create(
        {
          name: 'Every 24 hours',
          description: 'Trigger every 24 hours',
          cron: '0 0 0 * * *'
        },
        'system'
      );
      this.create(
        {
          name: 'Subscription',
          description: 'Used for subscription',
          cron: ''
        },
        'system',
        'subscription'
      );
    }
  }

  findAll(): Array<ScanMode> {
    const query = `SELECT id, name, description, cron, created_by, updated_by, created_at, updated_at FROM ${SCAN_MODES_TABLE};`;
    return this.database
      .prepare(query)
      .all()
      .map(result => toScanMode(result as Record<string, string>));
  }

  findById(id: string): ScanMode | null {
    const query = `SELECT id, name, description, cron, created_by, updated_by, created_at, updated_at FROM ${SCAN_MODES_TABLE} WHERE id = ?;`;
    const result = this.database.prepare(query).get(id);
    return result ? toScanMode(result as Record<string, string>) : null;
  }

  create(
    command: Omit<ScanMode, 'id' | 'createdBy' | 'updatedBy' | 'createdAt' | 'updatedAt'>,
    createdBy: string,
    id = generateRandomId(6)
  ): ScanMode {
    const insertQuery = `INSERT INTO ${SCAN_MODES_TABLE} (id, name, description, cron, created_by, updated_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'), strftime('%Y-%m-%dT%H:%M:%SZ', 'now'));`;
    const result = this.database.prepare(insertQuery).run(id, command.name, command.description, command.cron, createdBy, createdBy);
    const query = `SELECT id, name, description, cron, created_by, updated_by, created_at, updated_at FROM ${SCAN_MODES_TABLE} WHERE ROWID = ?;`;
    return toScanMode(this.database.prepare(query).get(result.lastInsertRowid) as Record<string, string>);
  }

  update(id: string, command: Omit<ScanMode, 'id' | 'createdBy' | 'updatedBy' | 'createdAt' | 'updatedAt'>, updatedBy: string): void {
    const query = `UPDATE ${SCAN_MODES_TABLE} SET name = ?, description = ?, cron = ?, updated_by = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?;`;
    this.database.prepare(query).run(command.name, command.description, command.cron, updatedBy, id);
  }

  delete(id: string): void {
    const query = `DELETE FROM ${SCAN_MODES_TABLE} WHERE id = ?;`;
    this.database.prepare(query).run(id);
  }
}

export const toScanMode = (result: Record<string, string>): ScanMode => {
  return {
    id: result.id,
    name: result.name,
    description: result.description,
    cron: result.cron,
    createdBy: result.created_by,
    updatedBy: result.updated_by,
    createdAt: result.created_at,
    updatedAt: result.updated_at
  };
};
