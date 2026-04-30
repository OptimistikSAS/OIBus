import { describe, it, before, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { Readable } from 'stream';
import testData from '../../../tests/utils/test-data';
import {flushPromises, mockModule, reloadModule} from '../../../tests/utils/test-utils';
import PinoLogger from '../../../tests/__mocks__/service/logger/logger.mock';
import type OIBusTimeValuesToOIAnalyticsTransformerType from './oibus-time-values-to-oianalytics-transformer';
import timeValuesToOianalyticsManifest from './manifest';
import { OIBusTimeValue } from '../../../../shared/model/engine.model';

const nodeRequire = createRequire(import.meta.url);

let mockUtils: Record<string, ReturnType<typeof mock.fn>>;
let OIBusTimeValuesToOIAnalyticsTransformer: typeof OIBusTimeValuesToOIAnalyticsTransformerType;

before(() => {
  mockUtils = { generateRandomId: mock.fn(() => 'randomId') };
  mockModule(nodeRequire, '../../../service/utils', mockUtils);
  const mod = reloadModule<{ default: typeof OIBusTimeValuesToOIAnalyticsTransformerType }>(
    nodeRequire,
    './oibus-time-values-to-oianalytics-transformer'
  );
  OIBusTimeValuesToOIAnalyticsTransformer = mod.default;
});

describe('OIBusTimeValuesToOIAnalyticsTransformer', () => {
  let logger: PinoLogger;

  beforeEach(() => {
    logger = new PinoLogger();
    mockUtils.generateRandomId = mock.fn(() => 'randomId');
    mock.timers.enable({ apis: ['Date'], now: new Date(testData.constants.dates.FAKE_NOW) });
  });

  afterEach(() => {
    mock.timers.reset();
  });

  it('should transform data from a stream and return metadata', async () => {
    const options = { precision: 'ms' };
    const transformer = new OIBusTimeValuesToOIAnalyticsTransformer(logger, testData.transformers.list[0], options);
    const dataChunks: Array<OIBusTimeValue> = [
      { pointId: 'reference1', timestamp: testData.constants.dates.DATE_1, data: { value: '1' } },
      { pointId: 'reference2', timestamp: testData.constants.dates.DATE_2, data: { value: '2', quality: 'good' } },
      { pointId: 'reference3', timestamp: testData.constants.dates.DATE_3, data: { value: 'value1' } }
    ];
    const mockStream = new Readable();

    const promise = transformer.transform(mockStream, { source: 'test' }, null);
    mockStream.push(JSON.stringify(dataChunks));
    mockStream.push(null);

    await flushPromises();
    const result = await promise;

    assert.deepStrictEqual(result, {
      output: Buffer.from(
        JSON.stringify(
          dataChunks.map(value => ({
            pointId: value.pointId,
            timestamp: value.timestamp,
            data: { value: value.data.value }
          }))
        )
      ),
      metadata: {
        contentFile: 'randomId.json',
        contentSize: 0,
        createdAt: '',
        numberOfElement: 3,
        contentType: 'oianalytics'
      }
    });
  });

  it('should properly format instant with precision', () => {
    const options = { precision: 'ms' };
    const transformer = new OIBusTimeValuesToOIAnalyticsTransformer(logger, testData.transformers.list[0], options);

    assert.strictEqual(transformer.formatInstant('2020-03-15T12:34:56.789Z', 'ms'), '2020-03-15T12:34:56.789Z');
    assert.strictEqual(transformer.formatInstant('2020-03-15T12:34:56.789Z', 's'), '2020-03-15T12:34:56.000Z');
    assert.strictEqual(transformer.formatInstant('2020-03-15T12:34:56.789Z', 'min'), '2020-03-15T12:34:00.000Z');
    assert.strictEqual(transformer.formatInstant('2020-03-15T12:34:56.789Z', 'hr'), '2020-03-15T12:00:00.000Z');
  });

  it('should correctly expose the manifest settings', () => {
    assert.ok(timeValuesToOianalyticsManifest.settings !== undefined);
    assert.strictEqual(timeValuesToOianalyticsManifest.settings.type, 'object');
    assert.strictEqual(timeValuesToOianalyticsManifest.settings.key, 'options');
    assert.strictEqual(timeValuesToOianalyticsManifest.settings.attributes[0].key, 'precision');
  });
});
