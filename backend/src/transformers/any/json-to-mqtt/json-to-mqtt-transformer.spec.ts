import { Readable } from 'stream';
import pino from 'pino';
import PinoLogger from '../../../tests/__mocks__/service/logger/logger.mock'; // Adjust path
import testData from '../../../tests/utils/test-data'; // Adjust path
import { flushPromises } from '../../../tests/utils/test-utils'; // Adjust path
import JSONToMQTTTransformer from './json-to-mqtt-transformer';
import jsonToMqttManifest from './manifest';

// 1. Mock External Utilities
jest.mock('../../../service/utils', () => ({
  convertDateTime: jest.fn().mockImplementation(_val => {
    // Return a mock timestamp for testing.
    // If it's a string date, return fixed epoch. If number, return as is.
    return 1698400000000;
  }),
  generateRandomId: jest.fn().mockReturnValue('fixed-random-id'),
  injectIndices: jest.fn().mockImplementation((path: string, indices: Array<number>) => {
    let pointer = 0;
    return path.replace(/\[\*\]/g, () => `[${indices[pointer++]}]`);
  }),
  sanitizeFilename: jest.fn().mockImplementation(name => name),
  stringToBoolean: jest.fn().mockImplementation(val => val === 'true' || val === true)
}));

const logger: pino.Logger = new PinoLogger();

