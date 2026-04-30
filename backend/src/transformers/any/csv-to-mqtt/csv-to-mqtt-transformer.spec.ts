import { describe, it, before, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { Readable } from 'stream';
import testData from '../../../tests/utils/test-data';
import {flushPromises, mockModule, reloadModule} from '../../../tests/utils/test-utils';
import PinoLogger from '../../../tests/__mocks__/service/logger/logger.mock';
import type CSVToMQTTTransformerType from './csv-to-mqtt-transformer';
import csvToMqttManifest from './manifest';
import { OIBusMQTTValue } from '../../connector-types.model';

const nodeRequire = createRequire(import.meta.url);

let mockUtils: Record<string, ReturnType<typeof mock.fn>>;
let CSVToMQTTTransformer: typeof CSVToMQTTTransformerType;

before(() => {
  mockUtils = {
    convertDateTime: mock.fn(() => 1698400000000),
    generateRandomId: mock.fn(() => 'fixed-random-id'),
    convertDelimiter: mock.fn((val: string) => {
      if (val === 'COMMA') return ',';
      if (val === 'SEMI_COLON') return ';';
      return ',';
    }),
    stringToBoolean: mock.fn((val: unknown) => val === 'true' || val === true || val === '1')
  };
  mockModule(nodeRequire, '../../../service/utils', mockUtils);
  const mod = reloadModule<{ default: typeof CSVToMQTTTransformerType }>(nodeRequire, './csv-to-mqtt-transformer');
  CSVToMQTTTransformer = mod.default;
});

describe('CSVToMQTTTransformer', () => {
  let logger: PinoLogger;

  const baseOptions = {
    regex: '.*\\.csv',
    filename: 'mqtt-output',
    delimiter: 'COMMA',
    hasHeader: true,
    topicColumn: 'topic'
  };

  beforeEach(() => {
    logger = new PinoLogger();
    mockUtils.convertDateTime = mock.fn(() => 1698400000000);
    mockUtils.generateRandomId = mock.fn(() => 'fixed-random-id');
    mockUtils.convertDelimiter = mock.fn((val: string) => {
      if (val === 'COMMA') return ',';
      if (val === 'SEMI_COLON') return ';';
      return ',';
    });
    mockUtils.stringToBoolean = mock.fn((val: unknown) => val === 'true' || val === true || val === '1');
    mock.timers.enable({ apis: ['Date'], now: new Date(testData.constants.dates.FAKE_NOW) });
  });

  afterEach(() => {
    mock.timers.reset();
  });

  it('should transform CSV data into a custom OBJECT payload', async () => {
    const options = {
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
    };
    const transformer = new CSVToMQTTTransformer(logger, testData.transformers.list[0], options);
    const csvContent = `topic,temperature,isEnabled,timestamp\ndevice/1,25.5,true,2023-01-01`;
    const mockStream = new Readable();

    const promise = transformer.transform(mockStream, { source: 'test' }, 'data.csv');
    mockStream.push(csvContent);
    mockStream.push(null);
    await flushPromises();
    const result = await promise;
    const output: Array<OIBusMQTTValue> = JSON.parse(result.output);

    assert.strictEqual(output.length, 1);
    assert.strictEqual(output[0].topic, 'device/1');
    const payload = JSON.parse(output[0].payload);
    assert.deepStrictEqual(payload, { temp: 25.5, active: true, time: 1698400000000 });
  });

  it('should skip object payload creation if the resulting object is empty', async () => {
    const options = { ...baseOptions, payloadType: 'object', objectFields: [] };
    const transformer = new CSVToMQTTTransformer(logger, testData.transformers.list[0], options);
    const mockStream = new Readable();

    const promise = transformer.transform(mockStream, { source: 'test' }, 'data.csv');
    mockStream.push('topic,val\ndevice/1,100');
    mockStream.push(null);
    await flushPromises();
    const result = await promise;
    const output = JSON.parse(result.output);

    assert.strictEqual(output.length, 0);
  });

  it('should transform CSV data into a STRING payload', async () => {
    const options = { ...baseOptions, payloadType: 'string', valueColumn: 'val' };
    const transformer = new CSVToMQTTTransformer(logger, testData.transformers.list[0], options);
    const mockStream = new Readable();

    const promise = transformer.transform(mockStream, { source: 'test' }, 'data.csv');
    mockStream.push('topic,val\ndevice/s,123');
    mockStream.push(null);
    await flushPromises();
    const result = await promise;
    const output: Array<OIBusMQTTValue> = JSON.parse(result.output);

    assert.strictEqual(output[0].payload, '123');
  });

  it('should transform CSV data into a NUMBER payload', async () => {
    const options = { ...baseOptions, payloadType: 'number', valueColumn: 'val' };
    const transformer = new CSVToMQTTTransformer(logger, testData.transformers.list[0], options);
    const mockStream = new Readable();

    const promise = transformer.transform(mockStream, { source: 'test' }, 'data.csv');
    mockStream.push('topic,val\ndevice/n,45.6');
    mockStream.push(null);
    await flushPromises();
    const result = await promise;
    const output: Array<OIBusMQTTValue> = JSON.parse(result.output);

    assert.strictEqual(output[0].payload, '45.6');
  });

  it('should transform CSV data into a BOOLEAN payload', async () => {
    const options = { ...baseOptions, payloadType: 'boolean', valueColumn: 'val' };
    const transformer = new CSVToMQTTTransformer(logger, testData.transformers.list[0], options);
    const mockStream = new Readable();

    const promise = transformer.transform(mockStream, { source: 'test' }, 'data.csv');
    mockStream.push('topic,val\ndevice/b,true');
    mockStream.push(null);
    await flushPromises();
    const result = await promise;
    const output: Array<OIBusMQTTValue> = JSON.parse(result.output);

    assert.strictEqual(output[0].payload, 'true');
  });

  it('should transform CSV data into a DATETIME payload', async () => {
    const options = {
      ...baseOptions,
      payloadType: 'datetime',
      valueColumn: 'val',
      datetimeSettings: { type: 'iso-string', timezone: 'UTC', format: 'yyyy', locale: 'en' }
    };
    const transformer = new CSVToMQTTTransformer(logger, testData.transformers.list[0], options);
    const mockStream = new Readable();

    const promise = transformer.transform(mockStream, { source: 'test' }, 'data.csv');
    mockStream.push('topic,val\ndevice/d,2023-01-01');
    mockStream.push(null);
    await flushPromises();
    const result = await promise;
    const output: Array<OIBusMQTTValue> = JSON.parse(result.output);

    assert.strictEqual(output[0].payload, '1698400000000');
  });

  it('should extract values by INDEX when hasHeader is false', async () => {
    const options = {
      regex: '.*\\.csv',
      filename: 'no-header',
      delimiter: 'COMMA',
      hasHeader: false,
      topicColumn: '0',
      payloadType: 'string',
      valueColumn: '1'
    };
    const transformer = new CSVToMQTTTransformer(logger, testData.transformers.list[0], options);
    const mockStream = new Readable();

    const promise = transformer.transform(mockStream, { source: 'test' }, 'data.csv');
    mockStream.push('device/1,100\ndevice/2,200');
    mockStream.push(null);
    await flushPromises();
    const result = await promise;
    const output: Array<OIBusMQTTValue> = JSON.parse(result.output);

    assert.strictEqual(output.length, 2);
    assert.deepStrictEqual(output[0], { topic: 'device/1', payload: '100' });
    assert.deepStrictEqual(output[1], { topic: 'device/2', payload: '200' });
  });

  it('should extract values by INDEX when hasHeader is false and null formatted value', async () => {
    const options = {
      regex: '.*\\.csv',
      filename: 'no-header',
      delimiter: 'COMMA',
      hasHeader: false,
      topicColumn: '0',
      payloadType: 'string',
      valueColumn: '1'
    };
    const transformer = new CSVToMQTTTransformer(logger, testData.transformers.list[0], options);
    const mockStream = new Readable();

    const promise = transformer.transform(mockStream, { source: 'test' }, 'data.csv');
    mockStream.push('device/1,{}\ndevice/2,{}');
    mockStream.push(null);
    await flushPromises();
    const result = await promise;
    const output: Array<OIBusMQTTValue> = JSON.parse(result.output);

    assert.strictEqual(output.length, 2);
    assert.deepStrictEqual(output[0], { topic: 'device/1', payload: '{}' });
    assert.deepStrictEqual(output[1], { topic: 'device/2', payload: '{}' });
  });

  it('should extract values by INDEX without valueColumn', async () => {
    const options = {
      regex: '.*\\.csv',
      filename: 'no-header',
      delimiter: 'COMMA',
      hasHeader: false,
      topicColumn: '0',
      payloadType: 'string'
    };
    const transformer = new CSVToMQTTTransformer(logger, testData.transformers.list[0], options);
    const mockStream = new Readable();

    const promise = transformer.transform(mockStream, { source: 'test' }, 'data.csv');
    mockStream.push('device/1,100\ndevice/2,200');
    mockStream.push(null);
    await flushPromises();
    const result = await promise;
    const output = JSON.parse(result.output);

    assert.strictEqual(output.length, 0);
  });

  it('should return undefined if index is invalid (NaN)', async () => {
    const options = { ...baseOptions, hasHeader: false, topicColumn: 'not-a-number', payloadType: 'string', valueColumn: '1' };
    const transformer = new CSVToMQTTTransformer(logger, testData.transformers.list[0], options);
    const mockStream = new Readable();

    const promise = transformer.transform(mockStream, { source: 'test' }, 'data.csv');
    mockStream.push('device/1,100');
    mockStream.push(null);
    await flushPromises();
    const result = await promise;
    const output = JSON.parse(result.output);

    assert.strictEqual(output.length, 0);
  });

  it('should skip rows where TOPIC is missing', async () => {
    const options = { ...baseOptions, payloadType: 'string', valueColumn: 'val' };
    const transformer = new CSVToMQTTTransformer(logger, testData.transformers.list[0], options);
    const mockStream = new Readable();

    const promise = transformer.transform(mockStream, { source: 'test' }, 'data.csv');
    mockStream.push('topic,val\ndevice/1,10\n,20');
    mockStream.push(null);
    await flushPromises();
    const result = await promise;
    const output = JSON.parse(result.output);

    assert.strictEqual(output.length, 1);
    assert.strictEqual(output[0].topic, 'device/1');
  });

  it('should skip rows where VALUE is missing or null', async () => {
    const options = { ...baseOptions, payloadType: 'string', valueColumn: 'val' };
    const transformer = new CSVToMQTTTransformer(logger, testData.transformers.list[0], options);
    const mockStream = new Readable();

    const promise = transformer.transform(mockStream, { source: 'test' }, 'data.csv');
    mockStream.push('topic,val\ndevice/1,10\ndevice/2,');
    mockStream.push(null);
    await flushPromises();
    const result = await promise;
    const output = JSON.parse(result.output);

    assert.strictEqual(output.length, 1);
    assert.strictEqual(output[0].topic, 'device/1');
  });

  it('should log warning if CSV parsing has errors', async () => {
    const options = { ...baseOptions, delimiter: 'COMMA', payloadType: 'string', valueColumn: 'val' };
    const transformer = new CSVToMQTTTransformer(logger, testData.transformers.list[0], options);
    const mockStream = new Readable();

    const promise = transformer.transform(mockStream, { source: 'test' }, 'data.csv');
    mockStream.push('topic,val\n"device/1,10');
    mockStream.push(null);
    await flushPromises();
    await promise;

    assert.ok(logger.warn.mock.calls.length > 0);
    assert.ok((logger.warn.mock.calls[0].arguments[0] as string).includes('Encountered'));
  });

  it('should default to raw value if type is unknown in formatValue', async () => {
    const options = { ...baseOptions, payloadType: 'unknown', valueColumn: 'val' };
    const transformer = new CSVToMQTTTransformer(logger, testData.transformers.list[0], options);
    const mockStream = new Readable();

    const promise = transformer.transform(mockStream, { source: 'test' }, 'data.csv');
    mockStream.push('topic,val\ndevice/1,raw-content');
    mockStream.push(null);
    await flushPromises();
    const result = await promise;
    const output = JSON.parse(result.output);

    assert.strictEqual(output[0].payload, 'raw-content');
  });

  it('should return correct manifest settings', () => {
    assert.strictEqual(csvToMqttManifest.settings.key, 'options');
    assert.strictEqual(csvToMqttManifest.settings.attributes[0].key, 'delimiter');
  });
});
