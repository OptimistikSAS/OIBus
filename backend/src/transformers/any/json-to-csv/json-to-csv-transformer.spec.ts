import { Readable } from 'stream';
import pino from 'pino';
import PinoLogger from '../../../tests/__mocks__/service/logger/logger.mock';
import testData from '../../../tests/utils/test-data';
import { flushPromises } from '../../../tests/utils/test-utils';
import JSONToCSVTransformer from './json-to-csv-transformer';
import csv from 'papaparse';
import jsonToCsvManifest from './manifest';

// Mock external modules
jest.mock('papaparse');
jest.mock('../../../service/utils', () => ({
  convertDateTime: jest.fn().mockImplementation(value => value),
  convertDelimiter: jest.fn().mockReturnValue(';'),
  convertQuoteChar: jest.fn().mockReturnValue('"'),
  convertEscapeChar: jest.fn().mockReturnValue('"'),
  convertNewline: jest.fn().mockReturnValue(''),
  injectIndices: jest.fn().mockImplementation((path: string, indices: Array<number>) => {
    let pointer = 0;
    return path.replace(/\[\*\]/g, () => `[${indices[pointer++]}]`);
  }),
  sanitizeFilename: jest.fn().mockImplementation(name => name),
  stringToBoolean: jest.fn().mockReturnValue(true)
}));

const logger: pino.Logger = new PinoLogger();

