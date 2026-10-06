import { ReadStream } from 'node:fs';
import { Readable } from 'node:stream';
import { mock } from 'node:test';

import { CacheMetadata } from '../../../../../shared/model/api/engine.model';

import { CacheMetadataSource } from '../../../../model/engine.model';

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
  transformInMemory = mock.fn(
    async (
      _data: unknown,
      _source: CacheMetadataSource,
      _filename: string | null
    ): Promise<{ metadata: CacheMetadata; output: Buffer }> => ({ metadata: {} as CacheMetadata, output: Buffer.alloc(0) })
  );
}