describe('JSONToMQTTTransformer', () => {
  let transformer: JSONToMQTTTransformer;
  let mockStream: Readable;

  // --- Base Options for Re-use ---
  const baseOptions = {
    regex: '.*\\.json',
    filename: 'mqtt-output',
    rowIteratorPath: '$[*]',
    topicPath: '$[*].topic'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockStream = new Readable();
  });

  // --------------------------------------------------------------------------
  // 1. Object Payload Tests
  // --------------------------------------------------------------------------
  it('should transform data into a custom OBJECT payload', async () => {
    const options = {
      ...baseOptions,
      payloadType: 'object',
      objectFields: [
        { key: 'temp', path: '$[*].t', dataType: 'number' },
        { key: 'active', path: '$[*].a', dataType: 'boolean' },
        {
          key: 'time',
          path: '$[*].ts',
          dataType: 'datetime',
          datetimeSettings: { type: 'iso-string', timezone: 'UTC', format: 'yyyy', locale: 'en' }
        }
      ]
    };

    transformer = new JSONToMQTTTransformer(logger, testData.transformers.list[0], testData.north.list[0], options);

    const inputData = [{ topic: 'device/1', t: 25.5, a: 'true', ts: '2023-01-01' }];

    const promise = transformer.transform(mockStream, { source: 'test' }, 'data.json');
    mockStream.push(JSON.stringify(inputData));
    mockStream.push(null);
    await flushPromises();
    const result = await promise;
    const output = JSON.parse(result.output);

    expect(output).toHaveLength(1);
    expect(output[0].topic).toBe('device/1');

    // Parse the inner JSON payload string to verify object structure
    const payload = JSON.parse(output[0].payload);
    expect(payload).toEqual({
      temp: 25.5,
      active: true, // stringToBoolean mock
      time: 1698400000000 // convertDateTimeToInstant mock
    });
  });

  it('should not transform data into a custom OBJECT payload if payload is empty', async () => {
    const options = {
      ...baseOptions,
      payloadType: 'object',
      objectFields: []
    };

    transformer = new JSONToMQTTTransformer(logger, testData.transformers.list[0], testData.north.list[0], options);

    const inputData = [{ topic: 'device/1', t: 25.5, a: 'true', ts: '2023-01-01' }];

    const promise = transformer.transform(mockStream, { source: 'test' }, 'data.json');
    mockStream.push(JSON.stringify(inputData));
    mockStream.push(null);
    await flushPromises();
    const result = await promise;
    const output = JSON.parse(result.output);

    expect(output).toHaveLength(0);
  });

  // --------------------------------------------------------------------------
  // 2. Simple Payload Tests (String, Number, Boolean, Datetime)
  // --------------------------------------------------------------------------
  it('should transform data into a STRING payload', async () => {
    const options = { ...baseOptions, payloadType: 'string', valuePath: '$[*].val' };
    transformer = new JSONToMQTTTransformer(logger, testData.transformers.list[0], testData.north.list[0], options);

    const inputData = [{ topic: 'topic/s', val: 123 }]; // Number in JSON, but force string

    const promise = transformer.transform(mockStream, { source: 'test' }, 'data.json');
    mockStream.push(JSON.stringify(inputData));
    mockStream.push(null);
    await flushPromises();
    const result = await promise;
    const output = JSON.parse(result.output);

    expect(output[0].payload).toBe('123'); // Should be stringified
  });

  it('should transform data into a NUMBER payload', async () => {
    const options = { ...baseOptions, payloadType: 'number', valuePath: '$[*].val' };
    transformer = new JSONToMQTTTransformer(logger, testData.transformers.list[0], testData.north.list[0], options);

    const inputData = [{ topic: 'topic/n', val: '45.6' }]; // String in JSON, cast to number

    const promise = transformer.transform(mockStream, { source: 'test' }, 'data.json');
    mockStream.push(JSON.stringify(inputData));
    mockStream.push(null);
    await flushPromises();
    const result = await promise;
    const output = JSON.parse(result.output);

    expect(output[0].payload).toBe('45.6'); // Payload is string representation of the number
  });

  it('should transform data into a BOOLEAN payload', async () => {
    const options = { ...baseOptions, payloadType: 'boolean', valuePath: '$[*].val' };
    transformer = new JSONToMQTTTransformer(logger, testData.transformers.list[0], testData.north.list[0], options);

    const inputData = [{ topic: 'topic/b', val: 'true' }];

    const promise = transformer.transform(mockStream, { source: 'test' }, 'data.json');
    mockStream.push(JSON.stringify(inputData));
    mockStream.push(null);
    await flushPromises();
    const result = await promise;
    const output = JSON.parse(result.output);

    expect(output[0].payload).toBe('true');
  });

  it('should transform data into a DATETIME payload', async () => {
    const options = {
      ...baseOptions,
      payloadType: 'datetime',
      valuePath: '$[*].val',
      datetimeSettings: { type: 'iso-string', timezone: 'UTC', format: 'yyyy', locale: 'en' }
    };
    transformer = new JSONToMQTTTransformer(logger, testData.transformers.list[0], testData.north.list[0], options);

    const inputData = [{ topic: 'topic/d', val: '2023-01-01' }];

    const promise = transformer.transform(mockStream, { source: 'test' }, 'data.json');
    mockStream.push(JSON.stringify(inputData));
    mockStream.push(null);
    await flushPromises();
    const result = await promise;
    const output = JSON.parse(result.output);

    // Should return the mocked timestamp as string
    expect(output[0].payload).toBe('1698400000000');
  });

  // --------------------------------------------------------------------------
  // 3. Validation & Edge Cases
  // --------------------------------------------------------------------------
  it('should skip rows where TOPIC is missing', async () => {
    const options = { ...baseOptions, payloadType: 'string', valuePath: '$[*].val' };
    transformer = new JSONToMQTTTransformer(logger, testData.transformers.list[0], testData.north.list[0], options);

    const inputData = [
      { topic: 'valid', val: 'A' },
      { topic: null, val: 'B' }, // Missing topic -> Skip
      { topic: undefined, val: 'C' } // Missing topic -> Skip
    ];

    const promise = transformer.transform(mockStream, { source: 'test' }, 'data.json');
    mockStream.push(JSON.stringify(inputData));
    mockStream.push(null);
    await flushPromises();
    const result = await promise;
    const output = JSON.parse(result.output);

    expect(output).toHaveLength(1);
    expect(output[0].topic).toBe('valid');
  });

  it('should handle complex nested objects when payload is an object', async () => {
    // This hits the `typeof formatted === 'object'` branch in `formatValue` -> defaults
    const options = { ...baseOptions, payloadType: 'string', valuePath: '$[*].val' };
    transformer = new JSONToMQTTTransformer(logger, testData.transformers.list[0], testData.north.list[0], options);

    // The value is an object, so the transformer should JSON.stringify it
    const inputData = [{ topic: 'nested', val: { sub: 1 } }];

    const promise = transformer.transform(mockStream, { source: 'test' }, 'data.json');
    mockStream.push(JSON.stringify(inputData));
    mockStream.push(null);
    await flushPromises();
    const result = await promise;
    const output = JSON.parse(result.output);

    expect(output[0].payload).toBe('{"sub":1}');
  });

  it('should JSON stringify the payload if the formatted value is an object (e.g. unknown type)', async () => {
    const options = {
      regex: '.*\\.json',
      filename: 'mqtt-output',
      rowIteratorPath: '$[*]',
      topicPath: '$[*].topic',
      payloadType: 'unknown-type', // Bypasses specific formatting, returns raw value
      valuePath: '$[*].val'
    };
    const transformer = new JSONToMQTTTransformer(logger, testData.transformers.list[0], testData.north.list[0], options);

    // Input is an object
    const inputData = [{ topic: 'topic/obj', val: { a: 1, b: 2 } }];

    const promise = transformer.transform(mockStream, { source: 'test' }, 'data.json');
    mockStream.push(JSON.stringify(inputData));
    mockStream.push(null);
    await flushPromises();
    const result = await promise;
    const output = JSON.parse(result.output);

    // Verifies that JSON.stringify was used on the object
    expect(output[0].payload).toBe('{"a":1,"b":2}');
  });

  it('should skip the row (implicit else) if payloadType is simple but valuePath is missing', async () => {
    const options = {
      regex: '.*',
      filename: 'missing-config.json',
      rowIteratorPath: '$[*]',
      topicPath: '$[*].topic',
      payloadType: 'string'
      // valuePath is deliberately undefined here
    };
    const transformer = new JSONToMQTTTransformer(logger, testData.transformers.list[0], testData.north.list[0], options);

    const inputData = [{ topic: 'device/1' }];
    const readStream = Readable.from([JSON.stringify(inputData)]);

    // 2. Execute
    const result = await transformer.transform(readStream, { source: 'test' }, 'missing-config.json');

    // 3. Assert: Payload remains null, so it is filtered out at the end
    const output = JSON.parse(result.output);
    expect(output).toHaveLength(0);
  });

  it('should return null for undefined/null values in formatValue', async () => {
    // Tests the explicit `if (raw === undefined)` check at start of formatValue
    const options = { ...baseOptions, payloadType: 'string', valuePath: '$[*].val' };
    transformer = new JSONToMQTTTransformer(logger, testData.transformers.list[0], testData.north.list[0], options);

    const inputData = [{ topic: 'topic', val: null }]; // Val is null

    const promise = transformer.transform(mockStream, { source: 'test' }, 'data.json');
    mockStream.push(JSON.stringify(inputData));
    mockStream.push(null);
    await flushPromises();
    const result = await promise;
    const output = JSON.parse(result.output);

    // Payload is null, so row should be skipped in step 5
    expect(output).toHaveLength(0);
  });

  it('should default to raw value if type is unknown in switch', async () => {
    const options = { ...baseOptions, payloadType: 'unknown-type', valuePath: '$[*].val' };
    transformer = new JSONToMQTTTransformer(logger, testData.transformers.list[0], testData.north.list[0], options);
    const inputData = [{ topic: 'topic', val: 'raw-data' }];

    const promise = transformer.transform(mockStream, { source: 'test' }, 'data.json');
    mockStream.push(JSON.stringify(inputData));
    mockStream.push(null);
    await flushPromises();
    const result = await promise;
    const output = JSON.parse(result.output);

    expect(output[0].payload).toBe('raw-data');
  });

  // --------------------------------------------------------------------------
  // 4. Error Handling
  // --------------------------------------------------------------------------
  it('should log error and return empty if JSON parsing fails', async () => {
    transformer = new JSONToMQTTTransformer(logger, testData.transformers.list[0], testData.north.list[0], baseOptions);

    const promise = transformer.transform(mockStream, { source: 'test' }, 'mqtt-output.json'); // Match regex
    mockStream.push('{ invalid-json ');
    mockStream.push(null);
    await flushPromises();
    const result = await promise;

    expect(result.output).toBe('[]');
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Failed to parse JSON content'));
  });

  // --------------------------------------------------------------------------
  // 5. Manifest
  // --------------------------------------------------------------------------
  it('should return correct manifest settings', () => {
    expect(jsonToMqttManifest.settings.key).toBe('options');
    expect(jsonToMqttManifest.settings.attributes[0].key).toBe('rowIteratorPath');
  });
});
