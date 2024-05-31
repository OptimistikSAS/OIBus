import { Database } from 'better-sqlite3';
import { TransformerDTO, TransformerFilterDTO } from '../../../shared/model/transformer.model';
import { TRANSFORMERS_TABLE } from './transformer.repository';

export const HISTORY_TRANSFORMERS_TABLE = 'history_transformers';

export default class HistoryTransformerRepository {
  constructor(private readonly database: Database) {}

  /**
   * Adds a transformer to the list of available transformers for a history connector south or north
   */
  addTransformer(historyId: string, connectorType: 'south' | 'north', transformerId: string): void {
    if (connectorType !== 'south' && connectorType !== 'north') {
      throw new Error('Invalid connector type');
    }

    this.database
      .prepare(`INSERT INTO ${HISTORY_TRANSFORMERS_TABLE} (history_id, connector_type, transformer_id) VALUES (?, ?, ?)`)
      .run(historyId, connectorType, transformerId);
  }

  /**
   * Retrieves all transformers available for a history connector south or north
   * @param filter Optional filter to restrict the results
   */
  getTransformers(historyId: string, connectorType: 'south' | 'north', filter?: TransformerFilterDTO): Array<TransformerDTO> {
    if (connectorType !== 'south' && connectorType !== 'north') {
      throw new Error('Invalid connector type');
    }

    if (!filter) {
      const query = `SELECT t.id, t.name, t.description, t.input_type AS inputType, t.output_type AS outputType, t.code, t.file_regex AS fileRegex FROM ${HISTORY_TRANSFORMERS_TABLE} ht
        JOIN ${TRANSFORMERS_TABLE} t ON ht.transformer_id = t.id
        WHERE ht.history_id = ? AND ht.connector_type = ?;`;
      return this.database.prepare(query).all(historyId, connectorType) as Array<TransformerDTO>;
    }

    let query = `SELECT t.id, t.name, t.description, t.input_type AS inputType, t.output_type AS outputType, t.code, t.file_regex AS fileRegex FROM ${HISTORY_TRANSFORMERS_TABLE} ht
      JOIN ${TRANSFORMERS_TABLE} t ON ht.transformer_id = t.id`;

    const conditions = ['ht.history_id = ?', 'ht.connector_type = ?'];
    const params = [historyId, connectorType];

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
   * Removes a transformer from the list of available transformers for a history connector south or north
   */
  removeTransformer(historyId: string, connectorType: 'south' | 'north', transformerId: string): void {
    if (connectorType !== 'south' && connectorType !== 'north') {
      throw new Error('Invalid connector type');
    }

    this.database
      .prepare(`DELETE FROM ${HISTORY_TRANSFORMERS_TABLE} WHERE history_id = ? AND connector_type = ? AND transformer_id = ?`)
      .run(historyId, connectorType, transformerId);
  }
}
