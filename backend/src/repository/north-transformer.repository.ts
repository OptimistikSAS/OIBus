import { Database } from 'better-sqlite3';
import { TransformerDTO, TransformerFilterDTO } from '../../../shared/model/transformer.model';
export const NORTH_TRANSFORMERS_TABLE = 'north_transformers';

export default class NorthTransformerRepository {
  constructor(private readonly database: Database) {}

  /**
   * Adds a transformer to the list of available transformers for a north connector
   */
  addTransformer(northId: string, transformerId: string): void {
    this.database.prepare(`INSERT INTO ${NORTH_TRANSFORMERS_TABLE} (north_id, transformer_id) VALUES (?, ?)`).run(northId, transformerId);
  }

  /**
   * Retrieves all transformers available for a north connector
   * @param filter Optional filter to restrict the results
   */
  getTransformers(northId: string, filter?: TransformerFilterDTO): Array<TransformerDTO> {
    if (!filter) {
      const query = `SELECT t.id, t.name, t.description, t.input_type AS inputType, t.output_type AS outputType, t.code, t.file_regex AS fileRegex FROM ${NORTH_TRANSFORMERS_TABLE} nt
        JOIN transformers t ON nt.transformer_id = t.id
        WHERE nt.north_id = ?;`;
      return this.database.prepare(query).all(northId) as Array<TransformerDTO>;
    }

    let query = `SELECT t.id, t.name, t.description, t.input_type AS inputType, t.output_type AS outputType, t.code, t.file_regex AS fileRegex FROM ${NORTH_TRANSFORMERS_TABLE} nt
      JOIN transformers t ON nt.transformer_id = t.id`;

    const conditions = ['nt.north_id = ?'];
    const params = [northId];

    if (filter.inputType) {
      conditions.push('t.input_type = ?');
      params.push(filter.inputType);
    }
    if (filter.outputType) {
      conditions.push('t.output_type = ?');
      params.push(filter.outputType);
    }
    if (filter.name) {
      conditions.push("t.name LIKE '%' || ? || '%'");
      params.push(filter.name);
    }

    query += ` WHERE ${conditions.join(' AND ')};`;
    return this.database.prepare(query).all(...params) as Array<TransformerDTO>;
  }

  /**
   * Removes a transformer from the list of available transformers for a north connector
   */
  removeTransformer(northId: string, transformerId: string): void {
    this.database.prepare(`DELETE FROM ${NORTH_TRANSFORMERS_TABLE} WHERE north_id = ? AND transformer_id = ?`).run(northId, transformerId);
  }
}
