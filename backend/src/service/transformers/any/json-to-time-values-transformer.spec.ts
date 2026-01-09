import { Readable } from 'stream';
import pino from 'pino';
import PinoLogger from '../../../tests/__mocks__/service/logger/logger.mock';
import testData from '../../../tests/utils/test-data';
import { flushPromises } from '../../../tests/utils/test-utils';
import JSONToTimeValuesTransformer from './json-to-time-values-transformer';

// 1. Mock External Utilities
// We mock the utils to ensure deterministic results (IDs, timestamps, path injection)
jest.mock('../../utils', () => ({
  convertDateTimeToInstant: jest.fn().mockReturnValue(1698400000000), // Return fixed timestamp
  generateRandomId: jest.fn().mockReturnValue('fixed-random-id'),
  injectIndices: jest.fn().mockImplementation((path: string, indices: Array<number>) => {
    // Simple mock to replicate injectIndices: replaces [*] with [0], [1], etc.
    let pointer = 0;
    return path.replace(/\[\*\]/g, () => `[${indices[pointer++]}]`);
  }),
  sanitizeFilename: jest.fn().mockImplementation(name => name)
}));

const logger: pino.Logger = new PinoLogger();

describe('JSONToTimeValuesTransformer', () => {
  let transformer: JSONToTimeValuesTransformer;
  let mockStream: Readable;

  const defaultOptions = {
    regex: '.*\\.json',
    filename: 'output-file',
    rowIteratorPath: '$[*]', // Iterates over root array
    pointIdPath: '$[*].id',
    timestampPath: '$[*].ts',
    valuePath: '$[*].val',
    timestampSettings: {
      type: 'iso-string',
      timezone: 'UTC',
      format: 'yyyy-MM-dd',
      locale: 'en'
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockStream = new Readable();
    // Initialize transformer with valid defaults
    transformer = new JSONToTimeValuesTransformer(logger, testData.transformers.list[0], testData.north.list[0], defaultOptions);
  });

  it('should successfully transform valid JSON into OIBusTimeValues', async () => {
    // Arrange
    const inputData = [
      { id: 'point-A', ts: '2023-01-01', val: 100 },
      { id: 'point-B', ts: '2023-01-02', val: 200 }
    ];
    const filename = 'data.json';

    // Act
    const promise = transformer.transform(mockStream, { source: 'test' }, filename);
    mockStream.push(JSON.stringify(inputData));
    mockStream.push(null); // End stream

    await flushPromises();
    const result = await promise;

    // Assert
    expect(JSON.parse(result.output)).toHaveLength(2);
    expect(result.output).toContain('"pointId":"point-A"');
    expect(result.output).toContain('"pointId":"point-B"');
    expect(result.metadata).toEqual({
      contentFile: 'fixed-random-id.json', // From mocked generateRandomId
      contentSize: 0,
      createdAt: '',
      numberOfElement: 2,
      contentType: 'time-values'
    });
  });

  it('should skip rows where required fields (pointId, timestamp, value) are missing', async () => {
    // Arrange: Create data with holes to test the validation logic
    const inputData = [
      { id: 'valid', ts: '2023-01-01', val: 1 }, // Keep
      { id: null, ts: '2023-01-01', val: 2 }, // Skip (no ID)
      { id: 'no-ts', ts: null, val: 3 }, // Skip (no TS)
      { id: 'no-val', ts: '2023-01-01', val: undefined }, // Skip (no Value)
      { id: 'valid-2', ts: '2023-01-01', val: 0 } // Keep (0 is a valid value)
    ];

    const promise = transformer.transform(mockStream, { source: 'test' }, 'data.json');
    mockStream.push(JSON.stringify(inputData));
    mockStream.push(null);

    await flushPromises();
    const result = await promise;
    const output = JSON.parse(result.output);

    // Assert
    expect(output).toHaveLength(2);
    expect(output[0].pointId).toBe('valid');
    expect(output[1].pointId).toBe('valid-2');
  });

  it('should return empty result if input JSON is malformed (Parse Error)', async () => {
    // Arrange
    const promise = transformer.transform(mockStream, { source: 'test' }, 'data.json');

    // Act: Push invalid JSON string
    mockStream.push('{ "incomplete": ');
    mockStream.push(null);

    await flushPromises();
    const result = await promise;

    // Assert
    expect(result.output).toBe('[]');
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Failed to parse JSON content'));
    expect(result.metadata.numberOfElement).toBe(0);
  });

  it('should correctly expose the manifest settings', () => {
    // Act
    const manifest = JSONToTimeValuesTransformer.manifestSettings;

    // Assert
    expect(manifest).toBeDefined();
    expect(manifest.type).toBe('object');
    expect(manifest.key).toBe('options');
    // Sanity check on deep property
    expect(manifest.attributes[0].key).toBe('rowIteratorPath');
  });

  it('should handle nested arrays by correctly injecting indices', async () => {
    // This specifically tests the indexRegex loop and injection logic
    // We simulate a structure like: { groups: [ { items: [ { id: ... } ] } ] }
    const nestedOptions = {
      regex: '.*',
      filename: 'nested',
      rowIteratorPath: '$.groups[*].items[*]', // Two levels of nesting
      pointIdPath: '$.groups[*].items[*].id',
      timestampPath: '$.groups[*].items[*].ts',
      valuePath: '$.groups[*].items[*].val',
      timestampSettings: defaultOptions.timestampSettings
    };

    transformer = new JSONToTimeValuesTransformer(logger, testData.transformers.list[0], testData.north.list[0], nestedOptions);

    const inputData = {
      groups: [
        {
          items: [{ id: 'nested-1', ts: '2023', val: 10 }]
        }
      ]
    };

    const promise = transformer.transform(mockStream, { source: 'test' }, 'nested.json');
    mockStream.push(JSON.stringify(inputData));
    mockStream.push(null);

    await flushPromises();
    const result = await promise;
    const output = JSON.parse(result.output);

    expect(output).toHaveLength(1);
    expect(output[0].pointId).toBe('nested-1');
  });
});
