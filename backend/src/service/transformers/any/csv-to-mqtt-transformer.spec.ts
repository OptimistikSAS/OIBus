import { Readable } from 'stream';
import pino from 'pino';
import PinoLogger from '../../../tests/__mocks__/service/logger/logger.mock'; // Adjust path as necessary
import testData from '../../../tests/utils/test-data'; // Adjust path as necessary
import { flushPromises } from '../../../tests/utils/test-utils'; // Adjust path as necessary
import CSVToMQTTTransformer from './csv-to-mqtt-transformer';
import { OIBusArrayAttribute, OIBusStringSelectAttribute } from '../../../../shared/model/form.model';
import { OIBusMQTTValue } from '../connector-types.model';

// 1. Mock External Utilities
jest.mock('../../utils', () => ({
  convertDateTimeToInstant: jest.fn().mockImplementation(_val => {
    // Return a mock timestamp for testing.
    return 1698400000000;
  }),
  generateRandomId: jest.fn().mockReturnValue('fixed-random-id'),
  convertDelimiter: jest.fn().mockImplementation(val => {
    // Simple mock to return the char based on the name, mirroring real util behavior mostly
    if (val === 'COMMA') return ',';
    if (val === 'SEMI_COLON') return ';';
    return ',';
  }),
  stringToBoolean: jest.fn().mockImplementation(val => val === 'true' || val === true || val === '1')
}));

const logger: pino.Logger = new PinoLogger();

