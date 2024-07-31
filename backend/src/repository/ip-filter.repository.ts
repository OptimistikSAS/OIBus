import { generateRandomId } from '../service/utils';
import { IpFilterCommandDTO, IpFilterDTO } from '../../../shared/model/ip-filter.model';
import { Database } from 'better-sqlite3';

export const IP_FILTERS_TABLE = 'ip_filters';

/**
 * Repository used for ip filters (allow connection to OIBus from these IP addresses)
 */
export default class IpFilterRepository {
  constructor(private readonly database: Database) {}

  findAll(): Array<IpFilterDTO> {
    const query = `SELECT id, address, description FROM ${IP_FILTERS_TABLE};`;
    return this.database.prepare(query).all() as Array<IpFilterDTO>;
  }

  findById(id: string): IpFilterDTO | null {
    const query = `SELECT id, address, description FROM ${IP_FILTERS_TABLE} WHERE id = ?;`;
    return this.database.prepare(query).get(id) as IpFilterDTO | null;
  }

  create(command: IpFilterCommandDTO): IpFilterDTO {
    const id = generateRandomId(6);
    const insertQuery = `INSERT INTO ${IP_FILTERS_TABLE} (id, address, description) ` + `VALUES (?, ?, ?);`;
    const result = this.database.prepare(insertQuery).run(id, command.address, command.description);

    const query = `SELECT id, address, description FROM ${IP_FILTERS_TABLE} WHERE ROWID = ?;`;
    return this.database.prepare(query).get(result.lastInsertRowid) as IpFilterDTO;
  }

  update(id: string, command: IpFilterCommandDTO): void {
    const query = `UPDATE ${IP_FILTERS_TABLE} SET address = ?, description = ? WHERE id = ?;`;
    this.database.prepare(query).run(command.address, command.description, id);
  }

  delete(id: string): void {
    const query = `DELETE FROM ${IP_FILTERS_TABLE} WHERE id = ?;`;
    this.database.prepare(query).run(id);
  }
}
