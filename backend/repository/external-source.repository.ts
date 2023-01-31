import { generateRandomId } from './utils';
import { ExternalSourceCommandDTO, ExternalSourceDTO } from '../../shared/model/external-sources.model';
import { Database } from 'better-sqlite3';

const EXTERNAL_SOURCES_TABLE = 'external_sources';

/**
 * Repository used for external sources (remote data source that send values directly to the API)
 */
export default class ExternalSourceRepository {
  private readonly database: Database;

  constructor(database: Database) {
    this.database = database;
    const query = `CREATE TABLE IF NOT EXISTS ${EXTERNAL_SOURCES_TABLE} (id TEXT PRIMARY KEY, reference TEXT, description TEXT);`;
    this.database.prepare(query).run();
  }

  /**
   * Retrieve all external sources
   */
  getExternalSources(): Array<ExternalSourceDTO> {
    const query = `SELECT id, reference, description FROM ${EXTERNAL_SOURCES_TABLE};`;
    return this.database.prepare(query).all();
  }

  /**
   * Retrieve an external source by its ID
   */
  getExternalSource(id: string): ExternalSourceDTO {
    const query = `SELECT id, reference, description FROM ${EXTERNAL_SOURCES_TABLE} WHERE id = ?;`;
    return this.database.prepare(query).get(id);
  }

  /**
   * Create an external source with a random generated ID
   */
  createExternalSource(command: ExternalSourceCommandDTO): ExternalSourceDTO {
    const id = generateRandomId(6);
    const insertQuery = `INSERT INTO ${EXTERNAL_SOURCES_TABLE} (id, reference, description) ` + `VALUES (?, ?, ?);`;
    const result = this.database.prepare(insertQuery).run(id, command.reference, command.description);

    const query = `SELECT id, reference, description FROM ${EXTERNAL_SOURCES_TABLE} WHERE ROWID = ?;`;
    return this.database.prepare(query).get(result.lastInsertRowid);
  }

  /**
   * Update an external source by its ID
   */
  updateExternalSource(id: string, command: ExternalSourceCommandDTO): void {
    const query = `UPDATE ${EXTERNAL_SOURCES_TABLE} SET reference = ?, description = ? WHERE id = ?;`;
    this.database.prepare(query).run(command.reference, command.description, id);
  }

  /**
   * Delete an external source by its ID
   */
  deleteExternalSource(id: string): void {
    const query = `DELETE FROM ${EXTERNAL_SOURCES_TABLE} WHERE id = ?;`;
    this.database.prepare(query).run(id);
  }
}
