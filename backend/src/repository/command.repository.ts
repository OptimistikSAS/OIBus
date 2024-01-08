import { Database } from 'better-sqlite3';
import { OIBusCommand, OIBusCommandDTO } from '../../../shared/model/command.model';
import { generateRandomId } from '../service/utils';
import { DateTime } from 'luxon';

export const COMMANDS_TABLE = 'commands';

/**
 * Repository used for managing commands within OIBus
 */
export default class CommandRepository {
  constructor(private readonly database: Database) {}

  findAll(): Array<OIBusCommandDTO> {
    const query =
      `SELECT id, type, status, retrieved_date as retrievedDate, completed_date as completedDate, result, ` +
      `version FROM ${COMMANDS_TABLE};`;
    return this.database.prepare(query).all() as Array<OIBusCommandDTO>;
  }

  findById(id: string): OIBusCommandDTO | null {
    const query =
      `SELECT id, type, status, retrieved_date as retrievedDate, completed_date as completedDate, result, ` +
      `version FROM ${COMMANDS_TABLE} WHERE id = ?;`;
    return this.database.prepare(query).get(id) as OIBusCommandDTO | null;
  }

  create(command: OIBusCommand): OIBusCommandDTO {
    const insertQuery = `INSERT INTO ${COMMANDS_TABLE} (id, type, status, retrieved_date, version) VALUES (?, ?, ?, ?, ?);`;
    const result = this.database
      .prepare(insertQuery)
      .run(generateRandomId(), command.type, 'PENDING', DateTime.now().toUTC().toISO()!, command.version);

    const query =
      `SELECT id, type, status, retrieved_date as retrievedDate, completed_date as completedDate, result, ` +
      `version FROM ${COMMANDS_TABLE} WHERE ROWID = ?;`;
    return this.database.prepare(query).get(result.lastInsertRowid) as OIBusCommandDTO;
  }

  update(id: string, command: OIBusCommand): void {
    const query = `UPDATE ${COMMANDS_TABLE} SET version  = ? WHERE id = ?;`;
    this.database.prepare(query).run(command.version, id);
  }

  cancel(id: string): void {
    const query = `UPDATE ${COMMANDS_TABLE} SET status = 'CANCELLED' WHERE id = ?;`;
    this.database.prepare(query).run(id);
  }

  markAsCompleted(id: string, result: string): void {
    const query = `UPDATE ${COMMANDS_TABLE} SET status = 'COMPLETED', result = ? WHERE id = ?;`;
    this.database.prepare(query).run(result, id);
  }

  markAsErrored(id: string, result: string): void {
    const query = `UPDATE ${COMMANDS_TABLE} SET status = 'ERRORED', result = ? WHERE id = ?;`;
    this.database.prepare(query).run(result, id);
  }

  delete(id: string): void {
    const query = `DELETE FROM ${COMMANDS_TABLE} WHERE id = ?;`;
    this.database.prepare(query).run(id);
  }
}
