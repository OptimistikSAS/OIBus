import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'stream';
import testData from '../tests/utils/test-data';

import PinoLogger from '../tests/__mocks__/service/logger/logger.mock';
import IgnoreTransformer from './ignore-transformer';
import ignoreManifest from './ignore-transformer/manifest';

describe('IgnoreTransformer', () => {
  let logger: PinoLogger;

  beforeEach(() => {
    logger = new PinoLogger();
    mock.timers.enable({ apis: ['Date'], now: new Date(testData.constants.dates.FAKE_NOW) });
  });

  afterEach(() => {
    mock.timers.reset();
  });

  it('should transform data from a stream and return metadata without filename', async () => {
    const transformer = new IgnoreTransformer(logger, testData.transformers.list[0], {});
    const mockStream = new Readable();

    const result = await transformer.transform(mockStream, { source: 'test' }, null);

    assert.deepStrictEqual(result, {
      output: Buffer.alloc(0),
      metadata: {
        contentFile: '',
        contentSize: 0,
        createdAt: '',
        numberOfElement: 0,
        contentType: ''
      }
    });
  });

  it('should return manifest', () => {
    assert.deepStrictEqual(ignoreManifest.settings, {
      type: 'object',
      key: 'options',
      translationKey: 'configuration.oibus.manifest.transformers.options',
      attributes: [],
      enablingConditions: [],
      validators: [],
      displayProperties: {
        visible: true,
        wrapInBox: false
      }
    });
  });
});
