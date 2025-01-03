import { generateRandomId } from '../../service/utils';
import { Database } from 'better-sqlite3';
import { IPFilter } from '../../model/ip-filter.model';

const IP_FILTERS_TABLE = 'ip_filters';

/**
 * Repository used for ip filters (allow connection to OIBus from these IP addresses)
 */
export default class IpFilterRepository {
  constructor(private readonly database: Database) {}

  findAll(): Array<IPFilter> {
    const query = `SELECT id, address, description FROM ${IP_FILTERS_TABLE};`;
    return this.database
      .prepare(query)
      .all()
      .map(result => this.toIPFilter(result as Record<string, string>));
  }

  findById(id: string): IPFilter | null {
    const query = `SELECT id, address, description FROM ${IP_FILTERS_TABLE} WHERE id = ?;`;
    const result = this.database.prepare(query).get(id);
    return result ? this.toIPFilter(result as Record<string, string>) : null;
  }

  create(command: Omit<IPFilter, 'id'>, id = generateRandomId(6)): IPFilter {
    const insertQuery = `INSERT INTO ${IP_FILTERS_TABLE} (id, address, description) ` + `VALUES (?, ?, ?);`;
    const result = this.database.prepare(insertQuery).run(id, command.address, command.description);
    const query = `SELECT id, address, description FROM ${IP_FILTERS_TABLE} WHERE ROWID = ?;`;
    return this.toIPFilter(this.database.prepare(query).get(result.lastInsertRowid) as Record<string, string>);
  }

  update(id: string, command: Omit<IPFilter, 'id'>): void {
    const query = `UPDATE ${IP_FILTERS_TABLE} SET address = ?, description = ? WHERE id = ?;`;
    this.database.prepare(query).run(command.address, command.description, id);
  }

  delete(id: string): void {
    const query = `DELETE FROM ${IP_FILTERS_TABLE} WHERE id = ?;`;
    this.database.prepare(query).run(id);
  }

  private toIPFilter(result: Record<string, string>): IPFilter {
    return {
      id: result.id,
      address: result.address,
      description: result.description
    };
  }
}
