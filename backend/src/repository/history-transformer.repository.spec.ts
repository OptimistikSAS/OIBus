import HistoryTransformerRepository, { HISTORY_TRANSFORMERS_TABLE } from '../repository/history-transformer.repository';
import { TRANSFORMERS_TABLE } from '../repository/transformer.repository';
import SqliteDatabaseMock, { run, all, get } from '../tests/__mocks__/database.mock';
import { Database } from 'better-sqlite3';

jest.mock('../tests/__mocks__/database.mock');
jest.mock('../service/utils', () => ({
  generateRandomId: jest.fn(() => '123456')
}));

const connectorTypes = ['south', 'north'] as const;

describe.each(connectorTypes)('HistoryTransformerRepository with %s', connectorType => {
  let database: Database;
  let repository: HistoryTransformerRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    database = new SqliteDatabaseMock();
    database.prepare = jest.fn().mockReturnValue({
      run,
      get,
      all
    });
    repository = new HistoryTransformerRepository(database);
  });

  it(`should add a transformer to the list of available ${connectorType} transformers`, () => {
    const historyId = 'historyId';
    const transformerId = 'transformerId';

    repository.addTransformer(historyId, connectorType, transformerId);

    expect(database.prepare).toHaveBeenCalledWith(
      `INSERT INTO ${HISTORY_TRANSFORMERS_TABLE} (history_id, connector_type, transformer_id) VALUES (?, ?, ?)`
    );
    expect(run).toHaveBeenCalledWith(historyId, connectorType, transformerId);
  });

  it(`should not add a transformer to the list of available ${connectorType} transformers when connector type is invalid`, () => {
    const historyId = 'historyId';
    const connectorType = 'invalid';
    const transformerId = 'transformerId';

    try {
      // @ts-expect-error Testing invalid input
      repository.addTransformer(historyId, connectorType, transformerId);
    } catch (error: any) {
      expect(error.message).toEqual('Invalid connector type');
      expect(database.prepare).not.toHaveBeenCalled();
      expect(run).not.toHaveBeenCalled();
    }
  });

  it(`should return all available ${connectorType} transformers without filters`, () => {
    const historyId = 'historyId';
    const transformers = [
      {
        id: '123456',
        name: 'name',
        description: 'description',
        inputType: 'input',
        outputType: 'output',
        code: 'code',
        fileRegex: 'fileRegex'
      },
      {
        id: '789012',
        name: 'name2',
        description: 'description',
        inputType: 'input',
        outputType: 'output',
        code: 'code',
        fileRegex: null
      }
    ];
    all.mockReturnValueOnce(transformers);

    const result = repository.getTransformers(historyId, connectorType);
    expect(database.prepare).toHaveBeenCalledWith(
      `SELECT t.id, t.name, t.description, t.input_type AS inputType, t.output_type AS outputType, t.code, t.file_regex AS fileRegex FROM ${HISTORY_TRANSFORMERS_TABLE} ht
        JOIN ${TRANSFORMERS_TABLE} t ON ht.transformer_id = t.id
        WHERE ht.history_id = ? AND ht.connector_type = ?;`
    );
    expect(all).toHaveBeenCalledWith(historyId, connectorType);
    expect(result).toEqual(transformers);
  });

  it(`should return all available ${connectorType} transformers with filters`, () => {
    const historyId = 'historyId';
    const transformers = [
      {
        id: '123456',
        name: 'name',
        description: 'description',
        inputType: 'input',
        outputType: 'output',
        code: 'code',
        fileRegex: 'fileRegex'
      }
    ];
    all.mockReturnValue(transformers);
    let result;

    // inputType
    result = repository.getTransformers(historyId, connectorType, { inputType: 'input' });
    expect(database.prepare).toHaveBeenCalledWith(
      `SELECT t.id, t.name, t.description, t.input_type AS inputType, t.output_type AS outputType, t.code, t.file_regex AS fileRegex FROM ${HISTORY_TRANSFORMERS_TABLE} ht
      JOIN ${TRANSFORMERS_TABLE} t ON ht.transformer_id = t.id WHERE ht.history_id = ? AND ht.connector_type = ? AND t.input_type = ?;`
    );
    expect(all).toHaveBeenCalledWith(historyId, connectorType, 'input');
    expect(result).toEqual(transformers);

    // outputType
    result = repository.getTransformers(historyId, connectorType, { outputType: 'output' });
    expect(database.prepare).toHaveBeenCalledWith(
      `SELECT t.id, t.name, t.description, t.input_type AS inputType, t.output_type AS outputType, t.code, t.file_regex AS fileRegex FROM ${HISTORY_TRANSFORMERS_TABLE} ht
      JOIN ${TRANSFORMERS_TABLE} t ON ht.transformer_id = t.id WHERE ht.history_id = ? AND ht.connector_type = ? AND t.output_type = ?;`
    );
    expect(all).toHaveBeenCalledWith(historyId, connectorType, 'output');
    expect(result).toEqual(transformers);

    // name
    result = repository.getTransformers(historyId, connectorType, { name: 'name' });
    expect(database.prepare).toHaveBeenCalledWith(
      `SELECT t.id, t.name, t.description, t.input_type AS inputType, t.output_type AS outputType, t.code, t.file_regex AS fileRegex FROM ${HISTORY_TRANSFORMERS_TABLE} ht
      JOIN ${TRANSFORMERS_TABLE} t ON ht.transformer_id = t.id WHERE ht.history_id = ? AND ht.connector_type = ? AND t.name LIKE '%' || ? || '%';`
    );
    expect(all).toHaveBeenCalledWith(historyId, connectorType, 'name');
    expect(result).toEqual(transformers);

    // empty filter
    result = repository.getTransformers(historyId, connectorType, {});
    expect(database.prepare).toHaveBeenCalledWith(
      `SELECT t.id, t.name, t.description, t.input_type AS inputType, t.output_type AS outputType, t.code, t.file_regex AS fileRegex FROM ${HISTORY_TRANSFORMERS_TABLE} ht
      JOIN ${TRANSFORMERS_TABLE} t ON ht.transformer_id = t.id WHERE ht.history_id = ? AND ht.connector_type = ?;`
    );
    expect(all).toHaveBeenCalledWith(historyId, connectorType);
    expect(result).toEqual(transformers);

    // multiple filters
    result = repository.getTransformers(historyId, connectorType, { inputType: 'input', outputType: 'output', name: 'name' });
    expect(database.prepare).toHaveBeenCalledWith(
      `SELECT t.id, t.name, t.description, t.input_type AS inputType, t.output_type AS outputType, t.code, t.file_regex AS fileRegex FROM ${HISTORY_TRANSFORMERS_TABLE} ht
      JOIN ${TRANSFORMERS_TABLE} t ON ht.transformer_id = t.id WHERE ht.history_id = ? AND ht.connector_type = ? AND t.input_type = ? AND t.output_type = ? AND t.name LIKE '%' || ? || '%';`
    );
    expect(all).toHaveBeenCalledWith(historyId, connectorType, 'input', 'output', 'name');
    expect(result).toEqual(transformers);
  });

  it(`should not return all available ${connectorType} transformers when connector type is invalid`, () => {
    const historyId = 'historyId';
    const connectorType = 'invalid';

    try {
      // @ts-expect-error Testing invalid input
      repository.getTransformers(historyId, connectorType);
    } catch (error: any) {
      expect(error.message).toEqual('Invalid connector type');
      expect(database.prepare).not.toHaveBeenCalled();
      expect(run).not.toHaveBeenCalled();
    }
  });

  it(`should remove a transformer from the list of available ${connectorType} transformers`, () => {
    const historyId = 'historyId';
    const transformerId = 'transformerId';

    repository.removeTransformer(historyId, connectorType, transformerId);

    expect(database.prepare).toHaveBeenCalledWith(
      `DELETE FROM ${HISTORY_TRANSFORMERS_TABLE} WHERE history_id = ? AND connector_type = ? AND transformer_id = ?`
    );
    expect(run).toHaveBeenCalledWith(historyId, connectorType, transformerId);
  });

  it(`should not return all available ${connectorType} transformers when connector type is invalid`, () => {
    const historyId = 'historyId';
    const connectorType = 'invalid';
    const transformerId = 'transformerId';

    try {
      // @ts-expect-error Testing invalid input
      repository.removeTransformer(historyId, connectorType, transformerId);
    } catch (error: any) {
      expect(error.message).toEqual('Invalid connector type');
      expect(database.prepare).not.toHaveBeenCalled();
      expect(run).not.toHaveBeenCalled();
    }
  });
});
