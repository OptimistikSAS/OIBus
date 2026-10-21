import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { beforeEach, describe, it } from 'node:test';

import PinoLogger from '../../../tests/__mocks__/service/logger/logger.mock';
import testData from '../../../tests/utils/test-data';
import { OIBusMQTTValue } from '../../connector-types.model';
import CSVToMQTTTransformer from './csv-to-mqtt-transformer';
import csvToMqttManifest from './manifest';

describe('CSVToMQTTTransformer', () => {
  let logger: PinoLogger;

  const baseOptions = {
    regex: '.*\\.csv',
    filename: 'mqtt-output',
    delimiter: 'COMMA',
    hasHeader: true,
    topicColumn: 'topic'
  };
  const noHeaderOptions = {
    regex: '.*\\.csv',
    filename: 'no-header',
    delimiter: 'COMMA',
    hasHeader: false,
    topicColumn: '0',
    payloadType: 'string'
  };
  // '2023-01-01' (UTC) as unix epoch in ms
  const datetimeSettings = { inputType: 'string', inputTimezone: 'UTC', inputFormat: 'yyyy-MM-dd', outputType: 'unix-epoch-ms' };
  const EPOCH_MS = 1672531200000;

  /** Transforms `csvContent` and returns the parsed MQTT messages */
  const transformCsv = async (options: object, csvContent: string): Promise<Array<OIBusMQTTValue>> => {
    const transformer = new CSVToMQTTTransformer(logger, testData.transformers.list[0], options);
    const result = await transformer.transform(Readable.from(csvContent), { source: 'test' }, 'data.csv');
    return JSON.parse(result.output.toString());
  };

  beforeEach(() => {
    logger = new PinoLogger();
  });

  it('should transform CSV data into a custom OBJECT payload', async () => {
    const output = await transformCsv(
      {
        ...baseOptions,
        payloadType: 'object',
        objectFields: [
          { key: 'temp', column: 'temperature', dataType: 'number' },
          { key: 'active', column: 'isEnabled', dataType: 'boolean' },
          { key: 'time', column: 'timestamp', dataType: 'datetime', datetimeSettings }
        ]
      },
      `topic,temperature,isEnabled,timestamp\ndevice/1,25.5,true,2023-01-01`
    );

    assert.strictEqual(output.length, 1);
    assert.strictEqual(output[0].topic, 'device/1');
    assert.deepStrictEqual(JSON.parse(output[0].payload), { temp: 25.5, active: true, time: EPOCH_MS });
  });

  const payloadTypeCases = [
    { payloadType: 'string', value: '123', expected: '123' },
    { payloadType: 'number', value: '45.6', expected: '45.6' },
    { payloadType: 'boolean', value: 'true', expected: 'true' },
    { payloadType: 'datetime', value: '2023-01-01', expected: `${EPOCH_MS}`, datetimeSettings },
    // an unknown type falls back to the raw value in formatValue
    { payloadType: 'unknown', value: 'raw-content', expected: 'raw-content' }
  ];
  for (const { payloadType, value, expected, ...extraOptions } of payloadTypeCases) {
    it(`should transform CSV data into a ${payloadType.toUpperCase()} payload`, async () => {
      const output = await transformCsv(
        { ...baseOptions, payloadType, valueColumn: 'val', ...extraOptions },
        `topic,val\ndevice/1,${value}`
      );

      assert.strictEqual(output[0].payload, expected);
    });
  }

  it('should extract values by INDEX when hasHeader is false', async () => {
    const output = await transformCsv({ ...noHeaderOptions, valueColumn: '1' }, 'device/1,100\ndevice/2,200');

    assert.deepStrictEqual(output, [
      { topic: 'device/1', payload: '100' },
      { topic: 'device/2', payload: '200' }
    ]);
  });

  it('should extract values by INDEX when hasHeader is false and null formatted value', async () => {
    const output = await transformCsv({ ...noHeaderOptions, valueColumn: '1' }, 'device/1,{}\ndevice/2,{}');

    assert.deepStrictEqual(output, [
      { topic: 'device/1', payload: '{}' },
      { topic: 'device/2', payload: '{}' }
    ]);
  });

  const emptyOutputCases = [
    {
      title: 'should skip object payload creation if the resulting object is empty',
      options: { ...baseOptions, payloadType: 'object', objectFields: [] },
      csvContent: 'topic,val\ndevice/1,100'
    },
    { title: 'should extract values by INDEX without valueColumn', options: noHeaderOptions, csvContent: 'device/1,100\ndevice/2,200' },
    {
      title: 'should return undefined if index is invalid (NaN)',
      options: { ...baseOptions, hasHeader: false, topicColumn: 'not-a-number', payloadType: 'string', valueColumn: '1' },
      csvContent: 'device/1,100'
    }
  ];
  for (const { title, options, csvContent } of emptyOutputCases) {
    it(title, async () => {
      assert.deepStrictEqual(await transformCsv(options, csvContent), []);
    });
  }

  it('should skip rows where TOPIC is missing', async () => {
    const output = await transformCsv({ ...baseOptions, payloadType: 'string', valueColumn: 'val' }, 'topic,val\ndevice/1,10\n,20');

    assert.strictEqual(output.length, 1);
    assert.strictEqual(output[0].topic, 'device/1');
  });

  it('should skip rows where VALUE is missing or null', async () => {
    const output = await transformCsv({ ...baseOptions, payloadType: 'string', valueColumn: 'val' }, 'topic,val\ndevice/1,10\ndevice/2,');

    assert.strictEqual(output.length, 1);
    assert.strictEqual(output[0].topic, 'device/1');
  });

  it('should log warning if CSV parsing has errors', async () => {
    await transformCsv({ ...baseOptions, payloadType: 'string', valueColumn: 'val' }, 'topic,val\n"device/1,10');

    assert.ok(logger.warn.mock.calls.length > 0);
    assert.ok((logger.warn.mock.calls[0].arguments[0] as string).includes('Encountered'));
  });

  it('should return correct manifest settings', () => {
    assert.strictEqual(csvToMqttManifest.settings.key, 'options');
    assert.strictEqual(csvToMqttManifest.settings.attributes[0].key, 'delimiter');
  });
});
