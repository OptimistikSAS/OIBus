import { Database } from 'better-sqlite3';
import { TransformerDTO, TransformerFilterDTO } from '../../../shared/model/transformer.model';
import { TRANSFORMERS_TABLE } from './transformer.repository';

export const SOUTH_TRANSFORMERS_TABLE = 'south_transformers';

export default class SouthTransformerRepository {
  constructor(private readonly database: Database) {}

  /**
   * Adds a transformer to the list of available transformers for a south connector
   */
  addTransformer(southId: string, transformerId: string): void {
    this.database.prepare(`INSERT INTO ${SOUTH_TRANSFORMERS_TABLE} (south_id, transformer_id) VALUES (?, ?)`).run(southId, transformerId);
  }

  /**
   * Retrieves all transformers available for a south connector
   * @param filter Optional filter to restrict the results
   */
  getTransformers(southId: string, filter?: TransformerFilterDTO): Array<TransformerDTO> {
    if (!filter) {
      const query = `SELECT t.id, t.name, t.description, t.input_type AS inputType, t.output_type AS outputType, t.code, t.file_regex AS fileRegex FROM ${SOUTH_TRANSFORMERS_TABLE} st
        JOIN ${TRANSFORMERS_TABLE} t ON st.transformer_id = t.id
        WHERE st.south_id = ?;`;
      return this.database.prepare(query).all(southId) as Array<TransformerDTO>;
    }

    let query = `SELECT t.id, t.name, t.description, t.input_type AS inputType, t.output_type AS outputType, t.code, t.file_regex AS fileRegex FROM ${SOUTH_TRANSFORMERS_TABLE} st
      JOIN ${TRANSFORMERS_TABLE} t ON st.transformer_id = t.id`;

    const conditions = ['st.south_id = ?'];
    const params = [southId];

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
   * Removes a transformer from the list of available transformers for a south connector
   */
  removeTransformer(southId: string, transformerId: string): void {
    this.database.prepare(`DELETE FROM ${SOUTH_TRANSFORMERS_TABLE} WHERE south_id = ? AND transformer_id = ?`).run(southId, transformerId);
  }
}
