import { mock } from 'node:test';
import { CacheMetadata, CacheMetadataSource } from '../../../../../shared/model/engine.model';
import { ReadStream } from 'node:fs';
import { Readable } from 'node:stream';

/**
 * Create a mock object for OIBus Transformer
 */
export default class OIBusTransformerMock {
  northConnector = {};
  transformer = {};
  logger = {};
  transform = mock.fn(
    async (
      _data: ReadStream | Readable,
      _source: CacheMetadataSource,
      _filename: string | null
    ): Promise<{ metadata: CacheMetadata; output: Buffer }> => ({ metadata: {} as CacheMetadata, output: Buffer.alloc(0) })
  );
}
