import { generateRandomId } from '../service/utils';
import { TransformerCommandDTO, TransformerDTO } from '../../../shared/model/transformer.model';
import { Database } from 'better-sqlite3';

export const TRANSFORMERS_TABLE = 'transformers';
export const NORTH_TRANSFORMERS_TABLE = 'north_transformers';
export const SOUTH_TRANSFORMERS_TABLE = 'south_transformers';
export const HISTORY_TRANSFORMERS_TABLE = 'history_transformers';

export default class TransformerRepository {
  constructor(private readonly database: Database) {}

  createTransformer(command: TransformerCommandDTO): TransformerDTO {
    const id = generateRandomId(6);
    this.database
      .prepare(`INSERT INTO ${TRANSFORMERS_TABLE} (id, input_type, output_type, code, file_regex) VALUES (?, ?, ?, ?, ?)`)
      .run(id, command.inputType, command.outputType, command.code, command.fileRegex);
    return { id, ...command };
  }

  updateTransformer(id: string, command: TransformerCommandDTO): void {
    this.database
      .prepare(`UPDATE ${TRANSFORMERS_TABLE} SET input_type = ?, output_type = ?, code = ?, file_regex = ? WHERE id = ?`)
      .run(command.inputType, command.outputType, command.code, command.fileRegex, id);
  }

  deleteTransformer(id: string): void {
    this.database.prepare(`DELETE FROM ${TRANSFORMERS_TABLE} WHERE id = ?`).run(id);
  }

  getTransformer(id: string): TransformerDTO | null {
    const query = `SELECT id, input_type AS inputType, output_type AS outputType, code, file_regex AS fileRegex FROM ${TRANSFORMERS_TABLE} WHERE id = ?;`;
    const result = this.database.prepare(query).get(id) as any;
    if (!result) {
      return null;
    }

    return result;
  }

  getTransformers(): Array<TransformerDTO> {
    const query = `SELECT id, input_type AS inputType, output_type AS outputType, code, file_regex AS fileRegex FROM ${TRANSFORMERS_TABLE};`;
    return this.database.prepare(query).all() as Array<TransformerDTO>;
  }
}
