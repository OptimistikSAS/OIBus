import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'stream';
import testData from '../tests/utils/test-data';
import {flushPromises} from '../tests/utils/test-utils';
import PinoLogger from '../tests/__mocks__/service/logger/logger.mock';
import IsoTransformer from './iso-transformer';
import isoManifest from './iso-transformer/manifest';

describe('IsoTransformer', () => {
  let logger: PinoLogger;

  beforeEach(() => {
    logger = new PinoLogger();
    mock.timers.enable({ apis: ['Date'], now: new Date(testData.constants.dates.FAKE_NOW) });
  });

  afterEach(() => {
    mock.timers.reset();
  });

  it('should transform data from a stream and return metadata without filename', async () => {
    const transformer = new IsoTransformer(logger, testData.transformers.list[0], {});
    const mockStream = new Readable();

    const promise = transformer.transform(mockStream, { source: 'test' }, null);
    mockStream.push('chunk1');
    mockStream.push('chunk2');
    mockStream.push('chunk3');
    mockStream.push(null);

    await flushPromises();
    const result = await promise;

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

  it('should transform data from a stream and return metadata', async () => {
    const transformer = new IsoTransformer(logger, testData.transformers.list[0], {});
    const mockStream = new Readable();

    const promise = transformer.transform(mockStream, { source: 'test' }, 'test-file.csv');
    mockStream.push('chunk1');
    mockStream.push('chunk2');
    mockStream.push('chunk3');
    mockStream.push(null);

    await flushPromises();
    const result = await promise;

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
    assert.deepStrictEqual(isoManifest.settings, {
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