describe('JSONToCSVTransformer', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should transform data from a stream and return metadata when regex matches', async () => {
    (csv.unparse as jest.Mock).mockReturnValue('csv content');

    const options = {
      regex: '.*\\.json',
      filename: 'test-output.csv',
      delimiter: 'SEMI_COLON',
      encoding: 'UTF_8',
      quoteChar: 'DOUBLE_QUOTE',
      escapeChar: 'DOUBLE_QUOTE',
      newline: 'DEFAULT',
      nullValue: '',
      header: true,
      rowIteratorPath: '$[*]',
      fields: [
        {
          jsonPath: '$[*].name',
          columnName: 'Name',
          dataType: 'string'
        },
        {
          jsonPath: '$[*].id',
          columnName: 'ID',
          dataType: 'number'
        }
      ]
    };

    // Arrange
    const transformer = new JSONToCSVTransformer(logger, testData.transformers.list[0], options);
    const filename = 'input.json';

    // Mock input data matching the structure expected by jsonpath
    const inputData = [
      { name: 'Item 1', id: 1 },
      { name: 'Item 2', id: 2 }
    ];

    // Mock Readable stream
    const mockStream = new Readable();

    // Act
    const promise = transformer.transform(mockStream, { source: 'test' }, filename);
    mockStream.push(JSON.stringify(inputData));
    mockStream.push(null); // End the stream

    await flushPromises();
    const result = await promise;

    // Assert
    // 1. Check if csv.unparse was called with correct flattened data
    expect(csv.unparse).toHaveBeenCalledWith(
      [
        { Name: 'Item 1', ID: 1 },
        { Name: 'Item 2', ID: 2 }
      ],
      expect.objectContaining({ delimiter: ';' })
    );

    // 2. Check final return structure
    expect(result.output).toBeInstanceOf(Buffer);
    expect((result.output as Buffer).toString('utf-8')).toBe('csv content');
    expect(result.metadata).toEqual({
      contentFile: 'test-output.csv',
      contentSize: 0,
      createdAt: '',
      numberOfElement: 0,
      contentType: 'any'
    });
  });

  it('should handle complex data types (datetime, boolean, object, array) and missing values', async () => {
    // 1. Setup specific options with ALL data types found in the switch statement
    const options = {
      regex: '.*\\.json',
      filename: 'complex-test',
      delimiter: 'SEMI_COLON',
      encoding: 'UTF_8',
      quoteChar: 'DOUBLE_QUOTE',
      escapeChar: 'DOUBLE_QUOTE',
      newline: 'DEFAULT',
      nullValue: 'N/A',
      header: true,
      rowIteratorPath: '$[*]',
      fields: [
        {
          jsonPath: '$[*].createdAt',
          columnName: 'Created At',
          dataType: 'datetime',
          datetimeSettings: { type: 'iso-string', timezone: 'UTC', format: 'yyyy', locale: 'en' }
        },
        {
          jsonPath: '$[*].isActive',
          columnName: 'Active',
          dataType: 'boolean'
        },
        {
          jsonPath: '$[*].details',
          columnName: 'Details',
          dataType: 'object' // Hits the default/object case
        },
        {
          jsonPath: '$[*].tags',
          columnName: 'Tags',
          dataType: 'array' // Hits the default/array case
        },
        {
          jsonPath: '$[*].ghostField',
          columnName: 'Ghost',
          dataType: 'string' // Intentionally missing in data to hit the null check
        }
      ]
    };

    // 2. Mock Input Data
    const inputData = [
      {
        createdAt: '2023-10-27T10:00:00Z',
        isActive: 'yes', // Your mock stringToBoolean returns true
        details: { user: 'admin', rights: [1, 2] },
        tags: ['urgent', 'work']
        // ghostField is undefined
      }
    ];

    // 3. Initialize Transformer
    const transformer = new JSONToCSVTransformer(logger, testData.transformers.list[0], options);
    const mockStream = new Readable();
    (csv.unparse as jest.Mock).mockReturnValue('csv result');

    // 4. Execute
    const promise = transformer.transform(mockStream, { source: 'test' }, 'data.json');
    mockStream.push(JSON.stringify(inputData));
    mockStream.push(null);

    await flushPromises();
    await promise;

    // 5. Assertions
    // This expects object matches exactly what the switch statement logic produces
    expect(csv.unparse).toHaveBeenCalledWith(
      [
        {
          'Created At': '2023-10-27T10:00:00Z', // Mapped via datetime case (mock passes through)
          Active: 'true', // Mapped via boolean case (mock returns true -> .toString())
          Details: '{"user":"admin","rights":[1,2]}', // Mapped via object case (JSON.stringify)
          Tags: '["urgent","work"]', // Mapped via array case (JSON.stringify)
          Ghost: 'N/A' // Mapped via undefined/null check — uses nullValue setting
        }
      ],
      expect.objectContaining({ delimiter: ';' })
    );
  });

  it('should pass quoteChar, escapeChar, newline and nullValue to csv.unparse', async () => {
    const { convertQuoteChar, convertEscapeChar, convertNewline } = jest.requireMock('../../../service/utils');
    (convertQuoteChar as jest.Mock).mockReturnValue("'");
    (convertEscapeChar as jest.Mock).mockReturnValue('\\');
    (convertNewline as jest.Mock).mockReturnValue('\r\n');
    (csv.unparse as jest.Mock).mockReturnValue('csv result');

    const options = {
      filename: 'output.csv',
      delimiter: 'SEMI_COLON',
      encoding: 'UTF_8',
      quoteChar: 'SINGLE_QUOTE',
      escapeChar: 'BACKSLASH',
      newline: 'CRLF',
      nullValue: 'NULL',
      header: true,
      rowIteratorPath: '$[*]',
      fields: [{ jsonPath: '$[*].missing', columnName: 'Col', dataType: 'string' }]
    };

    const transformer = new JSONToCSVTransformer(logger, testData.transformers.list[0], options);
    const mockStream = new Readable();
    const promise = transformer.transform(mockStream, { source: 'test' }, 'data.json');
    mockStream.push(JSON.stringify([{}]));
    mockStream.push(null);
    await flushPromises();
    await promise;

    expect(csv.unparse).toHaveBeenCalledWith(
      [{ Col: 'NULL' }],
      expect.objectContaining({
        quoteChar: "'",
        escapeChar: '\\',
        newline: '\r\n',
        quotes: true
      })
    );
  });

  it('should disable quoting when quoteChar is NONE', async () => {
    const { convertQuoteChar } = jest.requireMock('../../../service/utils');
    (convertQuoteChar as jest.Mock).mockReturnValue('');
    (csv.unparse as jest.Mock).mockReturnValue('csv result');

    const options = {
      filename: 'output.csv',
      delimiter: 'SEMI_COLON',
      encoding: 'UTF_8',
      quoteChar: 'NONE',
      escapeChar: 'DOUBLE_QUOTE',
      newline: 'DEFAULT',
      nullValue: '',
      header: true,
      rowIteratorPath: '$[*]',
      fields: [{ jsonPath: '$[*].name', columnName: 'Name', dataType: 'string' }]
    };

    const transformer = new JSONToCSVTransformer(logger, testData.transformers.list[0], options);
    const mockStream = new Readable();
    const promise = transformer.transform(mockStream, { source: 'test' }, 'data.json');
    mockStream.push(JSON.stringify([{ name: 'test' }]));
    mockStream.push(null);
    await flushPromises();
    await promise;

    expect(csv.unparse).toHaveBeenCalledWith([{ Name: 'test' }], expect.objectContaining({ quotes: false }));
  });

  it('should omit header row when header is false', async () => {
    (csv.unparse as jest.Mock).mockReturnValue('csv result');

    const options = {
      filename: 'output.csv',
      delimiter: 'SEMI_COLON',
      quoteChar: 'DOUBLE_QUOTE',
      escapeChar: 'DOUBLE_QUOTE',
      newline: 'DEFAULT',
      nullValue: '',
      header: false,
      rowIteratorPath: '$[*]',
      fields: [{ jsonPath: '$[*].name', columnName: 'Name', dataType: 'string' }]
    };

    const transformer = new JSONToCSVTransformer(logger, testData.transformers.list[0], options);
    const mockStream = new Readable();
    const promise = transformer.transform(mockStream, { source: 'test' }, 'data.json');
    mockStream.push(JSON.stringify([{ name: 'test' }]));
    mockStream.push(null);
    await flushPromises();
    await promise;

    expect(csv.unparse).toHaveBeenCalledWith([{ Name: 'test' }], expect.objectContaining({ header: false }));
  });

  it('should prepend UTF-8 BOM when encoding is UTF_8_BOM', async () => {
    (csv.unparse as jest.Mock).mockReturnValue('csv content');

    const options = {
      filename: 'output.csv',
      delimiter: 'SEMI_COLON',
      encoding: 'UTF_8_BOM',
      quoteChar: 'DOUBLE_QUOTE',
      escapeChar: 'DOUBLE_QUOTE',
      newline: 'DEFAULT',
      nullValue: '',
      header: true,
      rowIteratorPath: '$[*]',
      fields: [{ jsonPath: '$[*].name', columnName: 'Name', dataType: 'string' }]
    };

    const transformer = new JSONToCSVTransformer(logger, testData.transformers.list[0], options);
    const mockStream = new Readable();
    const promise = transformer.transform(mockStream, { source: 'test' }, 'data.json');
    mockStream.push(JSON.stringify([{ name: 'test' }]));
    mockStream.push(null);
    await flushPromises();
    const result = await promise;

    expect(result.output).toBeInstanceOf(Buffer);
    const buf = result.output as Buffer;
    expect(buf[0]).toBe(0xef);
    expect(buf[1]).toBe(0xbb);
    expect(buf[2]).toBe(0xbf);
    expect(buf.slice(3).toString('utf-8')).toBe('csv content');
  });

  it('should not prepend BOM when encoding is UTF_8', async () => {
    (csv.unparse as jest.Mock).mockReturnValue('csv content');

    const options = {
      filename: 'output.csv',
      delimiter: 'SEMI_COLON',
      encoding: 'UTF_8',
      quoteChar: 'DOUBLE_QUOTE',
      escapeChar: 'DOUBLE_QUOTE',
      newline: 'DEFAULT',
      nullValue: '',
      header: true,
      rowIteratorPath: '$[*]',
      fields: [{ jsonPath: '$[*].name', columnName: 'Name', dataType: 'string' }]
    };

    const transformer = new JSONToCSVTransformer(logger, testData.transformers.list[0], options);
    const mockStream = new Readable();
    const promise = transformer.transform(mockStream, { source: 'test' }, 'data.json');
    mockStream.push(JSON.stringify([{ name: 'test' }]));
    mockStream.push(null);
    await flushPromises();
    const result = await promise;

    expect(result.output).toBeInstanceOf(Buffer);
    expect((result.output as Buffer).toString('utf-8')).toBe('csv content');
  });

  it('should parse JSON-stringified intermediate nodes when traversing a path', async () => {
    const options = {
      filename: 'output.csv',
      delimiter: 'SEMI_COLON',
      encoding: 'UTF_8',
      quoteChar: 'DOUBLE_QUOTE',
      escapeChar: 'DOUBLE_QUOTE',
      newline: 'DEFAULT',
      nullValue: '',
      header: true,
      rowIteratorPath: '$[*].timestamp',
      fields: [
        { jsonPath: '$[*].data.value', columnName: 'article', dataType: 'string' },
        { jsonPath: '$[*].data.articleName', columnName: 'articleName', dataType: 'string' },
        { jsonPath: '$[*].data.diameters[0].value', columnName: 'diameter_1', dataType: 'string' },
        { jsonPath: '$[*].data.temperatures[0]', columnName: 'temperature', dataType: 'string' },
        { jsonPath: '$[*].data.plainString', columnName: 'plain', dataType: 'string' }
      ]
    };

    // 'data' is a JSON-stringified object; 'plainString' is a regular string that must stay as-is
    const inputData = [
      {
        timestamp: '2026-04-28T10:30:00.000Z',
        data: JSON.stringify({
          value: 'A-12345',
          articleName: 'Flacon 500ml',
          diameters: [{ value: 24.8 }, { value: 24.9 }],
          temperatures: [1205, 1198],
          plainString: 'keep-me'
        })
      }
    ];

    const transformer = new JSONToCSVTransformer(logger, testData.transformers.list[0], options);
    const mockStream = new Readable();
    (csv.unparse as jest.Mock).mockReturnValue('csv result');

    const promise = transformer.transform(mockStream, { source: 'test' }, 'data.json');
    mockStream.push(JSON.stringify(inputData));
    mockStream.push(null);

    await flushPromises();
    await promise;

    expect(csv.unparse).toHaveBeenCalledWith(
      [
        {
          article: 'A-12345',
          articleName: 'Flacon 500ml',
          diameter_1: '24.8',
          temperature: '1205',
          plain: 'keep-me'
        }
      ],
      expect.objectContaining({ delimiter: ';' })
    );
  });

  it('should encode output as Latin-1 Buffer when encoding is LATIN_1', async () => {
    (csv.unparse as jest.Mock).mockReturnValue('csv content');

    const options = {
      filename: 'output.csv',
      delimiter: 'SEMI_COLON',
      encoding: 'LATIN_1',
      quoteChar: 'DOUBLE_QUOTE',
      escapeChar: 'DOUBLE_QUOTE',
      newline: 'DEFAULT',
      nullValue: '',
      header: true,
      rowIteratorPath: '$[*]',
      fields: [{ jsonPath: '$[*].name', columnName: 'Name', dataType: 'string' }]
    };

    const transformer = new JSONToCSVTransformer(logger, testData.transformers.list[0], options);
    const mockStream = new Readable();
    const promise = transformer.transform(mockStream, { source: 'test' }, 'data.json');
    mockStream.push(JSON.stringify([{ name: 'test' }]));
    mockStream.push(null);
    await flushPromises();
    const result = await promise;

    expect(result.output).toBeInstanceOf(Buffer);
    expect((result.output as Buffer).toString('latin1')).toBe('csv content');
  });

  it('should encode output as UTF-16 LE Buffer with BOM when encoding is UTF_16_LE', async () => {
    (csv.unparse as jest.Mock).mockReturnValue('csv content');

    const options = {
      filename: 'output.csv',
      delimiter: 'SEMI_COLON',
      encoding: 'UTF_16_LE',
      quoteChar: 'DOUBLE_QUOTE',
      escapeChar: 'DOUBLE_QUOTE',
      newline: 'DEFAULT',
      nullValue: '',
      header: true,
      rowIteratorPath: '$[*]',
      fields: [{ jsonPath: '$[*].name', columnName: 'Name', dataType: 'string' }]
    };

    const transformer = new JSONToCSVTransformer(logger, testData.transformers.list[0], options);
    const mockStream = new Readable();
    const promise = transformer.transform(mockStream, { source: 'test' }, 'data.json');
    mockStream.push(JSON.stringify([{ name: 'test' }]));
    mockStream.push(null);
    await flushPromises();
    const result = await promise;

    expect(result.output).toBeInstanceOf(Buffer);
    const buf = result.output as Buffer;
    expect(buf[0]).toBe(0xff);
    expect(buf[1]).toBe(0xfe);
    expect(buf.slice(2).toString('utf16le')).toBe('csv content');
  });

  it('should return correct manifest settings', () => {
    expect(jsonToCsvManifest.settings.key).toBe('options');
    expect(jsonToCsvManifest.settings.attributes[0].key).toBe('filename');
  });

  describe('fieldProcess', () => {
    it('should apply fieldProcess expression to the typed value before writing to CSV', async () => {
      (csv.unparse as jest.Mock).mockReturnValue('csv result');

      const options = {
        filename: 'output.csv',
        delimiter: 'SEMI_COLON',
        encoding: 'UTF_8',
        quoteChar: 'NONE',
        escapeChar: 'DOUBLE_QUOTE',
        newline: 'DEFAULT',
        nullValue: '',
        header: true,
        rowIteratorPath: '$[*]',
        fields: [
          { jsonPath: '$[*].name', columnName: 'Name', dataType: 'string', fieldProcess: 'value.toUpperCase()' },
          { jsonPath: '$[*].score', columnName: 'Score', dataType: 'number', fieldProcess: 'Math.round(value * 100) / 100' },
          { jsonPath: '$[*].tag', columnName: 'Tag', dataType: 'string', fieldProcess: null }
        ]
      };

      const transformer = new JSONToCSVTransformer(logger, testData.transformers.list[0], options);
      const mockStream = new Readable();
      const promise = transformer.transform(mockStream, { source: 'test' }, 'data.json');
      mockStream.push(JSON.stringify([{ name: 'hello', score: 3.14159, tag: 'keep-me' }]));
      mockStream.push(null);
      await flushPromises();
      await promise;

      expect(csv.unparse).toHaveBeenCalledWith(
        [{ Name: 'HELLO', Score: 3.14, Tag: 'keep-me' }],
        expect.objectContaining({ delimiter: ';' })
      );
    });

    it('should skip fieldProcess when it is null or empty', async () => {
      (csv.unparse as jest.Mock).mockReturnValue('csv result');

      const options = {
        filename: 'output.csv',
        delimiter: 'SEMI_COLON',
        encoding: 'UTF_8',
        quoteChar: 'NONE',
        escapeChar: 'DOUBLE_QUOTE',
        newline: 'DEFAULT',
        nullValue: '',
        header: true,
        rowIteratorPath: '$[*]',
        fields: [
          { jsonPath: '$[*].name', columnName: 'Name', dataType: 'string', fieldProcess: '' },
          { jsonPath: '$[*].id', columnName: 'ID', dataType: 'number', fieldProcess: '   ' }
        ]
      };

      const transformer = new JSONToCSVTransformer(logger, testData.transformers.list[0], options);
      const mockStream = new Readable();
      const promise = transformer.transform(mockStream, { source: 'test' }, 'data.json');
      mockStream.push(JSON.stringify([{ name: 'original', id: 42 }]));
      mockStream.push(null);
      await flushPromises();
      await promise;

      expect(csv.unparse).toHaveBeenCalledWith([{ Name: 'original', ID: 42 }], expect.objectContaining({ delimiter: ';' }));
    });

    it('should throw a descriptive error when fieldProcess expression is invalid', async () => {
      const options = {
        filename: 'output.csv',
        delimiter: 'SEMI_COLON',
        encoding: 'UTF_8',
        quoteChar: 'NONE',
        escapeChar: 'DOUBLE_QUOTE',
        newline: 'DEFAULT',
        nullValue: '',
        header: true,
        rowIteratorPath: '$[*]',
        fields: [{ jsonPath: '$[*].name', columnName: 'Name', dataType: 'string', fieldProcess: 'value.nonExistentMethod()' }]
      };

      const transformer = new JSONToCSVTransformer(logger, testData.transformers.list[0], options);
      const mockStream = new Readable();
      const promise = transformer.transform(mockStream, { source: 'test' }, 'data.json');
      // Attach the rejection handler BEFORE pushing data so the rejection is never "unhandled".
      const rejectionCheck = expect(promise).rejects.toThrow('Field process evaluation failed');
      mockStream.push(JSON.stringify([{ name: 'hello' }]));
      mockStream.push(null);
      await flushPromises();
      await rejectionCheck;
    });

    it('should expose fieldProcess attribute in the manifest', () => {
      const fieldItem = jsonToCsvManifest.settings.attributes.find(a => a.key === 'fields');
      expect(fieldItem).toBeDefined();
      expect(fieldItem!.type).toBe('array');
      if (fieldItem!.type === 'array') {
        const fieldProcessAttr = fieldItem!.rootAttribute.attributes.find(a => a.key === 'fieldProcess');
        expect(fieldProcessAttr).toBeDefined();
        expect(fieldProcessAttr!.type).toBe('string');
        expect(fieldProcessAttr!.validators).toHaveLength(0);
      }
    });
  });
});
