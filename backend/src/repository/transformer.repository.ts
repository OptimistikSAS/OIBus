import { generateRandomId } from '../service/utils';
import { TransformerCommandDTO, TransformerDTO, TransformerFilterDTO } from '../../../shared/model/transformer.model';
import { Database } from 'better-sqlite3';

export const TRANSFORMERS_TABLE = 'transformers';

export default class TransformerRepository {
  constructor(private readonly database: Database) {}

  /**
   * Creates a new transformer
   */
  createTransformer(command: TransformerCommandDTO): TransformerDTO {
    const id = generateRandomId(6);
    this.database
      .prepare(
        `INSERT INTO ${TRANSFORMERS_TABLE} (id, name, description, input_type, output_type, code, file_regex) VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(id, command.name, command.description, command.inputType, command.outputType, command.code, command.fileRegex);
    return { id, ...command };
  }

  /**
   * Updates a transformer
   */
  updateTransformer(id: string, command: TransformerCommandDTO): void {
    this.database
      .prepare(
        `UPDATE ${TRANSFORMERS_TABLE} SET name = ?, description = ?, input_type = ?, output_type = ?, code = ?, file_regex = ? WHERE id = ?`
      )
      .run(command.name, command.description, command.inputType, command.outputType, command.code, command.fileRegex, id);
  }

  /**
   * Deletes a transformer
   */
  deleteTransformer(id: string): void {
    this.database.prepare(`DELETE FROM ${TRANSFORMERS_TABLE} WHERE id = ?`).run(id);
  }

  /**
   * Retrieves a transformer by id
   */
  getTransformer(id: string): TransformerDTO | null {
    const query = `SELECT id, name, description, input_type AS inputType, output_type AS outputType, code, file_regex AS fileRegex FROM ${TRANSFORMERS_TABLE} WHERE id = ?;`;
    const result = this.database.prepare(query).get(id) as any;
    if (!result) {
      return null;
    }

    return result;
  }

  /**
   * Retrieves all transformers
   * @param filter Optional filter to restrict the results
   */
  getTransformers(filter?: TransformerFilterDTO): Array<TransformerDTO> {
    if (!filter) {
      const query = `SELECT id, name, description, input_type AS inputType, output_type AS outputType, code, file_regex AS fileRegex FROM ${TRANSFORMERS_TABLE};`;
      return this.database.prepare(query).all() as Array<TransformerDTO>;
    }

    let query = `SELECT id, name, description, input_type AS inputType, output_type AS outputType, code, file_regex AS fileRegex FROM ${TRANSFORMERS_TABLE}`;

    const conditions = [];
    const params = [];

    if (filter.inputType) {
      conditions.push('input_type = ?');
      params.push(filter.inputType);
    }
    if (filter.outputType) {
      conditions.push('output_type = ?');
      params.push(filter.outputType);
    }
    if (filter.name) {
      conditions.push("name LIKE '%' || ? || '%'");
      params.push(filter.name);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ';';
    return this.database.prepare(query).all(...params) as Array<TransformerDTO>;
  }
}
