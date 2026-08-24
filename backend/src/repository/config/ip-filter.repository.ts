import { generateRandomId } from '../../service/utils';
import { Database } from 'better-sqlite3';
import { IPFilter } from '../../model/ip-filter.model';
import AuditService from '../../service/audit.service';

const IP_FILTERS_TABLE = 'ip_filters';

/**
 * Repository used for ip filters (allow connection to OIBus from these IP addresses)
 */
export default class IpFilterRepository {
  constructor(
    private readonly database: Database,
    private readonly auditService: AuditService
  ) {}

  list(): Array<IPFilter> {
    const query = `SELECT id, address, description, created_by, updated_by, created_at, updated_at FROM ${IP_FILTERS_TABLE};`;
    return this.database
      .prepare(query)
      .all()
      .map(result => this.toIPFilter(result as Record<string, string>));
  }

  findById(id: string): IPFilter | null {
    const query = `SELECT id, address, description, created_by, updated_by, created_at, updated_at FROM ${IP_FILTERS_TABLE} WHERE id = ?;`;
    const result = this.database.prepare(query).get(id);
    return result ? this.toIPFilter(result as Record<string, string>) : null;
  }

  create(
    command: Omit<IPFilter, 'id' | 'createdBy' | 'updatedBy' | 'createdAt' | 'updatedAt'>,
    createdBy: string,
    id = generateRandomId(6)
  ): IPFilter {
    const insertQuery = `INSERT INTO ${IP_FILTERS_TABLE} (id, address, description, created_by, updated_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'), strftime('%Y-%m-%dT%H:%M:%SZ', 'now'));`;
    const result = this.database.prepare(insertQuery).run(id, command.address, command.description, createdBy, createdBy);
    const query = `SELECT id, address, description, created_by, updated_by, created_at, updated_at FROM ${IP_FILTERS_TABLE} WHERE ROWID = ?;`;
    const created = this.toIPFilter(this.database.prepare(query).get(result.lastInsertRowid) as Record<string, string>);
    this.auditService.record('ip_filter', created.id, 'CREATE', null, created as unknown as Record<string, unknown>, createdBy);
    return created;
  }

  update(id: string, command: Omit<IPFilter, 'id' | 'createdBy' | 'updatedBy' | 'createdAt' | 'updatedAt'>, updatedBy: string): void {
    const before = this.findById(id);
    const query = `UPDATE ${IP_FILTERS_TABLE} SET address = ?, description = ?, updated_by = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?;`;
    this.database.prepare(query).run(command.address, command.description, updatedBy, id);
    const after = this.findById(id);
    this.auditService.record(
      'ip_filter',
      id,
      'UPDATE',
      before as unknown as Record<string, unknown>,
      after as unknown as Record<string, unknown>,
      updatedBy
    );
  }

  delete(id: string, deletedBy: string): void {
    const before = this.findById(id);
    const query = `DELETE FROM ${IP_FILTERS_TABLE} WHERE id = ?;`;
    this.database.prepare(query).run(id);
    if (before) {
      this.auditService.record('ip_filter', id, 'DELETE', before as unknown as Record<string, unknown>, null, deletedBy);
    }
  }

  private toIPFilter(result: Record<string, string>): IPFilter {
    return {
      id: result.id,
      address: result.address,
      description: result.description,
      createdBy: result.created_by,
      updatedBy: result.updated_by,
      createdAt: result.created_at,
      updatedAt: result.updated_at
    };
  }
}
