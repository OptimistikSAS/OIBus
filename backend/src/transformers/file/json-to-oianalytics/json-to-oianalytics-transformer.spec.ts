import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { Readable } from 'node:stream';
import { afterEach, before, beforeEach, describe, it, mock } from 'node:test';

import type * as Utils from '../../../service/utils';
import PinoLogger from '../../../tests/__mocks__/service/logger/logger.mock';
import testData from '../../../tests/utils/test-data';
import { mockModule, reloadModule } from '../../../tests/utils/test-utils';
import type JSONToOIAnalyticsTransformerType from './json-to-oianalytics-transformer';
import jsonToOianalyticsManifest from './manifest';

const nodeRequire = createRequire(import.meta.url);

let JSONToOIAnalyticsTransformer: typeof JSONToOIAnalyticsTransformerType;

before(() => {
  const utils = nodeRequire('../../../service/utils') as typeof Utils;
  mockModule(nodeRequire, '../../../service/utils', { ...utils, generateRandomId: () => 'randomId' });
  const mod = reloadModule<{ default: typeof JSONToOIAnalyticsTransformerType }>(nodeRequire, './json-to-oianalytics-transformer');
  JSONToOIAnalyticsTransformer = mod.default;
});

describe('JSONToOIAnalyticsTransformer', () => {
  let logger: PinoLogger;

  const options = {
    rowIteratorPath: '$[*]',
    pointId: '$[*].id',
    value: '$[*].val',
    timestamp: '$[*].ts',
    datetimeSettings: { inputType: 'iso-string', inputTimezone: 'UTC', outputPrecision: 'ms' }
  };
  const createTransformer = (transformerOptions: object = options) =>
    new JSONToOIAnalyticsTransformer(logger, testData.transformers.list[0], transformerOptions);

  beforeEach(() => {
    logger = new PinoLogger();
    mock.timers.enable({ apis: ['Date'], now: new Date(testData.constants.dates.FAKE_NOW) });
  });

  afterEach(() => {
    mock.timers.reset();
  });

  it('should transform a JSON array from a stream into the OIAnalytics compact format', async () => {
    const transformer = createTransformer();
    const inputData = [
      { id: 'point-1', ts: '2020-01-01T00:00:00.000Z', val: 42 },
      { id: 'point-2', ts: '2020-01-02T00:00:00.000Z', val: 'on' }
    ];
    const result = await transformer.transform(Readable.from(JSON.stringify(inputData)), { source: 'test' }, null);

    assert.deepStrictEqual(JSON.parse(result.output.toString()), {
      timestamps: ['2020-01-01T00:00:00.000Z', '2020-01-02T00:00:00.000Z'],
      values: [42, 'on'],
      references: ['point-1', 'point-2']
    });
    assert.deepStrictEqual(result.metadata, {
      contentFile: 'randomId.json',
      contentSize: 0,
      createdAt: '',
      numberOfElement: 2,
      contentType: 'oianalytics'
    });
  });

  it('should transform an in-memory payload and round the timestamp with precision', async () => {
    const transformer = createTransformer({
      ...options,
      datetimeSettings: { ...options.datetimeSettings, outputPrecision: 'min' }
    });
    const inputData = [{ id: 'point-1', ts: '2020-01-01T12:34:56.789Z', val: 1 }];

    const result = await transformer.transformInMemory(JSON.stringify(inputData), { source: 'test' }, null);

    assert.deepStrictEqual(JSON.parse(result.output.toString()), {
      timestamps: ['2020-01-01T12:34:00.000Z'],
      values: [1],
      references: ['point-1']
    });
    assert.strictEqual(result.metadata.numberOfElement, 1);
    assert.strictEqual(result.metadata.contentType, 'oianalytics');
  });

  it('should parse a JSON-stringified intermediate node (e.g. an MQTT message payload)', async () => {
    const transformer = createTransformer({
      ...options,
      pointId: '$[*].item.name',
      value: '$[*].message.temperature',
      timestamp: '$[*].timestamp'
    });
    // `message` is a JSON string, exactly how an MQTT file-content payload arrives.
    const inputData = [
      { item: { name: 'sensor-A' }, timestamp: '2020-01-01T00:00:00.000Z', message: JSON.stringify({ temperature: 21.5 }) }
    ];

    const result = await transformer.transformInMemory(inputData, { source: 'test' }, null);

    assert.deepStrictEqual(JSON.parse(result.output.toString()), {
      timestamps: ['2020-01-01T00:00:00.000Z'],
      values: [21.5],
      references: ['sensor-A']
    });
  });

  it('should split multiple metrics embedded in a single JSON-stringified MQTT message into separate rows', async () => {
    const transformer = createTransformer({
      ...options,
      rowIteratorPath: '$[*].message.metrics[*]',
      pointId: '$[*].message.metrics[*].name',
      value: '$[*].message.metrics[*].value',
      timestamp: '$[*].message.metrics[*].timestamp'
    });
    // A single MQTT message can carry several metrics in its (JSON-stringified) payload.
    const inputData = [
      {
        message: JSON.stringify({
          metrics: [
            { name: 'TAG.A', value: 1.1, timestamp: '2020-01-01T00:00:00.000Z' },
            { name: 'TAG.B', value: 2.2, timestamp: '2020-01-01T00:00:01.000Z' }
          ]
        })
      },
      { message: JSON.stringify({ metrics: [{ name: 'TAG.C', value: 3.3, timestamp: '2020-01-01T00:00:02.000Z' }] }) }
    ];

    const result = await transformer.transformInMemory(inputData, { source: 'test' }, null);

    assert.deepStrictEqual(JSON.parse(result.output.toString()), {
      timestamps: ['2020-01-01T00:00:00.000Z', '2020-01-01T00:00:01.000Z', '2020-01-01T00:00:02.000Z'],
      values: [1.1, 2.2, 3.3],
      references: ['TAG.A', 'TAG.B', 'TAG.C']
    });
    assert.strictEqual(result.metadata.numberOfElement, 3);
  });

  it('should fall back to the current date when no timestamp can be resolved', async () => {
    const transformer = createTransformer({ ...options, timestamp: '$[*].missing' });
    const inputData = [{ id: 'point-1', ts: '2020-01-01T00:00:00.000Z', val: 1 }];

    const result = await transformer.transformInMemory(inputData, { source: 'test' }, null);

    const parsed = JSON.parse(result.output.toString());
    assert.deepStrictEqual(parsed.references, ['point-1']);
    assert.deepStrictEqual(parsed.timestamps, [testData.constants.dates.FAKE_NOW]);
  });

  it('should fall back to plain ISO parsing and "ms" precision when no datetimeSettings are configured', async () => {
    const transformer = createTransformer({
      rowIteratorPath: '$[*]',
      pointId: '$[*].id',
      value: '$[*].val',
      timestamp: '$[*].ts'
    });
    const inputData = [{ id: 'point-1', ts: '2020-01-01T00:00:00.000Z', val: 42 }];

    const result = await transformer.transformInMemory(inputData, { source: 'test' }, null);

    const parsed = JSON.parse(result.output.toString());
    assert.deepStrictEqual(parsed.references, ['point-1']);
    assert.deepStrictEqual(parsed.timestamps, ['2020-01-01T00:00:00.000Z']);
  });

  it('should skip the rows without point or value instead of sending an "undefined" reference', async () => {
    const result = await createTransformer().transformInMemory(
      [
        { ts: '2020-01-01T00:00:00.000Z', val: 1 },
        { id: 'point-2', ts: '2020-01-01T00:00:00.000Z' },
        { id: 'point-3', ts: '2020-01-01T00:00:00.000Z', val: 3 }
      ],
      { source: 'test' },
      null
    );

    assert.deepStrictEqual(JSON.parse(result.output.toString()).references, ['point-3']);
    assert.strictEqual(result.metadata.numberOfElement, 1);
  });

  it('should apply the reference process to the references', async () => {
    const transformer = createTransformer({
      ...options,
      referenceProcess: "'plant/' + value"
    });
    const inputData = [
      { id: 'point-1', ts: '2020-01-01T00:00:00.000Z', val: 1 },
      { id: 'point-2', ts: '2020-01-01T00:00:01.000Z', val: 2 }
    ];

    const result = await transformer.transformInMemory(inputData, { source: 'test' }, null);

    assert.deepStrictEqual(JSON.parse(result.output.toString()).references, ['plant/point-1', 'plant/point-2']);
  });

  it('should correctly expose the manifest settings', () => {
    assert.ok(jsonToOianalyticsManifest.settings !== undefined);
    assert.strictEqual(jsonToOianalyticsManifest.settings.type, 'object');
    assert.strictEqual(jsonToOianalyticsManifest.settings.key, 'options');
    assert.strictEqual(jsonToOianalyticsManifest.outputType, 'oianalytics');
    assert.strictEqual(jsonToOianalyticsManifest.inputType, 'file');
  });
});
