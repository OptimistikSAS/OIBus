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
      `INSERT INTO ${TRANSFORMERS_TABLE} (id, input_type, output_type, code, file_regex) VALUES (?, ?, ?, ?, ?)`
    );
    expect(run).toHaveBeenCalledWith('123456', 'input', 'output', 'code', 'fileRegex');
    expect(created).toEqual(expectedTransformer);
  });

  it('should update an existing transformer', () => {
    const command: TransformerCommandDTO = {
      inputType: 'input',
      outputType: 'output',
      code: 'code',
      fileRegex: null
    };

    repository.updateTransformer('123456', command);
    expect(database.prepare).toHaveBeenCalledWith(
      `UPDATE ${TRANSFORMERS_TABLE} SET input_type = ?, output_type = ?, code = ?, file_regex = ? WHERE id = ?`
    );
    expect(run).toHaveBeenCalledWith('input', 'output', 'code', null, '123456');
  });

  it('should delete an existing transformer', () => {
    repository.deleteTransformer('123456');
    expect(database.prepare).toHaveBeenCalledWith(`DELETE FROM ${TRANSFORMERS_TABLE} WHERE id = ?`);
    expect(run).toHaveBeenCalledWith('123456');
  });

  it('should return a transformer by id', () => {
    const transformer = {
      id: '123456',
      inputType: 'input',
      outputType: 'output',
      code: 'code',
      fileRegex: 'fileRegex'
    };
    get.mockReturnValueOnce(transformer);

    const result = repository.getTransformer('123456');
    expect(database.prepare).toHaveBeenCalledWith(
      `SELECT id, input_type AS inputType, output_type AS outputType, code, file_regex AS fileRegex FROM ${TRANSFORMERS_TABLE} WHERE id = ?;`
    );
    expect(get).toHaveBeenCalledWith('123456');
    expect(result).toEqual(transformer);
  });

  it('should return null if transformer does not exist', () => {
    get.mockReturnValueOnce(undefined);

    const result = repository.getTransformer('123456');
    expect(database.prepare).toHaveBeenCalledWith(
      `SELECT id, input_type AS inputType, output_type AS outputType, code, file_regex AS fileRegex FROM ${TRANSFORMERS_TABLE} WHERE id = ?;`
    );
    expect(get).toHaveBeenCalledWith('123456');
    expect(result).toBeNull();
  });

  it('should return all transformers', () => {
    const transformers = [
      {
        id: '123456',
        inputType: 'input',
        outputType: 'output',
        code: 'code',
        fileRegex: 'fileRegex'
      },
      {
        id: '789012',
        inputType: 'input',
        outputType: 'output',
        code: 'code',
        fileRegex: null
      }
    ];
    all.mockReturnValueOnce(transformers);

    const result = repository.getTransformers();
    expect(database.prepare).toHaveBeenCalledWith(
      `SELECT id, input_type AS inputType, output_type AS outputType, code, file_regex AS fileRegex FROM ${TRANSFORMERS_TABLE};`
    );
    expect(all).toHaveBeenCalled();
    expect(result).toEqual(transformers);
  });
});
