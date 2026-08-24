import { generateRandomId } from '../../service/utils';
import { Database } from 'better-sqlite3';
import { ScanMode } from '../../model/scan-mode.model';
import { ActivationWindow, ScanModeInterval, ScanModeType } from '../../../shared/model/scan-mode.model';
import AuditService from '../../service/audit.service';

const SCAN_MODES_TABLE = 'scan_modes';

/**
 * Every column making up a scan mode. Several repositories hydrate a `ScanMode` from a JOIN, so the
 * list lives here once instead of being spelled out at each call site — a new scan mode field then
 * only needs adding in this array.
 */
export const SCAN_MODE_COLUMNS = [
  'id',
  'name',
  'description',
  'type',
  'cron',
  'interval',
  'activation_window',
  'created_by',
  'updated_by',
  'created_at',
  'updated_at'
] as const;

/** `id, name, description, ...`, optionally qualified by a table alias. */
export const scanModeColumns = (alias?: string): string =>
  SCAN_MODE_COLUMNS.map(column => (alias ? `${alias}.${column}` : column)).join(', ');

/** `sm.id AS sm_id, sm.name AS sm_name, ...` for use in a JOIN alongside other tables' columns. */
export const scanModeAliasedColumns = (alias: string, prefix: string): string =>
  SCAN_MODE_COLUMNS.map(column => `${alias}.${column} AS ${prefix}${column}`).join(', ');

type ScanModeWrite = Omit<ScanMode, 'id' | 'createdBy' | 'updatedBy' | 'createdAt' | 'updatedAt'>;

// `cron` is NOT NULL in the original schema, so an interval scan mode stores an empty string rather
// than null. Normalising on write keeps the table from ever holding a contradictory row.
const cronValue = (command: ScanModeWrite): string => (command.type === 'cron' ? command.cron : '');
const intervalValue = (command: ScanModeWrite): string | null =>
  command.type === 'interval' && command.interval ? JSON.stringify(command.interval) : null;
const activationWindowValue = (command: ScanModeWrite): string | null =>
  command.activationWindow ? JSON.stringify(command.activationWindow) : null;

/** The scan modes seeded on a fresh install. All are cron-driven. */
const DEFAULT_SCAN_MODES: Array<{ id?: string; name: string; description: string; cron: string }> = [
  { name: 'Every second', description: 'Trigger every second', cron: '* * * * * *' },
  { name: 'Every 10 seconds', description: 'Trigger every 10 seconds', cron: '*/10 * * * * *' },
  { name: 'Every minute', description: 'Trigger every minute', cron: '0 * * * * *' },
  { name: 'Every 10 minutes', description: 'Trigger every 10 minutes', cron: '0 */10 * * * *' },
  { name: 'Every hour', description: 'Trigger every hour', cron: '0 0 * * * *' },
  { name: 'Every 24 hours', description: 'Trigger every 24 hours', cron: '0 0 0 * * *' },
  // Push-driven, never polled: referenced by its reserved id across the engine and south connectors.
  { id: 'subscription', name: 'Subscription', description: 'Used for subscription', cron: '' }
];

/**
 * Repository used for scan modes (cron definitions)
 */
export default class ScanModeRepository {
  constructor(
    private readonly database: Database,
    private readonly auditService: AuditService
  ) {
    this.createDefault();
  }

  protected createDefault(): void {
    if (this.findAll().length > 0) {
      return;
    }
    for (const { id, ...scanMode } of DEFAULT_SCAN_MODES) {
      this.create({ ...scanMode, type: 'cron', interval: null, activationWindow: null }, 'system', id);
    }
  }

  findAll(): Array<ScanMode> {
    const query = `SELECT ${scanModeColumns()} FROM ${SCAN_MODES_TABLE};`;
    return this.database
      .prepare(query)
      .all()
      .map(result => toScanMode(result as Record<string, string>));
  }

  findById(id: string): ScanMode | null {
    const query = `SELECT ${scanModeColumns()} FROM ${SCAN_MODES_TABLE} WHERE id = ?;`;
    const result = this.database.prepare(query).get(id);
    return result ? toScanMode(result as Record<string, string>) : null;
  }

  create(
    command: Omit<ScanMode, 'id' | 'createdBy' | 'updatedBy' | 'createdAt' | 'updatedAt'>,
    createdBy: string,
    id = generateRandomId(6)
  ): ScanMode {
    const insertQuery =
      `INSERT INTO ${SCAN_MODES_TABLE} (id, name, description, type, cron, interval, activation_window, created_by, updated_by, created_at, updated_at) ` +
      `VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'), strftime('%Y-%m-%dT%H:%M:%SZ', 'now'));`;
    const result = this.database
      .prepare(insertQuery)
      .run(
        id,
        command.name,
        command.description,
        command.type,
        cronValue(command),
        intervalValue(command),
        activationWindowValue(command),
        createdBy,
        createdBy
      );
    const query = `SELECT ${scanModeColumns()} FROM ${SCAN_MODES_TABLE} WHERE ROWID = ?;`;
    const created = toScanMode(this.database.prepare(query).get(result.lastInsertRowid) as Record<string, string>);
    this.auditService.record('scan_mode', created.id, 'CREATE', null, created as unknown as Record<string, unknown>, createdBy);
    return created;
  }

  update(id: string, command: Omit<ScanMode, 'id' | 'createdBy' | 'updatedBy' | 'createdAt' | 'updatedAt'>, updatedBy: string): void {
    const before = this.findById(id);
    const query =
      `UPDATE ${SCAN_MODES_TABLE} SET name = ?, description = ?, type = ?, cron = ?, interval = ?, activation_window = ?, ` +
      `updated_by = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?;`;
    this.database
      .prepare(query)
      .run(
        command.name,
        command.description,
        command.type,
        cronValue(command),
        intervalValue(command),
        activationWindowValue(command),
        updatedBy,
        id
      );
    const after = this.findById(id);
    this.auditService.record(
      'scan_mode',
      id,
      'UPDATE',
      before as unknown as Record<string, unknown>,
      after as unknown as Record<string, unknown>,
      updatedBy
    );
  }

  delete(id: string, deletedBy: string): void {
    const before = this.findById(id);
    const query = `DELETE FROM ${SCAN_MODES_TABLE} WHERE id = ?;`;
    this.database.prepare(query).run(id);
    if (before) {
      this.auditService.record('scan_mode', id, 'DELETE', before as unknown as Record<string, unknown>, null, deletedBy);
    }
  }
}

export const toScanMode = (result: Record<string, string | null>): ScanMode => {
  return {
    id: result.id!,
    name: result.name!,
    description: result.description!,
    // Rows written before the type column existed, or by an interrupted migration, are cron-driven.
    type: (result.type as ScanModeType | null) ?? 'cron',
    cron: result.cron ?? '',
    interval: result.interval ? (JSON.parse(result.interval) as ScanModeInterval) : null,
    activationWindow: result.activation_window ? (JSON.parse(result.activation_window) as ActivationWindow) : null,
    createdBy: result.created_by!,
    updatedBy: result.updated_by!,
    createdAt: result.created_at!,
    updatedAt: result.updated_at!
  };
};

/** Hydrate a scan mode from a JOINed row whose scan-mode columns carry `prefix`. */
export const toScanModeFromPrefixedRow = (result: Record<string, unknown>, prefix: string): ScanMode =>
  toScanMode(Object.fromEntries(SCAN_MODE_COLUMNS.map(column => [column, (result[`${prefix}${column}`] ?? null) as string | null])));
