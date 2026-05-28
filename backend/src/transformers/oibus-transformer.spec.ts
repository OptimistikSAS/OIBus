import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import type { ReadStream } from 'node:fs';
import OIBusTransformer from './oibus-transformer';
import PinoLogger from '../tests/__mocks__/service/logger/logger.mock';
import testData from '../tests/utils/test-data';
import type { CacheMetadata, CacheMetadataSource } from '../../shared/model/engine.model';

// Minimal concrete subclass to exercise the abstract base class
class ConcreteTransformer extends OIBusTransformer {
  async transform(
    data: ReadStream | Readable,
    source: CacheMetadataSource,
    filename: string | null
  ): Promise<{ metadata: CacheMetadata; output: Buffer }> {
    const chunks: Array<string> = [];
    for await (const chunk of data as AsyncIterable<string | Buffer>) {
      chunks.push(typeof chunk === 'string' ? chunk : chunk.toString());
    }
    return {
      metadata: { contentFile: filename ?? 'out', contentSize: 0, numberOfElement: 0, createdAt: '', contentType: 'json' },
      output: Buffer.from(chunks.join(''))
    };
  }
}

describe('OIBusTransformer (base class)', () => {
  const logger = new PinoLogger();
  const transformer = testData.transformers.list[0];

  it('transformInMemory should JSON.stringify non-string data and pass it to transform()', async () => {
    const instance = new ConcreteTransformer(logger, transformer, {});
    const data = { key: 'value' };
    const result = await instance.transformInMemory(data, { source: 'test' }, 'test.json');
    assert.strictEqual(result.output.toString(), JSON.stringify(data));
  });

  it('transformInMemory should pass a string directly to transform() without re-stringifying', async () => {
    const instance = new ConcreteTransformer(logger, transformer, {});
    const data = '{"key":"value"}';
    const result = await instance.transformInMemory(data, { source: 'test' }, 'test.json');
    assert.strictEqual(result.output.toString(), data);
  });
});
