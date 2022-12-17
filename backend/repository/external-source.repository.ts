import { generateRandomId } from "./utils";
import {
  ExternalSourceCommandDTO,
  ExternalSourceDTO,
} from "../model/external-sources.model";

const EXTERNAL_SOURCES_TABLE = "external_sources";

/**
 * Repository used for external sources (remote data source that send values directly to the API)
 */
export default class ExternalSourceRepository {
  private readonly database;

  constructor(database) {
    this.database = database;
    const query = `CREATE TABLE IF NOT EXISTS ${EXTERNAL_SOURCES_TABLE} (
                   id TEXT PRIMARY KEY,
                   reference TEXT,
                   description TEXT
                 );`;
    this.database.prepare(query).run();
  }

  /**
   * Retrieve all external sources
   */
  getExternalSources(): Array<ExternalSourceDTO> {
    const query = `SELECT id, reference, description FROM ${EXTERNAL_SOURCES_TABLE}`;
    return this.database.prepare(query).all();
  }

  /**
   * Retrieve an external source by its ID
   */
  getExternalSource(id: string): ExternalSourceDTO {
    const query = `SELECT id, reference, description FROM ${EXTERNAL_SOURCES_TABLE} WHERE id = ?`;
    return this.database.prepare(query).get(id);
  }

  /**
   * Create an external source with a random generated ID
   */
  createExternalSource(command: ExternalSourceCommandDTO): void {
    const id = generateRandomId();
    const query =
      `INSERT INTO ${EXTERNAL_SOURCES_TABLE} (id, reference, description) ` +
      `VALUES (?, ?, ?)`;
    return this.database
      .prepare(query)
      .run(id, command.reference, command.description);
  }

  /**
   * Update an external source by its ID
   */
  updateExternalSource(id: string, command: ExternalSourceCommandDTO): void {
    const query = `UPDATE ${EXTERNAL_SOURCES_TABLE} SET reference = ?, description = ? WHERE id = ?`;
    return this.database
      .prepare(query)
      .run(command.reference, command.description, id);
  }

  /**
   * Delete an external source by its ID
   */
  deleteExternalSource(id: string): void {
    const query = `DELETE FROM ${EXTERNAL_SOURCES_TABLE} WHERE id = ?`;
    return this.database.prepare(query).run(id);
  }
}
