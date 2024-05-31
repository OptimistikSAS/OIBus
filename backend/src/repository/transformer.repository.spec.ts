import TransformerRepository, { TRANSFORMERS_TABLE } from '../repository/transformer.repository';
import SqliteDatabaseMock, { run, all, get } from '../tests/__mocks__/database.mock';
import { generateRandomId } from '../service/utils';
import { Database } from 'better-sqlite3';
import { TransformerCommandDTO } from '../../../shared/model/transformer.model';

jest.mock('../tests/__mocks__/database.mock');
jest.mock('../service/utils', () => ({
  generateRandomId: jest.fn(() => '123456')
}));

describe('TransformerRepository', () => {
  let database: Database;
  let repository: TransformerRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    database = new SqliteDatabaseMock();
    database.prepare = jest.fn().mockReturnValue({
      run,
      get,
      all
    });
    repository = new TransformerRepository(database);
  });

  it('should create a new transformer', () => {
    const command: TransformerCommandDTO = {
      name: 'name',
      description: 'description',
      inputType: 'input',
      outputType: 'output',
      code: 'code',
      fileRegex: 'fileRegex'
    };
    const expectedTransformer = {
      id: '123456',
      ...command
    };

    const created = repository.createTransformer(command);
    expect(generateRandomId).toHaveBeenCalledWith(6);
    expect(database.prepare).toHaveBeenCalledWith(
      `INSERT INTO ${TRANSFORMERS_TABLE} (id, name, description, input_type, output_type, code, file_regex) VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    expect(run).toHaveBeenCalledWith('123456', 'name', 'description', 'input', 'output', 'code', 'fileRegex');
    expect(created).toEqual(expectedTransformer);
  });

  it('should update an existing transformer', () => {
    const command: TransformerCommandDTO = {
      name: 'name',
      description: 'description',
      inputType: 'input',
      outputType: 'output',
      code: 'code',
      fileRegex: null
    };

    repository.updateTransformer('123456', command);
    expect(database.prepare).toHaveBeenCalledWith(
      `UPDATE ${TRANSFORMERS_TABLE} SET name = ?, description = ?, input_type = ?, output_type = ?, code = ?, file_regex = ? WHERE id = ?`
    );
    expect(run).toHaveBeenCalledWith('name', 'description', 'input', 'output', 'code', null, '123456');
  });

  it('should delete an existing transformer', () => {
    repository.deleteTransformer('123456');
    expect(database.prepare).toHaveBeenCalledWith(`DELETE FROM ${TRANSFORMERS_TABLE} WHERE id = ?`);
    expect(run).toHaveBeenCalledWith('123456');
  });

  it('should return a transformer by id', () => {
    const transformer = {
      id: '123456',
      name: 'name',
      description: 'description',
      inputType: 'input',
      outputType: 'output',
      code: 'code',
      fileRegex: 'fileRegex'
    };
    get.mockReturnValueOnce(transformer);

    const result = repository.getTransformer('123456');
    expect(database.prepare).toHaveBeenCalledWith(
      `SELECT id, name, description, input_type AS inputType, output_type AS outputType, code, file_regex AS fileRegex FROM ${TRANSFORMERS_TABLE} WHERE id = ?;`
    );
    expect(get).toHaveBeenCalledWith('123456');
    expect(result).toEqual(transformer);
  });

  it('should return null if transformer does not exist', () => {
    get.mockReturnValueOnce(undefined);

    const result = repository.getTransformer('123456');
    expect(database.prepare).toHaveBeenCalledWith(
      `SELECT id, name, description, input_type AS inputType, output_type AS outputType, code, file_regex AS fileRegex FROM ${TRANSFORMERS_TABLE} WHERE id = ?;`
    );
    expect(get).toHaveBeenCalledWith('123456');
    expect(result).toBeNull();
  });

  it('should return all transformers without filters', () => {
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

    const result = repository.getTransformers();
    expect(database.prepare).toHaveBeenCalledWith(
      `SELECT id, name, description, input_type AS inputType, output_type AS outputType, code, file_regex AS fileRegex FROM ${TRANSFORMERS_TABLE};`
    );
    expect(all).toHaveBeenCalled();
    expect(result).toEqual(transformers);
  });

  it('should return transformers with filters', () => {
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
    result = repository.getTransformers({ inputType: 'input' });
    expect(database.prepare).toHaveBeenCalledWith(
      `SELECT id, name, description, input_type AS inputType, output_type AS outputType, code, file_regex AS fileRegex FROM ${TRANSFORMERS_TABLE} WHERE input_type = ?;`
    );
    expect(all).toHaveBeenCalledWith('input');
    expect(result).toEqual(transformers);

    // outputType
    result = repository.getTransformers({ outputType: 'output' });
    expect(database.prepare).toHaveBeenCalledWith(
      `SELECT id, name, description, input_type AS inputType, output_type AS outputType, code, file_regex AS fileRegex FROM ${TRANSFORMERS_TABLE} WHERE output_type = ?;`
    );
    expect(all).toHaveBeenCalledWith('output');
    expect(result).toEqual(transformers);

    // name
    result = repository.getTransformers({ name: 'name' });
    expect(database.prepare).toHaveBeenCalledWith(
      `SELECT id, name, description, input_type AS inputType, output_type AS outputType, code, file_regex AS fileRegex FROM ${TRANSFORMERS_TABLE} WHERE name LIKE '%' || ? || '%';`
    );
    expect(all).toHaveBeenCalledWith('name');
    expect(result).toEqual(transformers);

    // empty filter
    result = repository.getTransformers({});
    expect(database.prepare).toHaveBeenCalledWith(
      `SELECT id, name, description, input_type AS inputType, output_type AS outputType, code, file_regex AS fileRegex FROM ${TRANSFORMERS_TABLE};`
    );
    expect(all).toHaveBeenCalledWith();
    expect(result).toEqual(transformers);

    // multiple filters
    result = repository.getTransformers({ inputType: 'input', outputType: 'output', name: 'name' });
    expect(database.prepare).toHaveBeenCalledWith(
      `SELECT id, name, description, input_type AS inputType, output_type AS outputType, code, file_regex AS fileRegex FROM ${TRANSFORMERS_TABLE} WHERE input_type = ? AND output_type = ? AND name LIKE '%' || ? || '%';`
    );
    expect(all).toHaveBeenCalledWith('input', 'output', 'name');
    expect(result).toEqual(transformers);
  });
});
