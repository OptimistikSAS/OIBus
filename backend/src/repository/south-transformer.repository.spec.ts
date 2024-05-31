import SouthTransformerRepository, { SOUTH_TRANSFORMERS_TABLE } from '../repository/south-transformer.repository';
import { TRANSFORMERS_TABLE } from '../repository/transformer.repository';
import SqliteDatabaseMock, { run, all, get } from '../tests/__mocks__/database.mock';
import { Database } from 'better-sqlite3';

jest.mock('../tests/__mocks__/database.mock');
jest.mock('../service/utils', () => ({
  generateRandomId: jest.fn(() => '123456')
}));

describe('SouthTransformerRepository', () => {
  let database: Database;
  let repository: SouthTransformerRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    database = new SqliteDatabaseMock();
    database.prepare = jest.fn().mockReturnValue({
      run,
      get,
      all
    });
    repository = new SouthTransformerRepository(database);
  });

  it('should add a transformer to the list of available transformers for a south connector', () => {
    const southId = 'southId';
    const transformerId = 'transformerId';

    repository.addTransformer(southId, transformerId);

    expect(database.prepare).toHaveBeenCalledWith(`INSERT INTO ${SOUTH_TRANSFORMERS_TABLE} (south_id, transformer_id) VALUES (?, ?)`);
    expect(run).toHaveBeenCalledWith(southId, transformerId);
  });

  it('should return all available transformers for a south connector without filters', () => {
    const southId = 'southId';
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

    const result = repository.getTransformers(southId);
    expect(database.prepare).toHaveBeenCalledWith(
      `SELECT t.id, t.name, t.description, t.input_type AS inputType, t.output_type AS outputType, t.code, t.file_regex AS fileRegex FROM ${SOUTH_TRANSFORMERS_TABLE} st
        JOIN ${TRANSFORMERS_TABLE} t ON st.transformer_id = t.id
        WHERE st.south_id = ?;`
    );
    expect(all).toHaveBeenCalledWith(southId);
    expect(result).toEqual(transformers);
  });

  it('should return all available transformers for a south connector with filters', () => {
    const southId = 'southId';
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
    result = repository.getTransformers(southId, { inputType: 'input' });
    expect(database.prepare).toHaveBeenCalledWith(
      `SELECT t.id, t.name, t.description, t.input_type AS inputType, t.output_type AS outputType, t.code, t.file_regex AS fileRegex FROM ${SOUTH_TRANSFORMERS_TABLE} st
      JOIN ${TRANSFORMERS_TABLE} t ON st.transformer_id = t.id WHERE st.south_id = ? AND t.input_type = ?;`
    );
    expect(all).toHaveBeenCalledWith(southId, 'input');
    expect(result).toEqual(transformers);

    // outputType
    result = repository.getTransformers(southId, { outputType: 'output' });
    expect(database.prepare).toHaveBeenCalledWith(
      `SELECT t.id, t.name, t.description, t.input_type AS inputType, t.output_type AS outputType, t.code, t.file_regex AS fileRegex FROM ${SOUTH_TRANSFORMERS_TABLE} st
      JOIN ${TRANSFORMERS_TABLE} t ON st.transformer_id = t.id WHERE st.south_id = ? AND t.output_type = ?;`
    );
    expect(all).toHaveBeenCalledWith(southId, 'output');
    expect(result).toEqual(transformers);

    // name
    result = repository.getTransformers(southId, { name: 'name' });
    expect(database.prepare).toHaveBeenCalledWith(
      `SELECT t.id, t.name, t.description, t.input_type AS inputType, t.output_type AS outputType, t.code, t.file_regex AS fileRegex FROM ${SOUTH_TRANSFORMERS_TABLE} st
      JOIN ${TRANSFORMERS_TABLE} t ON st.transformer_id = t.id WHERE st.south_id = ? AND t.name LIKE '%' || ? || '%';`
    );
    expect(all).toHaveBeenCalledWith(southId, 'name');
    expect(result).toEqual(transformers);

    // empty filter
    result = repository.getTransformers(southId, {});
    expect(database.prepare).toHaveBeenCalledWith(
      `SELECT t.id, t.name, t.description, t.input_type AS inputType, t.output_type AS outputType, t.code, t.file_regex AS fileRegex FROM ${SOUTH_TRANSFORMERS_TABLE} st
      JOIN ${TRANSFORMERS_TABLE} t ON st.transformer_id = t.id WHERE st.south_id = ?;`
    );
    expect(all).toHaveBeenCalledWith(southId);
    expect(result).toEqual(transformers);

    // multiple filters
    result = repository.getTransformers(southId, { inputType: 'input', outputType: 'output', name: 'name' });
    expect(database.prepare).toHaveBeenCalledWith(
      `SELECT t.id, t.name, t.description, t.input_type AS inputType, t.output_type AS outputType, t.code, t.file_regex AS fileRegex FROM ${SOUTH_TRANSFORMERS_TABLE} st
      JOIN ${TRANSFORMERS_TABLE} t ON st.transformer_id = t.id WHERE st.south_id = ? AND t.input_type = ? AND t.output_type = ? AND t.name LIKE '%' || ? || '%';`
    );
    expect(all).toHaveBeenCalledWith(southId, 'input', 'output', 'name');
    expect(result).toEqual(transformers);
  });

  it('should remove a transformer from the list of available transformers for a south connector', () => {
    const southId = 'southId';
    const transformerId = 'transformerId';

    repository.removeTransformer(southId, transformerId);

    expect(database.prepare).toHaveBeenCalledWith(`DELETE FROM ${SOUTH_TRANSFORMERS_TABLE} WHERE south_id = ? AND transformer_id = ?`);
    expect(run).toHaveBeenCalledWith(southId, transformerId);
  });
});
