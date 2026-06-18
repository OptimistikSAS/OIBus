import { describe, it, before, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { Readable } from 'stream';
import testData from '../../../tests/utils/test-data';
import { flushPromises, mockModule, reloadModule } from '../../../tests/utils/test-utils';
import PinoLogger from '../../../tests/__mocks__/service/logger/logger.mock';
import { injectIndices, streamToString } from '../../../service/utils';
import type JSONToOIAnalyticsTransformerType from './json-to-oianalytics-transformer';
import jsonToOianalyticsManifest from './manifest';

const nodeRequire = createRequire(import.meta.url);

let mockUtils: Record<string, ReturnType<typeof mock.fn>>;
let JSONToOIAnalyticsTransformer: typeof JSONToOIAnalyticsTransformerType;

before(() => {
  mockUtils = {
    generateRandomId: mock.fn(() => 'randomId'),
    streamToString: mock.fn(streamToString),
    injectIndices: mock.fn(injectIndices),
    // iso-string input is already an instant; the real conversion is exercised in utils' own tests.
    convertDateTime: mock.fn((value: unknown) => value)
  };
  mockModule(nodeRequire, '../../../service/utils', mockUtils);
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

  beforeEach(() => {
    logger = new PinoLogger();
    mockUtils.generateRandomId = mock.fn(() => 'randomId');
    mockUtils.injectIndices = mock.fn(injectIndices);
    mockUtils.convertDateTime = mock.fn((value: unknown) => value);
    mock.timers.enable({ apis: ['Date'], now: new Date(testData.constants.dates.FAKE_NOW) });
  });

  afterEach(() => {
    mock.timers.reset();
  });

  it('should transform a JSON array from a stream into the OIAnalytics format', async () => {
    const transformer = new JSONToOIAnalyticsTransformer(logger, testData.transformers.list[0], options);
    const inputData = [
      { id: 'point-1', ts: '2020-01-01T00:00:00.000Z', val: 42 },
      { id: 'point-2', ts: '2020-01-02T00:00:00.000Z', val: 'on' }
    ];
    const mockStream = new Readable();

    const promise = transformer.transform(mockStream, { source: 'test' }, null);
    mockStream.push(JSON.stringify(inputData));
    mockStream.push(null);

    await flushPromises();
    const result = await promise;

    assert.deepStrictEqual(JSON.parse(result.output.toString()), [
      { pointId: 'point-1', timestamp: '2020-01-01T00:00:00.000Z', data: { value: 42 } },
      { pointId: 'point-2', timestamp: '2020-01-02T00:00:00.000Z', data: { value: 'on' } }
    ]);
    assert.deepStrictEqual(result.metadata, {
      contentFile: 'randomId.json',
      contentSize: 0,
      createdAt: '',
      numberOfElement: 2,
      contentType: 'oianalytics'
    });
  });

  it('should transform an in-memory payload and round the timestamp with precision', async () => {
    const transformer = new JSONToOIAnalyticsTransformer(logger, testData.transformers.list[0], {
      ...options,
      datetimeSettings: { ...options.datetimeSettings, outputPrecision: 'min' }
    });
    const inputData = [{ id: 'point-1', ts: '2020-01-01T12:34:56.789Z', val: 1 }];

    const result = await transformer.transformInMemory(JSON.stringify(inputData), { source: 'test' }, null);

    assert.deepStrictEqual(JSON.parse(result.output.toString()), [
      { pointId: 'point-1', timestamp: '2020-01-01T12:34:00.000Z', data: { value: 1 } }
    ]);
    assert.strictEqual(result.metadata.numberOfElement, 1);
    assert.strictEqual(result.metadata.contentType, 'oianalytics');
  });

  it('should parse a JSON-stringified intermediate node (e.g. an MQTT message payload)', async () => {
    const transformer = new JSONToOIAnalyticsTransformer(logger, testData.transformers.list[0], {
      ...options,
      pointId: '$[*].item.name',
      value: '$[*].message.temperature',
      timestamp: '$[*].timestamp'
    });
    // `message` is a JSON string, exactly how an MQTT any-content payload arrives.
    const inputData = [
      { item: { name: 'sensor-A' }, timestamp: '2020-01-01T00:00:00.000Z', message: JSON.stringify({ temperature: 21.5 }) }
    ];

    const result = await transformer.transformInMemory(inputData, { source: 'test' }, null);

    assert.deepStrictEqual(JSON.parse(result.output.toString()), [
      { pointId: 'sensor-A', timestamp: '2020-01-01T00:00:00.000Z', data: { value: 21.5 } }
    ]);
  });

  it('should fall back to the current date when no timestamp can be resolved', async () => {
    const transformer = new JSONToOIAnalyticsTransformer(logger, testData.transformers.list[0], { ...options, timestamp: '$[*].missing' });
    const inputData = [{ id: 'point-1', ts: '2020-01-01T00:00:00.000Z', val: 1 }];

    const result = await transformer.transformInMemory(inputData, { source: 'test' }, null);

    const parsed = JSON.parse(result.output.toString());
    assert.strictEqual(parsed[0].pointId, 'point-1');
    assert.strictEqual(parsed[0].timestamp, testData.constants.dates.FAKE_NOW);
  });

  it('should properly format instant with precision', () => {
    const transformer = new JSONToOIAnalyticsTransformer(logger, testData.transformers.list[0], options);

    assert.strictEqual(transformer.formatInstant('2020-03-15T12:34:56.789Z', 'ms'), '2020-03-15T12:34:56.789Z');
    assert.strictEqual(transformer.formatInstant('2020-03-15T12:34:56.789Z', 's'), '2020-03-15T12:34:56.000Z');
    assert.strictEqual(transformer.formatInstant('2020-03-15T12:34:56.789Z', 'min'), '2020-03-15T12:34:00.000Z');
    assert.strictEqual(transformer.formatInstant('2020-03-15T12:34:56.789Z', 'hr'), '2020-03-15T12:00:00.000Z');
  });

  it('should correctly expose the manifest settings', () => {
    assert.ok(jsonToOianalyticsManifest.settings !== undefined);
    assert.strictEqual(jsonToOianalyticsManifest.settings.type, 'object');
    assert.strictEqual(jsonToOianalyticsManifest.settings.key, 'options');
    assert.strictEqual(jsonToOianalyticsManifest.outputType, 'oianalytics');
    assert.strictEqual(jsonToOianalyticsManifest.inputType, 'any');
  });
});