describe('CSVToMQTTTransformer', () => {
  let transformer: CSVToMQTTTransformer;
  let mockStream: Readable;

  // --- Base Options for Re-use ---
  const baseOptions = {
    regex: '.*\\.csv',
    filename: 'mqtt-output',
    delimiter: 'COMMA',
    hasHeader: true,
    topicColumn: 'topic'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockStream = new Readable();
  });

  // --------------------------------------------------------------------------
  // 1. Object Payload Tests
  // --------------------------------------------------------------------------
  it('should transform CSV data into a custom OBJECT payload', async () => {
    const options = {
      csvToParse: [
        {
          ...baseOptions,
          payloadType: 'object',
          objectFields: [
            { key: 'temp', column: 'temperature', dataType: 'number' },
            { key: 'active', column: 'isEnabled', dataType: 'boolean' },
            {
              key: 'time',
              column: 'timestamp',
              dataType: 'datetime',
              datetimeSettings: { type: 'iso-string', timezone: 'UTC', format: 'yyyy', locale: 'en' }
            }
          ]
        }
      ]
    };

    transformer = new CSVToMQTTTransformer(logger, testData.transformers.list[0], testData.north.list[0], options);

    const csvContent = `topic,temperature,isEnabled,timestamp\ndevice/1,25.5,true,2023-01-01`;

    const promise = transformer.transform(mockStream, 'src', 'data.csv');
    mockStream.push(csvContent);
    mockStream.push(null);
    await flushPromises();
    const result = await promise;
    const output: Array<OIBusMQTTValue> = JSON.parse(result.output);

    expect(output).toHaveLength(1);
    expect(output[0].topic).toBe('device/1');

    // Parse payload to verify structure
    const payload = JSON.parse(output[0].payload);
    expect(payload).toEqual({
      temp: 25.5,
      active: true,
      time: 1698400000000 // Mocked value
    });
  });

  it('should skip object payload creation if the resulting object is empty', async () => {
    const options = {
      csvToParse: [
        {
          ...baseOptions,
          payloadType: 'object',
          objectFields: [] // No fields defined
        }
      ]
    };

    transformer = new CSVToMQTTTransformer(logger, testData.transformers.list[0], testData.north.list[0], options);

    const csvContent = `topic,val\ndevice/1,100`;

    const promise = transformer.transform(mockStream, 'src', 'data.csv');
    mockStream.push(csvContent);
    mockStream.push(null);
    await flushPromises();
    const result = await promise;
    const output = JSON.parse(result.output);

    expect(output).toHaveLength(0);
  });

  // --------------------------------------------------------------------------
  // 2. Simple Payload Tests
  // --------------------------------------------------------------------------
  it('should transform CSV data into a STRING payload', async () => {
    const options = {
      csvToParse: [{ ...baseOptions, payloadType: 'string', valueColumn: 'val' }]
    };
    transformer = new CSVToMQTTTransformer(logger, testData.transformers.list[0], testData.north.list[0], options);

    const csvContent = `topic,val\ndevice/s,123`;

    const promise = transformer.transform(mockStream, 'src', 'data.csv');
    mockStream.push(csvContent);
    mockStream.push(null);
    await flushPromises();
    const result = await promise;
    const output: Array<OIBusMQTTValue> = JSON.parse(result.output);

    expect(output[0].payload).toBe('123');
  });

  it('should transform CSV data into a NUMBER payload', async () => {
    const options = {
      csvToParse: [{ ...baseOptions, payloadType: 'number', valueColumn: 'val' }]
    };
    transformer = new CSVToMQTTTransformer(logger, testData.transformers.list[0], testData.north.list[0], options);

    const csvContent = `topic,val\ndevice/n,45.6`;

    const promise = transformer.transform(mockStream, 'src', 'data.csv');
    mockStream.push(csvContent);
    mockStream.push(null);
    await flushPromises();
    const result = await promise;
    const output: Array<OIBusMQTTValue> = JSON.parse(result.output);

    expect(output[0].payload).toBe('45.6'); // MQTT payload is string, but content logic handled number conversion internally
  });

  it('should transform CSV data into a BOOLEAN payload', async () => {
    const options = {
      csvToParse: [{ ...baseOptions, payloadType: 'boolean', valueColumn: 'val' }]
    };
    transformer = new CSVToMQTTTransformer(logger, testData.transformers.list[0], testData.north.list[0], options);

    const csvContent = `topic,val\ndevice/b,true`;

    const promise = transformer.transform(mockStream, 'src', 'data.csv');
    mockStream.push(csvContent);
    mockStream.push(null);
    await flushPromises();
    const result = await promise;
    const output: Array<OIBusMQTTValue> = JSON.parse(result.output);

    expect(output[0].payload).toBe('true');
  });

  it('should transform CSV data into a DATETIME payload', async () => {
    const options = {
      csvToParse: [
        {
          ...baseOptions,
          payloadType: 'datetime',
          valueColumn: 'val',
          datetimeSettings: { type: 'iso-string', timezone: 'UTC', format: 'yyyy', locale: 'en' }
        }
      ]
    };
    transformer = new CSVToMQTTTransformer(logger, testData.transformers.list[0], testData.north.list[0], options);

    const csvContent = `topic,val\ndevice/d,2023-01-01`;

    const promise = transformer.transform(mockStream, 'src', 'data.csv');
    mockStream.push(csvContent);
    mockStream.push(null);
    await flushPromises();
    const result = await promise;
    const output: Array<OIBusMQTTValue> = JSON.parse(result.output);

    expect(output[0].payload).toBe('1698400000000');
  });

  // --------------------------------------------------------------------------
  // 3. Header vs Index Extraction
  // --------------------------------------------------------------------------
  it('should extract values by INDEX when hasHeader is false', async () => {
    const options = {
      csvToParse: [
        {
          regex: '.*\\.csv',
          filename: 'no-header',
          delimiter: 'COMMA',
          hasHeader: false,
          topicColumn: '0', // Column index 0
          payloadType: 'string',
          valueColumn: '1' // Column index 1
        }
      ]
    };
    transformer = new CSVToMQTTTransformer(logger, testData.transformers.list[0], testData.north.list[0], options);

    const csvContent = `device/1,100\ndevice/2,200`;

    const promise = transformer.transform(mockStream, 'src', 'data.csv');
    mockStream.push(csvContent);
    mockStream.push(null);
    await flushPromises();
    const result = await promise;
    const output: Array<OIBusMQTTValue> = JSON.parse(result.output);

    expect(output).toHaveLength(2);
    expect(output[0]).toEqual({ topic: 'device/1', payload: '100' });
    expect(output[1]).toEqual({ topic: 'device/2', payload: '200' });
  });

  it('should extract values by INDEX when hasHeader is false and null formatted value', async () => {
    const options = {
      csvToParse: [
        {
          regex: '.*\\.csv',
          filename: 'no-header',
          delimiter: 'COMMA',
          hasHeader: false,
          topicColumn: '0', // Column index 0
          payloadType: 'string',
          valueColumn: '1' // Column index 1
        }
      ]
    };
    transformer = new CSVToMQTTTransformer(logger, testData.transformers.list[0], testData.north.list[0], options);

    const csvContent = `device/1,{}\ndevice/2,{}`;

    const promise = transformer.transform(mockStream, 'src', 'data.csv');
    mockStream.push(csvContent);
    mockStream.push(null);
    await flushPromises();
    const result = await promise;
    const output: Array<OIBusMQTTValue> = JSON.parse(result.output);

    expect(output).toHaveLength(2);
    expect(output[0]).toEqual({ topic: 'device/1', payload: '{}' });
    expect(output[1]).toEqual({ topic: 'device/2', payload: '{}' });
  });

  it('should extract values by INDEX without valueColumn', async () => {
    const options = {
      csvToParse: [
        {
          regex: '.*\\.csv',
          filename: 'no-header',
          delimiter: 'COMMA',
          hasHeader: false,
          topicColumn: '0', // Column index 0
          payloadType: 'string'
        }
      ]
    };
    transformer = new CSVToMQTTTransformer(logger, testData.transformers.list[0], testData.north.list[0], options);

    const csvContent = `device/1,100\ndevice/2,200`;

    const promise = transformer.transform(mockStream, 'src', 'data.csv');
    mockStream.push(csvContent);
    mockStream.push(null);
    await flushPromises();
    const result = await promise;
    const output: Array<OIBusMQTTValue> = JSON.parse(result.output);
    expect(output).toHaveLength(0);
  });

  it('should return undefined if index is invalid (NaN)', async () => {
    // This covers the `isNaN(index)` check in extractValue
    const options = {
      csvToParse: [
        {
          ...baseOptions,
          hasHeader: false,
          topicColumn: 'not-a-number', // Invalid index
          payloadType: 'string',
          valueColumn: '1'
        }
      ]
    };
    transformer = new CSVToMQTTTransformer(logger, testData.transformers.list[0], testData.north.list[0], options);

    const csvContent = `device/1,100`;

    const promise = transformer.transform(mockStream, 'src', 'data.csv');
    mockStream.push(csvContent);
    mockStream.push(null);
    await flushPromises();
    const result = await promise;
    const output = JSON.parse(result.output);

    // Topic extraction fails (undefined), so row is skipped
    expect(output).toHaveLength(0);
  });

  // --------------------------------------------------------------------------
  // 4. Edge Cases & Validation
  // --------------------------------------------------------------------------
  it('should skip rows where TOPIC is missing', async () => {
    const options = {
      csvToParse: [{ ...baseOptions, payloadType: 'string', valueColumn: 'val' }]
    };
    transformer = new CSVToMQTTTransformer(logger, testData.transformers.list[0], testData.north.list[0], options);

    // Row 2 has empty topic
    const csvContent = `topic,val\ndevice/1,10\n,20`;

    const promise = transformer.transform(mockStream, 'src', 'data.csv');
    mockStream.push(csvContent);
    mockStream.push(null);
    await flushPromises();
    const result = await promise;
    const output = JSON.parse(result.output);

    expect(output).toHaveLength(1);
    expect(output[0].topic).toBe('device/1');
  });

  it('should skip rows where VALUE is missing or null', async () => {
    const options = {
      csvToParse: [{ ...baseOptions, payloadType: 'string', valueColumn: 'val' }]
    };
    transformer = new CSVToMQTTTransformer(logger, testData.transformers.list[0], testData.north.list[0], options);

    // Row 2 has empty value
    const csvContent = `topic,val\ndevice/1,10\ndevice/2,`;

    const promise = transformer.transform(mockStream, 'src', 'data.csv');
    mockStream.push(csvContent);
    mockStream.push(null);
    await flushPromises();
    const result = await promise;
    const output = JSON.parse(result.output);

    expect(output).toHaveLength(1);
    expect(output[0].topic).toBe('device/1');
  });

  it('should return empty if no configuration matches filename', async () => {
    transformer = new CSVToMQTTTransformer(logger, testData.transformers.list[0], testData.north.list[0], {
      csvToParse: [baseOptions]
    });

    const promise = transformer.transform(mockStream, 'src', 'wrong-name.txt');
    mockStream.push('topic,val');
    mockStream.push(null);
    await flushPromises();
    const result = await promise;

    expect(result.output).toBe('[]');
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Could not find csv parser'));
  });

  it('should log warning if CSV parsing has errors', async () => {
    // Tests parseResult.errors.length check
    const options = {
      csvToParse: [{ ...baseOptions, delimiter: 'COMMA', payloadType: 'string', valueColumn: 'val' }]
    };
    transformer = new CSVToMQTTTransformer(logger, testData.transformers.list[0], testData.north.list[0], options);

    // Malformed CSV (unclosed quote)
    const csvContent = `topic,val\n"device/1,10`;

    const promise = transformer.transform(mockStream, 'src', 'data.csv');
    mockStream.push(csvContent);
    mockStream.push(null);
    await flushPromises();
    await promise;

    // We mainly check that warning was called. Output might be empty or partial depending on PapaParse recovery.
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Encountered'));
  });

  it('should default to raw value if type is unknown in formatValue', async () => {
    // Explicitly testing the default case of the switch statement
    const options = {
      csvToParse: [{ ...baseOptions, payloadType: 'unknown', valueColumn: 'val' }]
    };
    transformer = new CSVToMQTTTransformer(logger, testData.transformers.list[0], testData.north.list[0], options);

    const csvContent = `topic,val\ndevice/1,raw-content`;

    const promise = transformer.transform(mockStream, 'src', 'data.csv');
    mockStream.push(csvContent);
    mockStream.push(null);
    await flushPromises();
    const result = await promise;
    const output = JSON.parse(result.output);

    expect(output[0].payload).toBe('raw-content');
  });

  // --------------------------------------------------------------------------
  // 5. Manifest
  // --------------------------------------------------------------------------
  it('should return correct manifest settings', () => {
    const manifest = CSVToMQTTTransformer.manifestSettings;
    expect(manifest.key).toBe('options');
    expect(manifest.attributes[0].key).toBe('csvToParse');

    // Verify nested attributes exist
    const csvToParse = (manifest.attributes[0] as OIBusArrayAttribute).rootAttribute;
    const payloadType = csvToParse.attributes.find(a => a.key === 'payloadType');
    expect(payloadType).toBeDefined();
    expect((payloadType as OIBusStringSelectAttribute).selectableValues).toContain('object');
  });
});
