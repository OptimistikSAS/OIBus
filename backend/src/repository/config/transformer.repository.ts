import { Database } from 'better-sqlite3';
import { Transformer } from '../../model/transformer.model';
import { TransformerSearchParam } from '../../../shared/model/transformer.model';
import { generateRandomId } from '../../service/utils';

const TRANSFORMERS_TABLE = 'transformers';

export default class TransformerRepository {
  constructor(private readonly database: Database) {}

  saveTransformer(transformer: Transformer): void {
    if (!transformer.id) {
      transformer.id = generateRandomId(6);
      this.database
        .prepare(`INSERT INTO ${TRANSFORMERS_TABLE} (id, name, description, input_type, output_type, code) VALUES (?, ?, ?, ?, ?, ?)`)
        .run(transformer.id, transformer.name, transformer.description, transformer.inputType, transformer.outputType, transformer.code);
    } else {
      this.database
        .prepare(`UPDATE ${TRANSFORMERS_TABLE} SET name = ?, description = ?, input_type = ?, output_type = ?, code = ? WHERE id = ?`)
        .run(transformer.name, transformer.description, transformer.inputType, transformer.outputType, transformer.code, transformer.id);
    }
  }

  deleteTransformer(id: string): void {
    this.database.prepare(`DELETE FROM ${TRANSFORMERS_TABLE} WHERE id = ?`).run(id);
  }

  findTransformerById(id: string): Transformer | null {
    const query = `SELECT id, name, description, input_type, output_type, code FROM ${TRANSFORMERS_TABLE} WHERE id = ?;`;
    const result = this.database.prepare(query).get(id);
    if (!result) return null;

    return this.toTransformer(result as Record<string, string>);
  }

  searchTransformers(searchParams: TransformerSearchParam): Array<Transformer> {
    let whereClause = `WHERE id IS NOT NULL`;
    const queryParams = [];

    if (searchParams.inputType !== undefined) {
      queryParams.push(searchParams.inputType);
      whereClause += ` AND input_type = ?`;
    }
    if (searchParams.outputType !== undefined) {
      queryParams.push(searchParams.outputType);
      whereClause += ` AND output_type = ?`;
    }
    if (searchParams.name) {
      queryParams.push(searchParams.name);
      whereClause += ` AND name like '%' || ? || '%'`;
    }

    const query = `SELECT id, name, description, input_type, output_type, code FROM ${TRANSFORMERS_TABLE} ${whereClause};`;

    return this.database
      .prepare(query)
      .all(...queryParams)
      .map(result => this.toTransformer(result as Record<string, string>));
  }

  private toTransformer(result: Record<string, string>): Transformer {
    return {
      id: result.id as string,
      name: result.name as string,
      description: result.description as string,
      inputType: result.input_type as string,
      outputType: result.output_type as string,
      code: result.code as string
    };
  }
}
