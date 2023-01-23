import { generateRandomId } from './utils';
import { IpFilterCommandDTO, IpFilterDTO } from '../../shared/model/ip-filter.model';
import { Database } from 'better-sqlite3';

const IP_FILTER_TABLE = 'ip_filter';

/**
 * Repository used for ip filters (allow connection to OIBus from these IP addresses)
 */
export default class IpFilterRepository {
  private readonly database: Database;
  constructor(database: Database) {
    this.database = database;
    const query = `CREATE TABLE IF NOT EXISTS ${IP_FILTER_TABLE} (id TEXT PRIMARY KEY, address TEXT, description TEXT);`;
    this.database.prepare(query).run();
  }

  /**
   * Retrieve all IP filters
   */
  getIpFilters(): Array<IpFilterDTO> {
    const query = `SELECT id, address, description FROM ${IP_FILTER_TABLE};`;
    return this.database.prepare(query).all();
  }

  /**
   * Retrieve an IP address by its ID
   */
  getIpFilter(id: string): IpFilterDTO | null {
    const query = `SELECT id, address, description FROM ${IP_FILTER_TABLE} WHERE id = ?;`;
    return this.database.prepare(query).get(id);
  }

  /**
   * Create an IP filter with a random generated ID
   */
  createIpFilter(command: IpFilterCommandDTO): IpFilterDTO {
    const id = generateRandomId(6);
    const insertQuery = `INSERT INTO ${IP_FILTER_TABLE} (id, address, description) ` + `VALUES (?, ?, ?);`;
    const result = this.database.prepare(insertQuery).run(id, command.address, command.description);

    const query = `SELECT id, address, description FROM ${IP_FILTER_TABLE} WHERE ROWID = ?;`;
    return this.database.prepare(query).get(result.lastInsertRowid);
  }

  /**
   * Update an IP filter by its ID
   */
  updateIpFilter(id: string, command: IpFilterCommandDTO): void {
    const query = `UPDATE ${IP_FILTER_TABLE} SET address = ?, description = ? WHERE id = ?;`;
    this.database.prepare(query).run(command.address, command.description, id);
  }

  /**
   * Delete an IP filter by its ID
   */
  deleteIpFilter(id: string): void {
    const query = `DELETE FROM ${IP_FILTER_TABLE} WHERE id = ?;`;
    this.database.prepare(query).run(id);
  }
}
