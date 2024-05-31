import NorthTransformerRepository, { NORTH_TRANSFORMERS_TABLE } from '../repository/north-transformer.repository';
import { TRANSFORMERS_TABLE } from '../repository/transformer.repository';
import SqliteDatabaseMock, { run, all, get } from '../tests/__mocks__/database.mock';
import { Database } from 'better-sqlite3';

jest.mock('../tests/__mocks__/database.mock');
jest.mock('../service/utils', () => ({
  generateRandomId: jest.fn(() => '123456')
}));

describe('NorthTransformerRepository', () => {
  let database: Database;
  let repository: NorthTransformerRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    database = new SqliteDatabaseMock();
    database.prepare = jest.fn().mockReturnValue({
      run,
      get,
      all
    });
    repository = new NorthTransformerRepository(database);
  });

  it('should add a transformer to the list of available transformers for a north connector', () => {
    const northId = 'northId';
    const transformerId = 'transformerId';

    repository.addTransformer(northId, transformerId);

    expect(database.prepare).toHaveBeenCalledWith(`INSERT INTO ${NORTH_TRANSFORMERS_TABLE} (north_id, transformer_id) VALUES (?, ?)`);
    expect(run).toHaveBeenCalledWith(northId, transformerId);
  });

  it('should return all available transformers for a north connector without filters', () => {
    const northId = 'northId';
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

    const result = repository.getTransformers(northId);
    expect(database.prepare).toHaveBeenCalledWith(
      `SELECT t.id, t.name, t.description, t.input_type AS inputType, t.output_type AS outputType, t.code, t.file_regex AS fileRegex FROM ${NORTH_TRANSFORMERS_TABLE} nt
        JOIN ${TRANSFORMERS_TABLE} t ON nt.transformer_id = t.id
        WHERE nt.north_id = ?;`
    );
    expect(all).toHaveBeenCalledWith(northId);
    expect(result).toEqual(transformers);
  });

  it('should return all available transformers for a north connector with filters', () => {
    const northId = 'northId';
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
    result = repository.getTransformers(northId, { inputType: 'input' });
    expect(database.prepare).toHaveBeenCalledWith(
      `SELECT t.id, t.name, t.description, t.input_type AS inputType, t.output_type AS outputType, t.code, t.file_regex AS fileRegex FROM ${NORTH_TRANSFORMERS_TABLE} nt
      JOIN ${TRANSFORMERS_TABLE} t ON nt.transformer_id = t.id WHERE nt.north_id = ? AND t.input_type = ?;`
    );
    expect(all).toHaveBeenCalledWith(northId, 'input');
    expect(result).toEqual(transformers);

    // outputType
    result = repository.getTransformers(northId, { outputType: 'output' });
    expect(database.prepare).toHaveBeenCalledWith(
      `SELECT t.id, t.name, t.description, t.input_type AS inputType, t.output_type AS outputType, t.code, t.file_regex AS fileRegex FROM ${NORTH_TRANSFORMERS_TABLE} nt
      JOIN ${TRANSFORMERS_TABLE} t ON nt.transformer_id = t.id WHERE nt.north_id = ? AND t.output_type = ?;`
    );
    expect(all).toHaveBeenCalledWith(northId, 'output');
    expect(result).toEqual(transformers);

    // name
    result = repository.getTransformers(northId, { name: 'name' });
    expect(database.prepare).toHaveBeenCalledWith(
      `SELECT t.id, t.name, t.description, t.input_type AS inputType, t.output_type AS outputType, t.code, t.file_regex AS fileRegex FROM ${NORTH_TRANSFORMERS_TABLE} nt
      JOIN ${TRANSFORMERS_TABLE} t ON nt.transformer_id = t.id WHERE nt.north_id = ? AND t.name LIKE '%' || ? || '%';`
    );
    expect(all).toHaveBeenCalledWith(northId, 'name');
    expect(result).toEqual(transformers);

    // empty filter
    result = repository.getTransformers(northId, {});
    expect(database.prepare).toHaveBeenCalledWith(
      `SELECT t.id, t.name, t.description, t.input_type AS inputType, t.output_type AS outputType, t.code, t.file_regex AS fileRegex FROM ${NORTH_TRANSFORMERS_TABLE} nt
      JOIN ${TRANSFORMERS_TABLE} t ON nt.transformer_id = t.id WHERE nt.north_id = ?;`
    );
    expect(all).toHaveBeenCalledWith(northId);
    expect(result).toEqual(transformers);

    // multiple filters
    result = repository.getTransformers(northId, { inputType: 'input', outputType: 'output', name: 'name' });
    expect(database.prepare).toHaveBeenCalledWith(
      `SELECT t.id, t.name, t.description, t.input_type AS inputType, t.output_type AS outputType, t.code, t.file_regex AS fileRegex FROM ${NORTH_TRANSFORMERS_TABLE} nt
      JOIN ${TRANSFORMERS_TABLE} t ON nt.transformer_id = t.id WHERE nt.north_id = ? AND t.input_type = ? AND t.output_type = ? AND t.name LIKE '%' || ? || '%';`
    );
    expect(all).toHaveBeenCalledWith(northId, 'input', 'output', 'name');
    expect(result).toEqual(transformers);
  });

  it('should remove a transformer from the list of available transformers for a north connector', () => {
    const northId = 'northId';
    const transformerId = 'transformerId';

    repository.removeTransformer(northId, transformerId);

    expect(database.prepare).toHaveBeenCalledWith(`DELETE FROM ${NORTH_TRANSFORMERS_TABLE} WHERE north_id = ? AND transformer_id = ?`);
    expect(run).toHaveBeenCalledWith(northId, transformerId);
  });
});
