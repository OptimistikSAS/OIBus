import { Readable } from 'stream';
import pino from 'pino';
import PinoLogger from '../../../tests/__mocks__/service/logger/logger.mock';
import testData from '../../../tests/utils/test-data';
import { flushPromises } from '../../../tests/utils/test-utils';
import JSONToCSVTransformer from './json-to-csv-transformer';
import csv from 'papaparse';
import JSONToMQTTTransformer from './json-to-mqtt-transformer';

// Mock external modules
jest.mock('papaparse');
jest.mock('../../utils', () => ({
  convertDateTime: jest.fn().mockImplementation(value => value), // Pass through for testing
  convertDelimiter: jest.fn().mockReturnValue(';'),
  injectIndices: jest.fn().mockImplementation((path: string, indices: Array<number>) => {
    // Simple mock to replicate basic injectIndices behavior for testing
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

  it('should transform data from a stream and return metadata when regex matches', async () => {
    (csv.unparse as jest.Mock).mockReturnValue('csv content');

    const options = {
      regex: '.*\\.json',
      filename: 'test-output.csv',
      delimiter: 'SEMI_COLON',
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
    const transformer = new JSONToCSVTransformer(logger, testData.transformers.list[0], testData.north.list[0], options);
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
    expect(result).toEqual({
      output: 'csv content',
      metadata: {
        contentFile: 'test-output.csv', // sanitizeFilename mocked to return input
        contentSize: 0,
        createdAt: '',
        numberOfElement: 0,
        contentType: 'any'
      }
    });
  });

  it('should handle complex data types (datetime, boolean, object, array) and missing values', async () => {
    // 1. Setup specific options with ALL data types found in the switch statement
    const options = {
      regex: '.*\\.json',
      filename: 'complex-test',
      delimiter: 'SEMI_COLON',
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
    const transformer = new JSONToCSVTransformer(logger, testData.transformers.list[0], testData.north.list[0], options);
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
          Ghost: '' // Mapped via undefined/null check
        }
      ],
      expect.objectContaining({ delimiter: ';' })
    );
  });

  it('should return correct manifest settings', () => {
    const manifest = JSONToMQTTTransformer.manifestSettings;
    expect(manifest.key).toBe('options');
    expect(manifest.attributes[0].key).toBe('rowIteratorPath');
  });
});
