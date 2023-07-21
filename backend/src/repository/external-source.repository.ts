import { generateRandomId } from '../service/utils';
import { ExternalSourceCommandDTO, ExternalSourceDTO } from '../../../shared/model/external-sources.model';
import { Database } from 'better-sqlite3';

export const EXTERNAL_SOURCES_TABLE = 'external_sources';

/**
 * Repository used for external sources (remote data source that send values directly to the API)
 */
export default class ExternalSourceRepository {
  constructor(private readonly database: Database) {}

  /**
   * Retrieve all external sources
   */
  getExternalSources(): Array<ExternalSourceDTO> {
    const query = `SELECT id, reference, description FROM ${EXTERNAL_SOURCES_TABLE};`;
    return this.database.prepare(query).all() as Array<ExternalSourceDTO>;
  }

  /**
   * Retrieve an external source by its ID
   */
  getExternalSource(id: string): ExternalSourceDTO | null {
    const query = `SELECT id, reference, description FROM ${EXTERNAL_SOURCES_TABLE} WHERE id = ?;`;
    return this.database.prepare(query).get(id) as ExternalSourceDTO | null;
  }

  /**
   * Retrieve an external source by its reference
   */
  findExternalSourceByReference(reference: string): ExternalSourceDTO | null {
    const query = `SELECT id, reference, description FROM ${EXTERNAL_SOURCES_TABLE} WHERE reference = ?;`;
    return this.database.prepare(query).get(reference) as ExternalSourceDTO | null;
  }

  /**
   * Create an external source with a random generated ID
   */
  createExternalSource(command: ExternalSourceCommandDTO): ExternalSourceDTO {
    const id = generateRandomId(6);
    const insertQuery = `INSERT INTO ${EXTERNAL_SOURCES_TABLE} (id, reference, description) ` + `VALUES (?, ?, ?);`;
    const result = this.database.prepare(insertQuery).run(id, command.reference, command.description);

    const query = `SELECT id, reference, description FROM ${EXTERNAL_SOURCES_TABLE} WHERE ROWID = ?;`;
    return this.database.prepare(query).get(result.lastInsertRowid) as ExternalSourceDTO;
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
